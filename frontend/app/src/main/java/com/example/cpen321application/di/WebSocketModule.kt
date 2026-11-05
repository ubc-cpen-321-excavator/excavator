package com.example.cpen321application.di

import com.example.cpen321application.BuildConfig
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.concurrent.TimeUnit
import javax.inject.Qualifier
import javax.inject.Singleton


@Qualifier
@Retention(AnnotationRetention.BINARY)
annotation class WebSocketClient

@Module
@InstallIn(SingletonComponent::class)
object WebSocketModule {

    @Provides
    @Singleton
    @WebSocketClient
    fun provideWebSocketOkHttpClient(okHttpClient: OkHttpClient): OkHttpClient =
        okHttpClient.newBuilder()
            .pingInterval(30, TimeUnit.SECONDS)
            .build()

    @Provides
    @Singleton
    @WebSocketClient
    fun provideWebSocketRequest(): Request =
        Request.Builder()
            .url(BuildConfig.WS_ENDPOINT)
            .build()
}