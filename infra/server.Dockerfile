FROM node:24-alpine

RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile && pnpm build:server

ENV NODE_ENV=production PORT=3001
EXPOSE 3001
CMD ["node", "apps/server/dist/server.mjs"]
