package dev.shabri.sekeping

import android.annotation.SuppressLint
import android.content.Intent
import android.graphics.Color
import android.view.ViewGroup
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat

/**
 * Builds the same offline WebView the main activity uses, for the two dialog
 * surfaces: the widget setup sheet and the quick-add sheet.
 */
object WebAppHost {

    const val BASE_URL = "https://appassets.androidplatform.net/assets/www/index.html"

    fun url(query: String? = null): String = if (query.isNullOrBlank()) BASE_URL else "$BASE_URL?$query"

    @SuppressLint("SetJavaScriptEnabled")
    fun create(activity: AppCompatActivity, bridge: Any, transparent: Boolean): WebView {
        val loader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(activity))
            .build()
        val fileChooser = FileChooserHost(activity)

        return WebView(activity).apply {
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT,
            )
            setBackgroundColor(
                if (transparent) Color.TRANSPARENT
                else ContextCompat.getColor(activity, R.color.paper),
            )

            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                databaseEnabled = true
                allowFileAccess = false
                allowContentAccess = true
                setSupportZoom(false)
                builtInZoomControls = false
                displayZoomControls = false
                mediaPlaybackRequiresUserGesture = true
            }

            webChromeClient = fileChooser.client

            webViewClient = object : WebViewClientCompat() {
                override fun shouldInterceptRequest(
                    view: WebView,
                    request: WebResourceRequest,
                ): WebResourceResponse? = loader.shouldInterceptRequest(request.url)

                override fun shouldOverrideUrlLoading(
                    view: WebView,
                    request: WebResourceRequest,
                ): Boolean {
                    val url = request.url
                    if (url.host == "appassets.androidplatform.net") return false
                    runCatching { activity.startActivity(Intent(Intent.ACTION_VIEW, url)) }
                    return true
                }
            }

            addJavascriptInterface(bridge, "SekepingWidget")
        }
    }
}
