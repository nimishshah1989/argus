FROM node:24-alpine

# Chromium makes the report PDFs (CHROMIUM_PATH); the Noto fonts shape Gujarati and Devanagari, and
# font-noto the Latin text. Package names checked against Alpine 3.22 and 3.23, aarch64 (13 Nov 2026).
RUN apk add --no-cache chromium font-noto font-noto-gujarati font-noto-devanagari \
  && test -x /usr/bin/chromium \
  && fc-list :lang=gu family | grep -q . \
  && fc-list :lang=hi family | grep -q .

RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile && pnpm build:server

# The server runs as the image's own non-root user. It writes nowhere but /tmp (Chromium's scratch folder
# per PDF, tsx's cache) and its HOME. Chromium keeps its sandbox off (--no-sandbox in pdf.ts) because the
# Docker default seccomp profile blocks the user namespaces the sandbox needs; see docs/decisions/D25.
ENV NODE_ENV=production PORT=3001 CHROMIUM_PATH=/usr/bin/chromium
USER node
EXPOSE 3001
CMD ["node", "apps/server/dist/server.mjs"]
