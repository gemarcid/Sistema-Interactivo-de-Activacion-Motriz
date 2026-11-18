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

// Canvas transparente para dibujar el esqueleto completo, torso, ángulos y Centro de Masa
const overlayCanvasRef = ref(null)

// Línea base guardada al terminar la calibración
const baseline = reactive({
  // Tren inferior
  leftKnee: 175,
  rightKnee: 175,
  leftHip: 175,
  rightHip: 175,
  // Tren superior
  leftShoulder: 15,
  rightShoulder: 15,
  leftElbow: 170,
  rightElbow: 170,
  // Torso y Centro de masa
  torsoLength: 0.28,
  comX: 0.5,
  comY: 0.5,
})

// Métricas biomecánicas en tiempo real
const metrics = reactive({
  // Ángulos actuales tren inferior (grados)
  leftKneeAngle: 180,
  rightKneeAngle: 180,
  leftHipAngle: 180,
  rightHipAngle: 180,

  // Ángulos actuales tren superior (grados)
  leftShoulderAngle: 15,
  rightShoulderAngle: 15,
  leftElbowAngle: 175,
  rightElbowAngle: 175,

  // Torso y postura (encogimiento + verticalidad)
  torsoHeightPct: 100,      // 100% = misma altura calibrada; <92% = encogimiento por fatiga
  minTorsoHeightPct: 100,   // Mínimo alcanzado en la prueba
  trunkTiltAngle: 0,        // Desviación lateral en grados respecto a la vertical (0° = recto)
  maxTrunkTiltAngle: 0,     // Máxima inclinación lateral registrada

  // Amplitud de movimiento tren inferior (ROM)
  maxLeftKneeROM: 0,
  maxRightKneeROM: 0,
  maxHipROM: 0,

  // Amplitud de movimiento tren superior (ROM)
  maxLeftShoulderROM: 0,
  maxRightShoulderROM: 0,
  maxLeftElbowROM: 0,
  maxRightElbowROM: 0,

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
const averageKneeROM = computed(() => {
  return Math.round((metrics.maxLeftKneeROM + metrics.maxRightKneeROM) / 2)
})

const averageShoulderROM = computed(() => {
  return Math.round((metrics.maxLeftShoulderROM + metrics.maxRightShoulderROM) / 2)
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

// Estado postural del torso en vivo
const torsoStatus = computed(() => {
  const shrunk = metrics.torsoHeightPct < 90
  const tilted = metrics.trunkTiltAngle > 10
  if (shrunk && tilted) return { label: 'Encogido e inclinado', color: '#ef4444', alert: true }
  if (shrunk) return { label: 'Encogimiento (Fatiga)', color: '#f59e0b', alert: true }
  if (tilted) return { label: 'Inclinado lateralmente', color: '#f59e0b', alert: true }
  return { label: 'Recto (Postura óptima)', color: '#22c55e', alert: false }
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

  if (lm && lm.length >= 29) {
    // Tren inferior
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

    // Tren superior
    if (areVisible(lm[23], lm[11], lm[13])) {
      baseline.leftShoulder = calculateJointAngle(lm[23], lm[11], lm[13], aspect)
    }
    if (areVisible(lm[24], lm[12], lm[14])) {
      baseline.rightShoulder = calculateJointAngle(lm[24], lm[12], lm[14], aspect)
    }
    if (areVisible(lm[11], lm[13], lm[15])) {
      baseline.leftElbow = calculateJointAngle(lm[11], lm[13], lm[15], aspect)
    }
    if (areVisible(lm[12], lm[14], lm[16])) {
      baseline.rightElbow = calculateJointAngle(lm[12], lm[14], lm[16], aspect)
    }

    // Longitud vertical calibrada del torso (punto medio hombros -> punto medio caderas)
    if (areVisible(lm[11], lm[12], lm[23], lm[24])) {
      const shoulderMidY = (lm[11].y + lm[12].y) / 2
      const hipMidY = (lm[23].y + lm[24].y) / 2
      const initialTorso = hipMidY - shoulderMidY
      if (initialTorso > 0.05) {
        baseline.torsoLength = initialTorso
      }
    }
  }

  // Guardar Centro de Masa inicial calibrado
  baseline.comX = bodyState.centerPoint?.x ?? 0.5
  baseline.comY = bodyState.centerPoint?.y ?? 0.5

  // Resetear contadores
  metrics.torsoHeightPct = 100
  metrics.minTorsoHeightPct = 100
  metrics.trunkTiltAngle = 0
  metrics.maxTrunkTiltAngle = 0

  metrics.maxLeftKneeROM = 0
  metrics.maxRightKneeROM = 0
  metrics.maxHipROM = 0
  metrics.maxLeftShoulderROM = 0
  metrics.maxRightShoulderROM = 0
  metrics.maxLeftElbowROM = 0
  metrics.maxRightElbowROM = 0
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

    // Landmarks tren superior
    const lShoulder = lm[11]
    const rShoulder = lm[12]
    const lElbow = lm[13]
    const rElbow = lm[14]
    const lWrist = lm[15]
    const rWrist = lm[16]

    // Landmarks tren inferior
    const lHip = lm[23]
    const rHip = lm[24]
    const lKnee = lm[25]
    const rKnee = lm[26]
    const lAnkle = lm[27]
    const rAnkle = lm[28]

    // --- A. TORSO: Encogimiento (altura vertical) e Inclinación (rectitud) ---
    if (areVisible(lShoulder, rShoulder, lHip, rHip)) {
      const sMidX = (lShoulder.x + rShoulder.x) / 2
      const sMidY = (lShoulder.y + rShoulder.y) / 2
      const hMidX = (lHip.x + rHip.x) / 2
      const hMidY = (lHip.y + rHip.y) / 2

      // 1. Porcentaje de altura del torso respecto a la calibración inicial
      const currentTorsoHeight = Math.max(0.01, hMidY - sMidY)
      const pct = Math.min(115, Math.round((currentTorsoHeight / baseline.torsoLength) * 100))
      metrics.torsoHeightPct = pct
      if (pct < metrics.minTorsoHeightPct) {
        metrics.minTorsoHeightPct = pct
      }

      // 2. Ángulo de inclinación lateral respecto al eje vertical (0° = completamente recto)
      const dx = Math.abs(sMidX - hMidX) * aspect
      const dy = Math.max(0.01, hMidY - sMidY)
      const tiltDeg = Math.round((Math.atan2(dx, dy) * 180.0) / Math.PI)
      metrics.trunkTiltAngle = tiltDeg
      if (tiltDeg > metrics.maxTrunkTiltAngle) {
        metrics.maxTrunkTiltAngle = tiltDeg
      }
    }

    // --- B. TREN INFERIOR: Rodillas, Caderas y Pasos ---
    if (areVisible(lHip, lKnee, lAnkle)) {
      metrics.leftKneeAngle = calculateJointAngle(lHip, lKnee, lAnkle, aspect)
      const romLeft = Math.max(0, baseline.leftKnee - metrics.leftKneeAngle)
      if (romLeft > metrics.maxLeftKneeROM) metrics.maxLeftKneeROM = romLeft

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

      if (romRight > 22 && !metrics.rightLegUp) {
        metrics.rightLegUp = true
        metrics.steps++
      } else if (romRight < 12 && metrics.rightLegUp) {
        metrics.rightLegUp = false
      }
    }

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

    // --- C. TREN SUPERIOR: Hombros (Braceo) y Codos ---
    if (areVisible(lHip, lShoulder, lElbow)) {
      metrics.leftShoulderAngle = calculateJointAngle(lHip, lShoulder, lElbow, aspect)
      const shoulderRomL = Math.abs(metrics.leftShoulderAngle - baseline.leftShoulder)
      if (shoulderRomL > metrics.maxLeftShoulderROM) metrics.maxLeftShoulderROM = shoulderRomL
    }

    if (areVisible(rHip, rShoulder, rElbow)) {
      metrics.rightShoulderAngle = calculateJointAngle(rHip, rShoulder, rElbow, aspect)
      const shoulderRomR = Math.abs(metrics.rightShoulderAngle - baseline.rightShoulder)
      if (shoulderRomR > metrics.maxRightShoulderROM) metrics.maxRightShoulderROM = shoulderRomR
    }

    if (areVisible(lShoulder, lElbow, lWrist)) {
      metrics.leftElbowAngle = calculateJointAngle(lShoulder, lElbow, lWrist, aspect)
      const elbowRomL = Math.max(0, baseline.leftElbow - metrics.leftElbowAngle)
      if (elbowRomL > metrics.maxLeftElbowROM) metrics.maxLeftElbowROM = elbowRomL
    }

    if (areVisible(rShoulder, rElbow, rWrist)) {
      metrics.rightElbowAngle = calculateJointAngle(rShoulder, rElbow, rWrist, aspect)
      const elbowRomR = Math.max(0, baseline.rightElbow - metrics.rightElbowAngle)
      if (elbowRomR > metrics.maxRightElbowROM) metrics.maxRightElbowROM = elbowRomR
    }

    // --- D. CENTRO DE MASA / GRAVEDAD ---
    if (bodyState.centerPoint) {
      metrics.comX = Math.round(bodyState.centerPoint.x * 100)
      metrics.comY = Math.round(bodyState.centerPoint.y * 100)

      const swayX = Math.round(Math.abs(bodyState.centerPoint.x - baseline.comX) * 100)
      const swayY = Math.round(Math.abs(bodyState.centerPoint.y - baseline.comY) * 100)
      if (swayX > metrics.comMaxSwayX) metrics.comMaxSwayX = swayX
      if (swayY > metrics.comMaxSwayY) metrics.comMaxSwayY = swayY
    }

    // --- E. DIBUJAR ESQUELETO COMPLETO, EJE DEL TORSO, ÁNGULOS Y CoM ---
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

  const toScreen = (pt) => ({ x: (1 - pt.x) * w, y: pt.y * h })

  const lowerPairs = [
    [23, 25], // Cadera izq -> Rodilla izq
    [25, 27], // Rodilla izq -> Tobillo izq
    [24, 26], // Cadera der -> Rodilla der
    [26, 28], // Rodilla der -> Tobillo der
    [23, 24], // Pelvis
  ]

  const upperPairs = [
    [11, 12], // Hombros
    [11, 23], // Costado izquierdo
    [12, 24], // Costado derecho
    [11, 13], // Hombro izq -> Codo izq
    [13, 15], // Codo izq -> Muñeca izq
    [12, 14], // Hombro der -> Codo der
    [14, 16], // Codo der -> Muñeca der
  ]

  ctx.lineWidth = 5
  ctx.lineCap = 'round'

  // 1. Líneas del tren inferior (Verde)
  ctx.strokeStyle = '#22c55e'
  for (const [i, j] of lowerPairs) {
    if (areVisible(lm[i], lm[j])) {
      const a = toScreen(lm[i])
      const b = toScreen(lm[j])
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.stroke()
    }
  }

  // 2. Líneas del tren superior (Celeste)
  ctx.strokeStyle = '#38bdf8'
  for (const [i, j] of upperPairs) {
    if (areVisible(lm[i], lm[j])) {
      const a = toScreen(lm[i])
      const b = toScreen(lm[j])
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.stroke()
    }
  }

  // 3. Eje central del Torso (Columna: punto medio caderas -> punto medio hombros)
  if (areVisible(lm[11], lm[12], lm[23], lm[24])) {
    const sMid = toScreen({
      x: (lm[11].x + lm[12].x) / 2,
      y: (lm[11].y + lm[12].y) / 2,
    })
    const hMid = toScreen({
      x: (lm[23].x + lm[24].x) / 2,
      y: (lm[23].y + lm[24].y) / 2,
    })

    ctx.save()
    ctx.strokeStyle = torsoStatus.value.color
    ctx.lineWidth = 6
    ctx.setLineDash([10, 6])
    ctx.beginPath()
    ctx.moveTo(hMid.x, hMid.y)
    ctx.lineTo(sMid.x, sMid.y)
    ctx.stroke()
    ctx.restore()

    // Etiqueta de altura de torso e inclinación en el centro del pecho
    const midTrunkX = (sMid.x + hMid.x) / 2
    const midTrunkY = (sMid.y + hMid.y) / 2
    ctx.font = 'bold 13px sans-serif'
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)'
    ctx.fillRect(midTrunkX - 54, midTrunkY - 26, 108, 22)
    ctx.fillStyle = torsoStatus.value.color
    ctx.fillText(`Torso ${metrics.torsoHeightPct}% • ${metrics.trunkTiltAngle}°`, midTrunkX - 48, midTrunkY - 11)
  }

  // 4. Nodos articulares y etiquetas de grados
  const joints = [
    // Tren superior
    { idx: 11, label: `${metrics.leftShoulderAngle}°`, color: '#38bdf8', side: 'left' },
    { idx: 12, label: `${metrics.rightShoulderAngle}°`, color: '#38bdf8', side: 'right' },
    { idx: 13, label: `${metrics.leftElbowAngle}°`, color: '#38bdf8', side: 'left' },
    { idx: 14, label: `${metrics.rightElbowAngle}°`, color: '#38bdf8', side: 'right' },
    // Tren inferior
    { idx: 23, label: `${metrics.leftHipAngle}°`, color: '#22c55e', side: 'left' },
    { idx: 24, label: `${metrics.rightHipAngle}°`, color: '#22c55e', side: 'right' },
    { idx: 25, label: `${metrics.leftKneeAngle}°`, color: '#22c55e', side: 'left' },
    { idx: 26, label: `${metrics.rightKneeAngle}°`, color: '#22c55e', side: 'right' },
  ]

  ctx.font = 'bold 14px sans-serif'
  for (const joint of joints) {
    const pt = lm[joint.idx]
    if (areVisible(pt)) {
      const s = toScreen(pt)
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(s.x, s.y, 6, 0, Math.PI * 2)
      ctx.fill()

      const boxWidth = 48
      const offsetX = joint.side === 'left' ? 10 : -(boxWidth + 10)

      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)'
      ctx.fillRect(s.x + offsetX, s.y - 12, boxWidth, 22)
      ctx.fillStyle = joint.color
      ctx.fillText(joint.label, s.x + offsetX + 6, s.y + 4)
    }
  }

  // 5. Punto de Centro de Masa (CoM)
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
    ctx.fillText('CoM', comScreen.x - 16, comScreen.y + 24)
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
    <!-- Canvas transparente con el esqueleto completo, eje del torso, ángulos y CoM -->
    <canvas v-if="phase === 'running'" ref="overlayCanvasRef" class="skeleton-canvas"></canvas>

    <!-- Barra superior compacta -->
    <div class="hud-top-bar">
      <div class="timer-chip" :class="{ urgent: timeLeft <= 5 }">
        ⏱️ {{ timeLeft }}s
      </div>

      <div class="status-chip">
        {{ bodyDetected ? '🟢 Esqueleto completo rastreado' : '🟡 Mantente de cuerpo completo' }}
      </div>

      <button type="button" class="btn-motriz-secondary btn-sm" @click="recalibrate">
        Recalibrar
      </button>
    </div>

    <!-- Tarjetas de métricas en vivo (Grilla 3x2: 6 dimensiones biomecánicas) -->
    <div v-if="phase === 'running'" class="hud-metrics-grid">
      <!-- 1. Intensidad -->
      <div class="hud-card">
        <span class="hud-label">1. Intensidad</span>
        <strong class="hud-value" :style="{ color: intensityLevel.color }">
          {{ intensityLevel.label }}
        </strong>
        <span class="hud-sub">{{ metrics.steps }} pasos ({{ cadencePerMin }} pasos/min)</span>
      </div>

      <!-- 2. Postura del Torso (Encogimiento y Verticalidad) -->
      <div class="hud-card" :class="{ 'card-alert': torsoStatus.alert }">
        <span class="hud-label">2. Postura y Torso</span>
        <strong class="hud-value" :style="{ color: torsoStatus.color }">
          {{ torsoStatus.label }}
        </strong>
        <span class="hud-sub">Altura torso: {{ metrics.torsoHeightPct }}% • Inclinación: {{ metrics.trunkTiltAngle }}°</span>
      </div>

      <!-- 3. Ángulos Tren Inferior -->
      <div class="hud-card">
        <span class="hud-label">3. Tren Inferior (I / D)</span>
        <strong class="hud-value">{{ metrics.leftKneeAngle }}° / {{ metrics.rightKneeAngle }}°</strong>
        <span class="hud-sub">Caderas: {{ metrics.leftHipAngle }}° / {{ metrics.rightHipAngle }}°</span>
      </div>

      <!-- 4. Ángulos Tren Superior -->
      <div class="hud-card card-upper">
        <span class="hud-label">4. Tren Superior (I / D)</span>
        <strong class="hud-value text-upper">{{ metrics.leftShoulderAngle }}° / {{ metrics.rightShoulderAngle }}°</strong>
        <span class="hud-sub">Codos: {{ metrics.leftElbowAngle }}° / {{ metrics.rightElbowAngle }}°</span>
      </div>

      <!-- 5. Amplitud de Movimiento (ROM) -->
      <div class="hud-card">
        <span class="hud-label">5. Amplitud Max (ROM)</span>
        <strong class="hud-value">Pierna {{ averageKneeROM }}°</strong>
        <span class="hud-sub">Braceo hombro: {{ averageShoulderROM }}°</span>
      </div>

      <!-- 6. Centro de Gravedad / Masa -->
      <div class="hud-card">
        <span class="hud-label">6. Centro de Masa (CoM)</span>
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
            <span>1. Intensidad y Pasos</span>
            <strong>{{ intensityLevel.label }} — {{ metrics.steps }} pasos ({{ cadencePerMin }}/min)</strong>
          </div>
          <div class="summary-item">
            <span>2. Postura del Torso y Fatiga (Verticalidad)</span>
            <strong>
              Altura torso mínima: {{ metrics.minTorsoHeightPct }}% (encogimiento {{ Math.max(0, 100 - metrics.minTorsoHeightPct) }}%) • Inclinación máx: {{ metrics.maxTrunkTiltAngle }}°
            </strong>
          </div>
          <div class="summary-item">
            <span>3. Amplitud Tren Inferior (Rodillas y Cadera)</span>
            <strong>Rodillas: Izq {{ metrics.maxLeftKneeROM }}° | Der {{ metrics.maxRightKneeROM }}° • Cadera: {{ metrics.maxHipROM }}°</strong>
          </div>
          <div class="summary-item">
            <span>4. Amplitud Tren Superior (Braceo y Codos)</span>
            <strong>Hombros: Izq {{ metrics.maxLeftShoulderROM }}° | Der {{ metrics.maxRightShoulderROM }}° • Codos: Izq {{ metrics.maxLeftElbowROM }}° | Der {{ metrics.maxRightElbowROM }}°</strong>
          </div>
          <div class="summary-item">
            <span>5. Estabilidad Centro de Gravedad</span>
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
  padding: 16px 26px;
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

.hud-metrics-grid {
  position: relative;
  z-index: 12;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.hud-card {
  background: rgba(15, 23, 42, 0.86);
  backdrop-filter: blur(10px);
  border: 2px solid rgba(255, 255, 255, 0.16);
  border-radius: 16px;
  padding: 10px 14px;
  color: #ffffff;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.card-upper {
  border-color: rgba(56, 189, 248, 0.45);
}

.card-alert {
  border-color: #f59e0b;
  box-shadow: 0 0 16px rgba(245, 158, 11, 0.3);
}

.hud-label {
  font-size: 0.74rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #cbd5e1;
  font-weight: 700;
}

.hud-value {
  font-size: 1.25rem;
  font-weight: 900;
  color: #22c55e;
}

.text-upper {
  color: #38bdf8;
}

.hud-sub {
  font-size: 0.78rem;
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
  max-width: 600px;
  width: 100%;
  padding: 26px;
  text-align: center;
  max-height: 90vh;
  overflow-y: auto;
}

.summary-card h2 {
  margin: 0 0 16px;
  color: var(--motriz-red-primary);
  font-size: 1.5rem;
}

.summary-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
  text-align: left;
  margin-bottom: 20px;
}

.summary-item {
  background: #fff5ea;
  border: 1.5px solid #e2d2c1;
  border-radius: 14px;
  padding: 10px 14px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.summary-item span {
  font-size: 0.82rem;
  color: var(--motriz-text-muted);
  font-weight: 700;
}

.summary-item strong {
  font-size: 0.98rem;
  color: var(--motriz-text-main);
}

.summary-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

@media (max-width: 960px) {
  .hud-metrics-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>