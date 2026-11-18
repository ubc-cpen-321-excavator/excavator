# Code Review

## 1. Change History

| **Change Date**   | **Modified Sections** | **Rationale** |
| ----------------- | --------------------- | ------------- |
| 2026-11-04 | 2.1, 2.2, 2.3, 2.4 | Recorded the commit Codacy analysed and justified each issue it reports. |

---

## 2. Automated Code Review Results

### 2.1. Commit Hash Where Codacy Ran

`7e2dd810ac358ab7b6e5164353eae6746b4630cb` (the head of `main`, after merging pull request #108 from `develop`, which Codacy analysed; the code Codacy checked is unchanged on `main`)

### 2.2. Unfixed Issues per Codacy Category

![Codacy issues per category](images/codacy_categories.png)

### 2.3. Unfixed Issues per Codacy Code Pattern

![Codacy issues per code pattern](images/codacy_issues.png)

### 2.4. Justifications for Unfixed Issues

The 29 issues Codacy reports are listed below by code pattern. Most are false positives: Codacy runs ESLint without installing our dependencies, so it cannot see their types, and some security patterns match test code whose inputs are constants. The few that are real issues were not fixed because of time constraints, as noted.

- **Code Pattern: Unsafe use of `any` (no-unsafe-argument, no-unsafe-return, no-redundant-type-constituents)**

  1. **Issue**

     - **Location in Git:** [`backend/src/services/gemService.ts#L658`](https://github.com/ubc-cpen-321-excavator/excavator/blob/7e2dd810ac358ab7b6e5164353eae6746b4630cb/backend/src/services/gemService.ts#L658)
     - **Justification:** Codacy runs ESLint without installing our dependencies, so the types of `@googlemaps/places` cannot be resolved and everything derived from them becomes `any`. With the dependencies installed, `candidates` is typed `Omit<PlaceCandidate, 'isGem'>[]` (each built by `candidateFromGoogle`, which checks every field Google returns), and `namesIn` takes `string[]`. Our strict `tsc` type check (`npm run typecheck`, run in CI) passes with no `any`.

  2. **Issue**

     - **Location in Git:** [`backend/src/services/gemService.ts#L658`](https://github.com/ubc-cpen-321-excavator/excavator/blob/7e2dd810ac358ab7b6e5164353eae6746b4630cb/backend/src/services/gemService.ts#L658)
     - **Justification:** The same line, reported a second time as an unsafe return of the mapped names. Same reason: the type is only `any` because Codacy cannot load `@googlemaps/places`; with it, the value is `string[]`.

  3. **Issue**

     - **Location in Git:** [`backend/src/services/gemService.ts#L660`](https://github.com/ubc-cpen-321-excavator/excavator/blob/7e2dd810ac358ab7b6e5164353eae6746b4630cb/backend/src/services/gemService.ts#L660)
     - **Justification:** Same cause: `c.name` is a `string` once `@googlemaps/places` is resolved, so `gems.has(c.name)` is type-safe.

  4. **Issue**

     - **Location in Git:** [`backend/src/services/gemService.ts#L660`](https://github.com/ubc-cpen-321-excavator/excavator/blob/7e2dd810ac358ab7b6e5164353eae6746b4630cb/backend/src/services/gemService.ts#L660)
     - **Justification:** Same cause, reported as an "error typed" return: the returned list is `PlaceCandidate[]` when the dependency types load, and `tsc` checks it.

  5. **Issue**

     - **Location in Git:** [`backend/src/services/authService.ts#L195`](https://github.com/ubc-cpen-321-excavator/excavator/blob/7e2dd810ac358ab7b6e5164353eae6746b4630cb/backend/src/services/authService.ts#L195)
     - **Justification:** Codacy cannot load the `google-auth-library` types, so `payload.sub` looks like `any`. It is typed `string` in the library, and line 185 already rejects a payload without `sub`, so a non-empty string is always passed. The Google name fields, which really are untyped, are read as `unknown` and checked with `nonEmpty`.

  6. **Issue**

     - **Location in Git:** [`backend/tests/helpers/db.ts#L21`](https://github.com/ubc-cpen-321-excavator/excavator/blob/7e2dd810ac358ab7b6e5164353eae6746b4630cb/backend/tests/helpers/db.ts#L21)
     - **Justification:** Test helper. `MongoMemoryServer` is only seen as `any` because Codacy does not install `mongodb-memory-server`; with it installed the union `MongoMemoryServer | undefined` is meaningful (undefined before `startDb` and after `stopDb`) and `tsc` accepts it.

  7. **Issue**

     - **Location in Git:** [`backend/tests/helpers/db.ts#L29`](https://github.com/ubc-cpen-321-excavator/excavator/blob/7e2dd810ac358ab7b6e5164353eae6746b4630cb/backend/tests/helpers/db.ts#L29)
     - **Justification:** Test helper, same cause: `getUri()` returns `string` in `mongodb-memory-server`, which Codacy does not load.


- **Code Pattern: NoSQL injection: untrusted input in `findOne()`**

  1. **Issue**

     - **Location in Git:** [`backend/tests/no-mock/profile.test.ts#L45`](https://github.com/ubc-cpen-321-excavator/excavator/blob/7e2dd810ac358ab7b6e5164353eae6746b4630cb/backend/tests/no-mock/profile.test.ts#L45)
     - **Justification:** False positive in a test. The query value is the constant `TEST_USER_ID` from `tests/helpers/auth.ts`, not user input, and the query runs against a throwaway in-memory MongoDB.

  2. **Issue**

     - **Location in Git:** [`backend/tests/no-mock/profile.test.ts#L51`](https://github.com/ubc-cpen-321-excavator/excavator/blob/7e2dd810ac358ab7b6e5164353eae6746b4630cb/backend/tests/no-mock/profile.test.ts#L51)
     - **Justification:** Same as above: the constant `TEST_USER_ID` in a test.

  3. **Issue**

     - **Location in Git:** [`backend/tests/no-mock/profile.test.ts#L64`](https://github.com/ubc-cpen-321-excavator/excavator/blob/7e2dd810ac358ab7b6e5164353eae6746b4630cb/backend/tests/no-mock/profile.test.ts#L64)
     - **Justification:** Same as above: the constant `TEST_USER_ID` in a test.

  4. **Issue**

     - **Location in Git:** [`backend/tests/no-mock/comment.test.ts#L23`](https://github.com/ubc-cpen-321-excavator/excavator/blob/7e2dd810ac358ab7b6e5164353eae6746b4630cb/backend/tests/no-mock/comment.test.ts#L23)
     - **Justification:** False positive in a test. This line only sends the test's own request; Codacy marks it as the "source" for the query on line 27.

  5. **Issue**

     - **Location in Git:** [`backend/tests/no-mock/comment.test.ts#L27`](https://github.com/ubc-cpen-321-excavator/excavator/blob/7e2dd810ac358ab7b6e5164353eae6746b4630cb/backend/tests/no-mock/comment.test.ts#L27)
     - **Justification:** False positive in a test. `response.body.id` is the comment ID our own server returned to the test a line earlier, used to check that the comment was stored; no outside input reaches the query. In the production code, every value used in a query is validated first (for example, place IDs must match `places/<id>`).


- **Code Pattern: "This looks like a JavaScript template string" (no-template-curly-in-string)**

  1. **Issue**

     - **Location in Git:** [`backend/tests/helpers/auth.ts#L18`](https://github.com/ubc-cpen-321-excavator/excavator/blob/7e2dd810ac358ab7b6e5164353eae6746b4630cb/backend/tests/helpers/auth.ts#L18)
     - **Justification:** False positive. This rule is for `${...}` written inside ordinary quotes by mistake; here it is a real template literal (backticks) that builds the `Authorization: Bearer <token>` header for tests, and it produces the intended value.

  2. **Issue**

     - **Location in Git:** [`backend/tests/no-mock/auth.test.ts#L67`](https://github.com/ubc-cpen-321-excavator/excavator/blob/7e2dd810ac358ab7b6e5164353eae6746b4630cb/backend/tests/no-mock/auth.test.ts#L67)
     - **Justification:** Same false positive: a real template literal that builds a test's `Authorization` header.

  3. **Issue**

     - **Location in Git:** [`backend/tests/no-mock/auth.test.ts#L78`](https://github.com/ubc-cpen-321-excavator/excavator/blob/7e2dd810ac358ab7b6e5164353eae6746b4630cb/backend/tests/no-mock/auth.test.ts#L78)
     - **Justification:** Same false positive: a real template literal that builds a test's `Authorization` header.


- **Code Pattern: Open redirect: untrusted input in `redirect()`**

  1. **Issue**

     - **Location in Git:** [`backend/src/controllers/gemController.ts#L104`](https://github.com/ubc-cpen-321-excavator/excavator/blob/7e2dd810ac358ab7b6e5164353eae6746b4630cb/backend/src/controllers/gemController.ts#L104)
     - **Justification:** False positive. This is not a redirect: it sets the `Location` header of a `201 Created` response to the new Gem's own path on our API, as HTTP recommends, and clients do not follow it. The value is built by the server: the path is fixed and `gem.name` is a validated Google place ID (`places/<id>`), additionally passed through `encodeURIComponent`, so it cannot point to another site.


- **Code Pattern: Comment on a private property or function instead of a self-explanatory name**

  1. **Issue**

     - **Location in Git:** [`utils/location/LocationSettingsPrompt.kt#L163`](https://github.com/ubc-cpen-321-excavator/excavator/blob/7e2dd810ac358ab7b6e5164353eae6746b4630cb/frontend/app/src/main/java/com/example/cpen321application/utils/location/LocationSettingsPrompt.kt#L163)
     - **Justification:** The name already says what it is (the location-settings request). The comment explains *why* balanced priority is used instead of high accuracy, which a name cannot carry, so we kept it.

  2. **Issue**

     - **Location in Git:** [`presentation/viewmodels/GemViewModel.kt#L74`](https://github.com/ubc-cpen-321-excavator/excavator/blob/7e2dd810ac358ab7b6e5164353eae6746b4630cb/frontend/app/src/main/java/com/example/cpen321application/presentation/viewmodels/GemViewModel.kt#L74)
     - **Justification:** The name says what it is; the comment adds that live updates wait for this flag, which explains how the class works, not what the property is.

  3. **Issue**

     - **Location in Git:** [`presentation/viewmodels/GemViewModel.kt#L196`](https://github.com/ubc-cpen-321-excavator/excavator/blob/7e2dd810ac358ab7b6e5164353eae6746b4630cb/frontend/app/src/main/java/com/example/cpen321application/presentation/viewmodels/GemViewModel.kt#L196)
     - **Justification:** The name describes the function; the comment explains the design choice (the feed runs only while the screen observes it, with a grace period across configuration changes).

  4. **Issue**

     - **Location in Git:** [`presentation/viewmodels/GemViewModel.kt#L208`](https://github.com/ubc-cpen-321-excavator/excavator/blob/7e2dd810ac358ab7b6e5164353eae6746b4630cb/frontend/app/src/main/java/com/example/cpen321application/presentation/viewmodels/GemViewModel.kt#L208)
     - **Justification:** The name describes the function; the comment explains its lifecycle (it suspends while live, and cancelling it closes the socket), which a name cannot express.

  5. **Issue**

     - **Location in Git:** [`presentation/viewmodels/GemViewModel.kt#L253`](https://github.com/ubc-cpen-321-excavator/excavator/blob/7e2dd810ac358ab7b6e5164353eae6746b4630cb/frontend/app/src/main/java/com/example/cpen321application/presentation/viewmodels/GemViewModel.kt#L253)
     - **Justification:** The name says what it checks; the comment explains why comparing `placesName` is enough (it is the Gem's primary key).

  6. **Issue**

     - **Location in Git:** [`data/remote/websocket/DashboardLiveUpdatesClient.kt#L46`](https://github.com/ubc-cpen-321-excavator/excavator/blob/7e2dd810ac358ab7b6e5164353eae6746b4630cb/frontend/app/src/main/java/com/example/cpen321application/data/remote/websocket/DashboardLiveUpdatesClient.kt#L46)
     - **Justification:** The name says what it stores; the comment explains why it is kept (the server forgets the subscription when the socket closes, so it is re-sent on reconnect).

  7. **Issue**

     - **Location in Git:** [`data/remote/websocket/DashboardLiveUpdatesClient.kt#L119`](https://github.com/ubc-cpen-321-excavator/excavator/blob/7e2dd810ac358ab7b6e5164353eae6746b4630cb/frontend/app/src/main/java/com/example/cpen321application/data/remote/websocket/DashboardLiveUpdatesClient.kt#L119)
     - **Justification:** The name says what it checks; the comment explains why the check is needed at all (Gson ignores Kotlin nullability, so "non-null" fields can be null at runtime).

  8. **Issue**

     - **Location in Git:** [`data/remote/websocket/DashboardLiveUpdatesClient.kt#L149`](https://github.com/ubc-cpen-321-excavator/excavator/blob/7e2dd810ac358ab7b6e5164353eae6746b4630cb/frontend/app/src/main/java/com/example/cpen321application/data/remote/websocket/DashboardLiveUpdatesClient.kt#L149)
     - **Justification:** The name says what it does; the comment explains the thread-safety reason (callbacks from an old socket must be ignored).


- **Code Pattern: Caught exception is too generic**

  1. **Issue**

     - **Location in Git:** [`data/remote/websocket/DashboardLiveUpdatesClient.kt#L112`](https://github.com/ubc-cpen-321-excavator/excavator/blob/7e2dd810ac358ab7b6e5164353eae6746b4630cb/frontend/app/src/main/java/com/example/cpen321application/data/remote/websocket/DashboardLiveUpdatesClient.kt#L112)
     - **Justification:** Deliberate. This parses messages from the network, and a malformed message can throw several unrelated exceptions (`JsonSyntaxException`, `IllegalStateException`, `UnsupportedOperationException`, `ClassCastException`, `NullPointerException`). Any of them means the same thing: drop the message, log it, and keep the live feed running, instead of crashing the socket listener.


- **Code Pattern: Thrown exception is too generic**

  1. **Issue**

     - **Location in Git:** [`data/repositories/CommentRepositoryImpl.kt#L27`](https://github.com/ubc-cpen-321-excavator/excavator/blob/7e2dd810ac358ab7b6e5164353eae6746b4630cb/frontend/app/src/main/java/com/example/cpen321application/data/repositories/CommentRepositoryImpl.kt#L27)
     - **Justification:** Not fixed because of time constraints. The code already has a TODO to replace it with a specific error type that carries the HTTP status.

  2. **Issue**

     - **Location in Git:** [`data/repositories/GemRepositoryImpl.kt#L44`](https://github.com/ubc-cpen-321-excavator/excavator/blob/7e2dd810ac358ab7b6e5164353eae6746b4630cb/frontend/app/src/main/java/com/example/cpen321application/data/repositories/GemRepositoryImpl.kt#L44)
     - **Justification:** Not fixed because of time constraints. Same TODO as above.


- **Code Pattern: Function is too long**

  1. **Issue**

     - **Location in Git:** [`presentation/activities/dashboard/DashboardActivity.kt#L39`](https://github.com/ubc-cpen-321-excavator/excavator/blob/7e2dd810ac358ab7b6e5164353eae6746b4630cb/frontend/app/src/main/java/com/example/cpen321application/presentation/activities/dashboard/DashboardActivity.kt#L39)
     - **Justification:** Not fixed because of time constraints. `onCreate` is 71 lines against a limit of 60; most of it is the location permission and location-off dialogs, which could be moved into their own composable.


- **Code Pattern: Labeled expressions increase complexity**

  1. **Issue**

     - **Location in Git:** [`presentation/activities/discovery/composables/DiscoveryMap.kt#L126`](https://github.com/ubc-cpen-321-excavator/excavator/blob/7e2dd810ac358ab7b6e5164353eae6746b4630cb/frontend/app/src/main/java/com/example/cpen321application/presentation/activities/discovery/composables/DiscoveryMap.kt#L126)
     - **Justification:** `return@LaunchedEffect` is the standard Kotlin way to leave a lambda early when there is no location yet. Removing the label means wrapping the rest of the effect in an `if` or `let`, which adds nesting instead of reducing it.

---

## 3. Manual Code Review Results

### 3.1. Review You Performed

- **Peer group reviewed:** [WRITE_HERE]
- **Commit SHA reviewed:** `[Insert Commit SHA here]`
- **Date the artifacts were exchanged:** [WRITE_HERE]
- **Review report submitted:** [`<CP#>_<YourPeerGroupName>_Review.pdf`](#)

| **Section**          | **Item**                                                                                                                                             | **Score** |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| Manual code review   | Code is maintainable (well-documented, uses self-explanatory variable names, does not have complicated and long methods, magic numbers, etc.), efficient, handles error cases well | x/10      |
| Manual test review   | Tests are complete (all APIs exposed to the front-end are tested, three main features are tested), errors and edge cases are thoroughly tested, correct assertions are used | x/10      |
| Manual test review   | Test code is maintainable and well-structured                                                                                                          | x/10      |
| Manual test review   | Test implementation matches the requirements and design                                                                                                | x/10      |
| Manual test review   | Non-functional requirements are tested well                                                                                                            | x/10      |
| Manual test review   | Tests achieve high coverage and cases of < 100% coverage are well-justified                                                                            | x/10      |
| Manual test review   | All back-end tests can be run automatically                                                                                                            | x/10      |
| Automated code review| Codacy runs with the required setup                                                                                                                    | x/10      |
| Automated code review| All remaining Codacy issues are well-justified                                                                                                          | x/10      |

**Major fault reported**

- **Description:** ...
- **Steps to reproduce:** ...
- **Screenshots:** _(Placeholder for screenshots of the reported fault)_
- **Severity:** ...

### 3.2. Review You Received

- **Reviewing group:** [WRITE_HERE]
- **Commit SHA that was reviewed:** `[Insert Commit SHA here]`
- **Review report received:** [`<CP#>_<YourGroupName>_Review.pdf`](#)

| **Section**          | **Item**                                                                                                                                             | **Score** |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| Manual code review   | Code is maintainable, efficient, handles error cases well                                                                                               | x/10      |
| Manual test review   | Tests are complete, errors and edge cases are thoroughly tested, correct assertions are used                                                            | x/10      |
| Manual test review   | Test code is maintainable and well-structured                                                                                                          | x/10      |
| Manual test review   | Test implementation matches the requirements and design                                                                                                | x/10      |
| Manual test review   | Non-functional requirements are tested well                                                                                                            | x/10      |
| Manual test review   | Tests achieve high coverage and cases of < 100% coverage are well-justified                                                                            | x/10      |
| Manual test review   | All back-end tests can be run automatically                                                                                                            | x/10      |
| Automated code review| Codacy runs with the required setup                                                                                                                    | x/10      |
| Automated code review| All remaining Codacy issues are well-justified                                                                                                          | x/10      |

**Major fault reported against your project**

- **Description:** ...
- **Severity:** ...

### 3.3. Actions Taken in Response to the Review

| **Finding** | **Action Taken** | **Commit / Location in Git** |
| ----------- | ---------------- | ---------------------------- |
| ...         | ...              | [`src/...`](#)               |
| ...         | ...              | ...                          |

- **Findings not acted on.** For each finding you decided not to address, give the reason:
  1. **Finding:** ...
     - **Justification:** ...
