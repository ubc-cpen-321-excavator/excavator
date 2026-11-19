package e2e

/** Fixed values shared by the end-to-end tests. */
object E2EConfig {

    const val APP_PACKAGE = "com.example.cpen321application"

    /** SharedPreferences file and key where the app keeps the signed-in user's JWT (see TokenStore). */
    const val PREFS_FILE = "auth"
    const val PREFS_TOKEN_KEY = "jwt"

    /**
     * Busy blocks in downtown Vancouver, away from the team's demo area. Tests pretend to be in one of
     * them (mock location). The first one holds the shared gem that most tests reuse; the others are
     * only used once the first has no places left that are not gems yet.
     */
    val TEST_AREAS = listOf(
        GeoPoint(49.2820, -123.1207),
        GeoPoint(49.2849, -123.1166),
        GeoPoint(49.2790, -123.1240),
        GeoPoint(49.2862, -123.1300),
        GeoPoint(49.2765, -123.1185),
    )
    val SHARED_GEM_AREA = TEST_AREAS.first()

    /** Open water in the Strait of Georgia: no Google Places within 200 m. */
    val EMPTY_AREA = GeoPoint(49.2000, -123.6000)

    const val NEARBY_RADIUS_M = 200
    const val MOVE_AWAY_M = 500.0
    const val RESTAURANT_TYPE = "restaurant"
    const val MAX_FAVORITES = 500
    const val MAX_COMMENT_LENGTH = 256

    /** Every comment a test posts starts with this, so leftovers are easy to recognise. */
    const val COMMENT_PREFIX = "E2E test comment"

    const val UI_TIMEOUT_MS = 15_000L
    const val MARKER_TIMEOUT_MS = 20_000L

    /** The app asks for a location fix every 10 s (LocationUtil), so wait a little longer than that. */
    const val LOCATION_SETTLE_MS = 12_000L
}
