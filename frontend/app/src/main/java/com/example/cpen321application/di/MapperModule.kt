package com.example.cpen321application.di

import com.example.cpen321application.data.dto.GemCandidate
import com.example.cpen321application.data.dto.GemDTO
import com.example.cpen321application.data.mappers.comments.CommentListMapper
import com.example.cpen321application.data.mappers.comments.CommentMapper
import com.example.cpen321application.data.mappers.gems.GemListMapper
import com.example.cpen321application.data.mappers.gems.GemMapper
import com.example.cpen321application.data.mappers.Mapper
import com.example.cpen321application.data.mappers.gems.GemCandidateListMapper
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
annotation class InjectGemListMapper

@Qualifier
@Retention(AnnotationRetention.BINARY)
annotation class InjectCommentMapper

@Qualifier
@Retention(AnnotationRetention.BINARY)
annotation class InjectCommentListMapper

@Qualifier
@Retention(AnnotationRetention.BINARY)
annotation class InjectGemCandidatesMapper

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

    @InjectGemListMapper
    @Provides
    @Singleton
    fun provideGemListMapper(@InjectGemMapper gemMapper: Mapper<Gem,GemDTO>): Mapper<List<Gem>, List<GemDTO>> {
        return GemListMapper(gemMapper)
    }

    @InjectGemCandidatesMapper
    @Provides
    @Singleton
    fun providesGemCandidatesMapper(): Mapper<List<GemCandidate>, List<GemCandidate>> {
        return GemCandidateListMapper()
    }


}

