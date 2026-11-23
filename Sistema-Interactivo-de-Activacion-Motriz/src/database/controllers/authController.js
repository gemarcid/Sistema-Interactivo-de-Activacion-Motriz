import db from "../connection.js";

export default {
    crearUsuario: async (event, usuario) => {
        const sql = `INSERT INTO usuario (nombre, rol, activo) VALUES (?, ?, ?)`;
        const res = await db.run(sql, [usuario.nombre, usuario.rol, usuario.activo ?? 1]);
        return { id_usuario: res.lastID, ...usuario };
    },

    obtenerUsuarios: async () => {
        const sql = `SELECT * FROM usuario WHERE activo = 1`;
        return await db.all(sql);
    },

    registrarAuditoria: async (event, auditoria) => {
        const sql = `INSERT INTO auditoria (id_usuario, accion, resultado) VALUES (?, ?, ?)`;
        const res = await db.run(sql, [
            auditoria.id_usuario ?? null,
            auditoria.accion,
            auditoria.resultado
        ]);
        return { id_auditoria: res.lastID, ...auditoria };
    }
};