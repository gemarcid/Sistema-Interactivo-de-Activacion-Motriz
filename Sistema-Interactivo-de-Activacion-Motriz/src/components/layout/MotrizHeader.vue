<script setup>
import { ref } from 'vue'
import { useProfiles } from '../../composables/useProfiles'
import { playClickTone, playSelectTone } from '../../composables/useAudio'

const props = defineProps({
  showBack: {
    type: Boolean,
    default: false,
  },
  backLabel: {
    type: String,
    default: 'Volver',
  },
  autohide: {
    type: Boolean,
    default: false,
  },
})

// Header hover state for autohide
const isHeaderHovered = ref(false)

// Emit full set of events used by the app (including progress report)
const emit = defineEmits(['back', 'open-settings', 'open-help', 'open-profiles', 'open-patient-form', 'open-progress'])

const { activeProfile, isLeftHanded, isRightHanded, dominantHand, toggleDominantHand } = useProfiles()

function handleBack() {
  playClickTone()
  emit('back')
}

function handleSettings() {
  playClickTone()
  emit('open-settings')
}

function handleHelp() {
  playClickTone()
  emit('open-help')
}

function handleProfiles() {
  playClickTone()
  emit('open-profiles')
}

function handleToggleHand() {
  playSelectTone()
  toggleDominantHand()
}
</script>

<template>
  <!-- Top hover hotspot detector when autohide is enabled -->
  <div
    v-if="autohide"
    class="header-hover-hotspot"
    @mouseenter="isHeaderHovered = true"
  />

  <header
    class="motriz-header"
    :class="{
      'header-handed-left': isLeftHanded,
      'header-handed-right': isRightHanded,
      'header-autohide': autohide,
      'header-revealed': !autohide || isHeaderHovered,
    }"
    @mouseenter="isHeaderHovered = true"
    @mouseleave="isHeaderHovered = false"
  >
    <!-- Logo & Branding -->
    <div class="logo-area" @click="handleProfiles">
      <div class="logo-emblem">
        <svg viewBox="0 0 100 100" class="emblem-svg">
          <circle cx="50" cy="50" r="46" fill="#8C1D2C" />
          <circle cx="50" cy="27" r="10" fill="#FFFDF9" />
          <path
            d="M 23 45 Q 50 35 77 45 Q 70 55 58 50 L 58 64 L 66 85 L 54 85 L 50 72 L 46 85 L 34 85 L 42 64 L 42 50 Q 30 55 23 45 Z"
            fill="#FFFDF9"
          />
        </svg>
      </div>

      <div class="brand-text">
        <span class="brand-title">ASISTENCIA</span>
        <span class="brand-subtitle">MOTRIZ</span>
      </div>

      <!-- Paciente Pill Badge -->
      <div v-if="activeProfile" class="profile-pill-badge" title="Ver o cambiar paciente">
        <span class="profile-avatar">{{ activeProfile.avatar || '👤' }}</span>
        <div class="profile-meta">
          <span class="profile-name">{{ activeProfile.name }}</span>
          <span class="profile-height">{{ activeProfile.heightCm }} cm • {{ activeProfile.age }} años</span>
        </div>
      </div>
    </div>

    <!-- Header Actions (Reposicionados según la mano dominante) -->
    <div class="header-actions">
      <button type="button" class="btn-motriz-secondary header-back-btn" @click="emit('open-progress')">
        Reportes
      </button>
      <!-- Indicador / Alternador de Mano Dominante -->
      <button
        type="button"
        class="btn-hand-toggle"
        :title="'Mano dominante actual: ' + dominantHand + '. Clic para alternar.'"
        @click="handleToggleHand"
      >
        <span class="hand-side-badge">
          <svg v-if="isLeftHanded" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
          <span>Mano {{ isLeftHanded ? 'Izquierda' : 'Derecha' }}</span>
        </span>
      </button>

      <!-- Botón Volver -->
      <button
        v-if="showBack"
        type="button"
        class="btn-motriz-secondary header-back-btn"
        @click="handleBack"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M19 12H5M12 19l-7-7 7-7" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span>{{ backLabel }}</span>
      </button>

      <!-- Botón Configuración -->
      <button
        type="button"
        class="btn-round-action"
        title="Configuración del sistema"
        aria-label="Configuración"
        @click="handleSettings"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3" />
          <path
            d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
          />
        </svg>
      </button>

      <!-- Botón Ayuda -->
      <button
        type="button"
        class="btn-round-action"
        title="Guía de ayuda"
        aria-label="Ayuda"
        @click="handleHelp"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" stroke-linecap="round" stroke-linejoin="round" />
          <circle cx="12" cy="17" r="0.75" fill="currentColor" />
        </svg>
      </button>

      <!-- Botón Perfiles -->
      <button
        type="button"
        class="btn-round-action btn-profile-round"
        title="Cambiar paciente"
        aria-label="Perfiles"
        @click="handleProfiles"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="12" cy="7" r="4" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>
  </header>
</template>

<style scoped>
.header-hover-hotspot {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 35px;
  z-index: 99;
  background: transparent;
  pointer-events: auto;
}

.motriz-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 36px;
  background: rgba(255, 253, 249, 0.9);
  backdrop-filter: blur(14px);
  border-bottom: 2px solid var(--motriz-card-border);
  position: relative;
  z-index: 30;
  transition: all 0.35s ease;
}

/* Modo Auto-ocultar durante juegos: aparece suavemente solo al subir el mouse a la parte superior */
.motriz-header.header-autohide {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  transform: translateY(-100%);
  transition: transform 0.32s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s ease;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.16);
}

.motriz-header.header-autohide.header-revealed {
  transform: translateY(0);
}

/* En modo zurdo: se invierte la cabecera para que los botones queden en la mano izquierda del paciente */
.header-handed-left {
  flex-direction: row-reverse;
}

.header-handed-left .header-actions {
  flex-direction: row;
}

.logo-area {
  display: flex;
  align-items: center;
  gap: 16px;
  cursor: pointer;
}

.logo-emblem {
  width: 48px;
  height: 48px;
}

.emblem-svg {
  width: 100%;
  height: 100%;
  filter: drop-shadow(0 2px 6px rgba(140, 29, 44, 0.25));
}

.brand-text {
  display: flex;
  flex-direction: column;
  line-height: 1;
}

.brand-title {
  font-size: 1.15rem;
  font-weight: 900;
  color: var(--motriz-red-primary);
  letter-spacing: 0.12em;
}

.brand-subtitle {
  font-size: 0.85rem;
  font-weight: 800;
  color: var(--motriz-text-main);
  letter-spacing: 0.24em;
  margin-top: 2px;
}

.profile-pill-badge {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: 12px;
  padding: 6px 14px;
  background: #FDF2E9;
  border: 1.5px solid #F5C6A5;
  border-radius: 9999px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.profile-pill-badge:hover {
  background: #FEE8D6;
  transform: scale(1.02);
}

.profile-avatar {
  font-size: 1.25rem;
}

.profile-meta {
  display: flex;
  flex-direction: column;
  text-align: left;
}

.profile-name {
  font-size: 0.85rem;
  font-weight: 800;
  color: var(--motriz-text-main);
}

.profile-height {
  font-size: 0.72rem;
  color: var(--motriz-text-muted);
  font-weight: 600;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 14px;
}

.btn-hand-toggle {
  background: rgba(255, 253, 249, 0.95);
  border: 1.5px solid var(--motriz-card-border);
  border-radius: 9999px;
  padding: 8px 16px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  transition: all 0.2s ease;
}

.btn-hand-toggle:hover {
  border-color: var(--motriz-red-primary);
  transform: scale(1.04);
}

.hand-side-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85rem;
  font-weight: 800;
  color: var(--motriz-red-primary);
}

.header-back-btn {
  padding: 10px 20px;
  font-size: 0.95rem;
  gap: 8px;
}

.btn-round-action {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 2px solid var(--motriz-card-border);
  background: #FFFDF9;
  color: var(--motriz-text-main);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(60, 25, 20, 0.06);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.btn-round-action:hover {
  border-color: var(--motriz-red-primary);
  color: var(--motriz-red-primary);
  transform: translateY(-2px) scale(1.05);
  box-shadow: 0 6px 16px rgba(140, 29, 44, 0.16);
}

.btn-profile-round {
  background: var(--motriz-red-soft);
  color: var(--motriz-red-primary);
  border-color: #F8B4BE;
}
</style>
