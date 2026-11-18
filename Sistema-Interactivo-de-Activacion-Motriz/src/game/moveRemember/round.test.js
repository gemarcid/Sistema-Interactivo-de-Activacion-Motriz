import assert from 'node:assert/strict'
import test from 'node:test'
import { generateSequence, movements, ROUND_LENGTH, scoreRound } from './round.js'

test('each round contains four distinct movements from the catalog', () => {
  assert.equal(ROUND_LENGTH, 4)
  const ids = new Set(movements.map(({ id }) => id))
  for (const random of [() => 0, () => 0.99999, Math.random]) {
    const sequence = generateSequence(random)
    assert.equal(sequence.length, 4)
    assert.equal(new Set(sequence).size, 4)
    assert.ok(sequence.every((id) => ids.has(id)))
  }
})

test('scoring counts order errors without marking the current posture complete', () => {
  assert.deepEqual(scoreRound(4, 1, 2, 1), {
    correct: 1,
    orderErrors: 2,
    incomplete: 3,
    hintsUsed: 1,
    perfect: false,
  })
  assert.equal(scoreRound(4, 4, 2, 0).perfect, false)
  assert.deepEqual(scoreRound(4, 4, 0, 0), {
    correct: 4,
    orderErrors: 0,
    incomplete: 0,
    hintsUsed: 0,
    perfect: true,
  })
})
