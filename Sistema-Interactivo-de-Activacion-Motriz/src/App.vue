<script setup>
import { ref } from 'vue'
import { useProfiles } from './composables/useProfiles'
import MotrizBackgroundCamera from './components/motriz/MotrizBackgroundCamera.vue'
import MotrizHandCursor from './components/motriz/MotrizHandCursor.vue'
import MotrizHeader from './components/motriz/MotrizHeader.vue'
import MotrizHomeView from './components/motriz/MotrizHomeView.vue'
import MotrizCalibrationView from './components/motriz/MotrizCalibrationView.vue'
import MotrizTestingLabView from './components/motriz/MotrizTestingLabView.vue'
import MotrizInitialForm from './components/motriz/MotrizInitialForm.vue'
import MotrizProfileModal from './components/motriz/MotrizProfileModal.vue'
import MotrizProgressModal from './components/motriz/MotrizProgressModal.vue'
import MotrizSettingsModal from './components/motriz/MotrizSettingsModal.vue'
import MotrizHelpModal from './components/motriz/MotrizHelpModal.vue'

const { isLeftHanded, isRightHanded, dominantHand } = useProfiles()

const currentView = ref('home') 

const showInitialForm = ref(true)

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
    <MotrizBackgroundCamera />

    <MotrizHandCursor />

    <MotrizHeader
      :show-back="currentView !== 'home'"
      :back-label="currentView === 'calibration' ? 'Salir' : 'Menú Principal'"
      @back="currentView = 'home'"
      @open-settings="showSettingsModal = true"
      @open-help="showHelpModal = true"
      @open-profiles="showProfileModal = true"
      @open-abuelo-form="showInitialForm = true"
    />

    <main class="motriz-main-stage">
      <MotrizHomeView
        v-if="currentView === 'home'"
        @start-game="handleStartNewGame"
        @create-profile="showInitialForm = true"
        @open-lab="handleOpenLab"
      />

      <MotrizCalibrationView
        v-else-if="currentView === 'calibration'"
        @start-play="handleOpenLab"
        @exit="currentView = 'home'"
      />

      <MotrizTestingLabView
        v-else-if="currentView === 'lab'"
        @back="currentView = 'home'"
      />
    </main>

    <MotrizInitialForm
      v-if="showInitialForm"
      @complete="handleInitialFormComplete"
      @cancel="showInitialForm = false"
    />


    <MotrizProfileModal
      v-if="showProfileModal"
      @close="showProfileModal = false"
    />

    <MotrizProgressModal
      v-if="showProgressModal"
      @close="showProgressModal = false"
    />

    <MotrizSettingsModal
      v-if="showSettingsModal"
      @close="showSettingsModal = false"
      @open-original-cif="handleOpenOriginalCIF"
    />

    <MotrizHelpModal
      v-if="showHelpModal"
      @close="showHelpModal = false"
    />
  </div>
</template>

<style scoped>
.app-root {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: all 0.3s ease;
}

.motriz-main-stage {
  flex-grow: 1;
  position: relative;
  z-index: 10;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}
</style>
