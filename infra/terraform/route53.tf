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
    name                   = "dualstack.work-manager-alb-1691131399.ap-northeast-1.elb.amazonaws.com."
    zone_id                = "Z14GRHDCWA56QT"
    evaluate_target_health = true
  }
}

# ACM Domain Validation CNAME

resource "aws_route53_record" "acm_validation" {
  zone_id = aws_route53_zone.workmanager.zone_id
  name    = "_a773afb810146f59ace3215b6a9c6fec.workmanager.jp"
  type    = "CNAME"
  ttl     = 300

  records = [
    "_95d6f89d703283d19620fab775d6ce54.jkddzztszm.acm-validations.aws."
  ]
}

# SES DKIM CNAME 1

resource "aws_route53_record" "ses_dkim_1" {
  zone_id = aws_route53_zone.workmanager.zone_id
  name    = "e4lci675ypzvdpx7aw6p2al44cmfzlau._domainkey.workmanager.jp"
  type    = "CNAME"
  ttl     = 1800

  records = [
    "e4lci675ypzvdpx7aw6p2al44cmfzlau.dkim.amazonses.com"
  ]
}

# SES DKIM CNAME 2

resource "aws_route53_record" "ses_dkim_2" {
  zone_id = aws_route53_zone.workmanager.zone_id
  name    = "mqe44dsse6ti7g4b5rtdgq265d5whvio._domainkey.workmanager.jp"
  type    = "CNAME"
  ttl     = 1800

  records = [
    "mqe44dsse6ti7g4b5rtdgq265d5whvio.dkim.amazonses.com"
  ]
}

# SES DKIM CNAME 3

resource "aws_route53_record" "ses_dkim_3" {
  zone_id = aws_route53_zone.workmanager.zone_id
  name    = "vxow7rrwvem7tf6ejkz6xtidouaoyc23._domainkey.workmanager.jp"
  type    = "CNAME"
  ttl     = 1800

  records = [
    "vxow7rrwvem7tf6ejkz6xtidouaoyc23.dkim.amazonses.com"
  ]
}
