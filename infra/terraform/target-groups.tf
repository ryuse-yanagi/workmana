resource "aws_lb_target_group" "backend" {
  name             = "work-manager-backend-tg"
  target_type      = "ip"
  protocol         = "HTTP"
  port             = 80
  protocol_version = "HTTP1"
  vpc_id           = aws_vpc.work_manager.id

  deregistration_delay = "300"

  load_balancing_algorithm_type = "round_robin"

  slow_start = 0

  health_check {
    enabled             = true
    protocol            = "HTTP"
    port                = "traffic-port"
    path                = "/api/health"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 5
    unhealthy_threshold = 2
    matcher             = "200"
  }

  stickiness {
    enabled         = false
    type            = "lb_cookie"
    cookie_duration = 86400
  }
}

resource "aws_lb_target_group" "frontend" {
  name             = "work-manager-frontend-tg"
  target_type      = "ip"
  protocol         = "HTTP"
  port             = 80
  protocol_version = "HTTP1"
  vpc_id           = aws_vpc.work_manager.id

  deregistration_delay = "300"

  load_balancing_algorithm_type = "round_robin"

  slow_start = 0

  health_check {
    enabled             = true
    protocol            = "HTTP"
    port                = "traffic-port"
    path                = "/health"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 5
    unhealthy_threshold = 2
    matcher             = "200"
  }

  stickiness {
    enabled         = false
    type            = "lb_cookie"
    cookie_duration = 86400
  }
}
