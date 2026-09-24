/* 브라우저 푸시 알림 구독 관리 */
import { supabase } from './supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || ''

export const pushSupported = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && Boolean(VAPID_PUBLIC_KEY)

// iOS는 홈 화면에 추가된(standalone) 상태에서만 푸시 가능
export const isIosNotInstalled = () => {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone
  return ios && !standalone
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

// 오늘 날짜(YYYY-MM-DD, 기기 로컬 시간)
const todayKey = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// 설정한 시각이 오늘 이미 지났으면 오늘은 보내지 않도록 last_sent_on 을 오늘로 채움
const lastSentFor = (hour, minute) => {
  const now = new Date()
  return now.getHours() * 60 + now.getMinutes() >= hour * 60 + minute ? todayKey() : null
}

export async function getCurrentSubscription() {
  if (!pushSupported()) return null
  const reg = await navigator.serviceWorker.ready
  return reg.pushManager.getSubscription()
}

export async function subscribePush(userId, hour = 8, minute = 0) {
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') throw new Error('알림 권한이 거부되었습니다')
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  })
  const json = sub.toJSON()
  const { error } = await supabase.from('push_subscriptions').upsert({
    user_id: userId,
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
    user_agent: navigator.userAgent.slice(0, 200),
    notify_hour: hour,
    notify_minute: minute,
    last_sent_on: lastSentFor(hour, minute),
  }, { onConflict: 'endpoint' })
  if (error) throw error
  return sub
}

export async function unsubscribePush() {
  const sub = await getCurrentSubscription()
  if (!sub) return
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe()
}

export async function updateNotifyTime(hour, minute) {
  const sub = await getCurrentSubscription()
  if (!sub) return
  await supabase.from('push_subscriptions')
    .update({ notify_hour: hour, notify_minute: minute, last_sent_on: lastSentFor(hour, minute) })
    .eq('endpoint', sub.endpoint)
}

// 'HH:MM' ↔ {hour, minute}
export const toTimeString = (h, m) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
export const parseTimeString = (s) => { const [h, m] = (s || '08:00').split(':').map(Number); return { hour: h || 0, minute: m || 0 } }
