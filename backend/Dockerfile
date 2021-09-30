FROM tiangolo/uvicorn-gunicorn-fastapi:python3.9

# RUN apt-get update
#RUN apt-get install --yes git gcc make python3-dev libpq-dev python3 \
#    python3-venv
# RUN apt-get install python3-pip
# RUN venv-backend/bin/pip install wheel

COPY ./requirements.txt /app/requirements.txt
WORKDIR /app/
RUN python -m pip install -r requirements.txt

ARG JOB_REPO_LOCAL
ENV JOB_REPO_LOCAL=$JOB_REPO_LOCAL

COPY ./src /app/src

ARG BACKEND_PORT
ENV BACKEND_PORT=$BACKEND_PORT

ARG JOB_REPO_ORIGIN
RUN mkdir -p $JOB_REPO_LOCAL
RUN git clone $JOB_REPO_ORIGIN $JOB_REPO_LOCAL

# CMD venv-backend/bin/uvicorn src.app:app --host 0.0.0.0 --port $BACKEND_PORT

