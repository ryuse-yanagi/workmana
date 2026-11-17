# ==========================================
# GitHub Actions OIDC Provider
# ==========================================

resource "aws_iam_openid_connect_provider" "github_actions" {
  url = "https://token.actions.githubusercontent.com"

  client_id_list = [
    "sts.amazonaws.com"
  ]
}

# ==========================================
# GitHub Actions Deployment Role
# ==========================================

resource "aws_iam_role" "github_actions_deploy" {
  name        = "work-manager-github-actions-deploy"
  description = "IAM role for GitHub Actions to push images to ECR and deploy ECS services."

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = aws_iam_openid_connect_provider.github_actions.arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
            "token.actions.githubusercontent.com:sub" = "repo:ryuse-yanagi@270967399/workmana@1192709266:ref:refs/heads/main"
          }
        }
      }
    ]
  })

  max_session_duration = 3600
}

# ==========================================
# GitHub Actions Deployment Policy
# ==========================================

resource "aws_iam_role_policy" "github_actions_deploy" {
  name = "work-manager-github-actions-deploy-policy"
  role = aws_iam_role.github_actions_deploy.id

  policy = jsonencode({
    Version = "2012-10-17"

    Statement = [
      # ECR authentication
      {
        Sid      = "ECRAuthorization"
        Effect   = "Allow"
        Action   = "ecr:GetAuthorizationToken"
        Resource = "*"
      },

      # Push images to Work Manager repositories
      {
        Sid    = "ECRPush"
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:BatchGetImage",
          "ecr:CompleteLayerUpload",
          "ecr:InitiateLayerUpload",
          "ecr:PutImage",
          "ecr:UploadLayerPart"
        ]
        Resource = [
          "arn:aws:ecr:ap-northeast-1:381904000617:repository/work-manager-backend",
          "arn:aws:ecr:ap-northeast-1:381904000617:repository/work-manager-frontend"
        ]
      },

      # Register and inspect ECS task definitions
      {
        Sid    = "ECSTaskDefinition"
        Effect = "Allow"
        Action = [
          "ecs:RegisterTaskDefinition",
          "ecs:DescribeTaskDefinition"
        ]
        Resource = "*"
      },

      # Update only Work Manager ECS services
      {
        Sid    = "ECSServiceDeployment"
        Effect = "Allow"
        Action = [
          "ecs:DescribeServices",
          "ecs:UpdateService"
        ]
        Resource = [
          "arn:aws:ecs:ap-northeast-1:381904000617:service/work-manager-cluster/work-manager-backend-service",
          "arn:aws:ecs:ap-northeast-1:381904000617:service/work-manager-cluster/work-manager-frontend-service"
        ]
      },

      # Pass only the existing ECS task roles
      {
        Sid    = "PassECSTaskRoles"
        Effect = "Allow"
        Action = "iam:PassRole"
        Resource = [
          "arn:aws:iam::381904000617:role/ecsTaskExecutionRole",
          "arn:aws:iam::381904000617:role/work-manager-backend-task-role"
        ]
        Condition = {
          StringEquals = {
            "iam:PassedToService" = "ecs-tasks.amazonaws.com"
          }
        }
      }
    ]
  })
}
