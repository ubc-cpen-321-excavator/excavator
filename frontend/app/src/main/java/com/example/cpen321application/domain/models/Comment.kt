package com.example.cpen321application.domain.models

data class Comment(
    val id: String, val body: String,
    val author: String?, val authorName: String?
)
