# Requirements and Design

## 1. Change History

| **Change Date**   | **Modified Sections** | **Rationale** |
| ----------------- | --------------------- | ------------- |
| _Nothing to show_ |

---

## 2. Project Description

[WRITE_PROJECT_DESCRIPTION_HERE]

---

## 3. Requirements Specification

### **3.1. List of Features**


### **3.2. Use Case Diagram**


### **3.3. Actors Description**
1. **[WRITE_NAME_HERE]**: ...
2. **[WRITE_NAME_HERE]**: ...

### **3.4. Use Case Description**
- Use cases for feature 1: [WRITE_FEATURE_1_NAME_HERE]
1. **[WRITE_NAME_HERE]**: ...
2. **[WRITE_NAME_HERE]**: ...
- Use cases for feature 2: [WRITE_FEATURE_2_NAME_HERE]
3. **[WRITE_NAME_HERE]**: ...
4. **[WRITE_NAME_HERE]**: ...
...

### **3.5. Formal Use Case Specifications (5 Most Major Use Cases)**
<a name="uc1"></a>

#### Use Case 1: [WRITE_USE_CASE_1_NAME_HERE]

**Description**: ...

**Primary actor(s)**: ... 
    
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

...

<a name="uc2"></a>

#### Use Case 2: [WRITE_USE_CASE_2_NAME_HERE]
...

### **3.6. Screen Mock-ups**


### **3.7. Non-Functional Requirements**
<a name="nfr1"></a>

1. **[WRITE_NAME_HERE]**
    - **Description**: ...
    - **Justification**: ...
2. ...

---

## 4. Designs Specification
### **4.1. Main Components**
1. **Gems**
    - **Purpose**: Adds, validates, scores and lists gems, and holds their comments. A gem is a Google Places place, identified by its Google name `places/<place ID>`. A place can only be added if it exists on Google Places and is within 200 m of the user. Each new gem gets a Gem Score from 0 to 100 that rewards places that are both well rated and little known: the Google rating is pulled toward 3.0 when there are few reviews (R_adj = (v·rating + 15·3.0) / (v + 15), where v is the review count), quality is Q = (R_adj − 1) / 4, nicheness is N = 1 / (1 + v / 200), and the score is 100 · Q^0.6 · N^0.4. A place with no rating is scored as if it had no rated reviews (v = 0 in R_adj, so Q = 0.5), but its real review count still sets N.
    - **Interfaces**:
        1. `GET /gem?name=places/<place ID>` → the gem
            - **Purpose**: Gets one gem, for its info sheet.
        2. `POST /gem { name, latitude, longitude }` → 201 with the new gem
            - **Purpose**: Adds a place as a gem. `latitude` / `longitude` are the user's location; the place must be within 200 m. The new gem is scored. Returns 400 if `name` or the location is malformed, 409 if the gem already exists, 422 if the place doesn't exist or is too far away, and 502 if Google Places is unavailable.
        3. `GET /gem/nearby?lat&lng[&radius][&limit]` → gems, nearest first
            - **Purpose**: Gems around the user, for the dashboard and discovery screen.
        4. `GET /gem/within?south&west&north&east[&limit]` → gems, highest Gem Score first
            - **Purpose**: Gems inside the visible map area, for the discovery screen.
        5. `GET /gem/newest[?limit]` → gems, newest first
            - **Purpose**: The latest gems, for the dashboard.
        6. `GET /gem/:pk/comments` → `[{ id, body }]`, oldest first; `POST /gem/:pk/comments { body }` → `{ id, body }`
            - **Purpose**: Reads and adds the comments of the gem whose place ID is `pk`.
        7. `GET /place/nearby?lat&lng[&type]` → up to 20 places within 200 m, nearest first, each with `isGem`
            - **Purpose**: Lets the user pick a place that isn't labelled on the map when adding a gem; the app then sends its `name` to `POST /gem`.
    - Any other method on these paths gets 405 with an `Allow` header.
2. **Users**
    - **Purpose**: Signs users in with Google and keeps their sessions and profile (Google name and display name).
    - **Interfaces**:
        1. `POST /user/auth/google { idToken }` → `{ sessionId }`
            - **Purpose**: Signs in with a Google ID token, creating the user on their first sign-in.


### **4.2. Databases**
1. **Gems DB (MongoDB, `gems` collection)**
    - **Purpose**: Stores every gem in Excavator. Each gem holds its Google Places place (place ID, display name and location), its type and description, the user who added it, and its Gem Score together with the inputs the score is computed from (the Google rating and review count, and the nicheness derived from the review count) and the time the score was last computed. The location is indexed for geospatial queries, so the discovery screen can load the gems around the user and the dashboard can show nearby gems. Gems are also indexed by type for filtering and by Gem Score for recommendations.
2. **Users DB (MongoDB, `users` collection)**
    - **Purpose**: Stores every Excavator user, keyed by their Google account ID. Each user holds their name from Google and the display name shown to other users. A user is created the first time they sign in with Google, and the same ID is what each gem stores as the user who added it.
3. **Comments DB (MongoDB, `comments` collection)**
    - **Purpose**: Stores the comments users leave on gems. Comments are a weak entity of gems (many comments to one gem): each comment belongs to exactly one gem and is identified by that gem together with its own comment ID, and holds the comment body. Comments are indexed by gem, so a gem's comments can be listed oldest first.


### **4.3. External Modules**
1. **Google Places API (New)**
    - **Purpose**: Verifies that a place exists and gets its name, location, type, description, rating and review count when it is added as a gem (Place Details), and lists the places near the user when adding a gem (Nearby Search). Only the backend calls it, so the API key stays on the server.
2. **Google Sign-In**
    - **Purpose**: Authenticates users. The app gets a Google ID token, and the backend verifies it and reads the user's Google account ID and name from it.


### **4.4. Frameworks and Libraries**
1. **[WRITE_NAME_HERE]**
    - **Purpose**: ...
    - **Reason**: ...
2. ...


### **4.5. Dependencies Diagram**


### **4.6. Use Case Sequence Diagram (5 Most Major Use Cases)**
1. [**[WRITE_NAME_HERE]**](#uc1)\
[SEQUENCE_DIAGRAM_HERE]
2. ...


### **4.7. Design of Non-Functional Requirements**
1. [**[WRITE_NAME_HERE]**](#nfr1)
    - **Implementation**: ...
2. ...
