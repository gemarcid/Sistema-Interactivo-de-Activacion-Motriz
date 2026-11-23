import db from '../connection.js'
import { summarizeActivities } from '../../game/sessionReport.js'

const run = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function (error) {
    if (error) reject(error)
    else resolve({ id: this.lastID, changes: this.changes })
  })
})
const all = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows))
})
let queue = Promise.resolve()

function transaction(operation) {
  const task = queue.then(async () => {
    await run('BEGIN IMMEDIATE')
    try {
      const result = await operation()
      await run('COMMIT')
      return result
    } catch (error) {
      await run('ROLLBACK')
      throw error
    }
  })
  queue = task.catch(() => {})
  return task
}

function integer(value, name) {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${name} inválido`)
  return value
}

function validateSnapshot(snapshot) {
  if (!snapshot || snapshot.version !== 1 || !Array.isArray(snapshot.activities) || snapshot.activities.length > 500) {
    throw new Error('Reporte inválido')
  }
  if (!['INICIADA', 'FINALIZADA', 'CANCELADA'].includes(snapshot.status)) throw new Error('Estado inválido')
  const ids = new Set()
  for (const activity of snapshot.activities) {
    if (!activity.id || ids.has(activity.id) || !['walk', 'memory', 'rest'].includes(activity.game)) throw new Error('Actividad inválida')
    ids.add(activity.id)
    for (const key of ['activeSeconds', 'restSeconds', 'trackingLostSeconds', 'observedIdleSeconds', 'memorySeconds']) {
      if (typeof activity[key] !== 'number' || !Number.isFinite(activity[key]) || activity[key] < 0) throw new Error('Tiempo de actividad inválido')
    }
    for (const key of Object.keys(summarizeActivities([]))) {
      if (activity[key] !== undefined && (typeof activity[key] !== 'number' || !Number.isFinite(activity[key]) || activity[key] < 0)) {
        throw new Error('Indicador de rendimiento inválido')
      }
    }
    if (activity.game === 'memory') {
      if (!Array.isArray(activity.sequence) || activity.sequence.length !== 4 || !Array.isArray(activity.attempts)
        || !Number.isInteger(activity.correct) || activity.correct < 0 || activity.correct > 4
        || activity.requested !== 4 || !Number.isInteger(activity.orderErrors) || activity.orderErrors < 0
        || !Number.isInteger(activity.hints) || activity.hints < 0) throw new Error('Resultado de memoria inválido')
    }
    for (const [key, value] of Object.entries(activity)) {
      if (typeof value === 'number' && (!Number.isFinite(value) || value < 0)) throw new Error(`Métrica inválida: ${key}`)
    }
  }
}

export default {
  iniciar: async (_event, payload) => {
    integer(payload.id_perfil, 'Perfil')
    if (typeof payload.key !== 'string' || payload.key.length > 100) throw new Error('Clave de sesión inválida')
    return transaction(async () => {
      const existing = await all('SELECT id_sesion, id_perfil FROM sesion_rendimiento WHERE clave = ?', [payload.key])
      if (existing.length) {
        if (existing[0].id_perfil !== payload.id_perfil) throw new Error('La sesión pertenece a otro perfil')
        return existing[0]
      }
      const [profile] = await all(`SELECT p.*, u.nombre FROM perfil p JOIN usuario u USING (id_usuario)
        WHERE p.id_perfil = ? AND u.activo = 1`, [payload.id_perfil])
      if (!profile) throw new Error('Selecciona un perfil registrado')
      if (payload.profileName && payload.profileName.trim().toLowerCase() !== profile.nombre.trim().toLowerCase()) {
        throw new Error('El perfil seleccionado cambió en la base de datos. Vuelve a seleccionarlo.')
      }
      await run("INSERT OR IGNORE INTO minijuego (nombre, modalidad) VALUES ('Sesión motriz guiada', 'CAMARA')")
      const [game] = await all("SELECT id_minijuego FROM minijuego WHERE nombre = 'Sesión motriz guiada'")
      const session = await run('INSERT INTO sesion (id_perfil, id_minijuego) VALUES (?, ?)', [profile.id_perfil, game.id_minijuego])
      await run('INSERT INTO sesion_rendimiento (clave, id_sesion, id_perfil) VALUES (?, ?, ?)', [payload.key, session.id, profile.id_perfil])
      const report = { version: 1, profile, activities: [], totals: summarizeActivities([]) }
      await run("INSERT INTO reporte (id_sesion, tipo, resumen) VALUES (?, 'RENDIMIENTO', ?)", [session.id, JSON.stringify(report)])
      return { id_sesion: session.id, id_perfil: profile.id_perfil, profile }
    })
  },

  guardar: async (_event, payload) => {
    integer(payload.id_sesion, 'Sesión')
    integer(payload.revision, 'Revisión')
    validateSnapshot(payload.snapshot)
    return transaction(async () => {
      const [session] = await all(`SELECT s.*, sr.revision FROM sesion s JOIN sesion_rendimiento sr USING (id_sesion)
        WHERE s.id_sesion = ? AND sr.clave = ?`, [payload.id_sesion, payload.key])
      if (!session) throw new Error('Sesión inexistente')
      if (payload.revision <= session.revision) return { success: true }
      if (session.estado !== 'INICIADA') throw new Error('La sesión ya está cerrada')
      const [previous] = await all('SELECT resumen FROM reporte WHERE id_sesion = ?', [session.id_sesion])
      const stored = JSON.parse(previous.resumen)
      const report = { ...payload.snapshot, profile: stored.profile, totals: summarizeActivities(payload.snapshot.activities) }
      await run("UPDATE reporte SET resumen = ?, generado_en = CURRENT_TIMESTAMP WHERE id_sesion = ?", [JSON.stringify(report), session.id_sesion])
      await run('DELETE FROM telemetria WHERE id_sesion = ?', [session.id_sesion])
      for (const activity of report.activities) {
        await run(`INSERT INTO telemetria (id_sesion, tiempo_activo, tiempo_descanso, puntaje, vector_movimiento, centro_gravedad)
          VALUES (?, ?, ?, ?, ?, ?)`, [
          session.id_sesion, activity.activeSeconds || 0, activity.restSeconds || 0,
          activity.game === 'memory' ? activity.correct : null,
          JSON.stringify(activity), activity.game === 'walk' ? JSON.stringify({ source: 'camera', x: activity.comMaxSwayX, y: activity.comMaxSwayY }) : null,
        ])
      }
      await run('UPDATE sesion_rendimiento SET revision = ? WHERE id_sesion = ?', [payload.revision, session.id_sesion])
      await run(`UPDATE sesion SET estado = ?, fin = CASE WHEN ? = 'INICIADA' THEN NULL ELSE CURRENT_TIMESTAMP END
        WHERE id_sesion = ?`, [report.status, report.status, session.id_sesion])
      return { success: true }
    })
  },

  listar: async (_event, payload) => {
    integer(payload.id_perfil, 'Perfil')
    const rows = await all(`SELECT s.id_sesion, s.inicio, s.fin, s.estado, r.resumen, m.nombre AS juego
      FROM sesion s JOIN minijuego m USING (id_minijuego)
      LEFT JOIN reporte r USING (id_sesion)
      WHERE s.id_perfil = ? ORDER BY s.inicio DESC, s.id_sesion DESC`, [payload.id_perfil])
    return rows.map(({ resumen, ...row }) => {
      let report = null
      try { report = JSON.parse(resumen) } catch { /* Los reportes anteriores pueden contener texto. */ }
      return { ...row, report: report?.version === 1 ? report : null }
    })
  },
}
