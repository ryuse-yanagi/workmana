# ============================================================
# ECS Backend Task Definition
# ============================================================

resource "aws_ecs_task_definition" "backend" {
  skip_destroy             = true
  family                   = "work-manager-backend-task"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "512"
  memory                   = "1024"

  execution_role_arn = aws_iam_role.ecs_task_execution.arn
  task_role_arn      = aws_iam_role.backend_task.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }

  container_definitions = jsonencode([
    {
      name      = "work-manager-backend"
      image     = "381904000617.dkr.ecr.ap-northeast-1.amazonaws.com/work-manager-backend:v21"
      cpu       = 0
      essential = true

      environmentFiles = []
      mountPoints      = []
      systemControls   = []
      ulimits          = []
      volumesFrom      = []

      portMappings = [
        {
          containerPort = 80
          hostPort      = 80
          protocol      = "tcp"
          name          = "work-manager-backend-80-tcp"
          appProtocol   = "http"
        },
        {
          containerPort = 8080
          hostPort      = 8080
          protocol      = "tcp"
          name          = "work-manager-backend-8080-tcp"
          appProtocol   = "http"
        }
      ]

      environment = [
        { name = "APP_ENV", value = "production" },
        { name = "REVERB_HOST", value = "workmanager.jp" },
        { name = "DB_PORT", value = "5432" },
        { name = "DB_USERNAME", value = "postgres" },
        { name = "APP_NAME", value = "Work Manager" },
        { name = "AWS_DEFAULT_REGION", value = "ap-northeast-1" },
        { name = "AWS_BUCKET", value = "work-manager-assets" },
        { name = "COGNITO_FRONTEND_URL", value = "https://workmanager.jp" },
        { name = "COGNITO_JWKS_URL", value = "https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_VjInLwG57/.well-known/jwks.json" },
        { name = "COGNITO_AUDIENCE", value = "4higbh9b840oljm7tgffrf2vvn" },
        { name = "QUEUE_CONNECTION", value = "database" },
        { name = "COGNITO_LOGOUT_REDIRECT_URI", value = "https://workmanager.jp/login" },
        { name = "DB_CONNECTION", value = "pgsql" },
        { name = "APP_URL", value = "https://workmanager.jp" },
        { name = "COGNITO_CLIENT_ID", value = "4higbh9b840oljm7tgffrf2vvn" },
        { name = "LOG_LEVEL", value = "info" },
        { name = "APP_DEBUG", value = "false" },
        { name = "CORS_ALLOWED_ORIGINS", value = "https://workmanager.jp" },
        { name = "FILESYSTEM_DISK", value = "s3" },
        { name = "REVERB_SCHEME", value = "https" },
        { name = "REVERB_APP_KEY", value = "4c1bad5bb868d521ef6e9ddcbadcfb6a" },
        { name = "COGNITO_ISSUER", value = "https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_VjInLwG57" },
        { name = "COGNITO_USER_POOL_ID", value = "ap-northeast-1_VjInLwG57" },
        { name = "DB_HOST", value = aws_db_instance.work_manager.address },
        { name = "COGNITO_DOMAIN", value = "https://ap-northeast-1vjinlwg57.auth.ap-northeast-1.amazoncognito.com" },
        { name = "COGNITO_SCOPES", value = "openid email" },
        { name = "SESSION_SECURE_COOKIE", value = "true" },
        { name = "MAIL_FROM_ADDRESS", value = "no-reply@workmanager.jp" },
        { name = "LOG_CHANNEL", value = "stderr" },
        { name = "COGNITO_REDIRECT_URI", value = "https://workmanager.jp/api/auth/callback" },
        { name = "MAIL_MAILER", value = "ses" },
        { name = "BROADCAST_CONNECTION", value = "reverb" },
        { name = "REVERB_APP_ID", value = "work-manager-prod" },
        { name = "COGNITO_BYPASS", value = "false" },
        { name = "DB_DATABASE", value = "work_manager" }
      ]

      secrets = [
        {
          name      = "APP_KEY"
          valueFrom = aws_secretsmanager_secret.app_key.arn
        },
        {
          name      = "COGNITO_CLIENT_SECRET"
          valueFrom = "${aws_secretsmanager_secret.cognito_client_secret.arn}:COGNITO_CLIENT_SECRET::"
        },
        {
          name      = "DB_PASSWORD"
          valueFrom = aws_secretsmanager_secret.db_password.arn
        },
        {
          name      = "REVERB_APP_SECRET"
          valueFrom = "${aws_secretsmanager_secret.reverb_app_secret.arn}:REVERB_APP_SECRET::"
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"

        options = {
          awslogs-group         = "/ecs/work-manager-backend-task"
          awslogs-create-group  = "true"
          awslogs-region        = "ap-northeast-1"
          awslogs-stream-prefix = "ecs"
        }

        secretOptions = []
      }
    }
  ])
}

# ============================================================
# ECS Frontend Task Definition
# ============================================================

resource "aws_ecs_task_definition" "frontend" {
  skip_destroy             = true
  family                   = "work-manager-frontend-task"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "512"
  memory                   = "1024"

  execution_role_arn = aws_iam_role.ecs_task_execution.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }

  container_definitions = jsonencode([
    {
      name      = "work-manager-frontend"
      image     = "381904000617.dkr.ecr.ap-northeast-1.amazonaws.com/work-manager-frontend:v10"
      cpu       = 0
      essential = true

      environmentFiles = []
      mountPoints      = []
      systemControls   = []
      ulimits          = []
      volumesFrom      = []

      portMappings = [
        {
          containerPort = 3000
          hostPort      = 3000
          protocol      = "tcp"
          name          = "work-manager-frontend-3000-tcp"
          appProtocol   = "http"
        }
      ]

      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "NUXT_PUBLIC_API_BASE_URL", value = "https://workmanager.jp/api" },
        { name = "NUXT_PUBLIC_REVERB_PORT", value = "443" },
        { name = "NUXT_PUBLIC_REVERB_SCHEME", value = "https" },
        { name = "NUXT_PUBLIC_REVERB_KEY", value = "4c1bad5bb868d521ef6e9ddcbadcfb6a" },
        { name = "NUXT_PUBLIC_REVERB_HOST", value = "workmanager.jp" }
      ]

      logConfiguration = {
        logDriver = "awslogs"

        options = {
          awslogs-group         = "/ecs/work-manager-frontend-task"
          awslogs-create-group  = "true"
          awslogs-region        = "ap-northeast-1"
          awslogs-stream-prefix = "ecs"
        }

        secretOptions = []
      }
    }
  ])
}