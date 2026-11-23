import { ref, computed } from 'vue'

const STORAGE_KEY = 'asistencia_motriz_profiles_v1'
const ACTIVE_PROFILE_KEY = 'asistencia_motriz_active_id'

const defaultProfiles = [
  {
    id: 'prof-1',
    name: 'Rosa Gutiérrez',
    age: 72,
    heightCm: 158,
    mano_dominante: 'DERECHA',
    difficulty: 'facil', // facil, medio, adaptado
    avatar: '👵',
    stats: {
      totalMinutes: 42,
      sessionsCompleted: 5,
      totalPoints: 1250,
      weeklyDays: [
        { day: 'Lun', minutes: 12 },
        { day: 'Mié', minutes: 15 },
        { day: 'Jue', minutes: 18 },
        { day: 'Vie', minutes: 25 },
        { day: 'Sáb', minutes: 15 },
        { day: 'Dom', minutes: 20 },
      ],
    },
  },
  {
    id: 'prof-2',
    name: 'Don Carlos',
    age: 68,
    heightCm: 170,
    mano_dominante: 'IZQUIERDA',
    difficulty: 'medio',
    avatar: '👴',
    stats: {
      totalMinutes: 28,
      sessionsCompleted: 3,
      totalPoints: 840,
      weeklyDays: [
        { day: 'Lun', minutes: 10 },
        { day: 'Mié', minutes: 8 },
        { day: 'Jue', minutes: 10 },
        { day: 'Vie', minutes: 0 },
        { day: 'Sáb', minutes: 0 },
        { day: 'Dom', minutes: 0 },
      ],
    },
  },
]

function loadProfiles() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return parsed.map((p) => ({
        ...p,
        mano_dominante: p.mano_dominante || 'DERECHA',
      }))
    }
  } catch (e) {
    console.error('Error cargando perfiles locales:', e)
  }
  return defaultProfiles
}

function loadActiveId() {
  try {
    return localStorage.getItem(ACTIVE_PROFILE_KEY) || 'prof-1'
  } catch (e) {
    return 'prof-1'
  }
}

const profiles = ref(loadProfiles())
const activeId = ref(loadActiveId())
const isSyncedWithDb = ref(false)
let databaseProfiles = null

function saveProfiles() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles.value))
    localStorage.setItem(ACTIVE_PROFILE_KEY, activeId.value)
  } catch (e) {
    console.error('Error guardando perfiles:', e)
  }
}

/**
 * Guarda el perfil en la base de datos SQLite (Electron IPC o API Vite)
 * Usando los atributos de init.sql:
 * - nombre, edad, estatura_cm, mano_dominante, dificultad, avatar
 */
async function persistToDatabase(profileData) {
  const payload = {
    nombre: profileData.name || profileData.nombre,
    edad: Number(profileData.age ?? profileData.edad) || 70,
    estatura_cm: Number(profileData.heightCm ?? profileData.estatura_cm) || 160,
    mano_dominante: (profileData.mano_dominante || 'DERECHA').toUpperCase() === 'IZQUIERDA' ? 'IZQUIERDA' : 'DERECHA',
    dificultad: profileData.difficulty || profileData.dificultad || 'facil',
    avatar: profileData.avatar || '👴',
  }

  // 1. Probar Electron IPC si window.apiSiam está disponible
  if (typeof window !== 'undefined' && window.apiSiam?.pacientes?.crear) {
    try {
      const res = await window.apiSiam.pacientes.crear(payload)
      console.log('✅ Perfil guardado en SQLite vía Electron:', res)
      return res
    } catch (err) {
      console.warn('⚠️ Error guardando en Electron SQLite:', err)
    }
  }

  // 2. Probar API Endpoint local de Vite (/api/pacientes)
  try {
    const response = await fetch('/api/pacientes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (response.ok) {
      const json = await response.json()
      console.log('✅ Perfil guardado en SQLite vía Vite API:', json.data)
      return json.data
    }
  } catch (err) {
    // Si no está corriendo el servidor API o falla la red, ya se guardó en localStorage
    console.warn('⚠️ No se pudo conectar con el endpoint SQLite local, se mantiene en almacenamiento seguro:', err.message)
  }

  return null
}

async function updateHandInDatabase(idPerfil, manoDominante) {
  const payload = {
    id_perfil: idPerfil,
    mano_dominante: (manoDominante || 'DERECHA').toUpperCase() === 'IZQUIERDA' ? 'IZQUIERDA' : 'DERECHA',
  }

  if (typeof window !== 'undefined' && window.apiSiam?.pacientes?.actualizarMano) {
    try {
      return await window.apiSiam.pacientes.actualizarMano(payload)
    } catch (err) {
      console.warn('⚠️ Error actualizando mano en Electron SQLite:', err)
    }
  }

  try {
    const response = await fetch('/api/pacientes', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (response.ok) {
      const json = await response.json()
      return json.data
    }
  } catch (err) {
    console.warn('⚠️ No se pudo actualizar mano en SQLite:', err.message)
  }

  return null
}

/**
 * Consulta la base de datos SQLite para traer los perfiles ya guardados
 */
async function syncFromDatabase(force = false) {
  if (isSyncedWithDb.value && !force) return

  let dbProfiles = null

  // 1. Electron IPC
  if (typeof window !== 'undefined' && window.apiSiam?.pacientes?.obtenerTodos) {
    try {
      dbProfiles = await window.apiSiam.pacientes.obtenerTodos()
    } catch (e) {
      console.warn('No se pudo consultar SQLite vía Electron:', e)
    }
  }

  // 2. Vite API
  if (!dbProfiles) {
    try {
      const response = await fetch('/api/pacientes')
      if (response.ok) {
        const json = await response.json()
        if (json.success && Array.isArray(json.data)) {
          dbProfiles = json.data
        }
      }
    } catch (e) {
      // Sin backend activo
    }
  }

  databaseProfiles = Array.isArray(dbProfiles) ? dbProfiles : null
  if (dbProfiles && dbProfiles.length > 0) {
    // Fusionar con profiles existentes sin cruzar datos si cambió la BD
    dbProfiles.forEach((dbp) => {
      const dbName = (dbp.nombre || '').trim().toLowerCase()
      const existing = profiles.value.find(
        (p) =>
          (p.dbId && p.dbId === dbp.id_perfil && (p.name || '').trim().toLowerCase() === dbName) ||
          (!p.dbId && (p.name || '').trim().toLowerCase() === dbName)
      )
      if (existing) {
        existing.dbId = dbp.id_perfil
        existing.mano_dominante = dbp.mano_dominante || existing.mano_dominante || 'DERECHA'
        existing.heightCm = dbp.estatura_cm || existing.heightCm
        existing.age = dbp.edad || existing.age
      } else {
        profiles.value.unshift({
          id: `db-${dbp.id_perfil}`,
          dbId: dbp.id_perfil,
          name: dbp.nombre,
          age: dbp.edad || 70,
          heightCm: dbp.estatura_cm || 160,
          mano_dominante: dbp.mano_dominante || 'DERECHA',
          difficulty: dbp.dificultad || 'facil',
          avatar: dbp.avatar || '👴',
          stats: {
            totalMinutes: 0,
            sessionsCompleted: 0,
            totalPoints: 0,
            weeklyDays: [
              { day: 'Lun', minutes: 0 },
              { day: 'Mié', minutes: 0 },
              { day: 'Jue', minutes: 0 },
              { day: 'Vie', minutes: 0 },
              { day: 'Sáb', minutes: 0 },
              { day: 'Dom', minutes: 0 },
            ],
          },
        })
      }
    })
    saveProfiles()
    isSyncedWithDb.value = true
  }
}

// Iniciar sincronización en segundo plano
if (typeof window !== 'undefined') {
  setTimeout(() => {
    syncFromDatabase()
  }, 100)
}

export function useProfiles() {
  const activeProfile = computed(() => {
    return profiles.value.find((p) => p.id === activeId.value) || profiles.value[0] || null
  })

  // Mano dominante reactiva del perfil activo
  const dominantHand = computed(() => {
    return (activeProfile.value?.mano_dominante || 'DERECHA').toUpperCase()
  })

  const isLeftHanded = computed(() => {
    return dominantHand.value === 'IZQUIERDA'
  })

  const isRightHanded = computed(() => {
    return dominantHand.value === 'DERECHA'
  })

  function selectProfile(id) {
    activeId.value = id
    saveProfiles()
  }

  async function setDominantHand(hand) {
    if (!activeProfile.value) return
    const normalized = hand.toUpperCase() === 'IZQUIERDA' ? 'IZQUIERDA' : 'DERECHA'
    activeProfile.value.mano_dominante = normalized
    saveProfiles()

    if (activeProfile.value.dbId) {
      await updateHandInDatabase(activeProfile.value.dbId, normalized)
    } else {
      const dbResult = await persistToDatabase({
        ...activeProfile.value,
        mano_dominante: normalized,
      })
      if (dbResult?.id_perfil) {
        activeProfile.value.dbId = dbResult.id_perfil
        saveProfiles()
      }
    }
  }

  function toggleDominantHand() {
    const nextHand = isLeftHanded.value ? 'DERECHA' : 'IZQUIERDA'
    setDominantHand(nextHand)
  }

  async function addProfile({
    name,
    age,
    heightCm,
    mano_dominante = 'DERECHA',
    difficulty = 'facil',
    avatar = '👴',
  }) {
    const normalizedHand = (mano_dominante || 'DERECHA').toUpperCase() === 'IZQUIERDA' ? 'IZQUIERDA' : 'DERECHA'
    const newProfile = {
      id: `prof-${Date.now()}`,
      name: name.trim() || 'Paciente',
      age: Number(age) || 70,
      heightCm: Number(heightCm) || 160,
      mano_dominante: normalizedHand,
      difficulty,
      avatar,
      stats: {
        totalMinutes: 0,
        sessionsCompleted: 0,
        totalPoints: 0,
        weeklyDays: [
          { day: 'Lun', minutes: 0 },
          { day: 'Mié', minutes: 0 },
          { day: 'Jue', minutes: 0 },
          { day: 'Vie', minutes: 0 },
          { day: 'Sáb', minutes: 0 },
          { day: 'Dom', minutes: 0 },
        ],
      },
    }

    profiles.value.push(newProfile)
    activeId.value = newProfile.id
    saveProfiles()

    // Persistir a la base de datos SQLite con los atributos de init.sql
    try {
      const dbResult = await persistToDatabase({
        nombre: newProfile.name,
        edad: newProfile.age,
        estatura_cm: newProfile.heightCm,
        mano_dominante: newProfile.mano_dominante,
        dificultad: newProfile.difficulty,
        avatar: newProfile.avatar,
      })
      if (dbResult?.id_perfil) {
        newProfile.dbId = dbResult.id_perfil
        saveProfiles()
      }
    } catch (e) {
      console.warn('Error al guardar en SQLite:', e)
    }

    return newProfile
  }

  function updateActiveStats({ minutes = 1, points = 100, hits = 10 }) {
    if (!activeProfile.value) return
    const p = activeProfile.value
    p.stats.totalMinutes = (p.stats.totalMinutes || 0) + minutes
    p.stats.sessionsCompleted = (p.stats.sessionsCompleted || 0) + 1
    p.stats.totalPoints = (p.stats.totalPoints || 0) + points

    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
    const todayName = dayNames[new Date().getDay()]
    const dayEntry = p.stats.weeklyDays.find((d) => d.day === todayName)
    if (dayEntry) {
      dayEntry.minutes += minutes
    }
    saveProfiles()
  }

  async function ensureProfileSaved(profile) {
    await syncFromDatabase(true)
    if (!databaseProfiles) throw new Error('No se pudo conectar con SQLite para verificar el perfil.')
    if (databaseProfiles.some(row => row.id_perfil === profile.dbId && row.nombre.trim().toLowerCase() === profile.name.trim().toLowerCase())) {
      return profile.dbId
    }
    const result = await persistToDatabase(profile)
    if (!result?.id_perfil) throw new Error('No se pudo registrar el perfil en SQLite. Revisa la conexión e inténtalo otra vez.')
    profile.dbId = result.id_perfil
    saveProfiles()
    return profile.dbId
  }

  return {
    profiles,
    activeProfile,
    dominantHand,
    isLeftHanded,
    isRightHanded,
    selectProfile,
    addProfile,
    setDominantHand,
    toggleDominantHand,
    syncFromDatabase,
    updateActiveStats,
    ensureProfileSaved,
  }
}
