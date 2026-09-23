// 날짜/공통 유틸

export const uid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`)

export const nowIso = () => new Date().toISOString()

// 'YYYY-MM-DD' (로컬 시간 기준)
export const toDateKey = (iso) => {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

// '9월 23일 (화)' / 오늘·어제 표기
export const formatDateKey = (key) => {
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const today = toDateKey(nowIso())
  const yesterday = toDateKey(new Date(Date.now() - 86400000).toISOString())
  const base = `${m}월 ${d}일 (${WEEKDAYS[date.getDay()]})`
  if (key === today) return `오늘 · ${base}`
  if (key === yesterday) return `어제 · ${base}`
  const thisYear = new Date().getFullYear()
  return y === thisYear ? base : `${y}년 ${base}`
}

export const formatTime = (iso) => {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// 마감일 표시: 'D-3' / '오늘' / 'D+2(지남)'
export const dueLabel = (dueDate) => {
  if (!dueDate) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const [y, m, d] = dueDate.split('-').map(Number)
  const due = new Date(y, m - 1, d)
  const diff = Math.round((due - today) / 86400000)
  if (diff === 0) return { text: '오늘', tone: 'warn' }
  if (diff < 0) return { text: `${-diff}일 지남`, tone: 'danger' }
  if (diff <= 3) return { text: `D-${diff}`, tone: 'warn' }
  return { text: `${m}/${d}`, tone: 'muted' }
}

export const isCompact = () => {
  const p = new URLSearchParams(location.search)
  return p.get('compact') === '1' || Boolean(window.desktop)
}

export const initialTab = () => {
  const p = new URLSearchParams(location.search)
  return p.get('tab') || 'active'
}
