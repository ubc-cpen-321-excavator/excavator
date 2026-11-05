package com.example.cpen321application.data.remote

import javax.inject.Singleton

@Singleton
class Constants {

    companion object {

        // Gem endpoints
        const val GEM_BASE_ENDPOINT = "/gem"
        const val NEWEST_GEMS_ENDPOINT = "$GEM_BASE_ENDPOINT/newest"
        const val NEARBY_GEMS_ENDPOINT = "$GEM_BASE_ENDPOINT/nearby"
        const val GEM_DETAIL_ENDPOINT = "$GEM_BASE_ENDPOINT/{pk}"

        // Places endpoints
        const val PLACES_BASE_ENDPOINT = "/places"
        const val NEARBY_PLACES_ENDPOINT = "$PLACES_BASE_ENDPOINT/nearby"

        // Comments endpoints
        const val COMMENT_ENDPOINT = "$GEM_DETAIL_ENDPOINT/comments"

        // User & favorites endpoints
        const val USERS_BASE_ENDPOINT = "/user"

        const val USER_FAVORITE_GEMS_ENDPOINT = "$USERS_BASE_ENDPOINT/favorites"

        const val USER_FAVORITE_GEMS_DETAIL_ENDPOINT = "$USER_FAVORITE_GEMS_ENDPOINT/{placeId}"

    }

}