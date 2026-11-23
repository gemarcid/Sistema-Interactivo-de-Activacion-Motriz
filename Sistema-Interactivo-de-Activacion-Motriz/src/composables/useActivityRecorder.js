import { onBeforeUnmount, watch } from 'vue'
import { useCamera } from './useCamera'

// Los tiempos se clasifican con el reloj monotónico y la visibilidad de la cámara.
export function useActivityRecorder(mode, joints, checkpoint) {
  const { bodyState } = useCamera()
  let activity = null
  let lastTime = 0
  let lastFrame = -Infinity
  let previousPoints = null
  let timer = null
  let lastCheckpoint = 0

  watch(() => bodyState.landmarks, () => { lastFrame = performance.now() })

  function sample() {
    if (!activity) return
    const now = performance.now()
    const seconds = (now - lastTime) / 1000
    lastTime = now
    const currentMode = mode()
    const points = joints.map((index) => bodyState.landmarks?.[index])
    const tracked = now - lastFrame < 500 && points.every((point) => point && point.visibility >= 0.5)
    let category = currentMode
    if (currentMode === 'exercise') {
      if (!tracked || seconds > 0.5) {
        category = 'trackingLostSeconds'
      } else {
        const displacement = previousPoints ? Math.max(...points.map((point, index) =>
          Math.hypot((point.x - previousPoints[index].x) * bodyState.videoAspect, point.y - previousPoints[index].y))) : 0
        // Umbral geométrico de movimiento en imagen, independiente del puntaje cognitivo.
        category = displacement / Math.max(seconds, 0.001) > 0.035 ? 'activeSeconds' : 'observedIdleSeconds'
      }
    }
    if (category) activity[category] = (activity[category] || 0) + seconds
    previousPoints = tracked ? points.map(({ x, y }) => ({ x, y })) : null
    if (checkpoint && now - lastCheckpoint >= 5000) {
      lastCheckpoint = now
      checkpoint({ ...activity })
    }
  }

  function begin(game) {
    stop()
    activity = {
      id: crypto.randomUUID(), game, startedAt: new Date().toISOString(),
      activeSeconds: 0, restSeconds: 0, observedIdleSeconds: 0, trackingLostSeconds: 0, memorySeconds: 0,
    }
    lastTime = performance.now()
    lastCheckpoint = lastTime
    previousPoints = null
    timer = setInterval(sample, 100)
    return activity.id
  }

  function stop() {
    if (activity) sample()
    clearInterval(timer)
    const result = activity
    activity = null
    return result
  }

  onBeforeUnmount(() => clearInterval(timer))
  return { begin, sample, stop }
}
