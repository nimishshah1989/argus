# First boot

Nothing to do by hand. On first boot the instance's `user_data` installs Docker, `jq` and the Compose plugin,
and writes `/opt/uptimo/.env` (registry, site address, ACME email, log group, secret name; no secrets). The
deploy workflow then ships `docker-compose.yml` and `instance/` and runs `instance/deploy.sh` over SSM.

Inspect it (no public SSH):

```bash
aws ssm start-session --target <instance-id>
cat /var/log/cloud-init-output.log
ls -l /opt/uptimo
```

Steps to bring staging up: `STAGING.md`.
