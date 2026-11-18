<script setup>
import { ref } from 'vue'
import { useProfiles } from './composables/useProfiles'
import MotrizBackgroundCamera from './components/layout/MotrizBackgroundCamera.vue'
import MotrizHandCursor from './components/layout/MotrizHandCursor.vue'
import MotrizHeader from './components/layout/MotrizHeader.vue'
import MotrizHomeView from './components/views/MotrizHomeView.vue'
import MotrizCalibrationView from './components/views/MotrizCalibrationView.vue'
import MotrizTestingLabView from './components/views/MotrizTestingLabView.vue'
import MotrizMoveRememberView from './components/views/MotrizMoveRememberView.vue'
import MotrizInitialForm from './components/forms/MotrizInitialForm.vue'
import MotrizProfileModal from './components/modals/MotrizProfileModal.vue'
import MotrizProgressModal from './components/modals/MotrizProgressModal.vue'
import MotrizSettingsModal from './components/modals/MotrizSettingsModal.vue'
import MotrizHelpModal from './components/modals/MotrizHelpModal.vue'

const { isLeftHanded, isRightHanded, dominantHand } = useProfiles()

// Current active view
const currentView = ref('home') // 'home' | 'calibration' | 'lab'

// Pantalla inicial del formulario del paciente (se muestra al iniciar o al solicitarlo)
const showInitialForm = ref(true)

// Modals
const showProfileModal = ref(false)
const showProgressModal = ref(false)
const showSettingsModal = ref(false)
const showHelpModal = ref(false)

function handleInitialFormComplete(profile) {
  showInitialForm.value = false
}

function handleStartNewGame() {
  currentView.value = 'calibration'
}

function handleOpenLab() {
  currentView.value = 'lab'
}

function handleOpenOriginalCIF() {
  showSettingsModal.value = false
  currentView.value = 'lab'
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
    <MotrizBackgroundCamera :show-startup="currentView !== 'move-remember'" />

    <!-- 2. VIRTUAL HAND CURSOR (Tracks hand movement & performs dwell click; mouse also works natively) -->
    <MotrizHandCursor />

    <!-- 3. TOP ASISTENCIA MOTRIZ HEADER -->
    <MotrizHeader
      v-if="currentView !== 'move-remember'"
      :show-back="currentView !== 'home'"
      :back-label="currentView === 'calibration' ? 'Salir' : 'Menú Principal'"
      @back="currentView = 'home'"
      @open-settings="showSettingsModal = true"
      @open-help="showHelpModal = true"
      @open-profiles="showProfileModal = true"
      @open-patient-form="showInitialForm = true"
    />

    <!-- 4. ACTIVE VIEW LAYER (Floating seamlessly over the fullscreen live camera) -->
    <main class="motriz-main-stage">
      <!-- Main Menu (Screen 1 with Fullscreen Camera) -->
      <MotrizHomeView
        v-if="currentView === 'home'"
        @start-game="handleStartNewGame"
        @create-profile="showInitialForm = true"
        @open-lab="handleOpenLab"
      />

      <!-- Preparation & Calibration Screen (Screen 3 with Fullscreen Silhouette) -->
      <MotrizCalibrationView
        v-else-if="currentView === 'calibration'"
        @start-play="handleOpenLab"
        @exit="currentView = 'home'"
      />

      <!-- Testing Lab: Preserves original UNACH CIF game + prototypes without deleting anything -->
      <MotrizTestingLabView
        v-else-if="currentView === 'lab'"
        @back="currentView = 'home'"
        @open-move-remember="currentView = 'move-remember'"
      />

      <MotrizMoveRememberView
        v-else-if="currentView === 'move-remember'"
        @exit="handleOpenLab"
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
