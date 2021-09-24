FROM debian:bullseye

RUN apt-get update
RUN apt-get install --yes git gcc make python3-dev libpq-dev python3 \
    python3-venv

ARG LOCAL_SRC
COPY ./requirements.txt $LOCAL_SRC/backend/requirements.txt

RUN python3 -m venv venv-backend
RUN venv-backend/bin/pip install wheel
RUN venv-backend/bin/pip install -r $LOCAL_SRC/backend/requirements.txt

ARG JOB_REPO_LOCAL

ENV PYTHONPATH=$LOCAL_SRC/backend
ENV LOCAL_SRC=$LOCAL_SRC
ENV JOB_REPO_LOCAL=$JOB_REPO_LOCAL

COPY ./src $LOCAL_SRC/backend/src

ARG BACKEND_PORT
ENV BACKEND_PORT=$BACKEND_PORT

ARG JOB_REPO_ORIGIN
RUN mkdir -p $JOB_REPO_LOCAL
RUN git clone $JOB_REPO_ORIGIN $JOB_REPO_LOCAL

CMD venv-backend/bin/uvicorn src.app:app --host 0.0.0.0 --port $BACKEND_PORT

