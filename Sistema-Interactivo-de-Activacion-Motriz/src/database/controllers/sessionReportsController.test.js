import assert from 'node:assert/strict'
import test from 'node:test'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'

process.env.DB_PATH = ':memory:'

test('session reports preserve profiles, retry safely, and isolate each session', async () => {
  const { default: db } = await import('../connection.js')
  const { initDatabase } = await import('../init.js')
  const { default: patients } = await import('./patientController.js')
  const { default: reports } = await import('./sessionReportsController.js')
  const rows = sql => new Promise((resolve, reject) => db.all(sql, (error, result) => error ? reject(error) : resolve(result)))
  try {
    const oldSchema = readFileSync(new URL('../init.sql', import.meta.url), 'utf8')
      .replace(/CREATE TABLE IF NOT EXISTS sesion_rendimiento \([\s\S]*?\);/, '')
    await new Promise((resolve, reject) => db.exec(oldSchema, error => error ? reject(error) : resolve()))
    const legacy = await patients.crearPerfil(null, { nombre: 'Perfil anterior', edad: 70, estatura_cm: 155 })
    await initDatabase()
    const alice = await patients.crearPerfil(null, { nombre: 'Paciente A', edad: 75, estatura_cm: 160 })
    const bob = await patients.crearPerfil(null, { nombre: 'Paciente B', edad: 80, estatura_cm: 170 })
    await initDatabase()
    assert.equal((await patients.obtenerPerfiles()).length, 3)
    assert.ok((await patients.obtenerPerfiles()).some(profile => profile.id_perfil === legacy.id_perfil))
    const key = randomUUID()
    const first = await reports.iniciar(null, { id_perfil: alice.id_perfil, key })
    const retry = await reports.iniciar(null, { id_perfil: alice.id_perfil, key })
    assert.equal(first.id_sesion, retry.id_sesion)
    await assert.rejects(reports.iniciar(null, { id_perfil: bob.id_perfil, key }))
    await assert.rejects(reports.iniciar(null, { id_perfil: alice.id_perfil, key: randomUUID(), profileName: 'Otro perfil' }))
    const timing = { activeSeconds: 5, restSeconds: 2, trackingLostSeconds: 3, observedIdleSeconds: 4, memorySeconds: 1 }
    const activity = {
      ...timing, id: randomUUID(), game: 'memory', status: 'FINALIZADA',
      correct: 3, requested: 4, orderErrors: 2, hints: 1,
      sequence: ['rest', 'right-arm-up', 'left-arm-up', 'both-arms-up'], attempts: [],
    }
    const payload = {
      id_sesion: first.id_sesion, key, revision: 1,
      snapshot: { version: 1, status: 'INICIADA', activities: [activity] },
    }
    await Promise.all([reports.guardar(null, payload), reports.guardar(null, payload)])
    assert.equal((await rows('SELECT * FROM telemetria')).length, 1)
    const [report] = await reports.listar(null, { id_perfil: alice.id_perfil })
    assert.equal(report.report.totals.correct, 3)
    assert.equal(report.report.totals.activeSeconds, 5)
    assert.equal(report.report.profile.id_perfil, alice.id_perfil)
    assert.deepEqual(await reports.listar(null, { id_perfil: bob.id_perfil }), [])
    await assert.rejects(reports.guardar(null, {
      ...payload, revision: 2, snapshot: { ...payload.snapshot, activities: [{ ...activity, activeSeconds: -1 }] },
    }))
    assert.equal((await rows('SELECT revision FROM sesion_rendimiento'))[0].revision, 1)
    await reports.guardar(null, { ...payload, revision: 2, snapshot: { ...payload.snapshot, status: 'FINALIZADA' } })
    await reports.guardar(null, payload)
    const [finished] = await reports.listar(null, { id_perfil: alice.id_perfil })
    assert.equal(finished.estado, 'FINALIZADA')
    assert.ok(finished.fin)
    assert.equal(finished.report.totals.orderErrors, 2)
    assert.equal((await rows('PRAGMA integrity_check'))[0].integrity_check, 'ok')
    assert.deepEqual(await rows('PRAGMA foreign_key_check'), [])
  } finally {
    await new Promise(resolve => db.close(resolve))
  }
})
