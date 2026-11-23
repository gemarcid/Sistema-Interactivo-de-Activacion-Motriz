<script setup>
import { onMounted, onBeforeUnmount, ref, computed } from 'vue'
import { useCamera } from '../../composables/useCamera'
import { useProfiles } from '../../composables/useProfiles'
import { playClickTone, playSelectTone, playSuccessChime } from '../../composables/useAudio'

const props = defineProps({
  mode: {
    type: String,
    default: 'full', // 'full' | 'lower-body' | 'upper-body'
  },
  title: {
    type: String,
    default: '¡Prepárate!',
  },
  leadText: {
    type: String,
    default: '',
  },
  buttonText: {
    type: String,
    default: 'Comenzar',
  },
  startStatus: {
    type: String,
    default: '',
  },
  customTips: {
    type: Array,
    default: null,
  },
})

const emit = defineEmits(['start-play', 'exit'])

const canvasRef = ref(null)
let animId = null
let hasChimedSuccess = false

const {
  isAligned,
  alignmentScore,
  bodyDetected,
  bodyState,
} = useCamera()

const { activeProfile, isLeftHanded, isRightHanded } = useProfiles()

const alignmentFeedback = computed(() => {
  if (props.mode === 'lower-body') {
    if (isAligned.value) return '¡Excelente! Caderas y piernas calibradas para caminar.'
    if (bodyDetected.value) return 'Asegúrate de que tus piernas y pies estén dentro de la guía.'
    return 'Párate frente a la cámara mostrando tus piernas y pies.'
  }
  if (props.mode === 'upper-body' || props.mode === 'math-order') {
    if (isAligned.value) return '¡Excelente! Torso y brazos calibrados para las posturas.'
    if (bodyDetected.value) return 'Coloca tu torso y brazos dentro de la silueta.'
    return 'Párate mostrando tu torso y brazos frente a la pantalla.'
  }
  if (isAligned.value) return '¡Excelente! Estás centrado y calibrado.'
  if (bodyDetected.value) return 'Colócate dentro de la silueta para calibrar tu postura.'
  return 'Párate de cuerpo completo frente a la cámara.'
})

onMounted(() => {
  resizeCanvas()
  window.addEventListener('resize', resizeCanvas)
  startRenderLoop()
})

onBeforeUnmount(() => {
  if (animId) cancelAnimationFrame(animId)
  window.removeEventListener('resize', resizeCanvas)
})

function resizeCanvas() {
  if (!canvasRef.value) return
  canvasRef.value.width = window.innerWidth
  canvasRef.value.height = window.innerHeight
}

function startRenderLoop() {
  const loop = () => {
    const canvas = canvasRef.value
    if (canvas) {
      const ctx = canvas.getContext('2d')
      const w = canvas.width
      const h = canvas.height
      ctx.clearRect(0, 0, w, h)

      // Play success chime once when user gets fully aligned
      if (isAligned.value && !hasChimedSuccess) {
        hasChimedSuccess = true
        playSuccessChime()
      } else if (!isAligned.value) {
        hasChimedSuccess = false
      }

      drawCalibrationSilhouette(ctx, w, h, isAligned.value, bodyDetected.value)
    }
    animId = requestAnimationFrame(loop)
  }
  animId = requestAnimationFrame(loop)
}

function drawCalibrationSilhouette(ctx, width, height, aligned, detected) {
  ctx.save()
  const strokeColor = aligned
    ? 'rgba(34, 197, 94, 0.95)' // glowing green
    : detected
    ? 'rgba(245, 158, 11, 0.9)' // warm amber
    : 'rgba(255, 255, 255, 0.85)' // clean white dashed

  ctx.strokeStyle = strokeColor
  ctx.lineWidth = 4
  ctx.setLineDash([14, 12])
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  if (aligned) {
    ctx.shadowColor = 'rgba(34, 197, 94, 0.85)'
    ctx.shadowBlur = 24
  }

  // Desplazamiento ergonómico de la silueta:
  // Si es zurdo, la silueta se desplaza a la derecha (cx = 0.58) para dejar la columna de botones a la izquierda.
  // Si es diestro, la silueta se desplaza a la izquierda (cx = 0.42) dejando los botones a la derecha.
  const cx = isLeftHanded.value ? width * 0.58 : width * 0.42
  const headRadius = height * 0.08
  const headCy = height * 0.22
  const shoulderY = headCy + headRadius + height * 0.04
  const hipY = shoulderY + height * 0.28
  const hipWidth = width * 0.12
  const armSpan = width * 0.22

  if (props.mode === 'upper-body' || props.mode === 'math-order') {
    // ========================================================
    // MODO TREN SUPERIOR: SOLO DE LA CINTURA PARA ARRIBA
    // ========================================================
    // 1. Cabeza
    ctx.beginPath()
    ctx.arc(cx, headCy, headRadius, 0, Math.PI * 2)
    ctx.stroke()

    // 2. Hombros y Brazos Activos
    ctx.beginPath()
    ctx.moveTo(cx - armSpan, shoulderY + 18)
    ctx.lineTo(cx - width * 0.07, shoulderY)
    ctx.lineTo(cx, shoulderY - 8)
    ctx.lineTo(cx + width * 0.07, shoulderY)
    ctx.lineTo(cx + armSpan, shoulderY + 18)
    ctx.stroke()

    // Círculos de manos en los extremos de los brazos
    ctx.beginPath()
    ctx.arc(cx - armSpan, shoulderY + 18, 15, 0, Math.PI * 2)
    ctx.arc(cx + armSpan, shoulderY + 18, 15, 0, Math.PI * 2)
    ctx.stroke()

    // 3. Torso superior hasta la cintura
    ctx.beginPath()
    ctx.moveTo(cx - width * 0.06, shoulderY)
    ctx.lineTo(cx - hipWidth * 0.5, hipY)
    // Base de la cintura (arco sutil que delimita la cintura hacia arriba)
    ctx.quadraticCurveTo(cx, hipY + 16, cx + hipWidth * 0.5, hipY)
    ctx.lineTo(cx + width * 0.06, shoulderY)
    ctx.stroke()

    // 4. Diana / Crosshair en el centro del pecho
    const chestCy = (shoulderY + hipY) / 2
    ctx.setLineDash([])
    ctx.strokeStyle = aligned ? 'rgba(34, 197, 94, 0.85)' : 'rgba(245, 158, 11, 0.7)'
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.arc(cx, chestCy, 20, 0, Math.PI * 2)
    ctx.moveTo(cx - 30, chestCy)
    ctx.lineTo(cx + 30, chestCy)
    ctx.moveTo(cx, chestCy - 30)
    ctx.lineTo(cx, chestCy + 30)
    ctx.stroke()

    // Etiqueta delimitadora de la cintura
    ctx.font = 'bold 12px sans-serif'
    ctx.fillStyle = aligned ? 'rgba(34, 197, 94, 0.95)' : 'rgba(255, 255, 255, 0.8)'
    ctx.textAlign = 'center'
    ctx.fillText('── Límite Cintura (Tren Superior) ──', cx, hipY + 34)

  } else if (props.mode === 'lower-body') {
    // ========================================================
    // MODO CAMINATA TEST: PRINCIPALMENTE DE LA CINTURA PARA ABAJO
    // ========================================================
    // 1. Tren superior atenuado/sutil (referencia suave)
    ctx.save()
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.24)'
    ctx.lineWidth = 2
    ctx.setLineDash([8, 8])

    // Cabeza suave
    ctx.beginPath()
    ctx.arc(cx, headCy, headRadius * 0.85, 0, Math.PI * 2)
    ctx.stroke()

    // Torso superior suave
    ctx.beginPath()
    ctx.moveTo(cx - width * 0.05, shoulderY)
    ctx.lineTo(cx - hipWidth * 0.45, hipY)
    ctx.lineTo(cx + hipWidth * 0.45, hipY)
    ctx.lineTo(cx + width * 0.05, shoulderY)
    ctx.stroke()
    ctx.restore()

    // 2. Cintura y Pelvis Fuerte y Destacada
    ctx.save()
    ctx.strokeStyle = strokeColor
    ctx.lineWidth = 5
    ctx.setLineDash([])
    if (aligned) {
      ctx.shadowColor = 'rgba(34, 197, 94, 0.9)'
      ctx.shadowBlur = 24
    }

    ctx.beginPath()
    ctx.moveTo(cx - hipWidth * 0.55, hipY)
    ctx.lineTo(cx + hipWidth * 0.55, hipY)
    ctx.stroke()
    ctx.restore()

    // 3. Piernas y Rodillas Resaltadas (Grosor 6px, trazo principal)
    ctx.save()
    ctx.strokeStyle = strokeColor
    ctx.lineWidth = 6
    ctx.setLineDash([12, 10])
    if (aligned) {
      ctx.shadowColor = 'rgba(34, 197, 94, 0.95)'
      ctx.shadowBlur = 26
    }

    const kneeY = height * 0.72
    const ankleY = height * 0.88
    const footY = height * 0.92

    // Pierna Izquierda
    ctx.beginPath()
    ctx.moveTo(cx - hipWidth * 0.45, hipY)
    ctx.lineTo(cx - hipWidth * 0.5, kneeY)
    ctx.lineTo(cx - hipWidth * 0.5, ankleY)
    ctx.stroke()

    // Pierna Derecha
    ctx.beginPath()
    ctx.moveTo(cx + hipWidth * 0.45, hipY)
    ctx.lineTo(cx + hipWidth * 0.5, kneeY)
    ctx.lineTo(cx + hipWidth * 0.5, ankleY)
    ctx.stroke()

    // Marcadores de rodillas destacados
    ctx.setLineDash([])
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(cx - hipWidth * 0.5, kneeY, 15, 0, Math.PI * 2)
    ctx.arc(cx + hipWidth * 0.5, kneeY, 15, 0, Math.PI * 2)
    ctx.stroke()

    // 4. Pisadas / Huellas de apoyo en el suelo
    ctx.lineWidth = 4
    // Huella pie izquierdo
    ctx.beginPath()
    ctx.ellipse(cx - hipWidth * 0.5, footY, 32, 12, 0, 0, Math.PI * 2)
    ctx.stroke()

    // Huella pie derecho
    ctx.beginPath()
    ctx.ellipse(cx + hipWidth * 0.5, footY, 32, 12, 0, 0, Math.PI * 2)
    ctx.stroke()

    ctx.restore()

    // 5. Diana / Crosshair en el Centro de Gravedad (Caderas)
    ctx.setLineDash([])
    ctx.strokeStyle = aligned ? 'rgba(34, 197, 94, 0.85)' : 'rgba(245, 158, 11, 0.7)'
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.arc(cx, hipY + 12, 22, 0, Math.PI * 2)
    ctx.moveTo(cx - 32, hipY + 12)
    ctx.lineTo(cx + 32, hipY + 12)
    ctx.moveTo(cx, hipY - 20)
    ctx.lineTo(cx, hipY + 44)
    ctx.stroke()

    // Etiqueta destacada de enfoque en piernas
    ctx.font = 'bold 13px sans-serif'
    ctx.fillStyle = aligned ? 'rgba(34, 197, 94, 0.95)' : 'rgba(255, 255, 255, 0.85)'
    ctx.textAlign = 'center'
    ctx.fillText('▲ Enfoque en Cintura y Piernas (Caminata)', cx, hipY - 14)

  } else {
    // ========================================================
    // MODO CUERPO COMPLETO (FULL)
    // ========================================================
    // 1. Head circle
    ctx.beginPath()
    ctx.arc(cx, headCy, headRadius, 0, Math.PI * 2)
    ctx.stroke()

    // 2. Torso and Outstretched Arms
    ctx.beginPath()
    ctx.moveTo(cx - armSpan, shoulderY + 12)
    ctx.lineTo(cx - width * 0.07, shoulderY)
    ctx.lineTo(cx, shoulderY - 8)
    ctx.lineTo(cx + width * 0.07, shoulderY)
    ctx.lineTo(cx + armSpan, shoulderY + 12)
    ctx.stroke()

    // Torso box
    ctx.beginPath()
    ctx.moveTo(cx - width * 0.06, shoulderY)
    ctx.lineTo(cx - hipWidth * 0.5, hipY)
    ctx.lineTo(cx + hipWidth * 0.5, hipY)
    ctx.lineTo(cx + width * 0.06, shoulderY)
    ctx.stroke()

    // Left Leg
    ctx.beginPath()
    ctx.moveTo(cx - hipWidth * 0.4, hipY)
    ctx.lineTo(cx - hipWidth * 0.5, height * 0.72)
    ctx.lineTo(cx - hipWidth * 0.5, height * 0.9)
    ctx.stroke()

    // Right Leg
    ctx.beginPath()
    ctx.moveTo(cx + hipWidth * 0.4, hipY)
    ctx.lineTo(cx + hipWidth * 0.5, height * 0.72)
    ctx.lineTo(cx + hipWidth * 0.5, height * 0.9)
    ctx.stroke()

    // Center target crosshair
    const centerCy = (shoulderY + hipY) / 2
    ctx.setLineDash([])
    ctx.strokeStyle = aligned ? 'rgba(34, 197, 94, 0.85)' : 'rgba(245, 158, 11, 0.7)'
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.arc(cx, centerCy, 20, 0, Math.PI * 2)
    ctx.moveTo(cx - 30, centerCy)
    ctx.lineTo(cx + 30, centerCy)
    ctx.moveTo(cx, centerCy - 30)
    ctx.lineTo(cx, centerCy + 30)
    ctx.stroke()
  }

  ctx.restore()
}

function handleStart() {
  playSelectTone()
  emit('start-play')
}

function handleExit() {
  playClickTone()
  emit('exit')
}
</script>

<template>
  <div class="prep-screen-overlay">
    <!-- Dashed Silhouette Fullscreen Overlay Canvas -->
    <canvas ref="canvasRef" class="silhouette-canvas"></canvas>

    <div
      class="prep-ui-layout"
      :class="{ 'prep-handed-left': isLeftHanded, 'prep-handed-right': isRightHanded }"
    >
      <!-- Left / Center: Status Feedback -->
      <div class="prep-center-info">
        <div
          class="alignment-pill-badge"
          :class="{ 'badge-aligned': isAligned, 'badge-waiting': !isAligned }"
        >
          <span class="status-indicator-dot"></span>
          <span>{{ alignmentFeedback }}</span>
        </div>

        <div v-if="activeProfile" class="rf7-calibration-tag">
          <strong>Calibración Personalizada:</strong>
          <span>
            Estatura: {{ activeProfile.heightCm }} cm • Mano dominante:
            {{ isLeftHanded ? 'Izquierda (Botones a la izquierda)' : 'Derecha (Botones a la derecha)' }}
          </span>
        </div>
      </div>

      <!-- Advice Card + Actions (Se reposiciona a la izquierda o derecha según mano dominante) -->
      <div class="prep-dock-card">
        <div class="motriz-card advice-card">
          <div class="advice-header-row">
            <h2 class="advice-title">{{ title }}</h2>
            <button type="button" class="btn-motriz-secondary btn-mini-exit" @click="handleExit">
              ✕ Salir
            </button>
          </div>

          <!-- BOTÓN DE COMENZAR ARRIBA DEL TEXTO (Ergonomía motriz para no agacharse) -->
          <div class="advice-action-box top-action-box">
            <button
              type="button"
              class="btn-motriz-primary btn-commence"
              @click="handleStart"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
              <span>{{ buttonText }}</span>
            </button>
          </div>

          <p v-if="startStatus" class="advice-lead" role="status">{{ startStatus }}</p>

          <p class="advice-lead">
            {{ leadText || ('Colócate en el centro • Botón accesible para mano ' + (isLeftHanded ? 'izquierda' : 'derecha')) }}
          </p>

          <div class="advice-list">
            <template v-if="customTips && customTips.length">
              <div v-for="(tip, idx) in customTips" :key="idx" class="advice-row">
                <div class="advice-bubble">{{ tip.icon }}</div>
                <div>
                  <strong>{{ tip.title }}</strong>
                  <p>{{ tip.text }}</p>
                </div>
              </div>
            </template>

            <template v-else-if="mode === 'math-order'">
              <div class="advice-row">
                <div class="advice-bubble">🙌</div>
                <div>
                  <strong>Brazos despejados</strong>
                  <p>Espacio libre para levantar los brazos a los lados y alcanzar los números.</p>
                </div>
              </div>
              <div class="advice-row">
                <div class="advice-bubble">🔢</div>
                <div>
                  <strong>Calcula y resuelve</strong>
                  <p>Observa la suma o resta y busca los números que den el resultado.</p>
                </div>
              </div>
              <div class="advice-row">
                <div class="advice-bubble">⏱️</div>
                <div>
                  <strong>Coloca cada número</strong>
                  <p>Lleva los números a las casillas vacías con tus manos hasta que el sistema los registre.</p>
                </div>
              </div>
            </template>

            <!-- Caso: Modo Caminata (Cintura para abajo) -->
            <template v-else-if="mode === 'lower-body'">
              <div class="advice-row">
                <div class="advice-bubble">👟</div>
                <div>
                  <strong>Pies y piernas visibles</strong>
                  <p>Asegúrate de que la cámara capte tus rodillas y pies al caminar.</p>
                </div>
              </div>
              <div class="advice-row">
                <div class="advice-bubble">🚶</div>
                <div>
                  <strong>Pasos en el lugar</strong>
                  <p>Eleva las rodillas de forma rítmica y suave durante 30 segundos.</p>
                </div>
              </div>
              <div class="advice-row">
                <div class="advice-bubble">⚖️</div>
                <div>
                  <strong>Postura y equilibrio</strong>
                  <p>Mantén el tronco erguido y bracea de manera natural.</p>
                </div>
              </div>
            </template>

            <!-- Caso: Modo Tren Superior (Cintura para arriba) -->
            <template v-else-if="mode === 'upper-body'">
              <div class="advice-row">
                <div class="advice-bubble">🙌</div>
                <div>
                  <strong>Brazos despejados</strong>
                  <p>Espacio libre para levantar los brazos a los lados y arriba.</p>
                </div>
              </div>
              <div class="advice-row">
                <div class="advice-bubble">🧠</div>
                <div>
                  <strong>Memoriza y reproduce</strong>
                  <p>Observa la secuencia de 4 posturas y reprodúcela con tus brazos.</p>
                </div>
              </div>
              <div class="advice-row">
                <div class="advice-bubble">⏱️</div>
                <div>
                  <strong>Mantén cada postura</strong>
                  <p>Sostén la postura un segundo hasta que el sistema la registre.</p>
                </div>
              </div>
            </template>

            <!-- Caso: Modo General -->
            <template v-else>
              <div class="advice-row">
                <div class="advice-bubble">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21.3 8.7 8.7 21.3a1 1 0 0 1-1.4 0l-6-6a1 1 0 0 1 0-1.4L13.9 1.3a1 1 0 0 1 1.4 0l6 6a1 1 0 0 1 0 1.4z"/>
                    <path d="m14.5 7.5 2 2"/>
                    <path d="m11.5 10.5 2 2"/>
                    <path d="m8.5 13.5 2 2"/>
                  </svg>
                </div>
                <div>
                  <strong>Espacio suficiente</strong>
                  <p>1.5 a 2 metros libres frente a la pantalla.</p>
                </div>
              </div>

              <div class="advice-row">
                <div class="advice-bubble">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M9 18h6"/>
                    <path d="M10 22h4"/>
                    <path d="M12 2v1"/>
                    <path d="M12 7a5 5 0 0 0-5 5c0 2 1.5 3.5 2 5h6c.5-1.5 2-3 2-5a5 5 0 0 0-5-5z"/>
                  </svg>
                </div>
                <div>
                  <strong>Iluminación adecuada</strong>
                  <p>Luz frontal sin reflejos directos en la lente.</p>
                </div>
              </div>

              <div class="advice-row">
                <div class="advice-bubble">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="5" r="3"/>
                    <path d="M12 8v8"/>
                    <path d="m9 21 3-5 3 5"/>
                    <path d="M6 12h12"/>
                  </svg>
                </div>
                <div>
                  <strong>Postura relajada</strong>
                  <p>Mantén los brazos sueltos y mira a la cámara.</p>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.prep-screen-overlay {
  position: relative;
  width: 100%;
  height: calc(100vh - 88px);
  z-index: 10;
  pointer-events: none;
}

.prep-screen-overlay * {
  pointer-events: auto;
}

.silhouette-canvas {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  pointer-events: none;
  z-index: 5;
}

.prep-ui-layout {
  position: relative;
  z-index: 15;
  height: 100%;
  display: flex;
  justify-content: space-between;
  padding: 24px 36px 36px;
  box-sizing: border-box;
  transition: all 0.35s ease;
}

/* En modo zurdo: la tarjeta con el botón Comenzar se coloca a la izquierda */
.prep-handed-left {
  flex-direction: row-reverse;
}

.prep-center-info {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  margin-top: 10px;
  gap: 16px;
  max-width: 520px;
}

.alignment-pill-badge {
  padding: 14px 28px;
  border-radius: 9999px;
  font-size: 1.1rem;
  font-weight: 800;
  display: flex;
  align-items: center;
  gap: 14px;
  box-shadow: 0 8px 24px rgba(40, 20, 15, 0.2);
  backdrop-filter: blur(10px);
}

.badge-waiting {
  background: rgba(255, 253, 249, 0.94);
  color: var(--motriz-text-main);
  border: 2px solid #E2D2C1;
}

.badge-aligned {
  background: #15803D;
  color: #FFFFFF;
  border: 2px solid #86EFAC;
  box-shadow: 0 10px 28px rgba(22, 163, 74, 0.45);
}

.status-indicator-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: currentColor;
}

.rf7-calibration-tag {
  background: rgba(255, 253, 249, 0.92);
  backdrop-filter: blur(10px);
  padding: 10px 22px;
  border-radius: 18px;
  border: 1.5px solid #E0D2C2;
  font-size: 0.88rem;
  color: var(--motriz-text-main);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.rf7-calibration-tag strong {
  color: var(--motriz-red-primary);
}

/* Dock Card con botón Comenzar situado en la parte superior */
.prep-dock-card {
  width: 390px;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  margin-top: 6px;
  transition: all 0.35s ease;
}

.advice-card {
  padding: 24px 24px 20px;
  background: rgba(255, 253, 249, 0.96);
  backdrop-filter: blur(14px);
  box-shadow: 0 12px 32px rgba(70, 30, 20, 0.15);
  border-radius: 24px;
}

.advice-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2px;
}

.advice-title {
  margin: 0;
  font-size: 1.6rem;
  font-weight: 900;
  color: var(--motriz-text-main);
}

.btn-mini-exit {
  padding: 6px 12px;
  font-size: 0.85rem;
}

/* Botón comenzar arriba del texto: ergonómico y visible */
.top-action-box {
  margin: 12px 0 14px;
}

.advice-lead {
  font-size: 0.88rem;
  color: var(--motriz-text-muted);
  margin: 0 0 14px;
  line-height: 1.35;
}

.advice-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.advice-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.advice-bubble {
  font-size: 1.35rem;
  line-height: 1;
  padding: 6px;
  background: #FFF5EA;
  border-radius: 12px;
  flex-shrink: 0;
}

.advice-row strong {
  display: block;
  font-size: 0.94rem;
  color: var(--motriz-text-main);
}

.advice-row p {
  margin: 2px 0 0;
  font-size: 0.82rem;
  color: var(--motriz-text-muted);
  line-height: 1.3;
}

.btn-commence {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 16px 20px;
  font-size: 1.15rem;
  font-weight: 900;
  letter-spacing: 0.03em;
  border-radius: 9999px;
  box-shadow: 0 8px 24px rgba(140, 29, 44, 0.35);
}

.btn-commence svg {
  flex-shrink: 0;
}
</style>
