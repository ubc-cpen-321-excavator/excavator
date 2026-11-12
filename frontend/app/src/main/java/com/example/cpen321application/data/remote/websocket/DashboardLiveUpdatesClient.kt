package com.example.cpen321application.data.remote.websocket

import android.util.Log
import com.example.cpen321application.data.dto.GemDTO
import com.example.cpen321application.data.remote.websocket.models.FeedEvent
import com.example.cpen321application.data.remote.websocket.models.FeedSubscription
import com.example.cpen321application.data.remote.websocket.models.SocketState
import com.example.cpen321application.di.WebSocketClient
import com.google.gson.Gson
import com.google.gson.JsonParser
import com.google.gson.annotations.SerializedName
import kotlinx.coroutines.channels.BufferOverflow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import javax.inject.Inject
import javax.inject.Singleton

/** What we send. Gson omits a null radius, so the server uses its 5000 m default. */
private data class SubscribeMessage(
    @SerializedName("latitude") val latitude: Double,
    @SerializedName("longitude") val longitude: Double,
    @SerializedName("radius") val radius: Int? = null,
    @SerializedName("type") val type: String = "subscribe"
)

@Singleton
class DashboardLiveUpdatesClient @Inject constructor(
    @param:WebSocketClient private val client: OkHttpClient,
    @param:WebSocketClient private val request: Request
) {
    @Volatile
    private var webSocket: WebSocket? = null

    /** Re-sent on every open, since the server forgets it when the socket closes. */
    @Volatile
    private var subscription: FeedSubscription? = null

    private val gson = Gson()

    private val _state = MutableStateFlow<SocketState>(SocketState.Disconnected)
    val state: StateFlow<SocketState> = _state.asStateFlow()

    private val _events = MutableSharedFlow<FeedEvent>(
        extraBufferCapacity = 64,
        onBufferOverflow = BufferOverflow.DROP_OLDEST
    )
    val events: SharedFlow<FeedEvent> = _events.asSharedFlow()

    /** Opens the connection. No-op if already connecting or connected. */
    @Synchronized
    fun connect() {
        if (webSocket != null) return
        _state.value = SocketState.Connecting
        webSocket = client.newWebSocket(request, listener)
    }

    /**
     * Subscribes to Gems near a location, or moves the existing subscription.
     * Safe to call before the socket is open: it is sent as soon as the connection opens.
     *
     * The server allows one subscribe per second per client and replies with an error
     * event beyond that, so debounce rapid location updates in the caller.
     *
     * @param radiusM metres, 1..50000; null uses the server default (5000).
     */
    fun subscribe(latitude: Double, longitude: Double, radiusM: Int? = null) {
        val sub = FeedSubscription(latitude, longitude, radiusM?.coerceIn(1, MAX_RADIUS_M))
        subscription = sub
        if (_state.value == SocketState.Connected) {
            webSocket?.let { sendSubscription(it, sub) }
        }
    }

    /** Closes the connection and forgets the subscription. Safe to call when not connected. */
    @Synchronized
    fun disconnect() {
        subscription = null
        webSocket?.close(NORMAL_CLOSURE, "Client closing")
        webSocket = null
        _state.value = SocketState.Disconnected
    }

    private fun sendSubscription(ws: WebSocket, sub: FeedSubscription) {
        ws.send(gson.toJson(SubscribeMessage(sub.latitude, sub.longitude, sub.radius)))
    }

    private fun parseEvent(text: String): FeedEvent? = try {
        val obj = JsonParser.parseString(text).asJsonObject
        when (obj.get("type")?.asString) {
            "subscribed" -> FeedEvent.Subscribed(
                latitude = obj.get("latitude").asDouble,
                longitude = obj.get("longitude").asDouble,
                radius = obj.get("radius").asInt
            )
            "gem.added" -> {
                val gem = gson.fromJson(obj.get("gem"), GemDTO::class.java)
                if (gem.isComplete()) FeedEvent.GemAdded(gem) else null
            }
            "error" -> FeedEvent.Error(obj.get("message")?.asString ?: "Unknown error")
            else -> null // unknown event type: ignore
        }
    } catch (e: Exception) {
        Log.w(TAG, "Dropping unparseable feed message", e)
        null
    }

    /** Gson ignores Kotlin nullability, so required fields can be null at runtime. */
    @Suppress("SENSELESS_COMPARISON")
    private fun GemDTO?.isComplete(): Boolean =
        this != null && name != null && place != null && place.name != null

    private val listener = object : WebSocketListener() {

        override fun onOpen(ws: WebSocket, response: Response) {
            if (ws !== webSocket) return
            _state.value = SocketState.Connected
            subscription?.let { sendSubscription(ws, it) } // restore after reconnect
        }

        override fun onMessage(ws: WebSocket, text: String) {
            parseEvent(text)?.let { _events.tryEmit(it) }
        }

        override fun onClosing(ws: WebSocket, code: Int, reason: String) {
            ws.close(code, reason) // complete the closing handshake
        }

        override fun onClosed(ws: WebSocket, code: Int, reason: String) {
            if (clearIfCurrent(ws)) _state.value = SocketState.Disconnected
        }

        override fun onFailure(ws: WebSocket, t: Throwable, response: Response?) {
            if (clearIfCurrent(ws)) _state.value = SocketState.Failed(t, response?.code)
        }
    }

    /** Clears the stored socket only if [ws] is the current one; stale callbacks are ignored. */
    @Synchronized
    private fun clearIfCurrent(ws: WebSocket): Boolean {
        if (ws !== webSocket) return false
        webSocket = null
        return true
    }

    private companion object {
        const val TAG = "DashboardLiveUpdates"
        const val NORMAL_CLOSURE = 1000
        const val MAX_RADIUS_M = 50_000 // server's FEED_RADIUS_MAX_M
    }
}