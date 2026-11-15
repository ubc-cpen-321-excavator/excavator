package com.example.cpen321application.domain.usecases.comment

import com.example.cpen321application.data.repositories.Resource
import com.example.cpen321application.domain.models.Comment
import com.example.cpen321application.domain.repositories.CommentRepository
import com.example.cpen321application.domain.usecases.BaseUseCase
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject

class AddCommentUseCase @Inject constructor(
    private val repository: CommentRepository
) : BaseUseCase<AddCommentUseCase.Params, Resource<Flow<Comment>>> () {

    data class Params (
        val gemID: String,
        val commentBody: String
    )

    override suspend fun invoke(parameters: Params) : Resource<Flow<Comment>> {
        return repository.addComment(parameters.gemID, parameters.commentBody)
    }


}