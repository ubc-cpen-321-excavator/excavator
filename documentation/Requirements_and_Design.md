# Requirements and Design

## 1. Change History

| **Change Date**   | **Modified Sections** | **Rationale** |
| ----------------- | --------------------- | ------------- |
| 2026-10-31 | 2 | The Gem Score uses Excavator users' ratings, not Google Trends data, so the description now matches the implementation. |
| 2026-10-31 | 3.7, 4.7 | Added the two non-functional requirements and how they are met; both are tested automatically in `backend/tests/nfr`. |
| 2026-10-31 | 4.1 | Gems: ratings, login on writes, internal interfaces. Live Feed: `gem.updated`. Users: profile routes. New Favorites component. Matches the implemented backend. |
| 2026-10-31 | 4.2 | Added the Favorites and Ratings collections; Gems store rating totals; comments store their author. |
| 2026-10-31 | 4.4 | Added the backend frameworks and libraries. |
| 2026-11-03 | 4.5 | Added the dependencies diagram: front end, the four back-end components, the five MongoDB collections and the two Google services, with the interfaces each arrow uses. |
| 2026-11-03 | 4.6 | Added sequence diagrams for the five major use cases (View a Gem, Add a Gem, Contribute to GemScore, View new Gems nearby, Initialize session), using the components and interfaces of 4.1 and 4.5. |
| 2026-11-03 | 4.1 | Corrected the interfaces to match the code: `GET /user/me` returns `name` as an object; feed messages over 1024 bytes close the connection; rating and favorites routes answer 401 before 405; added default and maximum values (radius, limit, comment and display-name length) and the missing 400, 401 and 404 responses. |

---

## 2. Project Description

Excavator is an app designed to let you find niche, high quality locations in your area, or hidden gems. The app features three main screens. A dashboard where users can see the latest gems, a discovery screen, where users can see all the gems in their area on a Google Maps-like screen, and the favorites screen, where users can see all the gems they have added to their favorites. Excavator features a special metric for each gem posted that is known as the Gem Score. The Gem Score is a score from 0 to 100, computed by Excavator from Google Places data (the number of reviews and their average rating) and from Excavator users' own ratings. It rewards places that are both well rated and little known, and it updates live as users rate the gem.

---

## 3. Requirements Specification

### **3.1. List of Features**
0. Authentication. (Google OAuth, JWT)
0. Gem and GemScore, essentially a location and a score for its quality plus nichness.
0. Feed for real-time updates of hidden gems around you, or other certain locations.
0. Real-time feed of new Gems around you.
0. In-app ratings (1–5).
0. Comments.

### **3.2. Use Case Diagram**
![Use case diagram](./images/use_case_diagram.png)

### **3.3. Actors Description**
1. **User**: Generic user of the app.

We do not have admin user or any other role planned.

### **3.4. Use Case Description**
- Use cases for feature 1: Authentication
0. **Initialize session**: For the first time, or after last JWT expires, User authenticates via Google.
0. **Authenticate API calls**: With a valid JWT, User's API calls are permitted.

- Use cases for feature 2: GemScore
0. **Add a Gem**: A User adds a Gem, the Gem is then scored.
0. **View a Gem**: A User views a Gem, is shown a score.
0. **Mark a Gem as favorite**: A User clicks a "favorite" button, adding it to their "favorite" list.

- Use cases for feature 3: Live feed
0. **View new nearby Gems**: A User opens a dashboard, immediately sees a list of last added Gems nearby.
0. **View new Gems nearby**: With the dashboard open, the User sees new Gems nearby added to the list.

- Use cases for feature 4: In-app ratings
0. **Contribute to GemScore**: A User rates a Gem, after sometime, the Gem's GemScore is updated to reflect the change.

- Use cases for feature 5: Comments
0. **View comments**: A User views a Gem, sees comments in its view.
0. **Make comments**: A User click a "comment" button while viewing a Gem, then text something, and posts a comment.

### **3.5. Formal Use Case Specifications (5 Most Major Use Cases)**
<a name="uc1"></a>

#### Use Case 1: View a Gem
<!-- TODO -->

**Description**: A User sees entry of a Gem, then details of that Gem.

**Primary actor(s)**: User

**Main success scenario**:
1. ...
2. ...

**Failure scenario(s)**:
- 1a. ...
    - 1a1. ...
    - 1a2. ...

- 1b. ...
    - 1b1. ...
    - 1b2. ...
                
- 2a. ...
    - 2a1. ...
    - 2a2. ...

<a name="uc2"></a>

#### Use Case 2: [WRITE_USE_CASE_2_NAME_HERE]
<!-- TODO -->

### **3.6. Screen Mock-ups**
![Frontend Screens Diagram](images/frontend_screens_diagram.jpg)

### **3.7. Non-Functional Requirements**
<a name="nfr1"></a>

1. **Live updates arrive within 1 second**
    - **Description**: When a gem is added, or its Gem Score changes because someone rated it, every user whose map is open within range of it receives the update within 1 second of the request that caused it, even with 250 users connected at once. Users out of range receive nothing.
    - **Justification**: Live updates are what make Excavator's map feel shared; an update that takes several seconds is indistinguishable from refreshing. One second is the usual limit for a response to feel immediate and keep the user's flow (Nielsen, *Usability Engineering*, 1993). 250 concurrent users is several times the number of people expected around the same area during the course demo and peer testing.

2. **The map stays fast with many gems**
    - **Description**: With 10,000 gems stored, 95% of the map's queries (the gems inside the visible map area, and the gems near a point) are answered within 500 ms.
    - **Justification**: The discovery screen re-queries every time the user pans or zooms, so slow queries make the map feel stuck. 500 ms leaves half of the 1-second responsiveness limit for the network and drawing the pins. 10,000 gems is far more than a city will have during the course, so the requirement shows the design keeps working as gems accumulate.

---

## 4. Designs Specification
### **4.1. Main Components**
1. **Gems**
    - **Purpose**: Adds, validates, scores and lists gems, and holds their comments and ratings. A gem is a Google Places place, identified by its Google name `places/<place ID>`. A place can only be added by a signed-in user, if it exists on Google Places and is within 200 m of them. Each gem has a Gem Score from 0 to 100 that rewards places that are both well rated and little known. The Google ratings and Excavator users' ratings are pulled together toward 3.0 when there are few of them: R_adj = (v·rating + u·r_app + 15·3.0) / (v + u + 15), where v is the Google review count and rating its average, and u is the number of Excavator ratings and r_app their average. Quality is Q = (R_adj − 1) / 4, nicheness is N = 1 / (1 + v / 200), and the score is 100 · Q^0.6 · N^0.4. Excavator ratings change quality only, since nicheness measures how well known a place is in general. A Google rating that is missing counts as no rated reviews, but its review count still sets N. Users rate a gem 1–5 stars, once each (rating again replaces their rating); after every rating the gem's rating totals are recounted from all its ratings, its score is recomputed, and the updated gem is pushed to nearby users through the Live Feed.
    - **Interfaces**:
        1. `GET /gem?name=places/<place ID>` → the gem
            - **Purpose**: Gets one gem, for its info sheet. Returns 400 if `name` is missing or not `places/<place ID>` (the database is not queried), and 404 if no gem has that name.
        2. `POST /gem { name, latitude, longitude }` → 201 with the new gem (requires login)
            - **Purpose**: Adds a place as a gem, recording the signed-in user as `addedBy`. `latitude` / `longitude` are the user's location; the place must be within 200 m. The new gem is scored and pushed to nearby users through the Live Feed. Returns 400 if `name` or the location is malformed, 401 if not signed in, 409 if the gem already exists, 422 if the place doesn't exist or is too far away, and 502 if Google Places is unavailable.
        3. `GET /gem/nearby?lat&lng[&radius][&limit]` → gems, nearest first
            - **Purpose**: Gems around the user, for the dashboard and discovery screen. `radius` is in metres, 5000 by default and at most 50000; `limit` is 20 by default and at most 50. Returns 400 if the location is missing or out of range, or if `radius` or `limit` is not a whole number in range.
        4. `GET /gem/within?south&west&north&east[&limit]` → gems, highest Gem Score first
            - **Purpose**: Gems inside the visible map area, for the discovery screen. `limit` is 20 by default and at most 50. The area must not cross the antimeridian. Returns 400 if a bound is missing or out of range, south ≥ north, west ≥ east, or `limit` is invalid.
        5. `GET /gem/newest[?limit]` → gems, newest first
            - **Purpose**: The latest gems, for the dashboard. `limit` is 20 by default and at most 50; 400 if it is invalid.
        6. `GET /gem/:pk/comments` → `[{ id, body, author, authorName }]`, oldest first; `POST /gem/:pk/comments { body }` → 201 `{ id, body, author, authorName }` (posting requires login)
            - **Purpose**: Reads and adds the comments of the gem whose place ID is `pk`. A new comment records the signed-in user and their display name. The body is trimmed and must then be 1–1000 characters with no control characters. Both return 400 if `pk` is not a valid place ID and 404 if no gem has it; posting also returns 400 for an invalid body and 401 if not signed in.
        7. `PUT /gem/:pk/rating { stars }` → `{ stars, gem }`; `GET /gem/:pk/rating` → `{ stars }` (both require login)
            - **Purpose**: Sets the signed-in user's 1–5 star rating of the gem, returning the gem with its new rating totals and Gem Score; or reads their rating. Both return 400 if `pk` is not a valid place ID, 401 if not signed in, and 404 if no gem has that place ID. `PUT` also returns 400 if `stars` is not a whole number from 1 to 5; `GET` returns 404 if the user hasn't rated the gem.
        8. `GET /place/nearby?lat&lng[&type]` → up to 20 places within 200 m, nearest first, each with `isGem`
            - **Purpose**: Lets the user pick a place that isn't labelled on the map when adding a gem; the app then sends its `name` to `POST /gem`. `type` is an optional Google Places type such as `cafe`. Returns 400 if the location is invalid or `type` is malformed or unknown to Google, and 502 if Google Places is unavailable.
        9. `boolean hasGem(String name)`
            - **Purpose**: Used by Favorites and by comments and ratings to check a gem exists before acting on it.
        10. `List<Gem> getGems(List<String> names)`
            - **Purpose**: Used by Favorites to load a user's favorite gems in one query, in the order given; names with no gem are left out.
    - Any other method on these paths gets 405 with an `Allow` header. The rating routes check login first, so another method on `/gem/:pk/rating` without a valid token gets 401 instead.
2. **Live Feed**
    - **Purpose**: Pushes newly added gems, and gems whose Gem Score changed after a rating, to the users near them as they happen, so other users' actions appear on the map without refreshing. It runs as a WebSocket on the same server as the REST API. Each connected app tells the server where it is, and when a gem is added or changes, the server sends it to every app whose area contains it. A WebSocket was chosen over polling because new gems should show up immediately and an idle connection costs almost nothing, while polling would mean many empty requests.
    - **Interfaces**:
        1. WebSocket `/feed`, client → server: `{ type: "subscribe", latitude, longitude, radius? }`; server → client: `{ type: "subscribed", latitude, longitude, radius }`
            - **Purpose**: Starts listening for new gems within `radius` metres of the user (default 5000, max 50000). Sending it again moves the area, at most once a second. An invalid message (not JSON, a binary message, an unknown `type`, a location or radius out of range, or a second subscribe within a second) gets `{ type: "error", message }` and the connection stays open. A message over 1024 bytes closes the connection instead (WebSocket close code 1009).
        2. WebSocket `/feed`, server → client: `{ type: "gem.added", gem }`
            - **Purpose**: A gem was just added within the client's area; `gem` is the same gem JSON that `POST /gem` returns.
        3. WebSocket `/feed`, server → client: `{ type: "gem.updated", gem }`
            - **Purpose**: A gem within the client's area changed, e.g. its Gem Score after someone rated it; `gem` is the gem as it is now.
        4. `int publishGemAdded(Gem gem)` and `int publishGemUpdated(Gem gem)`
            - **Purpose**: Called by Gems after a gem is stored or rescored; sends it to every subscribed client in range and returns how many it was sent to. A failure here never fails adding or rating the gem.
3. **Users**
    - **Purpose**: Signs users in with Google and keeps their profile (Google name and display name). After verifying the Google ID token, the server issues its own JSON Web Token (JWT), valid for 7 days, which the app sends as `Authorization: Bearer <token>`. A JWT was chosen over server-side sessions because it survives server restarts and needs no session store; the server still checks the user exists on every request.
    - **Interfaces**:
        1. `POST /user/auth/google { idToken }` → `{ sessionId }`
            - **Purpose**: Signs in with a Google ID token, creating the user on their first sign-in. `sessionId` holds the JWT. Returns 400 if there is no JSON body or `idToken` is missing or not a string, and 401 if Google rejects the token.
        2. `GET /user/me` → `{ id, name: { full, given?, family? }, displayName }`; `PATCH /user/me { displayName }` → the updated profile (both require login)
            - **Purpose**: Reads the signed-in user's profile, and sets the display name other users see on their comments. `name` is the user's name from Google; `given` and `family` are left out when Google doesn't have them. The display name is trimmed and must then be 1–50 characters with no control characters, or `PATCH` returns 400. Both return 401 if not signed in. Signing out is done on the app by discarding the token.
        3. `void reqJwt(Request req, Response res, NextFunction next)`
            - **Purpose**: Express middleware for routes that need a signed-in user: checks the Bearer JWT, loads the user into `req.user`, and answers 401 otherwise. Used by Gems, Favorites and Users.
        4. `User currentUser(Request req)`
            - **Purpose**: Gives a route handler that runs after `reqJwt` the signed-in user, e.g. for a gem's `addedBy`.
4. **Favorites**
    - **Purpose**: Keeps each user's favorite gems on the server, so they follow the user to a new phone and stay separate when several people use the same phone. Every route acts on the signed-in user's own list, so no user ID appears in the URL and nobody can read or change someone else's favorites. Adding a favorite twice changes nothing; a user can have up to 500.
    - **Interfaces**:
        1. `GET /user/favorites` → the favorite gems, most recently added first (requires login)
            - **Purpose**: Loads the favorites screen.
        2. `POST /user/favorites { gem }` → 201 `{ gem }`, or 200 if it already was a favorite (requires login)
            - **Purpose**: Adds a gem to the user's favorites. Returns 400 if `gem` is missing or not `places/<place ID>`, 404 if the gem doesn't exist, and 409 at the 500-favorite limit.
        3. `DELETE /user/favorites/:placeId` → 204 (requires login)
            - **Purpose**: Removes a gem from the user's favorites. Returns 400 if `placeId` is not a valid place ID, and 404 if the gem wasn't a favorite.
    - All three return 401 if not signed in. Login is checked first, so another method on these paths without a valid token gets 401; with a valid token it gets 405 with an `Allow` header.


### **4.2. Databases**
1. **Gems DB (MongoDB, `gems` collection)**
    - **Purpose**: Stores every gem in Excavator. Each gem holds its Google Places place (place ID, display name and location), its type and description, the user who added it, and its Gem Score together with the inputs the score is computed from (the Google rating and review count, the nicheness derived from the review count, and the number and average of Excavator users' ratings) and the time the score was last computed. The location is indexed for geospatial queries, so the discovery screen can load the gems around the user and the dashboard can show nearby gems. Gems are also indexed by type for filtering and by Gem Score for recommendations.
2. **Users DB (MongoDB, `users` collection)**
    - **Purpose**: Stores every Excavator user, keyed by their Google account ID. Each user holds their name from Google and the display name shown to other users. A user is created the first time they sign in with Google, and the same ID is what each gem stores as the user who added it.
3. **Comments DB (MongoDB, `comments` collection)**
    - **Purpose**: Stores the comments users leave on gems. Comments are a weak entity of gems (many comments to one gem): each comment belongs to exactly one gem and is identified by that gem together with its own comment ID, and holds the comment body, the user who wrote it, and their display name at the time (so listing comments needs no user lookups). Comments are indexed by gem, so a gem's comments can be listed oldest first.
4. **Ratings DB (MongoDB, `ratings` collection)**
    - **Purpose**: Stores users' 1–5 star ratings of gems. Ratings are a weak entity of gems, identified by their gem together with the user who gave them, so a user has at most one rating per gem and rating again replaces it. After each rating, MongoDB recounts the gem's ratings and their average, which are stored on the gem for its Gem Score.
5. **Favorites DB (MongoDB, `favorites` collection)**
    - **Purpose**: Stores which gems each user marked as favorites. Users and gems are many-to-many through favorites, so each favorite is its own document identified by the user and the gem together, rather than a list on the user: this keeps them in the order they were added, makes adding the same favorite twice harmless, and keeps user documents small. Favorites are indexed by user and date, so a user's favorites are listed newest first.


### **4.3. External Modules**
1. **Google Places API (New)**
    - **Purpose**: Verifies that a place exists and gets its name, location, type, description, rating and review count when it is added as a gem (Place Details), and lists the places near the user when adding a gem (Nearby Search). Only the backend calls it, so the API key stays on the server.
2. **Google Sign-In**
    - **Purpose**: Authenticates users. The app gets a Google ID token, and the backend verifies it and reads the user's Google account ID and name from it.


### **4.4. Frameworks and Libraries**
1. **Dagger Hilt**
    - **Purpose**: Manages dependency injection automatically and in a centralized way.
    - **Reason**: Easy management of dependencies and allows for easier implementation of fakes while the frontend waits for backend functionality.
2. **Retrofit**
   - **Purpose**: Allows the client app to make HTTP requests and receive HTTP responses from the backend
   - **Reason**: Being able to define API requests as interfaces, combined with Dagger Hilt's dependency injection means that API calling capabilities become as simple as providing an interface as a dependency to another in-app component.
3. **Google Maps**
   - **Purpose**: Leverage Google Maps APIs to add in-app map capabilities
   - **Reason**: The Discovery Screen portion of our app (where you can see Gems on the map) requires the Google Maps API so that users can see the Gems around them, and gems around the world.
4. **Express**
   - **Purpose**: The backend's HTTP server and routing, including nested routers for a gem's comments and rating.
   - **Reason**: The most widely used Node.js web framework, with middleware that suits cross-cutting checks such as login (`reqJwt`).
5. **Mongoose (MongoDB)**
   - **Purpose**: Defines the collections and their indexes, and queries MongoDB, including the geospatial queries for the map.
   - **Reason**: Schemas and typed models on top of MongoDB, whose 2dsphere indexes answer "gems near here" and "gems in this area" directly.
6. **ws**
   - **Purpose**: The Live Feed's WebSocket server, on the same port as the REST API.
   - **Reason**: A small, standard WebSocket library with no client protocol of its own, so the Android app can use OkHttp's built-in WebSocket client.
7. **jsonwebtoken**
   - **Purpose**: Signs and verifies the login tokens (JWTs) the app sends with each request.
   - **Reason**: The standard JWT library for Node.js.
8. **google-auth-library and @googlemaps/places**
   - **Purpose**: Google's official clients for verifying Google sign-in tokens and calling the Places API.
   - **Reason**: Maintained by Google, and handle authentication and retries for us.
9. **Jest, Supertest and mongodb-memory-server**
   - **Purpose**: Backend tests: Jest runs them and measures coverage, Supertest sends HTTP requests to the app, and mongodb-memory-server runs a real MongoDB in memory for the tests without mocks.
   - **Reason**: Jest is the course's required framework; the other two let the no-mock and non-functional tests use the real app and database without any setup.


### **4.5. Dependencies Diagram**
![Dependencies diagram](images/dependencies.png)

Boxes are components, cylinders are MongoDB collections, and an arrow A → B means A calls B through the interfaces on the arrow (listed in 4.1). The app and the Live Feed call each other (A ↔ B): the app sends `subscribe` messages, and the feed pushes `gem.added` and `gem.updated` to the app. All four back-end components run in one Node.js server; Gems, Favorites and Users call each other's interfaces directly in code. Only the back end calls Google Places, so the API key stays on the server. The diagram source is `documentation/diagrams/dependencies.mmd` (Mermaid).

### **4.6. Use Case Sequence Diagram (5 Most Major Use Cases)**
Lifelines are the components and databases of the dependencies diagram (4.5); messages are their interfaces from 4.1. Error replies are shown where they change what the user sees. The diagram sources are in `documentation/diagrams/`.

1. [**View a Gem**](#uc1)\
![View a Gem](images/uc1_view_a_gem.png)
2. [**Add a Gem**](#uc2)\
![Add a Gem](images/uc2_add_a_gem.png)
3. [**Contribute to GemScore**](#uc3)\
![Contribute to GemScore](images/uc3_contribute_to_gemscore.png)
4. [**View new Gems nearby**](#uc4)\
![View new Gems nearby](images/uc4_view_new_gems_nearby.png)
5. [**Initialize session**](#uc5)\
![Initialize session](images/uc5_initialize_session.png)

### **4.7. Design of Non-Functional Requirements**
1. [**Live updates arrive within 1 second**](#nfr1)
    - **Implementation**: Updates are pushed over an open WebSocket rather than polled, so an update leaves the server as soon as the gem is stored. The feed keeps every connection's location in memory, and publishing is a single pass that checks each connection's distance to the gem and sends to those in range; it never touches the database. Publishing happens right after the write and never makes the request wait for or fail on it. Dead connections are dropped by a heartbeat so they don't slow publishing down. Verified by `backend/tests/nfr/feedLatency.test.ts` with 200 users in range and 50 out of range.
2. [**The map stays fast with many gems**](#37-non-functional-requirements)
    - **Implementation**: Gem locations are stored as GeoJSON points with a 2dsphere index, so MongoDB answers "gems near this point" (`$nearSphere`) and "gems inside this map area" (`$geoWithin`) from the index instead of scanning every gem; gems are also indexed by Gem Score for the "best first" order. Every map query has a result limit (at most 50), so responses stay small however many gems match. Verified by `backend/tests/nfr/mapQueryTime.test.ts` with 10,000 gems.

