"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    saveFile: (content) => electron_1.ipcRenderer.invoke('dialog:saveFile', content),
    loadFile: () => electron_1.ipcRenderer.invoke('dialog:loadFile'),
    savePdf: (buffer) => electron_1.ipcRenderer.invoke('dialog:savePdf', buffer),
});
//# sourceMappingURL=preload.js.map