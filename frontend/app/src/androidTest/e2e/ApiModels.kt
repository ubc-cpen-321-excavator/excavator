package e2e

import org.json.JSONObject

/** A place from GET /place/nearby. [displayName] is what the app shows in its list of places. */
data class ApiPlace(val name: String, val displayName: String, val isGem: Boolean) {

    companion object {
        fun from(json: JSONObject): ApiPlace {
            val name = json.getString("name")
            return ApiPlace(
                name = name,
                displayName = json.optString("displayName").ifEmpty { name },
                isGem = json.optBoolean("isGem", false),
            )
        }
    }
}

/** A gem as the backend returns it. [title] is what the app shows: the place's display name, else its name. */
data class ApiGem(val name: String, val title: String, val addedBy: String?) {

    companion object {
        fun from(json: JSONObject): ApiGem {
            val name = json.getString("name")
            val displayName = json.optJSONObject("place")?.optString("displayName").orEmpty()
            return ApiGem(
                name = name,
                title = displayName.ifEmpty { name },
                addedBy = json.optString("addedBy").ifEmpty { null },
            )
        }
    }
}

/** Status code and body of one HTTP response. */
data class HttpResult(val code: Int, val body: String)
