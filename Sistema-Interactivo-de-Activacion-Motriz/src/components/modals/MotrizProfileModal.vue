<script setup>
import { ref } from 'vue'
import { useProfiles } from '../../composables/useProfiles'
import { playClickTone, playSelectTone } from '../../composables/useAudio'

const emit = defineEmits(['close'])

const { profiles, activeProfile, selectProfile, addProfile, isLeftHanded, isRightHanded } = useProfiles()

const isCreating = ref(false)
const newName = ref('')
const newAge = ref(72)
const newHeight = ref(160)
const newManoDominante = ref('DERECHA')
const newDifficulty = ref('facil')
const newAvatar = ref('👴')

const avatarOptions = ['👴', '👵', '🧑', '🌸', '🌿', '☕', '⭐']

function handleSelect(id) {
  playSelectTone()
  selectProfile(id)
  emit('close')
}

async function handleCreate() {
  if (!newName.value.trim()) return
  playSelectTone()
  await addProfile({
    name: newName.value,
    age: newAge.value,
    heightCm: newHeight.value,
    mano_dominante: newManoDominante.value,
    difficulty: newDifficulty.value,
    avatar: newAvatar.value,
  })
  isCreating.value = false
  emit('close')
}

function handleClose() {
  playClickTone()
  emit('close')
}
</script>

<template>
  <div class="motriz-modal-overlay" @click.self="handleClose">
    <div
      class="motriz-card profile-modal-card"
      :class="{ 'card-handed-left': isLeftHanded, 'card-handed-right': isRightHanded }"
    >
      <div class="modal-top">
        <h2 class="profile-modal-title">
          {{ isCreating ? 'Crear Nuevo Perfil' : 'Perfiles de Paciente' }}
        </h2>
        <button type="button" class="close-x-btn" @click="handleClose">✕</button>
      </div>

      <!-- Create Form -->
      <div v-if="isCreating" class="create-profile-form">
        <div class="form-group">
          <label class="form-label">Nombre del Paciente</label>
          <input
            v-model="newName"
            type="text"
            placeholder="Ej. Carlos Mendoza"
            class="motriz-input"
            autofocus
          />
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Edad (años)</label>
            <input
              v-model.number="newAge"
              type="number"
              min="10"
              max="115"
              class="motriz-input"
            />
          </div>

          <!-- RF7 Calibración Antropométrica -->
          <div class="form-group">
            <label class="form-label">Estatura (cm)</label>
            <input
              v-model.number="newHeight"
              type="number"
              min="100"
              max="220"
              class="motriz-input"
            />
            <span class="input-hint">Calibra el punto central y la altura</span>
          </div>
        </div>

        <!-- Mano Dominante (Atributo de init.sql) -->
        <div class="form-group">
          <label class="form-label">Mano Dominante (Adaptará los botones)</label>
          <div class="hand-options">
            <button
              type="button"
              class="hand-pill"
              :class="{ 'hand-pill-active': newManoDominante === 'IZQUIERDA' }"
              @click="newManoDominante = 'IZQUIERDA'"
            >
              Mano Izquierda (Zurdo)
            </button>
            <button
              type="button"
              class="hand-pill"
              :class="{ 'hand-pill-active': newManoDominante === 'DERECHA' }"
              @click="newManoDominante = 'DERECHA'"
            >
              Mano Derecha (Diestro)
            </button>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Nivel de Movilidad / Dificultad</label>
          <div class="difficulty-options">
            <button
              type="button"
              class="diff-pill"
              :class="{ 'diff-active': newDifficulty === 'facil' }"
              @click="newDifficulty = 'facil'"
            >
              Suave / Asistido
            </button>
            <button
              type="button"
              class="diff-pill"
              :class="{ 'diff-active': newDifficulty === 'medio' }"
              @click="newDifficulty = 'medio'"
            >
              Intermedio
            </button>
            <button
              type="button"
              class="diff-pill"
              :class="{ 'diff-active': newDifficulty === 'adaptado' }"
              @click="newDifficulty = 'adaptado'"
            >
              Sentado / Rango Bajo
            </button>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Avatar</label>
          <div class="avatar-selector">
            <button
              v-for="av in avatarOptions"
              :key="av"
              type="button"
              class="avatar-opt-btn"
              :class="{ 'avatar-opt-active': newAvatar === av }"
              @click="newAvatar = av"
            >
              {{ av }}
            </button>
          </div>
        </div>

        <div
          class="form-actions"
          :class="{ 'actions-align-left': newManoDominante === 'IZQUIERDA', 'actions-align-right': newManoDominante === 'DERECHA' }"
        >
          <button
            type="button"
            class="btn-motriz-secondary form-btn"
            @click="isCreating = false"
          >
            Cancelar
          </button>
          <button
            type="button"
            class="btn-motriz-primary form-btn"
            :disabled="!newName.trim()"
            @click="handleCreate"
          >
            Guardar en Base de Datos
          </button>
        </div>
      </div>

      <!-- Profile Selector List -->
      <div v-else class="profiles-list-section">
        <p class="section-desc">
          Selecciona un perfil existente o crea uno nuevo para registrar las sesiones del usuario.
        </p>

        <div class="profiles-grid">
          <div
            v-for="p in profiles"
            :key="p.id"
            class="profile-item-card"
            :class="{ 'profile-item-active': activeProfile?.id === p.id }"
            @click="handleSelect(p.id)"
          >
            <span class="p-avatar">{{ p.avatar || '👤' }}</span>
            <div class="p-details">
              <strong class="p-name">{{ p.name }}</strong>
              <span class="p-meta">{{ p.age }} años • {{ p.heightCm }} cm</span>
              <span class="p-hand-tag">
                Mano: <strong>{{ p.mano_dominante === 'IZQUIERDA' ? 'Izquierda' : 'Derecha' }}</strong>
              </span>
              <span class="p-diff">Movilidad: {{ p.difficulty }}</span>
            </div>
            <div v-if="activeProfile?.id === p.id" class="p-badge-active">
              Activo
            </div>
          </div>
        </div>

        <div
          class="profiles-list-actions"
          :class="{ 'actions-align-left': isLeftHanded, 'actions-align-right': isRightHanded }"
        >
          <button
            type="button"
            class="btn-motriz-primary btn-add-p"
            @click="isCreating = true"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            <span>Crear Nuevo Perfil</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.profile-modal-card {
  width: 100%;
  max-width: 660px;
  padding: 34px 38px;
  background: #FFFDF9;
  transition: all 0.3s ease;
}

/* Orientación de cabecera en modo zurdo */
.card-handed-left .modal-top {
  flex-direction: row-reverse;
}

.modal-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.profile-modal-title {
  margin: 0;
  font-size: 1.85rem;
  font-weight: 900;
  color: var(--motriz-red-primary);
}

.close-x-btn {
  background: #EFE7DE;
  border: none;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  font-size: 1.1rem;
  font-weight: 800;
  color: var(--motriz-text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.close-x-btn:hover {
  background: #E5D5C5;
  transform: scale(1.08);
}

.create-profile-form {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-size: 0.92rem;
  font-weight: 800;
  color: var(--motriz-text-main);
}

.input-hint {
  font-size: 0.74rem;
  color: var(--motriz-text-muted);
  font-style: italic;
}

.hand-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.hand-pill {
  padding: 12px 14px;
  border-radius: 9999px;
  border: 2px solid var(--motriz-card-border);
  background: #FFFDF9;
  font-weight: 800;
  font-size: 0.88rem;
  color: var(--motriz-text-main);
  cursor: pointer;
  transition: all 0.2s ease;
}

.hand-pill:hover {
  border-color: var(--motriz-red-primary);
  background: #FDF4E9;
}

.hand-pill-active {
  border-color: var(--motriz-red-primary);
  background: var(--motriz-red-primary);
  color: #FFF;
  box-shadow: 0 4px 12px rgba(140, 29, 44, 0.25);
}

.difficulty-options {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.diff-pill {
  padding: 10px 8px;
  border-radius: 9999px;
  border: 2px solid var(--motriz-card-border);
  background: #FFFDF9;
  font-weight: 700;
  font-size: 0.82rem;
  color: var(--motriz-text-muted);
  cursor: pointer;
  transition: all 0.2s ease;
}

.diff-pill:hover {
  border-color: var(--motriz-red-primary);
}

.diff-active {
  border-color: var(--motriz-red-primary);
  background: var(--motriz-red-soft);
  color: var(--motriz-red-primary);
  font-weight: 800;
}

.avatar-selector {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.avatar-opt-btn {
  font-size: 1.6rem;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 2px solid var(--motriz-card-border);
  background: #FFFDF9;
  cursor: pointer;
  transition: all 0.15s ease;
}

.avatar-opt-btn:hover {
  transform: scale(1.1);
  border-color: var(--motriz-red-primary);
}

.avatar-opt-active {
  border-color: var(--motriz-red-primary);
  background: var(--motriz-red-soft);
  transform: scale(1.12);
}

.form-actions {
  display: flex;
  gap: 14px;
  margin-top: 10px;
}

.actions-align-left {
  justify-content: flex-start;
  flex-direction: row-reverse;
}

.actions-align-right {
  justify-content: flex-end;
  flex-direction: row;
}

.form-btn {
  padding: 12px 24px;
  font-size: 1rem;
}

.section-desc {
  font-size: 0.95rem;
  color: var(--motriz-text-muted);
  margin: 0 0 18px;
}

.profiles-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  max-height: 380px;
  overflow-y: auto;
  padding: 4px;
  margin-bottom: 24px;
}

.profile-item-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 18px;
  background: #FFFDF9;
  border: 2px solid var(--motriz-card-border);
  border-radius: 20px;
  cursor: pointer;
  position: relative;
  transition: all 0.2s ease;
}

.profile-item-card:hover {
  border-color: var(--motriz-red-primary);
  transform: translateY(-2px);
  box-shadow: 0 6px 18px rgba(140, 29, 44, 0.12);
}

.profile-item-active {
  border-color: var(--motriz-red-primary);
  background: #FEF6F0;
  border-width: 2.5px;
}

.p-avatar {
  font-size: 2.2rem;
  flex-shrink: 0;
}

.p-details {
  display: flex;
  flex-direction: column;
  gap: 2px;
  text-align: left;
}

.p-name {
  font-size: 1.15rem;
  font-weight: 900;
  color: var(--motriz-text-main);
}

.p-meta {
  font-size: 0.8rem;
  color: var(--motriz-text-muted);
  font-weight: 600;
}

.p-hand-tag {
  font-size: 0.76rem;
  color: #8C1D2C;
  font-weight: 700;
}

.p-diff {
  font-size: 0.74rem;
  color: var(--motriz-text-muted);
  text-transform: capitalize;
}

.p-badge-active {
  position: absolute;
  top: 8px;
  right: 12px;
  background: var(--motriz-red-primary);
  color: #FFF;
  font-size: 0.68rem;
  font-weight: 800;
  padding: 2px 8px;
  border-radius: 9999px;
  letter-spacing: 0.05em;
}

.profiles-list-actions {
  display: flex;
}

.btn-add-p {
  padding: 14px 28px;
  font-size: 1.05rem;
}
</style>
