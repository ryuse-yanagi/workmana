# ==========================================
# Amazon Route 53
# ==========================================

# Hosted Zone

resource "aws_route53_zone" "workmanager" {
  name          = "workmanager.jp"
  comment       = ""
  force_destroy = false

  lifecycle {
    prevent_destroy = true
  }
}

# ==========================================
# DNS Records
# ==========================================

# Root Domain A Record -> ALB

resource "aws_route53_record" "root_a" {
  zone_id = aws_route53_zone.workmanager.zone_id
  name    = "workmanager.jp"
  type    = "A"

  alias {
    name                   = aws_lb.work_manager.dns_name
    zone_id                = aws_lb.work_manager.zone_id
    evaluate_target_health = true
  }
}

# ==========================================
# ACM Domain Validation CNAME
# ==========================================

resource "aws_route53_record" "acm_validation" {
  zone_id = aws_route53_zone.workmanager.zone_id

  name = one(
    aws_acm_certificate.workmanager.domain_validation_options
  ).resource_record_name

  type = one(
    aws_acm_certificate.workmanager.domain_validation_options
  ).resource_record_type

  ttl = 300

  records = [
    one(
      aws_acm_certificate.workmanager.domain_validation_options
    ).resource_record_value
  ]
}

# ==========================================
# SES DKIM CNAME 1
# ==========================================

resource "aws_route53_record" "ses_dkim_1" {
  zone_id = aws_route53_zone.workmanager.zone_id
  name    = "e4lci675ypzvdpx7aw6p2al44cmfzlau._domainkey.workmanager.jp"
  type    = "CNAME"
  ttl     = 1800

  records = [
    "e4lci675ypzvdpx7aw6p2al44cmfzlau.dkim.amazonses.com"
  ]
}

# ==========================================
# SES DKIM CNAME 2
# ==========================================

resource "aws_route53_record" "ses_dkim_2" {
  zone_id = aws_route53_zone.workmanager.zone_id
  name    = "mqe44dsse6ti7g4b5rtdgq265d5whvio._domainkey.workmanager.jp"
  type    = "CNAME"
  ttl     = 1800

  records = [
    "mqe44dsse6ti7g4b5rtdgq265d5whvio.dkim.amazonses.com"
  ]
}

# ==========================================
# SES DKIM CNAME 3
# ==========================================

resource "aws_route53_record" "ses_dkim_3" {
  zone_id = aws_route53_zone.workmanager.zone_id
  name    = "vxow7rrwvem7tf6ejkz6xtidouaoyc23._domainkey.workmanager.jp"
  type    = "CNAME"
  ttl     = 1800

  records = [
    "vxow7rrwvem7tf6ejkz6xtidouaoyc23.dkim.amazonses.com"
  ]
}