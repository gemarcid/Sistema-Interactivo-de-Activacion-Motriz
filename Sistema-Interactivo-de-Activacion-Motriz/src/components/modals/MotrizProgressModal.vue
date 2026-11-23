<script setup>
import { computed, ref, watch } from 'vue'
import { Bar } from 'vue-chartjs'
import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js'
import { useProfiles } from '../../composables/useProfiles'
import { requestReport } from '../../services/sessionReports'
import { formatDuration } from '../../game/sessionReport'
import { movements } from '../../game/moveRemember/round'

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend)
const emit = defineEmits(['close'])
const { activeProfile, ensureProfileSaved } = useProfiles()
const period = ref('7')
const rows = ref([])
const loading = ref(false)
const error = ref('')
const selectedId = ref(null)
const movementLabels = new Map(movements.map(({ id, label }) => [id, label]))
let requestId = 0

async function refresh() {
  const currentRequest = ++requestId
  loading.value = true
  error.value = ''
  rows.value = []
  const profile = activeProfile.value
  try {
    if (!profile) throw new Error('Selecciona un perfil para consultar sus reportes.')
    const id = await ensureProfileSaved(profile)
    const data = await requestReport('listar', { id_perfil: id })
    if (currentRequest !== requestId) return
    rows.value = data
    selectedId.value = data[0]?.id_sesion ?? null
  } catch (failure) {
    if (currentRequest === requestId) error.value = failure.message
  } finally {
    if (currentRequest === requestId) loading.value = false
  }
}

watch(() => activeProfile.value?.id, refresh, { immediate: true })
const asDate = value => new Date(value?.includes('T') ? value : value?.replace(' ', 'T') + 'Z')
const dateLabel = value => asDate(value).toLocaleString('es-CL')
const visibleRows = computed(() => rows.value.filter(row =>
  period.value === 'all' || asDate(row.inicio).getTime() >= Date.now() - Number(period.value) * 86400000))
watch(visibleRows, (items) => {
  if (!items.some(row => row.id_sesion === selectedId.value)) selectedId.value = items[0]?.id_sesion ?? null
})
const chartRows = computed(() => visibleRows.value.filter(row => row.report).slice().reverse())
const selected = computed(() => visibleRows.value.find(row => row.id_sesion === selectedId.value) || visibleRows.value[0])
const report = computed(() => selected.value?.report)
const totals = computed(() => chartRows.value.reduce((sum, row) => {
  for (const key of Object.keys(sum)) sum[key] += row.report.totals[key] || 0
  return sum
}, { activeSeconds: 0, restSeconds: 0, trackingLostSeconds: 0, correct: 0, orderErrors: 0, hints: 0 }))
const labels = computed(() => chartRows.value.map(row => '#' + row.id_sesion + ' · ' + asDate(row.inicio).toLocaleDateString('es-CL')))
const timeData = computed(() => ({
  labels: labels.value,
  datasets: [
    ['Ejercicio activo', 'activeSeconds', '#8C1D2C'],
    ['Descanso y pausas', 'restSeconds', '#D97706'],
    ['Quietud observada', 'observedIdleSeconds', '#E3B660'],
    ['Sin seguimiento', 'trackingLostSeconds', '#7E6A6D'],
    ['Memorización', 'memorySeconds', '#D98A91'],
  ].map(([label, key, backgroundColor]) => ({ label, backgroundColor, data: chartRows.value.map(row => Number((row.report.totals[key] || 0).toFixed(1))) })),
}))
const memoryData = computed(() => ({
  labels: labels.value,
  datasets: [
    ['Posturas completadas', 'correct', '#8C1D2C'],
    ['Errores de orden', 'orderErrors', '#D97706'],
    ['Pistas', 'hints', '#E3B660'],
  ].map(([label, key, backgroundColor]) => ({ label, backgroundColor, data: chartRows.value.map(row => row.report.totals[key] || 0) })),
}))
const options = {
  responsive: true, maintainAspectRatio: false,
  animation: false,
  scales: { y: { beginAtZero: true, title: { display: true, text: 'Segundos' } } },
  plugins: { legend: { position: 'bottom' } },
  onClick(_event, elements) {
    if (elements[0]) selectedId.value = chartRows.value[elements[0].index].id_sesion
  },
}
const memoryOptions = {
  ...options,
  scales: { y: { beginAtZero: true, ticks: { precision: 0 }, title: { display: true, text: 'Cantidad' } } },
}
const motorFields = [
  ['Pasos', 'steps', ''], ['Cadencia', 'cadence', 'pasos/min'],
  ['Amplitud rodilla izquierda', 'maxLeftKneeROM', '°'], ['Amplitud rodilla derecha', 'maxRightKneeROM', '°'],
  ['Amplitud cadera', 'maxHipROM', '°'],
  ['Amplitud hombro izquierdo', 'maxLeftShoulderROM', '°'], ['Amplitud hombro derecho', 'maxRightShoulderROM', '°'],
  ['Amplitud codo izquierdo', 'maxLeftElbowROM', '°'], ['Amplitud codo derecho', 'maxRightElbowROM', '°'],
  ['Altura mínima del torso respecto a calibración', 'minTorsoHeightPct', '%'],
  ['Inclinación máxima del torso', 'maxTrunkTiltAngle', '°'],
  ['Oscilación horizontal estimada en cámara', 'comMaxSwayX', '%'],
  ['Oscilación vertical estimada en cámara', 'comMaxSwayY', '%'],
]
</script>

<template>
  <div class="motriz-modal-overlay reports-overlay" @click.self="emit('close')">
    <section class="motriz-card reports-card" role="dialog" aria-modal="true" aria-labelledby="reports-title">
      <header class="reports-header">
        <div>
          <h2 id="reports-title">Reportes de rendimiento</h2>
          <p>{{ activeProfile?.name }}</p>
        </div>
        <button type="button" class="btn-motriz-secondary" @click="emit('close')">Cerrar</button>
      </header>
      <div class="reports-filters">
        <label>Período
          <select v-model="period">
            <option value="7">Últimos 7 días</option>
            <option value="30">Últimos 30 días</option>
            <option value="all">Todo el historial</option>
          </select>
        </label>
        <button type="button" class="btn-motriz-secondary" :disabled="loading" @click="refresh">Actualizar</button>
      </div>
      <p v-if="loading" role="status">Cargando sesiones de SQLite…</p>
      <p v-else-if="error" role="alert">{{ error }}</p>
      <p v-else-if="!visibleRows.length" role="status">Este perfil todavía no tiene sesiones en el período seleccionado. Inicia una nueva partida para registrar su rendimiento.</p>
      <template v-else>
        <dl class="reports-totals">
          <div><dt>Sesiones</dt><dd>{{ visibleRows.length }}</dd></div>
          <div><dt>Tiempo activo</dt><dd>{{ formatDuration(totals.activeSeconds) }}</dd></div>
          <div><dt>Descanso</dt><dd>{{ formatDuration(totals.restSeconds) }}</dd></div>
          <div><dt>Sin seguimiento</dt><dd>{{ formatDuration(totals.trackingLostSeconds) }}</dd></div>
        </dl>
        <template v-if="chartRows.length">
          <h3>Actividad física por sesión</h3>
          <p class="report-note">El tiempo activo corresponde al movimiento observado por cámara. La quietud, la memorización y los intervalos sin seguimiento se registran por separado.</p>
          <div class="report-chart"><Bar :data="timeData" :options="options" aria-label="Tiempos por sesión" /></div>
          <h3>Memoria por sesión</h3>
          <div class="report-chart"><Bar :data="memoryData" :options="memoryOptions" aria-label="Aciertos, errores de orden y pistas por sesión" /></div>
        </template>
        <label class="session-picker">Sesión
          <select v-model="selectedId">
            <option v-for="row in visibleRows" :key="row.id_sesion" :value="row.id_sesion">
              #{{ row.id_sesion }} · {{ dateLabel(row.inicio) }} · {{ row.estado }}
            </option>
          </select>
        </label>
        <p v-if="!report">Esta sesión anterior no contiene un reporte detallado compatible.</p>
        <template v-else>
          <h3>Sesión #{{ selected.id_sesion }} · {{ selected.estado }}</h3>
          <p>{{ report.profile.nombre }} · {{ dateLabel(selected.inicio) }}<span v-if="selected.fin"> — {{ dateLabel(selected.fin) }}</span></p>
          <p class="report-note">La amplitud se expresa respecto a la calibración de cada intento. Las medidas de torso y centro corporal son estimaciones de la cámara.</p>
          <p v-if="!report.activities.length">Todavía no se han registrado actividades.</p>
          <article v-for="(activity, index) in report.activities" :key="activity.id" class="activity-report">
            <h4>{{ index + 1 }}. {{ { walk: 'Caminata', memory: 'Mueve y Recuerda', rest: 'Descanso' }[activity.game] }} · {{ activity.status }}</h4>
            <dl class="activity-times">
              <div><dt>Activo</dt><dd>{{ formatDuration(activity.activeSeconds) }}</dd></div>
              <div><dt>Descanso</dt><dd>{{ formatDuration(activity.restSeconds) }}</dd></div>
              <div><dt>Quietud</dt><dd>{{ formatDuration(activity.observedIdleSeconds) }}</dd></div>
              <div><dt>Sin seguimiento</dt><dd>{{ formatDuration(activity.trackingLostSeconds) }}</dd></div>
              <div v-if="activity.game === 'memory'"><dt>Memorización</dt><dd>{{ formatDuration(activity.memorySeconds) }}</dd></div>
            </dl>
            <template v-if="activity.game === 'walk'">
              <p v-if="!activity.measuredFrames">Sin muestras corporales válidas para evaluar el movimiento.</p>
              <dl v-else class="motor-metrics">
                <div v-for="[label, key, unit] in motorFields" :key="key"><dt>{{ label }}</dt><dd>{{ activity[key] == null ? 'Sin datos' : Math.round(activity[key] * 10) / 10 + ' ' + unit }}</dd></div>
              </dl>
            </template>
            <template v-if="activity.game === 'memory'">
              <p>{{ activity.correct }} / {{ activity.requested }} posturas completadas · {{ activity.orderErrors }} errores de orden · {{ activity.hints }} pistas</p>
              <p>Secuencia solicitada</p>
              <ol><li v-for="(movement, step) in activity.sequence" :key="step">{{ movementLabels.get(movement) || movement }}</li></ol>
              <details>
                <summary>Movimientos reconocidos ({{ activity.attempts.length }})</summary>
                <ol><li v-for="(attempt, attemptIndex) in activity.attempts" :key="attemptIndex">
                  {{ movementLabels.get(attempt.movement) || attempt.movement }} · Postura {{ attempt.position + 1 }} · {{ attempt.correct ? 'Correcto' : 'Error de orden' }}
                </li></ol>
              </details>
            </template>
          </article>
        </template>
      </template>
    </section>
  </div>
</template>

<style scoped>
.reports-card { width: min(1100px, 100%); max-height: calc(100dvh - 32px); padding: clamp(16px, 3vw, 30px); overflow: auto; }
.reports-header, .reports-filters { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
.reports-header h2, h3, h4 { margin: 0 0 8px; color: var(--motriz-red-primary); }
.reports-header p { margin: 0; }
.reports-card button { padding: 8px 18px; font-size: 1rem; min-height: 44px; }
.reports-card label { display: grid; min-width: 0; gap: 6px; font-weight: 700; }
.reports-card select { width: 100%; min-height: 44px; min-width: 0; max-width: 100%; padding: 8px; font: inherit; color: inherit; background: #fffdf9; border: 2px solid var(--motriz-card-border); border-radius: 10px; }
.reports-totals, .activity-times { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; }
.reports-totals > div { background: var(--motriz-bg-warm); padding: 12px; border-radius: 12px; }
dd { margin: 0; font-weight: 800; color: var(--motriz-red-primary); }
.reports-totals dd { font-size: 1.5rem; }
.report-chart { position: relative; min-width: 0; width: 100%; height: 260px; margin: 12px 0 24px; }
.report-note { color: var(--motriz-text-muted); font-size: 0.95rem; line-height: 1.45; }
.session-picker { margin: 16px 0; }
.activity-report { border: 2px solid var(--motriz-card-border); border-radius: 16px; padding: 16px; margin: 12px 0; }
.motor-metrics { display: grid; gap: 6px; }
.motor-metrics > div { display: flex; justify-content: space-between; gap: 12px; border-bottom: 1px solid var(--motriz-card-border); padding: 4px 0; }
.activity-report li { padding: 3px 0; }
@media (max-width: 600px) {
  .reports-overlay { padding: 8px; }
  .reports-card { max-height: calc(100dvh - 16px); }
  .reports-card h2 { font-size: 1.5rem; }
}
</style>
