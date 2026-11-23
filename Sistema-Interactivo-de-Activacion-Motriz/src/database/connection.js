try {
  if (typeof process.loadEnvFile === "function") {
    process.loadEnvFile();
  } else {
    const dotenv = await import("dotenv");
    dotenv.default?.config?.();
  }
} catch (e) {
  // .env ya cargado o no presente
}

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const DATABASE_ID = process.env.CLOUDFLARE_D1_DATABASE_ID;
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

if (!ACCOUNT_ID || !DATABASE_ID || !API_TOKEN) {
    console.error("Faltan variables de entorno de Cloudflare D1 en .env");
}

const D1_ENDPOINT = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/query`;

async function query(payload) {
    if (!ACCOUNT_ID || !DATABASE_ID || !API_TOKEN) throw new Error("Configura Cloudflare D1 en el archivo .env para consultar y guardar los reportes.");
    const response = await fetch(D1_ENDPOINT, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${API_TOKEN}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error HTTP en Cloudflare D1 (${response.status}): ${errorText}`);
    }

    const data = await response.json();

    if (!data.success) {
        const messages = (data.errors || []).map((err) => err.message).join("; ");
        throw new Error(`Error SQL en Cloudflare D1: ${messages}`);
    }

    const results = data.result || [];
    const failed = results.find(result => result.success === false || result.error);
    if (failed) throw new Error(failed.error || "No se pudo ejecutar la consulta en D1");
    return results;
}

const db = {
    async batch(statements) {
        return query({ batch: statements });
    },
    async all(sql, params = []) {
        const { results = [] } = (await query({ sql, params }))[0] || {};
        return results;
    },

    async get(sql, params = []) {
        const { results = [] } = (await query({ sql, params }))[0] || {};
        return results[0] || null;
    },

    async run(sql, params = []) {
        const { meta = {} } = (await query({ sql, params }))[0] || {};
        return {
            lastID: meta.last_row_id ?? null,
            changes: meta.changes ?? 0
        };
    }
};

export default db;