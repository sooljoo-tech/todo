package com.joomidang.todo

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity

/** 설정 화면: 위젯 설정값 붙여넣기 */
class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        val prefs = Prefs(this)
        val input = findViewById<EditText>(R.id.input)
        val status = findViewById<TextView>(R.id.status)

        fun render() {
            status.text = if (prefs.configured) "설정 완료 · ${prefs.url.removePrefix("https://")}\n홈 화면을 길게 눌러 '할 일' 위젯을 추가하세요."
            else "웹앱 → 설정 → '위젯 설정값 복사' 후 아래에 붙여넣으세요."
        }
        render()

        findViewById<Button>(R.id.save).setOnClickListener {
            if (prefs.saveFromJson(input.text.toString())) {
                Toast.makeText(this, "저장했습니다", Toast.LENGTH_SHORT).show()
                input.setText("")
                TodoWidget.refreshAll(this)
                render()
            } else Toast.makeText(this, "형식이 올바르지 않습니다. 설정값 전체를 그대로 붙여넣어 주세요.", Toast.LENGTH_LONG).show()
        }
        findViewById<Button>(R.id.open_app).setOnClickListener {
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(prefs.appUrl)))
        }
        findViewById<Button>(R.id.clear).setOnClickListener {
            prefs.clear(); TodoWidget.refreshAll(this); render()
            Toast.makeText(this, "설정을 지웠습니다", Toast.LENGTH_SHORT).show()
        }
    }
}
