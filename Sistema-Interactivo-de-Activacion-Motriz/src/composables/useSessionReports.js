import { computed, ref } from 'vue'
import { useProfiles } from './useProfiles'
import { requestReport } from '../services/sessionReports'
import { summarizeActivities } from '../game/sessionReport'

const STORAGE_KEY = 'asistencia_motriz_session_pending_v1'
const ACTIVE_KEY = 'asistencia_motriz_session_active_v1'
const START_KEY = 'asistencia_motriz_session_start_v1'
const session = ref(null)
const error = ref('')
const saving = ref(false)
let pending = null
let queue = Promise.resolve()
try {
  pending = JSON.parse(localStorage.getItem(STORAGE_KEY))
  const interrupted = JSON.parse(localStorage.getItem(ACTIVE_KEY))
  if (interrupted && (!pending || interrupted.revision >= pending.revision)) {
    pending = {
      id_sesion: interrupted.id_sesion, key: interrupted.key, revision: interrupted.revision + 1,
      snapshot: {
        ...interrupted.snapshot, status: 'CANCELADA', finishedAt: new Date().toISOString(),
        activities: interrupted.snapshot.activities.map(activity => activity.status === 'INICIADA' ? { ...activity, status: 'CANCELADA' } : activity),
      },
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pending))
  }
  localStorage.removeItem(ACTIVE_KEY)
} catch { /* Sin operación pendiente recuperable. */ }

function persistPending() {
  if (pending) localStorage.setItem(STORAGE_KEY, JSON.stringify(pending))
  else localStorage.removeItem(STORAGE_KEY)
}

async function retrySave() {
  const task = queue.then(async () => {
    if (!pending) return
    const payload = structuredClone(pending)
    saving.value = true
    try {
      await requestReport('guardar', payload)
      if (pending?.revision === payload.revision && pending?.key === payload.key) {
        pending = null
        persistPending()
      }
      error.value = ''
    } catch (failure) {
      error.value = failure.message
      throw failure
    } finally {
      saving.value = false
    }
  })
  queue = task.catch(() => {})
  return task
}

function saveSnapshot() {
  if (!session.value) return
  session.value.revision += 1
  pending = JSON.parse(JSON.stringify({
    id_sesion: session.value.id_sesion,
    key: session.value.key,
    revision: session.value.revision,
    snapshot: session.value.snapshot,
  }))
  try {
    persistPending()
    if (session.value.snapshot.status === 'INICIADA') localStorage.setItem(ACTIVE_KEY, JSON.stringify(session.value))
    else localStorage.removeItem(ACTIVE_KEY)
  } catch { error.value = 'El almacenamiento local está lleno. Mantén abierta esta pantalla y reintenta el guardado.' }
  retrySave().catch(() => {})
}

export function useSessionReports() {
  const { activeProfile, ensureProfileSaved } = useProfiles()

  async function startSession() {
    await retrySave()
    if (session.value?.snapshot.status === 'INICIADA') return
    const profile = activeProfile.value
    if (!profile) throw new Error('Selecciona un perfil para iniciar')
    const id = await ensureProfileSaved(profile)
    let startRequest = null
    try { startRequest = JSON.parse(localStorage.getItem(START_KEY)) } catch { /* Nueva solicitud. */ }
    const key = startRequest?.profileId === id ? startRequest.key : crypto.randomUUID()
    localStorage.setItem(START_KEY, JSON.stringify({ profileId: id, key }))
    const created = await requestReport('iniciar', { id_perfil: id, key, profileName: profile.name })
    session.value = {
      ...created, key, revision: 0,
      snapshot: { version: 1, status: 'INICIADA', startedAt: new Date().toISOString(), activities: [] },
    }
    localStorage.setItem(ACTIVE_KEY, JSON.stringify(session.value))
    localStorage.removeItem(START_KEY)
  }

  function recordActivity(activity) {
    if (session.value?.snapshot.status !== 'INICIADA') return
    const copy = JSON.parse(JSON.stringify(activity))
    const activities = session.value.snapshot.activities
    const index = activities.findIndex((item) => item.id === activity.id)
    if (index === -1) activities.push(copy)
    else activities[index] = copy
    saveSnapshot()
  }

  async function closeSession(status) {
    if (session.value?.snapshot.status === 'INICIADA') {
      session.value.snapshot.status = status
      session.value.snapshot.finishedAt = new Date().toISOString()
      saveSnapshot()
    }
    await retrySave()
  }

  return {
    session, error, saving, startSession, recordActivity, closeSession, retrySave,
    totals: computed(() => summarizeActivities(session.value?.snapshot.activities || [])),
    hasPending: computed(() => Boolean(error.value)),
  }
}
