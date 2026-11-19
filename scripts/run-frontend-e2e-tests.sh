#!/usr/bin/env bash
#
# Run the frontend end-to-end tests (frontend/app/src/androidTest/e2e/*.kt) against the real backend.
# Same behavior as run-frontend-e2e-tests.ps1. Full instructions: documentation/Testing.md, section 4.
#
# Prerequisites:
#   - A phone (USB debugging on) or an emulator is connected. Set ANDROID_SERIAL if several are.
#   - Run this on the computer whose debug key Google Sign-In trusts: it builds and installs both the
#     app and the test APK here, so both are signed with this computer's key.
#   - The backend in API_BASE_URL (frontend/local.properties) is reachable. If that is 10.0.2.2,
#     localhost or 127.0.0.1, this script starts the local backend (scripts/run-backend.sh: Docker and
#     backend/.env). Override with E2E_START_BACKEND=yes|no.
#   - Sign in to the app on the device when asked. The script waits up to E2E_SIGNIN_TIMEOUT seconds
#     (default 300). The tests never sign in themselves.
#
# It never uninstalls the app and never clears its data. It prints a pass/fail summary, saves the full
# log in frontend/app/build/e2e-logs/, and exits non-zero unless every test passed.
#
# Usage: ./scripts/run-frontend-e2e-tests.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export FRONTEND_DIR="${FRONTEND_DIR:-$ROOT/frontend}"

source "$ROOT/scripts/lib/frontend-instrumented-test-common.sh"
run_e2e_tests
