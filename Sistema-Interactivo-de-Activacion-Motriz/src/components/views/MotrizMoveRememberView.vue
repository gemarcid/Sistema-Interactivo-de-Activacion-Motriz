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
const { setHandCursorEnabled, setHandCursorArea } = useHandCursor()
const { isLeftHanded } = useProfiles()

const phase = ref('ready')
const phaseHeading = ref(null)
const sidebarRef = ref(null)
const calibrationRef = ref(null)
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
  setHandCursorEnabled(true)
  phaseHeading.value?.focus()
  trackingTimer = setInterval(() => {
    if (performance.now() - lastPoseAt > 400 || !hasCameraFeed()) loseTracking()
  }, 100)
})
watch([sidebarRef, calibrationRef], ([sidebar, calibration]) => {
  setHandCursorArea(sidebar || calibration?.$el.querySelector('.prep-dock-card') || null)
}, { flush: 'post' })
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
  setHandCursorArea(null)
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
    ref="calibrationRef"
    mode="upper-body"
    title="Mueve y Recuerda"
    lead-text="Calibración de cintura para arriba • Prepara tus brazos y hombros"
    button-text="COMENZAR JUEGO"
    :start-status="tracked
      ? 'Brazos detectados. Puedes comenzar.'
      : (cameraError || (isLoadingDetector ? 'Cargando cámara y detector…' : 'Puedes comenzar. Durante las posturas, muestra ambos brazos y la cintura dentro de la cámara.'))"
    @start-play="startRound()"
    @exit="$emit('exit')"
  />

  <section
    v-else
    class="memory-view"
    :class="{ 'sidebar-left': isLeftHanded, 'sequence-view': phase === 'memorize' && !paused }"
    aria-labelledby="memory-title"
  >
    <div
      ref="sidebarRef"
      class="motriz-card memory-sidebar"
      :class="{ 'sequence-panel': phase === 'memorize' && !paused, 'execution-panel': phase === 'execute' && !paused }"
    >
      <header class="memory-hud">
        <h1 id="memory-title">Mueve y Recuerda</h1>
        <div class="memory-actions">
          <template v-if="paused">
            <button type="button" class="btn-motriz-primary" @click="togglePause">Continuar</button>
            <button type="button" class="btn-motriz-secondary" @click="finishRound">Terminar ronda</button>
          </template>
          <button
            v-else-if="phase === 'memorize'"
            type="button"
            class="btn-motriz-primary"
            @click="startExecution"
          >
            ¡Ya memoricé! Empezar
          </button>
          <button
            v-else-if="phase === 'execute' && !hint"
            type="button"
            class="btn-motriz-secondary"
            @click="revealHint"
          >
            Ver pista
          </button>
          <template v-else-if="phase === 'results'">
            <button type="button" class="btn-motriz-primary" @click="$emit('finish')">FINALIZAR SESIÓN</button>
            <button type="button" class="btn-motriz-secondary" :disabled="!tracked" @click="startRound()">Nueva secuencia</button>
            <button type="button" class="btn-motriz-secondary" :disabled="!tracked" @click="startRound(true)">Repetir</button>
          </template>
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
      </div>

      <div v-else-if="phase === 'memorize'" class="memory-panel">
        <h2 ref="phaseHeading" tabindex="-1">Memoriza el orden</h2>

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

        <p role="status">
          <template v-if="!tracked">Seguimiento en pausa. Vuelve al centro de la cámara.</template>
          <template v-else-if="retry">Inténtalo de nuevo. Mantén la postura hasta que avance el contador.</template>
          <template v-else>Mantén la postura hasta que avance el contador.</template>
        </p>
      </div>

      <div v-else class="memory-panel">
        <h2 ref="phaseHeading" tabindex="-1">
          {{ result.perfect ? '¡Secuencia completada!' : 'Resultados de la ronda' }}
        </h2>

        <dl class="result-grid">
          <div><dt>Posturas completadas</dt><dd>{{ result.correct }} / {{ ROUND_LENGTH }}</dd></div>
          <div><dt>Errores de orden</dt><dd>{{ result.orderErrors }}</dd></div>
          <div><dt>Posturas pendientes</dt><dd>{{ result.incomplete }}</dd></div>
          <div><dt>Pistas utilizadas</dt><dd>{{ result.hintsUsed }}</dd></div>
        </dl>
        <p v-if="!tracked" role="status">Vuelve al centro de la cámara para jugar otra ronda.</p>
      </div>
    </div>
    <aside v-if="phase === 'execute' && hint && !paused" class="motriz-card hint-card" role="status" aria-label="Pista">
      <span>Pista</span>
      <MotrizMovementIcon :arms="hint.arms" />
      <strong>{{ hint.label }}</strong>
    </aside>
  </section>
</template>

<style scoped>
.memory-view {
  position: relative;
  display: flex;
  flex: 1;
  min-height: 0;
  justify-content: flex-end;
  align-items: center;
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

.memory-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.memory-actions > .btn-motriz-primary {
  grid-column: 1 / -1;
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

.pose-tile svg {
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

.hint-card {
  position: absolute;
  top: 8px;
  left: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  width: min(200px, 36%);
  padding: 12px;
  text-align: center;
  background: var(--motriz-gold-light);
}

.sidebar-left .hint-card {
  left: auto;
  right: 8px;
}

.hint-card svg {
  width: clamp(44px, 7vw, 72px);
  height: clamp(48px, 10vh, 80px);
  color: var(--motriz-red-primary);
}

.execution-panel .memory-hud h1 {
  font-size: 1.25rem;
}

.memory-sidebar.execution-panel {
  align-self: flex-start;
}

.execution-panel .memory-panel h2 {
  font-size: 1.5rem;
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

  .pose-tile svg {
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

.memory-view.sequence-view {
  justify-content: center;
  align-items: center;
}

.memory-sidebar.sequence-panel {
  width: min(100%, 1100px);
  text-align: center;
}

.sequence-panel .memory-hud {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 12px;
}

.sequence-panel .memory-actions {
  grid-template-columns: minmax(0, 1fr) auto auto;
}

.sequence-panel .memory-actions > .btn-motriz-primary {
  grid-column: auto;
}

.sequence-panel .sequence-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.sequence-panel .pose-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: clamp(4px, 1vw, 12px);
  text-align: center;
  font-size: clamp(0.8rem, 1.8vw, 1.25rem);
  line-height: 1.2;
}

.sequence-panel .pose-tile svg {
  width: clamp(30px, 7vw, 84px);
  height: clamp(34px, 12vh, 92px);
  flex-shrink: 0;
}

.sequence-panel .memory-actions button {
  min-height: 44px;
  padding: 8px 20px;
  font-size: clamp(1rem, 2.5vw, 1.3rem);
}

@media (max-height: 500px) {
  .sequence-panel .memory-panel {
    padding-top: 6px;
  }

  .sequence-panel .memory-panel h2 {
    font-size: 1.15rem;
  }

  .sequence-panel .memory-actions button {
    padding: 4px 10px;
    font-size: 1rem;
  }

  .sequence-panel .pose-tile {
    gap: 2px;
    padding: 3px;
  }

  .sequence-panel .pose-tile svg {
    height: 28px;
    width: 26px;
  }
}

@media (max-width: 700px) {
  .sequence-panel .memory-hud {
    grid-template-columns: 1fr;
  }
}

@media (min-width: 550px) and (max-height: 500px) {
  .sequence-panel .memory-hud {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .sequence-panel .memory-hud h1 {
    font-size: 1rem;
  }

  .sequence-panel .memory-actions button {
    padding-inline: 8px;
    font-size: 0.95rem;
  }
}
</style>
