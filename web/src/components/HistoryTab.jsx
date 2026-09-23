import { useMemo, useState } from 'react'
import { toDateKey, formatDateKey, formatTime } from '../lib/utils'

/* 기록 탭: 완료한 할 일을 날짜별로, 완료한 프로젝트를 따로 모아 보여준다 */
export default function HistoryTab({ projects, tasks, store, compact }) {
  const [view, setView] = useState('byDate') // byDate | byProject | doneProjects
  const [filterProject, setFilterProject] = useState('all')
  const [query, setQuery] = useState('')

  const projectMap = useMemo(() => Object.fromEntries(projects.map((p) => [p.id, p])), [projects])
  const doneTasks = useMemo(() => tasks.filter((t) => t.done && t.completed_at)
    .filter((t) => filterProject === 'all' || t.project_id === filterProject)
    .filter((t) => !query || t.title.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => b.completed_at.localeCompare(a.completed_at)), [tasks, filterProject, query])

  const byDate = useMemo(() => {
    const groups = new Map()
    for (const t of doneTasks) {
      const k = toDateKey(t.completed_at)
      if (!groups.has(k)) groups.set(k, [])
      groups.get(k).push(t)
    }
    return [...groups.entries()]
  }, [doneTasks])

  const byProject = useMemo(() => {
    const groups = new Map()
    for (const t of doneTasks) {
      if (!groups.has(t.project_id)) groups.set(t.project_id, [])
      groups.get(t.project_id).push(t)
    }
    return [...groups.entries()].sort((a, b) => b[1][0].completed_at.localeCompare(a[1][0].completed_at))
  }, [doneTasks])

  const doneProjects = useMemo(() => projects.filter((p) => p.status === 'done')
    .sort((a, b) => (b.completed_at || '').localeCompare(a.completed_at || '')), [projects])

  const totalDone = tasks.filter((t) => t.done).length
  const text = compact ? 'text-sm' : ''

  return (
    <div className="space-y-3">
      {/* 요약 + 보기 전환 */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-stone-500">완료 {totalDone}개 · 완료 프로젝트 {doneProjects.length}개</span>
        <div className="ml-auto flex rounded-lg overflow-hidden border border-stone-200 dark:border-stone-700">
          {[['byDate', '날짜별'], ['byProject', '프로젝트별'], ['doneProjects', '완료 프로젝트']].map(([k, label]) => (
            <button key={k} type="button" onClick={() => setView(k)}
              className={`px-2.5 py-1 ${view === k ? 'bg-stone-800 text-white dark:bg-stone-200 dark:text-stone-900' : 'bg-white dark:bg-stone-800 text-stone-500'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {view !== 'doneProjects' && (
        <div className="flex gap-2">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="검색"
            className={`flex-1 min-w-0 rounded-lg px-3 py-1.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 outline-none focus:border-amber-500 ${text}`} />
          <select value={filterProject} onChange={(e) => setFilterProject(e.target.value)}
            className={`rounded-lg px-2 py-1.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 max-w-[45%] ${text}`}>
            <option value="all">모든 프로젝트</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.title}{p.status === 'done' ? ' (완료)' : ''}</option>)}
          </select>
        </div>
      )}

      {view === 'byDate' && (
        byDate.length === 0 ? <Empty /> :
        byDate.map(([key, list]) => (
          <section key={key}>
            <h3 className="text-xs font-semibold text-stone-500 mb-1 sticky top-0 bg-stone-50 dark:bg-stone-900 py-1">
              {formatDateKey(key)} <span className="font-normal text-stone-400">· {list.length}개</span>
            </h3>
            <ul className="rounded-xl bg-white dark:bg-stone-800 border border-stone-200/70 dark:border-stone-700/70 divide-y divide-stone-100 dark:divide-stone-700/60">
              {list.map((t) => <DoneRow key={t.id} task={t} project={projectMap[t.project_id]} store={store} compact={compact} showProject />)}
            </ul>
          </section>
        ))
      )}

      {view === 'byProject' && (
        byProject.length === 0 ? <Empty /> :
        byProject.map(([pid, list]) => (
          <section key={pid}>
            <h3 className="text-xs font-semibold text-stone-500 mb-1">
              {projectMap[pid]?.title || '(삭제된 프로젝트)'} <span className="font-normal text-stone-400">· {list.length}개</span>
            </h3>
            <ul className="rounded-xl bg-white dark:bg-stone-800 border border-stone-200/70 dark:border-stone-700/70 divide-y divide-stone-100 dark:divide-stone-700/60">
              {list.map((t) => <DoneRow key={t.id} task={t} project={projectMap[t.project_id]} store={store} compact={compact} showDate />)}
            </ul>
          </section>
        ))
      )}

      {view === 'doneProjects' && (
        doneProjects.length === 0 ? <Empty text="완료한 프로젝트가 없습니다" /> :
        doneProjects.map((p) => {
          const list = tasks.filter((t) => t.project_id === p.id).sort((a, b) => (a.completed_at || '').localeCompare(b.completed_at || ''))
          return (
            <section key={p.id} className="rounded-xl bg-white dark:bg-stone-800 border border-stone-200/70 dark:border-stone-700/70 p-3">
              <div className="flex items-center gap-2 mb-1">
                <h3 className={`flex-1 font-semibold ${text}`}>{p.title}</h3>
                <span className="text-xs text-stone-400">
                  {p.completed_at ? `${formatDateKey(toDateKey(p.completed_at))} 완료` : ''}
                </span>
                <button type="button" onClick={() => store.setProjectStatus(p.id, 'active')}
                  className="text-xs text-amber-600 hover:underline">다시 진행</button>
              </div>
              <p className="text-xs text-stone-400 mb-1">
                {formatDateKey(toDateKey(p.created_at))} 시작 · 할 일 {list.length}개 (완료 {list.filter((t) => t.done).length})
              </p>
              <ul className="text-sm space-y-0.5">
                {list.map((t) => (
                  <li key={t.id} className="flex gap-2 items-baseline">
                    <span className={t.done ? 'text-emerald-500' : 'text-stone-300'}>{t.done ? '✓' : '○'}</span>
                    <span className={`flex-1 ${t.done ? 'text-stone-500' : ''}`}>{t.title}</span>
                    {t.completed_at && <span className="text-xs text-stone-400 tabular-nums">{toDateKey(t.completed_at)}</span>}
                  </li>
                ))}
              </ul>
            </section>
          )
        })
      )}
    </div>
  )
}

function DoneRow({ task, project, store, compact, showProject, showDate }) {
  return (
    <li className={`flex items-center gap-2 px-3 ${compact ? 'py-1.5 text-sm' : 'py-2'}`}>
      <span className="text-emerald-500 shrink-0">✓</span>
      <div className="flex-1 min-w-0">
        <div className="text-stone-600 dark:text-stone-300 break-words">{task.title}</div>
        <div className="text-[11px] text-stone-400 flex gap-2">
          {showProject && <span className="truncate">{project?.title || '(삭제된 프로젝트)'}</span>}
          {showDate && <span>{toDateKey(task.completed_at)}</span>}
          <span>{formatTime(task.completed_at)}</span>
          {task.completed_by_name && <span>{task.completed_by_name}</span>}
        </div>
      </div>
      <button type="button" onClick={() => store.setTaskDone(task.id, false)} title="되돌리기"
        className="shrink-0 text-xs text-stone-400 hover:text-amber-600">↩</button>
    </li>
  )
}

function Empty({ text = '완료한 할 일이 없습니다' }) {
  return <p className="text-center text-sm text-stone-400 py-10">{text}</p>
}
