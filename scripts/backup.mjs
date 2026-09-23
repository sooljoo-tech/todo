/*
 * 주 1회 전체 데이터 백업 (GitHub Actions)
 *  - 모든 테이블을 JSON 으로 덤프해 Supabase Storage 'backups' 버킷(비공개)에 업로드
 *  - 동시에 ./backup-out/ 에 저장 → GitHub Actions 아티팩트로 90일 보관
 *  - 12주 이전 백업은 버킷에서 삭제
 *
 * 필요한 환경변수: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from '@supabase/supabase-js'
import { mkdirSync, writeFileSync } from 'node:fs'

const env = (k) => { const v = process.env[k]; if (!v) throw new Error(`환경변수 ${k} 없음`); return v }
const supabase = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })

const tables = ['profiles', 'projects', 'tasks', 'push_subscriptions']
const dump = { created_at: new Date().toISOString(), tables: {} }
for (const t of tables) {
  const { data, error } = await supabase.from(t).select('*')
  if (error) throw error
  dump.tables[t] = data
  console.log(`${t}: ${data.length}행`)
}

const stamp = new Date().toISOString().slice(0, 10)
const name = `todo-backup-${stamp}.json`
const json = JSON.stringify(dump, null, 1)

mkdirSync('backup-out', { recursive: true })
writeFileSync(`backup-out/${name}`, json)

// 버킷 없으면 생성 (비공개)
const { data: buckets } = await supabase.storage.listBuckets()
if (!buckets?.some((b) => b.name === 'backups')) {
  const { error } = await supabase.storage.createBucket('backups', { public: false })
  if (error) throw error
}
const { error: upErr } = await supabase.storage.from('backups').upload(name, json, { contentType: 'application/json', upsert: true })
if (upErr) throw upErr
console.log(`업로드 완료: backups/${name} (${(json.length / 1024).toFixed(1)} KB)`)

// 오래된 백업 정리 (12주 = 84일)
const { data: files } = await supabase.storage.from('backups').list()
const cutoff = Date.now() - 84 * 86400000
const old = (files || []).filter((f) => new Date(f.created_at).getTime() < cutoff).map((f) => f.name)
if (old.length) { await supabase.storage.from('backups').remove(old); console.log(`오래된 백업 삭제: ${old.length}개`) }
