<script setup>
import { ref } from 'vue'
import { playClickTone } from '../../composables/useAudio'
import { useCamera } from '../../composables/useCamera'
import MotrizCalibrationView from './MotrizCalibrationView.vue'
import MotrizMathOrderGame from '../games/MotrizMathOrderGame.vue'

const emit = defineEmits(['finish', 'exit'])

const { bodyDetected } = useCamera()
const phase = ref('calibration')

const mathTips = [
  {
    icon: '🙌',
    title: 'Brazos despejados',
    text: 'Espacio libre para levantar los brazos a los lados y alcanzar los números.',
  },
  {
    icon: '🔢',
    title: 'Calcula y resuelve',
    text: 'Observa la suma o resta y busca los números que den el resultado.',
  },
  {
    icon: '⏱️',
    title: 'Coloca cada número',
    text: 'Lleva los números a las casillas vacías con tus manos hasta que el sistema los registre.',
  },
]

function handleGameFinish(data) {
  emit('finish', {
    score: data?.score || 500,
    hits: data?.rounds || 5,
    timeSpent: '1:15',
    stars: 3,
  })
}

function handleExit() {
  playClickTone()
  emit('exit')
}
</script>

<template>
  <div class="math-view-container">
    <MotrizCalibrationView
      v-if="phase === 'calibration'"
      mode="math-order"
      title="Ordena los Números"
      lead-text="Calibración de cintura para arriba • Prepara tus brazos y manos"
      button-text="COMENZAR JUEGO"
      :custom-tips="mathTips"
      :start-status="bodyDetected
        ? 'Brazos y manos detectados. ¡Puedes comenzar!'
        : 'Párate mostrando tu torso y manos frente a la pantalla.'"
      @start-play="phase = 'playing'"
      @exit="handleExit"
    />

    <MotrizMathOrderGame
      v-else-if="phase === 'playing'"
      @finish="handleGameFinish"
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
  background: transparent;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
</style>
