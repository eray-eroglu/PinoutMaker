import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  saveFile: (content: string) => ipcRenderer.invoke('dialog:saveFile', content),
  loadFile: () => ipcRenderer.invoke('dialog:loadFile'),
  savePdf: (buffer: ArrayBuffer) => ipcRenderer.invoke('dialog:savePdf', buffer),
});
