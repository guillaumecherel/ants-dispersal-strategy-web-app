#!/usr/bin/env python3

from typing import Optional
from collections import namedtuple
from fastapi import FastAPI, Response, status
from markupsafe import escape
from data import Code, RunState, Run, RunOutput, Logs, PosteriorSample, Log
from datetime import datetime
import db

app = FastAPI()

@app.get("/launch/{commit_hash}")
async def launch(commit_hash: str, timestamp: str) -> str:
    return f"<p>run_id = {escape(commit_hash)+escape(timestamp)}</p>"


@app.get("/all_runs")
async def run_list() -> list[Run]:
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


