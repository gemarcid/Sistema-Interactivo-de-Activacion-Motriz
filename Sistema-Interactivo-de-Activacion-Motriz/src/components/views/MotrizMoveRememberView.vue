<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { playClickTone, playSelectTone } from '../../composables/useAudio'
import { useCamera } from '../../composables/useCamera'
import { useHandCursor } from '../../composables/useHandCursor'
import { useProfiles } from '../../composables/useProfiles'
import { createPoseTracker, measurePose, recognizePose } from '../../game/moveRemember/poseRecognition'
import { generateSequence, movements, ROUND_LENGTH, scoreRound } from '../../game/moveRemember/round'
import MotrizMovementIcon from '../games/MotrizMovementIcon.vue'
import MotrizCalibrationView from './MotrizCalibrationView.vue'

defineEmits(['exit', 'finish'])

const MEMORY_TIME_MS = 12000
const movementById = new Map(movements.map((movement) => [movement.id, movement]))
const { stream, bodyState, cameraError, isLoadingDetector, initCamera } = useCamera()
const { setHandCursorEnabled } = useHandCursor()
const { isLeftHanded } = useProfiles()

const phase = ref('ready')
const phaseHeading = ref(null)
const tracked = ref(false)
const paused = ref(false)
const sequence = ref([])
const completed = ref(0)
const orderErrors = ref(0)
const retry = ref(false)
const hintsUsed = ref(0)
const hint = ref(null)
const remainingMs = ref(0)
let memoryDeadline = 0
let memoryTimer
let trackingTimer
let lastPoseAt = 0
let poseTracker = createPoseTracker()

const secondsLeft = computed(() => Math.ceil(remainingMs.value / 1000))
const playing = computed(() => phase.value === 'memorize' || phase.value === 'execute')
const result = computed(() => scoreRound(sequence.value.length, completed.value, orderErrors.value, hintsUsed.value))

onMounted(() => {
  phaseHeading.value?.focus()
  trackingTimer = setInterval(() => {
    if (performance.now() - lastPoseAt > 400 || !hasCameraFeed()) loseTracking()
  }, 100)
})
watch(() => playing.value && !paused.value, (active) => setHandCursorEnabled(!active), { flush: 'sync' })
watch([phase, paused], () => phaseHeading.value?.focus({ preventScroll: true }), { flush: 'post' })
watch(() => bodyState.landmarks, (landmarks) => {
  const pose = hasCameraFeed() && measurePose(landmarks, bodyState.videoAspect)
  if (!pose) return loseTracking()

  tracked.value = true
  lastPoseAt = performance.now()
  if (phase.value !== 'execute' || paused.value) return

  const expected = sequence.value[completed.value]
  const id = recognizePose(pose)
  // A casual rest between movements should not be counted as an attempt.
  const canCount = id !== null && (id !== 'rest' || expected === 'rest')
  const confirmed = poseTracker.observe(id, lastPoseAt, canCount)
  if (!confirmed) return

  if (confirmed !== expected) {
    orderErrors.value += 1
    retry.value = true
    return
  }

  playClickTone()
  retry.value = false
  hint.value = null
  completed.value += 1
  if (completed.value === sequence.value.length) finishRound()
})
onBeforeUnmount(() => {
  stopMemoryTimer()
  clearInterval(trackingTimer)
  setHandCursorEnabled(true)
})

function hasCameraFeed() {
  return stream.value?.getVideoTracks().some((track) => track.readyState === 'live' && !track.muted)
}

function loseTracking() {
  tracked.value = false
  poseTracker.interrupt()
}

function startRound(repeat = false) {
  if (!tracked.value) return

  playSelectTone()
  if (!repeat) sequence.value = generateSequence()
  completed.value = 0
  orderErrors.value = 0
  retry.value = false
  hintsUsed.value = 0
  hint.value = null
  poseTracker = createPoseTracker()
  remainingMs.value = MEMORY_TIME_MS
  paused.value = false
  phase.value = 'memorize'
  startMemoryTimer()
}

function startMemoryTimer() {
  stopMemoryTimer()
  memoryDeadline = performance.now() + remainingMs.value
  memoryTimer = setInterval(() => {
    remainingMs.value = Math.max(0, memoryDeadline - performance.now())
    if (remainingMs.value === 0) startExecution()
  }, 100)
}

function stopMemoryTimer() {
  clearInterval(memoryTimer)
}

function startExecution() {
  stopMemoryTimer()
  phase.value = 'execute'
}

function togglePause() {
  playClickTone()
  poseTracker.interrupt()
  if (phase.value === 'memorize') {
    if (paused.value) {
      startMemoryTimer()
    } else {
      remainingMs.value = Math.max(0, memoryDeadline - performance.now())
      stopMemoryTimer()
      if (remainingMs.value === 0) startExecution()
    }
  }
  paused.value = !paused.value
}

function revealHint() {
  if (hint.value) return
  playClickTone()
  hint.value = movementById.get(sequence.value[completed.value])
  hintsUsed.value += 1
}

function finishRound() {
  stopMemoryTimer()
  paused.value = false
  phase.value = 'results'
}
</script>

<template>
  <!-- FASE 1: Calibración previa solo desde la cintura para arriba -->
  <MotrizCalibrationView
    v-if="phase === 'ready'"
    mode="upper-body"
    title="Mueve y Recuerda"
    lead-text="Calibración de cintura para arriba • Prepara tus brazos y hombros"
    button-text="COMENZAR JUEGO"
    @start-play="startRound()"
    @exit="$emit('exit')"
  />

  <section v-else class="memory-view" :class="{ 'sidebar-left': isLeftHanded }" aria-labelledby="memory-title">
    <div class="motriz-card memory-sidebar">
      <header class="memory-hud">
        <h1 id="memory-title">Mueve y Recuerda</h1>
        <div class="memory-actions">
          <button
            v-if="playing && !paused"
            type="button"
            class="btn-motriz-secondary"
            @click="togglePause"
          >
            Pausar
          </button>
          <button type="button" class="btn-motriz-secondary" @click="$emit('exit')">Salir</button>
        </div>
      </header>

      <div v-if="paused" class="memory-panel">
        <h2 ref="phaseHeading" tabindex="-1">Pausa</h2>
        <div class="memory-actions-top">
          <button type="button" class="btn-motriz-primary" @click="togglePause">Continuar</button>
          <button type="button" class="btn-motriz-secondary" @click="finishRound">Terminar ronda</button>
        </div>
      </div>

      <div v-else-if="phase === 'memorize'" class="memory-panel">
        <h2 ref="phaseHeading" tabindex="-1">Memoriza el orden</h2>

        <!-- BOTÓN ARRIBA PARA NO AGACHARSE -->
        <div class="memory-actions-top">
          <button type="button" class="btn-motriz-primary" @click="startExecution">¡Ya memoricé! Empezar</button>
        </div>

        <p role="timer">Tiempo restante: <strong>{{ secondsLeft }} s</strong></p>
        <ol class="sequence-grid">
          <li v-for="(id, index) in sequence" :key="id" class="pose-tile">
            <span class="step-number">{{ index + 1 }}</span>
            <MotrizMovementIcon :arms="movementById.get(id).arms" />
            <strong>{{ movementById.get(id).label }}</strong>
          </li>
        </ol>
      </div>

      <div v-else-if="phase === 'execute'" class="memory-panel">
        <h2 ref="phaseHeading" tabindex="-1" aria-live="polite">Postura {{ completed + 1 }} de {{ ROUND_LENGTH }}</h2>

        <!-- PISTA ARRIBA -->
        <div v-if="!hint" class="memory-actions-top">
          <button type="button" class="btn-motriz-secondary" @click="revealHint">Ver pista</button>
        </div>

        <p role="status">
          <template v-if="!tracked">Seguimiento en pausa. Vuelve al centro de la cámara.</template>
          <template v-else-if="retry">Inténtalo de nuevo. Mantén la postura hasta que avance el contador.</template>
          <template v-else>Mantén la postura hasta que avance el contador.</template>
        </p>
        <div v-if="hint" class="hint" role="status">
          <MotrizMovementIcon :arms="hint.arms" />
          <strong>{{ hint.label }}</strong>
        </div>
      </div>

      <div v-else class="memory-panel">
        <h2 ref="phaseHeading" tabindex="-1">
          {{ result.perfect ? '¡Secuencia completada!' : 'Resultados de la ronda' }}
        </h2>

        <!-- ACCIONES PRINCIPALES ARRIBA DEL TEXTO -->
        <div class="memory-actions-top">
          <button type="button" class="btn-motriz-primary btn-session-finish" @click="$emit('finish')">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polygon points="5 3 19 12 5 21 5 3" fill="currentColor"/>
            </svg>
            <span>FINALIZAR SESIÓN</span>
          </button>
          <div class="memory-actions-sub">
            <button type="button" class="btn-motriz-secondary btn-sm" :disabled="!tracked" @click="startRound()">Nueva secuencia</button>
            <button type="button" class="btn-motriz-secondary btn-sm" :disabled="!tracked" @click="startRound(true)">Repetir</button>
          </div>
        </div>

        <dl class="result-grid">
          <div><dt>Posturas completadas</dt><dd>{{ result.correct }} / {{ ROUND_LENGTH }}</dd></div>
          <div><dt>Errores de orden</dt><dd>{{ result.orderErrors }}</dd></div>
          <div><dt>Posturas pendientes</dt><dd>{{ result.incomplete }}</dd></div>
          <div><dt>Pistas utilizadas</dt><dd>{{ result.hintsUsed }}</dd></div>
        </dl>
        <p v-if="!tracked" role="status">Vuelve al centro de la cámara para jugar otra ronda.</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.memory-view {
  display: flex;
  flex: 1;
  min-height: 0;
  justify-content: flex-end;
  padding: clamp(8px, 2vw, 24px);
}

.memory-view.sidebar-left {
  justify-content: flex-start;
}

.memory-sidebar {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  width: min(100%, clamp(248px, 30vw, 352px));
  padding: clamp(12px, 2vw, 20px);
}

.memory-hud {
  display: grid;
  gap: 8px;
  padding-bottom: 12px;
  border-bottom: 2px solid var(--motriz-card-border);
}

.memory-hud h1 {
  margin: 0;
  color: var(--motriz-red-primary);
  font-size: clamp(1.25rem, 3vw, 1.8rem);
}

.memory-panel {
  display: flex;
  flex: 1;
  flex-direction: column;
  padding-top: 16px;
}

.memory-panel h2 {
  margin: 0;
  color: var(--motriz-red-primary);
  font-size: clamp(1.5rem, 3.5vw, 2.2rem);
}

.memory-panel p {
  margin: 4px 0 0;
  font-size: clamp(1rem, 2.2vw, 1.2rem);
}

.memory-actions-top {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 12px 0 10px;
}

.memory-actions-sub {
  display: flex;
  gap: 8px;
}

.btn-session-finish {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 12px 18px;
  font-weight: 900;
  border-radius: 9999px;
  box-shadow: 0 6px 20px rgba(140, 29, 44, 0.35);
}

.memory-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.memory-panel .memory-actions {
  flex-direction: column;
  flex-wrap: nowrap;
  margin-top: auto;
  padding-top: 16px;
}

.memory-actions button {
  min-height: 44px;
  padding: 8px clamp(12px, 2vw, 24px);
  font-size: clamp(0.98rem, 2vw, 1.12rem);
}

.memory-panel .memory-actions button {
  min-height: 52px;
  font-size: clamp(1.125rem, 2.5vw, 1.375rem);
}

.memory-actions button:disabled {
  opacity: 0.65;
  cursor: default;
  transform: none;
}

.memory-view :focus-visible {
  outline: 3px solid var(--motriz-gold);
  outline-offset: 2px;
}

.sequence-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin: 10px 0 0;
  padding: 0;
  list-style: none;
}

.pose-tile {
  display: grid;
  justify-items: center;
  align-content: center;
  gap: 4px;
  padding: 8px 4px;
  border: 2px solid var(--motriz-card-border);
  border-radius: 12px;
  background: var(--motriz-bg-warm);
  overflow-wrap: anywhere;
  text-align: center;
}

.pose-tile svg,
.hint svg {
  width: clamp(42px, 8vw, 68px);
  height: clamp(38px, 7vh, 62px);
  color: var(--motriz-red-primary);
}

.step-number {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--motriz-red-primary);
  color: #fff;
  font-weight: 800;
}

.hint {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  border-radius: 12px;
  background: var(--motriz-gold-light);
}

.result-grid {
  display: grid;
  gap: 8px;
  margin: 16px 0 12px;
}

.result-grid > div {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 2px solid var(--motriz-card-border);
  border-radius: 12px;
  background: var(--motriz-bg-warm);
}

.result-grid dt {
  font-size: clamp(1.125rem, 2.5vw, 1.25rem);
  font-weight: 600;
}

.result-grid dd {
  margin: 0;
  color: var(--motriz-red-primary);
  font-size: clamp(1.625rem, 3vw, 2.25rem);
  font-weight: 800;
  white-space: nowrap;
}

@media (max-height: 600px) {
  .memory-view {
    padding: 6px;
  }

  .memory-sidebar {
    padding: 8px;
  }

  .memory-hud {
    gap: 4px;
    padding-bottom: 6px;
  }

  .memory-hud h1 {
    font-size: 1.2rem;
  }

  .memory-panel {
    padding-top: 6px;
  }

  .memory-panel h2 {
    font-size: 1.5rem;
  }

  .memory-panel p,
  .result-grid dt {
    font-size: 1rem;
  }

  .memory-panel .memory-actions {
    padding-top: 6px;
  }

  .memory-panel .memory-actions button {
    min-height: 44px;
    padding: 4px 8px;
    font-size: 1rem;
  }

  .sequence-grid,
  .result-grid {
    gap: 4px;
    margin: 6px 0 0;
  }

  .pose-tile,
  .result-grid > div {
    gap: 4px;
    padding: 3px 6px;
  }

  .pose-tile svg,
  .hint svg {
    width: 34px;
    height: 36px;
  }

  .step-number {
    width: 20px;
    height: 20px;
  }

  .result-grid dd {
    font-size: 1.3rem;
  }
}

@media (max-height: 700px), (max-width: 700px) {
  .sequence-grid {
    grid-template-columns: 1fr;
  }

  .pose-tile {
    grid-template-columns: auto auto minmax(0, 1fr);
    align-items: center;
    justify-items: start;
    text-align: left;
  }

  .pose-tile svg {
    width: 32px;
    height: 34px;
  }
}

@media (max-height: 440px) {
  .pose-tile svg {
    width: 24px;
    height: 26px;
  }

  .memory-panel .memory-actions {
    flex-direction: row;
  }

  .memory-panel .memory-actions button {
    flex: 1;
  }
}

@media (min-width: 550px) and (max-height: 440px) {
  .memory-sidebar {
    width: clamp(310px, 44vw, 380px);
  }

  .memory-hud {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .memory-hud h1 {
    font-size: 1rem;
  }

  .memory-hud .memory-actions {
    flex: none;
    gap: 4px;
  }

  .memory-hud button {
    padding-inline: 8px;
  }
}
</style>
