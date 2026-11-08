package dev.shabri.sekeping

import android.annotation.SuppressLint
import android.content.Intent
import android.content.res.Configuration
import android.graphics.drawable.ColorDrawable
import android.net.Uri
import android.os.Bundle
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView

    private val assetLoader: WebViewAssetLoader by lazy {
        WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        webView = WebView(this).apply {
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT,
            )
            setBackgroundColor(ContextCompat.getColor(this@MainActivity, R.color.paper))

            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                databaseEnabled = true
                allowFileAccess = false
                allowContentAccess = false
                setSupportZoom(false)
                builtInZoomControls = false
                displayZoomControls = false
                mediaPlaybackRequiresUserGesture = true
            }

            webViewClient = object : WebViewClientCompat() {
                override fun shouldInterceptRequest(
                    view: WebView,
                    request: WebResourceRequest,
                ): WebResourceResponse? = assetLoader.shouldInterceptRequest(request.url)

                override fun shouldOverrideUrlLoading(
                    view: WebView,
                    request: WebResourceRequest,
                ): Boolean {
                    val url = request.url
                    if (url.host == "appassets.androidplatform.net") return false
                    runCatching { startActivity(Intent(Intent.ACTION_VIEW, url)) }
                    return true
                }
            }

            addJavascriptInterface(WidgetBridge(), "SekepingWidget")
        }

        setContentView(webView)
        applySystemTheme(resources.configuration)

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState)
        } else {
            webView.loadUrl(startUrl(intent))
        }

        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    if (webView.canGoBack()) webView.goBack() else finish()
                }
            },
        )
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        applySystemTheme(newConfig)
    }

    /**
     * uiMode is handled in the manifest, so the activity is not recreated when the system
     * switches light and dark. Bars and the WebView backdrop are re-applied here; the page
     * itself follows the same setting through prefers-color-scheme.
     */
    private fun applySystemTheme(config: Configuration) {
        val night = (config.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
        val paper = ContextCompat.getColor(this, R.color.paper)
        window.setBackgroundDrawable(ColorDrawable(paper))
        window.statusBarColor = paper
        window.navigationBarColor = paper
        WindowCompat.getInsetsController(window, window.decorView).apply {
            isAppearanceLightStatusBars = !night
            isAppearanceLightNavigationBars = !night
        }
        webView.setBackgroundColor(paper)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        val type = addType(intent) ?: return
        val account = intent.getStringExtra(EXTRA_ACCOUNT)
        val accountArg = account?.let { "'" + it.replace("'", "\\'") + "'" } ?: "null"
        webView.evaluateJavascript(
            "window.SekepingOpenAdd && window.SekepingOpenAdd('$type', $accountArg)",
            null,
        )
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    private fun startUrl(intent: Intent?): String {
        val base = "https://appassets.androidplatform.net/assets/www/index.html"
        val type = addType(intent) ?: return base
        val account = intent?.getStringExtra(EXTRA_ACCOUNT)
        val query = buildString {
            append("?add=").append(type)
            if (!account.isNullOrBlank()) append("&account=").append(Uri.encode(account))
        }
        return base + query
    }

    private fun addType(intent: Intent?): String? {
        val extra = intent?.getStringExtra(EXTRA_TYPE)
        if (extra == TYPE_EXPENSE || extra == TYPE_INCOME || extra == TYPE_TRANSFER) return extra
        val data = intent?.data ?: return null
        if (data.scheme != "sekeping") return null
        val candidate = data.lastPathSegment ?: data.host
        return if (candidate == TYPE_EXPENSE || candidate == TYPE_INCOME || candidate == TYPE_TRANSFER) {
            candidate
        } else {
            null
        }
    }

    /** Called by the web app to keep the widget's account picker and numbers up to date. */
    inner class WidgetBridge {
        @JavascriptInterface
        fun setAccounts(json: String) {
            WidgetPrefs.setAccounts(this@MainActivity, json)
            WidgetProvider.refreshAll(this@MainActivity)
        }

        @JavascriptInterface
        fun setSummary(json: String) {
            WidgetPrefs.setSummary(this@MainActivity, json)
            WidgetProvider.refreshAll(this@MainActivity)
        }

        @JavascriptInterface
        fun ready() = Unit
    }

    companion object {
        const val EXTRA_TYPE = "type"
        const val EXTRA_ACCOUNT = "account"
        const val TYPE_EXPENSE = "expense"
        const val TYPE_INCOME = "income"
        const val TYPE_TRANSFER = "transfer"
    }
}
