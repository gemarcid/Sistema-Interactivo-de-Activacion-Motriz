export function createEquation(round = 1) {
  const isAddition = round <= 3 || Math.random() > 0.4
  if (isAddition) {
    const target = Math.floor(Math.random() * 7) + 3
    const num1 = Math.floor(Math.random() * (target - 1)) + 1
    const num2 = target - num1
    return {
      num1,
      num2,
      operator: '+',
      target,
    }
  } else {
    const num1 = Math.floor(Math.random() * 6) + 4
    const num2 = Math.floor(Math.random() * (num1 - 1)) + 1
    const target = num1 - num2
    return {
      num1,
      num2,
      operator: '-',
      target,
    }
  }
}

export function generateCardPool(equation) {
  const needed = [equation.num1, equation.num2]
  const poolValues = [...needed]

  while (poolValues.length < 4) {
    const candidate = Math.floor(Math.random() * 10) + 1
    if (candidate !== equation.num1 && candidate !== equation.num2 && !poolValues.includes(candidate)) {
      poolValues.push(candidate)
    }
  }

  for (let i = poolValues.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = poolValues[i]
    poolValues[i] = poolValues[j]
    poolValues[j] = temp
  }

  return poolValues.map((val, idx) => ({
    id: `card-${idx}-${Date.now()}`,
    value: val,
    initialIndex: idx,
  }))
}

export function validateSolution(firstVal, secondVal, operator, target) {
  if (firstVal === null || secondVal === null) return false
  if (operator === '+') {
    return firstVal + secondVal === target
  }
  if (operator === '-') {
    return firstVal - secondVal === target
  }
  return false
}
