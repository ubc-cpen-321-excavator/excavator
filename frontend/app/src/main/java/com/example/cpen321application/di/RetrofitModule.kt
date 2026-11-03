package com.example.cpen321application.di

import com.example.cpen321application.BuildConfig
import com.example.cpen321application.data.remote.GemAPIService
import com.example.cpen321application.utils.auth.AuthAPIService
import com.example.cpen321application.utils.interceptors.AuthInterceptor
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object RetrofitModule {

    @Provides
    @Singleton
    fun provideOkHttpClient(authInterceptor: AuthInterceptor): OkHttpClient =
        OkHttpClient.Builder()
            .addInterceptor(authInterceptor)
            .build()

    @Provides
    @Singleton
    fun provideRetrofit(okHttpClient: OkHttpClient): Retrofit =
        Retrofit.Builder()
        .baseUrl(BuildConfig.API_BASE_URL)
        .client(okHttpClient)
        .addConverterFactory(GsonConverterFactory.create())
        .build()

    @Provides
    @Singleton
    fun provideAuthAPIService(retrofit: Retrofit) : AuthAPIService {
        return retrofit.create(AuthAPIService::class.java)
    }

    @Provides
    @Singleton
    fun provideGemAPIService(retrofit: Retrofit) : GemAPIService {
        return retrofit.create(GemAPIService::class.java)
    }


}