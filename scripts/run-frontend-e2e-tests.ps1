#!/usr/bin/env pwsh
<#
Run the frontend end-to-end tests (frontend\app\src\androidTest\e2e\*.kt) against the real backend.
Same behavior as run-frontend-e2e-tests.sh. Full instructions: documentation\Testing.md, section 4.

Prerequisites:
  - A phone (USB debugging on) or an emulator is connected. Set $env:ANDROID_SERIAL if several are.
  - Run this on the computer whose debug key Google Sign-In trusts: it builds and installs both the
    app and the test APK here, so both are signed with this computer's key.
  - The backend in API_BASE_URL (frontend\local.properties) is reachable. If that is 10.0.2.2,
    localhost or 127.0.0.1, this script starts the local backend (scripts\run-backend.ps1: Docker and
    backend\.env). Override with $env:E2E_START_BACKEND = 'yes' or 'no'.
  - Sign in to the app on the device when asked. The script waits up to $env:E2E_SIGNIN_TIMEOUT
    seconds (default 300). The tests never sign in themselves.

It never uninstalls the app and never clears its data. It prints a pass/fail summary, saves the full
log in frontend\app\build\e2e-logs\, and exits non-zero unless every test passed.

Usage: .\scripts\run-frontend-e2e-tests.ps1

NOTE ON EXECUTION POLICY:
  Windows blocks script execution by default. If running this script fails
  with a message about execution policies, either:
    - run once: Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
    - or launch with: pwsh -ExecutionPolicy Bypass -File .\scripts\run-frontend-e2e-tests.ps1
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Root = (Resolve-Path (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) '..')).Path
$FrontendDir = if ($env:FRONTEND_DIR) { $env:FRONTEND_DIR } else { Join-Path $Root 'frontend' }
$env:FRONTEND_DIR = $FrontendDir

. (Join-Path $Root 'scripts\lib\frontend-instrumented-test-common.ps1')
Run-E2ETests
