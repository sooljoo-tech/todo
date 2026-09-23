import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase, isSupabaseConfigured } from './lib/supabase'
import { LocalStore, CloudStore, useStoreState } from './lib/store'
import { isCompact, initialTab } from './lib/utils'
import ProjectCard from './components/ProjectCard'
import HistoryTab from './components/HistoryTab'
import SettingsTab from './components/SettingsTab'
import LoginScreen from './components/LoginScreen'

const ALLOWED_DOMAINS = (import.meta.env.VITE_ALLOWED_DOMAINS || 'joomidang.com').split(',').map((s) => s.trim())
const MODE_KEY = 'todo.mode' // 'local' 이면 로그인 없이 사용 선택함

export default function App() {
  const compact = isCompact()
  const [session, setSession] = useState(undefined) // undefined=확인중, null=비로그인
  const [forceLocal, setForceLocal] = useState(() => localStorage.getItem(MODE_KEY) === 'local')
  const [authError, setAuthError] = useState('')

  // 인증 상태 추적
  useEffect(() => {
    if (!isSupabaseConfigured()) { setSession(null); return }
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s ?? null))
    return () => sub.subscription.unsubscribe()
  }, [])

  const user = session?.user ?? null
  const domainOk = user ? ALLOWED_DOMAINS.includes((user.email || '').split('@')[1]) : false

  // 허용되지 않은 도메인으로 로그인하면 즉시 로그아웃
  useEffect(() => {
    if (user && !domainOk) {
      setAuthError(`${user.email} 은(는) 허용된 회사 계정이 아닙니다. (${ALLOWED_DOMAINS.join(', ')})`)
      supabase.auth.signOut()
    }
  }, [user, domainOk])

  const useCloud = Boolean(user && domainOk) && !forceLocal
  const store = useMemo(() => (useCloud ? new CloudStore(user) : new LocalStore()), [useCloud, user?.id])
  const prevStore = useRef(null)
  useEffect(() => { prevStore.current?.destroy?.(); prevStore.current = store; return () => store.destroy?.() }, [store])

  if (session === undefined) return <Splash />

  // Supabase가 설정돼 있고, 로그인도 안 했고, 로컬 사용도 선택하지 않았으면 로그인 화면
  if (isSupabaseConfigured() && !user && !forceLocal) {
    return <LoginScreen error={authError} onLocal={() => { localStorage.setItem(MODE_KEY, 'local'); setForceLocal(true) }} />
  }

  return (
    <Main
      store={store}
      user={useCloud ? user : null}
      compact={compact}
      onLogout={async () => { await supabase.auth.signOut(); localStorage.removeItem(MODE_KEY); setForceLocal(false) }}
      onUseLocal={() => { localStorage.removeItem(MODE_KEY); setForceLocal(false) }}
    />
  )
}

function Main({ store, user, compact, onLogout, onUseLocal }) {
  const state = useStoreState(store)
  const [tab, setTab] = useState(initialTab)
  const [newProject, setNewProject] = useState('')
  const [shareNew, setShareNew] = useState(false)
  const cloud = store.mode === 'cloud'

  const active = state.projects.filter((p) => p.status === 'active')
  const tasksByProject = useMemo(() => {
    const m = {}
    for (const t of state.tasks) (m[t.project_id] ||= []).push(t)
    return m
  }, [state.tasks])
  const todoCount = state.tasks.filter((t) => !t.done && active.some((p) => p.id === t.project_id)).length

  const addProject = async (e) => {
    e.preventDefault()
    const t = newProject.trim()
    if (!t) return
    setNewProject('')
    await store.addProject(t, shareNew)
    setShareNew(false)
  }

  // 문서 제목에 남은 개수 표시 (트레이/탭에서 확인용)
  useEffect(() => { document.title = todoCount ? `(${todoCount}) 할 일` : '할 일' }, [todoCount])

  const pad = compact ? 'px-2.5' : 'px-4'

  return (
    <div className="h-full flex flex-col">
      {/* 헤더: PC 창에서는 드래그 영역 */}
      <header className={`drag-region shrink-0 flex items-center gap-2 ${pad} ${compact ? 'py-1.5' : 'py-3'} bg-stone-900 text-stone-100 select-none`}>
        <span className="text-amber-400 font-bold">✓</span>
        <h1 className={`font-semibold ${compact ? 'text-sm' : 'text-lg'}`}>할 일</h1>
        {todoCount > 0 && <span className="text-xs text-stone-400 tabular-nums">{todoCount}</span>}
        {state.error && <span className="text-xs text-red-400 truncate" title={state.error}>오류: {state.error}</span>}
        <nav className="no-drag ml-auto flex rounded-lg bg-stone-800 p-0.5 text-xs">
          {[['active', '진행중'], ['history', '기록'], ['settings', '설정']].map(([k, label]) => (
            <button key={k} type="button" onClick={() => setTab(k)}
              className={`px-2.5 py-1 rounded-md transition ${tab === k ? 'bg-stone-100 text-stone-900' : 'text-stone-400 hover:text-stone-100'}`}>
              {label}
            </button>
          ))}
        </nav>
        {window.desktop && (
          <div className="no-drag flex items-center gap-0.5 -mr-1">
            <WinBtn onClick={() => window.desktop.minimize()} title="최소화">–</WinBtn>
            <WinBtn onClick={() => window.desktop.hide()} title="트레이로 숨기기">×</WinBtn>
          </div>
        )}
      </header>

      <main className={`flex-1 overflow-y-auto ${pad} ${compact ? 'py-2 space-y-2' : 'py-4 space-y-3'} max-w-2xl w-full mx-auto`}>
        {state.loading && <p className="text-center text-sm text-stone-400 py-6">불러오는 중…</p>}

        {tab === 'active' && !state.loading && (
          <>
            {active.length === 0 && (
              <div className="text-center text-stone-400 py-10 space-y-1">
                <p className="text-3xl">🗂</p>
                <p className="text-sm">진행중인 프로젝트가 없습니다.</p>
                <p className="text-xs">아래에 프로젝트 이름을 입력해 시작하세요.</p>
              </div>
            )}
            {active.map((p) => (
              <ProjectCard key={p.id} project={p} tasks={tasksByProject[p.id] || []} store={store} compact={compact}
                cloud={cloud} isOwner={!cloud || p.owner_id === user?.id} />
            ))}

            <form onSubmit={addProject} className={`flex items-center gap-2 rounded-xl border-2 border-dashed border-stone-300 dark:border-stone-700 ${compact ? 'px-3 py-1.5' : 'px-4 py-2.5'}`}>
              <span className="text-stone-400">＋</span>
              <input value={newProject} onChange={(e) => setNewProject(e.target.value)} placeholder="새 프로젝트"
                className={`flex-1 min-w-0 bg-transparent outline-none placeholder:text-stone-400 ${compact ? 'text-sm' : ''}`} />
              {cloud && newProject && (
                <label className="flex items-center gap-1 text-xs text-stone-500 cursor-pointer shrink-0">
                  <input type="checkbox" checked={shareNew} onChange={(e) => setShareNew(e.target.checked)} className="accent-sky-500" />
                  팀 공유
                </label>
              )}
            </form>
          </>
        )}

        {tab === 'history' && !state.loading && (
          <HistoryTab projects={state.projects} tasks={state.tasks} store={store} compact={compact} />
        )}

        {tab === 'settings' && (
          <SettingsTab user={user} store={store} onLogout={onLogout} onUseLocal={onUseLocal} compact={compact} />
        )}
      </main>
    </div>
  )
}

function WinBtn({ children, onClick, title }) {
  return (
    <button type="button" onClick={onClick} title={title}
      className="w-7 h-6 rounded text-stone-400 hover:bg-stone-700 hover:text-stone-100 text-sm leading-none">
      {children}
    </button>
  )
}

function Splash() {
  return <div className="h-full flex items-center justify-center text-stone-400 text-sm">…</div>
}
