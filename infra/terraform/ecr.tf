# ==========================================
# Amazon ECR
# ==========================================

# Backend Repository
resource "aws_ecr_repository" "backend" {
  name                 = "work-manager-backend"
  image_tag_mutability = "IMMUTABLE"
  force_delete         = false

  image_scanning_configuration {
    scan_on_push = false
  }

  encryption_configuration {
    encryption_type = "AES256"
  }
}

# Frontend Repository
resource "aws_ecr_repository" "frontend" {
  name                 = "work-manager-frontend"
  image_tag_mutability = "IMMUTABLE"
  force_delete         = false

  image_scanning_configuration {
    scan_on_push = false
  }

  encryption_configuration {
    encryption_type = "AES256"
  }
}
