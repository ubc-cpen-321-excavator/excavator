package com.example.cpen321application.di

import com.example.cpen321application.data.dto.GemDTO
import com.example.cpen321application.data.mappers.CommentListMapper
import com.example.cpen321application.data.mappers.CommentMapper
import com.example.cpen321application.data.mappers.GemMapper
import com.example.cpen321application.data.mappers.Mapper
import com.example.cpen321application.domain.models.Comment
import com.example.cpen321application.domain.models.Gem
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Qualifier
import javax.inject.Singleton


@Qualifier
@Retention(AnnotationRetention.BINARY)
annotation class InjectGemMapper

@Qualifier
@Retention(AnnotationRetention.BINARY)
annotation class InjectCommentMapper

@Qualifier
@Retention(AnnotationRetention.BINARY)
annotation class InjectCommentListMapper

@Module
@InstallIn(SingletonComponent::class)
object MapperModule {

    @InjectGemMapper
    @Provides
    @Singleton
    fun provideGemMapper() : Mapper<Gem, GemDTO> {
        return GemMapper()
    }

    @InjectCommentMapper
    @Provides
    @Singleton
    fun provideCommentMapper(): Mapper<Comment, Comment> {
        return CommentMapper()
    }

    @InjectCommentListMapper
    @Provides
    @Singleton
    fun provideCommentListMapper(): Mapper<List<Comment>, List<Comment>> {
        return CommentListMapper()
    }

}

