from asyncio import sleep, gather, create_task
from data import Run, Code
from constants import *
import openmole
import db
from util import do_nothing, logger

async def do_run(run: Run) -> int:
    logs, om_run_id = await openmole.send_job(REPOSITORY_PATH, run)

    logger.info(logs.pretty())

    db_run_id = db.create_run(run)
    db.put_logs(db_run_id, logs)

    if om_run_id is not None:
        async for run_state, run_logs, run_output in openmole.watch_run(run, om_run_id):

            logger.info(run_logs.pretty())
            logger.info(f"Run output: {run_output}")

            if run_state is not None:
                db.put_run_state(db_run_id, run_state)
            db.put_logs(db_run_id, run_logs)
            db.put_run_output(db_run_id, run_output)

            await sleep(OPENMOLE_STATE_PULL_DELAY)

        logs, results = await openmole.get_results(run, om_run_id)
        logger.info(logs.pretty())

        db.put_logs(db_run_id, logs)

        if results is None:
            raise RuntimeError(f"Did not get the run results from openmole. Logs: {logs.pretty()}")
        else:
            db.put_posterior_sample(db_run_id, results)

    else:
        raise RuntimeError(f"Did not get any run_id from openmole. Logs: {logs.pretty()}")

    return db_run_id

