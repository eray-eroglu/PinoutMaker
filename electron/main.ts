import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs';

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, process.env.VITE_DEV_SERVER_URL ? '../public/cpu.png' : '../dist/cpu.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const url = process.env.VITE_DEV_SERVER_URL;
  if (url) {
    win.loadURL(url);
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  win.on('close', (e) => {
    const choice = dialog.showMessageBoxSync(win, {
      type: 'question',
      buttons: ['Yes', 'No'],
      title: 'Exit Application',
      message: 'Are you sure you want to exit the application ? \nUnsaved changes may be lost.',
      defaultId: 1,
      cancelId: 1
    });

    if (choice === 1) {
      e.preventDefault();
    }
  });
}

app.whenReady().then(() => {
  ipcMain.handle('dialog:saveFile', async (_, content: string) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      filters: [{ name: 'Pinout Project', extensions: ['json'] }],
    });
    if (canceled || !filePath) return { success: false, path: null };
    fs.writeFileSync(filePath, content, 'utf-8');
    return { success: true, path: filePath };
  });

  ipcMain.handle('dialog:saveFileDirect', async (_, filePath: string, content: string) => {
    try {
      fs.writeFileSync(filePath, content, 'utf-8');
      return { success: true };
    } catch (e) {
      console.error('Failed to quick save:', e);
      return { success: false };
    }
  });

  ipcMain.handle('dialog:loadFile', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Pinout Project', extensions: ['json'] }],
    });
    if (canceled || filePaths.length === 0) return { content: null, path: null };
    const content = fs.readFileSync(filePaths[0], 'utf-8');
    return { content, path: filePaths[0] };
  });

  ipcMain.handle('dialog:savePdf', async (_, buffer: ArrayBuffer) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      filters: [{ name: 'PDF Document', extensions: ['pdf'] }],
    });
    if (canceled || !filePath) return false;
    fs.writeFileSync(filePath, Buffer.from(buffer));
    return true;
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
