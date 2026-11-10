# First-boot bootstrap (once per environment)

Terraform creates the instance but not the compose files. Run these once over SSM
(the instance has no public SSH; use `aws ssm start-session --target <instance-id>`).

```bash
sudo dnf install -y docker
sudo systemctl enable --now docker
sudo mkdir -p /opt/uptimo
sudo chown ec2-user:ec2-user /opt/uptimo
# copy infra/docker-compose.yml and infra/Caddyfile to /opt/uptimo/
# create /opt/uptimo/.env from Secrets Manager / SSM (DATABASE_URL, SESSION_SECRET, S3_*)
sudo usermod -aG docker ec2-user
```

The deploy workflow then runs `docker compose pull && docker compose up -d server caddy` over SSM.
