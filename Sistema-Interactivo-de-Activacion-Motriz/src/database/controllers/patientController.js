import db from '../connection.js';

export default {
    /**
     * Guarda el perfil del paciente usando los atributos de init.sql:
     * - usuario: nombre, rol ('PACIENTE'), activo (1)
     * - perfil: id_usuario, estatura_cm, edad, mano_dominante ('IZQUIERDA' / 'DERECHA'), dificultad, avatar
     * Sin usuario, contraseña ni correo electrónico.
     */
    crearPerfil: (event, perfil) => {
        return new Promise((resolve, reject) => {
            const manoDominante = (perfil.mano_dominante || 'DERECHA').toUpperCase() === 'IZQUIERDA' ? 'IZQUIERDA' : 'DERECHA';
            const nombre = (perfil.nombre || 'Paciente').trim();
            const estaturaCm = Number(perfil.estatura_cm) || 160;
            const edad = Number(perfil.edad) || 70;
            const dificultad = perfil.dificultad || 'facil';
            const avatar = perfil.avatar || '👴';

            // Si ya viene con id_usuario, insertamos directamente en perfil
            if (perfil.id_usuario) {
                const sqlPerfil = `
                    INSERT INTO perfil (id_usuario, estatura_cm, edad, mano_dominante, dificultad, avatar)
                    VALUES (?, ?, ?, ?, ?, ?)
                `;
                db.run(sqlPerfil, [perfil.id_usuario, estaturaCm, edad, manoDominante, dificultad, avatar], function(err) {
                    if (err) return reject(err.message);
                    resolve({
                        id_perfil: this.lastID,
                        id_usuario: perfil.id_usuario,
                        nombre,
                        estatura_cm: estaturaCm,
                        edad,
                        mano_dominante: manoDominante,
                        dificultad,
                        avatar
                    });
                });
            } else {
                // Creamos el registro en la tabla usuario primero (sin contraseñas ni correos)
                const sqlUsuario = `INSERT INTO usuario (nombre, rol, activo) VALUES (?, 'PACIENTE', 1)`;
                db.run(sqlUsuario, [nombre], function(userErr) {
                    if (userErr) return reject(userErr.message);
                    const newUserId = this.lastID;

                    const sqlPerfil = `
                        INSERT INTO perfil (id_usuario, estatura_cm, edad, mano_dominante, dificultad, avatar)
                        VALUES (?, ?, ?, ?, ?, ?)
                    `;
                    db.run(sqlPerfil, [newUserId, estaturaCm, edad, manoDominante, dificultad, avatar], function(perfErr) {
                        if (perfErr) return reject(perfErr.message);
                        resolve({
                            id_perfil: this.lastID,
                            id_usuario: newUserId,
                            nombre,
                            estatura_cm: estaturaCm,
                            edad,
                            mano_dominante: manoDominante,
                            dificultad,
                            avatar
                        });
                    });
                });
            }
        });
    },

    obtenerPerfiles: () => {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    p.id_perfil,
                    p.estatura_cm,
                    p.edad,
                    COALESCE(p.mano_dominante, 'DERECHA') AS mano_dominante,
                    COALESCE(p.dificultad, 'facil') AS dificultad,
                    COALESCE(p.avatar, '👴') AS avatar,
                    u.id_usuario,
                    u.nombre,
                    u.rol 
                FROM perfil p 
                INNER JOIN usuario u ON p.id_usuario = u.id_usuario 
                WHERE u.activo = 1
                ORDER BY p.id_perfil DESC
            `;
            db.all(sql, [], (err, rows) => {
                if (err) reject(err.message);
                else resolve(rows || []);
            });
        });
    },

    actualizarManoDominante: (event, data) => {
        return new Promise((resolve, reject) => {
            const idPerfil = Number(data?.id_perfil);
            if (!idPerfil) return reject('id_perfil requerido para actualizar');

            const manoDominante = (data.mano_dominante || 'DERECHA').toUpperCase() === 'IZQUIERDA' ? 'IZQUIERDA' : 'DERECHA';
            const sql = `UPDATE perfil SET mano_dominante = ? WHERE id_perfil = ?`;
            db.run(sql, [manoDominante, idPerfil], function(err) {
                if (err) return reject(err.message);
                resolve({ id_perfil: idPerfil, mano_dominante: manoDominante, changes: this.changes });
            });
        });
    }
};
