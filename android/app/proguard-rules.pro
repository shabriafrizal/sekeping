# Keep the JavaScript bridge methods reachable from the WebView.
-keepclassmembers class dev.shabri.sekeping.MainActivity$WidgetBridge {
    @android.webkit.JavascriptInterface <methods>;
}
