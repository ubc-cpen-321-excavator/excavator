package com.example.cpen321application.domain.repositories

import com.example.cpen321application.data.repositories.Resource
import com.example.cpen321application.domain.models.Comment
import kotlinx.coroutines.flow.Flow

interface CommentRepository {

    suspend fun getComments(gemID: String): Resource<Flow<List<Comment>>>

    // Do nothing with the returned new comment at the moment
    suspend fun addComment(gemID: String, newCommentBody: String) : Resource<Flow<Comment>>

}