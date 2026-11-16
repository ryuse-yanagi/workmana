resource "aws_lb" "work_manager" {
  name               = "work-manager-alb"
  internal           = false
  load_balancer_type = "application"
  ip_address_type    = "ipv4"

  security_groups = [
    aws_security_group.alb.id
  ]

  subnets = [
    aws_subnet.public_1a.id,
    aws_subnet.public_1c.id
  ]

  enable_deletion_protection = false
  enable_http2               = true
  idle_timeout               = 60

  enable_cross_zone_load_balancing = true

  desync_mitigation_mode = "defensive"

  xff_header_processing_mode = "append"
  enable_xff_client_port     = false
  preserve_host_header       = false
  drop_invalid_header_fields = false

  enable_waf_fail_open = false

  enable_tls_version_and_cipher_suite_headers = false

  client_keep_alive = 3600
}
