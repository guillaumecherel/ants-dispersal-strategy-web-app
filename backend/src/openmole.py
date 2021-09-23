import gzip
from aiofiles import open
from asyncio import gather
from pydantic import BaseModel
from typing import AsyncIterator, Tuple, Optional, TextIO
from src.data import Code, RunState, Logs, Log, Run, PosteriorSample, Colony, \
        list_colonies, RunOutput, log_now
from httpx import AsyncClient
from repository import pack
from src.constants import *
from src.util import logger
from os import path
from io import BytesIO

async def send_job(repository_path: str, run: Run) -> Tuple[Logs, Optional["RunId"]]:
    pack_log, archive = await pack(repository_path, run)

    if archive is None:
        return pack_log, None

    else:
        async with AsyncClient() as client:
            async with open(archive, "rb") as f:
                content = await f.read()
                response = await client.post(f"http://{OPENMOLE_HOST}:{OPENMOLE_PORT}/job",
                        files = {
                            'workDirectory': content,
                        },
                        data = {'script': path.join(run.job_dir, run.script)})

        logger.info(f"send_job query: {response.text}")

        json = response.json()
        if "id" in json:

            run_id = RunId(val = json["id"])
            return pack_log, run_id

        elif "message" in json:

            stderr = json["message"]
            if "stackTrace" in json:
                stderr += f"\n{json['stackTrace']}"

            send_log = log_now( stdout = "", stderr = stderr)

            return pack_log.add(run, "openmole", send_log), None

        else:
            response.raise_for_status()
            raise #Silence mypy "missing return statement"


async def watch_run(run: Run, run_id: "RunId") -> AsyncIterator[Tuple[Optional[RunState], Logs, RunOutput]]:
    go = True
    while go:

        (logs1, run_state), run_output = await gather(
                get_run_state(run, run_id),
                get_run_output(run, run_id))

        if run_state in [RunState.FINISHED, RunState.FAILED]:
            go = False

        yield run_state, logs1, run_output


async def get_run_state(run: Run, run_id: "RunId") -> Tuple[Logs, Optional[RunState]]:
    async with AsyncClient() as client:
        response = await client.get(f"http://{OPENMOLE_HOST}:{OPENMOLE_PORT}/job/{run_id.val}/state")

    json = response.json()
    if "state" in json:
        if json["state"] == "running":
            run_state = RunState.RUNNING
        elif json["state"] == "finished":
            run_state = RunState.FINISHED
        else:
            run_state = RunState.FAILED

        if run_state == RunState.FINISHED:
            logs = Logs.empty()

        elif run_state == RunState.RUNNING:

            stdout = f"Jobs ready: {json['ready']}, running: {json['running']}, completed: {json['completed']}.\n"
            stderr = ""

            for env in json['environments']:

                stdout += f"In environment {env.get('name', '(name unknown)')}: {env['submitted']} jobs submitted, {env['running']} running, {env['done']} done, {env['failed']} failed.\n"

                for e in env['errors']:
                    stderr += f"Error level {e['level']}: {e['message']}\n"
                    stderr += f"Stack trace: e['stackTrace']\n"

            logs = Logs.new((run, "openmole", log_now(stdout = stdout, stderr = stderr)))

        else: # run_state == RunState.FAILED
            stdout = ""
            stderr = f"Error: {json['error']['message']}\n"
            stderr += f"Stack trace: json['error']['stackTrace']\n"

            logs = Logs.new((run, "openmole", log_now(stdout = stdout, stderr = stderr)))

        return logs, run_state

    else:
        response.raise_for_status()
        raise #Silence mypy "missing return statement"


async def get_run_output(run: Run, run_id: "RunId") -> RunOutput:
    async with AsyncClient() as client:
        response = await client.get(f"http://{OPENMOLE_HOST}:{OPENMOLE_PORT}/job/{run_id.val}/output")

    return RunOutput(text = response.text)


async def get_results(run: Run, run_id: "RunId") -> Tuple[Logs, Optional[PosteriorSample]]:
    logs1, filenames = await get_most_recent_filenames(run, run_id)
    logs2, results = await get_results_from_filenames(run, run_id, filenames)
    return logs1.add_all(logs2), results


async def get_most_recent_filenames(run: Run, run_id: "RunId") -> Tuple[Logs, list[Tuple[Colony, str]]]:

    def route(colony: Colony) -> str:
        return f"http://{OPENMOLE_HOST}:{OPENMOLE_PORT}/job/{run_id.val}/workDirectory/{run.output_dir}/ResultsABC_5params/posteriorSample_{colony.colony_id}"

    async with AsyncClient() as client:
        data = {"last": 1}
        logger.info(f"Fetching {route(list_colonies()[0])}")
        responses = await gather(
                *[client.request( "PROPFIND", route(colony), data = data)
                    for colony in list_colonies()])

    logs = Logs.empty()

    most_recent_files = []
    for col, r in zip(list_colonies(), responses):
        rj = r.json()
        if "entries" in rj:
            if len(rj["entries"]) > 0:
                most_recent_files.append((col, rj["entries"][0]["name"]))
            else:
                error = f"No result for colony {col} (no file in the corresponding output directory)"
                logs = logs.add(run, "backend",
                        log_now(stdout = "", stderr = error))

        elif "message" in rj:
            error = f"Could not get results for colony {col} from {route(col)}: {rj['message']}"
            logs.add(run, "backend", log_now(stdout = "", stderr = error))
        else:
            rj.raise_for_status()

    return logs, most_recent_files


async def get_results_from_filenames(run: Run, run_id: "RunId", filenames: list[Tuple[Colony, str]]) -> Tuple[Logs, Optional[PosteriorSample]]:

    def route(colony: Colony, filename: str) -> str:
        return f"http://{OPENMOLE_HOST}:{OPENMOLE_PORT}/job/{run_id.val}/workDirectory/{run.output_dir}/ResultsABC_5params/posteriorSample_{colony.colony_id}/{filename}"

    async with AsyncClient() as client:
        responses = await gather(*[client.get(route(col, filename))
            for col, filename in filenames])

    results = []
    for (col, filename), r in zip(filenames, responses):
        try:
            with BytesIO(r.content) as b:
                with gzip.open(b, 'r') as f:
                    csv = f.read().decode("utf-8")
            res = PosteriorSample.from_csv_string(csv, col)
        except ValueError as e:
            error = f"Error when reading results from file {filename}: {e}"
            logs = Logs.new((run, "backend", log_now(stdout = "", stderr = error)))
            return logs, None

        results.append(res)

    return Logs.empty(), PosteriorSample.from_list(results)


class RunId(BaseModel):
    val: str


