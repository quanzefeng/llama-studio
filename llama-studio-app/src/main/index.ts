import { app, BrowserWindow, shell, Menu } from 'electron'
import { join } from 'path'
import { registerIpcHandlers } from './ipc-handlers'
import { stopServer } from './llama-process'

let win: BrowserWindow | null = null

/** 应用图标:开发模式用仓库内 resources/icon.png;打包后窗口自动用 exe 图标 */
function resolveAppIcon(): string | undefined {
  if (app.isPackaged) return undefined
  // electron-vite dev: __dirname = <app>/out/main
  return join(__dirname, '../../resources/icon.png')
}

/**
 * 显式设置应用菜单,修复主键盘 Ctrl++(即 Ctrl+Shift+=)无法放大页面的问题。
 * 默认菜单只绑定了 Ctrl+= 与小键盘 +,没有覆盖主键盘加号。
 */
function setupAppMenu(): void {
  const isMac = process.platform === 'darwin'
  const zoom = (fn: 'zoomIn' | 'zoomOut' | 'resetZoom') => (
    _item: Electron.MenuItem,
    focusedWindow: Electron.BaseWindow | undefined,
  ) => {
    const focused = focusedWindow as Electron.BrowserWindow | undefined
    const wc = focused?.webContents ?? win?.webContents
    if (!wc) return
    if (fn === 'zoomIn') wc.setZoomLevel(wc.getZoomLevel() + 0.5)
    else if (fn === 'zoomOut') wc.setZoomLevel(wc.getZoomLevel() - 0.5)
    else wc.setZoomLevel(0)
  }
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac ? [{ role: 'appMenu' as const }] : []),
    { role: 'fileMenu' },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        // 放大:覆盖主键盘 + (Ctrl+Shift+=)、主键盘 =(Ctrl+=)、小键盘 + 三种组合
        { label: 'Zoom In', accelerator: 'CmdOrCtrl+Shift+=', click: zoom('zoomIn') },
        { label: 'Zoom In (=)', accelerator: 'CmdOrCtrl+=', click: zoom('zoomIn') },
        { label: 'Zoom In (Keypad)', accelerator: 'CmdOrCtrl+numadd', click: zoom('zoomIn') },
        // 缩小:主键盘 - 与小键盘 -
        { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', click: zoom('zoomOut') },
        { label: 'Zoom Out (Keypad)', accelerator: 'CmdOrCtrl+numsub', click: zoom('zoomOut') },
        { type: 'separator' },
        { label: 'Reset Zoom', accelerator: 'CmdOrCtrl+0', click: zoom('resetZoom') },
      ],
    },
    { role: 'windowMenu' },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function createWindow(): void {
  win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0a0a0a',
    icon: resolveAppIcon(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  win.on('ready-to-show', () => win?.show())

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  win.on('closed', () => {
    win = null
  })

  // electron-vite dev server, otherwise production file
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    void win.loadURL(devUrl)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  setupAppMenu()
  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// 关 app 前杀掉 llama-server,避免显存泄露
let quitting = false
app.on('before-quit', (e) => {
  if (quitting) return
  e.preventDefault()
  quitting = true
  void stopServer().finally(() => app.quit())
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
