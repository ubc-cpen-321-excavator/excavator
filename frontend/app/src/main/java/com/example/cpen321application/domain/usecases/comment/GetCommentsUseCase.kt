package com.example.cpen321application.domain.usecases.comment

import com.example.cpen321application.domain.models.Comment
import com.example.cpen321application.domain.repositories.CommentRepository
import com.example.cpen321application.domain.usecases.BaseUseCase
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject

class GetCommentsUseCase @Inject constructor(
    private val repository: CommentRepository
) : BaseUseCase<GetCommentsUseCase.Params, Flow<List<Comment>>>() {

    data class Params (
        val gemID: String
    )

    override suspend fun invoke(parameters: Params): Flow<List<Comment>> {
        return repository.getComments(parameters.gemID)
    }

}