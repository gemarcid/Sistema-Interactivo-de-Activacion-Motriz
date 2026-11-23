import dotenv from "dotenv";

dotenv.config();

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const DATABASE_ID = process.env.CLOUDFLARE_D1_DATABASE_ID;
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

if (!ACCOUNT_ID || !DATABASE_ID || !API_TOKEN) {
    console.error("Faltan variables de entorno de Cloudflare D1 en .env");
}

const D1_ENDPOINT = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/query`;

async function query(sql, params = []) {
    const response = await fetch(D1_ENDPOINT, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${API_TOKEN}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ sql, params })
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

    const firstResult = data.result?.[0] || {};
    return {
        results: firstResult.results || [],
        meta: firstResult.meta || {}
    };
}

const db = {
    async all(sql, params = []) {
        const { results } = await query(sql, params);
        return results;
    },

    async get(sql, params = []) {
        const { results } = await query(sql, params);
        return results[0] || null;
    },

    async run(sql, params = []) {
        const { meta } = await query(sql, params);
        return {
            lastID: meta.last_row_id ?? null,
            changes: meta.changes ?? 0
        };
    }
};

export default db;