import db from '../connection.js';

export default {
    iniciarSesion: (event, sesion) => {
        return new Promise((resolve, reject) => {
            const sql = `INSERT INTO sesion (id_perfil, id_minijuego, estado) VALUES (?, ?, 'INICIADA')`;
            db.run(sql, [sesion.id_perfil, sesion.id_minijuego], function(err) {
                if (err) reject(err.message);
                else resolve({ id_sesion: this.lastID });
            });
        });
    },

    registrarTelemetria: (event, tel) => {
        return new Promise((resolve, reject) => {
            const sql = `
                INSERT INTO telemetria 
                (id_sesion, id_dispositivo, tiempo_activo, tiempo_descanso, puntaje, vector_movimiento, centro_gravedad) 
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `;
            db.run(sql, [
                tel.id_sesion, tel.id_dispositivo, tel.tiempo_activo, 
                tel.tiempo_descanso, tel.puntaje, tel.vector_movimiento, tel.centro_gravedad
            ], function(err) {
                if (err) reject(err.message);
                else resolve({ id_telemetria: this.lastID });
            });
        });
    },

    finalizarSesion: (event, id_sesion) => {
        return new Promise((resolve, reject) => {
            const sql = `UPDATE sesion SET fin = CURRENT_TIMESTAMP, estado = 'FINALIZADA' WHERE id_sesion = ?`;
            db.run(sql, [id_sesion], function(err) {
                if (err) reject(err.message);
                else resolve({ success: true, changes: this.changes });
            });
        });
    }
};
