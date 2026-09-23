// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: orange; icon-glyph: check;
/*
 * 할 일 - 아이폰 홈 화면 위젯 (Scriptable)
 *
 * 설치
 *  1. App Store 에서 Scriptable 설치
 *  2. Scriptable 열기 → + → 이 파일 내용 전체 붙여넣기 → 이름 "Todo" 로 저장
 *  3. 스크립트를 한 번 실행 → 웹앱 설정 탭의 "위젯 설정값 복사" 내용을 붙여넣기
 *  4. 홈 화면 길게 누르기 → + → Scriptable → 중간(Medium) 또는 큰(Large) 위젯 추가
 *     → 위젯 길게 눌러 "위젯 편집" → Script: Todo
 *
 * 동작
 *  - 진행중 프로젝트별로 미완료 할 일 표시. 15분마다 갱신
 *  - 할 일 줄을 탭 → 그 항목 완료 처리 후 위젯 갱신
 *  - 제목 탭 → 웹앱 열기
 */

const CONFIG_FILE = 'todo-widget-config.json'
const fm = FileManager.local()
const cfgPath = fm.joinPath(fm.documentsDirectory(), CONFIG_FILE)

// ---- 설정 읽기/저장 ----
async function loadConfig() {
  if (fm.fileExists(cfgPath)) {
    try { return JSON.parse(fm.readString(cfgPath)) } catch { /* 다시 입력 */ }
  }
  if (config.runsInWidget) return null
  const a = new Alert()
  a.title = '위젯 설정값 입력'
  a.message = '웹앱 → 설정 → "위젯 설정값 복사" 한 내용을 붙여넣으세요.'
  a.addTextField('{"url":..., "key":..., "token":...}')
  a.addAction('저장'); a.addCancelAction('취소')
  if ((await a.present()) === -1) return null
  try {
    const c = JSON.parse(a.textFieldValue(0))
    if (!c.url || !c.key || !c.token) throw new Error()
    fm.writeString(cfgPath, JSON.stringify(c))
    return c
  } catch {
    const e = new Alert(); e.title = '형식이 올바르지 않습니다'; e.addAction('확인'); await e.present(); return null
  }
}

// ---- Supabase RPC 호출 ----
async function rpc(cfg, fn, body) {
  const req = new Request(`${cfg.url}/rest/v1/rpc/${fn}`)
  req.method = 'POST'
  req.headers = { apikey: cfg.key, Authorization: `Bearer ${cfg.key}`, 'Content-Type': 'application/json' }
  req.body = JSON.stringify({ token: cfg.token, ...body })
  const res = await req.loadString()
  if (req.response.statusCode >= 400) throw new Error(`${req.response.statusCode}: ${res}`)
  return res ? JSON.parse(res) : null
}

// ---- 위젯 그리기 ----
function buildWidget(cfg, projects, error) {
  const w = new ListWidget()
  w.backgroundColor = new Color('#1c1917')
  w.setPadding(12, 14, 12, 14)
  w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000)
  w.url = cfg?.app || 'https://sooljoo-tech.github.io/todo/'

  const size = config.widgetFamily || 'medium'
  const maxRows = size === 'large' ? 14 : size === 'medium' ? 5 : 3
  const total = projects.reduce((n, p) => n + p.tasks.length, 0)

  const head = w.addStack(); head.centerAlignContent()
  const t = head.addText('✓ 할 일'); t.font = Font.boldSystemFont(14); t.textColor = new Color('#fbbf24')
  head.addSpacer()
  const c = head.addText(total ? `${total}개` : '완료!'); c.font = Font.mediumSystemFont(12); c.textColor = new Color('#a8a29e')
  w.addSpacer(6)

  if (error) {
    const e = w.addText(error); e.font = Font.systemFont(11); e.textColor = new Color('#f87171'); e.minimumScaleFactor = 0.6
    return w
  }
  if (total === 0) {
    const e = w.addText('모든 할 일을 끝냈습니다 🎉'); e.font = Font.systemFont(12); e.textColor = new Color('#d6d3d1')
    return w
  }

  let rows = 0
  for (const p of projects) {
    if (!p.tasks.length || rows >= maxRows) continue
    const pt = w.addText(p.title + (p.is_shared ? ' · 공유' : ''))
    pt.font = Font.semiboldSystemFont(11); pt.textColor = new Color('#78716c'); pt.lineLimit = 1
    for (const task of p.tasks) {
      if (rows >= maxRows) break
      const row = w.addStack(); row.centerAlignContent(); row.spacing = 6
      row.url = `scriptable:///run/${encodeURIComponent(Script.name())}?complete=${task.id}`
      const dot = row.addText('○'); dot.font = Font.systemFont(12); dot.textColor = new Color('#a8a29e')
      const tt = row.addText(task.title); tt.font = Font.systemFont(13); tt.textColor = Color.white(); tt.lineLimit = 1
      if (task.due_date) {
        row.addSpacer()
        const d = row.addText(task.due_date.slice(5).replace('-', '/')); d.font = Font.systemFont(10); d.textColor = new Color('#fbbf24')
      }
      rows++
    }
    w.addSpacer(3)
  }
  if (total > rows) {
    const m = w.addText(`… 외 ${total - rows}개`); m.font = Font.systemFont(10); m.textColor = new Color('#78716c')
  }
  return w
}

// ---- 실행 ----
const cfg = await loadConfig()
if (!cfg) {
  const w = buildWidget(null, [], '스크립트를 한 번 실행해 설정값을 입력하세요')
  if (config.runsInWidget) Script.setWidget(w)
  Script.complete(); return
}

// 위젯에서 할 일 줄을 탭한 경우: 완료 처리
if (args.queryParameters && args.queryParameters.complete) {
  try {
    await rpc(cfg, 'widget_complete_task', { task_id: args.queryParameters.complete })
    const n = new Notification(); n.title = '할 일 완료'; n.body = '위젯이 곧 갱신됩니다.'; await n.schedule()
  } catch (e) {
    const a = new Alert(); a.title = '완료 처리 실패'; a.message = String(e); a.addAction('확인'); await a.present()
  }
  Script.complete(); return
}

let projects = [], error = null
try { projects = await rpc(cfg, 'widget_get_tasks', {}) } catch (e) { error = `불러오기 실패: ${e.message}` }

const widget = buildWidget(cfg, projects, error)
if (config.runsInWidget) Script.setWidget(widget)
else await widget.presentMedium()
Script.complete()
