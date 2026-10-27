package com.example.cpen321application.data.entities

import java.time.LocalDateTime
import kotlin.random.Random

data class Gem (
    // Other attributes to be added later
    val title: String,
) {

    // Add some randomness to the dateTimeCreated so sorting by datetime can be checked
    var dateTimeCreated: LocalDateTime = LocalDateTime.now().plusDays(Random.nextLong(0,25))
        private set
}
