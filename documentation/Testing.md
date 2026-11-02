# Testing

## 1. Change History

| **Change Date**   | **Modified Sections** | **Rationale** |
| ----------------- | --------------------- | ------------- |
| 2026-10-31 | 2.1, 2.2, 2.5 | Listed every backend interface's test groups, how to run them, and the CI workflow. |
| 2026-10-31 | 3 | Added the two non-functional requirement tests and how they verify the requirements. |

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

`frontend/src/androidTest/java/com/studygroupfinder/`

### 4.2. Tests

- **Use Case: Login**

  - **Expected Behaviors:**
    | **Scenario Steps** | **Test Case Steps** |
    | ------------------ | ------------------- |
    | 1. The user opens "Add Todo Items" screen. | Open "Add Todo Items" screen. |
    | 2. The app shows an input text field and an "Add" button. The add button is disabled. | Check that the text field is present on screen.<br>Check that the button labelled "Add" is present on screen.<br>Check that the "Add" button is disabled. |
    | 3a. The user inputs an ill-formatted string. | Input "_^_^^OQ#$" in the text field. |
    | 3a1. The app displays an error message prompting the user for the expected format. | Check that a dialog is opened with the text: "Please use only alphanumeric characters ". |
    | 3. The user inputs a new item for the list and the add button becomes enabled. | Input "buy milk" in the text field.<br>Check that the button labelled "add" is enabled. |
    | 4. The user presses the "Add" button. | Click the button labelled "add ". |
    | 5. The screen refreshes and the new item is at the bottom of the todo list. | Check that a text box with the text "buy milk" is present on screen.<br>Input "buy chocolate" in the text field.<br>Click the button labelled "add".<br>Check that two text boxes are present on the screen with "buy milk" on top and "buy chocolate" at the bottom. |
    | 5a. The list exceeds the maximum todo-list size. | Repeat steps 3 to 5 ten times.<br>Check that a dialog is opened with the text: "You have too many items, try completing one first". |

  - **Test Logs:**
    ```
    [Placeholder for Espresso test execution logs]
    ```

- **Use Case: ...**

  - **Expected Behaviors:**

    | **Scenario Steps** | **Test Case Steps** |
    | ------------------ | ------------------- |
    | ...                | ...                 |

  - **Test Logs:**
    ```
    [Placeholder for Espresso test execution logs]
    ```

- **...**
