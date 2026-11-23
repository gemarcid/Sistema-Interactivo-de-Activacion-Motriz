<script setup>
import { onMounted, onBeforeUnmount, ref, computed } from 'vue'
import { useCamera } from '../../../composables/useCamera'
import { useProfiles } from '../../../composables/useProfiles'
import { useHandCursor } from '../../../composables/useHandCursor'
import {
  playClickTone,
  playPopTone,
  playSuccessChime,
  playFanfareTune,
  playSelectTone,
} from '../../../composables/useAudio'
import { burst, clearParticles, drawParticles, updateParticles } from '../../../effects/particles'
import { findBodyHit } from '../../../game/bodyCollision'

const emit = defineEmits(['finish', 'exit'])

const stageRef = ref(null)
const canvasRef = ref(null)

const {
  isCameraActive,
  bodyDetected,
  bodyState,
} = useCamera()

const { activeProfile, updateActiveStats } = useProfiles()
const { setOnlyShowOnHover } = useHandCursor()

// Color definitions with pure, saturated hues (unmistakable contrast)
const BALLOON_COLORS = [
  { id: 'rojo', name: 'ROJO', hex: '#DC2626', textHex: '#FFFFFF' },
  { id: 'amarillo', name: 'AMARILLO', hex: '#F59E0B', textHex: '#FFFFFF' },
  { id: 'azul', name: 'AZUL', hex: '#2563EB', textHex: '#FFFFFF' }, // Azul rey intenso (no celeste)
  { id: 'verde', name: 'VERDE', hex: '#16A34A', textHex: '#FFFFFF' },
  { id: 'naranja', name: 'NARANJA', hex: '#EA580C', textHex: '#FFFFFF' },
]

// Game state
const isPaused = ref(false)
const score = ref(0)
const timeLeft = ref(45)
const correctHits = ref(0)
const wrongHits = ref(0)
const comboCount = ref(1)

// Target color state (Color objetivo actual)
const currentTargetIndex = ref(0)
const TARGET_HITS_NEEDED_DEFAULT = 5; // Configurable number of hits needed before changing color
const TARGET_AUTO_SWITCH_SECONDS = 25; // Seconds before auto‑switching target color when not cleared
const targetHitsNeeded = ref(TARGET_HITS_NEEDED_DEFAULT) // Hits needed before changing color
const targetHitsCurrent = ref(0)
const targetAnimPhase = ref('center') // 'center' | 'docked'
let targetAnimTimer = null

function triggerTargetAnim() {
  if (targetAnimTimer) clearTimeout(targetAnimTimer)
  targetAnimPhase.value = 'center'
  targetAnimTimer = setTimeout(() => {
    targetAnimPhase.value = 'docked'
  }, 850)
}

const currentTarget = computed(() => BALLOON_COLORS[currentTargetIndex.value])

// Floating feedback message
const feedbackMessage = ref('')
const feedbackType = ref('success') // 'success' | 'warning'
let feedbackTimeout = null

let animId = null
let lastFrameTime = performance.now()
let spawnAccumulator = 0
let secondAccumulator = 0
let targetTimer = 0 // Time on current target before auto-switching
let balloons = []

onMounted(() => {
  setOnlyShowOnHover(true)
  resizeCanvas()
  window.addEventListener('resize', resizeCanvas)
  resetGame()
  lastFrameTime = performance.now()
  animId = requestAnimationFrame(gameLoop)
})

onBeforeUnmount(() => {
  setOnlyShowOnHover(false)
  if (animId) cancelAnimationFrame(animId)
  window.removeEventListener('resize', resizeCanvas)
  clearParticles()
  if (feedbackTimeout) clearTimeout(feedbackTimeout)
  if (targetAnimTimer) clearTimeout(targetAnimTimer)
})

function resetGame() {
  score.value = 0
  timeLeft.value = 45
  correctHits.value = 0
  wrongHits.value = 0
  comboCount.value = 1
  balloons = []
  clearParticles()
  spawnAccumulator = 0
  secondAccumulator = 0
  targetTimer = 0
  isPaused.value = false
  targetHitsCurrent.value = 0
  currentTargetIndex.value = Math.floor(Math.random() * BALLOON_COLORS.length)
  triggerTargetAnim()
}

function resizeCanvas() {
  const canvas = canvasRef.value
  const stage = stageRef.value
  if (!canvas || !stage) return
  const rect = stage.getBoundingClientRect()
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = Math.round(rect.width * dpr)
  canvas.height = Math.round(rect.height * dpr)
  canvas.style.width = `${rect.width}px`
  canvas.style.height = `${rect.height}px`
  canvas.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0)
}

function switchTargetColor() {
  let nextIndex = Math.floor(Math.random() * BALLOON_COLORS.length)
  if (nextIndex === currentTargetIndex.value) {
    nextIndex = (nextIndex + 1) % BALLOON_COLORS.length
  }
  currentTargetIndex.value = nextIndex
  targetHitsCurrent.value = 0
  targetTimer = 0
  playSelectTone()
  triggerTargetAnim()
}

function spawnBalloon(width, height) {
  // Ensure at least 45% probability of spawning the current target color
  const isTarget = Math.random() < 0.45
  let colorConfig = currentTarget.value
  if (!isTarget) {
    const others = BALLOON_COLORS.filter((_, idx) => idx !== currentTargetIndex.value)
    colorConfig = others[Math.floor(Math.random() * others.length)]
  }

  // Senior-friendly generous balloon radius (RF5 & RF7)
  const radius = 54 * (0.95 + Math.random() * 0.18)
  const speed = activeProfile.value?.difficulty === 'facil' ? 56 : 70

  // Lateral Reach Corridors:
  // Avoid center corridor (36% to 64%) where player stands, preventing accidental torso collisions.
  // Spawn in either Left corridor (8% to 32%) or Right corridor (68% to 92%).
  const pickLeft = Math.random() < 0.5
  let spawnX
  if (pickLeft) {
    const minX = radius + 20
    const maxX = Math.max(minX, width * 0.32)
    spawnX = minX + Math.random() * (maxX - minX)
  } else {
    const minX = Math.min(width * 0.68, width - radius - 20)
    const maxX = Math.max(minX, width - radius - 20)
    spawnX = minX + Math.random() * (maxX - minX)
  }

  balloons.push({
    id: `balloon-${Date.now()}-${Math.random()}`,
    x: spawnX,
    y: -radius * 1.6 - 15, // Spawns ABOVE screen and falls DOWN
    r: radius,
    speed: speed + Math.random() * 16,
    sway: Math.random() * Math.PI * 2,
    swaySpeed: 1.1 + Math.random() * 0.6,
    popped: false,
    colorId: colorConfig.id,
    colorName: colorConfig.name,
    hex: colorConfig.hex,
    textHex: colorConfig.textHex,
  })
}

function gameLoop(now) {
  const dt = Math.min((now - lastFrameTime) / 1000, 0.05)
  lastFrameTime = now

  const canvas = canvasRef.value
  const stage = stageRef.value

  if (canvas && stage) {
    const rect = stage.getBoundingClientRect()

    if (!isPaused.value) {
      updateGameLogic(dt, rect.width, rect.height)
    }

    updateParticles(dt)
    drawScene(canvas.getContext('2d'), rect.width, rect.height)
  }

  animId = requestAnimationFrame(gameLoop)
}

function updateGameLogic(dt, width, height) {
  spawnAccumulator += dt * 1000
  secondAccumulator += dt
  targetTimer += dt

  // Auto-switch target color if player hasn't cleared it after the configured seconds
  if (targetTimer >= TARGET_AUTO_SWITCH_SECONDS) {
    switchTargetColor()
  }

  // Senior-friendly pacing: spawn every ~2.3s, max 3 balloons simultaneously on screen
  if (spawnAccumulator >= 2300) {
    spawnAccumulator = 0
    if (balloons.length < 3) {
      spawnBalloon(width, height)
    }
  }

  // Timer countdown (1s tick)
  if (secondAccumulator >= 1) {
    const elapsed = Math.floor(secondAccumulator)
    secondAccumulator -= elapsed
    timeLeft.value = Math.max(0, timeLeft.value - elapsed)

    if (timeLeft.value <= 0) {
      finishGame()
      return
    }
  }

  // Movement & Collisions
  for (const b of balloons) {
    b.y += b.speed * dt // Fall downward from top to bottom
    b.sway += b.swaySpeed * dt
    b.x += Math.sin(b.sway) * 16 * dt

    // Collision ONLY with reaching hands and forearms so torso/head doesn't trigger accidental hits
    if (bodyState.points.length > 0) {
      const reachingPoints = bodyState.points.filter((p) =>
        p.name.includes('mano') || p.name.includes('codo')
      )
      const reachingSegments = bodyState.segments.filter((s) =>
        s.name.includes('antebrazo')
      )

      const hit = findBodyHit(b, {
        points: reachingPoints,
        segments: reachingSegments,
        mapped: bodyState.mapped,
      })

      if (hit) {
        b.popped = true

        if (b.colorId === currentTarget.value.id) {
          // CORRECT COLOR POPPED!
          correctHits.value += 1
          targetHitsCurrent.value += 1

          const pointsEarned = 10 * comboCount.value
          score.value += pointsEarned
          comboCount.value = Math.min(comboCount.value + 1, 5)

          burst(b.x, b.y, b.hex)
          playPopTone()
          triggerFeedback(`¡Bien! +${pointsEarned}`, 'success')

          // Reset timer so player gets full time after a correct hit
          targetTimer = 0;
          // Switch color once target quota is reached
          if (targetHitsCurrent.value >= targetHitsNeeded.value) {
            switchTargetColor()
          }
        } else {
          // WRONG COLOR POPPED
          wrongHits.value += 1
          comboCount.value = 1 // Reset combo
          burst(b.x, b.y, '#9CA3AF') // Soft gray burst
          playClickTone()
          triggerFeedback(`¡Ese era ${b.colorName}! Busca ${currentTarget.value.name}`, 'warning')
        }
      }
    }
  }

  // Filter out popped and balloons that fell past the bottom of the screen
  balloons = balloons.filter((b) => !b.popped && b.y < height + b.r * 2.5)
}

function triggerFeedback(msg, type = 'success') {
  feedbackMessage.value = msg
  feedbackType.value = type
  if (feedbackTimeout) clearTimeout(feedbackTimeout)
  feedbackTimeout = setTimeout(() => {
    feedbackMessage.value = ''
  }, 1000)
}

// Helper to trace an organic teardrop/egg balloon silhouette
function traceBalloonPath(ctx, x, y, rx, ry) {
  ctx.beginPath()
  // Start at bottom apex where knot connects
  ctx.moveTo(x, y + ry)
  // Left curve: taper up to wide shoulder
  ctx.bezierCurveTo(x - rx * 0.7, y + ry * 0.85, x - rx * 1.05, y + ry * 0.15, x - rx, y - ry * 0.25)
  // Left shoulder to top dome
  ctx.bezierCurveTo(x - rx * 0.95, y - ry * 0.85, x - rx * 0.55, y - ry, x, y - ry)
  // Top dome to right shoulder
  ctx.bezierCurveTo(x + rx * 0.55, y - ry, x + rx * 0.95, y - ry * 0.85, x + rx, y - ry * 0.25)
  // Right shoulder tapering down to bottom apex
  ctx.bezierCurveTo(x + rx * 1.05, y + ry * 0.15, x + rx * 0.7, y + ry * 0.85, x, y + ry)
  ctx.closePath()
}

function drawScene(ctx, width, height) {
  ctx.clearRect(0, 0, width, height)

  // 1. Draw 3D Balloons with authentic teardrop form, knot, wavy string, and specular gloss
  for (const b of balloons) {
    ctx.save()

    const rx = b.r * 0.86
    const ry = b.r * 1.14
    const kw = rx * 0.34 // knot width
    const kh = ry * 0.22 // knot height

    // A. Floating wavy string trailing below knot
    ctx.beginPath()
    ctx.moveTo(b.x, b.y + ry + kh)
    ctx.bezierCurveTo(
      b.x + Math.sin(b.sway * 1.5) * 14,
      b.y + ry + kh + 22,
      b.x - Math.sin(b.sway * 1.5) * 12,
      b.y + ry + kh + 44,
      b.x + Math.sin(b.sway) * 8,
      b.y + ry + kh + 68
    )
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.82)'
    ctx.lineWidth = 2.5
    ctx.stroke()

    // B. Prominent 3D Tied Knot
    ctx.beginPath()
    ctx.moveTo(b.x - kw * 0.45, b.y + ry)
    ctx.lineTo(b.x + kw * 0.45, b.y + ry)
    ctx.lineTo(b.x + kw, b.y + ry + kh)
    ctx.lineTo(b.x - kw, b.y + ry + kh)
    ctx.closePath()
    ctx.fillStyle = b.hex
    ctx.fill()
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)'
    ctx.lineWidth = 1.5
    ctx.stroke()

    // Knot fold shadow
    ctx.beginPath()
    ctx.ellipse(b.x, b.y + ry + 2, kw * 0.5, kh * 0.3, 0, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'
    ctx.fill()

    // C. Balloon Body: Authentic egg/teardrop silhouette with soft drop shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.32)'
    ctx.shadowBlur = 16
    ctx.shadowOffsetY = 6
    traceBalloonPath(ctx, b.x, b.y, rx, ry)
    ctx.fillStyle = b.hex
    ctx.fill()

    // D. 3D Spherical Volume Gradient (light from upper-left)
    ctx.shadowColor = 'transparent'
    const grad = ctx.createRadialGradient(
      b.x - rx * 0.36,
      b.y - ry * 0.38,
      rx * 0.08,
      b.x,
      b.y,
      ry * 1.12
    )
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.85)')
    grad.addColorStop(0.3, 'rgba(255, 255, 255, 0.2)')
    grad.addColorStop(0.85, 'rgba(0, 0, 0, 0.0)')
    grad.addColorStop(1, 'rgba(0, 0, 0, 0.32)')
    ctx.fillStyle = grad
    traceBalloonPath(ctx, b.x, b.y, rx, ry)
    ctx.fill()

    // E. Curved Glossy Specular Sheen (authentic balloon reflection)
    ctx.save()
    ctx.beginPath()
    ctx.ellipse(b.x - rx * 0.42, b.y - ry * 0.42, rx * 0.22, ry * 0.38, -Math.PI / 7, 0, Math.PI * 2)
    const sheenGrad = ctx.createLinearGradient(
      b.x - rx * 0.6,
      b.y - ry * 0.7,
      b.x - rx * 0.2,
      b.y - ry * 0.2
    )
    sheenGrad.addColorStop(0, 'rgba(255, 255, 255, 0.88)')
    sheenGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.32)')
    sheenGrad.addColorStop(1, 'rgba(255, 255, 255, 0.0)')
    ctx.fillStyle = sheenGrad
    ctx.fill()

    // Small pinpoint glint
    ctx.beginPath()
    ctx.arc(b.x - rx * 0.24, b.y - ry * 0.64, rx * 0.08, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
    ctx.fill()
    ctx.restore()

    // F. Crisp White Border
    traceBalloonPath(ctx, b.x, b.y, rx, ry)
    ctx.lineWidth = 2.5
    ctx.strokeStyle = '#FFFFFF'
    ctx.stroke()

    // G. Resplandor dorado animado si coincide con el color objetivo
    if (b.colorId === currentTarget.value.id) {
      const pulse = 1 + Math.sin(performance.now() * 0.006) * 0.05
      ctx.save()
      traceBalloonPath(ctx, b.x, b.y, rx * 1.14 * pulse, ry * 1.11 * pulse)
      ctx.strokeStyle = '#FDE047'
      ctx.lineWidth = 3.5
      ctx.setLineDash([8, 6])
      ctx.shadowColor = '#FBBF24'
      ctx.shadowBlur = 12
      ctx.stroke()
      ctx.restore()
    }

    ctx.restore()
  }

  // 2. Draw Particle Bursts
  drawParticles(ctx)
}

function finishGame() {
  playFanfareTune()
  const stars = score.value >= 250 ? 3 : score.value >= 120 ? 2 : 1
  updateActiveStats({
    minutes: 1,
    points: score.value,
    hits: correctHits.value,
  })

  emit('finish', {
    score: score.value,
    correctHits: correctHits.value,
    wrongHits: wrongHits.value,
    timeSpent: '0:45',
    stars,
  })
}

function togglePause() {
  playClickTone()
  isPaused.value = !isPaused.value
}

function restartGame() {
  playClickTone()
  resetGame()
}

function exitToMenu() {
  playClickTone()
  emit('exit')
}

const formattedTimer = computed(() => {
  const m = Math.floor(timeLeft.value / 60)
  const s = timeLeft.value % 60
  return `0${m}:${s < 10 ? '0' : ''}${s}`
})
</script>

<template>
  <div class="balloon-game-container">
    <!-- Active Stage: 100% Fullscreen Camera Stage (Zero Bars) -->
    <div ref="stageRef" class="balloon-stage">
      <canvas ref="canvasRef" class="balloon-canvas"></canvas>

      <!-- Floating Controls: Top-Left Pause (Takes 0 layout height) -->
      <div class="hud-floating-left">
        <button
          type="button"
          class="btn-round-action pause-btn"
          title="Pausar juego"
          @click="togglePause"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" rx="2"/>
            <rect x="14" y="4" width="4" height="16" rx="2"/>
          </svg>
        </button>
      </div>

      <!-- Floating Controls: Top-Right Timer & Score (Takes 0 layout height) -->
      <div class="hud-floating-right">
        <div class="hud-timer-badge">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          <span class="timer-digits">{{ formattedTimer }}</span>
        </div>

        <div class="hud-score-badge">
          <span class="star-icon">★</span>
          <span class="score-number">{{ score }}</span>
        </div>
      </div>

      <!-- ANIMATED TARGET WORD: Starts in center on change, then glides up to the top! -->
      <div
        class="target-flying-pill"
        :class="{
          'is-center': targetAnimPhase === 'center',
          'is-docked': targetAnimPhase === 'docked',
        }"
        :style="{ '--target-color': currentTarget.hex }"
      >
        <div class="target-pill-body">
          <span class="target-pill-lead">
            {{ targetAnimPhase === 'center' ? '¡AHORA:' : 'REVIENTA:' }}
          </span>
          <span
            class="target-color-chip"
            :style="{ backgroundColor: currentTarget.hex }"
          >
            {{ currentTarget.name }}
          </span>
          <span
            v-if="targetAnimPhase === 'docked'"
            class="target-progress-counter"
          >
            ({{ targetHitsCurrent }}/{{ targetHitsNeeded }})
          </span>
        </div>
      </div>

      <!-- In-Game Motivational Toast -->
      <transition name="pop-fade">
        <div
          v-if="feedbackMessage"
          class="feedback-pill"
          :class="`feedback-${feedbackType}`"
        >
          <span>{{ feedbackMessage }}</span>
        </div>
      </transition>

      <!-- Combo Gauge Bar -->
      <div class="combo-side-card">
        <span class="combo-title">Combo</span>
        <div class="combo-meter-tube">
          <div
            class="combo-meter-fill"
            :style="{ height: `${(comboCount / 5) * 100}%` }"
          ></div>
        </div>
        <span class="combo-val">x{{ comboCount }}</span>
      </div>

      <!-- Pause Modal -->
      <div v-if="isPaused" class="motriz-modal-overlay">
        <div class="motriz-card pause-modal-box">
          <h2 class="pause-title">Pausa</h2>
          <p class="pause-sub">Descansa los brazos un momento antes de continuar.</p>

          <div class="pause-buttons-col">
            <button
              type="button"
              class="btn-motriz-primary btn-pause-act"
              @click="togglePause"
            >
              Continuar
            </button>
            <button
              type="button"
              class="btn-motriz-secondary btn-pause-act"
              @click="restartGame"
            >
              Reiniciar
            </button>
            <button
              type="button"
              class="btn-motriz-secondary btn-pause-act"
              @click="exitToMenu"
            >
              Salir al Menú
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.balloon-game-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  flex-grow: 1;
  position: relative;
  overflow: hidden;
  user-select: none;
}

/* Floating Corner HUD Controls */
.hud-floating-left {
  position: absolute;
  top: 18px;
  left: 24px;
  z-index: 25;
}

.hud-floating-right {
  position: absolute;
  top: 18px;
  right: 24px;
  z-index: 25;
  display: flex;
  align-items: center;
  gap: 14px;
}

.hud-timer-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(30, 64, 175, 0.88);
  backdrop-filter: blur(8px);
  color: #FFFFFF;
  padding: 8px 18px;
  border-radius: 9999px;
  border: 2px solid rgba(255, 255, 255, 0.45);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.2);
}

.timer-digits {
  font-size: 1.25rem;
  font-weight: 900;
  font-family: monospace;
}

.hud-score-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(217, 119, 6, 0.88);
  backdrop-filter: blur(8px);
  color: #FFFFFF;
  padding: 8px 18px;
  border-radius: 9999px;
  border: 2px solid rgba(255, 255, 255, 0.45);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.2);
}

.star-icon {
  font-size: 1.25rem;
  color: #FEF08A;
}

.score-number {
  font-size: 1.25rem;
  font-weight: 900;
}

.pause-btn {
  width: 52px;
  height: 52px;
  background: rgba(255, 253, 249, 0.9);
  backdrop-filter: blur(8px);
}

/* Stage: 100% Fullscreen */
.balloon-stage {
  flex-grow: 1;
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  background: transparent;
}

.balloon-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

/* ANIMATED TARGET COLOR WORD: Starts in center, flies up to top! */
.target-flying-pill {
  position: absolute;
  left: 50%;
  z-index: 35;
  pointer-events: none;
  transition: top 0.65s cubic-bezier(0.16, 1, 0.3, 1),
              transform 0.65s cubic-bezier(0.16, 1, 0.3, 1);
}

/* Center Announcement Phase */
.target-flying-pill.is-center {
  top: 36%;
  transform: translate(-50%, -50%) scale(1.35);
}

.target-flying-pill.is-center .target-pill-body {
  padding: 14px 38px;
  box-shadow: 
    0 16px 40px rgba(0, 0, 0, 0.35),
    0 0 35px var(--target-color, #2563EB);
  animation: centerPopIn 0.38s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

/* Docked Top Phase */
.target-flying-pill.is-docked {
  top: 18px;
  transform: translate(-50%, 0) scale(1);
}

.target-flying-pill.is-docked .target-pill-body {
  padding: 6px 22px;
  box-shadow: 
    0 6px 20px rgba(0, 0, 0, 0.16),
    0 0 16px var(--target-color, #2563EB);
}

.target-pill-body {
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(255, 253, 249, 0.96);
  backdrop-filter: blur(14px);
  border: 3.5px solid var(--target-color, #2563EB);
  border-radius: 9999px;
  transition: all 0.55s cubic-bezier(0.16, 1, 0.3, 1);
}

.target-pill-lead {
  font-size: 1.25rem;
  font-weight: 900;
  color: #1F2937;
  letter-spacing: 0.04em;
}

.target-color-chip {
  color: #FFFFFF;
  font-size: 1.6rem;
  font-weight: 900;
  letter-spacing: 0.06em;
  padding: 5px 22px;
  border-radius: 9999px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.22);
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
  transition: background-color 0.3s ease;
}

.target-progress-counter {
  font-size: 1.15rem;
  font-weight: 800;
  color: #4B5563;
}

@keyframes centerPopIn {
  0% { transform: scale(0.6); opacity: 0; }
  75% { transform: scale(1.08); opacity: 1; }
  100% { transform: scale(1); }
}

.feedback-pill {
  position: absolute;
  top: 45%;
  left: 50%;
  transform: translate(-50%, -50%);
  border-radius: 9999px;
  padding: 14px 34px;
  font-size: 1.6rem;
  font-weight: 900;
  pointer-events: none;
  z-index: 25;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
}

.feedback-success {
  background: rgba(255, 255, 255, 0.95);
  color: #15803D;
  border: 3px solid #16A34A;
}

.feedback-warning {
  background: rgba(255, 255, 255, 0.95);
  color: #DC2626;
  border: 3px solid #EF4444;
}

/* Combo Gauge */
.combo-side-card {
  position: absolute;
  right: 28px;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(255, 253, 249, 0.92);
  backdrop-filter: blur(10px);
  border: 2px solid #E2D2C1;
  border-radius: 24px;
  padding: 16px 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  box-shadow: 0 8px 24px rgba(60, 30, 20, 0.15);
  z-index: 20;
}

.combo-title {
  font-size: 0.78rem;
  font-weight: 800;
  color: var(--motriz-text-muted);
  text-transform: uppercase;
}

.combo-meter-tube {
  width: 14px;
  height: 130px;
  background: #E5E7EB;
  border-radius: 9999px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  border: 1px solid #D1D5DB;
}

.combo-meter-fill {
  width: 100%;
  background: linear-gradient(180deg, #10B981 0%, #059669 100%);
  border-radius: 9999px;
  transition: height 0.2s ease;
}

.combo-val {
  font-size: 1.15rem;
  font-weight: 900;
  color: var(--motriz-red-primary);
}

/* Pause Modal */
.pause-modal-box {
  max-width: 440px;
  width: 90%;
  padding: 36px 30px;
  text-align: center;
}

.pause-title {
  margin: 0;
  font-size: 2.2rem;
  font-weight: 900;
  color: var(--motriz-red-primary);
}

.pause-sub {
  color: var(--motriz-text-muted);
  margin: 10px 0 28px;
  font-size: 1.05rem;
}

.pause-buttons-col {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.btn-pause-act {
  width: 100%;
  padding: 14px 20px;
  font-size: 1.2rem;
}

/* Animations */
.pop-fade-enter-active {
  animation: motrizPopIn 0.22s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.pop-fade-leave-active {
  transition: all 0.2s ease-out;
  opacity: 0;
  transform: translate(-50%, -60%) scale(0.9);
}
</style>
