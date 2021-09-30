FROM nginx:1.20-alpine

ARG FRONTEND_BUILD_ROOT
COPY $FRONTEND_BUILD_ROOT /usr/share/nginx/html

ARG NGINX_CONF
COPY $NGINX_CONF /etc/nginx/templates/default.conf.template
