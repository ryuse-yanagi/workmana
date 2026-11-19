# ==========================================
# AWS Region
# ==========================================

variable "aws_region" {
  description = "AWS region for WorkMana infrastructure"
  type        = string
  default     = "ap-northeast-1"
}

# ==========================================
# RDS Snapshot
# ==========================================

variable "rds_snapshot_identifier" {
  description = "RDS DB snapshot identifier used when initially restoring the WorkMana database"
  type        = string
  default     = "work-manager-db-before-deletion-20261119"
}

# ==========================================
# RDS Master Password
# ==========================================

variable "rds_master_password" {
  description = "Master password for the restored WorkMana PostgreSQL database"
  type        = string
  sensitive   = true
  ephemeral   = true
}

variable "rds_master_password_version" {
  description = "Version number used to trigger RDS and Secrets Manager password updates"
  type        = number
  default     = 1
}