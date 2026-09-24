/*
 * 매일 아침 푸시 알림 발송 (GitHub Actions 에서 10분마다 실행)
 *  - 각 구독의 설정 시각(notify_hour:notify_minute, 한국시간)이 지났고
 *    오늘(한국 날짜) 아직 보내지 않은(last_sent_on <> 오늘) 구독에 발송
 *    → 예약 실행이 몇 분 늦어져도 빠지지 않고, 하루 1회만 보장
 *  - 내용: 진행중 프로젝트 수, 할 일 수, 할 일 5개 미리보기
 *  - 만료된 구독(404/410)은 삭제
 *
 * 필요한 환경변수: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, APP_URL
 * FORCE=1 을 주면 시각·발송 여부와 무관하게 전 구독자에게 즉시 발송 (테스트용, last_sent_on 은 갱신하지 않음)
 */
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

const env = (k, required = true) => { const v = process.env[k]; if (!v && required) throw new Error(`환경변수 ${k} 없음`); return v }
const supabase = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })
webpush.setVapidDetails('mailto:sooljoo@joomidang.com', env('VAPID_PUBLIC_KEY'), env('VAPID_PRIVATE_KEY'))
const APP_URL = env('APP_URL', false) || 'https://sooljoo-tech.github.io/todo/'
const FORCE = process.env.FORCE === '1' || process.env.FORCE === 'true'

// 한국 시간 기준 현재 날짜·분
const kst = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
  .formatToParts(new Date()).reduce((o, p) => (o[p.type] = p.value, o), {})
const todayKst = `${kst.year}-${kst.month}-${kst.day}`
const nowMinutes = (Number(kst.hour) % 24) * 60 + Number(kst.minute)

const { data: allSubs, error: subErr } = await supabase.from('push_subscriptions').select('*')
if (subErr) throw subErr
const subs = FORCE ? allSubs : allSubs.filter((s) =>
  s.last_sent_on !== todayKst && (s.notify_hour * 60 + (s.notify_minute || 0)) <= nowMinutes)
if (!subs.length) { console.log(`KST ${todayKst} ${kst.hour}:${kst.minute} 발송 대상 없음 (전체 구독 ${allSubs.length})`); process.exit(0) }

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
    if (!FORCE) await supabase.from('push_subscriptions').update({ last_sent_on: todayKst }).eq('id', sub.id)
  } catch (e) {
    if (e.statusCode === 404 || e.statusCode === 410) {
      await supabase.from('push_subscriptions').delete().eq('id', sub.id); removed++
    } else console.error('발송 실패', sub.id, e.statusCode, e.body || e.message)
  }
}
console.log(`KST ${todayKst} ${kst.hour}:${kst.minute}${FORCE ? ' (강제)' : ''}: 발송 ${sent}건, 만료 삭제 ${removed}건`)
