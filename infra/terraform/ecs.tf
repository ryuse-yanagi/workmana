# ============================================================
# ECS Cluster
# ============================================================

resource "aws_ecs_cluster" "work_manager" {
  name = "work-manager-cluster"

  setting {
    name  = "containerInsights"
    value = "disabled"
  }

  configuration {
    execute_command_configuration {
      logging = "DEFAULT"
    }
  }
}

# ============================================================
# ECS Cluster Capacity Providers
# ============================================================

resource "aws_ecs_cluster_capacity_providers" "work_manager" {
  cluster_name = aws_ecs_cluster.work_manager.name

  capacity_providers = [
    "FARGATE",
    "FARGATE_SPOT"
  ]
}

# ============================================================
# ECS Backend Service
# ============================================================

resource "aws_ecs_service" "backend" {
  name            = "work-manager-backend-service"
  cluster         = aws_ecs_cluster.work_manager.id
  task_definition = aws_ecs_task_definition.backend.arn

  desired_count = 1

  capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight            = 1
    base              = 0
  }

  platform_version                   = "1.4.0"
  scheduling_strategy                = "REPLICA"
  health_check_grace_period_seconds  = 0
  deployment_maximum_percent         = 200
  deployment_minimum_healthy_percent = 100
  enable_ecs_managed_tags            = true
  propagate_tags                     = "NONE"
  enable_execute_command             = true
  availability_zone_rebalancing      = "ENABLED"

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  deployment_controller {
    type = "ECS"
  }

  network_configuration {
    subnets = [
      aws_subnet.public_1a.id,
      aws_subnet.public_1c.id
    ]

    security_groups = [
      aws_security_group.ecs.id
    ]

    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.backend.arn
    container_name   = "work-manager-backend"
    container_port   = 80
  }

  depends_on = [
    aws_db_instance.work_manager,
    aws_secretsmanager_secret_version.db_password,
    aws_iam_role_policy.execution_secrets_manager,
    aws_iam_role_policy.execution_cognito_secret,
    aws_iam_role_policy.execution_reverb_secret,
    aws_iam_role_policy_attachment.ecs_task_execution_managed
  ]
}

# ============================================================
# ECS Frontend Service
# ============================================================

resource "aws_ecs_service" "frontend" {
  name            = "work-manager-frontend-service"
  cluster         = aws_ecs_cluster.work_manager.id
  task_definition = aws_ecs_task_definition.frontend.arn

  desired_count = 1

  capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight            = 1
    base              = 0
  }

  platform_version                   = "1.4.0"
  scheduling_strategy                = "REPLICA"
  health_check_grace_period_seconds  = 0
  deployment_maximum_percent         = 200
  deployment_minimum_healthy_percent = 100
  enable_ecs_managed_tags            = true
  propagate_tags                     = "NONE"
  enable_execute_command             = false
  availability_zone_rebalancing      = "ENABLED"

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  deployment_controller {
    type = "ECS"
  }

  network_configuration {
    subnets = [
      aws_subnet.public_1a.id,
      aws_subnet.public_1c.id
    ]

    security_groups = [
      aws_security_group.ecs.id
    ]

    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.frontend.arn
    container_name   = "work-manager-frontend"
    container_port   = 3000
  }
}