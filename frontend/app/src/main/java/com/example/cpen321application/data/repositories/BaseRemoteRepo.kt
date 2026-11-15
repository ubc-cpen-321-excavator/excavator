package com.example.cpen321application.data.repositories

import com.example.cpen321application.data.remote.error.APIErrorResponse
import com.google.gson.Gson
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.withContext
import okhttp3.ResponseBody
import retrofit2.HttpException
import retrofit2.Response
import java.io.IOException

abstract class BaseRemoteRepo() {

    // we'll use this function in all
    // repos to handle api errors.
    suspend fun <T> safeApiCall(apiToBeCalled: suspend () -> Response<T>): Resource<Flow<T>> {

        // Returning api response
        // wrapped in Resource class
        return withContext(Dispatchers.IO) {
            try {

                // Here we are calling api lambda
                // function that will return response
                // wrapped in Retrofit's Response class
                val response: Response<T> = apiToBeCalled()

                if (response.isSuccessful) {
                    // In case of success response we
                    // are returning Resource.Success object
                    // by passing our data in it.
                    Resource.Success(
                        data = MutableStateFlow(response.body()!!)
                    )
                } else {
                    val errorResponse: APIErrorResponse? = convertErrorBody(response.errorBody())
                    // Simply returning api's own failure message
                    Resource.Error(errorMessage = errorResponse?.message ?: "Something went wrong")
                }

            } catch (e: HttpException) {
                // Returning HttpException's message
                // wrapped in Resource.Error
                Resource.Error(errorMessage = e.message ?: "Something went wrong")
            } catch (e: IOException) {
                // Returning no internet message
                // wrapped in Resource.Error
                Resource.Error("Please check your network connection")
            } catch (e: Exception) {
                // Returning 'Something went wrong' in case
                // of unknown error wrapped in Resource.Error
                Resource.Error(errorMessage = "Something went wrong")
            }
        }
    }

    // If you don't wanna handle api's own
    // custom error response then ignore this function
    private fun convertErrorBody(errorBody: ResponseBody?): APIErrorResponse? {
        return try {
            errorBody?.charStream()?.use { reader ->
                Gson().fromJson(reader, APIErrorResponse::class.java)
            }
        } catch (exception: Exception) {
            null
        }
    }
}