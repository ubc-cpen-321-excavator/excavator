package com.example.cpen321application.data.remote

import com.example.cpen321application.data.remote.Constants.Companion.COMMENT_ENDPOINT
import com.example.cpen321application.domain.models.Comment
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path


interface CommentAPIService {

    @GET(COMMENT_ENDPOINT)
    suspend fun getComments(
        @Path(value="pk",encoded = true) gemID: String
    ) : Response<List<Comment>>

    @POST(COMMENT_ENDPOINT)
    suspend fun postComment(
        @Path(value="pk",encoded = true) gemID: String,
        @Body body: CommentBody
    ) : Response<Comment>

}

data class CommentBody(val body: String)