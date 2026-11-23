<script setup>
import { ref } from 'vue'
import { playClickTone, playSelectTone } from '../../composables/useAudio'
import MotrizMathOrderGame from '../games/MotrizMathOrderGame.vue'

const emit = defineEmits(['finish', 'exit'])

const gameState = ref('intro')
const finalScore = ref(0)

function handleStart() {
  playSelectTone()
  gameState.value = 'playing'
}

function handleFinish(data) {
  finalScore.value = data?.score || 500
  emit('finish', {
    score: finalScore.value,
    hits: data?.rounds || 5,
    timeSpent: '1:10',
    stars: 3,
  })
}

function handleExit() {
  playClickTone()
  emit('exit')
}
</script>

<template>
  <div class="math-view-container motriz-ambient-bg">
    <div v-if="gameState === 'intro'" class="intro-card motriz-card">
      <div class="intro-badge">
        <span>ACTIVIDAD MOTRIZ Y COGNITIVA</span>
      </div>

      <h1 class="intro-title">Ordena los Números</h1>
      <p class="intro-description">
        Resuelve ecuaciones matemáticas sencillas arrastrando o señalando los números correctos con tu mano.
      </p>

      <div class="rules-box">
        <div class="rule-item">
          <span class="rule-icon">1</span>
          <p class="rule-text">Observa el resultado que se muestra en la pantalla.</p>
        </div>
        <div class="rule-item">
          <span class="rule-icon">2</span>
          <p class="rule-text">Lleva los números que necesites hasta las casillas vacías.</p>
        </div>
        <div class="rule-item">
          <span class="rule-icon">3</span>
          <p class="rule-text">Completa la suma o resta para pasar a la siguiente ronda.</p>
        </div>
      </div>

      <div class="actions-row">
        <button type="button" class="btn-motriz-primary btn-start-game" @click="handleStart">
          Comenzar Juego
        </button>
        <button type="button" class="btn-motriz-secondary btn-exit-intro" @click="handleExit">
          Volver
        </button>
      </div>
    </div>

    <MotrizMathOrderGame
      v-else-if="gameState === 'playing'"
      @finish="handleFinish"
      @exit="handleExit"
    />
  </div>
</template>

<style scoped>
.math-view-container {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: calc(100vh - 96px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  box-sizing: border-box;
}

.intro-card {
  max-width: 680px;
  width: 100%;
  padding: 40px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  animation: motrizPopIn 0.3s ease-out;
}

.intro-badge {
  background: #FDF2E9;
  border: 1.5px solid var(--motriz-amber);
  color: var(--motriz-amber);
  font-weight: 800;
  font-size: 0.88rem;
  padding: 6px 18px;
  border-radius: 9999px;
  letter-spacing: 0.05em;
}

.intro-title {
  margin: 0;
  font-size: 2.4rem;
  font-weight: 900;
  color: var(--motriz-red-primary);
}

.intro-description {
  margin: 0;
  font-size: 1.25rem;
  line-height: 1.5;
  color: var(--motriz-text-muted);
}

.rules-box {
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 100%;
  background: #F8F3EC;
  border: 1.5px solid #E5D8C7;
  border-radius: 20px;
  padding: 20px 24px;
  box-sizing: border-box;
  text-align: left;
}

.rule-item {
  display: flex;
  align-items: center;
  gap: 16px;
}

.rule-icon {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: var(--motriz-red-primary);
  color: #FFFFFF;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  font-weight: 800;
  flex-shrink: 0;
}

.rule-text {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 600;
  color: var(--motriz-text-main);
}

.actions-row {
  display: flex;
  gap: 16px;
  margin-top: 10px;
  flex-wrap: wrap;
  justify-content: center;
}

.btn-start-game {
  min-width: 240px;
}

.btn-exit-intro {
  min-width: 150px;
}
</style>
