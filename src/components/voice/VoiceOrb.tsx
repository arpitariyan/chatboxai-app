/**
 * src/components/voice/VoiceOrb.tsx
 *
 * Faithfully recreates the website's 3D Fibonacci Particle Orb (ParticlesOrb / StateCircle).
 * Matches the visual appearance, animation language, and state behavior:
 * - 3D Fibonacci sphere distribution with realistic depth sorting
 * - Multi-tier particle brightness (cyan highlight, bright emerald, medium emerald, deep teal)
 * - Luminous radial gradient glowing center
 * - State-specific motion dynamics:
 *     • IDLE: Gentle breathing, slow floating drift
 *     • LISTENING: Wave ripples expanding outward, reacting live to microphone input level
 *     • THINKING: Concentrated harmonic pulse, accelerated spin
 *     • SPEAKING: Dynamic wave flow, pulsating flare responding to assistant voice playback
 *     • ERROR: Soft rose/crimson warning glow
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Circle, G } from 'react-native-svg';

export type VoiceOrbState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';

interface VoiceOrbProps {
  state: VoiceOrbState;
  size?: number;
  audioLevel?: number; // Normalized 0.0 to 1.0
  colorFrom?: string;
  colorTo?: string;
  onPress?: () => void;
}

interface Particle3D {
  x0: number;
  y0: number;
  z0: number;
  baseRadius: number;
  phase: number;
  speed: number;
  tier: 'highlight' | 'bright' | 'medium' | 'deep';
}

interface ProjectedParticle {
  x: number;
  y: number;
  z: number;
  radius: number;
  color: string;
  opacity: number;
  hasBloom: boolean;
  bloomRadius: number;
}

const PARTICLE_COUNT = 180; // High visual density with smooth 60fps performance on mobile
const GOLDEN_RATIO = (1 + Math.sqrt(5)) / 2;

// Generate 3D Fibonacci points on a unit sphere
function createFibonacciField(count = PARTICLE_COUNT): Particle3D[] {
  const particles: Particle3D[] = [];

  for (let i = 0; i < count; i++) {
    const theta = (2 * Math.PI * i) / GOLDEN_RATIO;
    const phi = Math.acos(1 - (2 * (i + 0.5)) / count);

    const x0 = Math.sin(phi) * Math.cos(theta);
    const y0 = Math.sin(phi) * Math.sin(theta);
    const z0 = Math.cos(phi);

    const rand = (i * 0.381966) % 1; // Deterministic pseudo-random distribution
    let tier: 'highlight' | 'bright' | 'medium' | 'deep' = 'medium';
    if (rand < 0.12) tier = 'highlight';
    else if (rand < 0.40) tier = 'bright';
    else if (rand < 0.75) tier = 'medium';
    else tier = 'deep';

    particles.push({
      x0,
      y0,
      z0,
      baseRadius: 1.2 + ((i % 5) * 0.35),
      phase: ((i * 1.618) % (Math.PI * 2)),
      speed: 0.6 + ((i % 3) * 0.3),
      tier,
    });
  }

  return particles;
}

export const VoiceOrb: React.FC<VoiceOrbProps> = ({
  state = 'idle',
  size = 240,
  audioLevel = 0,
  colorFrom = '#00E6C3',
  colorTo = '#66FFE5',
  onPress,
}) => {
  const particlesRef = useRef<Particle3D[]>(createFibonacciField(PARTICLE_COUNT));
  const [projected, setProjected] = useState<ProjectedParticle[]>([]);
  const [coreRadiusScale, setCoreRadiusScale] = useState(0.65);
  const [coreAlpha, setCoreAlpha] = useState(0.8);

  const rotXRef = useRef(0);
  const rotYRef = useRef(0);
  const animFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const smoothedLevelRef = useRef<number>(0);

  // Smooth audio level interpolation (lerp)
  smoothedLevelRef.current += (audioLevel - smoothedLevelRef.current) * 0.25;

  const isError = state === 'error';

  // Palette definitions matching website ORB_PALETTES
  const palette = useMemo(() => {
    if (isError) {
      return {
        highlight: '#fecdd3',
        bright: '#fb7185',
        medium: '#f43f5e',
        deep: '#881337',
        coreCenter: '#fecdd3',
        coreMid: '#fb7185',
        coreOuter: '#881337',
      };
    }
    return {
      highlight: colorTo || '#66FFE5', // Bright Cyan
      bright: colorFrom || '#00E6C3', // Emerald Primary
      medium: '#00BFA5',              // Secondary Emerald
      deep: '#00483F',                // Deep Teal
      coreCenter: colorTo || '#66FFE5',
      coreMid: colorFrom || '#00E6C3',
      coreOuter: '#00483F',
    };
  }, [isError, colorFrom, colorTo]);

  useEffect(() => {
    let active = true;

    const render = () => {
      if (!active) return;

      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const level = smoothedLevelRef.current;

      // State-specific speed and rotation
      let rotSpeedY = 0.005;
      let rotSpeedX = 0.002;
      let breathFreq = 1.4;
      let breathAmp = 0.03;
      let rippleAmp = 0;
      let pulseAmp = 0;
      let flowAmp = 0;
      let targetCoreAlpha = 0.7;

      switch (state) {
        case 'listening':
          rotSpeedY = 0.008;
          rotSpeedX = 0.004;
          breathFreq = 2.4;
          breathAmp = 0.04 + level * 0.08;
          rippleAmp = 0.12 + level * 0.22;
          targetCoreAlpha = 0.9;
          break;
        case 'thinking':
          rotSpeedY = 0.016;
          rotSpeedX = 0.008;
          breathFreq = 2.8;
          breathAmp = 0.05;
          pulseAmp = 0.12;
          targetCoreAlpha = 0.85;
          break;
        case 'speaking':
          rotSpeedY = 0.010;
          rotSpeedX = 0.005;
          breathFreq = 3.0;
          breathAmp = 0.05 + level * 0.09;
          flowAmp = 0.14 + level * 0.25;
          targetCoreAlpha = 0.95;
          break;
        case 'error':
          rotSpeedY = 0.006;
          rotSpeedX = 0.003;
          breathFreq = 1.8;
          breathAmp = 0.03;
          targetCoreAlpha = 0.75;
          break;
        case 'idle':
        default:
          rotSpeedY = 0.004;
          rotSpeedX = 0.0015;
          breathFreq = 1.2;
          breathAmp = 0.02;
          targetCoreAlpha = 0.65;
          break;
      }

      // Rotate sphere
      rotYRef.current += rotSpeedY * (1 + level * 0.4);
      rotXRef.current += rotSpeedX * (1 + level * 0.2);

      const cosY = Math.cos(rotYRef.current);
      const sinY = Math.sin(rotYRef.current);
      const cosX = Math.cos(rotXRef.current);
      const sinX = Math.sin(rotXRef.current);

      const cx = size / 2;
      const cy = size / 2;
      const baseRadius = size * 0.36;

      const breath = 1.0 + Math.sin(elapsed * breathFreq) * breathAmp;
      const curCoreScale = 0.62 + Math.sin(elapsed * breathFreq) * 0.04 + level * 0.18;
      setCoreRadiusScale(curCoreScale);
      setCoreAlpha(targetCoreAlpha);

      const particles = particlesRef.current;
      const nextProjected: ProjectedParticle[] = [];

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        let { x0, y0, z0 } = p;

        // Dynamic State-based deformations matching website
        let dx = Math.sin(elapsed * 1.5 + p.phase) * 0.015;
        let dy = Math.cos(elapsed * 1.8 + p.phase) * 0.015;
        let dz = Math.sin(elapsed * 2.1 + p.phase) * 0.015;

        // Ripple during listening
        if (rippleAmp > 0.001) {
          const dist = Math.sqrt(x0 * x0 + y0 * y0);
          const ripple = Math.sin(dist * 5 - elapsed * 6) * rippleAmp;
          dx += x0 * ripple;
          dy += y0 * ripple;
          dz += z0 * ripple;
        }

        // Pulse during thinking
        if (pulseAmp > 0.001) {
          const pulse = Math.sin(y0 * 6 + elapsed * 5) * pulseAmp;
          dx += x0 * pulse;
          dy += y0 * pulse;
          dz += z0 * pulse;
        }

        // Flow during speaking
        if (flowAmp > 0.001) {
          const flow = Math.sin(x0 * 4 + elapsed * 6) * Math.cos(y0 * 4 + elapsed * 5) * flowAmp;
          dx += flow * 0.4;
          dy += flow * 0.6;
          dz += flow * 0.3;
        }

        const px = (x0 + dx) * breath;
        const py = (y0 + dy) * breath;
        const pz = (z0 + dz) * breath;

        // 3D rotations
        const x1 = px * cosY - pz * sinY;
        const z1 = px * sinY + pz * cosY;
        const y1 = py * cosX - z1 * sinX;
        const z2 = py * sinX + z1 * cosX;

        // 2D projection
        const screenX = cx + x1 * baseRadius;
        const screenY = cy + y1 * baseRadius;

        // Depth shading factor: front particles (z2 > 0) are larger & brighter
        const depthFactor = (z2 + 1.2) / 2.4; // 0.0 to 1.0
        const alphaDepth = Math.max(0.12, Math.min(1.0, depthFactor * 0.85 + 0.15));
        const sizeDepth = Math.max(0.6, depthFactor * 1.3 + 0.4);

        let pColor = palette.bright;
        let baseAlpha = 0.75;

        if (p.tier === 'highlight') {
          pColor = palette.highlight;
          baseAlpha = 0.95;
        } else if (p.tier === 'bright') {
          pColor = palette.bright;
          baseAlpha = 0.85;
        } else if (p.tier === 'medium') {
          pColor = palette.medium;
          baseAlpha = 0.65;
        } else {
          pColor = palette.deep;
          baseAlpha = 0.35;
        }

        const finalAlpha = baseAlpha * alphaDepth;
        const particleRadius = p.baseRadius * sizeDepth * (1 + level * 0.25);
        const hasBloom = (p.tier === 'highlight' || p.tier === 'bright') && z2 > 0.3;

        nextProjected.push({
          x: screenX,
          y: screenY,
          z: z2,
          radius: Math.max(0.6, particleRadius),
          color: pColor,
          opacity: Math.max(0.1, Math.min(1, finalAlpha)),
          hasBloom,
          bloomRadius: particleRadius * 2.2,
        });
      }

      // Sort by Z for realistic depth layering
      nextProjected.sort((a, b) => a.z - b.z);
      setProjected(nextProjected);

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      active = false;
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [state, size, palette]);

  const cx = size / 2;
  const cy = size / 2;
  const coreRadius = (size * 0.36) * coreRadiusScale;

  return (
    <Pressable
      onPress={onPress}
      style={[styles.container, { width: size, height: size }]}
      accessibilityRole="button"
      accessibilityLabel={`Voice Orb - Current status: ${state}`}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <RadialGradient id="voiceOrbCore" cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0%" stopColor={palette.coreCenter} stopOpacity={0.65 * coreAlpha} />
            <Stop offset="30%" stopColor={palette.coreMid} stopOpacity={0.35 * coreAlpha} />
            <Stop offset="70%" stopColor={palette.coreOuter} stopOpacity={0.12 * coreAlpha} />
            <Stop offset="100%" stopColor={palette.coreOuter} stopOpacity={0} />
          </RadialGradient>
        </Defs>

        {/* Luminous Core Gradient */}
        <Circle cx={cx} cy={cy} r={coreRadius} fill="url(#voiceOrbCore)" />

        {/* Depth-sorted Particles */}
        <G>
          {projected.map((p, idx) => (
            <React.Fragment key={idx}>
              {/* Soft bloom halo for front highlight particles */}
              {p.hasBloom && (
                <Circle
                  cx={p.x}
                  cy={p.y}
                  r={p.bloomRadius}
                  fill={palette.highlight}
                  fillOpacity={p.opacity * 0.25}
                />
              )}
              {/* Particle point */}
              <Circle
                cx={p.x}
                cy={p.y}
                r={p.radius}
                fill={p.color}
                fillOpacity={p.opacity}
              />
            </React.Fragment>
          ))}
        </G>
      </Svg>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
