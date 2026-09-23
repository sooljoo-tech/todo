import { useState } from 'react'
import { dueLabel } from '../lib/utils'

const TONE = {
  warn: 'text-amber-600 dark:text-amber-400',
  danger: 'text-red-600 dark:text-red-400',
  muted: 'text-stone-400',
}

/* 할 일 한 줄: 체크 → 320ms 애니메이션 후 완료 처리 */
export default function TaskRow({ task, onDone, onEdit, onDelete, compact }) {
  const [leaving, setLeaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(task.title)
  const due = dueLabel(task.due_date)

  const check = () => {
    if (leaving) return
    setLeaving(true)
    setTimeout(() => onDone(task.id), 300)
  }

  const commitEdit = () => {
    const t = text.trim()
    if (t && t !== task.title) onEdit(task.id, { title: t })
    else setText(task.title)
    setEditing(false)
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

      {editing ? (
        <input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') { setText(task.title); setEditing(false) } }}
          className={`flex-1 bg-transparent border-b border-amber-500 outline-none ${compact ? 'text-sm' : ''}`}
        />
      ) : (
        <span
          onDoubleClick={() => setEditing(true)}
          className={`flex-1 min-w-0 break-words leading-snug ${compact ? 'text-sm' : 'text-[15px]'}`}
          title="두 번 클릭해서 수정"
        >
          {task.title}
        </span>
      )}

      {due && <span className={`shrink-0 text-xs ${TONE[due.tone]}`}>{due.text}</span>}

      <button
        type="button"
        onClick={() => onDelete(task.id)}
        aria-label="삭제"
        className="shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 text-stone-400 hover:text-red-500 text-sm px-1 transition"
      >
        ×
      </button>
    </li>
  )
}
