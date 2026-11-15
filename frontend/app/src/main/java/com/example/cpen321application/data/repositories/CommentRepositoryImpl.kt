package com.example.cpen321application.data.repositories

import com.example.cpen321application.data.remote.CommentAPIService
import com.example.cpen321application.data.remote.CommentBody
import com.example.cpen321application.domain.models.Comment
import com.example.cpen321application.domain.repositories.CommentRepository
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject

class CommentRepositoryImpl @Inject constructor(
    private val service: CommentAPIService
) : CommentRepository, BaseRemoteRepo(){

    override suspend fun getComments(gemID: String): Resource<Flow<List<Comment>>> {

        return safeApiCall { service.getComments(gemID) }

    }

    override suspend fun addComment(
        gemID: String,
        newCommentBody: String
    ) : Resource<Flow<Comment>> {

        return safeApiCall { service.postComment(gemID, CommentBody(newCommentBody)) }

    }


}