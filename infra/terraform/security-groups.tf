# ==========================================
# Security Groups
# ==========================================

resource "aws_security_group" "alb" {
  name        = "work-manager-alb-sg"
  description = "Security group for Application Load Balancer"
  vpc_id      = aws_vpc.work_manager.id

  tags = {
    Name = "work-manager-alb-sg"
  }
}

resource "aws_security_group" "ecs" {
  name        = "work-manager-ecs-sg"
  description = "Security group for Elastic Container Service tasks"
  vpc_id      = aws_vpc.work_manager.id

  tags = {
    Name = "work-manager-ecs-sg"
  }
}

resource "aws_security_group" "rds" {
  name        = "work-manager-rds-sg"
  description = "Security group for Relational Database Service database"
  vpc_id      = aws_vpc.work_manager.id

  tags = {
    Name = "work-manager-rds-sg"
  }
}
