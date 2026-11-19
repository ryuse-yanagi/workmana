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

# ==========================================
# ACM Certificate Validation
# ==========================================

resource "aws_acm_certificate_validation" "workmanager" {
  certificate_arn = aws_acm_certificate.workmanager.arn

  validation_record_fqdns = [
    aws_route53_record.acm_validation.fqdn
  ]
}