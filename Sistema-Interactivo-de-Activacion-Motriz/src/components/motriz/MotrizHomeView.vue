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
    class="home-screen-overlay"
    :class="{ 'layout-left-handed': isLeftHanded, 'layout-right-handed': isRightHanded }"
  >
    <!-- Top-Center Guidance Pill -->
    <div class="top-guidance-pill">
      <span class="pulse-dot" :class="{ 'dot-active': bodyDetected }"></span>
      <span class="guidance-text">
        {{
          bodyDetected
            ? handCursorState.active
              ? '🖐️ Mano activa: Apunta hacia un botón para pulsar (o haz clic con el mouse)'
              : '🧍 Cuerpo detectado: Levanta una mano para apuntar (o usa el mouse)'
            : 'Párate frente a la cámara para iniciar el control gestual'
        }}
      </span>
    </div>

    <!-- Center Stage Greeting (Translucent & Senior-friendly) -->
    <div v-if="activeProfile" class="center-welcome-tag">
      <div class="tag-top-row">
        <span class="tag-label">SESIÓN ACTIVA</span>
        <button
          type="button"
          class="hand-adaptation-badge"
          :title="'Cambiar mano dominante (actualmente: ' + dominantHand + ')'"
          @click="handleToggleHand"
        >
          <span v-if="isLeftHanded">👈 Modo Zurdo (Mano Izquierda)</span>
          <span v-else>👉 Modo Diestro (Mano Derecha)</span>
          <span class="badge-swap-icon">🔄</span>
        </button>
      </div>

      <h2 class="tag-name">{{ activeProfile.avatar || '👴' }} {{ activeProfile.name }}</h2>
      <div class="tag-meta-row">
        <span class="tag-meta">{{ activeProfile.heightCm }} cm estatura</span>
        <span class="tag-sep">•</span>
        <span class="tag-meta">{{ activeProfile.age }} años</span>
        <span class="tag-sep">•</span>
        <span class="tag-meta">Movilidad: {{ activeProfile.difficulty || 'Fácil' }}</span>
      </div>
    </div>

    <!-- Hand Dominance Floating Bar (Explains button shift) -->
    <div class="hand-banner-pill" :class="{ 'banner-left': isLeftHanded, 'banner-right': isRightHanded }">
      <span class="hand-icon-indicator">{{ isLeftHanded ? '👈' : '👉' }}</span>
      <span class="hand-text-indicator">
        Botones ajustados a la <strong>{{ isLeftHanded ? 'izquierda' : 'derecha' }}</strong> para la comodidad del abuelo.
      </span>
      <button type="button" class="btn-toggle-quick" @click="handleToggleHand">
        Cambiar a {{ isLeftHanded ? 'derecha 👉' : 'izquierda 👈' }}
      </button>
    </div>

    <!-- Bottom Capsule Buttons Area (Reposicionado según mano dominante) -->
    <div
      class="home-action-dock"
      :class="{
        'dock-align-left': isLeftHanded,
        'dock-align-right': isRightHanded,
      }"
    >
      <!-- 🚀 NUEVA PARTIDA (Crimson 3D Capsule - Extra Large) -->
      <button
        type="button"
        class="btn-motriz-primary btn-home-primary"
        @click="handleStart"
      >
        <svg class="action-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M13.13 2.21C11.39 3.06 9.87 4.54 8.79 6.32C8.36 7.03 8.04 7.82 7.84 8.65L9.67 9.38C9.9 8.68 10.23 8.02 10.66 7.42C11.53 6.22 12.63 5.25 13.9 4.58L13.13 2.21M17.7 2C15.82 2.76 14.15 4.14 13 6L14.7 7C15.5 5.7 16.7 4.8 18 4.3L17.7 2M12 7C9.24 7 7 9.24 7 12C7 13.38 7.56 14.63 8.46 15.54L4 20H8.46L11.08 17.38C11.38 17.46 11.69 17.5 12 17.5C14.76 17.5 17 15.26 17 12.5C17 9.74 14.76 7 12 7M12 9A3 3 0 0 1 15 12A3 3 0 0 1 12 15A3 3 0 0 1 9 12A3 3 0 0 1 12 9M2.81 14.81L5.63 17.63L3.5 19.76L0.69 16.94L2.81 14.81M14.81 2.81L17.63 5.63L19.76 3.5L16.94 0.69L14.81 2.81Z"/>
        </svg>
        <span class="btn-label">NUEVA PARTIDA</span>
      </button>

      <!-- 👤+ DATOS / CAMBIAR ABUELO (Ivory 3D Capsule - Extra Large) -->
      <button
        type="button"
        class="btn-motriz-secondary btn-home-secondary"
        @click="handleProfile"
      >
        <svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke-linecap="round"/>
          <circle cx="8.5" cy="7" r="4"/>
          <line x1="20" y1="8" x2="20" y2="14" stroke-linecap="round"/>
          <line x1="23" y1="11" x2="17" y2="11" stroke-linecap="round"/>
        </svg>
        <span class="btn-label">DATOS DEL ABUELO</span>
      </button>

      <!-- 🧪 ZONA DE PRUEBAS / PROTOTIPOS -->
      <button
        type="button"
        class="btn-motriz-secondary btn-home-lab"
        title="Juegos de prueba originales y prototipos"
        @click="handleLab"
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
          <path d="M10 2v7.31L4.1 18.2A2 2 0 0 0 5.8 21h12.4a2 2 0 0 0 1.7-2.8L14 9.31V2"/>
          <path d="M8.5 2h7"/>
          <path d="M14 9.3l-3.5 5.2"/>
        </svg>
        <span>Zona de Pruebas</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.home-screen-overlay {
  position: relative;
  width: 100%;
  flex: 1;
  gap: 12px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;
  padding: 24px 36px 48px;
  box-sizing: border-box;
  z-index: 10;
  pointer-events: none;
  transition: all 0.3s ease;
}

.home-screen-overlay > * {
  pointer-events: auto;
}

.top-guidance-pill {
  display: flex;
  align-items: center;
  gap: 14px;
  background: rgba(255, 253, 249, 0.95);
  backdrop-filter: blur(14px);
  padding: 14px 32px;
  border-radius: 9999px;
  border: 2px solid var(--motriz-card-border);
  box-shadow: 0 8px 22px rgba(70, 30, 20, 0.14);
  transition: all 0.3s ease;
}

.pulse-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #F59E0B;
  transition: all 0.3s ease;
}

.pulse-dot.dot-active {
  background: #16A34A;
  box-shadow: 0 0 14px #16A34A;
}

.guidance-text {
  font-size: 1.12rem;
  font-weight: 800;
  color: var(--motriz-text-main);
}

/* Center stage greeting */
.center-welcome-tag {
  background: rgba(255, 253, 249, 0.92);
  backdrop-filter: blur(12px);
  padding: 16px 36px;
  border-radius: 32px;
  border: 2px solid rgba(232, 221, 208, 0.85);
  box-shadow: 0 8px 24px rgba(60, 25, 20, 0.1);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.tag-top-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.tag-label {
  font-size: 0.78rem;
  font-weight: 800;
  color: var(--motriz-red-primary);
  letter-spacing: 0.14em;
}

.hand-adaptation-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  background: #FDF2E9;
  border: 1.5px solid #F5C6A5;
  border-radius: 9999px;
  font-size: 0.82rem;
  font-weight: 800;
  color: #8C1D2C;
  cursor: pointer;
  transition: all 0.15s;
}

.hand-adaptation-badge:hover {
  background: #FEE8D6;
  transform: scale(1.04);
}

.badge-swap-icon {
  font-size: 0.8rem;
}

.tag-name {
  margin: 4px 0 6px;
  font-size: 1.85rem;
  font-weight: 900;
  color: var(--motriz-text-main);
}

.tag-meta-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tag-meta {
  font-size: 0.92rem;
  color: var(--motriz-text-muted);
  font-weight: 600;
}

.tag-sep {
  color: #C0B0A0;
}

/* Hand Banner Pill */
.hand-banner-pill {
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(255, 253, 249, 0.92);
  backdrop-filter: blur(10px);
  padding: 8px 20px;
  border-radius: 9999px;
  border: 1.5px solid #E2D3C4;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
  font-size: 0.92rem;
  color: #4D3C33;
  margin-bottom: 8px;
  transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}

.banner-left {
  align-self: flex-start;
  margin-left: 48px;
  border-left: 4px solid #8C1D2C;
}

.banner-right {
  align-self: flex-end;
  margin-right: 48px;
  border-right: 4px solid #8C1D2C;
}

.hand-icon-indicator {
  font-size: 1.3rem;
}

.btn-toggle-quick {
  background: #8C1D2C;
  color: #FFF;
  border: none;
  border-radius: 9999px;
  padding: 4px 12px;
  font-size: 0.78rem;
  font-weight: 800;
  cursor: pointer;
  transition: opacity 0.15s;
}

.btn-toggle-quick:hover {
  opacity: 0.9;
}

/* ========================================================
   BOTTOM ACTION DOCK - ADAPTACIÓN SEGÚN MANO DOMINANTE
   ======================================================== */
.home-action-dock {
  display: flex;
  align-items: center;
  gap: 24px;
  width: 100%;
  max-width: 1300px;
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

/* MODO ZURDO: Alinea y ordena los botones hacia la izquierda */
.dock-align-left {
  justify-content: flex-start;
  flex-direction: row;
  padding-left: 24px;
}

/* MODO DIESTRO: Alinea y ordena los botones hacia la derecha */
.dock-align-right {
  justify-content: flex-end;
  flex-direction: row-reverse;
  padding-right: 24px;
}

.btn-home-primary {
  min-width: 360px;
  padding: 24px 46px;
  font-size: 1.65rem;
  border-width: 3px;
  box-shadow: 0 10px 24px rgba(140, 29, 44, 0.32);
}

.btn-home-secondary {
  min-width: 350px;
  padding: 24px 42px;
  font-size: 1.45rem;
  border-width: 3px;
}

.btn-home-lab {
  padding: 22px 30px;
  font-size: 1.2rem;
  border-width: 2.5px;
}

.action-icon {
  width: 34px;
  height: 34px;
}

@media (max-width: 1100px) {
  .home-action-dock {
    flex-direction: column !important;
    gap: 8px;
    padding: 0 !important;
  }
  .hand-banner-pill {
    align-self: center !important;
    margin: 0 !important;
  }
  .btn-home-primary,
  .btn-home-secondary,
  .btn-home-lab {
    width: 100%;
    min-width: unset;
    padding: 10px 14px;
    font-size: 1.12rem;
  }
}

@media (max-width: 700px), (max-height: 620px) {
  .home-screen-overlay {
    padding: 8px 12px;
  }

  .top-guidance-pill,
  .center-welcome-tag,
  .hand-banner-pill {
    padding: 6px 10px;
  }

  .guidance-text {
    font-size: 0.95rem;
  }

  .hand-banner-pill,
  .tag-top-row,
  .tag-meta-row {
    flex-wrap: wrap;
    justify-content: center;
  }
}

@media (max-height: 480px) and (min-width: 600px) {
  .home-action-dock {
    flex-direction: row !important;
  }

  .btn-home-primary,
  .btn-home-secondary,
  .btn-home-lab {
    min-width: 0;
    padding: 8px 12px;
    font-size: 1rem;
  }
}

@media (max-height: 560px) {
  .home-screen-overlay {
    gap: 6px;
  }

  .hand-banner-pill {
    display: none;
  }

  .top-guidance-pill {
    gap: 6px;
  }

  .tag-name {
    font-size: 1.3rem;
  }

  .btn-home-primary,
  .btn-home-secondary,
  .btn-home-lab {
    padding: 6px 10px;
    min-height: 44px;
  }

  .action-icon {
    width: 24px;
    height: 24px;
  }
}
</style>
