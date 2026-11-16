package com.example.cpen321application.presentation.viewmodels


import com.example.cpen321application.data.repositories.Resource
import com.example.cpen321application.domain.models.Comment
import com.example.cpen321application.domain.usecases.comment.AddCommentUseCase
import com.example.cpen321application.domain.usecases.comment.GetCommentsUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject


@HiltViewModel
class CommentViewModel @Inject constructor(
    private val getCommentsUseCase: GetCommentsUseCase,
    private val addCommentUseCase: AddCommentUseCase
) : BaseViewModel() {

    private val _commentState: MutableStateFlow<CommentUiState> = MutableStateFlow(CommentUiState())
    val commentState = _commentState.asStateFlow()

    private val _addedCommentState = MutableStateFlow<Comment?>(null)
    val addedCommentState = _addedCommentState.asStateFlow()


    fun getComments(gemID: String) {
        launch {
            when (val result = getCommentsUseCase(GetCommentsUseCase.Params(gemID))) {
                is Resource.Error -> {handleError(result.message)}
                else -> {
                    result.data?.collect {
                        _commentState.value = _commentState.value.copy(
                            comments = it,
                            errorMessage = null
                        )
                    }
                }
            }
        }
    }

    fun addComment(gemID: String, commentBody: String) {
        launch {
            when (val result = addCommentUseCase(AddCommentUseCase.Params(gemID, commentBody))) {
                is Resource.Error -> {handleError(result.message!!)}
                else -> {
                    result.data?.collect { newComment ->
                        _commentState.value = _commentState.value.copy(
                            comments = _commentState.value.comments + newComment
                        )
                    }
                }
            }

        }
    }


    override fun handleError(errorMessage: String?) {
        _commentState.value = _commentState.value.copy(
            errorMessage = errorMessage ?: "An error occured"
        )

    }

}

data class CommentUiState(
    val comments: List<Comment> = emptyList(),
    val errorMessage: String? = null
)