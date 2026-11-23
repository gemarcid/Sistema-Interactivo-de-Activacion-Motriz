export function summarizeActivities(activities) {
  const totals = { activeSeconds: 0, restSeconds: 0, trackingLostSeconds: 0, observedIdleSeconds: 0, memorySeconds: 0, steps: 0, correct: 0, requested: 0, orderErrors: 0, hints: 0 }
  for (const activity of activities) {
    for (const key of Object.keys(totals)) totals[key] += activity[key] || 0
  }
  return totals
}

export function formatDuration(seconds = 0) {
  const value = Math.max(0, Math.round(seconds))
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`
}
