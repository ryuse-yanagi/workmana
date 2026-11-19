# ==========================================
# HTTPS Listener
# ==========================================

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.work_manager.arn
  port              = 443
  protocol          = "HTTPS"

  ssl_policy = "ELBSecurityPolicy-TLS13-1-2-Res-PQ-2025-09"

  certificate_arn = aws_acm_certificate_validation.workmanager.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.frontend.arn
  }
}

# ==========================================
# HTTP Listener
# ==========================================

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.work_manager.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      protocol    = "HTTPS"
      port        = "443"
      host        = "#{host}"
      path        = "/#{path}"
      query       = "#{query}"
      status_code = "HTTP_301"
    }
  }
}