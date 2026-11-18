import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

function sqliteApiPlugin() {
  return {
    name: 'sqlite-api-plugin',
    async configureServer(server) {
      let patientController = null;
      try {
        const initMod = await import('./src/database/init.js');
        if (initMod.initDatabase) initMod.initDatabase();
        const ctrlMod = await import('./src/database/controllers/patientController.js');
        patientController = ctrlMod.default || ctrlMod;
      } catch (e) {
        console.warn('Advertencia al inicializar SQLite en Vite:', e.message);
      }

      server.middlewares.use(async (req, res, next) => {
        if (req.url && req.url.startsWith('/api/pacientes')) {
          if (!patientController) {
            res.statusCode = 503;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: 'Base de datos SQLite no disponible' }));
            return;
          }

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
