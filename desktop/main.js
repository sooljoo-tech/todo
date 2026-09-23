/*
 * 할 일 - PC 작은 창
 *  - 항상 위(always on top), 프레임 없음, 크기 조절 가능
 *  - 닫기(×)는 트레이로 숨김. 트레이 아이콘 클릭으로 다시 표시
 *  - 창 위치/크기/투명도/항상위 설정은 userData/state.json 에 저장
 *  - 배포된 웹앱(https://<계정>.github.io/todo/?compact=1)을 로드
 */
const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, screen, shell } = require('electron')
const path = require('node:path')
const fs = require('node:fs')

const DEFAULT_URL = 'https://sooljoo-tech.github.io/todo/'
const APP_URL = process.env.TODO_URL || DEFAULT_URL

// Google 로그인은 일반 브라우저처럼 보여야 허용되므로 UA에서 Electron 표기를 제거
const CHROME_UA = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${process.versions.chrome} Safari/537.36`

const statePath = () => path.join(app.getPath('userData'), 'state.json')
const defaultState = { x: undefined, y: undefined, width: 360, height: 540, alwaysOnTop: true, opacity: 1 }
let state = { ...defaultState }
try { state = { ...defaultState, ...JSON.parse(fs.readFileSync(statePath(), 'utf8')) } } catch { /* 첫 실행 */ }
const saveState = () => { try { fs.writeFileSync(statePath(), JSON.stringify(state)) } catch { /* 무시 */ } }

let win = null
let tray = null
let quitting = false

// 중복 실행 방지: 이미 떠 있으면 기존 창을 앞으로
if (!app.requestSingleInstanceLock()) { app.quit() } else {
  app.on('second-instance', () => showWindow())
}

function createWindow() {
  // 저장된 위치가 화면 밖이면 오른쪽 아래 기본 위치로
  const area = screen.getPrimaryDisplay().workArea
  let { x, y } = state
  if (x === undefined || y === undefined || x < area.x - 50 || y < area.y - 50 || x > area.x + area.width - 50 || y > area.y + area.height - 50) {
    x = area.x + area.width - state.width - 16
    y = area.y + area.height - state.height - 16
  }

  win = new BrowserWindow({
    x, y, width: state.width, height: state.height,
    minWidth: 260, minHeight: 200,
    frame: false,
    alwaysOnTop: state.alwaysOnTop,
    opacity: state.opacity,
    skipTaskbar: false,
    backgroundColor: '#1c1917',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  win.setAlwaysOnTop(state.alwaysOnTop, 'floating')
  win.setMenuBarVisibility(false)
  win.webContents.setUserAgent(CHROME_UA)

  const url = new URL(APP_URL)
  url.searchParams.set('compact', '1')
  win.loadURL(url.toString())

  // 외부 링크는 기본 브라우저로
  win.webContents.setWindowOpenHandler(({ url: target }) => {
    if (target.startsWith(APP_URL) || target.includes('supabase.co') || target.includes('accounts.google.com')) return { action: 'allow' }
    shell.openExternal(target)
    return { action: 'deny' }
  })

  const remember = () => { if (!win.isMinimized()) { const b = win.getBounds(); Object.assign(state, b); saveState() } }
  win.on('moved', remember)
  win.on('resized', remember)
  win.on('close', (e) => { if (!quitting) { e.preventDefault(); win.hide() } })
}

function showWindow() {
  if (!win) return createWindow()
  if (win.isMinimized()) win.restore()
  win.show(); win.focus()
}

function createTray() {
  const img = nativeImage.createFromPath(path.join(__dirname, 'icon.png')).resize({ width: 16, height: 16 })
  tray = new Tray(img)
  tray.setToolTip('할 일')
  const menu = Menu.buildFromTemplate([
    { label: '열기', click: showWindow },
    { label: '항상 위에 표시', type: 'checkbox', checked: state.alwaysOnTop, click: (item) => setAlwaysOnTop(item.checked) },
    { label: 'Windows 시작 시 실행', type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin, click: (item) => setAutostart(item.checked) },
    { type: 'separator' },
    { label: '브라우저에서 열기', click: () => shell.openExternal(APP_URL) },
    { label: '새로 고침', click: () => win?.reload() },
    { type: 'separator' },
    { label: '종료', click: () => { quitting = true; app.quit() } },
  ])
  tray.setContextMenu(menu)
  tray.on('click', () => (win?.isVisible() ? win.hide() : showWindow()))
}

function setAlwaysOnTop(v) { state.alwaysOnTop = v; saveState(); win?.setAlwaysOnTop(v, 'floating') }
function setAutostart(v) { app.setLoginItemSettings({ openAtLogin: v, path: process.execPath }) }

// 렌더러(웹앱)와의 통신
ipcMain.handle('desktop:getState', () => ({
  alwaysOnTop: state.alwaysOnTop, opacity: state.opacity, autostart: app.getLoginItemSettings().openAtLogin,
}))
ipcMain.on('desktop:setAlwaysOnTop', (_e, v) => setAlwaysOnTop(Boolean(v)))
ipcMain.on('desktop:setOpacity', (_e, v) => { const o = Math.min(1, Math.max(0.3, Number(v) || 1)); state.opacity = o; saveState(); win?.setOpacity(o) })
ipcMain.on('desktop:setAutostart', (_e, v) => setAutostart(Boolean(v)))
ipcMain.on('desktop:minimize', () => win?.minimize())
ipcMain.on('desktop:hide', () => win?.hide())

app.whenReady().then(() => {
  createWindow()
  createTray()
})
app.on('window-all-closed', (e) => e.preventDefault?.())
app.on('before-quit', () => { quitting = true })
