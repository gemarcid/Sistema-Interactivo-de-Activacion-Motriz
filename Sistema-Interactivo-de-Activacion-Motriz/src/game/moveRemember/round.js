export const movements = [
  { id: 'right-arm-up', label: 'Brazo derecho arriba', arms: 'M28 35 24 54 25 68 M52 35 65 15 67 5' },
  { id: 'left-arm-up', label: 'Brazo izquierdo arriba', arms: 'M28 35 15 15 13 5 M52 35 56 54 55 68' },
  { id: 'both-arms-up', label: 'Ambos brazos arriba', arms: 'M28 35 15 15 13 5 M52 35 65 15 67 5' },
  { id: 'arms-open', label: 'Brazos abiertos lateralmente', arms: 'M28 35 16 35 5 36 M52 35 64 35 75 36' },
  { id: 'hands-on-hips', label: 'Manos a la cintura', arms: 'M28 35 17 50 33 58 M52 35 63 50 47 58' },
  { id: 'rest', label: 'Posición de descanso', arms: 'M28 35 24 54 25 68 M52 35 56 54 55 68' },
]

export const ROUND_LENGTH = 4

export function generateSequence(random = Math.random) {
  const available = movements.map(({ id }) => id)
  return Array.from({ length: ROUND_LENGTH }, () => {
    const index = Math.floor(random() * available.length)
    return available.splice(index, 1)[0]
  })
}

export function scoreRound(total, correct, orderErrors, hintsUsed) {
  return {
    correct,
    orderErrors,
    incomplete: total - correct,
    hintsUsed,
    perfect: correct === total && orderErrors === 0,
  }
}
