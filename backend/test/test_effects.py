import pytest
from src import openmole
from src import db
from src import tasks
from src.data import *
from sqlalchemy import select
from sqlalchemy.orm import Session
from datetime import datetime

code = Code(
        commit_hash = 'ed74e56c08c7ca3ea5df392f3517ca4ae3f006e8',
        description = 'whatevs',
        branch = 'test')

run = Run(
        code = code,
        timestamp=datetime(2020, 1, 1, 12, 13),
        job_dir = 'openmole',
        output_dir = 'output',
        script ='Colony_fission_ABC.oms',
        state = RunState.RUNNING)


@pytest.mark.asyncio
async def test_do_run() -> None:

    run_id = await tasks.do_run(run)

    sample = db.get_posterior_sample(run_id)

    if sample is not None:
        assert len(sample.data) == 9500
    else:
        assert False, f"Posterior sample for run {run_id} is None."


def test_db_create_run() -> None:
    run_id = db.create_run(run)

    result = db.get_run(run_id)

    assert result == run


def test_db_put_logs() -> None:
    context = "some context"
    log1 = Log(
            timestamp = "2021-09-01 12:00:00",
            stdout = "some output",
            stderr = "some error")
    log2 = Log(
            timestamp = "2021-09-01 13:00:00",
            stdout = "some output",
            stderr = "some error")
    logs = Logs.new((run, context, log1), (run, context, log2))

    run_id = db.create_run(run)

    db.put_logs(run_id, logs)

    for l_run, l_context, l in logs.items():
        res = db.get_logs(run_id)
        assert res == logs


def test_db_get_logs() -> None:
    context = "get_logs_context"
    log1 = Log(
            timestamp = "2021-09-01 12:00:00",
            stdout = "some output",
            stderr = "some error")
    log2 = Log(
            timestamp = "2021-09-01 13:00:00",
            stdout = "some output",
            stderr = "some error")
    logs = Logs.new((run, context, log1), (run, context, log2))

    run_id = db.create_run(run)

    db.put_logs(run_id, logs)

    res = db.get_logs(run_id)
    if res is None:
        assert False, "res is None"
    else:
        log_list = res[(run, context)]
        assert log1 in log_list
        assert log2 in log_list

    res = db.get_logs(run_id, datetime.fromisoformat("2021-09-01 13:00:00"))
    if res is None:
        assert False, "res is None"
    else:
        log_list = res[(run, context)]
        assert log1 not in log_list
        assert log2 in log_list

    res = db.get_logs(run_id, datetime.fromisoformat("2021-09-01 14:00:00"))
    if res is None:
        assert False, "res is None"
    else:
        assert res == Logs.empty()


def test_db_put_run_output() -> None:
    run_output = RunOutput(text = "some run output")

    run_id = db.create_run(run)

    db.put_run_output(run_id, run_output)

    result = db.get_run_output(run_id)

    if result is not None:
        assert run_output == RunOutput.from_orm(result)
    else:
        assert False, f"Run output for run {run_id} is None."


def test_db_put_run_state() -> None:
    run_id = db.create_run(run)

    db.put_run_state(run_id, RunState.FINISHED)

    with Session(db.engine) as session:
            stmt = select(db.Run).where(db.Run.id == run_id)
            res_run = session.execute(stmt).scalar_one()
            assert res_run.state == RunState.FINISHED
            assert res_run.code_id == run.code.commit_hash
            assert res_run.timestamp == run.timestamp
            assert res_run.job_dir == run.job_dir
            assert res_run.output_dir == run.output_dir
            assert res_run.script == run.script


def test_db_put_posterior_sample() -> None:

    posterior_sample = PosteriorSample(
            data = [PosteriorSamplePoint(
                     colony_id = 1,
                     nest_quality_assessment_error = 0.1,
                     percentage_foragers = 20.0,
                     number_nests = 4,
                     exploring_phase = 5000),
                    PosteriorSamplePoint(
                     colony_id = 2,
                     nest_quality_assessment_error = 0.1,
                     percentage_foragers = 10.0,
                     number_nests = 10,
                     exploring_phase = 1000)
                    ])

    run_id = db.create_run(run)
    db.put_posterior_sample(run_id, posterior_sample)
    result = db.get_posterior_sample(run_id)

    if result is not None:
        assert posterior_sample.data[0] in result.data
        assert posterior_sample.data[1] in result.data
    else:
        assert False, f"Posterior sample for run {run_id} is None."



def test_db_delete_run() -> None:

    run_id = db.create_run(run)

    db.delete_run(run_id)
    result = db.get_run(run_id)

    assert result is None


def test_db_all_runs() -> None:

    run1 = Run(
            code = code,
            timestamp=datetime(2020, 1, 1, 12, 13),
            job_dir = 'openmole',
            output_dir = 'output',
            script ='Colony_fission_ABC.oms',
            state = RunState.RUNNING)

    run2 = Run(
            code = code,
            timestamp=datetime(2021, 1, 1, 12, 13),
            job_dir = 'openmole',
            output_dir = 'output',
            script ='Colony_fission_ABC.oms',
            state = RunState.RUNNING)

    db.create_run(run1)
    db.create_run(run2)

    runs = db.get_all_runs()

    assert run1 in runs
    assert run2 in runs


# @pytest.mark.asyncio
# async def test_db():
#     from sqlalchemy import create_engine, text, Table, MetaData, Column, Integer, \
#             Float, String, DateTime, Enum, ForeignKey
#     from sqlalchemy.orm import declarative_base, relationship, Session
#     from constants import DB_USER, DB_PASSWORD, DB_URI
#     import urllib
# 
#     Base = declarative_base()
# 
#     engine = create_engine(
#             f"postgresql+psycopg2://{DB_USER}:{urllib.parse.quote_plus(DB_PASSWORD)}@{DB_URI}/test",
#             echo = True,
#             future = True)
# 
# 
#     class Parent(Base):
#         __tablename__ = 'parent'
# 
#         id = Column(Integer, primary_key = True)
# 
#         children = relationship("Child", back_populates = "parent")
# 
#     class Child(Base):
#         __tablename__ = 'children'
# 
#         id = Column(Integer, primary_key = True)
#         parent_id = Column(Integer, ForeignKey("parent.id"), nullable = False)
# 
#         parent = relationship("Parent", back_populates = "children")
# 
#     Base.metadata.create_all(engine)
# 
#     # Add
#     parent = Parent(id = 1)
#     with Session(engine) as session:
#         session.add(parent)
#         session.commit()
# 
#     parent = Parent(id = 1)
#     child = Child(parent_id = 1)
#     with Session(engine) as session:
#         session.merge(parent)
#         session.add(child)
#         session.commit()
#         print("child.id = " + str(child.id))
# 
#     # Merge
#     parent = Parent(id = 1)
#     with Session(engine) as session:
#         session.add(parent)
#         session.commit()
# 
#     parent = Parent(id = 1)
#     child = Child(parent = parent)
#     with Session(engine) as session:
#         session.merge(child)
#         session.commit()
#         print("child.id = " + str(child.id))
