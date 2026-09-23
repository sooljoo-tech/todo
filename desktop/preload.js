// 웹앱에 window.desktop 제공 (설정 탭의 PC 창 옵션에서 사용)
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('desktop', {
  getState: () => ipcRenderer.invoke('desktop:getState'),
  setAlwaysOnTop: (v) => ipcRenderer.send('desktop:setAlwaysOnTop', v),
  setOpacity: (v) => ipcRenderer.send('desktop:setOpacity', v),
  setAutostart: (v) => ipcRenderer.send('desktop:setAutostart', v),
  minimize: () => ipcRenderer.send('desktop:minimize'),
  hide: () => ipcRenderer.send('desktop:hide'),
})
