# Alarms and logs. The billing alarm is the account's existing budget `argus-monthly-cost`
# (USD 150); Terraform must not create another one.

provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

resource "aws_cloudwatch_log_group" "server" {
  name              = "/${var.app}/staging/server"
  retention_in_days = 30
}

resource "aws_cloudwatch_log_metric_filter" "server_errors" {
  name           = "${var.app}-server-errors"
  log_group_name = aws_cloudwatch_log_group.server.name
  pattern        = "{ $.level >= 50 }"
  metric_transformation {
    name      = "ServerErrors"
    namespace = "Uptimo"
    value     = "1"
  }
}

resource "aws_sns_topic" "alerts" {
  name = "${var.app}-alerts"
}

resource "aws_sns_topic_subscription" "alerts_email" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.billing_email
}

resource "aws_cloudwatch_metric_alarm" "server_errors" {
  alarm_name          = "${var.app}-server-errors"
  namespace           = "Uptimo"
  metric_name         = "ServerErrors"
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  threshold           = var.error_alarm_threshold
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
}

# One failed job or one late timer is enough (ticket 78a): the server writes a level-50 line carrying `alarm`
# ("job-failed" or "timer-late"), and a one-minute period raises this within the five minutes the plan allows.
resource "aws_cloudwatch_log_metric_filter" "job_alarms" {
  name           = "${var.app}-job-alarms"
  log_group_name = aws_cloudwatch_log_group.server.name
  pattern        = "{ $.alarm = \"job-failed\" || $.alarm = \"timer-late\" }"
  metric_transformation {
    name      = "JobAlarms"
    namespace = "Uptimo"
    value     = "1"
  }
}

resource "aws_cloudwatch_metric_alarm" "job_alarms" {
  alarm_name          = "${var.app}-job-alarms"
  namespace           = "Uptimo"
  metric_name         = "JobAlarms"
  statistic           = "Sum"
  period              = 60
  evaluation_periods  = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  threshold           = 1
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
}

# Route 53 health checks publish their metric only in us-east-1, so the alarm and its topic live there.
resource "aws_route53_health_check" "site" {
  count             = var.external_uptime_ping ? 1 : 0
  type              = var.enable_https ? "HTTPS" : "HTTP"
  port              = var.enable_https ? 443 : 80
  fqdn              = local.site_host
  ip_address        = aws_eip.server.public_ip
  resource_path     = "/api/v1/health"
  enable_sni        = var.enable_https
  failure_threshold = 3
  request_interval  = 30
  tags              = { Name = "${var.app}-site" }
}

resource "aws_sns_topic" "uptime" {
  count    = var.external_uptime_ping ? 1 : 0
  provider = aws.us_east_1
  name     = "${var.app}-uptime"
}

resource "aws_sns_topic_subscription" "uptime_email" {
  count     = var.external_uptime_ping ? 1 : 0
  provider  = aws.us_east_1
  topic_arn = aws_sns_topic.uptime[0].arn
  protocol  = "email"
  endpoint  = var.billing_email
}

resource "aws_cloudwatch_metric_alarm" "uptime" {
  count               = var.external_uptime_ping ? 1 : 0
  provider            = aws.us_east_1
  alarm_name          = "${var.app}-uptime"
  namespace           = "AWS/Route53"
  metric_name         = "HealthCheckStatus"
  dimensions          = { HealthCheckId = aws_route53_health_check.site[0].id }
  statistic           = "Minimum"
  period              = 60
  evaluation_periods  = 2
  comparison_operator = "LessThanThreshold"
  threshold           = 1
  alarm_actions       = [aws_sns_topic.uptime[0].arn]
}
