#!/usr/bin/env bash
# Keep the established VPS update command compatible with the currency schema.
set -Eeuo pipefail
exec bash /opt/borsabi/nextjs_space/scripts/deploy-currency.sh
