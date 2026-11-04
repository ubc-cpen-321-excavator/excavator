package com.example.cpen321application.data.repositories

import com.example.cpen321application.data.remote.CommentAPIService
import com.example.cpen321application.data.remote.CommentBody
import com.example.cpen321application.domain.models.Comment
import com.example.cpen321application.domain.repositories.CommentRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import retrofit2.Response
import javax.inject.Inject

class CommentRepositoryImpl @Inject constructor(
    private val service: CommentAPIService
) : CommentRepository{

    override suspend fun getComments(gemID: String): Flow<List<Comment>> {
        val response: Response<List<Comment>> = service.getComments(
            gemID
        )

        if (response.isSuccessful) {
            return MutableStateFlow(
                response.body()!!
            )
        } else {
            // TODO: Update this to be a more descriptive error
            throw Exception("Non 200 Response")
        }
    }

    override suspend fun addComment(
        gemID: String,
        newCommentBody: String
    ) : Flow<Comment> {

        // Do nothing with the response for CP2
        val response: Response<Comment> = service.postComment(gemID, CommentBody(newCommentBody))

        if (response.isSuccessful) {
            return MutableStateFlow(
                response.body()!!
            )
        } else {
            // TODO: Update this to be a more descriptive error
            throw Exception("Non 200 Response")
        }

    }


}