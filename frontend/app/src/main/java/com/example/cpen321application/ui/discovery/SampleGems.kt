package com.example.cpen321application.ui.discovery

import com.example.cpen321application.model.Gem

/**
 * Placeholder gems around UBC so the map has pins to show during the Maps spike (#16).
 *
 * The Discovery Screen MVP (#11) replaces this list with gems loaded from the backend.
 */
internal val sampleGems: List<Gem> = listOf(
    Gem(
        id = "nitobe-garden",
        name = "Nitobe Memorial Garden",
        description = "Quiet Japanese garden tucked behind the Asian Centre.",
        latitude = 49.2665,
        longitude = -123.2594,
    ),
    Gem(
        id = "rose-garden",
        name = "UBC Rose Garden",
        description = "Terrace overlooking the water and the North Shore mountains.",
        latitude = 49.2694,
        longitude = -123.2566,
    ),
    Gem(
        id = "wreck-beach",
        name = "Wreck Beach",
        description = "Long sandy beach at the bottom of the Trail 6 staircase. Great at sunset.",
        latitude = 49.2622,
        longitude = -123.2615,
    ),
    Gem(
        id = "botanical-garden",
        name = "UBC Botanical Garden",
        description = "Canada's oldest university botanical garden, with a treetop canopy walkway.",
        latitude = 49.2532,
        longitude = -123.2499,
    ),
)
