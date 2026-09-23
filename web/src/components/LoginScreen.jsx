import { supabase } from '../lib/supabase'

/* 로그인 화면: Google 로그인 또는 로그인 없이 로컬 사용 */
export default function LoginScreen({ onLocal, error }) {
  const signIn = () => supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${location.origin}${import.meta.env.BASE_URL}`,
      queryParams: { prompt: 'select_account' },
    },
  })

  return (
    <div className="min-h-full flex flex-col items-center justify-center p-8 text-center gap-6">
      <div>
        <div className="w-16 h-16 mx-auto rounded-2xl bg-stone-900 flex items-center justify-center mb-4">
          <svg viewBox="0 0 512 512" className="w-10 h-10"><path d="M140 268 L222 350 L380 176" fill="none" stroke="#f59e0b" strokeWidth="52" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        <h1 className="text-2xl font-bold">할 일</h1>
        <p className="text-sm text-stone-500 mt-1">진행중 프로젝트와 지금 바로 할 일</p>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-950/40 rounded-lg px-3 py-2 max-w-xs">{error}</p>}

      <button type="button" onClick={signIn}
        className="w-full max-w-xs flex items-center justify-center gap-3 rounded-xl bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-600 px-4 py-3 font-medium shadow-sm hover:shadow">
        <GoogleIcon />
        회사 Google 계정으로 로그인
      </button>
      <p className="text-xs text-stone-400 max-w-xs -mt-3">
        로그인하면 PC·핸드폰 동기화, 팀 공유, 위젯, 아침 알림을 사용할 수 있습니다.
      </p>

      <button type="button" onClick={onLocal} className="text-sm text-stone-500 underline underline-offset-2">
        로그인 없이 이 기기에서만 사용
      </button>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="w-5 h-5">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.5 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z" />
      <path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.3 0 11.7-2.1 15.6-5.7l-7.6-5.9c-2.1 1.4-4.8 2.3-8 2.3-6.3 0-11.6-4.1-13.5-9.9l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  )
}
