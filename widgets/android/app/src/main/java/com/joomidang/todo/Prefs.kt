package com.joomidang.todo

import android.content.Context
import org.json.JSONObject

/** 웹앱 설정 탭의 "위젯 설정값"({url,key,token,app})을 저장/읽기 */
class Prefs(context: Context) {
    private val sp = context.getSharedPreferences("todo_widget", Context.MODE_PRIVATE)

    val url: String get() = sp.getString("url", "") ?: ""
    val key: String get() = sp.getString("key", "") ?: ""
    val token: String get() = sp.getString("token", "") ?: ""
    val appUrl: String get() = sp.getString("app", "https://sooljoo-tech.github.io/todo/") ?: ""
    val configured: Boolean get() = url.isNotBlank() && key.isNotBlank() && token.isNotBlank()

    /** JSON 문자열을 파싱해 저장. 형식이 틀리면 false */
    fun saveFromJson(json: String): Boolean {
        return try {
            val o = JSONObject(json.trim())
            val url = o.getString("url"); val key = o.getString("key"); val token = o.getString("token")
            if (url.isBlank() || key.isBlank() || token.isBlank()) return false
            sp.edit()
                .putString("url", url.trimEnd('/'))
                .putString("key", key)
                .putString("token", token)
                .putString("app", o.optString("app", appUrl))
                .apply()
            true
        } catch (e: Exception) { false }
    }

    fun clear() = sp.edit().clear().apply()
}
