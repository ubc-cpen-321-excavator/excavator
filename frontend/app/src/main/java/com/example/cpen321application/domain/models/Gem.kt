package com.example.cpen321application.domain.models

import com.google.android.gms.maps.model.LatLng

data class Gem (
    // Other attributes to be added later
    val title: String,
    val coords: LatLng,
    val placesName: String
)