/**
 * src/components/voice/orbState.ts
 *
 * Mathematical and physical state engine for the 3D Particles Orb.
 * - 3D Fibonacci sphere distribution with golden angle
 * - 15 physical state parameters (tempo, spin, breathe, drift, ripple, swell, flow, swirl, pulse, ring, jitter, shake, etc.)
 * - Exponential approach easing & state blending (createStateMix)
 * - Live audio level smoothing (attack / release rates)
 * - Optimized for 60fps mobile execution
 */

export type OrbState =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'error'
  | 'disabled';

export const ORB_STATES: readonly OrbState[] = [
  'idle',
  'connecting',
  'listening',
  'thinking',
  'speaking',
  'error',
  'disabled',
] as const;

export interface StateParams {
  tempo: number;
  spin: number;
  breathe: number;
  drift: number;
  ripple: number;
  swell: number;
  flow: number;
  swirl: number;
  pulse: number;
  pulseRate: number;
  ring: number;
  jitter: number;
  shake: number;
  alpha: number;
  rest: number;
}

export const STATES_CONFIG: Record<OrbState, StateParams> = {
  idle: {
    tempo: 1,
    spin: 0.14,
    breathe: 0.05,
    drift: 1,
    ripple: 0,
    swell: 0.04,
    flow: 0,
    swirl: 0,
    pulse: 0,
    pulseRate: 1,
    ring: 0,
    jitter: 0,
    shake: 0,
    alpha: 0.72,
    rest: 0,
  },
  connecting: {
    tempo: 1,
    spin: 0.3,
    breathe: 0.02,
    drift: 0.2,
    ripple: 0,
    swell: 0,
    flow: 0,
    swirl: 0,
    pulse: 0.06,
    pulseRate: 0.5,
    ring: 1,
    jitter: 0,
    shake: 0,
    alpha: 0.8,
    rest: 0.12,
  },
  listening: {
    tempo: 1,
    spin: 0.55,
    breathe: 0.012,
    drift: 0,
    ripple: 1,
    swell: 0.14,
    flow: 0,
    swirl: 0,
    pulse: 0,
    pulseRate: 1,
    ring: 0,
    jitter: 0,
    shake: 0,
    alpha: 0.92,
    rest: 0.55,
  },
  thinking: {
    tempo: 1,
    spin: 0.32,
    breathe: 0.01,
    drift: 0,
    ripple: 0,
    swell: 0,
    flow: 0,
    swirl: 0,
    pulse: 1,
    pulseRate: 1,
    ring: 0,
    jitter: 0,
    shake: 0,
    alpha: 0.78,
    rest: 0.3,
  },
  speaking: {
    tempo: 1.05,
    spin: 0.20,
    breathe: 0.03,
    drift: 0,
    ripple: 0.65,
    swell: 0.22,
    flow: 0,
    swirl: 0,
    pulse: 0.06,
    pulseRate: 1.1,
    ring: 0,
    jitter: 0,
    shake: 0,
    alpha: 0.96,
    rest: 0.55,
  },
  error: {
    tempo: 1,
    spin: 0.08,
    breathe: 0,
    drift: 0,
    ripple: 0,
    swell: 0,
    flow: 0,
    swirl: 0,
    pulse: 0,
    pulseRate: 1,
    ring: 0,
    jitter: 0.7,
    shake: 1,
    alpha: 0.85,
    rest: 0.2,
  },
  disabled: {
    tempo: 0.04,
    spin: 0,
    breathe: 0,
    drift: 0,
    ripple: 0,
    swell: 0,
    flow: 0,
    swirl: 0,
    pulse: 0,
    pulseRate: 1,
    ring: 0,
    jitter: 0,
    shake: 0,
    alpha: 0.45,
    rest: 0,
  },
};

export const ERROR_COLOR_FROM = '#fb7185';
export const ERROR_COLOR_TO = '#f43f5e';

export type Rgb = [number, number, number];

export const hexToRgb = (hex: string): Rgb => {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean.split('').map((c) => c + c).join('')
      : clean;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

export const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
];

export const rgbToHex = ([r, g, b]: Rgb): string => {
  const ch = (c: number) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0');
  return `#${ch(r)}${ch(g)}${ch(b)}`;
};

export const rgba = ([r, g, b]: Rgb, alpha: number): string =>
  `rgba(${r},${g},${b},${Math.min(1, Math.max(0, alpha)).toFixed(3)})`;

export const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

export const ENTER_RATE = 14;
export const SETTLE_RATE = 5;
export const ERROR_RATE = 10;
export const LEVEL_ATTACK_RATE = 14;
export const LEVEL_RELEASE_RATE = 4;

export const approach = (
  current: number,
  target: number,
  rate: number,
  dt: number
): number => current + (target - current) * (1 - Math.exp(-rate * dt));

export const smoothLevel = (current: number, target: number, dt: number): number =>
  approach(current, target, target > current ? LEVEL_ATTACK_RATE : LEVEL_RELEASE_RATE, dt);

export const stateRate = (state: OrbState): number => {
  if (state === 'idle' || state === 'disabled') return SETTLE_RATE;
  if (state === 'error') return ERROR_RATE;
  return ENTER_RATE;
};

export type StateWeights = Record<OrbState, number>;

export const createStateMix = (initial: OrbState = 'idle') => {
  const weights: StateWeights = {
    idle: 0,
    connecting: 0,
    listening: 0,
    thinking: 0,
    speaking: 0,
    error: 0,
    disabled: 0,
  };
  weights[initial] = 1;
  const keys = Object.keys(weights) as OrbState[];

  const update = (state: OrbState, dt: number, rate = stateRate(state)): StateWeights => {
    let total = 0;
    for (const key of keys) {
      const target = key === state ? 1 : 0;
      const next = approach(weights[key], target, rate, dt);
      weights[key] = target === 0 && next < 0.001 ? 0 : next;
      total += weights[key];
    }
    if (total > 0) {
      for (const key of keys) weights[key] /= total;
    }
    return weights;
  };

  return { weights, update };
};

export const blendStates = (
  weights: StateWeights,
  table: Record<OrbState, StateParams>
): StateParams => {
  const out: StateParams = {
    tempo: 0,
    spin: 0,
    breathe: 0,
    drift: 0,
    ripple: 0,
    swell: 0,
    flow: 0,
    swirl: 0,
    pulse: 0,
    pulseRate: 0,
    ring: 0,
    jitter: 0,
    shake: 0,
    alpha: 0,
    rest: 0,
  };
  const keys = Object.keys(weights) as OrbState[];
  for (const key of keys) {
    const w = weights[key];
    if (w === 0) continue;
    const row = table[key];
    out.tempo += row.tempo * w;
    out.spin += row.spin * w;
    out.breathe += row.breathe * w;
    out.drift += row.drift * w;
    out.ripple += row.ripple * w;
    out.swell += row.swell * w;
    out.flow += row.flow * w;
    out.swirl += row.swirl * w;
    out.pulse += row.pulse * w;
    out.pulseRate += row.pulseRate * w;
    out.ring += row.ring * w;
    out.jitter += row.jitter * w;
    out.shake += row.shake * w;
    out.alpha += row.alpha * w;
    out.rest += row.rest * w;
  }
  return out;
};

const wave = (x: number): number => 0.5 - 0.5 * Math.cos(x);

export const stateEnergy = (state: OrbState, t: number): number => {
  switch (state) {
    case 'listening':
      return 0.4 + 0.32 * wave(t * 17) + 0.18 * wave(t * 8.2 + 3);
    case 'speaking':
      return 0.3 + 0.24 * wave(t * 12.4) + 0.16 * wave(t * 6 + 1.2);
    case 'thinking':
      return 0.24 + 0.2 * wave(t * 4.8);
    case 'connecting':
      return 0.12 + 0.1 * wave(t * 3.2);
    case 'error':
      return 0.2;
    default:
      return 0;
  }
};

export const blendEnergy = (weights: StateWeights, t: number): number => {
  let energy = 0;
  for (const key of Object.keys(weights) as OrbState[]) {
    if (weights[key] > 0) energy += weights[key] * stateEnergy(key, t);
  }
  return energy;
};

// 3D Fibonacci Sphere Geometry
export interface SphereField {
  count: number;
  x: Float32Array;
  y: Float32Array;
  z: Float32Array;
  ringFrac: Float32Array;
  seed: Float32Array;
  toneBucket: Uint8Array;
  tone: Float32Array;
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const TWO_PI = Math.PI * 2;

export const buildSphere = (count: number, toneBuckets = 4): SphereField => {
  const sphere: SphereField = {
    count,
    x: new Float32Array(count),
    y: new Float32Array(count),
    z: new Float32Array(count),
    ringFrac: new Float32Array(count),
    seed: new Float32Array(count),
    toneBucket: new Uint8Array(count),
    tone: new Float32Array(count),
  };

  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const radiusAtY = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = GOLDEN_ANGLE * i;
    const tone = (i * 0.5436890126) % 1;

    sphere.x[i] = Math.cos(theta) * radiusAtY;
    sphere.y[i] = y;
    sphere.z[i] = Math.sin(theta) * radiusAtY;
    sphere.ringFrac[i] = (i * 0.61803398875) % 1;
    sphere.seed[i] = ((i * 0.7548776662) % 1) * TWO_PI;
    sphere.tone[i] = tone;
    sphere.toneBucket[i] = Math.min(toneBuckets - 1, Math.floor(tone * toneBuckets));
  }

  return sphere;
};
