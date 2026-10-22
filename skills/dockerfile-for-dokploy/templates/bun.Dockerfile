# syntax=docker/dockerfile:1
# Bun server (Hono, Elysia, Bun.serve). Needs bun.lock.
FROM oven/bun:1.4-alpine AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile --production

FROM oven/bun:1.4-alpine
# tini forwards stop signals; bun as PID 1 ignores SIGTERM and gets killed after 10 s.
RUN apk add --no-cache tini
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps --chown=bun:bun /app/node_modules ./node_modules
COPY --chown=bun:bun . .
USER bun
# The app must listen on 0.0.0.0 and this port (or read PORT).
EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["bun", "run", "src/index.ts"]
