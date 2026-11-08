package dev.shabri.sekeping

import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat

/**
 * Quick-add shown by the home-screen widget's square buttons. The window is
 * transparent and dimmed, so the app's own transaction dialog appears over the
 * launcher — no dashboard, no page navigation, the same sheet and design.
 */
class WidgetSheetActivity : AppCompatActivity() {

    private lateinit var webView: WebView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val type = intent?.getStringExtra(MainActivity.EXTRA_TYPE)
        if (type != MainActivity.TYPE_EXPENSE &&
            type != MainActivity.TYPE_INCOME &&
            type != MainActivity.TYPE_TRANSFER
        ) {
            finish()
            return
        }

        applyBars()
        webView = WebAppHost.create(this, Bridge(), transparent = true)
        setContentView(webView)

        val account = intent?.getStringExtra(MainActivity.EXTRA_ACCOUNT).orEmpty()
        val query = buildString {
            append("sheet=").append(type)
            if (account.isNotBlank()) append("&account=").append(Uri.encode(account))
        }
        webView.loadUrl(WebAppHost.url(query))

        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    finish()
                }
            },
        )
    }

    private fun applyBars() {
        window.statusBarColor = Color.TRANSPARENT
        window.navigationBarColor = Color.TRANSPARENT
        WindowCompat.getInsetsController(window, window.decorView).apply {
            isAppearanceLightStatusBars = false
            isAppearanceLightNavigationBars = false
        }
    }

    inner class Bridge {

        @JavascriptInterface
        fun setAccounts(json: String) {
            WidgetPrefs.setAccounts(this@WidgetSheetActivity, json)
            runOnUiThread { WidgetProvider.refreshAll(this@WidgetSheetActivity) }
        }

        @JavascriptInterface
        fun setSummary(json: String) {
            WidgetPrefs.setSummary(this@WidgetSheetActivity, json)
            runOnUiThread { WidgetProvider.refreshAll(this@WidgetSheetActivity) }
        }

        @JavascriptInterface
        fun closeSheet() {
            runOnUiThread { finish() }
        }

        @JavascriptInterface
        fun openApp() {
            runOnUiThread {
                startActivity(Intent(this@WidgetSheetActivity, MainActivity::class.java))
                finish()
            }
        }

        @JavascriptInterface
        fun toast(message: String) {
            runOnUiThread {
                Toast.makeText(this@WidgetSheetActivity, message, Toast.LENGTH_SHORT).show()
            }
        }

        @JavascriptInterface
        fun ready() = Unit
    }
}
