<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { createEquation, generateCardPool, validateSolution } from '../../game/mathOrder/mathEquations'
import { useCamera } from '../../composables/useCamera'
import { useProfiles } from '../../composables/useProfiles'
import { useHandCursor } from '../../composables/useHandCursor'
import { playClickTone, playSelectTone, playPopTone, playSuccessChime, playFanfareTune } from '../../composables/useAudio'

const emit = defineEmits(['finish', 'exit'])

const TOTAL_ROUNDS = 5

const { isLeftHanded } = useProfiles()
const { bodyState, bodyDetected } = useCamera()
const { handCursorState } = useHandCursor()

const currentRound = ref(1)
const score = ref(0)
const feedback = ref('Lleva los números a las casillas para resolver la suma')
const feedbackType = ref('normal')
const isChecking = ref(false)
const roundFinished = ref(false)

const currentEquation = ref(createEquation(1))
const cards = ref([])

const slot1Card = ref(null)
const slot2Card = ref(null)
const grabbedCard = ref(null)

const slot1Hover = ref(false)
const slot2Hover = ref(false)

const slot1Ref = ref(null)
const slot2Ref = ref(null)
const canvasRef = ref(null)

let animFrameId = null
let checkTimeout = null
let slot1Dwell = 0
let slot2Dwell = 0

const CARD_HOME_LAYOUT = [
  { xPct: 8, yPct: 50 },
  { xPct: 82, yPct: 50 },
  { xPct: 22, yPct: 68 },
  { xPct: 68, yPct: 68 },
]

const equationTarget = computed(() => currentEquation.value.target)
const equationOperator = computed(() => currentEquation.value.operator)

onMounted(() => {
  setupRound(1)
  resizeCanvas()
  window.addEventListener('resize', resizeCanvas)
  animFrameId = requestAnimationFrame(interactionLoop)
})

onBeforeUnmount(() => {
  if (animFrameId) cancelAnimationFrame(animFrameId)
  if (checkTimeout) clearTimeout(checkTimeout)
  window.removeEventListener('resize', resizeCanvas)
})

function resizeCanvas() {
  if (!canvasRef.value) return
  canvasRef.value.width = window.innerWidth
  canvasRef.value.height = window.innerHeight
}

function setupRound(roundNum) {
  currentRound.value = roundNum
  currentEquation.value = createEquation(roundNum)
  const pool = generateCardPool(currentEquation.value)

  const w = window.innerWidth || 1200
  const h = window.innerHeight || 800

  cards.value = pool.map((item, idx) => {
    const layout = CARD_HOME_LAYOUT[idx] || { xPct: 20 + idx * 20, yPct: 60 }
    const homeX = (layout.xPct / 100) * w
    const homeY = (layout.yPct / 100) * h
    return {
      id: item.id,
      value: item.value,
      homeX,
      homeY,
      currentX: homeX,
      currentY: homeY,
      isGrabbed: false,
    }
  })

  slot1Card.value = null
  slot2Card.value = null
  grabbedCard.value = null
  isChecking.value = false
  roundFinished.value = false

  feedback.value = equationOperator.value === '+'
    ? `Encuentra dos números que sumados den ${equationTarget.value}`
    : `Encuentra dos números que restados den ${equationTarget.value}`
  feedbackType.value = 'normal'
}

function getHandPosition() {
  if (handCursorState.active) {
    return { x: handCursorState.x, y: handCursorState.y, active: true }
  }

  const mapped = bodyState.mapped
  if (mapped && mapped.length) {
    const isLeft = isLeftHanded.value
    const idx = isLeft ? 19 : 20
    const wrist = isLeft ? 15 : 16
    const pt = (mapped[idx] && (mapped[idx].visibility ?? 1) > 0.25)
      ? mapped[idx]
      : (mapped[wrist] && (mapped[wrist].visibility ?? 1) > 0.25) ? mapped[wrist] : null

    if (pt) {
      return { x: pt.x, y: pt.y, active: true }
    }
  }

  return { x: 0, y: 0, active: false }
}

function interactionLoop() {
  const hand = getHandPosition()

  if (cards.value.length && !isChecking.value && !roundFinished.value) {
    updateCardPhysics(hand)
  }

  drawHandOverlay(hand)
  animFrameId = requestAnimationFrame(interactionLoop)
}

function updateCardPhysics(hand) {
  const s1Rect = slot1Ref.value?.getBoundingClientRect()
  const s2Rect = slot2Ref.value?.getBoundingClientRect()

  slot1Hover.value = false
  slot2Hover.value = false

  if (grabbedCard.value) {
    const card = grabbedCard.value
    card.currentX += (hand.x - card.currentX) * 0.4
    card.currentY += (hand.y - card.currentY) * 0.4

    if (s1Rect && !slot1Card.value) {
      const dist1 = Math.hypot(hand.x - (s1Rect.left + s1Rect.width / 2), hand.y - (s1Rect.top + s1Rect.height / 2))
      if (dist1 < 100) slot1Hover.value = true
    }

    if (s2Rect && !slot2Card.value) {
      const dist2 = Math.hypot(hand.x - (s2Rect.left + s2Rect.width / 2), hand.y - (s2Rect.top + s2Rect.height / 2))
      if (dist2 < 100) slot2Hover.value = true
    }

    const distToHome = Math.hypot(hand.x - card.homeX, hand.y - card.homeY)
    const isRestingHand = hand.y > (window.innerHeight || 800) * 0.84

    if (!hand.active || isRestingHand || distToHome < 50) {
      releaseCard(card)
    }
  } else if (hand.active) {
    for (const card of cards.value) {
      if (card.id === slot1Card.value?.id || card.id === slot2Card.value?.id) continue

      const dist = Math.hypot(hand.x - card.currentX, hand.y - card.currentY)
      if (dist < 75) {
        grabCard(card)
        break
      }
    }

    if (s1Rect && slot1Card.value) {
      const dist1 = Math.hypot(hand.x - (s1Rect.left + s1Rect.width / 2), hand.y - (s1Rect.top + s1Rect.height / 2))
      if (dist1 < 80) {
        slot1Dwell++
        if (slot1Dwell > 16) {
          removeSlot(1)
          slot1Dwell = 0
        }
      } else {
        slot1Dwell = 0
      }
    }

    if (s2Rect && slot2Card.value) {
      const dist2 = Math.hypot(hand.x - (s2Rect.left + s2Rect.width / 2), hand.y - (s2Rect.top + s2Rect.height / 2))
      if (dist2 < 80) {
        slot2Dwell++
        if (slot2Dwell > 16) {
          removeSlot(2)
          slot2Dwell = 0
        }
      } else {
        slot2Dwell = 0
      }
    }
  }

  for (const card of cards.value) {
    if (!card.isGrabbed && (card.id !== slot1Card.value?.id && card.id !== slot2Card.value?.id)) {
      card.currentX += (card.homeX - card.currentX) * 0.15
      card.currentY += (card.homeY - card.currentY) * 0.15
    }
  }
}

function grabCard(card) {
  if (isChecking.value || roundFinished.value) return
  grabbedCard.value = card
  card.isGrabbed = true
  playSelectTone()
}

function releaseCard(card) {
  if (!card) return
  card.isGrabbed = false
  grabbedCard.value = null

  const s1Rect = slot1Ref.value?.getBoundingClientRect()
  const s2Rect = slot2Ref.value?.getBoundingClientRect()

  const cardCenterX = card.currentX
  const cardCenterY = card.currentY

  if (s1Rect && !slot1Card.value) {
    const dist1 = Math.hypot(cardCenterX - (s1Rect.left + s1Rect.width / 2), cardCenterY - (s1Rect.top + s1Rect.height / 2))
    if (dist1 < 120) {
      placeInSlot(card, 1)
      return
    }
  }

  if (s2Rect && !slot2Card.value) {
    const dist2 = Math.hypot(cardCenterX - (s2Rect.left + s2Rect.width / 2), cardCenterY - (s2Rect.top + s2Rect.height / 2))
    if (dist2 < 120) {
      placeInSlot(card, 2)
      return
    }
  }

  playClickTone()
}

function placeInSlot(card, slotNum) {
  playPopTone()
  if (slotNum === 1) slot1Card.value = card
  if (slotNum === 2) slot2Card.value = card

  card.isGrabbed = false
  grabbedCard.value = null

  if (slot1Card.value && slot2Card.value) {
    evaluateRound()
  }
}

function handleCardClick(card) {
  if (isChecking.value || roundFinished.value) return

  if (grabbedCard.value?.id === card.id) {
    releaseCard(card)
    return
  }

  playSelectTone()
  if (!slot1Card.value) {
    placeInSlot(card, 1)
  } else if (!slot2Card.value) {
    placeInSlot(card, 2)
  }
}

function removeSlot(slotNum) {
  if (isChecking.value || roundFinished.value) return
  playClickTone()
  if (slotNum === 1 && slot1Card.value) {
    const card = slot1Card.value
    card.currentX = card.homeX
    card.currentY = card.homeY
    slot1Card.value = null
  } else if (slotNum === 2 && slot2Card.value) {
    const card = slot2Card.value
    card.currentX = card.homeX
    card.currentY = card.homeY
    slot2Card.value = null
  }
}

function evaluateRound() {
  isChecking.value = true
  const v1 = slot1Card.value.value
  const v2 = slot2Card.value.value
  const op = equationOperator.value
  const target = equationTarget.value

  const isOk = validateSolution(v1, v2, op, target)

  if (isOk) {
    feedbackType.value = 'success'
    feedback.value = `¡Excelente trabajo! ${v1} ${op} ${v2} = ${target}`
    score.value += 100
    playSuccessChime()

    checkTimeout = setTimeout(() => {
      if (currentRound.value < TOTAL_ROUNDS) {
        setupRound(currentRound.value + 1)
      } else {
        roundFinished.value = true
        playFanfareTune()
        emit('finish', { score: score.value, rounds: TOTAL_ROUNDS })
      }
    }, 1800)
  } else {
    feedbackType.value = 'error'
    feedback.value = `${v1} ${op} ${v2} no da ${target}. ¡Intenta de nuevo!`
    playPopTone()

    checkTimeout = setTimeout(() => {
      if (slot1Card.value) {
        slot1Card.value.currentX = slot1Card.value.homeX
        slot1Card.value.currentY = slot1Card.value.homeY
      }
      if (slot2Card.value) {
        slot2Card.value.currentX = slot2Card.value.homeX
        slot2Card.value.currentY = slot2Card.value.homeY
      }
      slot1Card.value = null
      slot2Card.value = null
      isChecking.value = false
      feedback.value = 'Prueba con otra combinación de números'
      feedbackType.value = 'normal'
    }, 1500)
  }
}

function drawHandOverlay(hand) {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  const mapped = bodyState.mapped
  if (mapped && mapped.length) {
    const handIndices = [15, 16, 19, 20]
    handIndices.forEach((idx) => {
      const pt = mapped[idx]
      if (pt && (pt.visibility ?? 1) > 0.3) {
        ctx.save()
        ctx.beginPath()
        ctx.arc(pt.x, pt.y, 28, 0, Math.PI * 2)
        ctx.fillStyle = grabbedCard.value ? 'rgba(245, 158, 11, 0.45)' : 'rgba(16, 185, 129, 0.35)'
        ctx.fill()
        ctx.lineWidth = 3
        ctx.strokeStyle = grabbedCard.value ? '#F59E0B' : '#10B981'
        ctx.stroke()

        ctx.beginPath()
        ctx.arc(pt.x, pt.y, 8, 0, Math.PI * 2)
        ctx.fillStyle = '#FFFFFF'
        ctx.fill()
        ctx.restore()
      }
    })
  }

  if (hand.active && grabbedCard.value) {
    ctx.save()
    ctx.beginPath()
    ctx.arc(hand.x, hand.y, 38, 0, Math.PI * 2)
    ctx.strokeStyle = '#F59E0B'
    ctx.lineWidth = 4
    ctx.setLineDash([6, 6])
    ctx.stroke()
    ctx.restore()
  }
}

function handleExit() {
  playClickTone()
  emit('exit')
}
</script>

<template>
  <div class="math-game-root">
    <canvas ref="canvasRef" class="hand-interaction-canvas"></canvas>

    <header class="game-hud-bar">
      <button type="button" class="btn-round-action btn-back" @click="handleExit" title="Salir">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
      </button>

      <div class="hud-center-pill" :class="feedbackType">
        <span class="hud-round-tag">Ronda {{ currentRound }} de {{ TOTAL_ROUNDS }}</span>
        <span class="hud-instruction">{{ feedback }}</span>
      </div>

      <div class="hud-score-card">
        <span class="score-label">Puntaje</span>
        <strong class="score-digits">{{ score }}</strong>
      </div>
    </header>

    <section class="equation-board motriz-card" :class="{ 'board-success': feedbackType === 'success', 'board-error': feedbackType === 'error' }">
      <div
        ref="slot1Ref"
        class="target-slot clickable"
        :class="{ 'slot-active-hover': slot1Hover, 'slot-has-number': slot1Card }"
        @click="slot1Card && removeSlot(1)"
      >
        <div v-if="slot1Card" class="slotted-content">
          <span class="slotted-digit">{{ slot1Card.value }}</span>
          <span class="remove-cross">×</span>
        </div>
        <span v-else class="slot-empty-mark">?</span>
      </div>

      <div class="equation-math-op">
        <span>{{ equationOperator }}</span>
      </div>

      <div
        ref="slot2Ref"
        class="target-slot clickable"
        :class="{ 'slot-active-hover': slot2Hover, 'slot-has-number': slot2Card }"
        @click="slot2Card && removeSlot(2)"
      >
        <div v-if="slot2Card" class="slotted-content">
          <span class="slotted-digit">{{ slot2Card.value }}</span>
          <span class="remove-cross">×</span>
        </div>
        <span v-else class="slot-empty-mark">?</span>
      </div>

      <div class="equation-math-equals">
        <span>=</span>
      </div>

      <div class="target-result-pill">
        <span class="result-digit">{{ equationTarget }}</span>
      </div>
    </section>

    <div
      v-for="card in cards"
      :key="card.id"
      v-show="card.id !== slot1Card?.id && card.id !== slot2Card?.id"
      class="giant-number-button clickable"
      :class="{ 'button-grabbed': card.isGrabbed }"
      :style="{
        left: `${card.currentX}px`,
        top: `${card.currentY}px`,
      }"
      @click="handleCardClick(card)"
    >
      <span class="button-digit">{{ card.value }}</span>
      <span v-if="card.isGrabbed" class="grabbed-badge">¡Agarrado!</span>
    </div>
  </div>
</template>

<style scoped>
.math-game-root {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: calc(100vh - 96px);
  overflow: hidden;
  background: transparent !important;
  user-select: none;
}

.hand-interaction-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 5;
}

.game-hud-bar {
  position: absolute;
  top: 16px;
  left: 24px;
  right: 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  z-index: 20;
}

.btn-back {
  width: 60px;
  height: 60px;
  flex-shrink: 0;
}

.hud-center-pill {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 28px;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(12px);
  border: 2.5px solid var(--motriz-card-border);
  border-radius: 9999px;
  box-shadow: 0 8px 24px rgba(70, 30, 20, 0.12);
  transition: all 0.25s ease;
}

.hud-center-pill.success {
  background: #ECFDF5;
  border-color: #10B981;
}

.hud-center-pill.error {
  background: #FEF2F2;
  border-color: #EF4444;
  animation: hudShake 0.35s ease-in-out;
}

.hud-round-tag {
  background: var(--motriz-red-primary);
  color: #FFFFFF;
  font-weight: 800;
  font-size: 0.95rem;
  padding: 4px 14px;
  border-radius: 9999px;
  white-space: nowrap;
}

.hud-instruction {
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--motriz-text-main);
  white-space: nowrap;
}

.hud-center-pill.success .hud-instruction {
  color: #065F46;
}

.hud-center-pill.error .hud-instruction {
  color: #991B1B;
}

.hud-score-card {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  padding: 8px 22px;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(12px);
  border: 2.5px solid var(--motriz-card-border);
  border-radius: 20px;
  box-shadow: 0 8px 24px rgba(70, 30, 20, 0.12);
  flex-shrink: 0;
}

.score-label {
  font-size: 0.78rem;
  font-weight: 800;
  text-transform: uppercase;
  color: var(--motriz-text-muted);
}

.score-digits {
  font-size: 1.6rem;
  font-weight: 900;
  color: var(--motriz-amber);
}

.equation-board {
  position: absolute;
  top: 96px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 22px;
  padding: 20px 36px;
  background: rgba(255, 253, 249, 0.92);
  backdrop-filter: blur(16px);
  border: 3.5px solid var(--motriz-card-border);
  border-radius: 36px;
  box-shadow: 0 14px 34px rgba(70, 30, 20, 0.16);
  z-index: 15;
  transition: all 0.25s ease;
}

.equation-board.board-success {
  border-color: #10B981;
  box-shadow: 0 0 36px rgba(16, 185, 129, 0.45);
}

.equation-board.board-error {
  border-color: #EF4444;
  box-shadow: 0 0 30px rgba(239, 68, 68, 0.35);
  animation: hudShake 0.4s ease-in-out;
}

.target-slot {
  width: 140px;
  height: 140px;
  border-radius: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 4px dashed #B89C82;
  background: rgba(244, 237, 226, 0.9);
  cursor: pointer;
  position: relative;
  transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.target-slot:hover {
  transform: scale(1.04);
  border-color: var(--motriz-red-primary);
}

.target-slot.slot-active-hover {
  border-style: solid;
  border-color: var(--motriz-gold);
  background: #FFFBEB;
  box-shadow: 0 0 28px rgba(245, 158, 11, 0.6);
  transform: scale(1.08);
}

.target-slot.slot-has-number {
  border-style: solid;
  border-color: var(--motriz-red-primary);
  background: linear-gradient(180deg, #FFFFFF 0%, #FBF3E8 100%);
  box-shadow: 0 8px 22px rgba(140, 29, 44, 0.2);
}

.slotted-content {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  position: relative;
}

.slotted-digit {
  font-size: 4rem;
  font-weight: 900;
  color: var(--motriz-red-primary);
}

.remove-cross {
  position: absolute;
  top: 6px;
  right: 10px;
  font-size: 1.3rem;
  font-weight: 900;
  color: var(--motriz-text-muted);
}

.slot-empty-mark {
  font-size: 3.5rem;
  font-weight: 800;
  color: var(--motriz-text-light);
}

.equation-math-op,
.equation-math-equals {
  font-size: 4rem;
  font-weight: 900;
  color: var(--motriz-red-primary);
}

.target-result-pill {
  width: 140px;
  height: 140px;
  border-radius: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(180deg, #A82435 0%, #8C1D2C 100%);
  border: 4px solid #6E1220;
  box-shadow: var(--motriz-pill-shadow);
}

.result-digit {
  font-size: 4rem;
  font-weight: 900;
  color: #FFFFFF;
  text-shadow: 0 3px 6px rgba(0, 0, 0, 0.4);
}

.giant-number-button {
  position: absolute;
  width: 140px;
  height: 140px;
  margin-left: -70px;
  margin-top: -70px;
  border-radius: 30px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 239, 228, 0.98) 100%);
  backdrop-filter: blur(10px);
  border: 4.5px solid #DECBB7;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 10;
  box-shadow:
    inset 0 3px 3px rgba(255, 255, 255, 1),
    0 12px 28px rgba(70, 30, 20, 0.22);
  transition: transform 0.15s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}

.giant-number-button:hover {
  border-color: var(--motriz-red-primary);
  box-shadow:
    inset 0 3px 3px rgba(255, 255, 255, 1),
    0 16px 36px rgba(140, 29, 44, 0.32);
}

.giant-number-button.button-grabbed {
  border-color: var(--motriz-gold);
  background: #FFFBEB;
  transform: scale(1.18);
  box-shadow:
    0 0 32px rgba(245, 158, 11, 0.7),
    0 18px 36px rgba(70, 30, 20, 0.3);
  z-index: 30;
}

.button-digit {
  font-size: 4.2rem;
  font-weight: 900;
  color: var(--motriz-red-primary);
  line-height: 1;
}

.grabbed-badge {
  font-size: 0.78rem;
  font-weight: 900;
  color: var(--motriz-amber);
  text-transform: uppercase;
  margin-top: 4px;
}

@keyframes hudShake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-10px); }
  75% { transform: translateX(10px); }
}

@media (max-width: 900px) {
  .target-slot,
  .target-result-pill,
  .giant-number-button {
    width: 105px;
    height: 105px;
  }
  .giant-number-button {
    margin-left: -52px;
    margin-top: -52px;
  }
  .slotted-digit,
  .result-digit,
  .button-digit {
    font-size: 3rem;
  }
  .equation-math-op,
  .equation-math-equals {
    font-size: 3rem;
  }
}
</style>
