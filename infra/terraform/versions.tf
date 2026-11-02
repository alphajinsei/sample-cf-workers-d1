terraform {
  required_version = ">= 1.10"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.28"
    }
  }

  backend "s3" {
    bucket = "tfstate"
    key    = "sample-cf-workers-d1/terraform.tfstate"
    region = "auto"
    endpoints = {
      s3 = "https://da07fbd6d431eccc008a74d695734e73.r2.cloudflarestorage.com"
    }
    use_lockfile = true

    # R2 は AWS ではないので、AWS 固有のチェックを飛ばす
    skip_credentials_validation = true
    skip_region_validation      = true
    skip_requesting_account_id  = true
    skip_metadata_api_check     = true
    skip_s3_checksum            = true
    use_path_style              = true
  }
}
