const { contextBridge, ipcRenderer } = require('electron');

// Expone el objeto 'apiSiam' en window (window.apiSiam) para usarlo en Vue
contextBridge.exposeInMainWorld('apiSiam', {
    reportes: {
        iniciar: (datos) => ipcRenderer.invoke('reportes:iniciar', datos),
        guardar: (datos) => ipcRenderer.invoke('reportes:guardar', datos),
        listar: (datos) => ipcRenderer.invoke('reportes:listar', datos)
    },
    pacientes: {
        crear: (datosPaciente) => ipcRenderer.invoke('pacientes:crearPerfil', datosPaciente),
        crearPerfil: (datosPaciente) => ipcRenderer.invoke('pacientes:crearPerfil', datosPaciente),
        obtenerTodos: () => ipcRenderer.invoke('pacientes:obtenerPerfiles'),
        obtenerPerfiles: () => ipcRenderer.invoke('pacientes:obtenerPerfiles'),
        actualizarMano: (datos) => ipcRenderer.invoke('pacientes:actualizarMano', datos)
    },
    metrics: {
        iniciarSesion: (sesion) => ipcRenderer.invoke('metrics:iniciarSesion', sesion),
        registrarTelemetria: (tel) => ipcRenderer.invoke('metrics:registrarTelemetria', tel),
        finalizarSesion: (id) => ipcRenderer.invoke('metrics:finalizarSesion', id)
    }
});
