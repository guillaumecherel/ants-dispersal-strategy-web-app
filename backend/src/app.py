#!/usr/bin/env python3

from typing import Optional
from collections import namedtuple
from fastapi import FastAPI, Response, status, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from markupsafe import escape
from datetime import datetime
from src.data import Code, RunState, Run, RunWithId, RunOutput, Logs, PosteriorSample, Log
from src import db
from src.tasks import do_run

app = FastAPI()

#TODO: put the allowed host in proper config
allowed_origins = [
        "http://localhost:3000",
]

app.add_middleware(
        CORSMiddleware,
        allow_origins = allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
)

@app.get("/launch/{commit_hash}")
async def launch(
        commit_hash: str,
        branch: str,
        description: str,
        timestamp: str,
        job_dir: str,
        output_dir: str,
        script: str,
        bg_tasks: BackgroundTasks,
        ) -> None:
    run = Run(
            code = Code(
                commit_hash = commit_hash,
                branch = branch,
                description = description),
            timestamp = timestamp,
            job_dir = job_dir,
            output_dir = output_dir,
            script = script,
            state = RunState.RUNNING)
    bg_tasks.add_task(do_run, run)
    return None


@app.get("/all_runs")
async def run_list() -> list[RunWithId]:
    runs = [db.get_all_runs()]
    return db.get_all_runs()


@app.get("/run/{run_id}")
async def get_run(run_id: str, response: Response) -> Optional[Run]:
    result = db.get_run(int(run_id))

    if result is None:
        response.status_code = status.HTTP_404_NOT_FOUND

    return result


@app.get("/output/{run_id}")
async def get_output(run_id: str, response: Response) -> Optional[RunOutput]:
    result = db.get_run_output(int(run_id))

    if result is None:
        response.status_code = status.HTTP_404_NOT_FOUND

    return result


@app.get("/logs/{run_id}")
async def get_logs(response: Response, run_id: str,
        from_time: Optional[datetime] = None) -> Optional[dict[str, list[Log]]]:
    logs = db.get_logs(int(run_id), from_time)

    if logs is None:
        response.status_code = status.HTTP_404_NOT_FOUND

    # If there is no log whose timestamp is `from_time` or greater, the logs are
    # empty.
    if logs.is_empty():
        return {}

    # There is at most one run in the logs dictionary. Extract the corresponding
    # contexts and logs.
    result = next(iter(logs.logs.values()))

    return result


@app.get("/posterior_sample/{run_id}")
async def get_posterior_sample(run_id: int, response: Response) -> Optional[PosteriorSample]:
    result = db.get_posterior_sample(int(run_id))

    if result is None:
        response.status_code = status.HTTP_404_NOT_FOUND

    return result


