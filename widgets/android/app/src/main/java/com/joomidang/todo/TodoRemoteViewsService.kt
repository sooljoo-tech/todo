package com.joomidang.todo

import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import android.widget.RemoteViewsService

/** 위젯 목록 데이터 공급. onDataSetChanged 는 백그라운드에서 호출되므로 네트워크 가능 */
class TodoRemoteViewsService : RemoteViewsService() {
    override fun onGetViewFactory(intent: Intent): RemoteViewsFactory = Factory(applicationContext)

    private class Factory(private val context: Context) : RemoteViewsFactory {
        private var rows: List<Row> = emptyList()
        private var error: String? = null

        override fun onCreate() {}
        override fun onDestroy() {}

        override fun onDataSetChanged() {
            val prefs = Prefs(context)
            if (!prefs.configured) { rows = emptyList(); return }
            try {
                rows = Api.fetchRows(prefs); error = null
            } catch (e: Exception) {
                error = e.message
                rows = listOf(Row("", "불러오기 실패 · 탭하여 다시 시도", isHeader = true))
            }
        }

        override fun getCount() = rows.size
        override fun getViewTypeCount() = 2
        override fun getItemId(position: Int) = position.toLong()
        override fun hasStableIds() = false
        override fun getLoadingView(): RemoteViews? = null

        override fun getViewAt(position: Int): RemoteViews {
            val row = rows[position]
            return if (row.isHeader) {
                RemoteViews(context.packageName, R.layout.widget_header).apply {
                    setTextViewText(R.id.header_title, row.title)
                }
            } else {
                RemoteViews(context.packageName, R.layout.widget_item).apply {
                    setTextViewText(R.id.item_title, row.title)
                    setTextViewText(R.id.item_due, row.due ?: "")
                    // 템플릿에 채울 값: 할 일 id
                    setOnClickFillInIntent(R.id.item_root, Intent().putExtra(TodoWidget.EXTRA_TASK_ID, row.id))
                }
            }
        }
    }
}
