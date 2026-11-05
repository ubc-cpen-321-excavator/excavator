package com.example.cpen321application.presentation.viewmodels

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
    private val addCommentsUseCase: AddCommentUseCase
) : BaseViewModel() {

    private val _commentState = MutableStateFlow<List<Comment>>(emptyList())
    val commentState = _commentState.asStateFlow()

    private val _addedCommentState = MutableStateFlow<Comment?>(null)
    val addedCommentState = _addedCommentState.asStateFlow()

    fun getComments(gemID: String) {
        launch {
            getCommentsUseCase(
                GetCommentsUseCase.Params(gemID)
            ).collect { comments ->
                _commentState.value = comments
            }
        }
    }

    fun addComment(gemID: String, commentBody: String) {
        launch {
            addCommentsUseCase(
                AddCommentUseCase.Params(gemID, commentBody)
            ).collect { addedComment ->
                _addedCommentState.value = addedComment
                _commentState.value += addedComment
            }
        }
    }


    override fun handleError(error: Exception) {
        // TODO: For CP3, do something with this error
        throw error // Propagate the error for now
    }


}