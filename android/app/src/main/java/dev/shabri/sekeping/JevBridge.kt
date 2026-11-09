package dev.shabri.sekeping

import android.webkit.WebView
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * OpenCode Zen does not answer browser CORS preflights, so the WebView cannot
 * call it directly. The host app performs the same POST from its own thread and
 * hands the JSON envelope back to the page. No API key is involved: the JEV
 * model used here is the free `jev-1.13-free` one.
 */
object JevBridge {

    fun post(url: String, body: String): String {
        if (!url.startsWith("https://")) {
            return failure("https_required", 0)
        }

        var connection: HttpURLConnection? = null
        return try {
            val conn = (URL(url).openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                connectTimeout = 15000
                readTimeout = 20000
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
                setRequestProperty("Accept", "application/json")
                setRequestProperty("User-Agent", "Sekeping-Android")
            }
            connection = conn
            conn.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }

            val status = conn.responseCode
            val stream = if (status in 200..299) conn.inputStream else conn.errorStream
            val text = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()

            JSONObject()
                .put("ok", status in 200..299)
                .put("status", status)
                .put("body", text)
                .toString()
        } catch (cause: Throwable) {
            failure(cause.message ?: cause.javaClass.simpleName, 0)
        } finally {
            connection?.disconnect()
        }
    }

    /** Run a request without blocking the WebView's JavaBridge thread. */
    fun postAsync(webView: WebView, id: String, url: String, body: String) {
        Thread {
            val envelope = post(url, body)
            webView.post {
                webView.evaluateJavascript(
                    "window.SekepingJevResult&&window.SekepingJevResult(" +
                        JSONObject.quote(id) + "," + JSONObject.quote(envelope) + ");",
                    null,
                )
            }
        }.start()
    }

    private fun failure(message: String, status: Int): String =
        JSONObject()
            .put("ok", false)
            .put("status", status)
            .put("body", "")
            .put("error", message)
            .toString()
}
