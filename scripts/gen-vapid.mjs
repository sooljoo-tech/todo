// 푸시 알림용 VAPID 키 쌍 생성 (1회만 실행)
//  - publicKey  → GitHub 변수 VITE_VAPID_PUBLIC_KEY (웹앱 빌드에 포함, 공개 가능)
//  - privateKey → GitHub 시크릿 VAPID_PRIVATE_KEY (절대 공개 금지)
import webpush from 'web-push'

const keys = webpush.generateVAPIDKeys()
console.log('VITE_VAPID_PUBLIC_KEY=' + keys.publicKey)
console.log('VAPID_PRIVATE_KEY=' + keys.privateKey)
