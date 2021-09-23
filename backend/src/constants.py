import os

# TODO make these environments variables?
COLONY_COUNT = 19
OPENMOLE_HOST = os.getenv("OPENMOLE_HOST")
OPENMOLE_PORT = os.getenv("OPENMOLE_PORT")
REPOSITORY_PATH = os.getenv("JOB_REPO_LOCAL")
OPENMOLE_STATE_PULL_DELAY = 1 # seconds
OPENMOLE_USER = ""
OPENMOLE_PASSWORD = ""
TMP_DIR = "/tmp/ants_dispersal_strategy"
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT")
DB_USER = "postgres"
DB_PASSWORD = "pass"
