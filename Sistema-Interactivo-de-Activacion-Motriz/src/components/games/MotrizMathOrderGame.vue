<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch } from 'vue'
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
const feedback = ref('Toca o acerca tu mano a los números para colocarlos en las casillas')
const feedbackType = ref('normal')
const isChecking = ref(false)
const roundFinished = ref(false)

const currentEquation = ref(createEquation(1))
const cardPool = ref(generateCardPool(currentEquation.value))

const slot1Card = ref(null)
const slot2Card = ref(null)
const selectedFloatingCard = ref(null)

const slot1El = ref(null)
const slot2El = ref(null)
const poolAreaEl = ref(null)

let checkTimeout = null
let handTrackInterval = null
let lastHandOverCardId = null
let handDwellCounter = 0

const equationTarget = computed(() => currentEquation.value.target)
const equationOperator = computed(() => currentEquation.value.operator)

const availableCards = computed(() => {
  return cardPool.value.filter(
    (card) => card.id !== slot1Card.value?.id && card.id !== slot2Card.value?.id
  )
})

onMounted(() => {
  startRound(1)
  handTrackInterval = setInterval(checkHandInteractions, 100)
})

onBeforeUnmount(() => {
  if (checkTimeout) clearTimeout(checkTimeout)
  if (handTrackInterval) clearInterval(handTrackInterval)
})

function startRound(roundNum) {
  currentRound.value = roundNum
  currentEquation.value = createEquation(roundNum)
  cardPool.value = generateCardPool(currentEquation.value)
  slot1Card.value = null
  slot2Card.value = null
  selectedFloatingCard.value = null
  isChecking.value = false
  roundFinished.value = false
  feedback.value = equationOperator.value === '+'
    ? 'Encuentra dos números que sumados den ' + equationTarget.value
    : 'Encuentra dos números que restados den ' + equationTarget.value
  feedbackType.value = 'normal'
}

function selectCard(card) {
  if (isChecking.value || roundFinished.value) return

  if (selectedFloatingCard.value?.id === card.id) {
    selectedFloatingCard.value = null
    playClickTone()
    return
  }

  selectedFloatingCard.value = card
  playSelectTone()

  if (!slot1Card.value) {
    placeCardInSlot(card, 1)
  } else if (!slot2Card.value) {
    placeCardInSlot(card, 2)
  }
}

function placeCardInSlot(card, slotNumber) {
  if (slotNumber === 1) {
    slot1Card.value = card
  } else if (slotNumber === 2) {
    slot2Card.value = card
  }

  selectedFloatingCard.value = null
  playPopTone()

  if (slot1Card.value && slot2Card.value) {
    evaluateResult()
  }
}

function removeCardFromSlot(slotNumber) {
  if (isChecking.value || roundFinished.value) return

  playClickTone()
  if (slotNumber === 1 && slot1Card.value) {
    slot1Card.value = null
  } else if (slotNumber === 2 && slot2Card.value) {
    slot2Card.value = null
  }
  feedback.value = 'Puedes elegir otro número para la casilla vacía'
  feedbackType.value = 'normal'
}

function evaluateResult() {
  isChecking.value = true
  const v1 = slot1Card.value.value
  const v2 = slot2Card.value.value
  const op = equationOperator.value
  const target = equationTarget.value

  const isCorrect = validateSolution(v1, v2, op, target)

  if (isCorrect) {
    feedbackType.value = 'success'
    feedback.value = `¡Excelente! ${v1} ${op} ${v2} = ${target}`
    score.value += 100
    playSuccessChime()

    checkTimeout = setTimeout(() => {
      if (currentRound.value < TOTAL_ROUNDS) {
        startRound(currentRound.value + 1)
      } else {
        roundFinished.value = true
        playFanfareTune()
        emit('finish', {
          score: score.value,
          rounds: TOTAL_ROUNDS,
        })
      }
    }, 1800)
  } else {
    feedbackType.value = 'error'
    feedback.value = `${v1} ${op} ${v2} no es igual a ${target}. ¡Inténtalo de nuevo!`
    playPopTone()

    checkTimeout = setTimeout(() => {
      slot1Card.value = null
      slot2Card.value = null
      isChecking.value = false
      feedback.value = 'Prueba con otra combinación de números'
      feedbackType.value = 'normal'
    }, 1500)
  }
}

function checkHandInteractions() {
  if (isChecking.value || roundFinished.value || !handCursorState.active) {
    lastHandOverCardId = null
    handDwellCounter = 0
    return
  }

  const hx = handCursorState.x
  const hy = handCursorState.y

  if (selectedFloatingCard.value) {
    if (slot1El.value && !slot1Card.value) {
      const r1 = slot1El.value.getBoundingClientRect()
      if (hx >= r1.left && hx <= r1.right && hy >= r1.top && hy <= r1.bottom) {
        placeCardInSlot(selectedFloatingCard.value, 1)
        return
      }
    }
    if (slot2El.value && !slot2Card.value) {
      const r2 = slot2El.value.getBoundingClientRect()
      if (hx >= r2.left && hx <= r2.right && hy >= r2.top && hy <= r2.bottom) {
        placeCardInSlot(selectedFloatingCard.value, 2)
        return
      }
    }
  }

  const cardElements = document.querySelectorAll('.draggable-number-card')
  let hoveredCard = null

  cardElements.forEach((el) => {
    const rect = el.getBoundingClientRect()
    if (hx >= rect.left && hx <= rect.right && hy >= rect.top && hy <= rect.bottom) {
      const cardId = el.getAttribute('data-card-id')
      hoveredCard = cardPool.value.find((c) => c.id === cardId)
    }
  })

  if (hoveredCard) {
    if (lastHandOverCardId === hoveredCard.id) {
      handDwellCounter++
      if (handDwellCounter >= 3) {
        selectCard(hoveredCard)
        handDwellCounter = 0
        lastHandOverCardId = null
      }
    } else {
      lastHandOverCardId = hoveredCard.id
      handDwellCounter = 1
    }
  } else {
    lastHandOverCardId = null
    handDwellCounter = 0
  }
}

function handleExit() {
  playClickTone()
  emit('exit')
}
</script>

<template>
  <div class="math-game-root" :class="{ 'layout-left-hand': isLeftHanded }">
    <header class="game-top-bar">
      <button type="button" class="btn-round-action btn-back-game" @click="handleExit" title="Salir">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
      </button>

      <div class="round-badge">
        <span class="badge-title">Ecuación {{ currentRound }} de {{ TOTAL_ROUNDS }}</span>
      </div>

      <div class="score-display">
        <span class="score-label">Puntaje</span>
        <strong class="score-value">{{ score }}</strong>
      </div>
    </header>

    <div class="instruction-banner" :class="feedbackType">
      <p class="instruction-text">{{ feedback }}</p>
    </div>

    <section class="equation-board motriz-card" :class="{ 'eval-success': feedbackType === 'success', 'eval-error': feedbackType === 'error' }">
      <div
        ref="slot1El"
        class="equation-slot clickable"
        :class="{ 'slot-filled': slot1Card, 'slot-highlight': selectedFloatingCard && !slot1Card }"
        @click="slot1Card ? removeCardFromSlot(1) : (selectedFloatingCard && placeCardInSlot(selectedFloatingCard, 1))"
      >
        <div v-if="slot1Card" class="slotted-number-content">
          <span class="slotted-num">{{ slot1Card.value }}</span>
          <span class="slot-remove-hint">×</span>
        </div>
        <div v-else class="slot-placeholder">
          <span>?</span>
        </div>
      </div>

      <div class="equation-operator">
        <span>{{ equationOperator }}</span>
      </div>

      <div
        ref="slot2El"
        class="equation-slot clickable"
        :class="{ 'slot-filled': slot2Card, 'slot-highlight': selectedFloatingCard && !slot2Card }"
        @click="slot2Card ? removeCardFromSlot(2) : (selectedFloatingCard && placeCardInSlot(selectedFloatingCard, 2))"
      >
        <div v-if="slot2Card" class="slotted-number-content">
          <span class="slotted-num">{{ slot2Card.value }}</span>
          <span class="slot-remove-hint">×</span>
        </div>
        <div v-else class="slot-placeholder">
          <span>?</span>
        </div>
      </div>

      <div class="equation-equals">
        <span>=</span>
      </div>

      <div class="equation-target-box">
        <span class="target-value">{{ equationTarget }}</span>
      </div>
    </section>

    <div class="hand-guidance-pill" v-if="bodyDetected">
      <span class="pill-dot"></span>
      <span>Mueve tu mano hacia los números para elegirlos y ordenarlos</span>
    </div>

    <section ref="poolAreaEl" class="numbers-pool-stage">
      <div
        v-for="card in availableCards"
        :key="card.id"
        :data-card-id="card.id"
        class="draggable-number-card clickable"
        :class="{ 'card-selected': selectedFloatingCard?.id === card.id }"
        @click="selectCard(card)"
      >
        <span class="number-digit">{{ card.value }}</span>
      </div>
    </section>
  </div>
</template>

<style scoped>
.math-game-root {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: calc(100vh - 96px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px 32px;
  box-sizing: border-box;
  background-color: var(--motriz-bg-warm);
}

.game-top-bar {
  width: 100%;
  max-width: 1020px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  z-index: 20;
}

.btn-back-game {
  width: 54px;
  height: 54px;
}

.round-badge {
  background: var(--motriz-bg-card);
  border: 2px solid var(--motriz-card-border);
  padding: 10px 24px;
  border-radius: 9999px;
  box-shadow: var(--motriz-shadow-sm);
}

.badge-title {
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--motriz-red-primary);
}

.score-display {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  background: var(--motriz-bg-card);
  border: 2px solid var(--motriz-card-border);
  padding: 8px 20px;
  border-radius: 18px;
  box-shadow: var(--motriz-shadow-sm);
}

.score-label {
  font-size: 0.82rem;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--motriz-text-muted);
}

.score-value {
  font-size: 1.5rem;
  font-weight: 900;
  color: var(--motriz-amber);
}

.instruction-banner {
  width: 100%;
  max-width: 860px;
  padding: 14px 28px;
  border-radius: 20px;
  margin-bottom: 16px;
  text-align: center;
  transition: all 0.25s ease;
  background: var(--motriz-bg-card);
  border: 2px solid var(--motriz-card-border);
  box-shadow: var(--motriz-shadow-sm);
}

.instruction-banner.success {
  background: #ECFDF5;
  border-color: #10B981;
  color: #065F46;
  transform: scale(1.02);
}

.instruction-banner.error {
  background: #FEF2F2;
  border-color: #EF4444;
  color: #991B1B;
  animation: shake 0.4s ease-in-out;
}

.instruction-text {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--motriz-text-main);
}

.instruction-banner.success .instruction-text {
  color: #065F46;
}

.instruction-banner.error .instruction-text {
  color: #991B1B;
}

.equation-board {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  padding: 24px 36px;
  border-radius: 32px;
  background: var(--motriz-bg-card);
  border: 3px solid var(--motriz-card-border);
  box-shadow: var(--motriz-shadow-md);
  margin-bottom: 16px;
  transition: all 0.3s ease;
}

.equation-board.eval-success {
  border-color: #10B981;
  box-shadow: 0 0 30px rgba(16, 185, 129, 0.35);
}

.equation-board.eval-error {
  border-color: #EF4444;
  box-shadow: 0 0 25px rgba(239, 68, 68, 0.3);
}

.equation-slot {
  width: 110px;
  height: 110px;
  border-radius: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 3px dashed var(--motriz-text-light);
  background: #F4EDE2;
  cursor: pointer;
  position: relative;
  transition: all 0.2s ease;
}

.equation-slot:hover {
  transform: translateY(-2px);
  border-color: var(--motriz-red-primary);
}

.equation-slot.slot-highlight {
  border-style: solid;
  border-color: var(--motriz-gold);
  background: #FFFBEB;
  box-shadow: 0 0 18px rgba(245, 158, 11, 0.4);
  transform: scale(1.05);
}

.equation-slot.slot-filled {
  border-style: solid;
  border-color: var(--motriz-red-primary);
  background: linear-gradient(180deg, #FFFFFF 0%, #FAF2E8 100%);
  box-shadow: var(--motriz-shadow-sm);
}

.slotted-number-content {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  position: relative;
}

.slotted-num {
  font-size: 3.2rem;
  font-weight: 900;
  color: var(--motriz-red-primary);
}

.slot-remove-hint {
  position: absolute;
  top: 4px;
  right: 8px;
  font-size: 1.1rem;
  font-weight: 800;
  color: var(--motriz-text-muted);
  opacity: 0.7;
}

.slot-placeholder {
  font-size: 2.8rem;
  font-weight: 700;
  color: var(--motriz-text-light);
}

.equation-operator,
.equation-equals {
  font-size: 3.5rem;
  font-weight: 900;
  color: var(--motriz-red-primary);
  user-select: none;
}

.equation-target-box {
  width: 110px;
  height: 110px;
  border-radius: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(180deg, #A82435 0%, #8C1D2C 100%);
  border: 3px solid #6E1220;
  box-shadow: var(--motriz-pill-shadow);
}

.target-value {
  font-size: 3.2rem;
  font-weight: 900;
  color: #FFFFFF;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.35);
}

.hand-guidance-pill {
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(255, 255, 255, 0.9);
  border: 1.5px solid var(--motriz-card-border);
  padding: 8px 20px;
  border-radius: 9999px;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--motriz-text-muted);
  box-shadow: var(--motriz-shadow-sm);
  margin-bottom: 12px;
}

.pill-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #10B981;
  box-shadow: 0 0 8px #10B981;
}

.numbers-pool-stage {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 24px;
  width: 100%;
  max-width: 820px;
  min-height: 140px;
  padding: 18px 20px;
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.6);
  border: 2px dashed #E2D2C1;
  box-sizing: border-box;
}

.draggable-number-card {
  width: 105px;
  height: 105px;
  border-radius: 24px;
  background: linear-gradient(180deg, #FFFFFF 0%, #F8EFE4 100%);
  border: 3px solid #DECBB7;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow:
    inset 0 2px 2px rgba(255, 255, 255, 0.9),
    0 8px 18px rgba(70, 30, 20, 0.12);
  transition: all 0.22s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.draggable-number-card:hover {
  transform: translateY(-5px) scale(1.06);
  border-color: var(--motriz-red-primary);
  box-shadow:
    inset 0 2px 2px rgba(255, 255, 255, 1),
    0 14px 26px rgba(140, 29, 44, 0.22);
}

.draggable-number-card:active {
  transform: scale(0.96);
}

.draggable-number-card.card-selected {
  border-color: var(--motriz-gold);
  background: #FFFBEB;
  transform: translateY(-8px) scale(1.1);
  box-shadow:
    0 0 24px rgba(245, 158, 11, 0.5),
    0 12px 24px rgba(70, 30, 20, 0.18);
}

.number-digit {
  font-size: 3.2rem;
  font-weight: 900;
  color: var(--motriz-red-primary);
  user-select: none;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-8px); }
  40%, 80% { transform: translateX(8px); }
}

@media (max-width: 768px) {
  .equation-slot,
  .equation-target-box {
    width: 80px;
    height: 80px;
  }
  .slotted-num,
  .target-value,
  .number-digit {
    font-size: 2.3rem;
  }
  .draggable-number-card {
    width: 80px;
    height: 80px;
  }
}
</style>
