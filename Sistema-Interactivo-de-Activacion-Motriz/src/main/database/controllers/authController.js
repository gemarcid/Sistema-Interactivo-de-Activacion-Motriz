import db from '../connection.js';

export default {
    crearUsuario: (event, usuario) => {
        return new Promise((resolve, reject) => {
            const sql = `INSERT INTO usuario (nombre, rol, activo) VALUES (?, ?, ?)`;
            db.run(sql, [usuario.nombre, usuario.rol, usuario.activo ?? 1], function(err) {
                if (err) reject(err.message);
                else resolve({ id_usuario: this.lastID, ...usuario });
            });
        });
    },

    obtenerUsuarios: () => {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM usuario WHERE activo = 1`;
            db.all(sql, [], (err, rows) => {
                if (err) reject(err.message);
                else resolve(rows);
            });
        });
    },

    registrarAuditoria: (event, auditoria) => {
        return new Promise((resolve, reject) => {
            const sql = `INSERT INTO auditoria (id_usuario, accion, resultado) VALUES (?, ?, ?)`;
            db.run(sql, [auditoria.id_usuario, auditoria.accion, auditoria.resultado], function(err) {
                if (err) reject(err.message);
                else resolve({ id_auditoria: this.lastID, ...auditoria });
            });
        });
    }
};