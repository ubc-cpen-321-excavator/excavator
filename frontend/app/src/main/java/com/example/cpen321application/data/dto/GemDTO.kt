package com.example.cpen321application.data.dto

data class Place(
    val name: String, val displayName: String?=null,
    val latitude: Double, val longitude: Double,
    val type: String?=null, val description: String?=null
)

data class GemDTO(
    val name: String, val place: Place,
    val addedBy: String?=null, val score: Double?=null,
    val scoreTime: Long?=null, val nicheness: Double?=null,
    val quality: Double?=null, val reviewCount: Int?=null,
    val ratingCount: Int?=null, val ratingAverage: Double?=null
)

data class GemCandidate (
    val name: String, val displayName: String,
    val type: String, val address: String?,
    val latitude: Double, val longitude: Double,
    val distance: Int, val isGem: Boolean
)

