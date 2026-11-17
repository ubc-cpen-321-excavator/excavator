package com.example.cpen321application.presentation.viewmodels

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch

abstract class BaseViewModel: ViewModel() {


    protected fun <T> getErrorState(errorMessage: String?, uiState: UiState<T>) : UiState<T> {
        return uiState.copy(
            errorMessage = errorMessage ?: "Something went wrong"
        )
    }

    protected fun <T> launch(block: suspend ()-> T) {

        viewModelScope.launch {
            block()
        }
    }
}