FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
# `dist` is a named build context (apps/web/dist), see .github/workflows/deploy.yml.
COPY --from=dist . /srv/web
