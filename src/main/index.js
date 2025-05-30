import { app, shell, BrowserWindow, ipcMain, screen, Tray, Menu } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import Store from 'electron-store'

const store = new Store()
let mainWindow // 主窗口对象
let originalSize = { width: 450, height: 580 } // 原始窗口大小
let isMiniMode = false // 是否处于最小化模式
let tray = null // 托盘对象
let appIsQuitting = false // 应用是否正在退出

function createWindow() {
  mainWindow = new BrowserWindow({
    width: originalSize.width,
    height: originalSize.height,
    show: false, // 初始时不显示窗口，直到准备就绪
    resizable: false, // 禁止调整窗口大小
    transparent: true, // 窗口透明
    backgroundColor: '#0000', // 背景透明
    frame: false, // 无边框窗口
    autoHideMenuBar: true, // 隐藏菜单栏
    ...(process.platform === 'linux' ? { icon } : {}),
    icon: icon, // 窗口图标
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'), // 预加载脚本
      sandbox: false, // 禁用沙盒
      contextIsolation: false, // 禁用上下文隔离
      nodeIntegration: true // 启用 Node 集成
    }
  })

  mainWindow.on('ready-to-show', () => {
    // 在窗口准备就绪后显示窗口
    mainWindow.show()
  })

  mainWindow.on('close', (event) => {
    // 如果不是真的要退出应用，则阻止窗口关闭，然后隐藏窗口
    if (!appIsQuitting) {
      event.preventDefault()
      mainWindow.hide()
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function enterMiniMode(mainWindow, currentScreen) {
  if (!mainWindow) return;

  originalSize = mainWindow.getSize();
  mainWindow.setSize(300, 120);
  mainWindow.setPosition(
    currentScreen.workArea.x,
    currentScreen.workArea.y + currentScreen.workArea.height - 120
  );
  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.setResizable(false);
  mainWindow.setIgnoreMouseEvents(true);
  mainWindow.setSkipTaskbar(true);

  isMiniMode = true
  mainWindow.webContents.send('mini-mode-changed', isMiniMode)
}

function exitMiniMode(mainWindow) {
  if (!mainWindow) return;

  mainWindow.setSize(originalSize[0], originalSize[1]);
  mainWindow.setAlwaysOnTop(false);
  mainWindow.setResizable(true);
  mainWindow.center();
  mainWindow.setIgnoreMouseEvents(false);
  mainWindow.setSkipTaskbar(false);

  isMiniMode = false
  mainWindow.webContents.send('mini-mode-changed', isMiniMode)
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('cn.lnulpl.salary')   // 应用唯一标识符

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  // 创建系统托盘图标和上下文菜单
  tray = new Tray(icon)
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '修改设置',
      click: () => {
        exitMiniMode(mainWindow)
      }
    },
    {
      label: '退出',
      click: () => {
        appIsQuitting = true
        app.quit()
      }
    }
  ])

  tray.setToolTip('工资计算器')    // 设置鼠标悬停在托盘图标上时显示的文字
  tray.setContextMenu(contextMenu) // 将上下文菜单绑定到托盘图标
  tray.on('click', () => {
    exitMiniMode(mainWindow)
  })

  app.on('activate', function () {
    if (mainWindow) {
      mainWindow.show()
    } else if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

ipcMain.on('toggle-mini-mode', () => {
  if (!mainWindow) return
  isMiniMode = !isMiniMode

  const currentScreen = screen.getDisplayNearestPoint(mainWindow.getBounds())

  if (isMiniMode) enterMiniMode(mainWindow, currentScreen);
  else exitMiniMode(mainWindow);
})

ipcMain.handle('get-initial-mini-mode-state', () => {
  return isMiniMode
})

ipcMain.handle('save-settings', (_, data) => {
  store.set('salaryCalculatorForm', data)
})

ipcMain.handle('load-settings', () => {
  return store.get('salaryCalculatorForm')
})
