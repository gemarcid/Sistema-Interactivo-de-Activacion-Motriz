import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

function sqliteApiPlugin() {
  return {
    name: 'sqlite-api-plugin',
    async configureServer(server) {
      let patientController = null;
      let reportsController = null;
      let databaseError = '';
      try {
        const initMod = await import('./src/database/init.js');
        await initMod.initDatabase();
        const ctrlMod = await import('./src/database/controllers/patientController.js');
        patientController = ctrlMod.default || ctrlMod;
        reportsController = (await import('./src/database/controllers/sessionReportsController.js')).default;
      } catch (e) {
        databaseError = e.message;
        console.warn('Advertencia al inicializar Cloudflare D1 en Vite:', e.message);
      }

      server.middlewares.use(async (req, res, next) => {
        if (req.url?.split('?')[0] === '/api/reportes') {
          res.setHeader('Cache-Control', 'no-store');
          res.setHeader('Content-Type', 'application/json');
          try {
            if (!reportsController) throw new Error(databaseError || 'Cloudflare D1 no está disponible');
            let data;
            if (req.method === 'GET') {
              const url = new URL(req.url, 'http://localhost');
              data = await reportsController.listar(null, { id_perfil: Number(url.searchParams.get('id_perfil')) });
            } else if (req.method === 'POST') {
              let body = '';
              for await (const chunk of req) {
                body += chunk;
                if (body.length > 2_000_000) throw new Error('Reporte demasiado grande');
              }
              const payload = JSON.parse(body);
              const actions = { iniciar: reportsController.iniciar, guardar: reportsController.guardar };
              if (!Object.hasOwn(actions, payload.action)) throw new Error('Acción inválida');
              data = await actions[payload.action](null, payload);
            } else {
              res.statusCode = 405;
              res.end(JSON.stringify({ success: false, error: 'Método no permitido' }));
              return;
            }
            res.end(JSON.stringify({ success: true, data }));
          } catch (error) {
            res.statusCode = 400;
            res.end(JSON.stringify({ success: false, error: error.message || String(error) }));
          }
          return;
        }
        if (req.url && req.url.startsWith('/api/pacientes')) {
          if (!patientController) {
            res.statusCode = 503;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: databaseError || 'Cloudflare D1 no disponible' }));
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
