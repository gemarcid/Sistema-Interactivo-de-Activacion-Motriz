import sqlite3Pkg from 'sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const sqlite3 = sqlite3Pkg.verbose();
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Resuelve siempre a <app-root>/data sin importar desde qué carpeta se ejecute Node/Vite
const dataDir = path.resolve(__dirname, '../../data');

if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = process.env.DB_PATH || path.join(dataDir, 'siam_prod.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Error al conectar con SQLite:', err.message);
    } else {
        console.log(`✅ Conectado a SQLite. Ruta: ${dbPath}`);
        db.run('PRAGMA foreign_keys = ON;');
    }
});

export default db;
