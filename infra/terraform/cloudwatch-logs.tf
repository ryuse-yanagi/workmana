# ==========================================
# Amazon CloudWatch Logs
# ==========================================

resource "aws_cloudwatch_log_group" "ecs_backend" {
  name = "/ecs/work-manager-backend-task"

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_cloudwatch_log_group" "ecs_frontend" {
  name = "/ecs/work-manager-frontend-task"

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_cloudwatch_log_group" "rds_postgresql" {
  name = "/aws/rds/instance/work-manager-db/postgresql"

  lifecycle {
    prevent_destroy = true
  }
}
