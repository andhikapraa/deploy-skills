# syntax=docker/dockerfile:1
# Node server (Express, Fastify, NestJS, Hono on Node). Needs package-lock.json.
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY . .
# Runs the build script if there is one (TypeScript, bundlers), then drops dev dependencies.
RUN npm run build --if-present && npm prune --omit=dev

FROM node:24-alpine
# tini forwards stop signals; node as PID 1 ignores SIGTERM and gets killed after 10 s.
RUN apk add --no-cache tini
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app ./
USER node
# The app must listen on 0.0.0.0 and this port (or read PORT).
EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
# Use the file `npm start` runs, not `npm start` itself.
CMD ["node", "server.js"]
