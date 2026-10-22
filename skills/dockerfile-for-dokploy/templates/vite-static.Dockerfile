# syntax=docker/dockerfile:1
# Vite / React / Vue / Svelte single-page app served by nginx. Needs package-lock.json.
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY . .
# Public build-time variables (VITE_*) arrive as Dokploy build args. Declare each one.
ARG VITE_API_URL
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.30-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
# nginx-unprivileged runs as a non-root user and listens on 8080.
EXPOSE 8080
