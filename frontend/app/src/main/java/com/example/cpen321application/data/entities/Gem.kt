package com.example.cpen321application.data.entities

import com.google.android.gms.maps.model.LatLng
import java.time.LocalDateTime
import kotlin.random.Random

data class Gem (
    // Other attributes to be added later
    val title: String,
    val coords: LatLng
) {

    // Add some randomness to the dateTimeCreated so sorting by datetime can be checked
    var dateTimeCreated: LocalDateTime = LocalDateTime.now().plusDays(Random.nextLong(0,25))
        private set
}
