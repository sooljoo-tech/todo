/*
 * 매일 아침 푸시 알림 발송 (GitHub Actions 에서 매시 정각 실행)
 *  - 사용자별 notify_hour(한국시간) 와 현재 시각이 일치하는 구독에만 발송
 *  - 내용: 진행중 프로젝트 수, 할 일 수, 할 일 5개 미리보기
 *  - 만료된 구독(404/410)은 삭제
 *
 * 필요한 환경변수: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, APP_URL
 * FORCE_HOUR=8 을 주면 시각 검사 없이 8시 구독자에게 즉시 발송 (테스트용)
 */
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

const env = (k, required = true) => { const v = process.env[k]; if (!v && required) throw new Error(`환경변수 ${k} 없음`); return v }
const supabase = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })
webpush.setVapidDetails('mailto:sooljoo@joomidang.com', env('VAPID_PUBLIC_KEY'), env('VAPID_PRIVATE_KEY'))
const APP_URL = env('APP_URL', false) || 'https://sooljoo-tech.github.io/todo/'

// 한국 시간 현재 시(hour)
const kstHour = process.env.FORCE_HOUR !== undefined
  ? Number(process.env.FORCE_HOUR)
  : Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', hour: 'numeric', hour12: false }).format(new Date())) % 24

const { data: subs, error: subErr } = await supabase.from('push_subscriptions').select('*').eq('notify_hour', kstHour)
if (subErr) throw subErr
if (!subs?.length) { console.log(`KST ${kstHour}시 구독자 없음`); process.exit(0) }

const { data: summary, error: sumErr } = await supabase.rpc('daily_summary')
if (sumErr) throw sumErr
const byUser = Object.fromEntries(summary.map((s) => [s.user_id, s]))

const today = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', weekday: 'short' }).format(new Date())
let sent = 0, removed = 0
for (const sub of subs) {
  const s = byUser[sub.user_id]
  if (!s) continue
  const list = (s.sample_tasks || []).map((t) => `• ${t}`).join('\n')
  const more = s.task_count > 5 ? `\n… 외 ${s.task_count - 5}개` : ''
  const payload = JSON.stringify({
    title: s.task_count ? `${today} · 할 일 ${s.task_count}개` : `${today} · 할 일이 모두 끝났어요`,
    body: s.task_count ? `진행중 프로젝트 ${s.project_count}개\n${list}${more}` : '새로운 할 일을 추가해 보세요.',
    tag: 'daily', url: APP_URL,
  })
  try {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, { TTL: 3600 })
    sent++
  } catch (e) {
    if (e.statusCode === 404 || e.statusCode === 410) {
      await supabase.from('push_subscriptions').delete().eq('id', sub.id); removed++
    } else console.error('발송 실패', sub.id, e.statusCode, e.body || e.message)
  }
}
console.log(`KST ${kstHour}시: 발송 ${sent}건, 만료 삭제 ${removed}건`)
