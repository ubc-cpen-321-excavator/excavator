# Excavator

Excavator is an Android app for discovering hidden gems: lesser-known places near you, ranked by a Gem Score that favours places that are well rated but not yet crowded. Users sign in with Google, add places within 200 m of them as gems, rate and comment on gems, keep favorites, and see gems added nearby appear live.

The repository has two parts:
- `frontend/`: the Android app (Kotlin, Jetpack Compose, Google Maps).
- `backend/`: the API server (Node.js, TypeScript, Express, MongoDB), with a WebSocket live feed.

Documentation is in [`documentation/`](documentation/): [Requirements and Design](documentation/Requirements_and_Design.md), [Testing](documentation/Testing.md) and [Code Review](documentation/Code_Review.md). The backend's REST API is described in [`backend/openapi.yaml`](backend/openapi.yaml) (paste it into [editor.swagger.io](https://editor.swagger.io) to browse it).

## Requirements

Install the following before the frontend or backend setup steps:

- [git](https://git-scm.com/install/)

You also need, from a Google Cloud project:
- An **OAuth client ID** (type "Web application") for Google Sign-In. The same ID goes in the backend's `GOOGLE_CLIENT_ID` and the app's `GOOGLE_CLIENT_ID`. Sign-in on a device also needs an Android OAuth client in the same project with the app's package name and your debug key's SHA-1.
- An **API key** with **Places API (New)** enabled, for the backend (`GOOGLE_API_KEY`).
- An **API key** with **Maps SDK for Android** enabled, for the app's map (`MAPS_API_KEY`). It can be the same key.


--- 

## Frontend Setup

### Requirements

- [Android Studio](https://developer.android.com/studio) (latest version)
- [Java 17](https://adoptium.net/temurin/releases/?version=17)
- [Android SDK](https://developer.android.com/studio#command-tools) with API level 36+ (Android 16)

### Setup

1. **Open project**: Open the `frontend/` directory in Android Studio
2. **Sync Gradle**: Android Studio will automatically prompt you to sync the project. Click "Sync Now". You can also manually run `cd frontend && ./gradlew build` to trigger the sync and download the necessary dependencies.
3. **Configure Android SDK**: Ensure you have Android SDK 36 installed.
4. **Set up emulator/device**:
   - Create a new AVD (Android Virtual Device) by selecting Pixel 9 as the device and Android Baklava (API level 36) as the system image.
   - Alternatively, connect a physical Android device running Android 16 (API level 36).
5. **Setup app config**: Copy the example file, then fill in local values:
   ```bash
   cp frontend/local.properties.example frontend/local.properties
   ```
   Set at least:
   - `sdk.dir`: path to your Android SDK. Android Studio usually writes this the first time you open `frontend/`. On Mac it is often `sdk.dir=/Users/<username>/Library/Android/sdk`.
   - `API_BASE_URL`: backend URL baked into the APK. Use `http://10.0.2.2:3000` for the emulator (`10.0.2.2` is the host machine). For a physical device on the same Wi-Fi, use `http://<your-lan-ip>:3000`.
   - `GOOGLE_CLIENT_ID`: the Web OAuth client ID (the same one as the backend's).
6. **Set the Maps key**: create `frontend/secrets.properties` (it is git-ignored) with:
   ```
   MAPS_API_KEY=<your Maps SDK for Android key>
   ```
   Without it the app builds, but the map stays blank.


### Build and Run

- **Debug build**: Click the green play button in the toolbar, to compile the code, package a debug APK, and install it on the connected device or running emulator. Alternatively, from the project root, run `./scripts/run-frontend.sh`.
- **Release build**: Go to Build -> Generate Signed App Bundle or APK -> APK. Follow the on-screen instructions to create a key, and select the "release" build variant. You will then have to manually install the generated APK on your device or the running emulator.


### Backend Configuration

The app needs a running backend (see below). If you change where it runs, update `API_BASE_URL` in `frontend/local.properties` and rebuild.

---
## Backend Setup

You can run the backend in one of two ways:
* Locally via Node.js 
* Via Docker Compose

Both ways use the same `backend/.env` file (see below).

### Environment configuration

From the project root:

```bash
cp backend/.env.example backend/.env
```

Set at least:
- `JWT_SECRET`: a long random string used to sign auth tokens.
- `GOOGLE_CLIENT_ID`: the Web OAuth client ID, used to verify Google sign-in tokens.
- `GOOGLE_API_KEY`: the key with Places API (New) enabled, used to list nearby places and to add gems.
- `MONGODB_URI`: only needed for local development (default in `.env.example` assumes MongoDB on `localhost:27017`). Ignored when running via Docker Compose.
- `PORT` (optional): defaults to `3000` if unset.


### Option 1: Run locally

**Requirements:** 
- [Node.js](https://nodejs.org/en/download/) 22+
- [npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm) 10+

**Setup:** 
1. Install dependencies:

   ```bash
   cd backend
   npm install
   ```

2. **Development** (TypeScript with auto-reload):

   ```bash
   npm run dev
   ```

3. **Production build** (optional):

   ```bash
   npm run build
   npm start
   ```

### Option 2: Run with Docker Compose

**Requirements:** 
- [Docker](https://docs.docker.com/desktop/setup/install) and [Docker Compose](https://docs.docker.com/desktop/setup/install) v2.24+
- [curl](https://curl.se/download.html)

**Setup**
1. **Start** (from the project root):

   ```bash
   ./scripts/run-backend.sh
   ```

   Or run Compose directly:

   ```bash
   docker compose up --build -d
   ```

2. **Stop**:

   ```bash
   docker compose down
   ```

To check the backend is up, open `http://localhost:3000/health`.

### Demo data (optional)

To fill an empty database with demo data (10 gems around Vancouver, 3 users and 10 comments):

```bash
cd backend
npm run seed                # adds whatever demo data is missing; safe to run again
npm run seed -- --reset     # removes the demo data only
```

With Docker Compose, run `docker compose exec backend npm run seed` instead. The deploy workflow runs the seed on every deploy, and it never changes or removes data that isn't demo data.

---
## Tests

Backend tests start their own in-memory MongoDB, so no database or `.env` is needed:

```bash
cd backend
npm install
npm test                       # all backend tests
npx jest --coverage            # with coverage
```

Or, from the project root: `./scripts/run-backend-interface-tests.sh` (API tests, with and without mocks) and `./scripts/run-backend-nfr-tests.sh` (non-functional requirement tests). Frontend tests run with `./scripts/run-frontend-e2e-tests.sh` and `./scripts/run-frontend-nfr-tests.sh` (an emulator or device is required). Windows users can run the `.ps1` version of each script. See [Testing.md](documentation/Testing.md) for details.

## Deployment

Pushing to `main` or `develop` deploys the backend through GitHub Actions (`.github/workflows/deploy.yml`): it copies the repository to the server VM over SSH, writes `backend/.env` from repository secrets, rebuilds the containers with Docker Compose, and seeds the demo data. The VM's address, user and SSH key are repository secrets too.
