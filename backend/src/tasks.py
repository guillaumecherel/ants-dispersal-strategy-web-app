from asyncio import sleep, gather, create_task
from src.data import Run, Code, RunState, RunOutput, RunWithId
from src.constants import *
from src import openmole
from src import db
from src.util import do_nothing, logger

async def do_run(run: Run) -> RunWithId:
    logs, om_run_id = await openmole.send_job(REPOSITORY_PATH, run)

    logger.info(logs.pretty())

    run = db.create_run(run)
    db.put_logs(run.id, logs)
    db.put_run_output(run.id, RunOutput(text = ""))

    if om_run_id is None:
        db.put_run_state(run.id, RunState.FAILED)
    else:
        async for run_state, run_logs, run_output in openmole.watch_run(run, om_run_id):

            logger.info(run_logs.pretty())
            logger.info(f"Run output: {run_output}")

            if run_state is not None:
                db.put_run_state(run.id, run_state)
            db.put_logs(run.id, run_logs)
            db.put_run_output(run.id, run_output)

            await sleep(OPENMOLE_STATE_PULL_DELAY)

        logs, results = await openmole.get_results(run, om_run_id)
        logger.info(logs.pretty())

        db.put_logs(run.id, logs)

        if results is None:
            raise RuntimeError(f"Did not get the run results from openmole. Logs: {logs.pretty()}")
        else:
            db.put_posterior_sample(run.id, results)

    return run

