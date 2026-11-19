# ==========================================
# AWS Secrets Manager
# ==========================================

resource "aws_secretsmanager_secret" "app_key" {
  name                           = "work-manager/backend/app-key"
  force_overwrite_replica_secret = false
  recovery_window_in_days        = 30

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      force_overwrite_replica_secret,
      recovery_window_in_days
    ]
  }
}

resource "aws_secretsmanager_secret" "db_password" {
  name                           = "work-manager/backend/db-password"
  force_overwrite_replica_secret = false
  recovery_window_in_days        = 30

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      force_overwrite_replica_secret,
      recovery_window_in_days
    ]
  }
}

# ==========================================
# DB Password Secret Version
# ==========================================

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id = aws_secretsmanager_secret.db_password.id

  secret_string_wo         = var.rds_master_password
  secret_string_wo_version = var.rds_master_password_version
}

resource "aws_secretsmanager_secret" "cognito_client_secret" {
  name                           = "work-manager/backend/cognito-client-secret"
  force_overwrite_replica_secret = false
  recovery_window_in_days        = 30

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      force_overwrite_replica_secret,
      recovery_window_in_days
    ]
  }
}

resource "aws_secretsmanager_secret" "reverb_app_secret" {
  name                           = "work-manager/backend/reverb-app-secret"
  force_overwrite_replica_secret = false
  recovery_window_in_days        = 30

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      force_overwrite_replica_secret,
      recovery_window_in_days
    ]
  }
}