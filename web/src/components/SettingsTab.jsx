import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured, SUPABASE_URL } from '../lib/supabase'
import { pushSupported, isIosNotInstalled, getCurrentSubscription, subscribePush, unsubscribePush, updateNotifyHour } from '../lib/push'
import { LocalStore } from '../lib/store'

const APP_URL = `${location.origin}${import.meta.env.BASE_URL}`

/* 설정 탭 */
export default function SettingsTab({ user, store, onLogout, onUseLocal, compact }) {
  const cloud = store.mode === 'cloud'
  const desktop = window.desktop
  const [msg, setMsg] = useState('')
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 2500) }

  return (
    <div className={`space-y-4 ${compact ? 'text-sm' : ''}`}>
      {msg && <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 bg-stone-900 text-white text-sm px-4 py-2 rounded-full shadow-lg">{msg}</div>}

      <Section title="계정">
        {cloud ? (
          <>
            <Row label="로그인" value={user.email} />
            <Row label="동기화" value="Supabase · 실시간" />
            <div className="flex gap-2 pt-1">
              <Btn onClick={onLogout}>로그아웃</Btn>
            </div>
          </>
        ) : (
          <>
            <Row label="저장 위치" value="이 기기(브라우저)에만 저장" />
            {isSupabaseConfigured() && (
              <p className="text-xs text-stone-500">로그인하면 핸드폰과 동기화되고 팀 공유·위젯·아침 알림을 쓸 수 있습니다.</p>
            )}
            {isSupabaseConfigured() && <Btn onClick={onUseLocal}>Google 로그인</Btn>}
          </>
        )}
      </Section>

      {cloud && <NotifySection user={user} flash={flash} />}
      {cloud && <WidgetSection flash={flash} />}
      {desktop && <DesktopSection />}

      <Section title="데이터">
        <div className="flex flex-wrap gap-2">
          <Btn onClick={() => download(`todo-backup-${new Date().toISOString().slice(0, 10)}.json`, store.exportJson())}>JSON 내보내기</Btn>
          {cloud && <ImportLocalButton store={store} flash={flash} />}
        </div>
        <p className="text-xs text-stone-400">모든 프로젝트·할 일·완료 기록을 파일로 저장합니다.</p>
      </Section>

      <Section title="핸드폰에서 사용">
        <ol className="text-xs text-stone-500 space-y-1 list-decimal pl-4">
          <li>핸드폰 브라우저에서 <code className="select-all">{APP_URL}</code> 열기</li>
          <li><b>아이폰</b>: Safari 공유 → 홈 화면에 추가. <b>안드로이드</b>: Chrome 메뉴 → 홈 화면에 추가(앱 설치)</li>
          <li>홈 화면 아이콘으로 열어 로그인하면 알림·위젯 사용 가능</li>
        </ol>
      </Section>

      <p className="text-[11px] text-stone-400 text-center pt-2">할 일 v{__APP_VERSION__} · {cloud ? SUPABASE_URL.replace('https://', '') : 'local'}</p>
    </div>
  )
}

/* 아침 알림 */
function NotifySection({ user, flash }) {
  const [sub, setSub] = useState(null)
  const [hour, setHour] = useState(8)
  const [busy, setBusy] = useState(false)
  const supported = pushSupported()

  useEffect(() => {
    if (!supported) return
    getCurrentSubscription().then(async (s) => {
      setSub(s)
      if (s) {
        const { data } = await supabase.from('push_subscriptions').select('notify_hour').eq('endpoint', s.endpoint).maybeSingle()
        if (data) setHour(data.notify_hour)
      }
    })
  }, [supported])

  const toggle = async () => {
    setBusy(true)
    try {
      if (sub) { await unsubscribePush(); setSub(null); flash('알림을 해제했습니다') }
      else { const s = await subscribePush(user.id, hour); setSub(s); flash('매일 아침 알림을 받습니다') }
    } catch (e) { flash(e.message || '실패') }
    setBusy(false)
  }

  const changeHour = async (h) => { setHour(h); if (sub) { await updateNotifyHour(h); flash(`${h}시로 변경`) } }

  return (
    <Section title="아침 알림 (이 기기)">
      {!supported ? (
        <p className="text-xs text-stone-500">
          {isIosNotInstalled() ? '아이폰은 Safari 공유 → "홈 화면에 추가" 후 그 아이콘으로 열어야 알림을 켤 수 있습니다.'
            : import.meta.env.VITE_VAPID_PUBLIC_KEY ? '이 브라우저는 푸시 알림을 지원하지 않습니다.' : '알림 서버 키(VAPID)가 설정되지 않았습니다.'}
        </p>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={Boolean(sub)} onChange={toggle} disabled={busy} className="accent-amber-500 w-4 h-4" />
              <span>매일 오늘 할 일 요약 받기</span>
            </label>
            <select value={hour} onChange={(e) => changeHour(Number(e.target.value))}
              className="ml-auto rounded-md bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 px-2 py-1 text-sm">
              {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{h}시</option>)}
            </select>
          </div>
          <p className="text-xs text-stone-400">기기마다 따로 켜야 합니다. 핸드폰에서 이 화면을 열어 켜 주세요.</p>
        </>
      )}
    </Section>
  )
}

/* 위젯 토큰 */
function WidgetSection({ flash }) {
  const [token, setToken] = useState('')
  const [show, setShow] = useState(false)

  useEffect(() => {
    supabase.from('profiles').select('widget_token').maybeSingle().then(({ data }) => setToken(data?.widget_token || ''))
  }, [])

  const copy = async (text, label) => {
    try { await navigator.clipboard.writeText(text); flash(`${label} 복사됨`) } catch { flash('복사 실패 - 길게 눌러 복사하세요') }
  }
  const regen = async () => {
    if (!confirm('토큰을 재발급하면 기존 위젯은 다시 설정해야 합니다. 계속할까요?')) return
    const { data, error } = await supabase.rpc('regenerate_widget_token')
    if (error) return flash(error.message)
    setToken(data); flash('새 토큰 발급됨')
  }

  const setupText = JSON.stringify({ url: SUPABASE_URL, key: import.meta.env.VITE_SUPABASE_ANON_KEY, token, app: APP_URL })

  return (
    <Section title="홈 화면 위젯 (아이폰 · 안드로이드)">
      <p className="text-xs text-stone-500">위젯은 로그인 대신 아래 <b>위젯 설정값</b>으로 내 할 일을 읽습니다. 비밀번호처럼 다루세요.</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 min-w-0 truncate text-xs bg-stone-100 dark:bg-stone-800 rounded px-2 py-1.5">
          {show ? token : '•'.repeat(24)}
        </code>
        <Btn small onClick={() => setShow(!show)}>{show ? '숨기기' : '보기'}</Btn>
      </div>
      <div className="flex flex-wrap gap-2">
        <Btn onClick={() => copy(setupText, '위젯 설정값')}>위젯 설정값 복사</Btn>
        <Btn onClick={() => copy(token, '토큰')}>토큰만 복사</Btn>
        <Btn onClick={regen} subtle>재발급</Btn>
      </div>
      <details className="text-xs text-stone-500">
        <summary className="cursor-pointer">설치 방법</summary>
        <div className="mt-2 space-y-2">
          <p><b>아이폰</b>: App Store에서 <b>Scriptable</b>(무료) 설치 → 새 스크립트에 저장소의 <code>widgets/ios-scriptable/Todo.js</code> 내용 붙여넣기 → 처음 실행 시 위젯 설정값 붙여넣기 → 홈 화면에 Scriptable 위젯 추가하고 스크립트 선택.</p>
          <p><b>안드로이드</b>: GitHub 저장소 Releases에서 <code>todo-widget.apk</code> 설치 → 앱 열고 위젯 설정값 붙여넣기 → 홈 화면 길게 눌러 위젯 추가.</p>
        </div>
      </details>
    </Section>
  )
}

/* PC 작은 창 설정 */
function DesktopSection() {
  const d = window.desktop
  const [pin, setPin] = useState(true)
  const [opacity, setOpacity] = useState(1)
  const [autostart, setAutostart] = useState(false)

  useEffect(() => {
    d.getState?.().then((s) => { if (s) { setPin(s.alwaysOnTop); setOpacity(s.opacity); setAutostart(s.autostart) } })
  }, [d])

  return (
    <Section title="PC 창">
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={pin} onChange={(e) => { setPin(e.target.checked); d.setAlwaysOnTop(e.target.checked) }} className="accent-amber-500 w-4 h-4" />
        항상 다른 창 위에 표시
      </label>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={autostart} onChange={(e) => { setAutostart(e.target.checked); d.setAutostart(e.target.checked) }} className="accent-amber-500 w-4 h-4" />
        Windows 시작 시 자동 실행
      </label>
      <label className="flex items-center gap-3">
        <span className="shrink-0">투명도</span>
        <input type="range" min="0.4" max="1" step="0.05" value={opacity}
          onChange={(e) => { const v = Number(e.target.value); setOpacity(v); d.setOpacity(v) }} className="flex-1 accent-amber-500" />
        <span className="w-10 text-right text-xs tabular-nums">{Math.round(opacity * 100)}%</span>
      </label>
      <p className="text-xs text-stone-400">창을 닫으면 트레이(작업표시줄 오른쪽 아이콘)로 숨겨지고, 아이콘 클릭으로 다시 열립니다.</p>
    </Section>
  )
}

function ImportLocalButton({ store, flash }) {
  const local = new LocalStore()
  const count = local.state.projects.length
  if (!count) return null
  const run = async () => {
    if (!confirm(`이 브라우저에 저장된 로컬 데이터(프로젝트 ${count}개)를 계정으로 업로드할까요?\n업로드 후 로컬 데이터는 삭제됩니다.`)) return
    try {
      await store.importLocal(local.state)
      localStorage.removeItem('todo.local.v1')
      flash('업로드 완료')
    } catch (e) { flash(e.message) }
  }
  return <Btn onClick={run}>로컬 데이터 업로드 ({count})</Btn>
}

/* ---- 작은 UI 조각 ---- */
function Section({ title, children }) {
  return (
    <section className="rounded-xl bg-white dark:bg-stone-800 border border-stone-200/70 dark:border-stone-700/70 p-3 space-y-2">
      <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wide">{title}</h3>
      {children}
    </section>
  )
}
function Row({ label, value }) {
  return <div className="flex gap-3 text-sm"><span className="text-stone-400 w-20 shrink-0">{label}</span><span className="truncate">{value}</span></div>
}
function Btn({ children, onClick, small, subtle }) {
  return (
    <button type="button" onClick={onClick}
      className={`rounded-lg border ${subtle ? 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-100' : 'border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-700 hover:bg-stone-50 dark:hover:bg-stone-600'} ${small ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'}`}>
      {children}
    </button>
  )
}
function download(name, text) {
  const blob = new Blob([text], { type: 'application/json' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
