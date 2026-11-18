import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { initDatabase } from './src/main/database/init.js';
import patientController from './src/main/database/controllers/patientController.js';

// Inicializar la base de datos SQLite con los esquemas de init.sql
try {
  initDatabase();
} catch (e) {
  console.warn('Advertencia al inicializar SQLite:', e.message);
}

function sqliteApiPlugin() {
  return {
    name: 'sqlite-api-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url && req.url.startsWith('/api/pacientes')) {
          if (req.method === 'GET') {
            try {
              const perfiles = await patientController.obtenerPerfiles();
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, data: perfiles }));
              return;
            } catch (err) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: String(err) }));
              return;
            }
          }
          if (req.method === 'POST') {
            let body = '';
            req.on('data', (chunk) => { body += chunk; });
            req.on('end', async () => {
              try {
                const parsed = JSON.parse(body || '{}');
                const nuevo = await patientController.crearPerfil(null, parsed);
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true, data: nuevo }));
              } catch (err) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: false, error: String(err) }));
              }
            });
            return;
          }
          if (req.method === 'PUT' || req.method === 'PATCH') {
            let body = '';
            req.on('data', (chunk) => { body += chunk; });
            req.on('end', async () => {
              try {
                const parsed = JSON.parse(body || '{}');
                const updated = await patientController.actualizarManoDominante(null, parsed);
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true, data: updated }));
              } catch (err) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: false, error: String(err) }));
              }
            });
            return;
          }
        }
        next();
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), sqliteApiPlugin()],
});
