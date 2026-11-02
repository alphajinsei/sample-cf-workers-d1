provider "cloudflare" {
  # 認証は環境変数 CLOUDFLARE_API_TOKEN から読む
}

locals {
  account_id  = "da07fbd6d431eccc008a74d695734e73"
  hostname    = "sample-cf-workers-d1.alphajinsei.com"
  owner_email = "peinn17@gmail.com"
}

# 誰を通すか：自分のメールアドレスだけ
resource "cloudflare_zero_trust_access_policy" "owner_only" {
  account_id = local.account_id
  name       = "sample-cf-workers-d1: owner only"
  decision   = "allow"
  include = [{
    email = { email = local.owner_email }
  }]
}

# どこを守るか：/admin 以下
resource "cloudflare_zero_trust_access_application" "admin" {
  account_id       = local.account_id
  name             = "sample-cf-workers-d1 admin"
  type             = "self_hosted"
  domain           = "${local.hostname}/admin"
  session_duration = "24h"
  policies = [{
    id         = cloudflare_zero_trust_access_policy.owner_only.id
    precedence = 1
  }]
}
