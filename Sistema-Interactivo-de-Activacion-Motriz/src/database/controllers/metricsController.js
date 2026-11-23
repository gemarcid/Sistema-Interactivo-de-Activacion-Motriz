import db from "../connection.js";

export default {
    iniciarSesion: async (event, sesion) => {
        const sql = `INSERT INTO sesion (id_perfil, id_minijuego, estado) VALUES (?, ?, 'INICIADA')`;
        const res = await db.run(sql, [sesion.id_perfil, sesion.id_minijuego]);
        return { id_sesion: res.lastID };
    },

    registrarTelemetria: async (event, tel) => {
        const sql = `
            INSERT INTO telemetria
            (id_sesion, id_dispositivo, tiempo_activo, tiempo_descanso, puntaje, vector_movimiento, centro_gravedad)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        const res = await db.run(sql, [
            tel.id_sesion,
            tel.id_dispositivo ?? null,
            tel.tiempo_activo ?? null,
            tel.tiempo_descanso ?? null,
            tel.puntaje ?? null,
            tel.vector_movimiento ?? null,
            tel.centro_gravedad ?? null
        ]);
        return { id_telemetria: res.lastID };
    },

    finalizarSesion: async (event, id_sesion) => {
        const sql = `UPDATE sesion SET fin = CURRENT_TIMESTAMP, estado = 'FINALIZADA' WHERE id_sesion = ?`;
        const res = await db.run(sql, [id_sesion]);
        return { success: true, changes: res.changes };
    }
};