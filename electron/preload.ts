import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  saveFile: (content: string) => ipcRenderer.invoke('dialog:saveFile', content),
  saveFileDirect: (path: string, content: string) => ipcRenderer.invoke('dialog:saveFileDirect', path, content),
  loadFile: () => ipcRenderer.invoke('dialog:loadFile'),
  savePdf: (buffer: ArrayBuffer) => ipcRenderer.invoke('dialog:savePdf', buffer),
});
