import os

def getenv_checked(env_name: str) -> str:
    env = os.getenv(env_name)
    if env is None:
        raise ValueError(f"Environment variable {env_name} must be defined.")
    else:
        return env

ALLOWED_CORS = getenv_checked("ALLOWED_CORS").split()
COLONY_COUNT = int(getenv_checked("COLONY_COUNT"))
OPENMOLE_HOST = getenv_checked("OPENMOLE_HOST")
OPENMOLE_SEND_JOB_TIMEOUT = int(getenv_checked("OPENMOLE_SEND_JOB_TIMEOUT"))
OPENMOLE_PORT = getenv_checked("OPENMOLE_PORT")
OPENMOLE_STATE_PULL_DELAY = int(getenv_checked("OPENMOLE_STATE_PULL_DELAY"))
OPENMOLE_PASSWORD = getenv_checked("OPENMOLE_PASSWORD")
DB_HOST = getenv_checked("DB_HOST")
DB_PORT = getenv_checked("DB_PORT")
DB_USER = getenv_checked("DB_USER")
DB_PASSWORD = getenv_checked("DB_PASSWORD")
REPOSITORY_PATH = getenv_checked("JOB_REPO_LOCAL")
TMP_DIR = getenv_checked("TMP_DIR")
