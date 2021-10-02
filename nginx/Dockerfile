# FROM node:16-alpine AS build

# RUN npm install -g react-scripts
# RUN npm install -g react
# COPY frontend/ /usr/local/src/frontend
# WORKDIR /usr/local/src/frontend
# RUN npm run build
# 
FROM nginx:1.20-alpine

COPY frontend/build /usr/share/nginx/html

ARG NGINX_CONF
COPY $NGINX_CONF /etc/nginx/templates/default.conf.template
