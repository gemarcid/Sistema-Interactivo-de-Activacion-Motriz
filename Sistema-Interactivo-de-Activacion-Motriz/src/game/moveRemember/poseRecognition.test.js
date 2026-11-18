import assert from 'node:assert/strict'
import test from 'node:test'
import { createPoseTracker, measurePose, recognizePose } from './poseRecognition.js'

const poses = {
  down: [[0, 0.15], [0, 0.29]],
  up: [[0.08, -0.11], [0.10, -0.25]],
  adaptedUp: [[0.13, 0.034], [0.14, -0.09]],
  lateral: [[0.14, 0], [0.28, 0]],
  hip: [[0.12, 0.15], [0.01, 0.26]],
}

function landmarks(right, left) {
  const frame = []
  for (const [position, mode, direction] of [[12, right, -1], [11, left, 1]]) {
    const shoulderX = 0.5 + direction * 0.09
    const points = [[0, 0], ...poses[mode], [0, 0.28]]
    for (const [index, offset] of [0, 2, 4, 12].entries()) {
      frame[position + offset] = {
        x: shoulderX + direction * points[index][0],
        y: 0.38 + points[index][1],
        visibility: 0.99,
      }
    }
  }
  return frame
}

test('recognizes the six movements and preserves anatomical sides', () => {
  const targets = { right: 120, left: 120 }
  for (const [right, left, id] of [
    ['up', 'down', 'right-arm-up'],
    ['down', 'up', 'left-arm-up'],
    ['up', 'up', 'both-arms-up'],
    ['lateral', 'lateral', 'arms-open'],
    ['hip', 'hip', 'hands-on-hips'],
    ['down', 'down', 'rest'],
  ]) {
    const frame = landmarks(right, left)
    assert.equal(recognizePose(measurePose(frame, 1), targets), id)
    assert.equal(recognizePose(measurePose(frame.map((point) => ({ ...point, x: 1 - point.x })), 1), targets), id)
  }
})

test('uses the confirmed target independently for each arm', () => {
  const right = measurePose(landmarks('adaptedUp', 'down'), 1)
  const left = measurePose(landmarks('down', 'adaptedUp'), 1)
  assert.equal(recognizePose(right, { right: 75, left: 130 }), 'right-arm-up')
  assert.equal(recognizePose(left, { right: 75, left: 130 }), null)
  assert.equal(recognizePose(right, { right: null, left: 130 }), null)
  assert.equal(recognizePose(right), 'right-arm-up')
  assert.equal(recognizePose(left), 'left-arm-up')
})

test('missing, out-of-frame or low-confidence joints suspend tracking', () => {
  const frame = landmarks('up', 'down')
  assert.equal(measurePose(null, 1), null)
  assert.equal(measurePose(frame, 0), null)
  assert.equal(measurePose(frame, 1) !== null, true)
  frame[16].visibility = 0.2
  assert.equal(measurePose(frame, 1), null)
  frame[16].visibility = 1
  frame[16].y = -0.01
  assert.equal(measurePose(frame, 1), null)
})

test('requires continuous tracking and registers a held posture only once', () => {
  const tracker = createPoseTracker(800)
  const id = 'right-arm-up'
  const times = [0, 200, 400, 600, 800, 1000]
  assert.deepEqual(times.map((time) => tracker.observe(id, time, true)), [null, null, null, null, id, null])
  tracker.interrupt()
  assert.deepEqual(times.slice(0, 5).map((time) => tracker.observe(id, time + 1500, true)), Array(5).fill(null))
  assert.equal(tracker.observe('rest', 2500, false), null)
  assert.equal(tracker.observe('rest', 2800, false), null)
  assert.deepEqual(times.map((time) => tracker.observe(id, time + 3000, true)), [null, null, null, null, id, null])
})

test('a gap between frames discards partial confirmation', () => {
  const tracker = createPoseTracker(800)
  const id = 'left-arm-up'
  for (const time of [0, 300, 600, 1100, 1300, 1600]) {
    assert.equal(tracker.observe(id, time, true), null)
  }
  assert.equal(tracker.observe(id, 1900, true), id)
})
