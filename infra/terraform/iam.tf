# ==========================================
# IAM Roles
# ==========================================

# ECS Task Execution Role
resource "aws_iam_role" "ecs_task_execution" {
  name = "ecsTaskExecutionRole"


  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
        Action = "sts:AssumeRole"
        Condition = {
          StringEquals = {
            "aws:SourceAccount" = "381904000617"
          }
          ArnLike = {
            "aws:SourceArn" = "arn:aws:ecs:ap-northeast-1:381904000617:*"
          }
        }
      }
    ]
  })

  max_session_duration = 3600
}

# Backend ECS Task Role
resource "aws_iam_role" "backend_task" {
  name        = "work-manager-backend-task-role"
  description = "IAM role for the Work Manager backend ECS task to send emails via Amazon SES."

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = ""
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  max_session_duration = 3600
}

# ==========================================
# AWS Managed Policy Attachments
# ==========================================

resource "aws_iam_role_policy_attachment" "ecs_task_execution_managed" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# ==========================================
# ECS Task Execution Role Inline Policies
# ==========================================

resource "aws_iam_role_policy" "execution_secrets_manager" {
  name = "SecretsManagerGetSecretValue"
  role = aws_iam_role.ecs_task_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = "secretsmanager:GetSecretValue"
        Resource = [
          "arn:aws:secretsmanager:ap-northeast-1:381904000617:secret:work-manager/backend/app-key-*",
          "arn:aws:secretsmanager:ap-northeast-1:381904000617:secret:work-manager/backend/db-password-*"
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy" "execution_rds_secret" {
  name = "WorkManagerRDSSecretsManagerRead"
  role = aws_iam_role.ecs_task_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "secretsmanager:GetSecretValue"
        Resource = "arn:aws:secretsmanager:ap-northeast-1:381904000617:secret:rds!db-fe6d5017-eae3-4062-80e7-8bfb35b0aee0-qxaS3h"
      }
    ]
  })
}

resource "aws_iam_role_policy" "execution_cognito_secret" {
  name = "WorkManagerSecretsManagerRead"
  role = aws_iam_role.ecs_task_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "secretsmanager:GetSecretValue"
        Resource = "arn:aws:secretsmanager:ap-northeast-1:381904000617:secret:work-manager/backend/cognito-client-secret-tt7yJh"
      }
    ]
  })
}

resource "aws_iam_role_policy" "execution_reverb_secret" {
  name = "WorkManaSecretsManagerRead"
  role = aws_iam_role.ecs_task_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "secretsmanager:GetSecretValue"
        Resource = "arn:aws:secretsmanager:ap-northeast-1:381904000617:secret:work-manager/backend/reverb-app-secret-*"
      }
    ]
  })
}

# ==========================================
# Backend ECS Task Role Inline Policies
# ==========================================

resource "aws_iam_role_policy" "backend_ecs_exec" {
  name = "AmazonECSTaskExecRolePolicy"
  role = aws_iam_role.backend_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ssmmessages:CreateControlChannel",
          "ssmmessages:CreateDataChannel",
          "ssmmessages:OpenControlChannel",
          "ssmmessages:OpenDataChannel"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role_policy" "backend_s3_access" {
  name = "WorkManagerS3Access"
  role = aws_iam_role.backend_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ]
        Resource = "arn:aws:s3:::work-manager-assets/*"
      }
    ]
  })
}

resource "aws_iam_role_policy" "backend_ses_send_email" {
  name = "WorkManagerSesSendEmail"
  role = aws_iam_role.backend_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ses:SendEmail",
          "ses:SendRawEmail"
        ]
        Resource = "*"
      }
    ]
  })
}
