package com.example.cpen321application.presentation.viewmodels

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.launch

abstract class BaseViewModel: ViewModel() {


    protected abstract fun handleError(errorMessage: String?)

    protected fun <T> launch(block: suspend ()-> T) {

        viewModelScope.launch {
            block()
        }
    }
}