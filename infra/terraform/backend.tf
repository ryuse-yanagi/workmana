terraform {
  backend "s3" {
    bucket       = "workmana-terraform-state-381904000617"
    key          = "workmana/terraform.tfstate"
    region       = "ap-northeast-1"
    encrypt      = true
    use_lockfile = true
  }
}
