const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
require('dotenv').config();

const { initDatabase } = require('../database/init');
const authController = require('../database/controllers/authController');
const patientController = require('../database/controllers/patientController');
const metricsController = require('../database/controllers/metricsController');

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
        mainWindow.loadFile(path.join(__dirname, '../renderer/dist/index.html'));
    }
}

app.whenReady().then(() => {
    initDatabase();

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
