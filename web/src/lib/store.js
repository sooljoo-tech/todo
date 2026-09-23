/*
 * 데이터 저장소
 *  - LocalStore   : 브라우저 localStorage (로그인 없이 이 기기에서만)
 *  - CloudStore   : Supabase (로그인 사용자, 여러 기기 동기화 + 팀 공유)
 * 두 저장소는 같은 인터페이스를 제공하며, App은 useStore 훅으로만 접근한다.
 *
 * 데이터 형태
 *  project: { id, title, is_shared, status:'active'|'done', sort_order, created_at, completed_at, owner_id, owner_name }
 *  task   : { id, project_id, title, done, due_date, sort_order, created_at, completed_at, completed_by, completed_by_name }
 */
import { useSyncExternalStore } from 'react'
import { supabase } from './supabase'
import { uid, nowIso } from './utils'

const LS_KEY = 'todo.local.v1'

class BaseStore {
  constructor() {
    this.listeners = new Set()
    this.state = { projects: [], tasks: [], profiles: {}, loading: true, error: null }
  }
  subscribe = (fn) => { this.listeners.add(fn); return () => this.listeners.delete(fn) }
  getSnapshot = () => this.state
  set(patch) {
    this.state = { ...this.state, ...patch }
    this.listeners.forEach((fn) => fn())
  }
}

/* ------------------------------------------------------------------ */
/* 로컬 저장소                                                         */
/* ------------------------------------------------------------------ */
export class LocalStore extends BaseStore {
  mode = 'local'
  constructor() {
    super()
    let saved = null
    try { saved = JSON.parse(localStorage.getItem(LS_KEY) || 'null') } catch { saved = null }
    this.set({ projects: saved?.projects || [], tasks: saved?.tasks || [], loading: false })
  }
  persist() {
    try { localStorage.setItem(LS_KEY, JSON.stringify({ projects: this.state.projects, tasks: this.state.tasks })) } catch { /* 저장 실패 무시 */ }
  }
  update(fn) { const next = fn(this.state); this.set(next); this.persist() }

  async addProject(title, isShared = false) {
    const p = { id: uid(), title: title.trim(), is_shared: false, status: 'active',
      sort_order: this.state.projects.length, created_at: nowIso(), completed_at: null, owner_id: 'local' }
    void isShared
    this.update((s) => ({ projects: [...s.projects, p] }))
    return p
  }
  async renameProject(id, title) { this.update((s) => ({ projects: s.projects.map((p) => p.id === id ? { ...p, title } : p) })) }
  async setProjectStatus(id, status) {
    this.update((s) => ({ projects: s.projects.map((p) => p.id === id
      ? { ...p, status, completed_at: status === 'done' ? nowIso() : null } : p) }))
  }
  async toggleShared() { /* 로컬 모드에서는 공유 불가 */ }
  async deleteProject(id) {
    this.update((s) => ({ projects: s.projects.filter((p) => p.id !== id), tasks: s.tasks.filter((t) => t.project_id !== id) }))
  }
  async addTask(projectId, title, dueDate = null) {
    const t = { id: uid(), project_id: projectId, title: title.trim(), done: false, due_date: dueDate,
      sort_order: this.state.tasks.filter((x) => x.project_id === projectId).length, created_at: nowIso(), completed_at: null }
    this.update((s) => ({ tasks: [...s.tasks, t] }))
    return t
  }
  async setTaskDone(id, done) {
    this.update((s) => ({ tasks: s.tasks.map((t) => t.id === id
      ? { ...t, done, completed_at: done ? nowIso() : null } : t) }))
  }
  async editTask(id, patch) { this.update((s) => ({ tasks: s.tasks.map((t) => t.id === id ? { ...t, ...patch } : t) })) }
  async deleteTask(id) { this.update((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })) }
  async refresh() {}
  exportJson() { return JSON.stringify({ projects: this.state.projects, tasks: this.state.tasks }, null, 2) }
  destroy() {}
}

/* ------------------------------------------------------------------ */
/* Supabase 저장소                                                     */
/* ------------------------------------------------------------------ */
export class CloudStore extends BaseStore {
  mode = 'cloud'
  constructor(user) {
    super()
    this.user = user
    this.channel = null
    this.refresh()
    this.listenRealtime()
  }

  async refresh(attempt = 0) {
    const [pr, tk, pf] = await Promise.all([
      supabase.from('projects').select('*').order('sort_order').order('created_at'),
      supabase.from('tasks').select('*').order('sort_order').order('created_at'),
      supabase.from('profiles').select('id,name,email'),
    ])
    const err = pr.error || tk.error || pf.error
    if (err) {
      // 로그인 직후 서버 간 시계 오차로 나는 일시 오류("JWT issued at future")는 잠시 뒤 재시도
      if (/issued at future|jwt/i.test(err.message) && attempt < 4) {
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)))
        return this.refresh(attempt + 1)
      }
      this.set({ loading: false, error: err.message }); return
    }
    const profiles = Object.fromEntries((pf.data || []).map((p) => [p.id, p]))
    const projects = (pr.data || []).map((p) => ({ ...p, owner_name: profiles[p.owner_id]?.name || '' }))
    const tasks = (tk.data || []).map((t) => ({ ...t, completed_by_name: t.completed_by ? (profiles[t.completed_by]?.name || '') : '' }))
    this.set({ projects, tasks, profiles, loading: false, error: null })
  }

  listenRealtime() {
    // 변경 이벤트가 오면 단순히 다시 읽는다 (데이터 양이 작아 충분)
    let timer = null
    const bump = () => { clearTimeout(timer); timer = setTimeout(() => this.refresh(), 250) }
    this.channel = supabase.channel('todo-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, bump)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, bump)
      .subscribe()
  }

  // 낙관적 반영 후 서버 호출. 실패하면 다시 읽어 되돌린다.
  async run(optimistic, op) {
    const prev = this.state
    if (optimistic) this.set(optimistic(this.state))
    const { error } = await op()
    if (error) { this.set({ ...prev, error: error.message }); await this.refresh(); throw error }
  }

  async addProject(title, isShared = false) {
    const row = { owner_id: this.user.id, title: title.trim(), is_shared: isShared, sort_order: this.state.projects.length }
    const { data, error } = await supabase.from('projects').insert(row).select().single()
    if (error) { this.set({ error: error.message }); throw error }
    const p = { ...data, owner_name: this.state.profiles[this.user.id]?.name || '' }
    this.set({ projects: [...this.state.projects, p] })
    return p
  }
  renameProject(id, title) {
    return this.run((s) => ({ projects: s.projects.map((p) => p.id === id ? { ...p, title } : p) }),
      () => supabase.from('projects').update({ title }).eq('id', id))
  }
  setProjectStatus(id, status) {
    const completed_at = status === 'done' ? nowIso() : null
    return this.run((s) => ({ projects: s.projects.map((p) => p.id === id ? { ...p, status, completed_at } : p) }),
      () => supabase.from('projects').update({ status, completed_at }).eq('id', id))
  }
  toggleShared(id, isShared) {
    return this.run((s) => ({ projects: s.projects.map((p) => p.id === id ? { ...p, is_shared: isShared } : p) }),
      () => supabase.from('projects').update({ is_shared: isShared }).eq('id', id))
  }
  deleteProject(id) {
    return this.run((s) => ({ projects: s.projects.filter((p) => p.id !== id), tasks: s.tasks.filter((t) => t.project_id !== id) }),
      () => supabase.from('projects').delete().eq('id', id))
  }
  async addTask(projectId, title, dueDate = null) {
    const row = { project_id: projectId, title: title.trim(), due_date: dueDate, created_by: this.user.id,
      sort_order: this.state.tasks.filter((t) => t.project_id === projectId).length }
    const { data, error } = await supabase.from('tasks').insert(row).select().single()
    if (error) { this.set({ error: error.message }); throw error }
    this.set({ tasks: [...this.state.tasks, { ...data, completed_by_name: '' }] })
    return data
  }
  setTaskDone(id, done) {
    const completed_at = done ? nowIso() : null
    const completed_by = done ? this.user.id : null
    const name = done ? (this.state.profiles[this.user.id]?.name || '') : ''
    return this.run((s) => ({ tasks: s.tasks.map((t) => t.id === id ? { ...t, done, completed_at, completed_by, completed_by_name: name } : t) }),
      () => supabase.from('tasks').update({ done, completed_at, completed_by }).eq('id', id))
  }
  editTask(id, patch) {
    return this.run((s) => ({ tasks: s.tasks.map((t) => t.id === id ? { ...t, ...patch } : t) }),
      () => supabase.from('tasks').update(patch).eq('id', id))
  }
  deleteTask(id) {
    return this.run((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }),
      () => supabase.from('tasks').delete().eq('id', id))
  }

  // 로컬 데이터 → 클라우드 업로드 (최초 로그인 시 1회)
  async importLocal(local) {
    for (const p of local.projects) {
      const { data, error } = await supabase.from('projects').insert({
        owner_id: this.user.id, title: p.title, status: p.status, sort_order: p.sort_order,
        created_at: p.created_at, completed_at: p.completed_at,
      }).select().single()
      if (error) throw error
      const tasks = local.tasks.filter((t) => t.project_id === p.id).map((t) => ({
        project_id: data.id, title: t.title, done: t.done, due_date: t.due_date, sort_order: t.sort_order,
        created_by: this.user.id, created_at: t.created_at, completed_at: t.completed_at,
        completed_by: t.done ? this.user.id : null,
      }))
      if (tasks.length) { const r = await supabase.from('tasks').insert(tasks); if (r.error) throw r.error }
    }
    await this.refresh()
  }

  exportJson() { return JSON.stringify({ projects: this.state.projects, tasks: this.state.tasks }, null, 2) }
  destroy() { if (this.channel) supabase.removeChannel(this.channel) }
}

/* ------------------------------------------------------------------ */
/* React 훅                                                            */
/* ------------------------------------------------------------------ */
export function useStoreState(store) {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
}
