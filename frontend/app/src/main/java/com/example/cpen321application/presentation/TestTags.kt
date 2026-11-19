package com.example.cpen321application.presentation

/**
 * Modifier.testTag values shared by the composables and the end-to-end tests in androidTest/e2e.
 * They only identify nodes for tests and have no effect on how the app looks or behaves.
 */
object TestTags {
    // Discovery: Add Gem sheet
    const val ADD_GEM_BUTTON = "add_gem_button"
    const val FILTERS_BUTTON = "filters_button"
    const val SUBMIT_BUTTON = "submit_button"
    const val CANDIDATE_LIST = "candidate_list"
    const val CANDIDATE_CARD = "candidate_card"

    // Discovery: gem sheet
    const val GEM_INFO_SHEET = "gem_info_sheet"
    const val GEM_TITLE = "gem_title"
    const val FAVORITE_BUTTON = "favorite_button"
    const val COMMENT_LIST = "comment_list"
    const val COMMENT_CARD = "comment_card"
    const val COMMENT_AUTHOR = "comment_author"
    const val COMMENT_BODY = "comment_body"
    const val COMMENT_INPUT = "comment_input"
    const val SEND_COMMENT_BUTTON = "send_comment_button"

    // Dashboard and Favorites
    const val LATEST_GEMS_GRID = "latest_gems_grid"
    const val FAVORITES_GRID = "favorites_grid"
    const val GEM_CARD = "gem_card"
    const val FAVORITE_BADGE = "favorite_badge"

    fun filterCategory(label: String): String = "filter_category_$label"

    fun filterChip(label: String): String = "filter_chip_$label"
}
