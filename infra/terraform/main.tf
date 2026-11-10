terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
  # State goes to S3 once the account exists (use_lockfile avoids a DynamoDB table):
  # backend "s3" {
  #   bucket         = "uptimo-tfstate-118167167649"
  #   key            = "terraform.tfstate"
  #   region         = "ap-south-1"
  #   encrypt        = true
  #   use_lockfile   = true
  # }
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
  type = string
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
  default = "uptimo"
}

variable "billing_email" {
  type    = string
  default = ""
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
  subnet_ids = [aws_subnet.private.id]
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

resource "aws_iam_role_policy" "server" {
  role = aws_iam_role.server.id
  name = "${var.app}-server"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["ssm:GetParameter", "ssm:GetParametersByPath"], Resource = "*" },
      { Effect = "Allow", Action = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"], Resource = "${aws_s3_bucket.files.arn}/*" },
      { Effect = "Allow", Action = ["s3:ListBucket"], Resource = aws_s3_bucket.files.arn },
      { Effect = "Allow", Action = ["secretsmanager:GetSecretValue"], Resource = "*" },
    ]
  })
}

resource "aws_iam_instance_profile" "server" {
  name = "${var.app}-server"
  role = aws_iam_role.server.name
}

resource "aws_instance" "server" {
  ami                    = data.aws_ami.amazon_linux_2023.id
  instance_type          = var.instance_type
  subnet_id              = aws_subnet.public.id
  vpc_security_group_ids = [aws_security_group.ec2.id]
  iam_instance_profile   = aws_iam_instance_profile.server.name
  user_data              = <<-EOT
    #!/bin/bash
    set -e
    dnf install -y docker
    systemctl enable --now docker
    mkdir -p /opt/uptimo
    usermod -aG docker ec2-user
  EOT
  tags                   = { Name = "${var.app}-server" }
}

resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}

resource "aws_iam_role" "deploy" {
  name = "${var.app}-deploy"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = aws_iam_openid_connect_provider.github.arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:sub" = "repo:${var.github_org}/${var.github_repo}:*"
        }
      }
    }]
  })
}

resource "aws_iam_role_policy" "deploy" {
  role = aws_iam_role.deploy.id
  name = "${var.app}-deploy"
  # Broad for M0; narrow to the exact services before production.
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["ec2:*", "rds:*", "s3:*", "secretsmanager:*", "ssm:*", "iam:*", "budgets:*", "cloudwatch:*"]
      Resource = "*"
    }]
  })
}

resource "aws_secretsmanager_secret" "app" {
  name = "${var.app}/prod"
}

resource "aws_budgets_budget" "monthly" {
  name              = "${var.app}-monthly"
  budget_type       = "COST"
  limit_amount      = "30000"
  limit_unit        = "INR"
  time_unit         = "MONTHLY"
  time_period_start = "2026-01-01_00:00"
  time_period_end   = "2036-01-01_00:00"
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = var.billing_email == "" ? [] : [var.billing_email]
  }
}

output "db_endpoint" { value = aws_db_instance.postgres.endpoint }
output "files_bucket" { value = aws_s3_bucket.files.id }
output "server_public_ip" { value = aws_instance.server.public_ip }
output "deploy_role_arn" { value = aws_iam_role.deploy.arn }
