package com.example.cpen321application.presentation.viewmodels

data class UiState<T> (val data: List<T> = emptyList(), val errorMessage: String? = null)
