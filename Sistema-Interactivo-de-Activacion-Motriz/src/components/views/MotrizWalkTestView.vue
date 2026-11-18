<script setup>
import { ref, reactive, computed, watch, onBeforeUnmount } from 'vue'
import { useCamera } from '../../composables/useCamera'
import MotrizCalibrationView from './MotrizCalibrationView.vue'

const emit = defineEmits(['finish', 'exit'])

const { bodyState, bodyDetected } = useCamera()

// Fases del módulo: 'calibration' -> 'running' -> 'finished'
const phase = ref('calibration')

// Duración corta para adulto mayor (30 segundos)
const TEST_DURATION = 30
const timeLeft = ref(TEST_DURATION)
let timerInterval = null

// Canvas transparente para dibujar el esqueleto de piernas, ángulos y Centro de Masa
const overlayCanvasRef = ref(null)

// Línea base guardada al terminar la calibración
const baseline = reactive({
  leftKnee: 175,
  rightKnee: 175,
  leftHip: 175,
  rightHip: 175,
  comX: 0.5,
  comY: 0.5,
})

// Métricas biomecánicas en tiempo real
const metrics = reactive({
  // Ángulos actuales (grados)
  leftKneeAngle: 180,
  rightKneeAngle: 180,
  leftHipAngle: 180,
  rightHipAngle: 180,

  // Amplitud de movimiento (ROM = máxima flexión alcanzada respecto a la calibración)
  maxLeftKneeROM: 0,
  maxRightKneeROM: 0,
  maxHipROM: 0,

  // Centro de Masa / Gravedad (oscilación respecto al punto calibrado, en %)
  comX: 50,
  comY: 50,
  comMaxSwayX: 0,
  comMaxSwayY: 0,

  // Intensidad y conteo de pasos
  steps: 0,
  leftLegUp: false,
  rightLegUp: false,
})

// Cálculos derivados para mostrar en pantalla
const averageMaxROM = computed(() => {
  return Math.round((metrics.maxLeftKneeROM + metrics.maxRightKneeROM) / 2)
})

const cadencePerMin = computed(() => {
  const elapsed = Math.max(1, TEST_DURATION - timeLeft.value)
  return Math.round((metrics.steps / elapsed) * 60)
})

const intensityLevel = computed(() => {
  const c = cadencePerMin.value
  if (metrics.steps === 0) return { label: 'Sin movimiento', color: '#94a3b8' }
  if (c < 45) return { label: 'Baja (Muy lenta)', color: '#38bdf8' }
  if (c <= 85) return { label: 'Moderada (Ideal)', color: '#22c55e' }
  return { label: 'Alta (Rápida)', color: '#f59e0b' }
})

// Calcula el ángulo interno (0° a 180°) entre 3 puntos de MediaPipe (p2 es la articulación)
function calculateJointAngle(p1, p2, p3, aspect = 16 / 9) {
  const ax = p1.x * aspect
  const ay = p1.y
  const bx = p2.x * aspect
  const by = p2.y
  const cx = p3.x * aspect
  const cy = p3.y

  const radians = Math.atan2(cy - by, cx - bx) - Math.atan2(ay - by, ax - bx)
  let deg = Math.abs((radians * 180.0) / Math.PI)
  if (deg > 180.0) deg = 360.0 - deg
  return Math.round(deg)
}

function areVisible(...pts) {
  return pts.every((p) => p && (p.visibility ?? 1) > 0.45)
}

// 1. Al completar la calibración en MotrizCalibrationView (@start-play)
function handleStartAfterCalibration() {
  const lm = bodyState.landmarks
  const aspect = window.innerWidth / window.innerHeight || 16 / 9

  // Guardar ángulos iniciales en reposo como referencia de calibración
  if (lm && lm.length >= 29) {
    if (areVisible(lm[23], lm[25], lm[27])) {
      baseline.leftKnee = calculateJointAngle(lm[23], lm[25], lm[27], aspect)
    }
    if (areVisible(lm[24], lm[26], lm[28])) {
      baseline.rightKnee = calculateJointAngle(lm[24], lm[26], lm[28], aspect)
    }
    if (areVisible(lm[11], lm[23], lm[25])) {
      baseline.leftHip = calculateJointAngle(lm[11], lm[23], lm[25], aspect)
    }
    if (areVisible(lm[12], lm[24], lm[26])) {
      baseline.rightHip = calculateJointAngle(lm[12], lm[24], lm[26], aspect)
    }
  }

  // Guardar Centro de Masa inicial calibrado
  baseline.comX = bodyState.centerPoint?.x ?? 0.5
  baseline.comY = bodyState.centerPoint?.y ?? 0.5

  // Resetear contadores
  metrics.maxLeftKneeROM = 0
  metrics.maxRightKneeROM = 0
  metrics.maxHipROM = 0
  metrics.comMaxSwayX = 0
  metrics.comMaxSwayY = 0
  metrics.steps = 0
  metrics.leftLegUp = false
  metrics.rightLegUp = false

  timeLeft.value = TEST_DURATION
  phase.value = 'running'

  clearInterval(timerInterval)
  timerInterval = setInterval(() => {
    if (timeLeft.value > 1) {
      timeLeft.value--
    } else {
      timeLeft.value = 0
      finishMeasurement()
    }
  }, 1000)
}

function finishMeasurement() {
  clearInterval(timerInterval)
  phase.value = 'finished'
}

function recalibrate() {
  clearInterval(timerInterval)
  phase.value = 'calibration'
}

// 2. Escuchar cada frame del esqueleto global de useCamera()
watch(
  () => bodyState.landmarks,
  (lm) => {
    if (phase.value !== 'running' || !lm || lm.length < 29) return

    const aspect = window.innerWidth / window.innerHeight || 16 / 9

    const lShoulder = lm[11]
    const rShoulder = lm[12]
    const lHip = lm[23]
    const rHip = lm[24]
    const lKnee = lm[25]
    const rKnee = lm[26]
    const lAnkle = lm[27]
    const rAnkle = lm[28]

    // A. Ángulos de rodillas y amplitud de movimiento (ROM)
    if (areVisible(lHip, lKnee, lAnkle)) {
      metrics.leftKneeAngle = calculateJointAngle(lHip, lKnee, lAnkle, aspect)
      const romLeft = Math.max(0, baseline.leftKnee - metrics.leftKneeAngle)
      if (romLeft > metrics.maxLeftKneeROM) metrics.maxLeftKneeROM = romLeft

      // Detección de paso pierna izquierda (umbral de flexión > 22° respecto a calibración)
      if (romLeft > 22 && !metrics.leftLegUp) {
        metrics.leftLegUp = true
        metrics.steps++
      } else if (romLeft < 12 && metrics.leftLegUp) {
        metrics.leftLegUp = false
      }
    }

    if (areVisible(rHip, rKnee, rAnkle)) {
      metrics.rightKneeAngle = calculateJointAngle(rHip, rKnee, rAnkle, aspect)
      const romRight = Math.max(0, baseline.rightKnee - metrics.rightKneeAngle)
      if (romRight > metrics.maxRightKneeROM) metrics.maxRightKneeROM = romRight

      // Detección de paso pierna derecha
      if (romRight > 22 && !metrics.rightLegUp) {
        metrics.rightLegUp = true
        metrics.steps++
      } else if (romRight < 12 && metrics.rightLegUp) {
        metrics.rightLegUp = false
      }
    }

    // B. Ángulos de cadera (elevación del muslo)
    if (areVisible(lShoulder, lHip, lKnee)) {
      metrics.leftHipAngle = calculateJointAngle(lShoulder, lHip, lKnee, aspect)
      const hipRomL = Math.max(0, baseline.leftHip - metrics.leftHipAngle)
      if (hipRomL > metrics.maxHipROM) metrics.maxHipROM = hipRomL
    }

    if (areVisible(rShoulder, rHip, rKnee)) {
      metrics.rightHipAngle = calculateJointAngle(rShoulder, rHip, rKnee, aspect)
      const hipRomR = Math.max(0, baseline.rightHip - metrics.rightHipAngle)
      if (hipRomR > metrics.maxHipROM) metrics.maxHipROM = hipRomR
    }

    // C. Centro de Masa / Gravedad (usando bodyState.centerPoint de useCamera)
    if (bodyState.centerPoint) {
      metrics.comX = Math.round(bodyState.centerPoint.x * 100)
      metrics.comY = Math.round(bodyState.centerPoint.y * 100)

      // Oscilación porcentual respecto a la posición calibrada
      const swayX = Math.round(Math.abs(bodyState.centerPoint.x - baseline.comX) * 100)
      const swayY = Math.round(Math.abs(bodyState.centerPoint.y - baseline.comY) * 100)
      if (swayX > metrics.comMaxSwayX) metrics.comMaxSwayX = swayX
      if (swayY > metrics.comMaxSwayY) metrics.comMaxSwayY = swayY
    }

    // D. Dibujar esqueleto de tren inferior, ángulos y Centro de Masa en pantalla
    drawBiomechanicalOverlay(lm)
  }
)

function drawBiomechanicalOverlay(lm) {
  const canvas = overlayCanvasRef.value
  if (!canvas) return

  if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
  }

  const ctx = canvas.getContext('2d')
  const w = canvas.width
  const h = canvas.height
  ctx.clearRect(0, 0, w, h)

  // Convertimos X normalizado a pantalla espejada (1 - x)
  const toScreen = (pt) => ({ x: (1 - pt.x) * w, y: pt.y * h })

  const pairs = [
    [23, 25], // Cadera izq -> Rodilla izq
    [25, 27], // Rodilla izq -> Tobillo izq
    [24, 26], // Cadera der -> Rodilla der
    [26, 28], // Rodilla der -> Tobillo der
    [23, 24], // Cintura / Pelvis
  ]

  // Líneas del esqueleto inferior
  ctx.strokeStyle = '#22c55e'
  ctx.lineWidth = 5
  ctx.lineCap = 'round'
  for (const [i, j] of pairs) {
    if (areVisible(lm[i], lm[j])) {
      const a = toScreen(lm[i])
      const b = toScreen(lm[j])
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.stroke()
    }
  }

  // Nodos articulares y etiquetas de grados junto a las rodillas
  const joints = [
    { idx: 25, label: `${metrics.leftKneeAngle}°` },
    { idx: 26, label: `${metrics.rightKneeAngle}°` },
    { idx: 23, label: `${metrics.leftHipAngle}°` },
    { idx: 24, label: `${metrics.rightHipAngle}°` },
  ]

  ctx.font = 'bold 16px sans-serif'
  for (const joint of joints) {
    const pt = lm[joint.idx]
    if (areVisible(pt)) {
      const s = toScreen(pt)
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(s.x, s.y, 7, 0, Math.PI * 2)
      ctx.fill()

      ctx.fillStyle = '#0f172a'
      ctx.fillRect(s.x + 10, s.y - 14, 54, 24)
      ctx.fillStyle = '#22c55e'
      ctx.fillText(joint.label, s.x + 15, s.y + 3)
    }
  }

  // Punto de Centro de Masa (CoM)
  if (bodyState.centerPoint) {
    const comScreen = toScreen(bodyState.centerPoint)
    ctx.strokeStyle = '#f59e0b'
    ctx.fillStyle = 'rgba(245, 158, 11, 0.85)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(comScreen.x, comScreen.y, 11, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()

    ctx.fillStyle = '#fef3c7'
    ctx.fillText('CoM', comScreen.x - 16, comScreen.y - 16)
  }
}

onBeforeUnmount(() => {
  clearInterval(timerInterval)
})
</script>

<template>
  <!-- FASE 1: Reutilización directa de la silueta de calibración del sistema -->
  <MotrizCalibrationView
    v-if="phase === 'calibration'"
    @start-play="handleStartAfterCalibration"
    @exit="$emit('exit')"
  />

  <!-- FASE 2 y 3: Medición en vivo sobre la cámara global y resumen final -->
  <div v-else class="walk-hud-layer">
    <!-- Canvas transparente con el esqueleto inferior, ángulos y CoM -->
    <canvas v-if="phase === 'running'" ref="overlayCanvasRef" class="skeleton-canvas"></canvas>

    <!-- Barra superior compacta -->
    <div class="hud-top-bar">
      <div class="timer-chip" :class="{ urgent: timeLeft <= 5 }">
        ⏱️ {{ timeLeft }}s
      </div>

      <div class="status-chip">
        {{ bodyDetected ? '🟢 Esqueleto rastreado' : '🟡 Mantente de cuerpo completo' }}
      </div>

      <button type="button" class="btn-motriz-secondary btn-sm" @click="recalibrate">
        Recalibrar
      </button>
    </div>

    <!-- Tarjetas de las 4 métricas solicitadas -->
    <div v-if="phase === 'running'" class="hud-metrics-row">
      <!-- 1. Intensidad -->
      <div class="hud-card">
        <span class="hud-label">Intensidad</span>
        <strong class="hud-value" :style="{ color: intensityLevel.color }">
          {{ intensityLevel.label }}
        </strong>
        <span class="hud-sub">{{ metrics.steps }} pasos ({{ cadencePerMin }} pasos/min)</span>
      </div>

      <!-- 2. Ángulos Articulares -->
      <div class="hud-card">
        <span class="hud-label">Ángulos Rodilla (I / D)</span>
        <strong class="hud-value">{{ metrics.leftKneeAngle }}° / {{ metrics.rightKneeAngle }}°</strong>
        <span class="hud-sub">Cadera: {{ metrics.leftHipAngle }}° / {{ metrics.rightHipAngle }}°</span>
      </div>

      <!-- 3. Amplitud de Movimiento (ROM) -->
      <div class="hud-card">
        <span class="hud-label">Amplitud Max (ROM)</span>
        <strong class="hud-value">{{ averageMaxROM }}°</strong>
        <span class="hud-sub">Izq: {{ metrics.maxLeftKneeROM }}° • Der: {{ metrics.maxRightKneeROM }}°</span>
      </div>

      <!-- 4. Centro de Gravedad / Masa -->
      <div class="hud-card">
        <span class="hud-label">Centro de Masa (CoM)</span>
        <strong class="hud-value">X:{{ metrics.comX }}% Y:{{ metrics.comY }}%</strong>
        <span class="hud-sub">Oscilación: ±{{ metrics.comMaxSwayX }}% H / ±{{ metrics.comMaxSwayY }}% V</span>
      </div>
    </div>

    <!-- FASE 3: Resumen final al terminar los 30s -->
    <div v-if="phase === 'finished'" class="summary-backdrop">
      <div class="motriz-card summary-card">
        <h2>Resultados Caminata Lenta ({{ TEST_DURATION }}s)</h2>

        <div class="summary-grid">
          <div class="summary-item">
            <span>Intensidad y Pasos</span>
            <strong>{{ intensityLevel.label }} — {{ metrics.steps }} pasos ({{ cadencePerMin }}/min)</strong>
          </div>
          <div class="summary-item">
            <span>Amplitud de Movimiento (Rodillas)</span>
            <strong>Izq: {{ metrics.maxLeftKneeROM }}° | Der: {{ metrics.maxRightKneeROM }}°</strong>
          </div>
          <div class="summary-item">
            <span>Amplitud de Cadera</span>
            <strong>Máx. elevación: {{ metrics.maxHipROM }}°</strong>
          </div>
          <div class="summary-item">
            <span>Estabilidad Centro de Gravedad</span>
            <strong>Oscilación lateral ±{{ metrics.comMaxSwayX }}% • vertical ±{{ metrics.comMaxSwayY }}%</strong>
          </div>
        </div>

        <div class="summary-actions">
          <button type="button" class="btn-motriz-secondary" @click="recalibrate">
            Repetir Prueba
          </button>
          <button type="button" class="btn-motriz-primary" @click="$emit('finish')">
            Volver a Zona de Pruebas
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.walk-hud-layer {
  position: relative;
  width: 100%;
  height: calc(100vh - 88px);
  z-index: 10;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 18px 28px;
  box-sizing: border-box;
  pointer-events: none;
}

.walk-hud-layer button,
.summary-backdrop {
  pointer-events: auto;
}

.skeleton-canvas {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  pointer-events: none;
  z-index: 4;
}

.hud-top-bar {
  position: relative;
  z-index: 12;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.timer-chip {
  background: rgba(15, 23, 42, 0.9);
  color: #22c55e;
  border: 2px solid #22c55e;
  padding: 8px 20px;
  border-radius: 9999px;
  font-size: 1.35rem;
  font-weight: 900;
}

.timer-chip.urgent {
  color: #ef4444;
  border-color: #ef4444;
}

.status-chip {
  background: rgba(255, 253, 249, 0.92);
  color: var(--motriz-text-main);
  padding: 8px 18px;
  border-radius: 9999px;
  font-weight: 700;
  font-size: 0.95rem;
  border: 2px solid #e2d2c1;
}

.btn-sm {
  padding: 8px 16px;
  font-size: 0.95rem;
}

.hud-metrics-row {
  position: relative;
  z-index: 12;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
}

.hud-card {
  background: rgba(15, 23, 42, 0.86);
  backdrop-filter: blur(10px);
  border: 2px solid rgba(255, 255, 255, 0.16);
  border-radius: 18px;
  padding: 14px 16px;
  color: #ffffff;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.hud-label {
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #cbd5e1;
  font-weight: 700;
}

.hud-value {
  font-size: 1.45rem;
  font-weight: 900;
  color: #22c55e;
}

.hud-sub {
  font-size: 0.82rem;
  color: #94a3b8;
}

.summary-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.72);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 30;
  padding: 20px;
}

.summary-card {
  background: #fffdf9;
  max-width: 560px;
  width: 100%;
  padding: 28px;
  text-align: center;
}

.summary-card h2 {
  margin: 0 0 18px;
  color: var(--motriz-red-primary);
  font-size: 1.55rem;
}

.summary-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
  text-align: left;
  margin-bottom: 24px;
}

.summary-item {
  background: #fff5ea;
  border: 1.5px solid #e2d2c1;
  border-radius: 14px;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.summary-item span {
  font-size: 0.85rem;
  color: var(--motriz-text-muted);
  font-weight: 700;
}

.summary-item strong {
  font-size: 1.05rem;
  color: var(--motriz-text-main);
}

.summary-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

@media (max-width: 960px) {
  .hud-metrics-row {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>