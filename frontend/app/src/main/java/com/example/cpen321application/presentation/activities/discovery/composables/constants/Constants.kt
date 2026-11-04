package com.example.cpen321application.presentation.activities.discovery.composables.constants

import com.example.cpen321application.domain.models.Gem
import com.google.android.gms.maps.model.LatLng

class Constants {

    companion object {
        // Map constants
        const val CAMERA_PAN_DURATION_MS = 500
        const val CAMERA_INIT_ZOOM_FACTOR = 15f

        val PLACEHOLDER_COORDINATES = LatLng(43.516667, 28.333333)

        val PLACEHOLDER_SELECTED_GEM = Gem(
            title = "Placeholder",
            coords = LatLng(1.0, 1.0),
            placesName = "Placeholder places name"
        )

    }

}