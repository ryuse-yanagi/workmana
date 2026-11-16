# ==========================================
# Amazon CloudWatch Logs
# ==========================================

resource "aws_cloudwatch_log_group" "ecs_backend" {
  name              = "/ecs/work-manager-backend-task"
  retention_in_days = 30

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_cloudwatch_log_group" "ecs_frontend" {
  name              = "/ecs/work-manager-frontend-task"
  retention_in_days = 30

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_cloudwatch_log_group" "rds_postgresql" {
  name              = "/aws/rds/instance/work-manager-db/postgresql"
  retention_in_days = 30

  lifecycle {
    prevent_destroy = true
  }
}