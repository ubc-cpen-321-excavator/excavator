package com.example.cpen321application.di

import com.example.cpen321application.data.remote.CommentAPIService
import com.example.cpen321application.data.repositories.CommentRepositoryImpl
import com.example.cpen321application.domain.repositories.CommentRepository
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton


@Module
@InstallIn(SingletonComponent::class)
object CommentModule {

    @Provides
    @Singleton
    fun provideCommentRepository(
        commentAPIService: CommentAPIService
    ) : CommentRepository {
        return CommentRepositoryImpl(commentAPIService)
    }

}