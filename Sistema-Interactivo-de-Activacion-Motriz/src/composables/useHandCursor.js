import { reactive } from 'vue'
import { playClickTone, playSuccessChime, playPopTone } from './useAudio'
import { useProfiles } from './useProfiles'

// Global hand cursor state
export const handCursorState = reactive({
  disabled: false, // <-- Propiedad para silenciar/apagar el cursor a demanda
  onlyShowOnHover: false, // <-- En juegos: solo se muestra al pasar la mano sobre botones
  active: false,
  x: window.innerWidth / 2,
  y: window.innerHeight / 2,
  isHovering: false,
  dwellProgress: 0, // 0 to 1
  hoverTargetName: '',
  lastClickedAt: 0,
})

let currentHoverElement = null
let dwellTimer = 0
let enabled = true
let cursorArea = null
const DWELL_DURATION = 0.32 // Reducido a la mitad para una activación ultra rápida y fluida

export function useHandCursor() {
  const { dominantHand } = useProfiles()

  const VISIBILITY_THRESHOLD = 0.2

  function deactivateCursor() {
    handCursorState.active = false
    handCursorState.isHovering = false
    handCursorState.dwellProgress = 0
    currentHoverElement = null
    dwellTimer = 0
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

  function updateHandCursor(points, videoLeft = 0, videoTop = 0) {
    if (!enabled || handCursorState.disabled || !points?.length) {
      deactivateCursor()
      return
    }
    // MediaPipe Pose Landmarks:
    // 15: left_wrist, 16: right_wrist, 19: left_index, 20: right_index
    // Seguir ESTRICTAMENTE únicamente la mano dominante configurada (sin cambiar a la otra mano)
    const isLeftDominant = dominantHand.value === 'IZQUIERDA'
    const chosenHand = isLeftDominant
      ? pickVisibleLandmark(points[19], points[15])
      : pickVisibleLandmark(points[20], points[16])

    if (!chosenHand) {
      deactivateCursor()
      return
    }

    handCursorState.x = videoLeft + chosenHand.x
    handCursorState.y = videoTop + chosenHand.y

    if (cursorArea) {
      const bounds = cursorArea.getBoundingClientRect()
      if (handCursorState.x < bounds.left || handCursorState.x > bounds.right
        || handCursorState.y < bounds.top || handCursorState.y > bounds.bottom) {
        deactivateCursor()
        return
      }
    }

    handCursorState.active = true
    processHoverAndDwell(handCursorState.x, handCursorState.y, 0.016)
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

  function setHandCursorArea(element) {
    cursorArea = element
    deactivateCursor()
  }

  function setOnlyShowOnHover(value) {
    handCursorState.onlyShowOnHover = Boolean(value)
  }

  return {
    handCursorState,
    updateHandCursor,
    setHandCursorEnabled,
    setHandCursorArea,
    setOnlyShowOnHover,
  }
}
