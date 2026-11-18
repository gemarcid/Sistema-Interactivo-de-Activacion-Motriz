<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { playClickTone, playSelectTone } from '../../composables/useAudio'
import { useCamera } from '../../composables/useCamera'
import { useHandCursor } from '../../composables/useHandCursor'
import { useProfiles } from '../../composables/useProfiles'
import { createPoseTracker, measurePose, recognizePose } from '../../game/moveRemember/poseRecognition'
import { generateSequence, movements, ROUND_LENGTH, scoreRound } from '../../game/moveRemember/round'
import MotrizMovementIcon from './MotrizMovementIcon.vue'

defineEmits(['exit'])

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
  setHandCursorEnabled(false)
  phaseHeading.value?.focus()
  trackingTimer = setInterval(() => {
    if (performance.now() - lastPoseAt > 400 || !hasCameraFeed()) loseTracking()
  }, 100)
})
watch([phase, paused], () => phaseHeading.value?.focus(), { flush: 'post' })
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
  <section class="memory-view" aria-labelledby="memory-title">
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

    <div v-if="phase === 'ready'" class="motriz-card memory-panel">
      <h2 ref="phaseHeading" tabindex="-1">Memoriza cuatro posturas</h2>
      <p role="status">
        {{ tracked ? 'Reprodúcelas en orden frente a la cámara.' : (cameraError || 'Colócate frente a la cámara con los brazos y la cintura a la vista.') }}
      </p>
      <div class="memory-actions">
        <button
          v-if="!stream?.active"
          type="button"
          class="btn-motriz-primary"
          :disabled="isLoadingDetector"
          @click="initCamera()"
        >
          {{ isLoadingDetector ? 'Iniciando cámara…' : 'Activar cámara' }}
        </button>
        <button v-else type="button" class="btn-motriz-primary" :disabled="!tracked" @click="startRound()">
          Comenzar
        </button>
      </div>
    </div>

    <div v-else-if="paused" class="motriz-card memory-panel">
      <h2 ref="phaseHeading" tabindex="-1">Pausa</h2>
      <div class="memory-actions">
        <button type="button" class="btn-motriz-primary" @click="togglePause">Continuar</button>
        <button type="button" class="btn-motriz-secondary" @click="finishRound">Terminar ronda</button>
      </div>
    </div>

    <div v-else-if="phase === 'memorize'" class="motriz-card memory-panel">
      <h2 ref="phaseHeading" tabindex="-1">Memoriza el orden</h2>
      <p role="timer">Tiempo restante <strong>{{ secondsLeft }} s</strong></p>
      <ol class="sequence-grid">
        <li v-for="(id, index) in sequence" :key="id" class="pose-tile">
          <span class="step-number">{{ index + 1 }}</span>
          <MotrizMovementIcon :arms="movementById.get(id).arms" />
          <strong>{{ movementById.get(id).label }}</strong>
        </li>
      </ol>
      <div class="memory-actions">
        <button type="button" class="btn-motriz-primary" @click="startExecution">Ya memoricé</button>
      </div>
    </div>

    <div v-else-if="phase === 'execute'" class="motriz-card memory-panel">
      <h2 ref="phaseHeading" tabindex="-1" aria-live="polite">Postura {{ completed + 1 }} de {{ ROUND_LENGTH }}</h2>
      <p role="status">
        <template v-if="!tracked">Seguimiento en pausa. Vuelve al centro de la cámara.</template>
        <template v-else-if="retry">Inténtalo de nuevo. Mantén la postura hasta que avance el contador.</template>
        <template v-else>Mantén la postura hasta que avance el contador.</template>
      </p>
      <div v-if="hint" class="hint" role="status">
        <MotrizMovementIcon :arms="hint.arms" />
        <strong>{{ hint.label }}</strong>
      </div>
      <div v-else class="memory-actions">
        <button type="button" class="btn-motriz-secondary" @click="revealHint">Ver pista</button>
      </div>
    </div>

    <aside
      v-else
      class="motriz-card memory-panel memory-results"
      :class="{ 'results-left': isLeftHanded }"
      aria-labelledby="memory-results-title"
    >
      <h2 id="memory-results-title" ref="phaseHeading" tabindex="-1">
        {{ result.perfect ? '¡Secuencia completada!' : 'Resultados de la ronda' }}
      </h2>
      <dl class="result-grid">
        <div><dt>Posturas completadas</dt><dd>{{ result.correct }} / {{ ROUND_LENGTH }}</dd></div>
        <div><dt>Errores de orden</dt><dd>{{ result.orderErrors }}</dd></div>
        <div><dt>Posturas pendientes</dt><dd>{{ result.incomplete }}</dd></div>
        <div><dt>Pistas utilizadas</dt><dd>{{ result.hintsUsed }}</dd></div>
      </dl>
      <p v-if="!tracked" role="status">Vuelve al centro de la cámara para jugar otra ronda.</p>
      <div class="memory-actions">
        <button type="button" class="btn-motriz-primary" :disabled="!tracked" @click="startRound()">Nueva secuencia</button>
        <button type="button" class="btn-motriz-secondary" :disabled="!tracked" @click="startRound(true)">Repetir secuencia</button>
      </div>
    </aside>
  </section>
</template>

<style scoped>
.memory-view {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;
  flex: 1;
  gap: 16px;
  padding: clamp(8px, 2vw, 24px);
  text-align: center;
}

.memory-hud {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
}

.memory-hud h1 {
  margin: 0;
  padding: 8px 16px;
  border-radius: 24px;
  background: var(--motriz-bg-card);
  color: var(--motriz-red-primary);
  box-shadow: var(--motriz-shadow-sm);
  font-size: clamp(1.15rem, 3vw, 1.8rem);
}

.memory-panel {
  box-sizing: border-box;
  width: min(100%, 780px);
  padding: clamp(12px, 2vw, 20px);
}

.memory-panel h2 {
  margin: 0;
  color: var(--motriz-red-primary);
  font-size: clamp(1.5rem, 3.5vw, 2rem);
}

.memory-panel p {
  margin: 4px 0 0;
  font-size: clamp(1rem, 2vw, 1.16rem);
}

.memory-results {
  display: flex;
  flex: 1 0 auto;
  flex-direction: column;
  align-self: flex-end;
  width: min(100%, clamp(248px, 30vw, 352px));
  text-align: left;
}

.memory-results.results-left {
  align-self: flex-start;
}

.memory-results h2 {
  font-size: clamp(1.75rem, 4vw, 2.625rem);
}

.memory-results p {
  font-size: clamp(1.125rem, 2.5vw, 1.3125rem);
}

.memory-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
}

.memory-panel .memory-actions {
  margin-top: 12px;
}

.memory-results .memory-actions {
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

.memory-results .memory-actions button {
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
  grid-template-columns: repeat(4, minmax(0, 1fr));
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
}

.pose-tile svg,
.hint svg {
  width: clamp(42px, 8vw, 68px);
  height: clamp(46px, 10vh, 76px);
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

@media (max-width: 520px) {
  .sequence-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
