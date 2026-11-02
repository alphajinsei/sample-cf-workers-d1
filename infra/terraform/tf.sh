#!/usr/bin/env bash
set -euo pipefail
set -a
source ~/claude-sandbox/infra/.secrets/r2-tfstate.env
source ~/claude-sandbox/infra/.secrets/terraform-cloudflare.env
set +a
exec terraform "$@"
