"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
function createWindow() {
    const win = new electron_1.BrowserWindow({
        width: 1200,
        height: 800,
        icon: path_1.default.join(__dirname, process.env.VITE_DEV_SERVER_URL ? '../public/cpu.png' : '../dist/cpu.png'),
        webPreferences: {
            preload: path_1.default.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });
    const url = process.env.VITE_DEV_SERVER_URL;
    if (url) {
        win.loadURL(url);
    }
    else {
        win.loadFile(path_1.default.join(__dirname, '../dist/index.html'));
    }
    win.on('close', (e) => {
        const choice = electron_1.dialog.showMessageBoxSync(win, {
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
electron_1.app.whenReady().then(() => {
    electron_1.ipcMain.handle('dialog:saveFile', (_, content) => __awaiter(void 0, void 0, void 0, function* () {
        const { canceled, filePath } = yield electron_1.dialog.showSaveDialog({
            filters: [{ name: 'Pinout Project', extensions: ['json'] }],
        });
        if (canceled || !filePath)
            return { success: false, path: null };
        fs_1.default.writeFileSync(filePath, content, 'utf-8');
        return { success: true, path: filePath };
    }));
    electron_1.ipcMain.handle('dialog:saveFileDirect', (_, filePath, content) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            fs_1.default.writeFileSync(filePath, content, 'utf-8');
            return { success: true };
        }
        catch (e) {
            console.error('Failed to quick save:', e);
            return { success: false };
        }
    }));
    electron_1.ipcMain.handle('dialog:loadFile', () => __awaiter(void 0, void 0, void 0, function* () {
        const { canceled, filePaths } = yield electron_1.dialog.showOpenDialog({
            properties: ['openFile'],
            filters: [{ name: 'Pinout Project', extensions: ['json'] }],
        });
        if (canceled || filePaths.length === 0)
            return { content: null, path: null };
        const content = fs_1.default.readFileSync(filePaths[0], 'utf-8');
        return { content, path: filePaths[0] };
    }));
    electron_1.ipcMain.handle('dialog:savePdf', (_, buffer) => __awaiter(void 0, void 0, void 0, function* () {
        const { canceled, filePath } = yield electron_1.dialog.showSaveDialog({
            filters: [{ name: 'PDF Document', extensions: ['pdf'] }],
        });
        if (canceled || !filePath)
            return false;
        fs_1.default.writeFileSync(filePath, Buffer.from(buffer));
        return true;
    }));
    createWindow();
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
//# sourceMappingURL=main.js.map