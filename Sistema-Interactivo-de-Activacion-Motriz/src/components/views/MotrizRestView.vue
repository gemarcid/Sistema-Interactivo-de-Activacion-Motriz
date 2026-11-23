<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useProfiles } from '../../composables/useProfiles'
import { playClickTone, playSelectTone, playSuccessChime } from '../../composables/useAudio'
import { useActivityRecorder } from '../../composables/useActivityRecorder'

const props = defineProps({
  duration: {
    type: Number,
    default: 30,
  },
})

const emit = defineEmits(['continue', 'exit', 'activity'])
const recorder = useActivityRecorder(() => 'restSeconds', [],
  (timing) => emit('activity', { ...timing, status: 'INICIADA' }))
recorder.begin('rest')

const { isLeftHanded, isRightHanded } = useProfiles()

const REST_TIME = props.duration
const timeLeft = ref(REST_TIME)
const restCycles = ref(1)
let timer = null

// Progreso porcentual para el aro del reloj
const progressPercent = computed(() => {
  return Math.round(((REST_TIME - timeLeft.value) / REST_TIME) * 100)
})

onMounted(() => {
  startTimer()
})

onBeforeUnmount(() => {
  clearInterval(timer)
  const timing = recorder.stop()
  if (timing) emit('activity', { ...timing, status: 'FINALIZADA', finishedAt: new Date().toISOString() })
})

function startTimer() {
  clearInterval(timer)
  timer = setInterval(() => {
    if (timeLeft.value > 1) {
      timeLeft.value--
    } else {
      // Al expirar 30s sin respuesta, se inicia otro ciclo de 30s automáticamente en bucle
      timeLeft.value = REST_TIME
      restCycles.value++
      playSuccessChime()
    }
  }, 1000)
}

function handleContinue() {
  playSelectTone()
  clearInterval(timer)
  emit('continue')
}

function handleAddRest() {
  playClickTone()
  timeLeft.value = REST_TIME
  restCycles.value++
}

function handleExit() {
  playClickTone()
  clearInterval(timer)
  emit('exit')
}
</script>

<template>
  <div
    class="rest-stage-container"
    :class="{ 'rest-handed-left': isLeftHanded, 'rest-handed-right': isRightHanded }"
  >
    <!-- Tarjeta Central/Lateral Ergonómica: Botones arriba para no agacharse -->
    <div class="motriz-card rest-card">
      <div class="rest-header-row">
        <div class="rest-title-group">
          <span class="rest-badge">Módulo de Pausa Activa</span>
          <h1 class="rest-title">Tiempo de Descanso</h1>
        </div>
        <button type="button" class="btn-motriz-secondary btn-mini-exit" @click="handleExit">
          ✕ Salir al Menú
        </button>
      </div>

      <!-- 1. BOTONES DE ACCIÓN ARRIBA DEL TEXTO (Ergonomía motriz) -->
      <div class="rest-actions-top">
        <button
          type="button"
          class="btn-motriz-primary btn-rest-continue"
          @click="handleContinue"
        >
          <div class="btn-icon-wrapper">
            <svg class="action-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polygon points="5 3 19 12 5 21 5 3" fill="currentColor"/>
            </svg>
          </div>
          <div class="btn-text-content">
            <span class="btn-title-main">CONTINUAR AL SIGUIENTE JUEGO</span>
            <span class="btn-subtitle">Siguiente: Mueve y Recuerda</span>
          </div>
        </button>

        <button
          type="button"
          class="btn-motriz-secondary btn-rest-extend"
          @click="handleAddRest"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          <span>Descansar 30 segundos más (+30s)</span>
        </button>
      </div>

      <!-- 2. RELOJ DE CUENTA REGRESIVA Y PREGUNTA CLARA -->
      <div class="rest-timer-box">
        <div class="timer-dial">
          <svg class="timer-svg" viewBox="0 0 100 100">
            <!-- Círculo de fondo -->
            <circle
              class="timer-circle-bg"
              cx="50"
              cy="50"
              r="42"
            />
            <!-- Círculo animado de cuenta regresiva -->
            <circle
              class="timer-circle-progress"
              cx="50"
              cy="50"
              r="42"
              :style="{
                strokeDashoffset: (264 * (1 - timeLeft / REST_TIME)) + 'px',
              }"
            />
          </svg>
          <div class="timer-digits">
            <span class="digits-number">{{ timeLeft }}</span>
            <span class="digits-unit">seg</span>
          </div>
        </div>

        <div class="rest-prompt-content">
          <h2 class="prompt-question">¿Deseas continuar o descansar 30 segundos más?</h2>
          <p class="prompt-detail">
            ¡Excelente caminata completada! Respira profundo y relaja tus piernas.
          </p>
          <p class="prompt-hint">
            Si no presionas ninguna opción, el sistema esperará automáticamente otros 30 segundos para tu comodidad.
          </p>
          <div v-if="restCycles > 1" class="cycle-pill">
            ⏳ Descanso extendido (Ciclo {{ restCycles }}) • Tómate todo el tiempo que necesites
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rest-stage-container {
  position: relative;
  width: 100%;
  height: calc(100vh - 88px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  box-sizing: border-box;
  z-index: 15;
  transition: all 0.35s ease;
}

/* Ergonomía de mano dominante: desplaza ligeramente el panel hacia el lado dominante */
.rest-handed-left {
  justify-content: flex-start;
  padding-left: 60px;
}

.rest-handed-right {
  justify-content: flex-end;
  padding-right: 60px;
}

.rest-card {
  width: 100%;
  max-width: 580px;
  background: rgba(255, 253, 249, 0.96);
  backdrop-filter: blur(14px);
  box-shadow: 0 16px 40px rgba(60, 25, 20, 0.16);
  border-radius: 26px;
  padding: 26px 30px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.rest-header-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.rest-title-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.rest-badge {
  font-size: 0.8rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--motriz-red-primary);
}

.rest-title {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 900;
  color: var(--motriz-text-main);
  line-height: 1.2;
}

.btn-mini-exit {
  padding: 6px 12px;
  font-size: 0.85rem;
  flex-shrink: 0;
}

/* ========================================================
   1. BOTONES DE ACCIÓN ARRIBA (Ergonomía para evitar agacharse)
   ======================================================== */
.rest-actions-top {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.btn-rest-continue {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 20px;
  border-radius: 9999px;
  box-shadow: 0 8px 24px rgba(140, 29, 44, 0.35);
  text-align: left;
}

.btn-icon-wrapper {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.22);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.action-svg {
  width: 20px;
  height: 20px;
}

.btn-text-content {
  display: flex;
  flex-direction: column;
}

.btn-title-main {
  font-size: 1.15rem;
  font-weight: 900;
  letter-spacing: 0.02em;
}

.btn-subtitle {
  font-size: 0.82rem;
  opacity: 0.9;
  font-weight: 600;
}

.btn-rest-extend {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 12px 20px;
  font-size: 1rem;
  font-weight: 800;
  border-radius: 9999px;
}

/* ========================================================
   2. RELOJ CIRCULAR Y PREGUNTA CLARA
   ======================================================== */
.rest-timer-box {
  display: flex;
  align-items: center;
  gap: 22px;
  padding: 14px 18px;
  background: #FFFBF5;
  border-radius: 20px;
  border: 1.5px solid #EADBCC;
}

.timer-dial {
  position: relative;
  width: 100px;
  height: 100px;
  flex-shrink: 0;
}

.timer-svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.timer-circle-bg {
  fill: none;
  stroke: #E8D9C8;
  stroke-width: 8;
}

.timer-circle-progress {
  fill: none;
  stroke: var(--motriz-red-primary);
  stroke-width: 8;
  stroke-linecap: round;
  stroke-dasharray: 264;
  transition: stroke-dashoffset 0.85s linear;
}

.timer-digits {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.digits-number {
  font-size: 1.85rem;
  font-weight: 900;
  color: var(--motriz-text-main);
  line-height: 1;
}

.digits-unit {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--motriz-text-muted);
  text-transform: uppercase;
}

.rest-prompt-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.prompt-question {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 900;
  color: var(--motriz-text-main);
  line-height: 1.3;
}

.prompt-detail {
  margin: 0;
  font-size: 0.88rem;
  color: var(--motriz-text-muted);
  line-height: 1.3;
}

.prompt-hint {
  margin: 0;
  font-size: 0.8rem;
  color: #786C60;
  font-style: italic;
  line-height: 1.25;
}

.cycle-pill {
  margin-top: 4px;
  font-size: 0.78rem;
  font-weight: 800;
  color: #92400E;
  background: #FEF3C7;
  padding: 4px 10px;
  border-radius: 9999px;
  border: 1px solid #FCD34D;
  display: inline-block;
  align-self: flex-start;
}
</style>
