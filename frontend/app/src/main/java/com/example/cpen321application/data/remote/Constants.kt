package com.example.cpen321application.data.remote

import javax.inject.Singleton

@Singleton
class Constants {

    companion object {
        const val GEM_BASE_ENDPOINT = "/gem"
        const val NEWEST_GEMS_ENDPOINT = "$GEM_BASE_ENDPOINT/newest"
        const val NEARBY_GEMS_ENDPOINT = "$GEM_BASE_ENDPOINT/nearby"
        const val GEM_DETAIL_ENDPOINT = "$GEM_BASE_ENDPOINT/{pk}"

        const val PLACES_BASE_ENDPOINT = "/places"
        const val NEARBY_PLACES_ENDPOINT = "$PLACES_BASE_ENDPOINT/nearby"

        const val COMMENT_ENDPOINT = "$GEM_DETAIL_ENDPOINT/comments"
    }

}