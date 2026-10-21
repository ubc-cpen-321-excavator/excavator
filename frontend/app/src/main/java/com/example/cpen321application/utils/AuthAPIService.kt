package com.example.cpen321application.utils

import com.example.cpen321application.BuildConfig
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.POST

private const val GOOGLE_AUTH_ENDPOINT = "user/auth/google"

interface AuthAPIService {
    @POST(GOOGLE_AUTH_ENDPOINT)
    @Headers("Content-Type: application/json")
    suspend fun googleSignin(@Body body: GoogleSigninRequest) : Response<String>
}

data class GoogleSigninRequest(val idToken: String)
