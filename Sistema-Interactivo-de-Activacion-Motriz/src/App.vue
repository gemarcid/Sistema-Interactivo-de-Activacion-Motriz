<script setup>
import { ref } from 'vue'
import { useProfiles } from './composables/useProfiles'
import MotrizBackgroundCamera from './components/layout/MotrizBackgroundCamera.vue'
import MotrizHandCursor from './components/layout/MotrizHandCursor.vue'
import MotrizHeader from './components/layout/MotrizHeader.vue'
import MotrizHomeView from './components/views/MotrizHomeView.vue'
import MotrizCalibrationView from './components/views/MotrizCalibrationView.vue'
import MotrizWalkTestView from './components/views/MotrizWalkTestView.vue'
import MotrizRestView from './components/views/MotrizRestView.vue'
import MotrizMoveRememberView from './components/views/MotrizMoveRememberView.vue'
import MotrizMathOrderView from './components/views/MotrizMathOrderView.vue'
import MotrizCompletedView from './components/views/MotrizCompletedView.vue'
import MotrizTestingLabView from './components/views/MotrizTestingLabView.vue'
import MotrizInitialForm from './components/forms/MotrizInitialForm.vue'
import MotrizProfileModal from './components/modals/MotrizProfileModal.vue'
import MotrizProgressModal from './components/modals/MotrizProgressModal.vue'
import MotrizSettingsModal from './components/modals/MotrizSettingsModal.vue'
import MotrizHelpModal from './components/modals/MotrizHelpModal.vue'

const { isLeftHanded, isRightHanded, dominantHand } = useProfiles()

// Estado de la vista activa en el flujo de juego
// 'home' -> 'walk-test' -> 'rest' -> 'move-remember' -> 'completed' | 'lab'
const currentView = ref('home')

// Pantalla inicial del formulario del paciente (se muestra al iniciar o al solicitarlo)
const showInitialForm = ref(true)

// Modals
const showProfileModal = ref(false)
const showProgressModal = ref(false)
const showSettingsModal = ref(false)
const showHelpModal = ref(false)

function handleInitialFormComplete() {
  showInitialForm.value = false
}

// Inicia el flujo guiado de la sesión: arranca en la caminata
function handleStartNewGame() {
  currentView.value = 'walk-test'
}

// Al terminar la caminata (30s) -> pasa a la pantalla de descanso (30s)
function handleWalkTestFinish() {
  currentView.value = 'rest'
}

// Al confirmar continuar desde el descanso -> pasa a Mueve y Recuerda
function handleRestContinue() {
  currentView.value = 'move-remember'
}

// Al terminar la ronda de Mueve y Recuerda -> pasa a la pantalla de completado
function handleMoveRememberFinish() {
  currentView.value = 'completed'
}

function handleMathOrderFinish() {
  currentView.value = 'completed'
}

function handleOpenLab() {
  currentView.value = 'lab'
}

function handleOpenOriginalCIF() {
  showSettingsModal.value = false
  currentView.value = 'lab'
}

function handleExitToHome() {
  currentView.value = 'home'
}
</script>

<template>
  <div
    class="app-root"
    :class="{
      'hand-left-active': isLeftHanded,
      'hand-right-active': isRightHanded,
    }"
    :data-dominant-hand="dominantHand.toLowerCase()"
  >
    <MotrizBackgroundCamera :show-startup="currentView === 'home'" />

    <!-- 2. VIRTUAL HAND CURSOR (Tracks hand movement & performs dwell click; mouse also works natively) -->
    <MotrizHandCursor />

    <!-- 3. TOP ASISTENCIA MOTRIZ HEADER -->
    <MotrizHeader
      v-if="currentView !== 'completed'"
      :show-back="currentView !== 'home'"
      :back-label="currentView === 'home' ? '' : 'Salir al Menú'"
      @back="handleExitToHome"
      @open-settings="showSettingsModal = true"
      @open-help="showHelpModal = true"
      @open-profiles="showProfileModal = true"
      @open-patient-form="showInitialForm = true"
    />

    <!-- 4. ACTIVE VIEW LAYER (Flujo interactivo guiado) -->
    <main class="motriz-main-stage">
      <!-- 1. Menú Principal -->
      <MotrizHomeView
        v-if="currentView === 'home'"
        @start-game="handleStartNewGame"
        @create-profile="showInitialForm = true"
        @open-lab="handleOpenLab"
      />

      <!-- 2. Flujo Paso 1: Caminata Test (con silueta cintura para abajo + botón comenzar arriba) -->
      <MotrizWalkTestView
        v-else-if="currentView === 'walk-test'"
        @finish="handleWalkTestFinish"
        @exit="handleExitToHome"
      />

      <!-- 3. Flujo Paso 2: Descanso de 30s (pregunta si continuar o 30s más en bucle + botón arriba) -->
      <MotrizRestView
        v-else-if="currentView === 'rest'"
        :duration="30"
        @continue="handleRestContinue"
        @exit="handleExitToHome"
      />

      <!-- 4. Flujo Paso 3: Mueve y Recuerda (con silueta cintura para arriba + botón comenzar arriba) -->
      <MotrizMoveRememberView
        v-else-if="currentView === 'move-remember'"
        @finish="handleMoveRememberFinish"
        @exit="handleExitToHome"
      />

      <MotrizMathOrderView
        v-else-if="currentView === 'math-order'"
        @finish="handleMathOrderFinish"
        @exit="handleExitToHome"
      />

      <!-- 5. Flujo Paso 4: Sesión Completada (Trofeo, estrellas, felicitaciones) -->
      <MotrizCompletedView
        v-else-if="currentView === 'completed'"
        @menu="handleExitToHome"
        @next-level="handleStartNewGame"
        @finish="handleExitToHome"
      />

      <!-- Calibración Independiente (si se invoca aisladamente) -->
      <MotrizCalibrationView
        v-else-if="currentView === 'calibration'"
        @start-play="handleWalkTestFinish"
        @exit="handleExitToHome"
      />

      <!-- Zona de Pruebas y Prototipos CIF -->
      <MotrizTestingLabView
        v-else-if="currentView === 'lab'"
        @back="handleExitToHome"
        @open-move-remember="currentView = 'move-remember'"
      />
    </main>

    <!-- 5. PANTALLA INICIAL: FORMULARIO DEL PACIENTE (Con mano dominante y guardado en SQLite) -->
    <MotrizInitialForm
      v-if="showInitialForm"
      @complete="handleInitialFormComplete"
      @cancel="showInitialForm = false"
    />

    <!-- 6. ASISTENCIA MOTRIZ MODALS -->
    <!-- Profile creation & selection (RF4, RF5, RF7) -->
    <MotrizProfileModal
      v-if="showProfileModal"
      @close="showProfileModal = false"
    />

    <!-- Progress & Activity Reports (RF3, RF9) -->
    <MotrizProgressModal
      v-if="showProgressModal"
      @close="showProgressModal = false"
    />

    <!-- Settings (Sound, camera, Zero-retention privacy RNF6) -->
    <MotrizSettingsModal
      v-if="showSettingsModal"
      @close="showSettingsModal = false"
      @open-original-cif="handleOpenOriginalCIF"
    />

    <!-- Help & Caregiver guidance -->
    <MotrizHelpModal
      v-if="showHelpModal"
      @close="showHelpModal = false"
    />
  </div>
</template>

<style scoped>
.app-root {
  position: relative;
  width: 100%;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.motriz-main-stage {
  flex: 1;
  min-height: 0;
  min-width: 0;
  position: relative;
  z-index: 10;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}
</style>
