package com.joomidang.todo

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews
import android.widget.Toast

/**
 * 홈 화면 위젯
 *  - 헤더 탭: 웹앱 열기 / ↻ 탭: 새로 고침
 *  - 할 일 줄 탭: 완료 처리 후 목록 갱신
 *  - 30분마다 자동 갱신(widget_info.xml)
 */
class TodoWidget : AppWidgetProvider() {

    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        ids.forEach { id -> manager.updateAppWidget(id, buildViews(context, id)) }
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        when (intent.action) {
            ACTION_COMPLETE -> {
                val taskId = intent.getStringExtra(EXTRA_TASK_ID) ?: return
                val pending = goAsync()
                Thread {
                    try {
                        Api.completeTask(Prefs(context), taskId)
                    } catch (e: Exception) {
                        android.os.Handler(context.mainLooper).post {
                            Toast.makeText(context, "완료 처리 실패: ${e.message}", Toast.LENGTH_SHORT).show()
                        }
                    }
                    refreshAll(context)
                    pending.finish()
                }.start()
            }
            ACTION_REFRESH -> refreshAll(context)
        }
    }

    companion object {
        const val ACTION_COMPLETE = "com.joomidang.todo.COMPLETE"
        const val ACTION_REFRESH = "com.joomidang.todo.REFRESH"
        const val EXTRA_TASK_ID = "task_id"

        fun refreshAll(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(ComponentName(context, TodoWidget::class.java))
            ids.forEach { manager.updateAppWidget(it, buildViews(context, it)) }
            manager.notifyAppWidgetViewDataChanged(ids, R.id.list)
        }

        private fun buildViews(context: Context, widgetId: Int): RemoteViews {
            val prefs = Prefs(context)
            val views = RemoteViews(context.packageName, R.layout.widget)

            // 목록 어댑터
            val svc = Intent(context, TodoRemoteViewsService::class.java).apply {
                putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId)
                data = Uri.parse(toUri(Intent.URI_INTENT_SCHEME))
            }
            views.setRemoteAdapter(R.id.list, svc)
            views.setEmptyView(R.id.list, R.id.empty)
            views.setTextViewText(R.id.empty, if (prefs.configured) "할 일이 없습니다 🎉" else "앱을 열어 위젯 설정값을 입력하세요")

            // 줄 탭 → 완료 브로드캐스트 (템플릿)
            val complete = Intent(context, TodoWidget::class.java).setAction(ACTION_COMPLETE)
            views.setPendingIntentTemplate(R.id.list, PendingIntent.getBroadcast(
                context, 0, complete, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE))

            // 헤더 탭 → 웹앱
            val open = Intent(Intent.ACTION_VIEW, Uri.parse(prefs.appUrl))
            views.setOnClickPendingIntent(R.id.title, PendingIntent.getActivity(
                context, 1, open, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))

            // ↻ 탭 → 새로 고침
            val refresh = Intent(context, TodoWidget::class.java).setAction(ACTION_REFRESH)
            views.setOnClickPendingIntent(R.id.refresh, PendingIntent.getBroadcast(
                context, 2, refresh, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))

            // 빈 화면 탭 → 설정 앱
            val settings = Intent(context, MainActivity::class.java)
            views.setOnClickPendingIntent(R.id.empty, PendingIntent.getActivity(
                context, 3, settings, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
            return views
        }
    }
}
