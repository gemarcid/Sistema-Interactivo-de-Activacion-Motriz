<template>
  <div class="walk-test-view">
    <!-- Encabezado con Temporizador de 2 Minutos -->
    <div class="test-header">
      <h2>Prueba de Caminata Lenta (2 Minutos)</h2>
      <div class="timer-badge" :class="{ 'warning': timeLeft <= 10 }">
        ⏱️ {{ formattedTime }}
      </div>
      <button @click="finishTest" class="btn-motriz-primary">Volver</button>
    </div>
    
    <!-- Panel de Métricas en Tiempo Real -->
    <div class="metrics-dashboard">
      <div class="metric-card">
        <h3>Intensidad (Pasos)</h3>
        <p class="value">{{ stepCount }}</p>
      </div>
      <div class="metric-card">
        <h3>Amplitud Max</h3>
        <p class="value">{{ maxKneeAngle }}°</p>
      </div>
      <div class="metric-card">
        <h3>Centro de Masa (Y)</h3>
        <p class="value">{{ centerOfMassY }} px</p>
      </div>
    </div>

    <!-- Integración de la cámara -->
    <div class="camera-container">
      <MotrizBackgroundCamera @pose-detected="handlePose" />

      <!-- Pantalla / Modal de Finalización al cumplir los 2 Minutos -->
      <div v-if="isFinished" class="finished-overlay">
        <div class="finished-card">
          🎉
          <h3>¡Prueba Completada!</h3>
          <p>Resultados obtenidos en 2 minutos de caminata:</p>
          <div class="results-summary">
            <div><strong>Pasos totales:</strong> {{ stepCount }}</div>
            <div><strong>Flexión máxima alcanzada:</strong> {{ maxKneeAngle }}°</div>
          </div>
          <p class="cursor-notice">💡 El cursor de mano se ha reactivado.</p>
          <div class="modal-actions">
            <button @click="restartTest" class="btn-motriz-secondary">Repetir Prueba</button>
            <button @click="finishTest" class="btn-motriz-primary">Finalizar y Volver</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import MotrizBackgroundCamera from './MotrizBackgroundCamera.vue';
import { handCursorState } from '../../composables/useHandCursor';

const emit = defineEmits(['finish', 'exit']);

// Estado de Métricas
const stepCount = ref(0);
const maxKneeAngle = ref(0);
const centerOfMassY = ref(0);
const isStepActive = ref(false);

// Temporizador de 2 minutos (120 segundos)
const DURATION_SECONDS = 120;
const timeLeft = ref(DURATION_SECONDS);
const isFinished = ref(false);
let timerInterval = null;

// Formateador de tiempo MM:SS (ej: 02:00)
const formattedTime = computed(() => {
  const minutes = Math.floor(timeLeft.value / 60);
  const seconds = timeLeft.value % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
});

// Control del temporizador
const startTimer = () => {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (timeLeft.value > 0) {
      timeLeft.value--;
    } else {
      completeTest();
    }
  }, 1000);
};

// Finalización automática a los 2 minutos
const completeTest = () => {
  clearInterval(timerInterval);
  isFinished.value = true;
  // Reactivamos el cursor para poder usar los botones del modal de resultados
  handCursorState.disabled = false;
};

// Reiniciar la prueba
const restartTest = () => {
  stepCount.value = 0;
  maxKneeAngle.value = 0;
  centerOfMassY.value = 0;
  timeLeft.value = DURATION_SECONDS;
  isFinished.value = false;
  // Volvemos a apagar el cursor mientras vuelve a caminar
  handCursorState.disabled = true;
  startTimer();
};

const finishTest = () => {
  clearInterval(timerInterval);
  // Reactivamos el cursor antes de volver al menú
  handCursorState.disabled = false;
  emit('finish');
};

// Ciclo de vida
onMounted(() => {
  // Apaga el cursor al iniciar la caminata
  handCursorState.disabled = true;
  startTimer();
});

onUnmounted(() => {
  clearInterval(timerInterval);
  // Restaura el cursor globalmente si el usuario abandona este módulo
  handCursorState.disabled = false;
});

// Ángulo entre 3 puntos clave (Cadera, Rodilla, Tobillo)
const calculateAngle = (p1, p2, p3) => {
  const radians = Math.atan2(p3.y - p2.y, p3.x - p2.x) - Math.atan2(p1.y - p2.y, p1.x - p2.x);
  let angle = Math.abs(radians * 180.0 / Math.PI);
  if (angle > 180.0) angle = 360 - angle;
  return angle;
};

// Detección de pose
const handlePose = (keypoints) => {
  if (isFinished.value || !keypoints || keypoints.length === 0) return;

  const leftHip = keypoints.find(k => k.name === 'left_hip');
  const leftKnee = keypoints.find(k => k.name === 'left_knee');
  const leftAnkle = keypoints.find(k => k.name === 'left_ankle');
  const rightHip = keypoints.find(k => k.name === 'right_hip');

  // 1. Centro de Gravedad / Masa (Punto medio entre caderas)
  if (leftHip && rightHip && leftHip.score > 0.5 && rightHip.score > 0.5) {
    centerOfMassY.value = Math.round((leftHip.y + rightHip.y) / 2);
  }

  // 2. Ángulo y Pasos (Intensidad)
  if (leftHip && leftKnee && leftAnkle && leftHip.score > 0.5) {
    const kneeAngle = calculateAngle(leftHip, leftKnee, leftAnkle);
    const flexion = Math.round(180 - kneeAngle); 
    
    if (flexion > 0 && flexion > maxKneeAngle.value) {
      maxKneeAngle.value = flexion;
    }

    if (flexion > 30 && !isStepActive.value) {
      isStepActive.value = true;
      stepCount.value++;
    } else if (flexion < 20 && isStepActive.value) {
      isStepActive.value = false;
    }
  }
};
</script>

<style scoped>
.walk-test-view {
  padding: 20px;
  color: white;
  display: flex;
  flex-direction: column;
  gap: 20px;
  height: 100%;
}
.test-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.timer-badge {
  background: #1e293b;
  border: 2px solid #00dc82;
  color: #00dc82;
  font-size: 1.5rem;
  font-weight: bold;
  padding: 6px 18px;
  border-radius: 999px;
}
.timer-badge.warning {
  border-color: #ef4444;
  color: #ef4444;
  animation: pulse 1s infinite;
}
.metrics-dashboard {
  display: flex;
  gap: 20px;
  justify-content: center;
  z-index: 10;
}
.metric-card {
  background: rgba(30, 41, 59, 0.85);
  padding: 15px 25px;
  border-radius: 12px;
  text-align: center;
  border: 2px solid #00dc82;
  min-width: 150px;
}
.metric-card .value {
  font-size: 2rem;
  font-weight: bold;
  color: #00dc82;
  margin: 10px 0 0 0;
}
.camera-container {
  position: relative;
  width: 100%;
  flex-grow: 1;
  min-height: 50vh;
  border-radius: 15px;
  overflow: hidden;
  border: 2px solid rgba(255, 255, 255, 0.1);
}

/* Modal de Finalización */
.finished-overlay {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.85);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
}
.finished-card {
  background: #1e293b;
  border: 3px solid #00dc82;
  border-radius: 20px;
  padding: 30px;
  text-align: center;
  max-width: 450px;
  width: 90%;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
}
.finished-card h3 {
  font-size: 1.8rem;
  color: #00dc82;
  margin: 10px 0;
}
.results-summary {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  padding: 15px;
  margin: 20px 0;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.cursor-notice {
  font-size: 0.9rem;
  color: #94a3b8;
  margin-bottom: 20px;
}
.modal-actions {
  display: flex;
  gap: 15px;
  justify-content: center;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
</style>