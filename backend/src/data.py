from abc import ABC, abstractmethod
from pydantic import BaseModel, validator
from enum import Enum
from datetime import datetime
from typing import Tuple, Union, TextIO, Iterable
from math import floor
from constants import *
from textwrap import dedent, indent
from itertools import chain
import csv

class Code(BaseModel, frozen=True, orm_mode = True):
    commit_hash: str
    description: str
    branch: str


class Run(BaseModel, frozen=True, orm_mode = True):
    code: Code
    timestamp: datetime
    job_dir: str
    output_dir: str
    script: str
    state: "RunState"


class RunState(Enum):
    RUNNING = 1
    FAILED = 2
    FINISHED = 3


class PosteriorSamplePoint(BaseModel, frozen=True):
    colony_id: int
    nest_quality_assessment_error: float
    percentage_foragers: float
    number_nests: int
    exploring_phase: int

    @validator('colony_id')
    def colony_id_must_be_bounded(cls, v: int) -> int:
        if v < 0 or v >= COLONY_COUNT:
            raise ValueError(f"Colony id should be >= 0 and < {COLONY_COUNT}.")
        else:
            return v

    @validator('nest_quality_assessment_error')
    def nest_quality_assessment_error_must_be_positive(cls, val: float) -> float:
        if val < 0:
            raise ValueError("NestQualityAssessmentError must be positive")
        return val

    @validator('percentage_foragers')
    def percentage_foragers_must_be_percentage(cls, val: float) -> float:
        if val < 0 or val > 100:
            raise ValueError("PercentageForagers be a percentage.")
        return val

    @validator('number_nests')
    def number_nest_must_be_positive(cls, val: int) -> int:
        if val < 0:
            raise ValueError("NumberNests must positive.")
        return val

    @validator('exploring_phase')
    def exploring_phase_must_be_postitive(cls, val: int) -> int:
        if val < 0:
            raise ValueError("ExploringPhase must positive.")
        return val





class PosteriorSample(BaseModel, frozen=True):
    data: list[PosteriorSamplePoint]

    @staticmethod
    def from_csv_string(csv_data: str, colony: "Colony") -> "PosteriorSample":
        reader = csv.DictReader(csv_data.splitlines())
        data = []
        colony_id = colony.colony_id
        for row in reader:
            data.append(PosteriorSamplePoint(
                colony_id = colony_id,
                nest_quality_assessment_error = row['nest_quality_assessment_error'],
                percentage_foragers = row['percentage_foragers'],
                number_nests = floor(float(row['number_nests_dbl'])),
                exploring_phase = floor(float(row['exploring_phase_dbl']))))

        return PosteriorSample(data = data)


    @staticmethod
    def from_list(data: list["PosteriorSample"]) -> "PosteriorSample":
        return PosteriorSample(data = [row for row in chain.from_iterable(r.data for r in data)])


class ResultsRessourceAlloc(BaseModel, frozen=True, orm_mode = True):
    data: list[Tuple["Colony", "Resource", "NestCount"]]

    @staticmethod
    def from_csv_string(data: str) -> "ResultsRessourceAlloc":
        pass


class Colony(BaseModel, frozen=True, orm_mode = True):
    colony_id: int

    @validator('colony_id')
    def colony_id_must_be_bounded(cls, v: int) -> int:
        if v < 0 or v >= COLONY_COUNT:
            raise ValueError(f"Colony id should be >= 0 and < {COLONY_COUNT}.")
        else:
            return v


def list_colonies() -> list[Colony]:
    return [Colony(colony_id = colony_id) for colony_id in range(COLONY_COUNT)]


class ModelParameter(BaseModel, frozen=True, orm_mode = True):
    pass


class NestQualityAssessmentError(ModelParameter, frozen=True, orm_mode = True):
    val: float

    @validator('val')
    def val_must_be_positive(cls, val: float) -> float:
        if val < 0:
            raise ValueError("NestQualityAssessmentError must be positive")
        return val


class PercentageForagers(ModelParameter, frozen=True, orm_mode = True):
    val: float

    @validator('val')
    def val_must_be_percentage(cls, val: float) -> float:
        if val < 0 or val > 100:
            raise ValueError("PercentageForagers be a percentage.")
        return val


class NumberNests(ModelParameter, frozen=True, orm_mode = True):
    val: int

    @validator('val')
    def val_must_be_positive(cls, val: int) -> int:
        if val < 0:
            raise ValueError("NumberNests must positive.")
        return val


class ExploringPhase(ModelParameter, frozen=True, orm_mode = True):
    val: int

    @validator('val')
    def val_must_be_positive(cls, val: int) -> int:
        if val < 0:
            raise ValueError("ExploringPhase must positive.")
        return val


class Density(BaseModel, frozen=True, orm_mode = True): 
    val: float

    @validator('val')
    def val_must_be_positive(cls, val: float) -> float:
        if val < 0:
            raise ValueError("Density must positive.")
        return val


class Resource(BaseModel, frozen=True, orm_mode = True):
    val: int

    @validator('val')
    def val_must_be_positive(cls, val: int) -> int:
        if val < 0:
            raise ValueError("Resource must be positive.")
        return val


class NestCount(BaseModel, frozen=True, orm_mode = True):
    val: int

    def nest_count(cls, val: int) -> int:
        if val < 0:
            raise ValueError("NestCount must be positive.")
        return val


class RunOutput(BaseModel, frozen = True, orm_mode = True):
    text: str


class Log(BaseModel, frozen=True, orm_mode = True):
    timestamp: datetime
    stdout: str
    stderr: str

    def append(self, log: "Log") -> "Log":
        return Log(
                timestamp = min(self.timestamp, log.timestamp),
                stdout = self.stdout + "\n" + log.stdout,
                stderr = self.stderr + "\n" + log.stderr)


def log_now(stdout: str, stderr: str) -> "Log":
    return Log(
            timestamp = datetime.now(),
            stdout = stdout,
            stderr = stderr)


class Logs(BaseModel, frozen=True, orm_mode = True):
    logs: dict[Run, dict[str, list[Log]]]

    def add(self, run: Run, context: str, log: Log) -> "Logs":
        new_logs = self.logs.copy()
        if run in self.logs:
            new_logs[run] = self.logs[run].copy()
            if context in self.logs[run]:
                new_logs[run][context].append(log)
            else:
                new_logs[run][context] = [log]
        else:
            new_logs[run] = {context: [log]}
        return Logs(logs = new_logs)

    def add_all(self, logs: "Logs") -> "Logs":
        new_logs = self.logs.copy()
        for (run, context_dict) in logs.logs.items():
            if run in new_logs:
                new_logs[run] = self.logs[run].copy()
                for context, log_list in context_dict.items():
                    if context in new_logs[run]:
                        new_logs[run][context].append(*log_list)
                    else:
                        new_logs[run][context] = log_list
            else:
                new_logs[run] = {}
                for context, log_list in context_dict.items():
                    new_logs[run][context] = log_list
        return Logs(logs = new_logs)

    def is_empty(self) -> bool:
        return len(self.logs) == 0

    @staticmethod
    def empty() -> "Logs":
        return Logs(logs = {})

    @staticmethod
    def new(*args: Tuple[Run, str, Log]) -> "Logs":
        new_logs = Logs.empty()
        for run, context, log in args:
            new_logs = new_logs.add(run, context, log)
        return new_logs

    def __getitem__(self, key: Tuple[Run, str]) -> list[Log]:
        run, context = key
        return self.logs[run][context]

    def __len__(self) -> int:
        return len(self.logs)

    def items(self) -> Iterable[Tuple[Run, str, list[Log]]]:
        for run, context_dict in self.logs.items():
            for context, log_list in context_dict.items():
                yield run, context, log_list

    def pretty(self) -> str:
        s = ""

        for run, context_dict in self.logs.items():
            for context, log_list in context_dict.items():
                s += f"Run: {run}\n"
                s += f"Context: {context}\n"
                for l in log_list:
                    s += f"Timestamp: {l.timestamp}\n"
                    s += f"Stdout:\n"
                    s += indent(l.stdout, "\t") + "\n"
                    s += f"Stderr:\n"
                    s += indent(l.stderr , "\t") + "\n"

        return s


# See https://pydantic-docs.helpmanual.io/usage/postponed_annotations/#self-referencing-models
PosteriorSamplePoint.update_forward_refs()
PosteriorSample.update_forward_refs()
Run.update_forward_refs()


