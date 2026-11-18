import { initDatabase } from './src/main/database/init.js';
import patientController from './src/main/database/controllers/patientController.js';

const shouldSeed = process.argv.includes('--seed');

console.log('--- CONSULTANDO BASE DE DATOS SQLITE (SIAM) ---');

initDatabase();

setTimeout(async () => {
    try {
        if (shouldSeed) {
            console.log('\n🌱 Insertando perfiles de ejemplo (--seed)...');
            await patientController.crearPerfil(null, {
                nombre: 'Don Alberto',
                edad: 78,
                estatura_cm: 168,
                mano_dominante: 'IZQUIERDA',
                dificultad: 'facil',
                avatar: '👴'
            });
            await patientController.crearPerfil(null, {
                nombre: 'Doña Rosa',
                edad: 74,
                estatura_cm: 158,
                mano_dominante: 'DERECHA',
                dificultad: 'medio',
                avatar: '👵'
            });
        }

        console.log('\n PERFILES REGISTRADOS EN SQLite (JOIN usuario + perfil):');
        const perfiles = await patientController.obtenerPerfiles();

        if (perfiles.length === 0) {
            console.log(' No hay perfiles registrados todavía.');
        } else {
            console.table(perfiles);
        }

        console.log('\n Tip: Ejecuta "node test-db.js --seed" si deseas insertar perfiles de prueba.');
        process.exit(0);
    } catch (err) {
        console.error('\n ERROR:', err);
        process.exit(1);
    }
}, 800);
