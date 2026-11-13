# Weekly logical dump of the database (ticket 14). The RDS point-in-time window is `backup_retention_period` in
# main.tf. A dump is the second copy: it restores into any Postgres 16, not only a new RDS instance.
# A separate bucket from the files bucket: the server may add and read back dumps here, and list the dumps/ folder
# (the restore drill needs that), but never delete one or touch anything else.

resource "aws_s3_bucket" "backups" {
  bucket = "${var.app}-${random_id.suffix.hex}-backups"
  tags   = { Name = "${var.app}-backups" }
}

resource "aws_s3_bucket_versioning" "backups" {
  bucket = aws_s3_bucket.backups.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id
  rule {
    apply_server_side_encryption_by_default { sse_algorithm = "AES256" }
  }
}

resource "aws_s3_bucket_public_access_block" "backups" {
  bucket                  = aws_s3_bucket.backups.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Nothing may reach the bucket over plain HTTP.
resource "aws_s3_bucket_policy" "backups" {
  bucket = aws_s3_bucket.backups.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "DenyPlainHttp"
      Effect    = "Deny"
      Principal = "*"
      Action    = "s3:*"
      Resource  = [aws_s3_bucket.backups.arn, "${aws_s3_bucket.backups.arn}/*"]
      Condition = { Bool = { "aws:SecureTransport" = "false" } }
    }]
  })
}

# Keep 13 weeks of dumps. A replaced or deleted version is kept 30 more days.
resource "aws_s3_bucket_lifecycle_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id
  rule {
    id     = "expire-old-dumps"
    status = "Enabled"
    filter { prefix = "dumps/" }
    expiration { days = 91 }
    noncurrent_version_expiration { noncurrent_days = 30 }
  }
}

# The instance (its role) writes a dump, reads it back to check it, and lists dumps/ for the restore drill. No delete.
resource "aws_iam_role_policy" "server_backup" {
  role = aws_iam_role.server.id
  name = "${var.app}-server-backup"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["s3:PutObject", "s3:GetObject"], Resource = "${aws_s3_bucket.backups.arn}/dumps/*" },
      {
        Effect    = "Allow"
        Action    = ["s3:ListBucket"]
        Resource  = aws_s3_bucket.backups.arn
        Condition = { StringLike = { "s3:prefix" = ["dumps/*"] } }
      },
    ]
  })
}

output "backup_bucket" { value = aws_s3_bucket.backups.id }
