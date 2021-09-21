FROM debian:buster

RUN apt-get update
RUN apt-get install --yes git
RUN apt-get install python3-dev
RUN apt-get install libpq-dev

ARG LOCAL_SRC
COPY ./requirements.txt $LOCAL_SRC/backend/requirements.txt
COPY ./src $LOCAL_SRC/backend/src

RUN apt-get install --yes python3 python3-venv

RUN python3 -m venv venv-backend

RUN venv-backend/bin/pip install -r $LOCAL_SRC/backend/requirements.txt

ENV PYTHONPATH=$LOCAL_SRC/backend
ENV LOCAL_SRC=$LOCAL_SRC

CMD venv-backend/bin/python3 $LOCAL_SRC/backend/src/run-backend.py
