terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = ">= 3.0"
    }
  }
  # State bucket created by the setup session. Rename to uptimo-* post-launch.
  backend "s3" {
    bucket       = "argus-tfstate-118167167649"
    key          = "terraform.tfstate"
    region       = "ap-south-1"
    encrypt      = true
    use_lockfile = true
  }
}

variable "region" {
  type    = string
  default = "ap-south-1"
}

variable "app" {
  type    = string
  default = "uptimo"
}

variable "domain" {
  type    = string
  default = ""
}

variable "db_name" {
  type    = string
  default = "uptimo"
}

variable "db_username" {
  type    = string
  default = "uptimo"
}

variable "instance_type" {
  type    = string
  default = "t4g.medium"
}

variable "github_org" {
  type    = string
  default = "nimishshah1989"
}

variable "github_repo" {
  type    = string
  default = "argus"
}

# Caddy's ACME email and both alarm subscriptions.
variable "billing_email" {
  type = string
  validation {
    condition     = var.billing_email != ""
    error_message = "billing_email is required: it receives the alarm emails."
  }
}

# false serves plain HTTP on :80 (fallback if the certificate cannot be issued).
variable "enable_https" {
  type    = bool
  default = true
}

# false skips the Route 53 health check and its us-east-1 alarm.
variable "external_uptime_ping" {
  type    = bool
  default = true
}

variable "error_alarm_threshold" {
  type    = number
  default = 5
}

variable "cidr" {
  type    = string
  default = "10.0.0.0/16"
}


provider "aws" {
  region = var.region
}

locals {
  az_a = "${var.region}a"
  az_b = "${var.region}b"
  # The cosmos. label picks the tenant (tenantSlugFromHost); sslip.io resolves the Elastic IP until a domain exists.
  site_host    = var.domain != "" ? "cosmos.staging.${var.domain}" : "cosmos.${replace(aws_eip.server.public_ip, ".", "-")}.sslip.io"
  site_address = var.enable_https ? local.site_host : ":80"
}

resource "aws_vpc" "main" {
  cidr_block           = var.cidr
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags                 = { Name = "${var.app}-vpc" }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "${var.app}-igw" }
}

resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(var.cidr, 8, 1)
  availability_zone       = local.az_a
  map_public_ip_on_launch = true
  tags                    = { Name = "${var.app}-public" }
}

resource "aws_subnet" "private" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.cidr, 8, 2)
  availability_zone = local.az_b
  tags              = { Name = "${var.app}-private" }
}

resource "aws_subnet" "private_second" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.cidr, 8, 3)
  availability_zone = local.az_a
  tags              = { Name = "${var.app}-private-second" }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }
  tags = { Name = "${var.app}-public-rt" }
}

resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}

resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.main.id
  service_name      = "com.amazonaws.${var.region}.s3"
  route_table_ids   = [aws_route_table.public.id]
  vpc_endpoint_type = "Gateway"
}

resource "aws_security_group" "ec2" {
  name        = "${var.app}-ec2"
  description = "Public web and API"
  vpc_id      = aws_vpc.main.id
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "${var.app}-ec2" }
}

resource "aws_security_group" "rds" {
  name        = "${var.app}-rds"
  description = "Postgres for the app"
  vpc_id      = aws_vpc.main.id
  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ec2.id]
  }
  tags = { Name = "${var.app}-rds" }
}

resource "random_password" "db" {
  length  = 32
  special = false
}

resource "aws_db_subnet_group" "main" {
  name       = "${var.app}-db-subnet"
  subnet_ids = [aws_subnet.private.id, aws_subnet.private_second.id]
}

resource "aws_db_instance" "postgres" {
  identifier              = "${var.app}-postgres"
  engine                  = "postgres"
  engine_version          = "16"
  instance_class          = "db.t4g.micro"
  allocated_storage       = 20
  storage_encrypted       = true
  db_name                 = var.db_name
  username                = var.db_username
  password                = random_password.db.result
  db_subnet_group_name    = aws_db_subnet_group.main.name
  vpc_security_group_ids  = [aws_security_group.rds.id]
  publicly_accessible     = false
  backup_retention_period = 7
  skip_final_snapshot     = false
  tags                    = { Name = "${var.app}-postgres" }
}

resource "aws_s3_bucket" "files" {
  bucket = "${var.app}-${random_id.suffix.hex}-files"
  tags   = { Name = "${var.app}-files" }
}

resource "random_id" "suffix" {
  byte_length = 4
}

resource "aws_s3_bucket_versioning" "files" {
  bucket = aws_s3_bucket.files.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "files" {
  bucket = aws_s3_bucket.files.id
  rule {
    apply_server_side_encryption_by_default { sse_algorithm = "AES256" }
  }
}

resource "aws_s3_bucket_public_access_block" "files" {
  bucket                  = aws_s3_bucket.files.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "voice" {
  bucket = aws_s3_bucket.files.id
  rule {
    id     = "expire-voice"
    status = "Enabled"
    filter { prefix = "voice/" }
    expiration { days = 90 }
  }
}

data "aws_ami" "amazon_linux_2023" {
  most_recent = true
  owners      = ["amazon"]
  filter {
    name   = "name"
    values = ["al2023-ami-2023.*-arm64"]
  }
}

resource "aws_iam_role" "server" {
  name = "${var.app}-server"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "server_ssm" {
  role       = aws_iam_role.server.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy" "server" {
  role = aws_iam_role.server.id
  name = "${var.app}-server"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"], Resource = "${aws_s3_bucket.files.arn}/*" },
      { Effect = "Allow", Action = ["s3:ListBucket"], Resource = aws_s3_bucket.files.arn },
      { Effect = "Allow", Action = ["secretsmanager:GetSecretValue"], Resource = aws_secretsmanager_secret.app.arn },
      { Effect = "Allow", Action = ["ecr:GetAuthorizationToken"], Resource = "*" },
      {
        Effect   = "Allow"
        Action   = ["ecr:BatchGetImage", "ecr:GetDownloadUrlForLayer", "ecr:BatchCheckLayerAvailability"]
        Resource = [aws_ecr_repository.server.arn, aws_ecr_repository.web.arn]
      },
      { Effect = "Allow", Action = ["logs:CreateLogStream", "logs:PutLogEvents", "logs:DescribeLogStreams"], Resource = "${aws_cloudwatch_log_group.server.arn}:*" },
    ]
  })
}

resource "aws_iam_instance_profile" "server" {
  name = "${var.app}-server"
  role = aws_iam_role.server.name
}

resource "aws_instance" "server" {
  ami                         = data.aws_ami.amazon_linux_2023.id
  instance_type               = var.instance_type
  subnet_id                   = aws_subnet.public.id
  vpc_security_group_ids      = [aws_security_group.ec2.id]
  iam_instance_profile        = aws_iam_instance_profile.server.name
  user_data                   = <<-EOT
    #!/bin/bash
    set -euo pipefail
    dnf install -y docker jq
    systemctl enable --now docker
    # Compose v2 CLI plugin, pinned (docker/compose releases page, 13 Nov 2026).
    mkdir -p /usr/local/lib/docker/cli-plugins
    curl -fsSL -o /usr/local/lib/docker/cli-plugins/docker-compose \
      https://github.com/docker/compose/releases/download/v5.7.1/docker-compose-linux-aarch64
    chmod 755 /usr/local/lib/docker/cli-plugins/docker-compose
    mkdir -p /opt/uptimo
    cat > /opt/uptimo/.env <<'ENV'
    ECR_REGISTRY=${split("/", aws_ecr_repository.server.repository_url)[0]}
    SITE_ADDRESS=${local.site_address}
    ACME_EMAIL=${var.billing_email}
    AWS_REGION=${var.region}
    LOG_GROUP=${aws_cloudwatch_log_group.server.name}
    SECRET_ID=${aws_secretsmanager_secret.app.name}
    ENV
    usermod -aG docker ec2-user
  EOT
  user_data_replace_on_change = true
  metadata_options {
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
  }
  tags = { Name = "${var.app}-server" }
}

resource "aws_eip" "server" {
  domain = "vpc"
  tags   = { Name = "${var.app}-eip" }
}

resource "aws_eip_association" "server" {
  instance_id   = aws_instance.server.id
  allocation_id = aws_eip.server.id
}

resource "aws_route53_zone" "main" {
  count = var.domain == "" ? 0 : 1
  name  = var.domain
}

resource "aws_route53_record" "app" {
  count   = var.domain == "" ? 0 : 1
  zone_id = aws_route53_zone.main[0].zone_id
  name    = "cosmos.${var.domain}"
  type    = "A"
  ttl     = 60
  records = [aws_eip.server.public_ip]
}

resource "aws_route53_record" "staging" {
  count   = var.domain == "" ? 0 : 1
  zone_id = aws_route53_zone.main[0].zone_id
  name    = "cosmos.staging.${var.domain}"
  type    = "A"
  ttl     = 60
  records = [aws_eip.server.public_ip]
}

# Budget lives in the account (argus-monthly-cost, USD 150); Terraform must not
# create a second one. See the setup note.

output "db_endpoint" { value = aws_db_instance.postgres.endpoint }
output "files_bucket" { value = aws_s3_bucket.files.id }
output "server_public_ip" { value = aws_eip.server.public_ip }
output "server_instance_id" { value = aws_instance.server.id }
output "site_url" { value = "${var.enable_https ? "https" : "http"}://${local.site_host}" }
output "alert_topic_arn" { value = aws_sns_topic.alerts.arn }
output "deploy_role_arn" { value = aws_iam_role.deploy.arn }
