# ==========================================
# RDS DB Subnet Group
# ==========================================

resource "aws_db_subnet_group" "work_manager" {
  name        = "work-manager-db-subnet-group"
  description = "Subnet group for work-manager RDS PostgreSQL"

  subnet_ids = [
    "subnet-0bded6f12c061371d",
    "subnet-074d6a4e826eba47d"
  ]
}

# ==========================================
# RDS DB Instance
# ==========================================

resource "aws_db_instance" "work_manager" {
  identifier     = "work-manager-db"
  engine         = "postgres"
  engine_version = "17.10"
  instance_class = "db.t4g.micro"

  allocated_storage     = 20
  max_allocated_storage = 1000
  storage_type          = "gp3"
  iops                  = 3000
  storage_throughput    = 125

  storage_encrypted = true
  kms_key_id        = "arn:aws:kms:ap-northeast-1:381904000617:key/d235ee48-9fc0-439b-97fc-b3694c7811c6"

  username = "postgres"

  port = 5432

  db_subnet_group_name   = aws_db_subnet_group.work_manager.name
  vpc_security_group_ids = ["sg-05248f7249ced9747"]

  availability_zone   = "ap-northeast-1a"
  multi_az            = false
  publicly_accessible = false

  iam_database_authentication_enabled = false

  backup_retention_period = 1
  backup_window           = "18:22-18:52"
  maintenance_window      = "sun:17:52-sun:18:22"

  deletion_protection = false

  performance_insights_enabled          = true
  performance_insights_retention_period = 7

  monitoring_interval = 0

  enabled_cloudwatch_logs_exports = ["postgresql"]

  auto_minor_version_upgrade = true
  copy_tags_to_snapshot      = true

  parameter_group_name = "default.postgres17"
  option_group_name    = "default:postgres-17"
  ca_cert_identifier   = "rds-ca-rsa2048-g1"

  skip_final_snapshot = true

  lifecycle {
    prevent_destroy = true
  }
}
