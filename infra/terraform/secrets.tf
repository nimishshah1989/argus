# The only place the database passwords live besides the Terraform state; the instance reads them at deploy time.

resource "random_password" "app_api" {
  length  = 32
  special = false
}

resource "aws_secretsmanager_secret" "app" {
  name = "${var.app}/staging"
}

resource "aws_secretsmanager_secret_version" "app" {
  secret_id = aws_secretsmanager_secret.app.id
  secret_string = jsonencode({
    DATABASE_URL           = "postgresql://app_api:${random_password.app_api.result}@${aws_db_instance.postgres.endpoint}/${var.db_name}?sslmode=no-verify"
    MIGRATION_DATABASE_URL = "postgresql://${var.db_username}:${random_password.db.result}@${aws_db_instance.postgres.endpoint}/${var.db_name}?sslmode=no-verify"
    APP_API_PASSWORD       = random_password.app_api.result
  })
}
