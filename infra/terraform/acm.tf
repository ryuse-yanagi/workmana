# ==========================================
# AWS Certificate Manager (ACM)
# ==========================================

resource "aws_acm_certificate" "workmanager" {
  domain_name       = "workmanager.jp"
  validation_method = "DNS"

  options {
    certificate_transparency_logging_preference = "ENABLED"
  }

  lifecycle {
    prevent_destroy = true
  }
}
