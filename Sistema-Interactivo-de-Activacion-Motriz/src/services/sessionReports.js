export async function requestReport(action, payload) {
  if (window.apiSiam?.reportes?.[action]) return window.apiSiam.reportes[action](payload)
  const response = await fetch(action === 'listar' ? `/api/reportes?id_perfil=${payload.id_perfil}` : '/api/reportes', {
    method: action === 'listar' ? 'GET' : 'POST',
    cache: 'no-store',
    ...(action === 'listar' ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...payload }) }),
  })
  const result = await response.json()
  if (!response.ok || !result.success) throw new Error(result.error || 'No se pudo guardar el reporte')
  return result.data
}
