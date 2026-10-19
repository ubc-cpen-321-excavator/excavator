package com.example.cpen321application.domain.usecases

abstract class BaseUseCase<in P, R> {
    abstract suspend operator fun invoke(parameters: P): R
}