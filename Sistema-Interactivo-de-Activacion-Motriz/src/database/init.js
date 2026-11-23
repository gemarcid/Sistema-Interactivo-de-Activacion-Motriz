import db from "./connection.js";

export async function initDatabase() {
    try {
        await db.all("SELECT 1 AS ok");
        console.log("Conectado correctamente a Cloudflare D1 (SIAM).");

        // Verificación de columnas en perfil (migración segura)
        const columns = await db.all("PRAGMA table_info(perfil);");
        const colNames = columns.map((c) => c.name);

        if (colNames.length === 0) {
            throw new Error("Las tablas aún no existen en D1. Ejecuta init.sql con Wrangler.");
        }

        if (!colNames.includes("mano_dominante")) {
            await db.run("ALTER TABLE perfil ADD COLUMN mano_dominante TEXT NOT NULL DEFAULT 'DERECHA';");
            console.log("Columna mano_dominante agregada a perfil");
        }
        if (!colNames.includes("dificultad")) {
            await db.run("ALTER TABLE perfil ADD COLUMN dificultad TEXT DEFAULT 'facil';");
            console.log("Columna dificultad agregada a perfil");
        }
        if (!colNames.includes("avatar")) {
            await db.run("ALTER TABLE perfil ADD COLUMN avatar TEXT DEFAULT '👴';");
            console.log("Columna avatar agregada a perfil");
        }
        await db.run(`CREATE TABLE IF NOT EXISTS sesion_rendimiento (
            clave TEXT PRIMARY KEY,
            id_sesion INTEGER NOT NULL UNIQUE REFERENCES sesion(id_sesion) ON DELETE CASCADE,
            id_perfil INTEGER NOT NULL REFERENCES perfil(id_perfil),
            revision INTEGER NOT NULL DEFAULT 0
        )`);
    } catch (err) {
        throw new Error(`No se pudo inicializar Cloudflare D1: ${err.message}`);
    }
}