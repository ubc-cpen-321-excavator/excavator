package e2e

/** A latitude/longitude pair, used for mock locations and API calls. */
data class GeoPoint(val latitude: Double, val longitude: Double) {

    /** This point moved [metres] due north. */
    fun movedNorth(metres: Double): GeoPoint = copy(latitude = latitude + metres / METRES_PER_DEGREE_LATITUDE)

    private companion object {
        const val METRES_PER_DEGREE_LATITUDE = 111_320.0
    }
}
