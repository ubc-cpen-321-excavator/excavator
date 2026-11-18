#!/usr/bin/env pwsh
<#
Shared helpers for frontend instrumented test runners (E2E + NFR).
Dot-source after setting $Root and $FrontendDir.

Expected layout:
  frontend\app\src\androidTest\...\{e2e,nfr}\
  frontend\app\build.gradle[.kts]
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not $Root)        { throw 'ROOT must be set' }
if (-not $FrontendDir) { throw 'FRONTEND_DIR must be set' }

function Info($msg) { Write-Host "==> $msg" -ForegroundColor Blue }
function Warn($msg) { Write-Host "WARN: $msg" -ForegroundColor Yellow }
function Die($msg)  { Write-Host "ERROR: $msg" -ForegroundColor Red; exit 1 }

function Configure-AndroidHome {
    if ($env:ANDROID_HOME -and (Test-Path $env:ANDROID_HOME)) {
        # already set, use it
    }
    else {
        $localProperties = Join-Path $FrontendDir 'local.properties'
        $sdkLine = $null
        if (Test-Path $localProperties) {
            $sdkLine = Get-Content $localProperties | Where-Object { $_ -match '^\s*sdk\.dir\s*=' } | Select-Object -First 1
        }
        $sdkDir = $null
        if ($sdkLine) {
            $sdkDir = ($sdkLine -replace '^\s*sdk\.dir\s*=\s*', '').Trim(' ', '"')
            $sdkDir = $sdkDir -replace '\\:', ':'
            $sdkDir = $sdkDir -replace '\\\\', '\'
        }
        if ($sdkDir -and (Test-Path $sdkDir)) {
            $env:ANDROID_HOME = $sdkDir
        }
    }
    if ($env:ANDROID_HOME) {
        $env:Path = "$($env:ANDROID_HOME)\platform-tools;$($env:Path)"
    }
}

function Pick-GradleBuildFile($dir) {
    $kts = Join-Path $dir 'build.gradle.kts'
    $groovy = Join-Path $dir 'build.gradle'
    if (Test-Path $kts) { return $kts }
    if (Test-Path $groovy) { return $groovy }
    Die "Cannot find build.gradle.kts or build.gradle in $dir."
}

function Resolve-TestRoot {
    $script:TestRoot = Join-Path $FrontendDir 'app\src\androidTest'
    if (-not (Test-Path $script:TestRoot)) { Die "Cannot find $($script:TestRoot)." }
    $script:GradleTask = ':app:connectedDebugAndroidTest'
    $script:AppBuild = Pick-GradleBuildFile (Join-Path $FrontendDir 'app')
}

function Get-ApplicationId {
    $line = Get-Content $script:AppBuild | Where-Object { $_ -match '\sapplicationId\s*=' } | Select-Object -First 1
    if ($line -and ($line -match '=\s*["'']([^"'']+)["'']')) {
        return $Matches[1]
    }
    return $null
}

function Get-KotlinTestClass($file) {
    $package = $null
    $className = $null
    foreach ($line in Get-Content $file) {
        if (-not $package -and $line -match '^\s*package\s+(\S+)') {
            $package = $Matches[1]
        }
        if (-not $className -and $line -match '^\s*(class|object)\s+([A-Za-z0-9_]+)') {
            $className = $Matches[2]
        }
    }
    if (-not $package -or -not $className) { Die "Could not resolve test class from $file" }
    return "$package.$className"
}

function Discover-TestFiles($subdir) {
    $script:TestFiles = @(
        Get-ChildItem -Path $script:TestRoot -Recurse -File -Filter '*.kt' -ErrorAction SilentlyContinue |
            Where-Object { $_.FullName -match "[\\/]$([regex]::Escape($subdir))[\\/]" } |
            Sort-Object FullName |
            ForEach-Object { $_.FullName }
    )
}

function Ensure-Backend {
    $startScript = Join-Path $Root 'scripts\run-backend.ps1'
    if (-not (Test-Path $startScript)) {
        Info "No scripts\run-backend.ps1; skipping backend startup."
        return
    }
    Info "Starting backend (scripts\run-backend.ps1) ..."
    & $startScript
    if ($LASTEXITCODE -ne 0) { Die "Backend startup failed." }
}

function Wait-ForAppSignIn {
    Warn "Sign in inside the app on the emulator (not just emulator Settings > Accounts)."
    Warn "  If you see a sign-in button in the app, tap it and pick your Google account."
    Warn "  When the main app screen is visible, press Enter here to run tests ..."
    [void](Read-Host)
}

function Run-InstrumentedTests($suite) {
    $subdir = $null
    $label = $null
    switch ($suite) {
        'e2e' { $subdir = 'e2e'; $label = 'E2E' }
        'nfr' { $subdir = 'nfr'; $label = 'NFR' }
        default { Die "Unknown suite '$suite' (expected e2e or nfr)." }
    }

    Resolve-TestRoot
    Discover-TestFiles $subdir

    if ($script:TestFiles.Count -eq 0) {
        Warn "Skipping frontend ${label} tests: no *.kt files in app\src\androidTest\...\${subdir}\."
        exit 0
    }

    $appId = Get-ApplicationId
    if (-not $appId) { Die "Could not resolve applicationId from $($script:AppBuild)." }

    Ensure-Backend
    $frontendScript = Join-Path $Root 'scripts\run-frontend.ps1'
    & $frontendScript
    if ($LASTEXITCODE -ne 0) { Die "Frontend startup failed." }

    Configure-AndroidHome
    $adb = Join-Path $env:ANDROID_HOME 'platform-tools\adb.exe'
    if (-not (Test-Path $adb)) {
        $adbCmd = Get-Command adb -ErrorAction SilentlyContinue
        if ($adbCmd) { $adb = $adbCmd.Source }
        else { Die "adb not found." }
    }

    Wait-ForAppSignIn
    & $adb shell am force-stop $appId 2>$null | Out-Null

    $classes = @()
    foreach ($file in $script:TestFiles) {
        $classes += Get-KotlinTestClass $file
    }
    $classArg = $classes -join ','

    Info "Running frontend ${label} tests (${classArg}) ..."
    Push-Location $FrontendDir
    try {
        & .\gradlew.bat $script:GradleTask "-Pandroid.testInstrumentationRunnerArguments.class=$classArg"
        if ($LASTEXITCODE -ne 0) { Die "Frontend ${label} tests failed." }
    }
    finally {
        Pop-Location
    }
    Info "Frontend ${label} tests finished."
}

# ---------------------------------------------------------------------------
# Frontend E2E runner, used by scripts\run-frontend-e2e-tests.ps1.
# Keep in step with run_e2e_tests in frontend-instrumented-test-common.sh: both must behave the same.
#
# Runs every @Test in app\src\androidTest\e2e\ in its own `am instrument` call, on the app that is
# installed and signed in on the device. It never uninstalls the app, never runs `pm clear` and
# never deletes app data, so the sign-in survives between tests and between runs.
# ---------------------------------------------------------------------------

$script:E2ERunner = 'androidx.test.runner.AndroidJUnitRunner'
$script:E2EDefaultBackendUrl = 'http://10.0.2.2:3000'   # same default as app\build.gradle.kts
$script:E2EPollSeconds = 5
$script:E2ESeedBlocked = 'blocked: waiting for the seed script'
$script:E2ELocationPermissions = @('android.permission.ACCESS_FINE_LOCATION', 'android.permission.ACCESS_COARSE_LOCATION')
# Tests that must start without location permission: it is revoked just before them and granted back after.
$script:E2ERevokeTests = @('e2e.AddGemE2ETest#scenario2a_locationPermissionDenied')
$script:E2ELastExitCode = 0

# Runs a native command, discards its stderr and returns its output lines. Windows PowerShell turns
# redirected native stderr into errors, which 'Stop' would make fatal, so this relaxes that briefly.
function Invoke-E2ENative([string]$Exe, [string[]]$Arguments) {
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $output = & $Exe @Arguments 2>$null
        $script:E2ELastExitCode = $LASTEXITCODE
        return @($output | ForEach-Object { "$_".TrimEnd("`r") })
    }
    finally {
        $ErrorActionPreference = $previous
    }
}

function Invoke-E2EAdb([string[]]$Arguments) {
    return @(Invoke-E2ENative $script:Adb $Arguments)
}

# API_BASE_URL from frontend\local.properties, read the way app\build.gradle.kts reads it.
function Get-E2EBackendUrl {
    $localProperties = Join-Path $FrontendDir 'local.properties'
    $line = $null
    if (Test-Path $localProperties) {
        $line = Get-Content $localProperties | Where-Object { $_ -match '^\s*API_BASE_URL\s*=' } | Select-Object -Last 1
    }
    $value = ''
    if ($line) {
        $value = $line.Substring($line.IndexOf('=') + 1).Trim()
        if ($value.Length -ge 2 -and $value.StartsWith('"') -and $value.EndsWith('"')) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        $value = $value -replace '\\:', ':'
    }
    if (-not $value) { $value = $script:E2EDefaultBackendUrl }
    return $value
}

# Sets BackendHost, BackendPort and BackendRoot (scheme://host[:port]) from a URL.
function Set-E2EBackendParts([string]$Url) {
    $separator = $Url.IndexOf('://')
    if ($separator -ge 0) {
        $scheme = $Url.Substring(0, $separator)
        $rest = $Url.Substring($separator + 3)
    }
    else {
        $scheme = $Url
        $rest = $Url
    }
    $authority = ($rest -split '/', 2)[0]
    $script:BackendHost = ($authority -split ':', 2)[0]
    if ($authority.Contains(':')) {
        $script:BackendPort = $authority.Substring($authority.LastIndexOf(':') + 1)
    }
    elseif ($scheme -eq 'https') {
        $script:BackendPort = '443'
    }
    else {
        $script:BackendPort = '80'
    }
    $script:BackendRoot = "${scheme}://$authority"
}

function Test-E2ELocalHost([string]$HostName) {
    return ($HostName -ceq '10.0.2.2' -or $HostName -ceq 'localhost' -or $HostName -ceq '127.0.0.1')
}

# Picks the device: ANDROID_SERIAL if set, otherwise the first connected device (phone or emulator).
function Select-E2EDevice {
    $devices = @(Invoke-E2EAdb @('devices') | Select-Object -Skip 1 | ForEach-Object {
            $parts = $_.Trim() -split '\s+'
            if ($parts.Count -ge 2 -and $parts[1] -ceq 'device') { $parts[0] }
        })
    if ($env:ANDROID_SERIAL) {
        if ($devices -cnotcontains $env:ANDROID_SERIAL) {
            $listed = if ($devices.Count -gt 0) { $devices -join ', ' } else { 'none' }
            Die "ANDROID_SERIAL=$($env:ANDROID_SERIAL) is not a connected device. Connected: $listed."
        }
    }
    else {
        if ($devices.Count -eq 0) {
            Die 'No device connected. Connect the phone (USB debugging on) or start an emulator, sign in to the app on it, then rerun.'
        }
        $env:ANDROID_SERIAL = $devices[0]
        if ($devices.Count -gt 1) {
            Warn "$($devices.Count) devices are connected; using $($env:ANDROID_SERIAL). Set ANDROID_SERIAL to choose another."
        }
    }
    Info "Using device $($env:ANDROID_SERIAL)."
}

# Makes sure the device can reach the backend the app was built for.
function Test-E2EDeviceCanReachBackend {
    if ($script:BackendHost -ceq '10.0.2.2' -and -not $env:ANDROID_SERIAL.StartsWith('emulator-')) {
        Die "API_BASE_URL uses 10.0.2.2, which only an emulator can reach, but $($env:ANDROID_SERIAL) is a phone. Set API_BASE_URL in frontend/local.properties to this computer's network address (and E2E_START_BACKEND=yes), or use an emulator."
    }
    if ($script:BackendHost -ceq 'localhost' -or $script:BackendHost -ceq '127.0.0.1') {
        $port = $script:BackendPort
        [void](Invoke-E2EAdb @('reverse', "tcp:$port", "tcp:$port"))
        if ($script:E2ELastExitCode -ne 0) {
            Die "Could not forward the device's port $port to this computer (adb reverse)."
        }
        Info "Forwarded the device's port $port to this computer (adb reverse)."
    }
}

# Starts the local backend if the app uses one; otherwise checks that the app's backend answers.
function Initialize-E2EBackend {
    $mode = if ($env:E2E_START_BACKEND) { $env:E2E_START_BACKEND } else { 'auto' }
    $start = $false
    switch -CaseSensitive ($mode) {
        'yes' { $start = $true }
        'no' { $start = $false }
        'auto' { $start = Test-E2ELocalHost $script:BackendHost }
        default { Die "E2E_START_BACKEND must be auto, yes or no (got '$mode')." }
    }
    Info "The app is built to use the backend at $($script:BackendUrl) (API_BASE_URL in frontend/local.properties)."
    if ($start) {
        Ensure-Backend
    }
    else {
        Info "Not starting a local backend. Checking $($script:BackendRoot)/health ..."
        [void](Invoke-E2ENative 'curl.exe' @('-sf', "$($script:BackendRoot)/health"))
        if ($script:E2ELastExitCode -ne 0) {
            Die "The backend at $($script:BackendRoot) is not reachable (GET /health failed). Start it, or fix API_BASE_URL."
        }
    }
}

# Builds and installs the app and the test APK. Both are signed with this computer's debug key.
function Install-E2EApps {
    Info "Building and installing the app and the test APK on $($env:ANDROID_SERIAL) (installDebug installDebugAndroidTest) ..."
    Info "Both are signed with this computer's debug key. Google Sign-In only works if Google trusts that key."
    Push-Location $FrontendDir
    try {
        & .\gradlew.bat installDebug installDebugAndroidTest
        $code = $LASTEXITCODE
    }
    finally {
        Pop-Location
    }
    if ($code -ne 0) {
        Die 'Install failed. If it says INSTALL_FAILED_UPDATE_INCOMPATIBLE, the app on the device was built on another computer (different key). This script never uninstalls the app, because that would delete its sign-in: run it on the computer the app was installed from.'
    }
}

function Test-E2ESignedIn {
    $prefs = (Invoke-E2EAdb @('shell', 'run-as', $script:AppId, 'cat', 'shared_prefs/auth.xml')) -join "`n"
    return $prefs.Contains('name="jwt"')
}

# Opens the app and waits, with a timeout, until a user has signed in on the device.
function Wait-E2ESignIn {
    $timeoutText = if ($env:E2E_SIGNIN_TIMEOUT) { $env:E2E_SIGNIN_TIMEOUT } else { '300' }
    if ($timeoutText -notmatch '^[0-9]+$') {
        Die "E2E_SIGNIN_TIMEOUT must be a number of seconds (got '$timeoutText')."
    }
    $timeout = [int]$timeoutText
    $serial = $env:ANDROID_SERIAL
    [void](Invoke-E2EAdb @('shell', 'monkey', '-p', $script:AppId, '-c', 'android.intent.category.LAUNCHER', '1'))
    if (Test-E2ESignedIn) {
        Info "The app on $serial is already signed in."
        return
    }
    Warn "The app on $serial is not signed in. The tests never sign in themselves."
    Warn '  On the device: open Excavator, tap "Sign in with Google" and choose your account.'
    Warn "  Waiting up to ${timeout}s; the tests start by themselves once you are signed in."
    $waited = 0
    while (-not (Test-E2ESignedIn)) {
        if ($waited -ge $timeout) {
            Die "Timed out after ${timeout}s waiting for sign-in. Sign in to the app on $serial, then rerun (or set E2E_SIGNIN_TIMEOUT)."
        }
        Start-Sleep -Seconds $script:E2EPollSeconds
        $waited += $script:E2EPollSeconds
    }
    Info 'Signed in.'
}

# 'grant' or 'revoke'
function Set-E2ELocationPermission([string]$Action) {
    foreach ($permission in $script:E2ELocationPermissions) {
        [void](Invoke-E2EAdb @('shell', 'pm', $Action, $script:AppId, $permission))
    }
}

# Puts the device back as the tests need it. Runs on every exit, including errors and Ctrl+C.
function Restore-E2EDeviceState {
    Set-E2ELocationPermission 'grant'
    [void](Invoke-E2EAdb @('shell', 'cmd', 'location', 'set-location-enabled', 'true'))
}

function Initialize-E2EDevice {
    Set-E2ELocationPermission 'grant'
    [void](Invoke-E2EAdb @('shell', 'cmd', 'location', 'set-location-enabled', 'true'))
    [void](Invoke-E2EAdb @('shell', 'appops', 'set', $script:AppId, 'android:mock_location', 'allow'))
}

# Returns "package.Class#method" for every @Test, in file order.
function Get-E2ETests {
    $tests = @()
    foreach ($file in $script:TestFiles) {
        $lines = @(Get-Content $file)
        if (-not ($lines | Where-Object { $_ -match '^\s*@Test' })) { continue }
        $class = Get-KotlinTestClass $file
        $pending = $false
        foreach ($line in $lines) {
            if ($line -match '^\s*@Test') {
                $pending = $true
                continue
            }
            if ($pending -and $line -match 'fun\s+([A-Za-z0-9_]+)') {
                $tests += "$class#$($Matches[1])"
                $pending = $false
            }
        }
    }
    return $tests
}

function Get-E2EResult([string]$Output) {
    if ($Output.Contains('OK (1 test)')) { return 'PASS' }
    if ($Output.Contains($script:E2ESeedBlocked)) { return 'BLOCKED' }
    if ($Output.Contains('Process crashed')) { return 'FAIL (app crashed)' }
    return 'FAIL'
}

function Add-E2ELog([string]$Text) {
    [System.IO.File]::AppendAllText($script:E2ELog, $Text, (New-Object System.Text.UTF8Encoding $false))
}

# Runs one test in its own instrumentation process, appends its output to the log, returns its result.
function Invoke-E2ETest([string]$Test) {
    $revoke = $script:E2ERevokeTests -ccontains $Test
    if ($revoke) { Set-E2ELocationPermission 'revoke' }
    $target = "$($script:AppId).test/$($script:E2ERunner)"
    $output = (Invoke-E2EAdb @('shell', 'am', 'instrument', '-w', '-r', '-e', 'class', $Test, $target)) -join "`n"
    if ($revoke) { Set-E2ELocationPermission 'grant' }
    Add-E2ELog "`n===== $Test =====`n$output`n"
    return Get-E2EResult $output
}

# Prints the summary, adds it to the log, and returns whether every test passed.
function Write-E2ESummary {
    $pass = 0
    $failed = 0
    $blocked = 0
    foreach ($result in $script:E2EResults) {
        if ($result -ceq 'PASS') { $pass++ }
        elseif ($result -ceq 'BLOCKED') { $blocked++ }
        else { $failed++ }
    }
    $lines = @('', "Frontend E2E test results ($(Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))", '', '| # | Test | Result |', '| --- | --- | --- |')
    for ($i = 0; $i -lt $script:E2ETests.Count; $i++) {
        $lines += ('| {0} | `{1}` | {2} |' -f ($i + 1), $script:E2ETests[$i], $script:E2EResults[$i])
    }
    $lines += ''
    $lines += "Passed: $pass, failed: $failed, blocked: $blocked, total: $($script:E2ETests.Count)"
    foreach ($line in $lines) { Write-Host $line }
    Add-E2ELog (($lines -join "`n") + "`n")
    return ($failed -eq 0 -and $blocked -eq 0)
}

function Run-E2ETests {
    Resolve-TestRoot
    Discover-TestFiles 'e2e'
    $script:E2ETests = @(Get-E2ETests)
    $total = $script:E2ETests.Count
    if ($total -eq 0) {
        Warn 'Skipping frontend E2E tests: no @Test methods in app\src\androidTest\e2e\.'
        exit 0
    }

    $script:AppId = Get-ApplicationId
    if (-not $script:AppId) { Die "Could not resolve applicationId from $($script:AppBuild)." }
    Configure-AndroidHome
    $script:Adb = $null
    if ($env:ANDROID_HOME) {
        $candidate = Join-Path $env:ANDROID_HOME 'platform-tools\adb.exe'
        if (Test-Path $candidate) { $script:Adb = $candidate }
    }
    if (-not $script:Adb) {
        $adbCommand = Get-Command adb -ErrorAction SilentlyContinue
        if ($adbCommand) { $script:Adb = $adbCommand.Source } else { Die 'adb not found.' }
    }
    if (-not (Get-Command curl.exe -ErrorAction SilentlyContinue)) { Die 'curl not found.' }

    $script:BackendUrl = Get-E2EBackendUrl
    Set-E2EBackendParts $script:BackendUrl
    Select-E2EDevice
    Test-E2EDeviceCanReachBackend
    Initialize-E2EBackend
    Install-E2EApps
    Wait-E2ESignIn

    $allPassed = $false
    try {
        Initialize-E2EDevice

        $logDir = Join-Path $FrontendDir 'app\build\e2e-logs'
        New-Item -ItemType Directory -Force -Path $logDir | Out-Null
        $script:E2ELog = Join-Path $logDir ("e2e-{0}.log" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
        [System.IO.File]::WriteAllText($script:E2ELog, ("Frontend E2E run: device {0}, backend {1}`n" -f $env:ANDROID_SERIAL, $script:BackendUrl), (New-Object System.Text.UTF8Encoding $false))

        $script:E2EResults = @()
        for ($i = 0; $i -lt $total; $i++) {
            $test = $script:E2ETests[$i]
            Info "[$($i + 1)/$total] $test ..."
            $result = Invoke-E2ETest $test
            $script:E2EResults += $result
            Info "[$($i + 1)/$total] ${test}: $result"
        }

        $allPassed = Write-E2ESummary
        Info "Full log: $($script:E2ELog)"
    }
    finally {
        Restore-E2EDeviceState
    }
    if (-not $allPassed) { Die 'Some frontend E2E tests did not pass (see the summary above).' }
    Info 'All frontend E2E tests passed.'
}
