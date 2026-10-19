package com.example.cpen321application.model

/**
 * A "gem": a place worth discovering, shown as a pin on the discovery map.
 *
 * Uses plain [latitude] / [longitude] instead of a Google Maps `LatLng` so the same class can later be parsed from
 * the backend's JSON (#11) without the data layer depending on the Maps SDK.
 */
data class Gem(
    val id: String,
    val name: String,
    val description: String,
    val latitude: Double,
    val longitude: Double,
)
