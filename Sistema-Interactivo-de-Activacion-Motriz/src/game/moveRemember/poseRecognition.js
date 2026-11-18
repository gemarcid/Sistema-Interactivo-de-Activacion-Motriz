const joints = {
  left: [11, 13, 15, 23],
  right: [12, 14, 16, 24],
}

const vector = (from, to) => ({ x: to.x - from.x, y: to.y - from.y })
const dot = (a, b) => a.x * b.x + a.y * b.y
const length = (a) => Math.hypot(a.x, a.y)

function angle(a, b) {
  const cosine = dot(a, b) / (length(a) * length(b))
  return Math.acos(Math.max(-1, Math.min(1, cosine))) * 180 / Math.PI
}

function measureArm(landmarks, side, aspect) {
  const points = joints[side].map((index) => landmarks?.[index])
  if (points.some((point) => !point || !(point.visibility >= 0.5)
    || !(point.x > 0 && point.x < 1 && point.y > 0 && point.y < 1))) return null

  const [shoulder, elbow, wrist, hip] = points.map(({ x, y }) => ({ x: x * aspect, y }))
  const torso = vector(shoulder, hip)
  const upperArm = vector(shoulder, elbow)
  const forearm = vector(elbow, wrist)
  const torsoLength = length(torso)
  if (torsoLength < 0.05 || length(upperArm) < torsoLength * 0.15
    || length(forearm) < torsoLength * 0.12) return null

  const otherShoulder = landmarks[side === 'left' ? joints.right[0] : joints.left[0]]
  const outward = Math.sign(shoulder.x - otherShoulder?.x * aspect)
  if (!outward) return null

  const elevation = angle(torso, upperArm)
  const elbowAngle = angle(vector(elbow, shoulder), forearm)
  const wristAboveElbow = -dot(forearm, torso) / torsoLength ** 2

  return {
    elevation,
    lift: elevation >= 45 && wristAboveElbow >= 0.06,
    lateral: elevation >= 65 && elevation <= 108 && elbowAngle >= 155
      && outward * (wrist.x - shoulder.x) >= torsoLength * 0.48,
    hip: length(vector(hip, wrist)) <= torsoLength * 0.30 && elbowAngle <= 145
      && outward * (elbow.x - wrist.x) >= torsoLength * 0.08,
    down: elevation <= 28 && elbowAngle >= 145,
  }
}

export function measurePose(landmarks, aspect) {
  if (!(aspect > 0)) return null
  const left = measureArm(landmarks, 'left', aspect)
  const right = measureArm(landmarks, 'right', aspect)
  return left && right ? { left, right } : null
}

const meetsTarget = (arm, target) => arm.lift && (target === undefined || (target !== null && arm.elevation >= target - 5))

const rules = [
  ['both-arms-up', ({ left, right }, targets) => meetsTarget(left, targets.left) && meetsTarget(right, targets.right)],
  ['right-arm-up', ({ left, right }, targets) => left.down && meetsTarget(right, targets.right)],
  ['left-arm-up', ({ left, right }, targets) => right.down && meetsTarget(left, targets.left)],
  ['arms-open', ({ left, right }) => left.lateral && right.lateral],
  ['hands-on-hips', ({ left, right }) => left.hip && right.hip],
  ['rest', ({ left, right }) => left.down && right.down],
]

export function recognizePose(pose, targets = {}) {
  return rules.find(([, matches]) => matches(pose, targets))?.[0] ?? null
}

export function createPoseTracker(holdMs = 850) {
  let held = null
  let candidate
  let candidateSince
  let lastFrame

  function interrupt() {
    candidate = undefined
    lastFrame = undefined
  }

  function observe(pose, time, canCount) {
    if (lastFrame != null && time - lastFrame > 400) interrupt()
    lastFrame = time

    if (pose !== candidate) {
      candidate = pose
      candidateSince = time
    }

    if (pose === held) return null

    // Relaxing or transitioning releases the last pose after a short, visible change.
    const requiredMs = canCount ? holdMs : 300
    if (time - candidateSince < requiredMs) return null

    held = pose
    return canCount ? pose : null
  }

  return { observe, interrupt }
}
