# ============================================================
# Amazon Cognito
# ============================================================

# ------------------------------------------------------------
# User Pool
# ------------------------------------------------------------

resource "aws_cognito_user_pool" "workmanager" {
  name                = "User pool - msys-a"
  deletion_protection = "ACTIVE"

  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  schema {
    attribute_data_type = "String"
    name                = "email"
    required            = true
    mutable             = true

    string_attribute_constraints {
      min_length = "0"
      max_length = "2048"
    }
  }

  mfa_configuration = "OFF"

  user_pool_tier = "ESSENTIALS"

  password_policy {
    minimum_length                   = 8
    require_uppercase                = true
    require_lowercase                = true
    require_numbers                  = true
    require_symbols                  = true
    temporary_password_validity_days = 7
  }

  sign_in_policy {
    allowed_first_auth_factors = ["PASSWORD"]
  }

  verification_message_template {
    default_email_option = "CONFIRM_WITH_CODE"
  }

  admin_create_user_config {
    allow_admin_create_user_only = false
  }

  username_configuration {
    case_sensitive = false
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }

    recovery_mechanism {
      name     = "verified_phone_number"
      priority = 2
    }
  }

  email_configuration {
    email_sending_account = "COGNITO_DEFAULT"
  }

  lifecycle {
    prevent_destroy = true
  }
}

# ------------------------------------------------------------
# User Pool Client
# ------------------------------------------------------------

resource "aws_cognito_user_pool_client" "workmanager" {
  name         = "work-manager"
  user_pool_id = aws_cognito_user_pool.workmanager.id


  refresh_token_validity = 5
  access_token_validity  = 60
  id_token_validity      = 60

  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }

  explicit_auth_flows = [
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_AUTH",
    "ALLOW_USER_SRP_AUTH"
  ]

  supported_identity_providers = [
    "COGNITO"
  ]

  callback_urls = [
    "https://workmanager.jp/api/auth/callback"
  ]

  logout_urls = [
    "https://workmanager.jp/login"
  ]

  allowed_oauth_flows = [
    "code"
  ]

  allowed_oauth_scopes = [
    "email",
    "openid"
  ]

  allowed_oauth_flows_user_pool_client = true

  enable_token_revocation = true

  enable_propagate_additional_user_context_data = false

  prevent_user_existence_errors = "ENABLED"

  auth_session_validity = 3

  lifecycle {
    prevent_destroy = true
  }
}

# ------------------------------------------------------------
# User Pool Domain
# ------------------------------------------------------------

resource "aws_cognito_user_pool_domain" "workmanager" {
  domain       = "ap-northeast-1vjinlwg57"
  user_pool_id = aws_cognito_user_pool.workmanager.id

  managed_login_version = 2

  lifecycle {
    prevent_destroy = true
  }
}

# ------------------------------------------------------------
# Managed Login Branding
# ------------------------------------------------------------

resource "aws_cognito_managed_login_branding" "workmanager" {
  user_pool_id = aws_cognito_user_pool.workmanager.id
  client_id    = aws_cognito_user_pool_client.workmanager.id

  use_cognito_provided_values = true

  lifecycle {
    prevent_destroy = true
  }
}
