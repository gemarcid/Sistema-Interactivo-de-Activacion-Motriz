import { initDatabase } from './src/database/init.js';
import patientController from './src/database/controllers/patientController.js';

const shouldSeed = process.argv.includes('--seed');

console.log('--- CONSULTANDO BASE DE DATOS SQLITE (SIAM) ---');

initDatabase();

setTimeout(async () => {
    try {
        if (shouldSeed) {
            console.log('\nInsertando perfiles de ejemplo (--seed)...');
            await patientController.crearPerfil(null, {
                nombre: 'Alberto Morales',
                edad: 78,
                estatura_cm: 168,
                mano_dominante: 'IZQUIERDA',
                dificultad: 'facil',
                avatar: '👴'
            });
            await patientController.crearPerfil(null, {
                nombre: 'Rosa Valenzuela',
                edad: 74,
                estatura_cm: 158,
                mano_dominante: 'DERECHA',
                dificultad: 'medio',
                avatar: '👵'
            });
        }

        console.log('\nPERFILES REGISTRADOS EN SQLite (JOIN usuario + perfil):');
        const perfiles = await patientController.obtenerPerfiles();

        if (perfiles.length === 0) {
            console.log('No hay perfiles registrados todavía.');
        } else {
            console.table(perfiles);
        }

        console.log('\nTip: Ejecuta "node test-db.js --seed" si deseas insertar perfiles de prueba.');
        process.exit(0);
    } catch (err) {
        console.error('\nERROR:', err);
        process.exit(1);
    }
}, 800);
