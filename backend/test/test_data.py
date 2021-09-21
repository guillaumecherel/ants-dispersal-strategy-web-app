import pytest
from data import *
from datetime import datetime

code1 = Code(commit_hash = "code1hash", description = "whatevs", branch="test")
code2 = Code(commit_hash = "code2hash", description = "whatevs", branch="test")

run1 = Run(code = code1, timestamp = datetime.fromisoformat("2021-01-01 12:34"),
        job_dir = "job/1/", output_dir = "output", script = "pi.sh",
        state = RunState.RUNNING)
run2 = Run(code = code2, timestamp = datetime.fromisoformat("2080-08-08 01:48"),
        job_dir = "job/2/", output_dir = "output", script = "tau.sh",
        state = RunState.RUNNING)

log1 = Log(timestamp = "2021-01-01 12:34", stdout = "a", stderr = "b")
log2 = Log(timestamp = "2021-01-01 12:34", stdout = "c", stderr = "e")


def test_log_append() -> None:
    combined = log1.append(log2)
    assert combined.stdout == "a\nc"
    assert combined.stderr == "b\ne"


def test_logs_new() -> None:
    logs = Logs.new((run1, "context", log1), (run1, "context", log2), (run2, "context", log1))
    assert logs[(run1, "context")] == [log1, log2]
    assert logs[(run2, "context")] == [log1]


def test_logs_add() -> None:
    # Adding to an empty
    logs = Logs.empty().add(run1, "context", log1)
    assert logs[(run1, "context")] == [log1]

    # Adding to the same run and context
    logs = logs.add(run1, "context", log2)
    assert logs[(run1, "context")] == [log1, log2]

    # Adding to a different run and context
    logs = logs.add(run2, "context2", log1)
    assert logs[(run2, "context2")] == [log1]

    # Other logs should be unchanged
    assert logs[(run1, "context")] == [log1, log2]


def test_logs_add_all() -> None:
    # Adding to empty logs
    logs = Logs.empty().add_all(Logs.new((run1, "context", log1)))
    assert logs[(run1, "context")] == [log1]

    # Adding empty logs
    assert logs == logs.add_all(Logs.empty())

    # Adding to non-empty logs
    logs1 = Logs.empty().add(run1, "context", log1).add(run2, "context2", log2)
    logs2 = Logs.empty().add(run1, "context", log2)
    combined = logs1.add_all(logs2)
    assert len(combined) == 2
    assert combined[(run1, "context")] == [log1, log2]
    assert combined[(run2, "context2")] == [log2]

