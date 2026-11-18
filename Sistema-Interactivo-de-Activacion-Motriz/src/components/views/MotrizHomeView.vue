<script setup>
import { useCamera } from '../../composables/useCamera'
import { useProfiles } from '../../composables/useProfiles'
import { handCursorState } from '../../composables/useHandCursor'
import { playClickTone, playSelectTone } from '../../composables/useAudio'

const emit = defineEmits(['start-game', 'create-profile', 'open-lab'])

const { bodyDetected } = useCamera()
const { activeProfile, isLeftHanded, isRightHanded, dominantHand, toggleDominantHand } = useProfiles()

function handleStart() {
  playSelectTone()
  emit('start-game')
}

function handleProfile() {
  playClickTone()
  emit('create-profile')
}

function handleLab() {
  playClickTone()
  emit('open-lab')
}

function handleToggleHand() {
  playSelectTone()
  toggleDominantHand()
}
</script>

<template>
  <div
    class="home-stage-container"
    :class="{ 'mode-left-handed': isLeftHanded, 'mode-right-handed': isRightHanded }"
  >
    <!-- 1. Top-Center Guidance Pill & Patient Session Badge -->
    <div class="top-center-overlay">
      <!-- Live Body / Hand Guidance Indicator -->
      <div class="guidance-pill">
        <span class="status-dot" :class="{ 'status-dot-active': bodyDetected }"></span>
        <svg
          v-if="handCursorState.active"
          class="guidance-icon"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/>
          <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"/>
          <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/>
          <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>
        </svg>
        <svg
          v-else-if="bodyDetected"
          class="guidance-icon"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="5" r="3"/>
          <path d="M12 8v8"/>
          <path d="m9 21 3-5 3 5"/>
          <path d="M6 12h12"/>
        </svg>
        <span class="guidance-text">
          {{
            bodyDetected
              ? handCursorState.active
                ? 'Mano activa detectada: Apunta hacia los botones laterales para interactuar'
                : 'Cuerpo detectado: Levanta una mano hacia el menú lateral o usa el mouse'
              : 'Párate frente a la cámara para iniciar el control gestual'
          }}
        </span>
      </div>

      <!-- Active Patient Header Tag (Center Stage) -->
      <div v-if="activeProfile" class="patient-session-pill">
        <span class="patient-avatar">{{ activeProfile.avatar || '👤' }}</span>
        <div class="patient-info">
          <strong class="patient-name">{{ activeProfile.name }}</strong>
          <span class="patient-meta">
            {{ activeProfile.heightCm }} cm estatura • {{ activeProfile.age }} años • Nivel {{ activeProfile.difficulty || 'Fácil' }}
          </span>
        </div>
      </div>
    </div>

    <!-- 2. LATERAL MENU DOCK (Posicionado a la izquierda o derecha según mano dominante) -->
    <aside
      class="lateral-menu-dock"
      :class="{
        'dock-lateral-left': isLeftHanded,
        'dock-lateral-right': isRightHanded,
      }"
      role="navigation"
      aria-label="Menú principal de acciones"
    >
      <!-- Indicador Ergonómico de Mano Dominante -->
      <div class="dock-header-card">
        <div class="dock-side-tag">
          <svg
            v-if="isLeftHanded"
            class="side-arrow-svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          <svg
            v-else
            class="side-arrow-svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
          <span class="dock-side-label">
            Menú Lateral • Mano {{ isLeftHanded ? 'Izquierda' : 'Derecha' }}
          </span>
        </div>

        <button
          type="button"
          class="btn-swap-side"
          :title="'Alternar menú al otro lateral (actualmente: ' + (isLeftHanded ? 'Izquierda' : 'Derecha') + ')'"
          @click="handleToggleHand"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="17 1 21 5 17 9"/>
            <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
            <polyline points="7 23 3 19 7 15"/>
            <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
          </svg>
          <span>Cambiar lado</span>
        </button>
      </div>

      <!-- BOTÓN 1: NUEVA PARTIDA (Crimson 3D Capsule - Acción Principal) -->
      <button
        type="button"
        class="btn-motriz-primary btn-lateral-action btn-lateral-primary"
        @click="handleStart"
      >
        <div class="btn-icon-wrapper">
          <svg class="action-svg" viewBox="0 0 24 24" fill="currentColor">
            <path d="M13.13 2.21C11.39 3.06 9.87 4.54 8.79 6.32C8.36 7.03 8.04 7.82 7.84 8.65L9.67 9.38C9.9 8.68 10.23 8.02 10.66 7.42C11.53 6.22 12.63 5.25 13.9 4.58L13.13 2.21M17.7 2C15.82 2.76 14.15 4.14 13 6L14.7 7C15.5 5.7 16.7 4.8 18 4.3L17.7 2M12 7C9.24 7 7 9.24 7 12C7 13.38 7.56 14.63 8.46 15.54L4 20H8.46L11.08 17.38C11.38 17.46 11.69 17.5 12 17.5C14.76 17.5 17 15.26 17 12.5C17 9.74 14.76 7 12 7M12 9A3 3 0 0 1 15 12A3 3 0 0 1 12 15A3 3 0 0 1 9 12A3 3 0 0 1 12 9M2.81 14.81L5.63 17.63L3.5 19.76L0.69 16.94L2.81 14.81M14.81 2.81L17.63 5.63L19.76 3.5L16.94 0.69L14.81 2.81Z"/>
          </svg>
        </div>
        <div class="btn-text-content">
          <span class="btn-title-main">NUEVA PARTIDA</span>
          <span class="btn-subtitle">Iniciar sesión y calibración</span>
        </div>
      </button>

      <!-- BOTÓN 2: DATOS DEL PACIENTE (Ivory 3D Capsule) -->
      <button
        type="button"
        class="btn-motriz-secondary btn-lateral-action btn-lateral-secondary"
        @click="handleProfile"
      >
        <div class="btn-icon-wrapper">
          <svg class="action-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke-linecap="round"/>
            <circle cx="8.5" cy="7" r="4"/>
            <line x1="20" y1="8" x2="20" y2="14" stroke-linecap="round"/>
            <line x1="23" y1="11" x2="17" y2="11" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="btn-text-content">
          <span class="btn-title-main">DATOS DEL PACIENTE</span>
          <span class="btn-subtitle">Cambiar datos o perfil activo</span>
        </div>
      </button>

      <!-- BOTÓN 3: ZONA DE PRUEBAS / PROTOTIPOS -->
      <button
        type="button"
        class="btn-motriz-secondary btn-lateral-action btn-lateral-lab"
        title="Juegos de prueba originales y prototipos CIF"
        @click="handleLab"
      >
        <div class="btn-icon-wrapper">
          <svg class="action-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <path d="M10 2v7.31L4.1 18.2A2 2 0 0 0 5.8 21h12.4a2 2 0 0 0 1.7-2.8L14 9.31V2"/>
            <path d="M8.5 2h7"/>
            <path d="M14 9.3l-3.5 5.2"/>
          </svg>
        </div>
        <div class="btn-text-content">
          <span class="btn-title-main">ZONA DE PRUEBAS</span>
          <span class="btn-subtitle">Prototipos y simulaciones</span>
        </div>
      </button>
    </aside>
  </div>
</template>

<style scoped>
.home-stage-container {
  position: relative;
  width: 100%;
  height: calc(100vh - 96px);
  overflow: hidden;
  box-sizing: border-box;
  pointer-events: none;
  transition: all 0.4s ease;
}

/* ========================================================
   1. TOP-CENTER OVERLAY: GUÍA Y SESIÓN DEL PACIENTE
   ======================================================== */
.top-center-overlay {
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  z-index: 20;
  pointer-events: auto;
  max-width: 90%;
}

.guidance-pill {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  background: rgba(255, 253, 249, 0.95);
  backdrop-filter: blur(14px);
  padding: 10px 26px;
  border-radius: 9999px;
  border: 2px solid var(--motriz-card-border);
  box-shadow: 0 6px 20px rgba(70, 30, 20, 0.12);
  transition: all 0.3s ease;
}

.status-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #F59E0B;
  flex-shrink: 0;
  transition: all 0.3s ease;
}

.status-dot.status-dot-active {
  background: #16A34A;
  box-shadow: 0 0 12px #16A34A;
}

.guidance-icon {
  color: var(--motriz-red-primary);
  flex-shrink: 0;
}

.guidance-text {
  font-size: 0.98rem;
  font-weight: 800;
  color: var(--motriz-text-main);
  white-space: nowrap;
}

.patient-session-pill {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  background: rgba(255, 253, 249, 0.92);
  backdrop-filter: blur(10px);
  padding: 8px 22px;
  border-radius: 9999px;
  border: 1.5px solid rgba(232, 221, 208, 0.85);
  box-shadow: 0 4px 16px rgba(60, 25, 20, 0.08);
}

.patient-avatar {
  font-size: 1.45rem;
  line-height: 1;
}

.patient-info {
  display: flex;
  flex-direction: column;
  text-align: left;
}

.patient-name {
  font-size: 1.05rem;
  font-weight: 900;
  color: var(--motriz-text-main);
  line-height: 1.2;
}

.patient-meta {
  font-size: 0.82rem;
  color: var(--motriz-text-muted);
  font-weight: 600;
}

/* ========================================================
   2. DOCK LATERAL DE BOTONES DEL MENÚ
   Colocado a la izquierda o derecha según mano dominante.
   Deja el centro libre para la visualización del paciente.
   ======================================================== */
.lateral-menu-dock {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 370px;
  pointer-events: auto;
  z-index: 25;
  transition: all 0.45s cubic-bezier(0.16, 1, 0.3, 1);
}

/* Modo Zurdo: lateral izquierdo */
.dock-lateral-left {
  left: 44px;
  right: auto;
  animation: slideInFromLeft 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

/* Modo Diestro: lateral derecho */
.dock-lateral-right {
  right: 44px;
  left: auto;
  animation: slideInFromRight 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes slideInFromLeft {
  from {
    opacity: 0;
    transform: translate(-30px, -50%);
  }
  to {
    opacity: 1;
    transform: translate(0, -50%);
  }
}

@keyframes slideInFromRight {
  from {
    opacity: 0;
    transform: translate(30px, -50%);
  }
  to {
    opacity: 1;
    transform: translate(0, -50%);
  }
}

/* Cabecera del dock lateral */
.dock-header-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(255, 253, 249, 0.94);
  backdrop-filter: blur(12px);
  padding: 8px 16px;
  border-radius: 9999px;
  border: 1.5px solid #E4D5C5;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.07);
}

.dock-side-tag {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #8C1D2C;
}

.side-arrow-svg {
  color: #8C1D2C;
  flex-shrink: 0;
}

.dock-side-label {
  font-size: 0.82rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: #5A202A;
}

.btn-swap-side {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: #FDF2E9;
  color: #8C1D2C;
  border: 1px solid #F5C6A5;
  border-radius: 9999px;
  padding: 4px 10px;
  font-size: 0.74rem;
  font-weight: 800;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-swap-side:hover {
  background: #FEE8D6;
  transform: scale(1.04);
}

/* Botones laterales grandes para fácil alcance gestual */
.btn-lateral-action {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 20px 24px;
  border-radius: 24px;
  box-sizing: border-box;
  text-align: left;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.btn-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  flex-shrink: 0;
}

.action-svg {
  width: 32px;
  height: 32px;
}

.btn-text-content {
  display: flex;
  flex-direction: column;
}

.btn-title-main {
  font-size: 1.38rem;
  font-weight: 900;
  letter-spacing: 0.04em;
  line-height: 1.15;
}

.btn-subtitle {
  font-size: 0.82rem;
  font-weight: 600;
  opacity: 0.85;
  margin-top: 3px;
}

/* Botón 1: NUEVA PARTIDA */
.btn-lateral-primary {
  padding: 22px 26px;
  border-width: 3px;
  box-shadow: 0 10px 24px rgba(140, 29, 44, 0.34);
}

.btn-lateral-primary:hover {
  transform: translateY(-2px) scale(1.02);
  box-shadow: 0 14px 30px rgba(140, 29, 44, 0.44);
}

/* Botón 2: DATOS DEL PACIENTE */
.btn-lateral-secondary {
  border-width: 2.5px;
  box-shadow: 0 8px 20px rgba(60, 25, 20, 0.1);
}

.btn-lateral-secondary:hover {
  transform: translateY(-2px) scale(1.02);
  box-shadow: 0 12px 24px rgba(60, 25, 20, 0.16);
}

/* Botón 3: ZONA DE PRUEBAS */
.btn-lateral-lab {
  border-width: 2px;
  opacity: 0.95;
  padding: 18px 22px;
}

.btn-lateral-lab:hover {
  opacity: 1;
  transform: translateY(-2px) scale(1.02);
}

/* ========================================================
   RESPONSIVE DESIGN (Tablets y pantallas estrechas)
   ======================================================== */
@media (max-width: 960px) {
  .lateral-menu-dock {
    width: 320px;
  }
  .dock-lateral-left {
    left: 20px;
  }
  .dock-lateral-right {
    right: 20px;
  }
  .btn-title-main {
    font-size: 1.2rem;
  }
}

@media (max-width: 740px) {
  .home-stage-container {
    height: auto;
    min-height: calc(100vh - 96px);
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 16px;
  }
  .top-center-overlay {
    position: static;
    transform: none;
    margin-bottom: 20px;
    width: 100%;
  }
  .lateral-menu-dock {
    position: static;
    transform: none;
    width: 100%;
    max-width: 420px;
    margin-top: 10px;
  }
  .dock-lateral-left,
  .dock-lateral-right {
    left: auto;
    right: auto;
  }
}
</style>
