<script setup>
import { ref, onMounted } from 'vue'
import { useProfiles } from '../../composables/useProfiles'
import { playClickTone, playSelectTone, playSuccessChime } from '../../composables/useAudio'

const emit = defineEmits(['complete', 'cancel'])

const { profiles, activeProfile, selectProfile, addProfile, syncFromDatabase } = useProfiles()

// Campos del formulario (atributos de init.sql: nombre, edad, estatura_cm, mano_dominante)
// SIN usuario, contraseña ni correo electrónico
const nombre = ref('')
const edad = ref(74)
const estaturaCm = ref(165)
const manoDominante = ref('DERECHA') // 'IZQUIERDA' o 'DERECHA'
const dificultad = ref('facil') // 'facil' | 'medio' | 'adaptado'
const avatar = ref('👴')

const isSaving = ref(false)
const saveSuccess = ref(false)
const errorMessage = ref('')
const showExistingProfiles = ref(false)

const avatarOptions = ['👴', '👵', '🧑', '🌸', '🌿', '☕', '⭐']

onMounted(async () => {
  await syncFromDatabase()
  if (profiles.value && profiles.value.length > 0) {
    // Si ya existe un perfil activo previo, pre-cargar sus datos por conveniencia
    const current = activeProfile.value || profiles.value[0]
    if (current) {
      nombre.value = current.name || ''
      edad.value = current.age || 74
      estaturaCm.value = current.heightCm || 165
      manoDominante.value = current.mano_dominante || 'DERECHA'
      dificultad.value = current.difficulty || 'facil'
      avatar.value = current.avatar || '👴'
    }
  }
})

function selectDominantHand(hand) {
  playSelectTone()
  manoDominante.value = hand
}

function selectExistingProfile(p) {
  playSelectTone()
  selectProfile(p.id)
  emit('complete', p)
}

async function handleSubmit() {
  if (!nombre.value.trim()) {
    errorMessage.value = 'Por favor, ingresa el nombre del paciente.'
    return
  }

  errorMessage.value = ''
  isSaving.value = true
  playSelectTone()

  try {
    const nuevoPerfil = await addProfile({
      name: nombre.value,
      age: edad.value,
      heightCm: estaturaCm.value,
      mano_dominante: manoDominante.value,
      difficulty: dificultad.value,
      avatar: avatar.value,
    })

    playSuccessChime()
    saveSuccess.value = true

    setTimeout(() => {
      emit('complete', nuevoPerfil)
    }, 600)
  } catch (err) {
    console.error('Error al guardar datos del paciente:', err)
    errorMessage.value = 'Ocurrió un error al guardar en la base de datos.'
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <div class="initial-form-backdrop">
    <div
      class="initial-form-card motriz-card"
      :class="{ 'align-left': manoDominante === 'IZQUIERDA', 'align-right': manoDominante === 'DERECHA' }"
    >
      <!-- Cabecera de Bienvenida -->
      <header class="form-header">
        <div class="header-badge">
          <span class="badge-text">SISTEMA INTERACTIVO DE ACTIVACIÓN MOTRIZ</span>
        </div>
        <h1 class="header-title">Información del Paciente</h1>
        <p class="header-subtitle">
          Configuración inicial para adaptar la experiencia y posición de los botones a su ergonomía.
        </p>
        <div class="privacy-notice">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          <span>Acceso directo simplificado: No requiere cuentas, correos ni contraseñas.</span>
        </div>
      </header>

      <!-- Selector de Pacientes Existentes (si ya hay registrados en SQLite) -->
      <div v-if="profiles.length > 0 && !showExistingProfiles" class="quick-switch-bar">
        <span>¿Ya está registrado?</span>
        <button type="button" class="btn-link" @click="showExistingProfiles = true">
          Seleccionar paciente registrado ({{ profiles.length }})
        </button>
      </div>

      <div v-if="showExistingProfiles" class="existing-profiles-drawer">
        <div class="drawer-header">
          <strong>Selecciona un paciente registrado:</strong>
          <button type="button" class="btn-close-drawer" @click="showExistingProfiles = false">✕ Cerrar</button>
        </div>
        <div class="existing-grid">
          <button
            v-for="p in profiles"
            :key="p.id"
            type="button"
            class="existing-card-btn"
            :class="{ 'existing-active': activeProfile?.id === p.id }"
            @click="selectExistingProfile(p)"
          >
            <span class="p-emoji">{{ p.avatar }}</span>
            <div class="p-info">
              <strong class="p-name">{{ p.name }}</strong>
              <span class="p-meta">{{ p.age }} años • Mano {{ p.mano_dominante === 'IZQUIERDA' ? 'Izquierda' : 'Derecha' }}</span>
            </div>
          </button>
        </div>
      </div>

      <!-- FORMULARIO PRINCIPAL -->
      <form class="main-form" @submit.prevent="handleSubmit">
        <!-- 1. Nombre -->
        <div class="form-field">
          <label class="field-label" for="nombre-paciente">
            <span>Nombre del Paciente:</span>
            <span class="required-star">*</span>
          </label>
          <input
            id="nombre-paciente"
            v-model="nombre"
            type="text"
            class="motriz-input input-large"
            placeholder="Ej. Alberto Morales"
            autocomplete="off"
            required
            autofocus
          />
        </div>

        <!-- 2. Fila: Edad y Estatura -->
        <div class="form-row-2">
          <!-- Edad -->
          <div class="form-field">
            <label class="field-label" for="edad-paciente">
              <span>Edad (Años):</span>
            </label>
            <div class="stepper-input">
              <button
                type="button"
                class="btn-stepper"
                @click="edad = Math.max(50, edad - 1)"
                aria-label="Restar un año"
              >
                −
              </button>
              <input
                id="edad-paciente"
                v-model.number="edad"
                type="number"
                min="50"
                max="120"
                class="motriz-input input-stepper"
              />
              <button
                type="button"
                class="btn-stepper"
                @click="edad = Math.min(120, edad + 1)"
                aria-label="Sumar un año"
              >
                +
              </button>
            </div>
            <span class="field-hint">Años cumplidos</span>
          </div>

          <!-- Estatura -->
          <div class="form-field">
            <label class="field-label" for="estatura-paciente">
              <span>Estatura (cm):</span>
            </label>
            <div class="stepper-input">
              <button
                type="button"
                class="btn-stepper"
                @click="estaturaCm = Math.max(120, estaturaCm - 2)"
                aria-label="Restar 2 centímetros"
              >
                −
              </button>
              <input
                id="estatura-paciente"
                v-model.number="estaturaCm"
                type="number"
                min="120"
                max="220"
                class="motriz-input input-stepper"
              />
              <button
                type="button"
                class="btn-stepper"
                @click="estaturaCm = Math.min(220, estaturaCm + 2)"
                aria-label="Sumar 2 centímetros"
              >
                +
              </button>
            </div>
            <span class="field-hint">Calibra la altura en pantalla</span>
          </div>
        </div>

        <!-- 3. MANO DOMINANTE (ELEMENTO CLAVE) -->
        <div class="form-field dominant-hand-section">
          <label class="field-label">
            <span>Mano Dominante del Paciente:</span>
            <span class="required-star">*</span>
          </label>
          <p class="section-explanation">
            Selecciona con qué mano tiene mayor fuerza y comodidad. <strong>Los botones de la pantalla se ubicarán en ese lado</strong> para que no tenga que forzar sus brazos.
          </p>

          <div class="hand-selector-grid">
            <!-- TARJETA MANO IZQUIERDA -->
            <button
              type="button"
              class="hand-card-btn hand-left-card"
              :class="{ 'hand-card-active': manoDominante === 'IZQUIERDA' }"
              @click="selectDominantHand('IZQUIERDA')"
            >
              <div class="hand-card-icon">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="19" y1="12" x2="5" y2="12"></line>
                  <polyline points="12 19 5 12 12 5"></polyline>
                </svg>
              </div>
              <div class="hand-card-text">
                <strong class="hand-card-name">Mano Izquierda (Zurdo)</strong>
                <span class="hand-card-desc">
                  Los botones de acción y menús se ubicarán en el <strong>lado izquierdo</strong> de la pantalla.
                </span>
              </div>
              <div class="hand-card-check" v-if="manoDominante === 'IZQUIERDA'">
                ✓ Seleccionada
              </div>
            </button>

            <!-- TARJETA MANO DERECHA -->
            <button
              type="button"
              class="hand-card-btn hand-right-card"
              :class="{ 'hand-card-active': manoDominante === 'DERECHA' }"
              @click="selectDominantHand('DERECHA')"
            >
              <div class="hand-card-icon">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              </div>
              <div class="hand-card-text">
                <strong class="hand-card-name">Mano Derecha (Diestro)</strong>
                <span class="hand-card-desc">
                  Los botones de acción y menús se ubicarán en el <strong>lado derecho</strong> de la pantalla.
                </span>
              </div>
              <div class="hand-card-check" v-if="manoDominante === 'DERECHA'">
                ✓ Seleccionada
              </div>
            </button>
          </div>
        </div>

        <!-- 4. Nivel de Movilidad & Avatar -->
        <div class="form-row-2">
          <!-- Dificultad / Movilidad -->
          <div class="form-field">
            <label class="field-label">Nivel de Movilidad:</label>
            <div class="mobility-selector">
              <button
                type="button"
                class="diff-btn"
                :class="{ 'diff-btn-active': dificultad === 'facil' }"
                @click="dificultad = 'facil'"
              >
                Suave / Asistido
              </button>
              <button
                type="button"
                class="diff-btn"
                :class="{ 'diff-btn-active': dificultad === 'medio' }"
                @click="dificultad = 'medio'"
              >
                Intermedio
              </button>
              <button
                type="button"
                class="diff-btn"
                :class="{ 'diff-btn-active': dificultad === 'adaptado' }"
                @click="dificultad = 'adaptado'"
              >
                Sentado / Adaptado
              </button>
            </div>
          </div>

          <!-- Avatar -->
          <div class="form-field">
            <label class="field-label">Icono o Avatar:</label>
            <div class="avatar-pill-row">
              <button
                v-for="av in avatarOptions"
                :key="av"
                type="button"
                class="av-opt-btn"
                :class="{ 'av-active': avatar === av }"
                @click="avatar = av"
              >
                {{ av }}
              </button>
            </div>
          </div>
        </div>

        <!-- Mensaje de Error si falta algún dato -->
        <div v-if="errorMessage" class="error-banner">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <span>{{ errorMessage }}</span>
        </div>

        <!-- Botones de Acción Final -->
        <div
          class="form-submit-row"
          :class="{
            'submit-left': manoDominante === 'IZQUIERDA',
            'submit-right': manoDominante === 'DERECHA',
          }"
        >
          <button
            type="submit"
            class="btn-motriz-primary btn-save-patient"
            :disabled="isSaving"
          >
            <span v-if="isSaving">Guardando en Base de Datos...</span>
            <span v-else-if="saveSuccess">¡Guardado con Éxito! ✓</span>
            <span v-else>Guardar y Continuar</span>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.initial-form-backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: radial-gradient(circle at center, rgba(30, 20, 15, 0.72) 0%, rgba(10, 5, 2, 0.94) 100%);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  overflow-y: auto;
}

.initial-form-card {
  width: 100%;
  max-width: 620px;
  max-height: 92vh;
  overflow-y: auto;
  background: #FFFDF9;
  border: 2.5px solid #E6D2BD;
  border-radius: 22px;
  padding: 20px 26px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.8) inset;
  animation: formSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  transition: all 0.3s ease;
}

@keyframes formSlideUp {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.97);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* Header */
.form-header {
  text-align: center;
  margin-bottom: 14px;
}

.header-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  background: #FDF2E9;
  border: 1.5px solid #F5C6A5;
  border-radius: 9999px;
  margin-bottom: 6px;
}

.badge-text {
  font-size: 0.7rem;
  font-weight: 800;
  color: #8C1D2C;
  letter-spacing: 0.08em;
}

.header-title {
  font-size: 1.48rem;
  font-weight: 900;
  color: #2D1A1E;
  margin: 0 0 4px;
  line-height: 1.15;
}

.header-subtitle {
  font-size: 0.88rem;
  color: #6B5B53;
  margin: 0 0 8px;
}

.privacy-notice {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  background: #E8F5E9;
  border: 1.5px solid #A5D6A7;
  border-radius: 10px;
  color: #1B5E20;
  font-size: 0.78rem;
  font-weight: 600;
}

/* Quick switch */
.quick-switch-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 7px 12px;
  background: #F8F4EE;
  border-radius: 10px;
  margin-bottom: 12px;
  font-size: 0.84rem;
  color: #55443B;
}

.btn-link {
  background: none;
  border: none;
  color: #8C1D2C;
  font-weight: 700;
  text-decoration: underline;
  cursor: pointer;
}

.existing-profiles-drawer {
  background: #F4EFEB;
  border: 2px solid #DECFC1;
  border-radius: 14px;
  padding: 12px;
  margin-bottom: 14px;
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  font-size: 0.88rem;
  color: #3C2D25;
}

.btn-close-drawer {
  background: #FFF;
  border: 1px solid #CCC;
  border-radius: 8px;
  padding: 3px 8px;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.8rem;
}

.existing-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 8px;
  max-height: 150px;
  overflow-y: auto;
}

.existing-card-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: #FFFDF9;
  border: 2px solid #D5C2B1;
  border-radius: 10px;
  text-align: left;
  cursor: pointer;
  transition: all 0.18s;
}

.existing-card-btn:hover {
  border-color: #8C1D2C;
  transform: translateY(-2px);
}

.existing-active {
  border-color: #8C1D2C;
  background: #FDF1F3;
}

.p-emoji {
  font-size: 1.5rem;
}

.p-name {
  display: block;
  font-size: 0.9rem;
  color: #2D1A1E;
}

.p-meta {
  display: block;
  font-size: 0.74rem;
  color: #6E5E56;
}

/* Main Form Elements */
.main-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.92rem;
  font-weight: 700;
  color: #38241D;
}

.required-star {
  color: #C02638;
}

.input-large {
  font-size: 1.05rem;
  padding: 9px 14px;
  border-radius: 10px;
  border: 2px solid #D5C2B1;
  background: #FFFFFF;
}

.input-large:focus {
  border-color: #8C1D2C;
  outline: none;
  box-shadow: 0 0 0 3px rgba(140, 29, 44, 0.15);
}

.form-row-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

/* Stepper Input */
.stepper-input {
  display: flex;
  align-items: center;
  border: 2px solid #D5C2B1;
  border-radius: 10px;
  overflow: hidden;
  background: #FFFFFF;
}

.btn-stepper {
  width: 40px;
  height: 40px;
  background: #F4EFEB;
  border: none;
  font-size: 1.3rem;
  font-weight: 700;
  color: #8C1D2C;
  cursor: pointer;
  transition: background 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-stepper:hover {
  background: #E8DED3;
}

.input-stepper {
  flex: 1;
  border: none;
  text-align: center;
  font-size: 1.08rem;
  font-weight: 800;
  color: #2D1A1E;
  padding: 6px;
  background: transparent;
}

.field-hint {
  font-size: 0.74rem;
  color: #7A6961;
}

/* DOMINANT HAND SECTION */
.dominant-hand-section {
  background: #FAF6F0;
  border: 2px dashed #CBB5A1;
  border-radius: 14px;
  padding: 12px 14px;
}

.section-explanation {
  margin: 0 0 10px;
  font-size: 0.82rem;
  color: #55443B;
  line-height: 1.35;
}

.hand-selector-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.hand-card-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 12px 12px;
  background: #FFFFFF;
  border: 2.5px solid #D8C7B8;
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
  position: relative;
}

.hand-card-btn:hover {
  border-color: #8C1D2C;
  transform: translateY(-2px);
  box-shadow: 0 8px 18px rgba(140, 29, 44, 0.12);
}

.hand-card-active {
  border-color: #8C1D2C !important;
  background: #FFF5F6 !important;
  box-shadow: 0 6px 18px rgba(140, 29, 44, 0.2) !important;
  transform: scale(1.015);
}

.hand-card-icon {
  font-size: 2rem;
  margin-bottom: 4px;
  filter: drop-shadow(0 3px 4px rgba(0, 0, 0, 0.1));
}

.hand-card-name {
  font-size: 1rem;
  font-weight: 800;
  color: #2D1A1E;
  margin-bottom: 3px;
}

.hand-card-desc {
  font-size: 0.78rem;
  color: #63534C;
  line-height: 1.25;
}

.hand-card-check {
  margin-top: 6px;
  padding: 2px 10px;
  background: #8C1D2C;
  color: #FFFFFF;
  border-radius: 9999px;
  font-size: 0.74rem;
  font-weight: 800;
  letter-spacing: 0.04em;
}

/* Mobility & Avatar */
.mobility-selector {
  display: flex;
  gap: 6px;
}

.diff-btn {
  flex: 1;
  padding: 7px 6px;
  font-size: 0.8rem;
  font-weight: 700;
  background: #FFFFFF;
  border: 2px solid #D5C2B1;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s;
}

.diff-btn-active {
  background: #8C1D2C;
  color: #FFFFFF;
  border-color: #8C1D2C;
}

.avatar-pill-row {
  display: flex;
  gap: 6px;
}

.av-opt-btn {
  flex: 1;
  height: 36px;
  font-size: 1.25rem;
  background: #FFFFFF;
  border: 2px solid #D5C2B1;
  border-radius: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.av-active {
  border-color: #8C1D2C;
  background: #FFF0F2;
  transform: scale(1.06);
}

/* Error */
.error-banner {
  padding: 8px 14px;
  background: #FFEBEE;
  border: 1.5px solid #FFCDD2;
  border-radius: 10px;
  color: #C62828;
  font-weight: 700;
  font-size: 0.88rem;
}

/* Submit Row - Reposiciona los botones según la mano dominante */
.form-submit-row {
  display: flex;
  margin-top: 6px;
  transition: all 0.3s ease;
}

.submit-left {
  justify-content: flex-start;
}

.submit-right {
  justify-content: flex-end;
}

.btn-save-patient {
  padding: 12px 28px;
  font-size: 1.1rem;
  font-weight: 900;
  border-radius: 9999px;
  min-width: 240px;
  box-shadow: 0 8px 20px rgba(140, 29, 44, 0.32);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.btn-save-patient:hover:not(:disabled) {
  transform: translateY(-2px) scale(1.02);
  box-shadow: 0 12px 26px rgba(140, 29, 44, 0.42);
}

.btn-save-patient:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

@media (max-width: 720px) {
  .initial-form-card {
    padding: 18px 16px;
  }
  .form-row-2, .hand-selector-grid {
    grid-template-columns: 1fr;
  }
  .form-submit-row {
    justify-content: center !important;
  }
  .btn-save-patient {
    width: 100%;
  }
}
</style>

