import { reactive } from 'vue'
import { playClickTone, playSuccessChime, playPopTone } from './useAudio'
import { useProfiles } from './useProfiles'

// Global hand cursor state
export const handCursorState = reactive({
  disabled: false, // <-- Propiedad para silenciar/apagar el cursor a demanda
  active: false,
  x: window.innerWidth / 2,
  y: window.innerHeight / 2,
  smoothX: window.innerWidth / 2,
  smoothY: window.innerHeight / 2,
  isHovering: false,
  dwellProgress: 0, // 0 to 1
  hoverTargetName: '',
  lastClickedAt: 0,
})

let currentHoverElement = null
let dwellTimer = 0
let enabled = true
const DWELL_DURATION = 0.32 // Reducido a la mitad para una activación ultra rápida y fluida

export function useHandCursor() {
  const { dominantHand } = useProfiles()

  const VISIBILITY_THRESHOLD = 0.2

  function deactivateCursor() {
    handCursorState.active = false
    handCursorState.isHovering = false
    handCursorState.dwellProgress = 0
    currentHoverElement = null
  }

  function pickVisibleLandmark(indexLm, wristLm) {
    if (indexLm && (indexLm.visibility ?? 1) >= VISIBILITY_THRESHOLD) {
      return indexLm
    }
    if (wristLm && (wristLm.visibility ?? 1) >= VISIBILITY_THRESHOLD) {
      return wristLm
    }
    return null
  }

  function updateHandCursor(landmarks, videoWidth, videoHeight, dt = 0.016) {
    if (!enabled || handCursorState.disabled || !landmarks || landmarks.length === 0) {
      deactivateCursor()
      return
    }

    // MediaPipe Pose Landmarks:
    // 15: left_wrist, 16: right_wrist, 19: left_index, 20: right_index
    // Seguir ESTRICTAMENTE únicamente la mano dominante configurada (sin cambiar a la otra mano)
    const isLeftDominant = dominantHand.value === 'IZQUIERDA'
    const chosenHand = isLeftDominant
      ? pickVisibleLandmark(landmarks[19], landmarks[15])
      : pickVisibleLandmark(landmarks[20], landmarks[16])

    if (!chosenHand) {
      deactivateCursor()
      return
    }

    handCursorState.active = true

    // Mirroring: user right hand is on physical right
    const mirroredX = 1 - chosenHand.x
    const mirroredY = chosenHand.y

    // Reach amplification (1.45x from center) so seniors don't strain to reach edges
    const centerX = 0.5
    const centerY = 0.5
    const gain = 1.45

    const targetNormX = Math.max(0.04, Math.min(0.96, centerX + (mirroredX - centerX) * gain))
    const targetNormY = Math.max(0.04, Math.min(0.96, centerY + (mirroredY - centerY) * gain))

    const targetScreenX = targetNormX * window.innerWidth
    const targetScreenY = targetNormY * window.innerHeight

    // Exponential smoothing / Lerp
    const lerpSpeed = 0.32
    handCursorState.smoothX += (targetScreenX - handCursorState.smoothX) * lerpSpeed
    handCursorState.smoothY += (targetScreenY - handCursorState.smoothY) * lerpSpeed

    handCursorState.x = handCursorState.smoothX
    handCursorState.y = handCursorState.smoothY

    // Process Hover and Dwell Click
    processHoverAndDwell(handCursorState.x, handCursorState.y, dt)
  }

  function processHoverAndDwell(x, y, dt) {
    const now = performance.now()
    if (now - handCursorState.lastClickedAt < 350) {
      handCursorState.dwellProgress = 0
      return
    }

    // Find interactive element under hand cursor
    const element = document.elementFromPoint(x, y)
    const clickable = findClickable(element)

    if (clickable) {
      handCursorState.isHovering = true
      handCursorState.hoverTargetName = clickable.innerText?.slice(0, 20) || 'Botón'

      if (clickable === currentHoverElement) {
        dwellTimer += dt
        handCursorState.dwellProgress = Math.min(1, dwellTimer / DWELL_DURATION)

        if (dwellTimer >= DWELL_DURATION) {
          triggerClick(clickable)
          dwellTimer = 0
          handCursorState.dwellProgress = 0
          handCursorState.lastClickedAt = now
        }
      } else {
        currentHoverElement = clickable
        dwellTimer = 0
        handCursorState.dwellProgress = 0
      }
    } else {
      handCursorState.isHovering = false
      handCursorState.hoverTargetName = ''
      handCursorState.dwellProgress = 0
      currentHoverElement = null
      dwellTimer = 0
    }
  }

  function findClickable(el) {
    if (!el) return null
    let curr = el
    while (curr && curr !== document.body) {
      const tag = curr.tagName?.toLowerCase()
      if (
        tag === 'button' ||
        tag === 'a' ||
        curr.getAttribute('role') === 'button' ||
        curr.classList?.contains('clickable') ||
        curr.classList?.contains('profile-item-card') ||
        curr.classList?.contains('logo-area') ||
        curr.classList?.contains('hand-card-btn')
      ) {
        if (!curr.disabled && !curr.classList?.contains('disabled')) {
          return curr
        }
      }
      curr = curr.parentElement
    }
    return null
  }

  function triggerClick(el) {
    playClickTone()
    el.click()
  }

  function setHandCursorEnabled(value) {
    enabled = value
    if (!enabled) deactivateCursor()
  }

  return {
    handCursorState,
    updateHandCursor,
    setHandCursorEnabled,
  }
}
