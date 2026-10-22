# syntax=docker/dockerfile:1
# Next.js with output: "standalone" in next.config. Needs package-lock.json.
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Public build-time variables (NEXT_PUBLIC_*) arrive as Dokploy build args. Declare each one.
ARG NEXT_PUBLIC_API_URL
RUN npm run build

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3000
CMD ["node", "server.js"]
