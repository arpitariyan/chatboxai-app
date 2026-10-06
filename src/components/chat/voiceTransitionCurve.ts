/**
 * src/components/chat/voiceTransitionCurve.ts
 *
 * Mathematically generates a responsive, arc-length parameterized curved spline trajectory
 * for the Voice AI button-to-orb transition.
 *
 * Trajectory Characteristics:
 * - Starts exactly at the center of the Voice AI button (bottom-right)
 * - Emerges leftward across the composer area (mimicking the user's reference drawing)
 * - Sweeps smoothly through a curved bend into an upward ascent
 * - Ascends smoothly along the left-of-center region with continuous curvature
 * - Curves gently into the center destination (where VoiceOrb rests)
 * - Provides synchronized X, Y, and subtle trail particle coordinate tables
 *   compatible with React Native's native driver Animated.Value.interpolate.
 */

export interface Point2D {
  x: number;
  y: number;
}

export interface CurveTrajectoryConfig {
  buttonX: number;
  buttonY: number;
  destX: number;
  destY: number;
  screenWidth: number;
  screenHeight: number;
}

export interface TrailConfig {
  outputRangeX: number[];
  outputRangeY: number[];
  outputRangeOpacity: number[];
  outputRangeScale: number[];
}

export interface CurveLookupTable {
  inputRange: number[];
  outputRangeX: number[];
  outputRangeY: number[];
  trails: TrailConfig[];
}

const NUM_LOOKUP_STEPS = 80;
const ARC_SAMPLES = 400;

/**
 * Evaluates a Catmull-Rom spline point given 4 control points and local t in [0, 1].
 */
function catmullRomPoint(
  p0: Point2D,
  p1: Point2D,
  p2: Point2D,
  p3: Point2D,
  t: number,
): Point2D {
  const t2 = t * t;
  const t3 = t2 * t;

  const x =
    0.5 *
    (2 * p1.x +
      (-p0.x + p2.x) * t +
      (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
      (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);

  const y =
    0.5 *
    (2 * p1.y +
      (-p0.y + p2.y) * t +
      (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
      (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);

  return { x, y };
}

/**
 * Generates the responsive waypoints based on screen layout and button origin.
 */
function buildWaypoints(config: CurveTrajectoryConfig): Point2D[] {
  const { buttonX, buttonY, destX, destY, screenWidth, screenHeight } = config;

  const dxTotal = buttonX - destX; // > 0 (button is to the right of center)
  const dyTotal = buttonY - destY; // > 0 (button is below center)

  // Waypoints in absolute screen coordinates matching the user's reference curve:
  return [
    // P0: Exact center of Voice AI button
    { x: buttonX, y: buttonY },

    // P1: Emerge naturally from button heading leftward across composer
    {
      x: buttonX - dxTotal * 0.28,
      y: buttonY - dyTotal * 0.02,
    },

    // P2: Sweep across lower composer region
    {
      x: buttonX - dxTotal * 0.72,
      y: buttonY - dyTotal * 0.10,
    },

    // P3: Rounding the lower corner into the upward ascent (left of center)
    {
      x: destX - screenWidth * 0.07,
      y: buttonY - dyTotal * 0.32,
    },

    // P4: Long upward curved ascent through mid-screen
    {
      x: destX - screenWidth * 0.08,
      y: destY + dyTotal * 0.38,
    },

    // P5: Curving smoothly inward toward central region
    {
      x: destX - screenWidth * 0.035,
      y: destY + dyTotal * 0.12,
    },

    // P6: Final center destination (VoiceOrb rest position)
    { x: destX, y: destY },
  ];
}

/**
 * Evaluates the multi-segment Catmull-Rom spline at normalized parameter s in [0, 1].
 */
function evaluateSpline(
  s: number,
  extendedPts: Point2D[],
  numSegments: number,
): Point2D {
  if (s <= 0) return extendedPts[1];
  if (s >= 1) return extendedPts[extendedPts.length - 2];

  const p = s * numSegments;
  const i = Math.min(Math.floor(p), numSegments - 1);
  const localT = p - i;

  return catmullRomPoint(
    extendedPts[i],
    extendedPts[i + 1],
    extendedPts[i + 2],
    extendedPts[i + 3],
    localT,
  );
}

/**
 * Builds the full trajectory lookup table with arc-length parameterization.
 * Outputs coordinates as offsets relative to (destX, destY) so (0, 0) is the final rest position.
 */
export function generateCurvedTrajectory(
  config: CurveTrajectoryConfig,
): CurveLookupTable {
  const waypoints = buildWaypoints(config);
  const numSegments = waypoints.length - 1;

  // Duplicate endpoints to ensure natural tangents at boundary
  const extendedPts: Point2D[] = [
    waypoints[0],
    ...waypoints,
    waypoints[waypoints.length - 1],
  ];

  // 1. High-resolution pre-sampling for cumulative arc-length parameterization
  const samples: Point2D[] = [];
  const cumDistances: number[] = [0];

  for (let i = 0; i <= ARC_SAMPLES; i++) {
    const s = i / ARC_SAMPLES;
    const pt = evaluateSpline(s, extendedPts, numSegments);
    samples.push(pt);
    if (i > 0) {
      const prev = samples[i - 1];
      const dist = Math.hypot(pt.x - prev.x, pt.y - prev.y);
      cumDistances.push(cumDistances[i - 1] + dist);
    }
  }

  const totalLength = cumDistances[cumDistances.length - 1] || 1;

  // Arc-length position lookup: ensures constant physical velocity along the curve
  const getPointAtArcLength = (u: number): Point2D => {
    const clampedU = Math.max(0, Math.min(1, u));
    if (clampedU <= 0) return samples[0];
    if (clampedU >= 1) return samples[samples.length - 1];

    const targetD = clampedU * totalLength;

    // Binary search for segment
    let low = 0;
    let high = ARC_SAMPLES;
    while (low <= high) {
      const mid = (low + high) >> 1;
      if (cumDistances[mid] < targetD) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    const idx = Math.max(1, Math.min(low, ARC_SAMPLES));
    const d0 = cumDistances[idx - 1];
    const d1 = cumDistances[idx];
    const frac = d1 === d0 ? 0 : (targetD - d0) / (d1 - d0);

    const pA = samples[idx - 1];
    const pB = samples[idx];
    return {
      x: pA.x + (pB.x - pA.x) * frac,
      y: pA.y + (pB.y - pA.y) * frac,
    };
  };

  // 2. Generate lookup table for orb movement
  const inputRange: number[] = [];
  const outputRangeX: number[] = [];
  const outputRangeY: number[] = [];

  const startDX = config.buttonX - config.destX;
  const startDY = config.buttonY - config.destY;

  for (let step = 0; step <= NUM_LOOKUP_STEPS; step++) {
    const t = step / NUM_LOOKUP_STEPS;
    inputRange.push(t);

    if (step === 0) {
      outputRangeX.push(startDX);
      outputRangeY.push(startDY);
    } else if (step === NUM_LOOKUP_STEPS) {
      outputRangeX.push(0);
      outputRangeY.push(0);
    } else {
      const pt = getPointAtArcLength(t);
      outputRangeX.push(pt.x - config.destX);
      outputRangeY.push(pt.y - config.destY);
    }
  }

  // 3. Generate subtle motion trail particles (3 particles with increasing lag)
  const trailLags = [0.032, 0.065, 0.098];
  const trailMaxOpacities = [0.38, 0.24, 0.14];
  const trailBaseScales = [0.75, 0.52, 0.35];

  const trails: TrailConfig[] = trailLags.map((lag, idx) => {
    const tOutputX: number[] = [];
    const tOutputY: number[] = [];
    const tOpacity: number[] = [];
    const tScale: number[] = [];

    const maxOpacity = trailMaxOpacities[idx];
    const baseScale = trailBaseScales[idx];

    for (let step = 0; step <= NUM_LOOKUP_STEPS; step++) {
      const t = step / NUM_LOOKUP_STEPS;

      if (t <= lag) {
        // Hasn't emerged yet, stays at button position and invisible
        tOutputX.push(startDX);
        tOutputY.push(startDY);
        tOpacity.push(0);
        tScale.push(0.05);
      } else {
        // Follows the same curve behind the main orb
        const delayedT = (t - lag) / (1 - lag * 0.4);
        const pt = getPointAtArcLength(delayedT);
        tOutputX.push(step === NUM_LOOKUP_STEPS ? 0 : pt.x - config.destX);
        tOutputY.push(step === NUM_LOOKUP_STEPS ? 0 : pt.y - config.destY);

        // Opacity ramps up during flight and disappears completely at destination
        let op = 0;
        if (t < lag + 0.15) {
          op = ((t - lag) / 0.15) * maxOpacity;
        } else if (t <= 0.75) {
          op = maxOpacity;
        } else if (t < 0.95) {
          op = maxOpacity * (1 - (t - 0.75) / 0.2);
        } else {
          op = 0; // completely invisible at destination
        }
        tOpacity.push(Math.max(0, Math.min(1, op)));

        // Scale grows subtly with travel
        const sc = baseScale * (0.3 + 0.7 * Math.min(1, t / 0.8));
        tScale.push(sc);
      }
    }

    return {
      outputRangeX: tOutputX,
      outputRangeY: tOutputY,
      outputRangeOpacity: tOpacity,
      outputRangeScale: tScale,
    };
  });

  return {
    inputRange,
    outputRangeX,
    outputRangeY,
    trails,
  };
}
