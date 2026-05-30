-keep class com.luxtraderfx.app.** { *; }
-keepattributes JavascriptInterface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-dontwarn com.capacitor.**
