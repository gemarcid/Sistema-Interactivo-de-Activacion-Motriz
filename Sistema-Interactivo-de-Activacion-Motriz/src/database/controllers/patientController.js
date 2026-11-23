import db from "../connection.js";

export default {
    crearPerfil: async (event, perfil) => {
        const manoDominante = (perfil.mano_dominante || "DERECHA").toUpperCase() === "IZQUIERDA"
            ? "IZQUIERDA"
            : "DERECHA";
        const nombre = (perfil.nombre || "Paciente").trim();
        const estaturaCm = Number(perfil.estatura_cm) || 160;
        const edad = Number(perfil.edad) || 70;
        const dificultad = perfil.dificultad || "facil";
        const avatar = perfil.avatar || "👴";

        let userId = perfil.id_usuario;

        if (!userId) {
            const sqlUsuario = `INSERT INTO usuario (nombre, rol, activo) VALUES (?, 'PACIENTE', 1)`;
            const userRes = await db.run(sqlUsuario, [nombre]);
            userId = userRes.lastID;
        }

        const sqlPerfil = `
            INSERT INTO perfil (id_usuario, estatura_cm, edad, mano_dominante, dificultad, avatar)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        const perfRes = await db.run(sqlPerfil, [
            userId,
            estaturaCm,
            edad,
            manoDominante,
            dificultad,
            avatar
        ]);

        return {
            id_perfil: perfRes.lastID,
            id_usuario: userId,
            nombre,
            estatura_cm: estaturaCm,
            edad,
            mano_dominante: manoDominante,
            dificultad,
            avatar
        };
    },

    obtenerPerfiles: async () => {
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
        return await db.all(sql);
    },

    actualizarManoDominante: async (event, data) => {
        const idPerfil = Number(data?.id_perfil);
        if (!idPerfil) {
            throw new Error("id_perfil requerido para actualizar");
        }

        const manoDominante = (data.mano_dominante || "DERECHA").toUpperCase() === "IZQUIERDA"
            ? "IZQUIERDA"
            : "DERECHA";
        const sql = `UPDATE perfil SET mano_dominante = ? WHERE id_perfil = ?`;
        const res = await db.run(sql, [manoDominante, idPerfil]);

        return {
            id_perfil: idPerfil,
            mano_dominante: manoDominante,
            changes: res.changes
        };
    }
};