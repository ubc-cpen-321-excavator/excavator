# Testing

## 1. Change History

| **Change Date**   | **Modified Sections** | **Rationale** |
| ----------------- | --------------------- | ------------- |
| 2026-10-31 | 2.1, 2.2, 2.5 | Listed every backend interface's test groups, how to run them, and the CI workflow. |
| 2026-10-31 | 3 | Added the two non-functional requirement tests and how they verify the requirements. |
| 2026-11-18 | 4 | Added the front-end end-to-end tests for Add a Gem, Comment on a Gem and Manage Favorite Gems: location, prerequisites, how to run them, test data, omitted scenarios, known app bugs, and one scenario-to-test-step table per test. |

---

## 2. Back-end Test Specification: APIs

### 2.1. Locations of Back-end Tests and Instructions to Run Them

#### 2.1.1. Tests

Every interface has one `describe` group without mocks (real app, real in-memory MongoDB) and one with mocks (database, Google and the login check's user lookup replaced to force errors and edge cases). Each test is annotated with its input, expected status code, expected behavior, expected output and, for mocked tests, what the mock does. Unit tests of the services and of the GemScore and distance calculations are in `backend/tests/unit/`.

The no-mock tests that call the real Google Places API (marked "with Google Places") run only when `GOOGLE_API_KEY` is set; without it they are skipped, and the same behavior is covered with Google mocked.

| **Interface** | **Describe Group Location, No Mocks** | **Describe Group Location, With Mocks** | **Mocked Components** |
| --- | --- | --- | --- |
| **GET /gem** | [`tests/no-mock/gem.test.ts#L24`](../backend/tests/no-mock/gem.test.ts#L24) | [`tests/mock/gem.test.ts#L59`](../backend/tests/mock/gem.test.ts#L59) | Gems DB |
| **POST /gem** | [`tests/no-mock/gem.test.ts#L67`](../backend/tests/no-mock/gem.test.ts#L67), [`tests/no-mock/gem.test.ts#L119`](../backend/tests/no-mock/gem.test.ts#L119) | [`tests/mock/gem.test.ts#L187`](../backend/tests/mock/gem.test.ts#L187), [`tests/mock/gem.test.ts#L303`](../backend/tests/mock/gem.test.ts#L303), [`tests/mock/gem.test.ts#L341`](../backend/tests/mock/gem.test.ts#L341) | Gems DB, Users DB (login check), Google Places API |
| **GET /gem/nearby** | [`tests/no-mock/gem.test.ts#L161`](../backend/tests/no-mock/gem.test.ts#L161) | [`tests/mock/gem.test.ts#L402`](../backend/tests/mock/gem.test.ts#L402) | Gems DB |
| **GET /gem/within** | [`tests/no-mock/gem.test.ts#L218`](../backend/tests/no-mock/gem.test.ts#L218) | [`tests/mock/gem.test.ts#L474`](../backend/tests/mock/gem.test.ts#L474) | Gems DB |
| **GET /gem/newest** | [`tests/no-mock/gem.test.ts#L261`](../backend/tests/no-mock/gem.test.ts#L261) | [`tests/mock/gem.test.ts#L527`](../backend/tests/mock/gem.test.ts#L527) | Gems DB |
| **GET /gem/:pk/comments** | [`tests/no-mock/comment.test.ts#L68`](../backend/tests/no-mock/comment.test.ts#L68) | [`tests/mock/comment.test.ts#L51`](../backend/tests/mock/comment.test.ts#L51) | Comments DB, Gems DB |
| **POST /gem/:pk/comments** | [`tests/no-mock/comment.test.ts#L17`](../backend/tests/no-mock/comment.test.ts#L17) | [`tests/mock/comment.test.ts#L150`](../backend/tests/mock/comment.test.ts#L150) | Comments DB, Gems DB, Users DB (login check) |
| **PUT /gem/:pk/rating** | [`tests/no-mock/rating.test.ts#L20`](../backend/tests/no-mock/rating.test.ts#L20) | [`tests/mock/rating.test.ts#L55`](../backend/tests/mock/rating.test.ts#L55) | Ratings DB, Gems DB, Users DB (login check), Live Feed |
| **GET /gem/:pk/rating** | [`tests/no-mock/rating.test.ts#L81`](../backend/tests/no-mock/rating.test.ts#L81) | [`tests/mock/rating.test.ts#L161`](../backend/tests/mock/rating.test.ts#L161) | Ratings DB, Gems DB, Users DB (login check) |
| **GET /place/nearby** | [`tests/no-mock/place.test.ts#L11`](../backend/tests/no-mock/place.test.ts#L11), [`tests/no-mock/place.test.ts#L34`](../backend/tests/no-mock/place.test.ts#L34) | [`tests/mock/place.test.ts#L40`](../backend/tests/mock/place.test.ts#L40) | Google Places API, Gems DB |
| **POST /user/auth/google** | [`tests/no-mock/auth.test.ts#L15`](../backend/tests/no-mock/auth.test.ts#L15) | [`tests/mock/auth.test.ts#L35`](../backend/tests/mock/auth.test.ts#L35) | Google Sign-In, Users DB |
| **Login check (`reqJwt`, all routes requiring login)** | [`tests/no-mock/auth.test.ts#L47`](../backend/tests/no-mock/auth.test.ts#L47) | [`tests/mock/auth.test.ts#L119`](../backend/tests/mock/auth.test.ts#L119) | Users DB |
| **GET /user/me** | [`tests/no-mock/profile.test.ts#L16`](../backend/tests/no-mock/profile.test.ts#L16) | [`tests/mock/auth.test.ts#L119`](../backend/tests/mock/auth.test.ts#L119) | Users DB |
| **PATCH /user/me** | [`tests/no-mock/profile.test.ts#L39`](../backend/tests/no-mock/profile.test.ts#L39) | [`tests/mock/auth.test.ts#L146`](../backend/tests/mock/auth.test.ts#L146) | Users DB |
| **GET /user/favorites** | [`tests/no-mock/favorite.test.ts#L75`](../backend/tests/no-mock/favorite.test.ts#L75) | [`tests/mock/favorite.test.ts#L49`](../backend/tests/mock/favorite.test.ts#L49) | Favorites DB, Gems DB, Users DB (login check) |
| **POST /user/favorites** | [`tests/no-mock/favorite.test.ts#L25`](../backend/tests/no-mock/favorite.test.ts#L25) | [`tests/mock/favorite.test.ts#L109`](../backend/tests/mock/favorite.test.ts#L109) | Favorites DB, Gems DB, Users DB (login check) |
| **DELETE /user/favorites/:placeId** | [`tests/no-mock/favorite.test.ts#L108`](../backend/tests/no-mock/favorite.test.ts#L108) | [`tests/mock/favorite.test.ts#L206`](../backend/tests/mock/favorite.test.ts#L206) | Favorites DB, Users DB (login check) |
| **WebSocket /feed** | [`tests/no-mock/feed.test.ts#L40`](../backend/tests/no-mock/feed.test.ts#L40) | [`tests/mock/feed.test.ts#L73`](../backend/tests/mock/feed.test.ts#L73) | Gems DB, Users DB, Google Places API (gems are added through POST /gem) |

#### 2.1.2. Commit Hash Where Tests Run

`[Insert Commit SHA here]`

#### 2.1.3. Explanation on How to Run the Tests

1. **Clone the repository and install the backend's dependencies** (Node.js 22):
   ```
   git clone https://github.com/ubc-cpen-321-excavator/excavator.git
   cd excavator/backend
   npm install
   ```
2. **Run the interface tests** (with mocks, without mocks, then both together, each with a coverage report in `backend/coverage/`):
   ```
   cd ..
   ./scripts/run-backend-interface-tests.sh
   ```
   Or all backend tests at once from `backend/`: `npm test`. The tests need no `.env` file and no running database: the no-mock tests start their own MongoDB in memory (downloaded once on the first run, which takes about a minute) and use a test JWT secret.
3. **Optional, to include the tests that call the real Google Places API:** set `GOOGLE_API_KEY` to a key with Places API (New) enabled, e.g. `GOOGLE_API_KEY=... npm test`.

### 2.2. GitHub Actions Configuration Location

`.github/workflows/backend-tests.yml` — runs the typecheck, the interface tests (mock, no-mock, combined, with coverage), the non-functional requirement tests and the unit tests on every push to `main` and on pull requests into `main` and `develop`. The coverage reports are kept as a downloadable artifact of each run.

### 2.3. Jest Coverage Report Screenshots With Mocks

Screenshot of the coverage report with mocks enabled: to be added.

### 2.4. Jest Coverage Report Screenshots Without Mocks

Screenshot of the coverage report without mocks: to be added.

### 2.5. Jest Coverage Report Screenshots With and Without Mocks Combined

Screenshot of the combined coverage report: to be added.

---

## 3. Tests of Non-Functional Requirements

### 3.1. Test Locations in Git

| **Non-Functional Requirement** | **Location in Git** |
| --- | --- |
| **Live updates arrive within 1 second** | [`backend/tests/nfr/feedLatency.test.ts`](../backend/tests/nfr/feedLatency.test.ts) |
| **The map stays fast with many gems** | [`backend/tests/nfr/mapQueryTime.test.ts`](../backend/tests/nfr/mapQueryTime.test.ts) |

Run them with `./scripts/run-backend-nfr-tests.sh`, or `npm test -- tests/nfr/` from `backend/`. Like the no-mock tests, they start their own in-memory MongoDB.

### 3.2. Test Verification and Logs

- **Live updates arrive within 1 second**

  - **Verification:** The test starts the real server with its real WebSocket feed and a real in-memory MongoDB, then connects 250 WebSocket clients: 200 subscribed 5 km around UBC and 50 around Toronto. It adds a gem at UBC through `POST /gem` (signed in, as the app does) and records when each client receives it, measured from the moment the request is sent; it then rates the gem through `PUT /gem/:pk/rating` and measures the `gem.updated` messages the same way. The requirement is met when all 200 UBC clients receive each update, the slowest within 1000 ms, the update carries the new data (the rescored gem), and none of the Toronto clients receive anything. Only Google Places is mocked, since its response time is Google's rather than ours. The test logs the median and maximum latency of each run.
  - **Log Output**
    ```
    $ npx jest tests/nfr   (2026-10-31, MacBook Air, Node 22)
     PASS  tests/nfr/feedLatency.test.ts
      [NFR1] gem.added: 200 clients, median 27 ms, max 28 ms (limit 1000 ms)
      [NFR1] gem.updated: 200 clients, median 17 ms, max 18 ms (limit 1000 ms)
    ```
    Every one of the 200 nearby clients received both updates, the slowest within 28 ms, and none of the 50 far-away clients received anything, so the requirement is met with a wide margin.

- **The map stays fast with many gems**
  - **Verification:** The test stores 10,000 gems spread over Metro Vancouver (generated from a fixed seed, so every run uses the same data) in a real in-memory MongoDB with the app's indexes, then times 50 requests to `GET /gem/within`, over map areas from neighbourhood size (about 1 km) to city size (about 20 km), and 50 requests to `GET /gem/nearby` with a 5 km radius at random points, all with the app's maximum page size of 50. Each request goes through the full app (routing, validation, query, JSON). The requirement is met when the 95th-percentile response time of each query type is under 500 ms; nothing is mocked. The test logs the median, 95th-percentile and maximum response times.
  - **Log Output**
    ```
    $ npx jest tests/nfr   (2026-10-31, MacBook Air, Node 22)
     PASS  tests/nfr/mapQueryTime.test.ts
      [NFR2] GET /gem/within: 50 requests on 10000 Gems, median 3.4 ms, p95 6.0 ms, max 17.3 ms (limit p95 500 ms)
      [NFR2] GET /gem/nearby: 50 requests on 10000 Gems, median 2.1 ms, p95 3.1 ms, max 3.2 ms (limit p95 500 ms)
    ```
    Both query types answer far under the 500 ms limit at the 95th percentile, so the requirement is met with a wide margin.

---

## 4. Front-end Test Specification

### 4.1. Location in Git of Front-end Test Suite:

`frontend/app/src/androidTest/e2e/` (package `e2e`; Gradle compiles this folder through `sourceSets` in `frontend/app/build.gradle.kts`).

| **File** | **Contents** |
| --- | --- |
| `AddGemE2ETest.kt` | Use case 2: Add a Gem (6 tests) |
| `CommentOnGemE2ETest.kt` | Use case 4: Comment on a Gem (5 tests) |
| `ManageFavoritesE2ETest.kt` | Use case 5: Manage Favorite Gems (4 tests) |
| `E2ETestBase.kt` | Setup shared by every test: checks that a user is signed in, sets the device's location, starts a mock location |
| `AppDriver.kt` | UI actions: the Jetpack Compose testing APIs for the app's screens, UI Automator for Google Maps markers and system dialogs |
| `TestData.kt`, `BackendClient.kt`, `ApiModels.kt` | Create and clean up test data through the backend's authenticated API, as the signed-in user |
| `DeviceControl.kt`, `MockLocation.kt`, `E2EConfig.kt`, `GeoPoint.kt` | Device settings, mock location, fixed test values |

The tests talk to the real backend (nothing is mocked) and never sign in: each one starts on the main screen (the Dashboard) as the user who is already signed in on the device. Each test runs in its own app process (one `am instrument` call per test) and creates the data it needs, so the tests do not depend on each other.

#### 4.1.1. Commit Hash Where Tests Run

`[Insert Commit SHA on main here]`

#### 4.1.2. Prerequisites

1. **A device:** an Android phone with USB debugging on, or an emulator, listed by `adb devices`, with Google Play services. If several are connected, choose one with `ANDROID_SERIAL=<serial>`.
2. **The right computer:** run the tests on the computer whose debug key Google Sign-In trusts (its debug keystore's SHA-1 is registered with the app's OAuth client). The script builds and installs both the app and the test APK on that computer, so both are signed with the same key, which Android requires. On another computer, Google Sign-In fails.
3. **Configuration:** `frontend/local.properties` (`sdk.dir`, `API_BASE_URL`, `GOOGLE_CLIENT_ID`) and the Maps key in `frontend/secrets.properties`, as for `scripts/run-frontend.*`.
4. **A reachable backend:** the app uses the backend in `API_BASE_URL`, fixed when the app is built.
   - If it is `10.0.2.2`, `localhost` or `127.0.0.1`, the script starts the local backend with `scripts/run-backend.*` (needs Docker and `backend/.env`). `10.0.2.2` is only reachable from an emulator.
   - Otherwise (for example the deployed server), the script only checks that `GET /health` answers.
   - `E2E_START_BACKEND=yes` starts the local backend anyway (for example when `API_BASE_URL` is this computer's network address, for a phone); `E2E_START_BACKEND=no` never starts it.
   - The tests add data to that backend; see 4.1.4.
5. **Signed in on that device:** the script opens the app and waits until a user has signed in (300 seconds by default; change it with `E2E_SIGNIN_TIMEOUT`). If the app is already signed in, it continues straight away.
6. **Only for Use case 5, step 4a:** the backend must provide the data-population endpoint `POST /e2e/seed/favorites` (enabled with `E2E_SEED_ENABLED=true` in the backend's environment). Without it, that test reports `BLOCKED`.

#### 4.1.3. How to Run the Tests

From the repository root:

```
./scripts/run-frontend-e2e-tests.sh       # macOS, Linux or Git Bash
.\scripts\run-frontend-e2e-tests.ps1      # Windows PowerShell
```

Both scripts do the same:

1. Read `API_BASE_URL`, then start or check the backend (prerequisite 4).
2. Pick the device, then build and install the app and the test APK on it (`gradlew installDebug installDebugAndroidTest`). The app is updated in place: the script never uninstalls it, never runs `pm clear` and never clears its data, so the sign-in is kept.
3. Open the app and wait for a user to sign in (prerequisite 5).
4. Grant the app location permission, turn the device's location on, and let the app use mock locations. Debug builds declare `ACCESS_MOCK_LOCATION` for this, in `frontend/app/src/debug/AndroidManifest.xml`; release builds do not.
5. Run each test in its own call: `adb shell am instrument -w -r -e class e2e.<Class>#<method> com.example.cpen321application.test/androidx.test.runner.AndroidJUnitRunner`. Just before `AddGemE2ETest#scenario2a_locationPermissionDenied` it revokes the app's location permission, and it grants it back afterwards, even if the test fails or the run is interrupted.
6. Print a pass/fail table to paste into 4.2, save the full log as `frontend/app/build/e2e-logs/e2e-<date>-<time>.log`, and exit with a non-zero status unless every test passed. Each result is `PASS`, `FAIL`, `FAIL (app crashed)` or `BLOCKED` (Use case 5, step 4a, without the seed endpoint).

To rerun a single test after the script has installed the app, use the `am instrument` command from step 5 with that test's name. `AddGemE2ETest#scenario2a_locationPermissionDenied` also needs `adb shell pm revoke com.example.cpen321application android.permission.ACCESS_FINE_LOCATION` and the same for `android.permission.ACCESS_COARSE_LOCATION` first.

#### 4.1.4. Test Data and Data Left Behind

Each test creates the data it needs, either through the app's screens or through the backend's public, authenticated API, using the session of the user signed in on the device. Nothing writes to the database directly. The checks only look at data the test created, never at totals across the backend.

- **Location:** the tests set the device's location with a mock location, to one of five spots in downtown Vancouver (below) or, for Use case 2 step 7a, to open water with no places nearby.
- **Shared gem:** most Comment and Favorites tests reuse one gem, the signed-in account's own gem nearest to test area 1. It is added on the first run and reused afterwards.
- **Favorites:** before each Favorites test, the account's favorites are saved to a file on the device; afterwards they are put back exactly (extra ones removed, missing ones re-added in the same order). If a test crashes, the next Favorites test puts them back first.

Gems and comments cannot be deleted through the API, so the following stay in the backend. "The account" is the Google account signed in on the device when the tests run (for example a TA's account).

| **Data left behind** | **Created by** | **Added by** | **Where** | **How many** |
| --- | --- | --- | --- | --- |
| Shared gem | the first Comment or Favorites test run | the account | within 200 m of test area 1 | one per account, reused |
| A known gem for the map | `AddGemE2ETest#mainSuccessScenario` (step 2 checks its marker) | the account | within 200 m of the test area used (the shared gem in area 1) | at most one per account and area, reused |
| A new gem with no comments | `CommentOnGemE2ETest#scenario2a_noCommentsYet` | the account | within 200 m of the first test area with a place that is not a gem yet | one per run |
| The gem added through the app | `AddGemE2ETest#mainSuccessScenario` (only once the app can add gems) | the account | within 200 m of the test area used | one per run |
| The gem added for "another user" | `AddGemE2ETest#scenario9a_placeBecameGemMeanwhile` | the account | within 200 m of the test area used | one per run |
| Comments starting with "E2E test comment" | `CommentOnGemE2ETest#mainSuccessScenario` | the account | on the shared gem | two per run |
| Seed gems `places/e2e-seed-001` to `places/e2e-seed-500` | the data-population script for Use case 5 step 4a, once it exists | none (shared by all accounts) | one remote point chosen by the script | 500 in total, reused |
| Favorites | none | none | none | none: put back after every test |

Test areas (latitude, longitude): 1: 49.2820, -123.1207; 2: 49.2849, -123.1166; 3: 49.2790, -123.1240; 4: 49.2862, -123.1300; 5: 49.2765, -123.1185. Open water for Use case 2 step 7a: 49.2000, -123.6000. A test area is only used once the areas before it have no place left that is not a gem yet. On the device, the app is left with location permission granted, the device's location on, and mock locations allowed for the app.

#### 4.1.5. Scenarios Not Tested

Only scenarios that would need a mocked backend or a forced network failure are left out, as the course's "Add Todo Items" example does for its step 5b.

| **Use Case** | **Scenario** | **Why It Is Not Tested** |
| --- | --- | --- |
| 2. Add a Gem | 7b. Google Places is unavailable. | Google Places can only be made to fail by mocking it. |
| 2. Add a Gem | 9c. The Excavator server cannot be reached. | Needs a forced network failure or a mocked backend. |
| 4. Comment on a Gem | 5a. The Excavator server cannot be reached. | Needs a forced network failure or a mocked backend. |
| 5. Manage Favorite Gems | 4b. The Excavator server cannot be reached. | Needs a forced network failure or a mocked backend. |
| 5. Manage Favorite Gems | 8a. The Excavator server cannot be reached. | Needs a forced network failure or a mocked backend. |

Use case 1 (Sign In with Google) and Use case 3 (Rate a Gem) are not among the three features tested. Scenarios the app does not implement yet are not left out: they are tested, fail for now, and are listed in 4.1.6.

#### 4.1.6. Known App Bugs That Make Tests Fail

Expected from the current code; the logs in 4.2 hold the actual results.

| **Test** | **Expected Result** | **Cause in the App** |
| --- | --- | --- |
| `AddGemE2ETest#mainSuccessScenario` | Fails at step 7 | The list of places is never requested (`GemViewModel.getGemCandidates()` is never called, and the app calls `/places/nearby` while the backend serves `/place/nearby`). Selected filters are lost (`GemCreationSheet`, `NewGemFiltersForm`). The add request misspells `latitude` and sends the place's location instead of the user's (`GemAPIService`, `NearbyGemsOptionsList`). |
| `AddGemE2ETest#scenario2a_locationPermissionDenied` | Fails at step 1 | The location prompts appear on the Dashboard as soon as the app opens (`LocationChecker` in `DashboardActivity`), not on Discovery as the use case says. Needs an app fix or a change to the use case. |
| `AddGemE2ETest#scenario2b_locationTurnedOff` | Fails at step 1 | Same as above, for the "Location is turned off" dialog. |
| `AddGemE2ETest#scenario7a_noPlacesNearby` | Fails at 7a1 | The message reads "No gem candididates found! Check back later" (`NearbyGemsOptionsList`). |
| `AddGemE2ETest#scenario9a_placeBecameGemMeanwhile` | Fails at step 7 | The list of places never loads (see the main scenario). There is no "This place is already a gem." message, and the backend's 409 response crashes the app (`GemViewModel.handleError`). |
| `AddGemE2ETest#scenario9b_userMovedAway` | Fails at step 7 | The list of places never loads. The app sends the place's location instead of the user's, so the backend cannot tell the user moved; there is no message, and a 422 response would crash the app. |
| `CommentOnGemE2ETest#scenario4a_emptyOrSpacesOnly` | Fails at 4a1 | "Send Comment" is never disabled (`NewCommentInput`); sending a blank comment gets a 400 response, which crashes the app (`CommentViewModel.handleError`). |
| `ManageFavoritesE2ETest#mainSuccessScenario` | Fails at step 4 | `POST /user/favorites` returns `{ gem }`, but the app reads it as a full gem and crashes (`GemRepositoryImpl.addFavoriteGem`). Removing a favorite also leaves its card on screen (step 8, `GemViewModel.deleteFavoriteGem`). |
| `ManageFavoritesE2ETest#scenario3a_tapGoldStar` | Fails at step 2 | The star always starts grey, whatever the server says (`FavoriteButton`); tapping a gold star adds the favorite again instead of removing it (`DiscoveryMap`). |
| `ManageFavoritesE2ETest#scenario4a_atFavoritesLimit` | Blocked, then fails at 4a1 | Waiting for the data-population script. After that: there is no "You can have at most 500 favorites." message, and the backend's 409 response crashes the app. |
| `ManageFavoritesE2ETest#scenario6a_noFavorites` | Fails at 6a1 | There is no "No favorites yet!" text (`FavoritesScreen`). |
| The other four Comment tests | Pass | |

### 4.2. Tests

Summary of the run (printed by `run-frontend-e2e-tests`):

```
[Placeholder: paste the summary table printed by the run script]
```

- **Use Case 2: Add a Gem, main success scenario** (`AddGemE2ETest#mainSuccessScenario`)

  - **Expected Behaviors:**

    | **Scenario Steps** | **Test Case Steps** |
    | --- | --- |
    | 1. The user opens the Discovery screen from the navigation bar. | Set the mock location to the first test area that has a restaurant that is not a gem yet.<br>Find the account's gem near it, or add one through `POST /gem` if there is none.<br>Open the app on the Dashboard.<br>Click the navigation-bar item labelled "Discovery". |
    | 2. The app shows a map centred on the user's location, with markers for the gems around them, and an "Add gem" button. | Check that a button labelled "Add gem" is present on screen.<br>Check (UI Automator) that a map marker with the known gem's name is present. |
    | 3. The user taps "Add gem". | Click the button labelled "Add gem". |
    | 4. The app shows the "Add New Gem" sheet with a "Filters" button and a "Submit" button. | Check that the text "Add New Gem" is present on screen.<br>Check that a button whose label contains "Filters" is present on screen.<br>Check that a button labelled "Submit" is present on screen. |
    | 5. The user optionally taps "Filters" and selects the types of place they want to add. | Click "Filters".<br>Click the category "Food".<br>Click the chip "Restaurant".<br>Check that the "Restaurant" chip is selected. |
    | 6. The user taps "Submit". | Click "Submit". |
    | 7. The app shows a list of the places within 200 m of the user that are not gems yet, nearest first, limited to the selected types. | Get the nearest restaurant within 200 m that is not a gem yet (`GET /place/nearby?type=restaurant`).<br>Check that the list of places is present on screen and that its first card shows that restaurant's name. |
    | 8. The user taps a place in the list. | Click the card with that name. |
    | 9. The app adds the place as a gem and closes the sheet. The new gem appears as a marker on the map and at the top of the Dashboard's latest gems, and is pushed to other users near it. | Check that "Add New Gem" is no longer on screen.<br>Check (UI Automator) that a map marker with the place's name is present.<br>Click "Dashboard".<br>Check that the first card under "Latest Gems:" shows the place's name.<br>"Pushed to other users": checked by User B, below. |

  - **Manual steps for User B** (step 9, the new gem is pushed to other users near it):
    1. On a second device, sign in to Excavator with a different Google account and stay on the Dashboard. The device's location (real or mock) must be within 5 km of the test area User A's test uses (test area 1 unless the log shows another).
    2. Run User A's test.
    3. When User A's test reaches step 9, check that the new gem appears at the top of "Latest Gems:" on User B's Dashboard within a few seconds, without refreshing.

  - **Test Logs:**
    ```
    [Placeholder: this test's section of frontend/app/build/e2e-logs/e2e-<date>-<time>.log]
    ```

- **Use Case 2: Add a Gem, failure scenario 2a** (`AddGemE2ETest#scenario2a_locationPermissionDenied`)

  - **Expected Behaviors:**

    | **Scenario Steps** | **Test Case Steps** |
    | --- | --- |
    | 1. The user opens the Discovery screen from the navigation bar. | Check that the app's location permission is not granted (the run script revokes it just before this test).<br>Open the app on the Dashboard.<br>Check (UI Automator) that no other app's window is covering the app.<br>Click "Discovery". |
    | 2a. The user has denied the app access to their location. | In the system's location-permission prompt, click "Don't allow" (UI Automator). |
    | 2a1. The app shows a dialog explaining that Excavator needs their location, with a button to try again. | Check that a dialog with text mentioning "location" is present on screen.<br>Check that the dialog has a button labelled "Try again". |
    | 2a2. If the user taps the button, the app asks for location access again and continues from step 2 once it is granted. | Click "Try again".<br>In the system's location-permission prompt, click "While using the app" (UI Automator).<br>Check that the button labelled "Add gem" is present on screen (step 2). |

  - **Test Logs:**
    ```
    [Placeholder: this test's section of the run log]
    ```

- **Use Case 2: Add a Gem, failure scenario 2b** (`AddGemE2ETest#scenario2b_locationTurnedOff`)

  - **Expected Behaviors:**

    | **Scenario Steps** | **Test Case Steps** |
    | --- | --- |
    | 2b. The device's location is turned off. | Before step 1, turn the device's location off (`cmd location set-location-enabled false`). |
    | 1. The user opens the Discovery screen from the navigation bar. | Open the app on the Dashboard.<br>Check (UI Automator) that no other app's window is covering the app.<br>Click "Discovery". |
    | 2b1. The app shows the dialog "Location is turned off" with a "Turn on location" button. | Check that the text "Location is turned off" is present on screen.<br>Check that a button labelled "Turn on location" is present on screen. |
    | 2b2. If the user taps "Turn on location" and turns it on, the app continues from step 2. | Click "Turn on location".<br>In the system's prompt to turn on location, click "Turn on" (UI Automator).<br>Check that the button labelled "Add gem" is present on screen (step 2).<br>Check that the device's location is on. |

  - **Test Logs:**
    ```
    [Placeholder: this test's section of the run log]
    ```

- **Use Case 2: Add a Gem, failure scenario 7a** (`AddGemE2ETest#scenario7a_noPlacesNearby`)

  - **Expected Behaviors:**

    | **Scenario Steps** | **Test Case Steps** |
    | --- | --- |
    | 1. The user opens the Discovery screen from the navigation bar. | Check that there is no place within 200 m of the open-water point that is not a gem yet (`GET /place/nearby`).<br>Set the mock location to that point.<br>Open the app on the Dashboard.<br>Click "Discovery". |
    | 2. The app shows a map with an "Add gem" button. | Check that a button labelled "Add gem" is present on screen. |
    | 3. The user taps "Add gem". | Click "Add gem". |
    | 4. The app shows the "Add New Gem" sheet with a "Submit" button. | Check that a button labelled "Submit" is present on screen. |
    | 5. The user optionally selects types of place. | No filter is chosen. |
    | 6. The user taps "Submit". | Click "Submit". |
    | 7a. There are no places within 200 m that are not gems yet. | Ensured by the check in step 1. |
    | 7a1. The app shows the message "No gem candidates found! Check back later" with an "Ok" button. | Check that the text "No gem candidates found! Check back later" is present on screen.<br>Check that a button labelled "Ok" is present on screen. |
    | 7a2. The user taps "Ok" and the app closes the sheet. | Click "Ok".<br>Check that "Add New Gem" is no longer on screen. |

  - **Test Logs:**
    ```
    [Placeholder: this test's section of the run log]
    ```

- **Use Case 2: Add a Gem, failure scenario 9a** (`AddGemE2ETest#scenario9a_placeBecameGemMeanwhile`)

  - **Expected Behaviors:**

    | **Scenario Steps** | **Test Case Steps** |
    | --- | --- |
    | 1. The user opens the Discovery screen from the navigation bar. | Set the mock location to the first test area with a restaurant that is not a gem yet.<br>Open the app on the Dashboard.<br>Click "Discovery". |
    | 2. The app shows a map with an "Add gem" button. | Check that a button labelled "Add gem" is present on screen. |
    | 3. The user taps "Add gem". | Click "Add gem". |
    | 4. The app shows the "Add New Gem" sheet with a "Submit" button. | Check that a button labelled "Submit" is present on screen. |
    | 5. The user optionally selects types of place. | No filter is chosen. |
    | 6. The user taps "Submit". | Click "Submit". |
    | 7. The app shows the list of places within 200 m that are not gems yet. | Check that the list of places is present on screen.<br>Note the name on its first card. |
    | 9a. Another user added the same place as a gem after the list was shown. | Add that place as a gem through `POST /gem` with the test account, standing in for User B (see the manual steps below). |
    | 8. The user taps a place in the list. | Click the card with that name. |
    | 9a1. The app shows the message "This place is already a gem." | Check that the text "This place is already a gem." is present on screen. |
    | 9a2. The app reloads the list without that place. | Check that the list of places is present on screen.<br>Check that no card with that name is on screen. |

  - **Manual steps for User B** (to check the two-user version of 9a by hand):
    1. User A (the device under test) opens Discovery, taps "Add gem", then "Submit", and leaves the list of places open.
    2. User B, signed in with a different Google account on a second device, with its location within 200 m of the same place, taps "Add gem", "Submit", and then the place at the top of User A's list, which adds it as a gem.
    3. User A taps that place.
    4. Check that User A sees "This place is already a gem." and that the place disappears from User A's list.

  - **Test Logs:**
    ```
    [Placeholder: this test's section of the run log]
    ```

- **Use Case 2: Add a Gem, failure scenario 9b** (`AddGemE2ETest#scenario9b_userMovedAway`)

  - **Expected Behaviors:**

    | **Scenario Steps** | **Test Case Steps** |
    | --- | --- |
    | 1. The user opens the Discovery screen from the navigation bar. | Set the mock location to the first test area with a restaurant that is not a gem yet.<br>Open the app on the Dashboard.<br>Click "Discovery". |
    | 2. The app shows a map with an "Add gem" button. | Check that a button labelled "Add gem" is present on screen. |
    | 3. The user taps "Add gem". | Click "Add gem". |
    | 4. The app shows the "Add New Gem" sheet with a "Submit" button. | Check that a button labelled "Submit" is present on screen. |
    | 5. The user optionally selects types of place. | No filter is chosen. |
    | 6. The user taps "Submit". | Click "Submit". |
    | 7. The app shows the list of places within 200 m that are not gems yet. | Check that the list of places is present on screen.<br>Note the name on its first card. |
    | 9b. The user has moved more than 200 m away from the place. | Move the mock location 500 m north.<br>Wait 12 seconds (the app reads the location every 10 seconds). |
    | 8. The user taps a place in the list. | Click the card with the noted name. |
    | 9b1. The app shows the message "You must be within 200 m of a place to add it." | Check that the text "You must be within 200 m of a place to add it." is present on screen. |
    | 9b2. The app reloads the list for the user's new location. | Get the nearest place within 200 m of the new location that is not a gem yet (`GET /place/nearby`).<br>Check that the first card of the list shows that place's name, or, if there is none, that the text "No gem candidates found! Check back later" is present on screen. |

  - **Test Logs:**
    ```
    [Placeholder: this test's section of the run log]
    ```

- **Use Case 4: Comment on a Gem, main success scenario** (`CommentOnGemE2ETest#mainSuccessScenario`)

  - **Expected Behaviors:**

    | **Scenario Steps** | **Test Case Steps** |
    | --- | --- |
    | 1. The user opens a gem, by tapping its marker on the Discovery map. | Find or add the shared gem (`POST /gem`) and set the mock location to test area 1.<br>Open the app on the Dashboard.<br>Click "Discovery".<br>Click (UI Automator) the map marker with the gem's name.<br>Check that the gem sheet's title is the gem's name. |
    | 2. The app shows the gem's sheet with a "Comments" list, oldest first, each comment showing its author's display name and text, and a "New comment..." text field with a "Send Comment" button. | Check that the text "Comments" is present on screen.<br>Check that a text field with the placeholder "New comment..." is present on screen.<br>Check that a button labelled "Send Comment" is present on screen.<br>If the gem already has comments (`GET /gem/:pk/comments`), check that the first comment shown is the oldest one. |
    | 3. The user types a comment of up to 256 characters. | Input "E2E test comment first &lt;time&gt;" in the text field.<br>Check that the text field contains it. |
    | 4. The user taps "Send Comment". | Click "Send Comment". |
    | 5. The app posts the comment, clears the text field, and shows the comment at the bottom of the list with the user's display name. | Check that the text field is empty.<br>Scroll to the end of the list; check that the last comment's text is the one just sent.<br>Check that the last comment's author is the signed-in user's display name (`GET /user/me`).<br>Repeat steps 3 to 5 with "E2E test comment second &lt;time&gt;".<br>Check that the first comment is above the second one. |

  - **Test Logs:**
    ```
    [Placeholder: this test's section of the run log]
    ```

- **Use Case 4: Comment on a Gem, failure scenario 2a** (`CommentOnGemE2ETest#scenario2a_noCommentsYet`)

  - **Expected Behaviors:**

    | **Scenario Steps** | **Test Case Steps** |
    | --- | --- |
    | 1. The user opens a gem, by tapping its card on the Dashboard. | Add a new gem through `POST /gem`, so it has no comments.<br>Open the app on the Dashboard.<br>Click the card with the new gem's name under "Latest Gems:".<br>Check that the gem sheet's title is the gem's name. |
    | 2. The app shows the gem's sheet with a "Comments" list. | Check that the text "Comments" is present on screen. |
    | 2a. The gem has no comments yet. | Ensured by adding the gem in step 1. |
    | 2a1. The app shows "No comments yet!" under "Comments". | Check that the text "No comments yet!" is present on screen. |

  - **Test Logs:**
    ```
    [Placeholder: this test's section of the run log]
    ```

- **Use Case 4: Comment on a Gem, failure scenario 3a** (`CommentOnGemE2ETest#scenario3a_moreThan256Characters`)

  - **Expected Behaviors:**

    | **Scenario Steps** | **Test Case Steps** |
    | --- | --- |
    | 1. The user opens a gem, by tapping its marker on the Discovery map. | Find or add the shared gem and set the mock location to test area 1.<br>Open the app on the Dashboard.<br>Click "Discovery".<br>Click (UI Automator) the map marker with the gem's name. |
    | 2. The app shows the gem's sheet with a "New comment..." text field. | Check that the comment text field is present on screen. |
    | 3a. The user types more than 256 characters. | Input "E2E test comment 3a " followed by "x" up to exactly 256 characters.<br>Check that the text field contains all 256 characters.<br>Input "y". |
    | 3a1. The text field does not accept characters beyond the 256th. | Check that the text field still contains the same 256 characters. |

  - **Test Logs:**
    ```
    [Placeholder: this test's section of the run log]
    ```

- **Use Case 4: Comment on a Gem, failure scenario 3b** (`CommentOnGemE2ETest#scenario3b_newLineOrTab`)

  - **Expected Behaviors:**

    | **Scenario Steps** | **Test Case Steps** |
    | --- | --- |
    | 1. The user opens a gem, by tapping its marker on the Discovery map. | Find or add the shared gem and set the mock location to test area 1.<br>Open the app on the Dashboard.<br>Click "Discovery".<br>Click (UI Automator) the map marker with the gem's name. |
    | 2. The app shows the gem's sheet with a "New comment..." text field. | Check that the comment text field is present on screen. |
    | 3. The user types a comment. | Input "E2E test comment 3b" in the text field. |
    | 3b. The user types a new line or a tab. | Input a new line.<br>Then input a tab. |
    | 3b1. The text field ignores it. | After the new line, check that the text field still contains "E2E test comment 3b".<br>After the tab, check the same again. |

  - **Test Logs:**
    ```
    [Placeholder: this test's section of the run log]
    ```

- **Use Case 4: Comment on a Gem, failure scenario 4a** (`CommentOnGemE2ETest#scenario4a_emptyOrSpacesOnly`)

  - **Expected Behaviors:**

    | **Scenario Steps** | **Test Case Steps** |
    | --- | --- |
    | 1. The user opens a gem, by tapping its marker on the Discovery map. | Find or add the shared gem and set the mock location to test area 1.<br>Open the app on the Dashboard.<br>Click "Discovery".<br>Click (UI Automator) the map marker with the gem's name. |
    | 2. The app shows the gem's sheet with a "New comment..." text field and a "Send Comment" button. | Check that the "Send Comment" button is present on screen. |
    | 4a. The text field is empty or contains only spaces. | Leave the text field empty, and later input three spaces. |
    | 4a1. The "Send Comment" button is disabled, so nothing is posted. | With the field empty, check that "Send Comment" is disabled.<br>Input three spaces; check that "Send Comment" is still disabled. |

  - **Test Logs:**
    ```
    [Placeholder: this test's section of the run log]
    ```

- **Use Case 5: Manage Favorite Gems, main success scenario** (`ManageFavoritesE2ETest#mainSuccessScenario`)

  - **Expected Behaviors:**

    | **Scenario Steps** | **Test Case Steps** |
    | --- | --- |
    | 1. The user opens a gem, by tapping its marker on the Discovery map. | Find or add the shared gem, remove it from the account's favorites, and save the account's favorites (they are put back after the test).<br>Set the mock location to test area 1.<br>Open the app on the Dashboard.<br>Click "Discovery".<br>Click (UI Automator) the map marker with the gem's name. |
    | 2. The app shows the gem's sheet with a star button, grey if the gem is not one of the user's favorites and gold if it is. | Check that the star button is not selected (grey). |
    | 3. The user taps the grey star. | Click the star button. |
    | 4. The app saves the gem as a favorite and the star turns gold. | Check that the star button is selected (gold).<br>Check that the gem is in the account's favorites (`GET /user/favorites`). |
    | 5. The user opens the Favorites screen from the navigation bar. | Press Back to close the gem sheet.<br>Click the navigation-bar item labelled "Favorites". |
    | 6. The app shows "Your favorites:" with a card for each favorite gem, most recently added first, each with a gold border and a ★ badge. | Check that the text "Your favorites:" is present on screen.<br>Check that the first card is the gem's card.<br>Check that the gem's card shows a ★ badge. (The gold border's colour cannot be read by the Compose testing APIs.) |
    | 7. The user long-presses a gem's card. | Long-press the gem's card. |
    | 8. The app removes the gem from the user's favorites and its card disappears from the screen. | Check that the gem's card is no longer on screen.<br>Check that the gem is no longer in the account's favorites (`GET /user/favorites`). |

  - **Test Logs:**
    ```
    [Placeholder: this test's section of the run log]
    ```

- **Use Case 5: Manage Favorite Gems, failure scenario 3a** (`ManageFavoritesE2ETest#scenario3a_tapGoldStar`)

  - **Expected Behaviors:**

    | **Scenario Steps** | **Test Case Steps** |
    | --- | --- |
    | 1. The user opens a gem, by tapping its marker on the Discovery map. | Find or add the shared gem and save the account's favorites.<br>Add the gem to the account's favorites (`POST /user/favorites`).<br>Set the mock location to test area 1.<br>Open the app on the Dashboard.<br>Click "Discovery".<br>Click (UI Automator) the map marker with the gem's name. |
    | 2. The app shows the gem's sheet with a star button, gold because the gem is a favorite. | Check that the star button is selected (gold). |
    | 3a. The gem is already a favorite (gold star) and the user taps the star. | Click the star button. |
    | 3a1. The app removes the gem from the user's favorites and the star turns grey. | Check that the star button is not selected (grey).<br>Check that the gem is no longer in the account's favorites (`GET /user/favorites`). |

  - **Test Logs:**
    ```
    [Placeholder: this test's section of the run log]
    ```

- **Use Case 5: Manage Favorite Gems, failure scenario 4a** (`ManageFavoritesE2ETest#scenario4a_atFavoritesLimit`)

  - **Expected Behaviors:**

    | **Scenario Steps** | **Test Case Steps** |
    | --- | --- |
    | 4a. The user already has 500 favorites. | Save the account's favorites, then remove them all.<br>Call the data-population script through `TestData.seedFavorites(500)` (`POST /e2e/seed/favorites`, which favorites 500 seed gems).<br>Check that the account now has exactly 500 favorites. Until the script exists, the test stops here and reports `BLOCKED`. |
    | 1. The user opens a gem, by tapping its marker on the Discovery map. | Set the mock location to test area 1.<br>Open the app on the Dashboard.<br>Click "Discovery".<br>Click (UI Automator) the map marker with the shared gem's name. |
    | 2. The app shows the gem's sheet with a grey star. | Check that the star button is not selected (grey). |
    | 3. The user taps the grey star. | Click the star button. |
    | 4a1. The app shows the message "You can have at most 500 favorites." | Check that the text "You can have at most 500 favorites." is present on screen. |
    | 4a2. The star stays grey. | Check that the star button is not selected (grey).<br>Check that the gem is not in the account's favorites (`GET /user/favorites`).<br>After the test, the seeded favorites are removed and the account's own favorites are put back. |

  - **Test Logs:**
    ```
    [Placeholder: this test's section of the run log]
    ```

- **Use Case 5: Manage Favorite Gems, failure scenario 6a** (`ManageFavoritesE2ETest#scenario6a_noFavorites`)

  - **Expected Behaviors:**

    | **Scenario Steps** | **Test Case Steps** |
    | --- | --- |
    | 6a. The user has no favorites. | Save the account's favorites, then remove them all (they are put back after the test).<br>Open the app on the Dashboard. |
    | 5. The user opens the Favorites screen from the navigation bar. | Click the navigation-bar item labelled "Favorites". |
    | 6a1. The app shows "No favorites yet!" under "Your favorites:". | Check that the text "Your favorites:" is present on screen.<br>Check that the text "No favorites yet!" is present on screen. |

  - **Test Logs:**
    ```
    [Placeholder: this test's section of the run log]
    ```
