# ==========================================
# S3 Bucket
# ==========================================

resource "aws_s3_bucket" "work_manager_assets" {
  bucket = "work-manager-assets"

  lifecycle {
    prevent_destroy = true
  }
}

# ==========================================
# S3 Bucket Versioning
# ==========================================

resource "aws_s3_bucket_versioning" "work_manager_assets" {
  bucket = aws_s3_bucket.work_manager_assets.id

  versioning_configuration {
    status = "Enabled"
  }
}

# ==========================================
# S3 Server-Side Encryption
# ==========================================

resource "aws_s3_bucket_server_side_encryption_configuration" "work_manager_assets" {
  bucket = aws_s3_bucket.work_manager_assets.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# ==========================================
# S3 Public Access Block
# ==========================================

resource "aws_s3_bucket_public_access_block" "work_manager_assets" {
  bucket = aws_s3_bucket.work_manager_assets.id

  block_public_acls       = true
  ignore_public_acls      = true
  block_public_policy     = false
  restrict_public_buckets = false
}

# ==========================================
# S3 Bucket Policy
# ==========================================

resource "aws_s3_bucket_policy" "work_manager_assets" {
  bucket = aws_s3_bucket.work_manager_assets.id

  policy = jsonencode({
    Version = "2012-10-17"

    Statement = [
      {
        Sid    = "PublicReadOrganizationIconsAndAvatars"
        Effect = "Allow"

        Principal = "*"

        Action = "s3:GetObject"

        Resource = [
          "arn:aws:s3:::work-manager-assets/org-icons/*",
          "arn:aws:s3:::work-manager-assets/avatars/*"
        ]
      }
    ]
  })
}

# ==========================================
# S3 Object Ownership
# ==========================================

resource "aws_s3_bucket_ownership_controls" "work_manager_assets" {
  bucket = aws_s3_bucket.work_manager_assets.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}
