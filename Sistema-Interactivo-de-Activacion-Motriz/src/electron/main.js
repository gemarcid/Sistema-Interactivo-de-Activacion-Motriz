import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';

import { initDatabase } from '../database/init.js';
import authController from '../database/controllers/authController.js';
import patientController from '../database/controllers/patientController.js';
import metricsController from '../database/controllers/metricsController.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    if (process.env.NODE_ENV === 'development') {
        mainWindow.loadURL('http://localhost:5173');
    } else {
        mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
    }
}

app.whenReady().then(async () => {
    await initDatabase();
    const reportsController = (await import('../database/controllers/sessionReportsController.js')).default;
    ipcMain.handle('reportes:iniciar', reportsController.iniciar);
    ipcMain.handle('reportes:guardar', reportsController.guardar);
    ipcMain.handle('reportes:listar', reportsController.listar);

    // Rutas IPC Auth
    ipcMain.handle('auth:crearUsuario', authController.crearUsuario);
    ipcMain.handle('auth:obtenerUsuarios', authController.obtenerUsuarios);
    ipcMain.handle('auth:auditoria', authController.registrarAuditoria);

    // Rutas IPC Pacientes (Perfiles)
    ipcMain.handle('pacientes:crearPerfil', patientController.crearPerfil);
    ipcMain.handle('pacientes:crear', patientController.crearPerfil);
    ipcMain.handle('pacientes:obtenerPerfiles', patientController.obtenerPerfiles);
    ipcMain.handle('pacientes:obtener', patientController.obtenerPerfiles);
    ipcMain.handle('pacientes:actualizarMano', patientController.actualizarManoDominante);

    // Rutas IPC Métricas y Sesiones
    ipcMain.handle('metrics:iniciarSesion', metricsController.iniciarSesion);
    ipcMain.handle('metrics:registrarTelemetria', metricsController.registrarTelemetria);
    ipcMain.handle('metrics:finalizarSesion', metricsController.finalizarSesion);

    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
