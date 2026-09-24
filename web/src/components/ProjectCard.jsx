import { useState } from 'react'
import TaskRow from './TaskRow'

/* 진행중 프로젝트 카드: 제목 + 미완료 할 일 목록 + 추가 입력 */
export default function ProjectCard({ project, tasks, store, compact, cloud, isOwner, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  const [newTitle, setNewTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [showDue, setShowDue] = useState(false)
  const [menu, setMenu] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [title, setTitle] = useState(project.title)

  const undone = tasks.filter((t) => !t.done)
  const doneCount = tasks.length - undone.length

  const add = async (e) => {
    e.preventDefault()
    const t = newTitle.trim()
    if (!t) return
    setNewTitle('')
    await store.addTask(project.id, t, dueDate || null)
    setDueDate('')
    setShowDue(false)
  }

  const commitRename = () => {
    const t = title.trim()
    if (t && t !== project.title) store.renameProject(project.id, t)
    else setTitle(project.title)
    setRenaming(false)
  }

  const completeProject = () => {
    const msg = undone.length
      ? `미완료 할 일 ${undone.length}개가 있습니다. 프로젝트를 완료 처리할까요?`
      : '프로젝트를 완료 처리할까요?'
    if (confirm(msg)) store.setProjectStatus(project.id, 'done')
    setMenu(false)
  }

  const deleteProject = () => {
    if (confirm(`"${project.title}" 프로젝트와 할 일 ${tasks.length}개를 모두 삭제할까요?\n(기록에서도 사라집니다)`)) store.deleteProject(project.id)
    setMenu(false)
  }

  const pad = compact ? 'px-3 py-2' : 'px-4 py-3'

  return (
    <section className="rounded-xl bg-white dark:bg-stone-800 shadow-sm border border-stone-200/70 dark:border-stone-700/70">
      {/* 헤더 */}
      <header className={`flex items-center gap-2 ${pad} border-b border-stone-100 dark:border-stone-700/60`}>
        <button type="button" onClick={() => setOpen(!open)} aria-label={open ? '접기' : '펼치기'}
          className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 w-5 shrink-0 text-sm">
          {open ? '▾' : '▸'}
        </button>

        {renaming ? (
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} onBlur={commitRename} onFocus={(e) => e.target.select()}
            onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') { setTitle(project.title); setRenaming(false) } }}
            className="flex-1 font-semibold bg-transparent border-b border-amber-500 outline-none" />
        ) : (
          <h2 onClick={() => setRenaming(true)} className={`flex-1 min-w-0 font-semibold truncate cursor-text ${compact ? 'text-sm' : ''}`}
            title="탭해서 이름 수정">
            {project.title}
          </h2>
        )}

        {project.is_shared && (
          <span className="shrink-0 text-[11px] px-1.5 py-0.5 rounded bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300"
            title={`공유 · 만든 사람: ${project.owner_name || ''}`}>
            공유{!isOwner && project.owner_name ? ` · ${project.owner_name}` : ''}
          </span>
        )}

        <span className="shrink-0 text-xs text-stone-400 tabular-nums">
          {undone.length}{doneCount ? <span className="text-stone-300 dark:text-stone-600"> / {tasks.length}</span> : ''}
        </span>

        <div className="relative shrink-0">
          <button type="button" onClick={() => setMenu(!menu)} aria-label="메뉴"
            className="text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 px-1 leading-none">⋯</button>
          {menu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
              <div className="absolute right-0 top-6 z-20 w-44 rounded-lg bg-white dark:bg-stone-700 shadow-lg border border-stone-200 dark:border-stone-600 py-1 text-sm">
                <MenuItem onClick={() => { setRenaming(true); setMenu(false) }}>이름 수정</MenuItem>
                {cloud && isOwner && (
                  <MenuItem onClick={() => { store.toggleShared(project.id, !project.is_shared); setMenu(false) }}>
                    {project.is_shared ? '공유 해제 (나만 보기)' : '팀에 공유'}
                  </MenuItem>
                )}
                <MenuItem onClick={completeProject}>프로젝트 완료</MenuItem>
                {(!cloud || isOwner) && <MenuItem onClick={deleteProject} danger>삭제</MenuItem>}
              </div>
            </>
          )}
        </div>
      </header>

      {open && (
        <div className={pad}>
          {undone.length === 0 && (
            <p className="text-xs text-stone-400 py-1">할 일이 없습니다. 아래에 추가하세요.</p>
          )}
          <ul>
            {undone.map((t) => (
              <TaskRow key={t.id} task={t} compact={compact}
                onDone={(id) => store.setTaskDone(id, true)}
                onEdit={(id, patch) => store.editTask(id, patch)}
                onDelete={(id) => { if (confirm('이 할 일을 삭제할까요?')) store.deleteTask(id) }} />
            ))}
          </ul>

          <form onSubmit={add} className="mt-1 flex items-center gap-2">
            <span className="text-stone-300 dark:text-stone-600 w-5 text-center shrink-0">+</span>
            <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="할 일 추가 후 Enter"
              className={`flex-1 min-w-0 bg-transparent outline-none placeholder:text-stone-400 ${compact ? 'text-sm' : 'text-[15px]'}`} />
            {showDue ? (
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                className="text-xs bg-transparent text-stone-500 outline-none w-[7.5rem]" />
            ) : (
              <button type="button" onClick={() => setShowDue(true)} title="마감일" className="text-stone-300 hover:text-amber-500 text-xs">📅</button>
            )}
          </form>
        </div>
      )}
    </section>
  )
}

function MenuItem({ children, onClick, danger }) {
  return (
    <button type="button" onClick={onClick}
      className={`block w-full text-left px-3 py-1.5 hover:bg-stone-100 dark:hover:bg-stone-600 ${danger ? 'text-red-600 dark:text-red-400' : ''}`}>
      {children}
    </button>
  )
}
