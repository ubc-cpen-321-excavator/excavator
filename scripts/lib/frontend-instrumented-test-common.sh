#!/usr/bin/env bash
#
# Shared helpers for frontend instrumented test runners (E2E + NFR).
# Source after setting ROOT and FRONTEND_DIR.
#
# Expected layout:
#   frontend/app/src/androidTest/.../{e2e,nfr}/
#   frontend/app/build.gradle[.kts]

: "${ROOT:?ROOT must be set}"
: "${FRONTEND_DIR:?FRONTEND_DIR must be set}"

info() { printf '\033[34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[33mWARN:\033[0m %s\n' "$*"; }
die()  { printf '\033[31mERROR:\033[0m %s\n' "$*" >&2; exit 1; }

configure_android_home() {
  if [[ -z "${ANDROID_HOME:-}" || ! -d "$ANDROID_HOME" ]]; then
    sdk_dir="$(grep -E '^sdk\.dir=' "$FRONTEND_DIR/local.properties" 2>/dev/null \
      | head -1 | cut -d= -f2- | tr -d ' "' || true)"
    [[ -n "$sdk_dir" ]] && export ANDROID_HOME="$sdk_dir"
  fi
  export PATH="${ANDROID_HOME:-}/platform-tools:$PATH"
}

pick_gradle_build_file() {
  local dir="$1"
  if [[ -f "$dir/build.gradle.kts" ]]; then
    printf '%s\n' "$dir/build.gradle.kts"
  elif [[ -f "$dir/build.gradle" ]]; then
    printf '%s\n' "$dir/build.gradle"
  else
    die "Cannot find build.gradle.kts or build.gradle in $dir."
  fi
}

resolve_test_root() {
  TEST_ROOT="$FRONTEND_DIR/app/src/androidTest"
  [[ -d "$TEST_ROOT" ]] || die "Cannot find $TEST_ROOT."
  GRADLE_TASK=":app:connectedDebugAndroidTest"
  APP_BUILD="$(pick_gradle_build_file "$FRONTEND_DIR/app")"
}

application_id() {
  grep -E '[[:space:]]applicationId[[:space:]]*=' "$APP_BUILD" \
    | head -1 | sed -E 's/.*=[[:space:]]*["'\'']([^"'\'']+)["'\''].*/\1/'
}

kotlin_test_class() {
  local file="$1" package class_name
  package="$(grep -E '^[[:space:]]*package[[:space:]]+' "$file" | head -1 \
    | sed -E 's/^[[:space:]]*package[[:space:]]+//;s/[[:space:]]*$//')"
  class_name="$(grep -E '^[[:space:]]*(class|object)[[:space:]]+' "$file" | head -1 \
    | sed -E 's/^[[:space:]]*(class|object)[[:space:]]+([A-Za-z0-9_]+).*/\2/')"
  [[ -n "$package" && -n "$class_name" ]] || die "Could not resolve test class from $file"
  printf '%s.%s' "$package" "$class_name"
}

discover_test_files() {
  local subdir="$1"
  TEST_FILES=()
  while IFS= read -r file; do
    [[ -n "$file" ]] && TEST_FILES+=("$file")
  done < <(find "$TEST_ROOT" -path "*/${subdir}/*" -name '*.kt' 2>/dev/null | sort)
}

ensure_backend() {
  local start_script="$ROOT/scripts/run-backend.sh"
  if [[ ! -f "$start_script" ]]; then
    info "No scripts/run-backend.sh; skipping backend startup."
    return 0
  fi
  info "Starting backend (scripts/run-backend.sh) ..."
  if [[ -x "$start_script" ]]; then
    "$start_script"
  else
    bash "$start_script"
  fi
}

wait_for_app_sign_in() {
  warn "Sign in inside the app on the emulator (not just emulator Settings > Accounts)."
  warn "  If you see a sign-in button in the app, tap it and pick your Google account."
  warn "  When the main app screen is visible, press Enter here to run tests ..."
  read -r
}

run_instrumented_tests() {
  local suite="$1"
  local subdir label
  case "$suite" in
    e2e) subdir=e2e; label=E2E ;;
    nfr) subdir=nfr; label=NFR ;;
    *) die "Unknown suite '$suite' (expected e2e or nfr)." ;;
  esac

  resolve_test_root
  discover_test_files "$subdir"

  if ((${#TEST_FILES[@]} == 0)); then
    warn "Skipping frontend ${label} tests: no *.kt files in app/src/androidTest/.../${subdir}/."
    exit 0
  fi

  local app_id classes=() class_arg
  app_id="$(application_id)"
  [[ -n "$app_id" ]] || die "Could not resolve applicationId from $APP_BUILD."

  ensure_backend
  "$ROOT/scripts/run-frontend.sh"
  configure_android_home
  command -v adb >/dev/null 2>&1 || die "adb not found."

  wait_for_app_sign_in
  adb shell am force-stop "$app_id" >/dev/null 2>&1 || true

  for file in "${TEST_FILES[@]}"; do
    classes+=("$(kotlin_test_class "$file")")
  done
  class_arg="$(IFS=,; echo "${classes[*]}")"

  info "Running frontend ${label} tests (${class_arg}) ..."
  (
    cd "$FRONTEND_DIR"
    ./gradlew "$GRADLE_TASK" \
      -Pandroid.testInstrumentationRunnerArguments.class="$class_arg"
  )
  info "Frontend ${label} tests finished."
}

# ---------------------------------------------------------------------------
# Frontend E2E runner, used by scripts/run-frontend-e2e-tests.sh.
# Keep in step with Run-E2ETests in frontend-instrumented-test-common.ps1: both must behave the same.
#
# Runs every @Test in app/src/androidTest/e2e/ in its own `am instrument` call, on the app that is
# installed and signed in on the device. It never uninstalls the app, never runs `pm clear` and
# never deletes app data, so the sign-in survives between tests and between runs.
# ---------------------------------------------------------------------------

E2E_RUNNER="androidx.test.runner.AndroidJUnitRunner"
E2E_DEFAULT_BACKEND_URL="http://10.0.2.2:3000"   # same default as app/build.gradle.kts
E2E_POLL_S=5
E2E_SEED_BLOCKED="blocked: waiting for the seed script"
E2E_LOCATION_PERMISSIONS=(android.permission.ACCESS_FINE_LOCATION android.permission.ACCESS_COARSE_LOCATION)
# Result labels. A crash or a missing result is never reported as a plain FAIL.
E2E_CRASHED="CRASH (process died)"
E2E_NO_RESULT="CRASH (no result)"
E2E_NOT_RUN="NOT RUN (device disconnected)"

# API_BASE_URL from frontend/local.properties, read the way app/build.gradle.kts reads it.
e2e_backend_url() {
  local line value
  line="$(grep -E '^[[:space:]]*API_BASE_URL[[:space:]]*=' "$FRONTEND_DIR/local.properties" 2>/dev/null | tail -1 || true)"
  value="$(printf '%s' "${line#*=}" | tr -d '\r' | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//; s/^"(.*)"$/\1/; s/\\:/:/g')"
  printf '%s\n' "${value:-$E2E_DEFAULT_BACKEND_URL}"
}

# Sets BACKEND_HOST, BACKEND_PORT and BACKEND_ROOT (scheme://host[:port]) from a URL.
e2e_parse_url() {
  local url="$1" scheme rest authority
  scheme="${url%%://*}"
  rest="${url#*://}"
  authority="${rest%%/*}"
  BACKEND_HOST="${authority%%:*}"
  if [[ "$authority" == *:* ]]; then
    BACKEND_PORT="${authority##*:}"
  elif [[ "$scheme" == https ]]; then
    BACKEND_PORT=443
  else
    BACKEND_PORT=80
  fi
  BACKEND_ROOT="$scheme://$authority"
}

e2e_is_local_host() {
  [[ "$1" == "10.0.2.2" || "$1" == "localhost" || "$1" == "127.0.0.1" ]]
}

# Picks the device: ANDROID_SERIAL if set, otherwise the first connected device (phone or emulator).
e2e_select_device() {
  local devices count
  devices="$(adb devices | tr -d '\r' | awk 'NR > 1 && $2 == "device" { print $1 }')"
  if [[ -n "${ANDROID_SERIAL:-}" ]]; then
    if ! grep -qxF "$ANDROID_SERIAL" <<<"$devices"; then
      local listed="${devices//$'\n'/, }"
      die "ANDROID_SERIAL=$ANDROID_SERIAL is not a connected device. Connected: ${listed:-none}."
    fi
  else
    ANDROID_SERIAL="$(head -1 <<<"$devices")"
    if [[ -z "$ANDROID_SERIAL" ]]; then
      die "No device connected. Connect the phone (USB debugging on) or start an emulator, sign in to the app on it, then rerun."
    fi
    count="$(grep -c . <<<"$devices" || true)"
    if (( count > 1 )); then
      warn "$count devices are connected; using $ANDROID_SERIAL. Set ANDROID_SERIAL to choose another."
    fi
  fi
  export ANDROID_SERIAL
  info "Using device $ANDROID_SERIAL."
}

# Makes sure the device can reach the backend the app was built for.
e2e_check_device_can_reach_backend() {
  if [[ "$BACKEND_HOST" == "10.0.2.2" && "$ANDROID_SERIAL" != emulator-* ]]; then
    die "API_BASE_URL uses 10.0.2.2, which only an emulator can reach, but $ANDROID_SERIAL is a phone. Set API_BASE_URL in frontend/local.properties to this computer's network address (and E2E_START_BACKEND=yes), or use an emulator."
  fi
  if [[ "$BACKEND_HOST" == "localhost" || "$BACKEND_HOST" == "127.0.0.1" ]]; then
    adb reverse "tcp:$BACKEND_PORT" "tcp:$BACKEND_PORT" >/dev/null 2>&1 \
      || die "Could not forward the device's port $BACKEND_PORT to this computer (adb reverse)."
    info "Forwarded the device's port $BACKEND_PORT to this computer (adb reverse)."
  fi
}

# Starts the local backend if the app uses one; otherwise checks that the app's backend answers.
e2e_prepare_backend() {
  local mode="${E2E_START_BACKEND:-auto}" start=no
  case "$mode" in
    yes) start=yes ;;
    no) start=no ;;
    auto)
      if e2e_is_local_host "$BACKEND_HOST"; then start=yes; fi
      ;;
    *) die "E2E_START_BACKEND must be auto, yes or no (got '$mode')." ;;
  esac
  info "The app is built to use the backend at $BACKEND_URL (API_BASE_URL in frontend/local.properties)."
  if [[ "$start" == yes ]]; then
    ensure_backend
  else
    info "Not starting a local backend. Checking $BACKEND_ROOT/health ..."
    curl -sf "$BACKEND_ROOT/health" >/dev/null 2>&1 \
      || die "The backend at $BACKEND_ROOT is not reachable (GET /health failed). Start it, or fix API_BASE_URL."
  fi
}

# Builds and installs the app and the test APK. Both are signed with this computer's debug key.
e2e_install() {
  info "Building and installing the app and the test APK on $ANDROID_SERIAL (installDebug installDebugAndroidTest) ..."
  info "Both are signed with this computer's debug key. Google Sign-In only works if Google trusts that key."
  (cd "$FRONTEND_DIR" && ./gradlew installDebug installDebugAndroidTest) \
    || die "Install failed. If it says INSTALL_FAILED_UPDATE_INCOMPATIBLE, the app on the device was built on another computer (different key). This script never uninstalls the app, because that would delete its sign-in: run it on the computer the app was installed from."
}

e2e_signed_in() {
  local prefs
  prefs="$(adb shell run-as "$APP_ID" cat shared_prefs/auth.xml 2>/dev/null | tr -d '\r' || true)"
  [[ "$prefs" == *'name="jwt"'* ]]
}

# Opens the app and waits, with a timeout, until a user has signed in on the device.
e2e_wait_for_sign_in() {
  local timeout="${E2E_SIGNIN_TIMEOUT:-300}" waited=0
  [[ "$timeout" =~ ^[0-9]+$ ]] || die "E2E_SIGNIN_TIMEOUT must be a number of seconds (got '$timeout')."
  adb shell monkey -p "$APP_ID" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1 || true
  if e2e_signed_in; then
    info "The app on $ANDROID_SERIAL is already signed in."
    return 0
  fi
  warn "The app on $ANDROID_SERIAL is not signed in. The tests never sign in themselves."
  warn "  On the device: open Excavator, tap \"Sign in with Google\" and choose your account."
  warn "  Waiting up to ${timeout}s; the tests start by themselves once you are signed in."
  until e2e_signed_in; do
    if (( waited >= timeout )); then
      die "Timed out after ${timeout}s waiting for sign-in. Sign in to the app on $ANDROID_SERIAL, then rerun (or set E2E_SIGNIN_TIMEOUT)."
    fi
    sleep "$E2E_POLL_S"
    waited=$((waited + E2E_POLL_S))
  done
  info "Signed in."
}

e2e_grant_location_permission() {
  local permission
  for permission in "${E2E_LOCATION_PERMISSIONS[@]}"; do
    adb shell pm grant "$APP_ID" "$permission" >/dev/null 2>&1 || true
  done
}

# Puts the device back as the tests need it. Runs on every exit, including errors and Ctrl+C.
e2e_restore_device_state() {
  e2e_grant_location_permission
  adb shell cmd location set-location-enabled true >/dev/null 2>&1 || true
}

# The tests assume normal conditions: location permission granted and the device's location on.
e2e_prepare_device() {
  e2e_grant_location_permission
  adb shell cmd location set-location-enabled true >/dev/null 2>&1 || true
  adb shell appops set "$APP_ID" android:mock_location allow >/dev/null 2>&1 || true
}

e2e_device_connected() {
  [[ "$(adb get-state 2>/dev/null | tr -d '\r')" == device ]]
}

# Fills E2E_TESTS with "package.Class#method" for every @Test, in file order.
e2e_discover_tests() {
  local file class method
  E2E_TESTS=()
  for file in "${TEST_FILES[@]}"; do
    grep -qE '^[[:space:]]*@Test' "$file" || continue
    class="$(kotlin_test_class "$file")"
    while IFS= read -r method; do
      [[ -n "$method" ]] && E2E_TESTS+=("$class#$method")
    done < <(tr -d '\r' < "$file" | awk '
      /^[[:space:]]*@Test/ { pending = 1; next }
      pending && match($0, /fun[[:space:]]+[A-Za-z0-9_]+/) {
        name = substr($0, RSTART, RLENGTH); sub(/^fun[[:space:]]+/, "", name); print name; pending = 0
      }')
  done
}

# Reads one test's `am instrument` output. The "blocked" message is checked first, so a blocked test is
# never counted as failed; a test without a final result line is reported as a crash, never as FAIL.
e2e_classify() {
  local output="$1"
  if [[ "$output" == *"$E2E_SEED_BLOCKED"* ]]; then
    echo "BLOCKED"
  elif [[ "$output" == *"Process crashed"* ]]; then
    echo "$E2E_CRASHED"
  elif [[ "$output" != *"INSTRUMENTATION_CODE:"* ]]; then
    echo "$E2E_NO_RESULT"
  elif [[ "$output" == *"OK (1 test)"* ]]; then
    echo "PASS"
  elif [[ "$output" == *"FAILURES!!!"* ]]; then
    echo "FAIL"
  else
    echo "$E2E_NO_RESULT"
  fi
}

# Runs one test in its own instrumentation process; sets E2E_RESULT and appends the output to the log.
# adb's own error messages are kept in the log, so a lost device shows up there.
e2e_run_one() {
  local test="$1" output
  if ! e2e_device_connected; then
    printf '\n===== %s =====\n(not run: %s is not connected)\n' "$test" "$ANDROID_SERIAL" >>"$E2E_LOG"
    E2E_RESULT="$E2E_NOT_RUN"
    return 0
  fi
  output="$(adb shell am instrument -w -r -e class "$test" "$APP_ID.test/$E2E_RUNNER" 2>&1 | tr -d '\r' || true)"
  printf '\n===== %s =====\n%s\n' "$test" "$output" >>"$E2E_LOG"
  E2E_RESULT="$(e2e_classify "$output")"
}

e2e_write_summary() {
  local i pass=0 failed=0 crashed=0 blocked=0 not_run=0
  for i in "${!E2E_RESULTS[@]}"; do
    case "${E2E_RESULTS[$i]}" in
      PASS) pass=$((pass + 1)) ;;
      BLOCKED) blocked=$((blocked + 1)) ;;
      FAIL) failed=$((failed + 1)) ;;
      "$E2E_NOT_RUN") not_run=$((not_run + 1)) ;;
      *) crashed=$((crashed + 1)) ;;
    esac
  done
  {
    echo
    echo "Frontend E2E test results ($(date '+%Y-%m-%d %H:%M:%S'))"
    echo
    echo "| # | Test | Result |"
    echo "| --- | --- | --- |"
    for i in "${!E2E_TESTS[@]}"; do
      echo "| $((i + 1)) | \`${E2E_TESTS[$i]}\` | ${E2E_RESULTS[$i]} |"
    done
    echo
    echo "Passed: $pass, failed: $failed, crashed: $crashed, blocked: $blocked, not run: $not_run, total: ${#E2E_TESTS[@]}"
    if (( crashed > 0 || not_run > 0 )); then
      echo
      echo "$E2E_CRASHED: the app's process, which also runs the test, died. Often an app crash: see 'adb logcat -b crash'."
      echo "$E2E_NO_RESULT: the test gave no final result (its output stopped early or was empty), usually because adb lost the device. Any adb error is in the log."
      echo "$E2E_NOT_RUN: the device was not connected when the test was due to start."
    fi
  } | tee -a "$E2E_LOG"
  E2E_ALL_PASSED=no
  if (( pass == ${#E2E_TESTS[@]} )); then E2E_ALL_PASSED=yes; fi
}

run_e2e_tests() {
  local i total
  resolve_test_root
  discover_test_files e2e
  e2e_discover_tests
  total="${#E2E_TESTS[@]}"
  if (( total == 0 )); then
    warn "Skipping frontend E2E tests: no @Test methods in app/src/androidTest/e2e/."
    exit 0
  fi

  APP_ID="$(application_id)"
  [[ -n "$APP_ID" ]] || die "Could not resolve applicationId from $APP_BUILD."
  configure_android_home
  command -v adb >/dev/null 2>&1 || die "adb not found."
  command -v curl >/dev/null 2>&1 || die "curl not found."

  BACKEND_URL="$(e2e_backend_url)"
  e2e_parse_url "$BACKEND_URL"
  e2e_select_device
  e2e_check_device_can_reach_backend
  e2e_prepare_backend
  e2e_install
  e2e_wait_for_sign_in

  trap e2e_restore_device_state EXIT
  trap 'exit 130' INT TERM
  e2e_prepare_device

  mkdir -p "$FRONTEND_DIR/app/build/e2e-logs"
  E2E_LOG="$FRONTEND_DIR/app/build/e2e-logs/e2e-$(date '+%Y%m%d-%H%M%S').log"
  printf 'Frontend E2E run: device %s, backend %s\n' "$ANDROID_SERIAL" "$BACKEND_URL" >"$E2E_LOG"

  E2E_RESULTS=()
  for i in "${!E2E_TESTS[@]}"; do
    info "[$((i + 1))/$total] ${E2E_TESTS[$i]} ..."
    e2e_run_one "${E2E_TESTS[$i]}"
    E2E_RESULTS+=("$E2E_RESULT")
    info "[$((i + 1))/$total] ${E2E_TESTS[$i]}: $E2E_RESULT"
  done

  e2e_write_summary
  info "Full log: $E2E_LOG"
  if [[ "$E2E_ALL_PASSED" != yes ]]; then
    die "Some frontend E2E tests did not pass (see the summary above)."
  fi
  info "All frontend E2E tests passed."
}
