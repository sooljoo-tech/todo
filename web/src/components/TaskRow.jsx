import { useState } from 'react'
import { dueLabel } from '../lib/utils'

const TONE = {
  warn: 'text-amber-600 dark:text-amber-400',
  danger: 'text-red-600 dark:text-red-400',
  muted: 'text-stone-400',
}

/* 할 일 한 줄: 체크 → 320ms 애니메이션 후 완료 처리. 글자를 탭하면 수정 모드 */
export default function TaskRow({ task, onDone, onEdit, onDelete, compact }) {
  const [leaving, setLeaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(task.title)
  const [due, setDue] = useState(task.due_date || '')
  const dueInfo = dueLabel(task.due_date)

  const check = () => {
    if (leaving) return
    setLeaving(true)
    setTimeout(() => onDone(task.id), 300)
  }

  const startEdit = () => { setText(task.title); setDue(task.due_date || ''); setEditing(true) }
  const cancelEdit = () => { setText(task.title); setDue(task.due_date || ''); setEditing(false) }
  const commitEdit = () => {
    const t = text.trim()
    const patch = {}
    if (t && t !== task.title) patch.title = t
    if ((due || null) !== (task.due_date || null)) patch.due_date = due || null
    if (Object.keys(patch).length) onEdit(task.id, patch)
    setEditing(false)
  }

  if (editing) {
    return (
      <li className={`flex flex-col gap-1.5 ${compact ? 'py-1' : 'py-1.5'} pl-7`}>
        <input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') cancelEdit() }}
          className={`w-full bg-transparent border-b border-amber-500 outline-none ${compact ? 'text-sm' : 'text-[15px]'}`}
        />
        <div className="flex items-center gap-2 text-xs">
          <label className="flex items-center gap-1 text-stone-500">
            마감
            <input type="date" value={due} onChange={(e) => setDue(e.target.value)}
              className="bg-transparent outline-none text-stone-600 dark:text-stone-300" />
            {due && <button type="button" onClick={() => setDue('')} className="text-stone-400 hover:text-red-500">지우기</button>}
          </label>
          <span className="flex-1" />
          <button type="button" onClick={cancelEdit} className="px-2 py-1 rounded text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-700">취소</button>
          <button type="button" onClick={commitEdit} className="px-2.5 py-1 rounded bg-amber-500 text-white font-medium">저장</button>
        </div>
      </li>
    )
  }

  return (
    <li className={`group flex items-center gap-2 ${compact ? 'py-1' : 'py-1.5'} ${leaving ? 'task-out' : ''}`}>
      <button
        type="button"
        onClick={check}
        aria-label="완료"
        className={`shrink-0 ${compact ? 'w-4 h-4' : 'w-5 h-5'} rounded-full border-2 border-stone-300 dark:border-stone-600
          hover:border-amber-500 flex items-center justify-center transition
          ${leaving ? 'bg-amber-500 border-amber-500' : ''}`}
      >
        {leaving && <svg viewBox="0 0 20 20" className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 10l3.5 3.5L15 7" /></svg>}
      </button>

      <button
        type="button"
        onClick={startEdit}
        className={`flex-1 min-w-0 text-left break-words leading-snug ${compact ? 'text-sm' : 'text-[15px]'}`}
        title="탭해서 수정"
      >
        {task.title}
      </button>

      {dueInfo && <span className={`shrink-0 text-xs ${TONE[dueInfo.tone]}`}>{dueInfo.text}</span>}

      <button
        type="button"
        onClick={() => onDelete(task.id)}
        aria-label="삭제"
        className="shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 [@media(hover:none)]:opacity-50 text-stone-400 hover:text-red-500 text-base leading-none px-1.5 py-1 transition"
      >
        ×
      </button>
    </li>
  )
}
