# TODO: make interaction with the db asynchronous

import src.data as data
from typing import Optional, Tuple
from src.util import logger
from pprint import pformat
from sqlalchemy import create_engine, text, Table, MetaData, Column, Integer, \
        Float, String, DateTime, Enum, ForeignKey, select, update
from sqlalchemy.orm import declarative_base, relationship, Session
from src.constants import DB_HOST, DB_PORT, DB_USER, DB_PASSWORD
import urllib
from datetime import datetime

Base = declarative_base()

class Log(Base):
    __tablename__ = "log"

    id = Column(Integer, primary_key = True)
    run_id = Column(Integer, ForeignKey("run.id"), nullable = False)
    context = Column(String, nullable = False)
    timestamp = Column(DateTime, nullable = False)
    stdout = Column(String, nullable = False)
    stderr = Column(String, nullable = False)

    run: "Run" = relationship("Run", back_populates = "logs")


class Code(Base):
    __tablename__ = "code"

    commit_hash = Column(String, primary_key = True)
    description = Column(String, nullable = False)
    branch = Column(String, nullable = False)

    runs: list["Run"] = relationship("Run", back_populates = "code")


class Run(Base):
    __tablename__ = "run"

    id = Column(Integer, primary_key = True)
    code_id = Column(String, ForeignKey("code.commit_hash"), nullable = False)
    timestamp = Column(DateTime, nullable = False)
    state = Column(Enum(data.RunState), nullable = False)
    job_dir = Column(String, nullable = False)
    output_dir = Column(String, nullable = False)
    script = Column(String, nullable = False)

    code: "Code" = relationship("Code", back_populates = "runs")
    logs: "Log" = relationship("Log", back_populates = "run")
    posterior_sample: "PosteriorSample" = relationship("PosteriorSample", back_populates = "run")
    run_output: "RunOutput" = relationship("RunOutput", back_populates = "run")


class RunOutput(Base):
    __tablename__ = "run_output"

    run_id = Column(Integer, ForeignKey("run.id"), primary_key = True)
    text = Column(String, nullable = False)

    run: Run = relationship("Run", back_populates = "run_output")


class PosteriorSample(Base):
    __tablename__ = "posterior_sample"

    id = Column(Integer, primary_key = True)
    run_id = Column(Integer, ForeignKey("run.id"))
    colony_id = Column(Integer, nullable = False)
    nest_quality_assessment_error = Column(Float, nullable = False)
    percentage_foragers = Column(Float, nullable = False)
    number_nests = Column(Integer, nullable = False)
    exploring_phase = Column(Integer, nullable = False)

    run: Run = relationship("Run", back_populates = "posterior_sample")


def create_run(run: data.Run) -> int:
    logger.info(f"Putting run into db: {run}.")

    with Session(engine) as session:

        code_orm = session.get(Code, run.code.commit_hash)
        if not code_orm:
            code_orm = Code(
                commit_hash = run.code.commit_hash,
                description = run.code.description,
                branch = run.code.branch)
            session.add(code_orm)

        run_orm = Run(
            timestamp = run.timestamp,
            state = data.RunState.RUNNING, # type: ignore # https://github.com/sqlalchemy/sqlalchemy/issues/6435
            job_dir = run.job_dir,
            output_dir = run.output_dir,
            script = run.script,
            code = code_orm)
        session.add(run_orm)

        session.commit()

        run_id = run_orm.id

    if run_id is None:
        raise RuntimeError("Did not get any id for the run from the database.")
    else:
        return run_id


def get_run(run_id: int) -> Optional[data.Run]:
    with Session(engine) as session:
        run_orm = session.get(Run, run_id)

        if run_orm is None:
            result = None
        else:
            result = data.Run.from_orm(run_orm)

    return result


def get_all_runs() -> list[data.Run]:
    with Session(engine) as session:
        stmt = select(Run).order_by(Run.timestamp)

        runs = [data.Run.from_orm(r) for r in session.execute(stmt).scalars()]

    return runs


def put_logs(run_id: int, logs: data.Logs) -> None:
    logger.info("Putting logs into db")

    with Session(engine) as session:

        run_orm = session.get(Run, run_id)
        if not run_orm:
            raise RuntimeError(f"Run {run_id} not found in the database while trying to put related logs.")

        for _, context, log_list in logs.items():
            for log in log_list:
                logs_orm = Log(
                    context = context,
                    timestamp = log.timestamp,
                    stdout = log.stdout,
                    stderr = log.stderr,
                    run = run_orm)
                session.add(logs_orm)

        session.commit()


def get_logs(run_id: int, from_time: Optional[datetime] = None) -> data.Logs:
    if from_time is None:
        stmt = select(Log).where(Log.run_id == run_id)
    else:
        stmt = select(Log) \
            .where(Log.run_id == run_id, Log.timestamp >= from_time) \
            .order_by(Log.timestamp)

    log_list: list[Tuple[data.Run, str, data.Log]] = []
    with Session(engine) as session:
        for l in session.execute(stmt).scalars():
            run = data.Run.from_orm(l.run)
            context = l.context
            log = data.Log(timestamp = l.timestamp, stdout = l.stdout,
                    stderr = l.stderr)
            log_list.append((run, context, log))

    result = data.Logs.new(*log_list)

    return result


def put_run_output(run_id: int, text: data.RunOutput) -> None:
    logger.info("Putting run output into db.")

    with Session(engine) as session:

        run_orm = session.get(Run, run_id)
        if not run_orm:
            raise RuntimeError(f"Run {run_id} not found in the database while trying to put related run outputs.")

        run_output_orm = RunOutput(
                text = text.text,
                run = run_orm)

        session.add(run_output_orm)
        session.commit()


def get_run_output(run_id: int) -> Optional[data.RunOutput]:
    logger.info("Putting run output into db.")

    with Session(engine) as session:

        run_orm = session.get(RunOutput, run_id)
        if run_orm is None:
            result = None
        else:
            result =  data.RunOutput.from_orm(run_orm)

    return result


def put_run_state(run_id: int, run_state: data.RunState) -> None:
    logger.info(f"Putting run state into db: \n{run_state}")

    with Session(engine) as session:

        run_orm = session.get(Run, run_id)
        if not run_orm:
            raise RuntimeError(f"Run {run_id} not found in the database while trying to put a new state.")
        else:
            run_orm.state = run_state.name  # The enum setter requires a string

        session.commit()


def put_posterior_sample(run_id: int, results: data.PosteriorSample) -> None:
    logger.info(f"Putting ABC results into db.")

    with Session(engine) as session:

        run_orm = session.get(Run, run_id)
        if not run_orm:
            raise RuntimeError(f"Run {run_id} not found in the database while trying to put a posterior sample.")

        for point in results.data:
            p = PosteriorSample(
                colony_id = point.colony_id,
                nest_quality_assessment_error = point.nest_quality_assessment_error,
                percentage_foragers = point.percentage_foragers,
                number_nests = point.number_nests,
                exploring_phase = point.exploring_phase,
                run = run_orm)
            session.add(p)

        session.commit()


def get_posterior_sample(run_id: int) -> Optional[data.PosteriorSample]:
    logger.info(f"Retrieving posterior sample for run \n{run_id}.")

    with Session(engine) as session:
        run = session.get(Run, run_id)
        if run is None:
            result = None
        else:
            stmt = select(PosteriorSample).where(PosteriorSample.run_id == run_id)
            result = data.PosteriorSample(
                    data = [data.PosteriorSamplePoint(
                             colony_id = x.colony_id,
                             nest_quality_assessment_error = x.nest_quality_assessment_error,
                             percentage_foragers = x.percentage_foragers,
                             number_nests = x.number_nests,
                             exploring_phase = x.exploring_phase)
                            for x in session.execute(stmt).scalars()])

    return result

def delete_run(run_id: int) -> None:
    logger.info(f"Deleting run {run_id}.")

    with Session(engine) as session:
        run_orm = session.get(Run, run_id)
        session.delete(run_orm)
        session.commit()


engine = create_engine(
        f"postgresql+psycopg2://{DB_USER}:{urllib.parse.quote_plus(DB_PASSWORD)}@{DB_HOST}:{DB_PORT}/postgres",
        echo = True,
        future = True)

Base.metadata.create_all(engine)

