package com.example.cpen321application.domain.repositories

import com.example.cpen321application.domain.models.Comment
import kotlinx.coroutines.flow.Flow

interface CommentRepository {

    suspend fun getComments(gemID: String): Flow<List<Comment>>

    // Do nothing with the returned new comment at the moment
    suspend fun addComment(gemID: String, newCommentBody: String) : Flow<Comment>

}