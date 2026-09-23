package com.joomidang.todo

import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.net.HttpURLConnection
import java.net.URL

/** 위젯 목록의 한 줄: 프로젝트 헤더 또는 할 일 */
data class Row(val id: String, val title: String, val isHeader: Boolean, val due: String? = null)

/** Supabase RPC (widget_*) 호출. 반드시 백그라운드 스레드에서 호출 */
object Api {
    private fun rpc(p: Prefs, fn: String, body: JSONObject): String {
        body.put("token", p.token)
        val conn = (URL("${p.url}/rest/v1/rpc/$fn").openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 8000; readTimeout = 8000
            doOutput = true
            setRequestProperty("apikey", p.key)
            setRequestProperty("Authorization", "Bearer ${p.key}")
            setRequestProperty("Content-Type", "application/json")
        }
        conn.outputStream.use { it.write(body.toString().toByteArray()) }
        val code = conn.responseCode
        val stream = if (code >= 400) conn.errorStream else conn.inputStream
        val text = stream?.bufferedReader()?.use(BufferedReader::readText) ?: ""
        if (code >= 400) throw RuntimeException("HTTP $code: $text")
        return text
    }

    /** 진행중 프로젝트 + 미완료 할 일을 평탄한 줄 목록으로 */
    fun fetchRows(p: Prefs): List<Row> {
        val arr = JSONArray(rpc(p, "widget_get_tasks", JSONObject()))
        val rows = mutableListOf<Row>()
        for (i in 0 until arr.length()) {
            val proj = arr.getJSONObject(i)
            val tasks = proj.getJSONArray("tasks")
            if (tasks.length() == 0) continue
            val shared = if (proj.optBoolean("is_shared")) " · 공유" else ""
            rows += Row(proj.getString("id"), proj.getString("title") + shared, isHeader = true)
            for (j in 0 until tasks.length()) {
                val t = tasks.getJSONObject(j)
                val due = if (t.isNull("due_date")) null else t.getString("due_date").substring(5).replace('-', '/')
                rows += Row(t.getString("id"), t.getString("title"), isHeader = false, due = due)
            }
        }
        return rows
    }

    fun completeTask(p: Prefs, taskId: String) {
        rpc(p, "widget_complete_task", JSONObject().put("task_id", taskId))
    }
}
