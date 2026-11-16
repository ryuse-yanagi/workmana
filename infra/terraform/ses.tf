# ========================================
# Amazon SES
# ========================================

# SES Domain Identity
resource "aws_sesv2_email_identity" "workmanager" {
  email_identity = "workmanager.jp"

  lifecycle {
    prevent_destroy = true
  }
}

# SES Feedback Attributes
resource "aws_sesv2_email_identity_feedback_attributes" "workmanager" {
  email_identity           = aws_sesv2_email_identity.workmanager.email_identity
  email_forwarding_enabled = true
}
