from pydantic import BaseModel
from typing import Iterator, Tuple, Optional
from src.data import Code, Logs, Log, Run, log_now
from asyncio import Lock, create_subprocess_shell, subprocess
from collections import defaultdict
from os import mkdir
from os.path import join, dirname
from tempfile import gettempdir
from textwrap import dedent
from src.constants import *

lock: defaultdict[str, Lock] = defaultdict(Lock)

async def pack(path: str, run: Run) -> Tuple[Logs, Optional[str]]:
    async with lock[path]:

        checkout_returncode, checkout_log = await checkout(path, run)

        if checkout_returncode != 0:
            return checkout_log, None

        archive_returncode, archive_log, archive_path = await archive(
                path, run)

        if archive_returncode != 0:
            return checkout_log.add_all(archive_log), None

        return checkout_log.add_all(archive_log), archive_path


async def checkout(path: str, run: Run) -> Tuple[int, Logs]:
    """This method must not be called directly. To function safely, it
    relies on the lock acquired with the `pack` method."""

    checkout_cmd = "\n".join([\
        f"cd {path}",
        f"git fetch origin {run.code.commit_hash} \\",
        f"&& git reset --hard {run.code.commit_hash}"])


    proc = await create_subprocess_shell(
            checkout_cmd,
            stdout = subprocess.PIPE,
            stderr = subprocess.PIPE)

    stdout, stderr = await proc.communicate()
    log = Logs.new((run, "checkout", log_now(
            stdout = f"Running command: \n{checkout_cmd}\n" +
                stdout.decode("utf-8"),
            stderr = stderr.decode("utf-8"))))

    if proc.returncode is None:
        raise RuntimeError("Return code for checkout process says the job is still running.")
    else:
        return proc.returncode, log


async def archive(path: str, run: Run) -> Tuple[int, Logs, Optional[str]]:
    """This method must not be called directly. To function safely, it
    relies on the lock acquired with the `pack` method."""

    tmp_archive_path = join(TMP_DIR, run.code.commit_hash + ".tar.gz")

    try:
        mkdir(dirname(tmp_archive_path))
    except FileExistsError:
        pass

    archive_cmd = "\n".join([
        f"cd {path} && \\",
        f"tar -zcf {tmp_archive_path} {run.job_dir}"])

    proc = await create_subprocess_shell(
            archive_cmd,
            stdout = subprocess.PIPE,
            stderr = subprocess.PIPE)

    stdout, stderr = await proc.communicate()
    log = Logs.new((run, "archive", log_now(
            stdout = f"Running command: \n{archive_cmd}\n" +
                stdout.decode("utf-8"),
            stderr = stderr.decode("utf-8"))))

    if proc.returncode is None:
        raise RuntimeError("Return code for checkout process says the job is still running.")
    elif proc.returncode == 0:
        return proc.returncode, log, tmp_archive_path
    else:
        return proc.returncode, log, None



