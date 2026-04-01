"use client";
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// ═══════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════

const BREATH_ACCENT = '#14b8a6';

const EXERCISE_PATTERNS = {
  box: [
    { name: 'Inhale',  dur: 4, targetScale: 1.0, tone: 'high' },
    { name: 'Hold',    dur: 4, targetScale: 1.0, tone: 'mid'  },
    { name: 'Exhale',  dur: 4, targetScale: 0.32, tone: 'low' },
    { name: 'Hold',    dur: 4, targetScale: 0.32, tone: 'mid' },
  ],
  '478': [
    { name: 'Inhale',  dur: 4, targetScale: 1.0, tone: 'high' },
    { name: 'Hold',    dur: 7, targetScale: 1.0, tone: 'mid'  },
    { name: 'Exhale',  dur: 8, targetScale: 0.32, tone: 'low' },
  ],
  psych_sigh: [
    { name: 'Inhale',    dur: 2, targetScale: 0.6,  tone: 'high' },
    { name: '+ Inhale',  dur: 1, targetScale: 1.0,  tone: 'high' },
    { name: 'Exhale',    dur: 8, targetScale: 0.32, tone: 'low'  },
  ],
  walking_48: [
    { name: 'Inhale',  dur: 4, targetScale: 1.0,  tone: 'high' },
    { name: 'Exhale',  dur: 8, targetScale: 0.32, tone: 'low'  },
  ],
};

const ROUTINES = {
  morning: {
    id: 'morning', label: 'Morning', emoji: '☀️',
    accent: '#f59e0b',
    grad: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 50%, #fde68a 100%)',
    exercises: [
      { id: 'box',  label: 'Box Breathing',    type: 'timed', pattern: 'box',  settingKey: 'box_dur',       defaultDur: 300 },
      { id: '478',  label: '4-7-8 Breathing',  type: 'timed', pattern: '478',  settingKey: 'breathing_dur', defaultDur: 300 },
      { id: 'vis',  label: 'Visualisation',     type: 'timed', pattern: null,   settingKey: 'vis_dur',       defaultDur: 120 },
    ],
  },
  post_session: {
    id: 'post_session', label: 'Post-Session', emoji: '📈',
    accent: '#14b8a6',
    grad: 'linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 50%, #99f6e4 100%)',
    exercises: [
      { id: 'sigh', label: 'Psychological Sigh', type: 'reps',  pattern: 'psych_sigh', reps: 3 },
      { id: 'box',  label: 'Box Breathing',       type: 'timed', pattern: 'box',        settingKey: 'box_dur', defaultDur: 300 },
      { id: 'walk', label: '4-8 Walking Breath',  type: 'open',  pattern: 'walking_48' },
    ],
  },
  night: {
    id: 'night', label: 'Night', emoji: '🌙',
    accent: '#818cf8',
    grad: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 50%, #c7d2fe 100%)',
    exercises: [
      { id: '478',  label: '4-7-8 Breathing', type: 'timed', pattern: '478', settingKey: 'breathing_dur', defaultDur: 300 },
    ],
  },
};

const DEFAULT_SETTINGS = {
  morning:      { box_dur: 300, breathing_dur: 300, vis_dur: 120,  audio: true, ambient: 'rain', notify: true, notify_time: '07:30' },
  post_session: { box_dur: 300, audio: true, ambient: 'rain', notify: true, notify_time: '11:00' },
  night:        { breathing_dur: 300, audio: true, ambient: 'rain', notify: true, notify_time: '21:30' },
};

// ═══════════════════════════════════════════════════════════
// SETTINGS HELPERS (localStorage)
// ═══════════════════════════════════════════════════════════

function loadSettings(userId) {
  try {
    const raw = localStorage.getItem(`raiz-breath-${userId}`);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    // Merge with defaults so new keys always exist
    return {
      morning:      { ...DEFAULT_SETTINGS.morning,      ...parsed.morning },
      post_session: { ...DEFAULT_SETTINGS.post_session, ...parsed.post_session },
      night:        { ...DEFAULT_SETTINGS.night,        ...parsed.night },
    };
  } catch { return DEFAULT_SETTINGS; }
}

function saveSettings(userId, s) {
  localStorage.setItem(`raiz-breath-${userId}`, JSON.stringify(s));
}

function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ═══════════════════════════════════════════════════════════
// AUDIO ENGINE
// ═══════════════════════════════════════════════════════════

let _audioCtx = null;
function getAudioCtx() {
  if (!_audioCtx || _audioCtx.state === 'closed') {
    _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (_audioCtx.state === 'suspended') _audioCtx.resume();
  return _audioCtx;
}

function playChime(toneType = 'high') {
  try {
    const ctx = getAudioCtx();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    const freqs = { high: 528, mid: 396, low: 264 };
    osc.frequency.value = freqs[toneType] || 528;
    osc.type = 'sine';
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.15, t + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
    osc.start(t);
    osc.stop(t + 1.4);
  } catch (_) {}
}

function startAmbient(type) {
  try {
    const ctx = getAudioCtx();

    // ── Singing bowl — sustained 432 Hz with slow harmonic shimmer ──
    if (type === 'bowl') {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const lfo  = ctx.createOscillator();
      const lfoG = ctx.createGain();
      const gain = ctx.createGain();
      osc1.frequency.value = 432;
      osc2.frequency.value = 648;  // perfect fifth harmonic
      osc1.type = osc2.type = 'sine';
      lfo.frequency.value = 0.07; // ultra-slow shimmer
      lfo.type = 'sine';
      lfoG.gain.value = 0.035;
      gain.gain.value = 0.09;
      lfo.connect(lfoG);
      lfoG.connect(gain.gain);
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);
      osc1.start(); osc2.start(); lfo.start();
      return { stop: () => { try { osc1.stop(); osc2.stop(); lfo.stop(); } catch(_){} } };
    }

    // ── Noise-based ambients ─────────────────────────────────────────
    const bufSize = 4 * ctx.sampleRate;
    const buf = ctx.createBuffer(2, bufSize, ctx.sampleRate);

    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      if (type === 'brown') {
        // Brown noise — deep ocean rumble
        let lastOut = 0;
        for (let i = 0; i < bufSize; i++) {
          const w = Math.random() * 2 - 1;
          d[i] = (lastOut + 0.02 * w) / 1.02;
          lastOut = d[i];
          d[i] *= 3.5;
        }
      } else {
        // Pink noise — rain / white noise
        let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
        for (let i = 0; i < bufSize; i++) {
          const w = Math.random() * 2 - 1;
          b0=0.99886*b0+w*0.0555179; b1=0.99332*b1+w*0.0750759;
          b2=0.96900*b2+w*0.1538520; b3=0.86650*b3+w*0.3104856;
          b4=0.55000*b4+w*0.5329522; b5=-0.7616*b5-w*0.0168980;
          d[i] = (b0+b1+b2+b3+b4+b5+b6+w*0.5362)*0.11;
          b6 = w * 0.115926;
        }
      }
    }

    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop   = true;

    const filter = ctx.createBiquadFilter();
    if (type === 'rain') {
      filter.type = 'bandpass'; filter.frequency.value = 900; filter.Q.value = 0.4;
    } else if (type === 'white_noise') {
      filter.type = 'highpass'; filter.frequency.value = 300;
    } else { // brown
      filter.type = 'lowpass'; filter.frequency.value = 350;
    }

    const gain = ctx.createGain();
    gain.gain.value = type === 'brown' ? 0.45 : 0.07;
    src.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
    src.start();
    return { stop: () => { try { src.stop(); } catch(_){} } };
  } catch (_) { return null; }
}

function stopAmbient(ref) {
  try { ref?.stop(); } catch (_) {}
}

// ═══════════════════════════════════════════════════════════
// WAKE LOCK
// ═══════════════════════════════════════════════════════════

function useWakeLock(active) {
  const lockRef = useRef(null);
  useEffect(() => {
    if (!active) return;
    if ('wakeLock' in navigator) {
      navigator.wakeLock.request('screen')
        .then(l => { lockRef.current = l; })
        .catch(() => {});
    }
    return () => {
      lockRef.current?.release().catch(() => {});
      lockRef.current = null;
    };
  }, [active]);
}

// ═══════════════════════════════════════════════════════════
// MOOD PICKER
// ═══════════════════════════════════════════════════════════

const MOOD_LABELS   = ['Stressed','Flat','Neutral','Calm','Happy'];
const ENERGY_EMOJIS = ['🌑','🌒','🌓','🌔','🌕'];

function MoodPicker({ stage, onSubmit, accent, nightMode }) {
  const [mood, setMood]     = useState(null);
  const [energy, setEnergy] = useState(null);
  const canSubmit = mood !== null && energy !== null;
  const bg   = nightMode ? '#0a0f1e' : '#fff';
  const text = nightMode ? '#c7d2fe' : '#1c1208';
  const muted = nightMode ? '#4f546e' : '#a08870';

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '100dvh',
      background: bg, padding: '40px 28px', fontFamily: 'inherit',
      animation: 'bwFadeIn 0.4s ease',
    }}>
      <p style={{ fontSize: 13, fontWeight: 600, color: muted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8, marginTop: 0 }}>
        {stage === 'before' ? 'Before you begin' : 'After your session'}
      </p>
      <h2 style={{ fontSize: 26, fontWeight: 700, color: text, margin: '0 0 40px', textAlign: 'center', lineHeight: 1.3 }}>
        {stage === 'before' ? 'How are you feeling?' : 'How do you feel now?'}
      </h2>

      <p style={{ fontSize: 12, color: muted, letterSpacing: 0.8, textTransform: 'uppercase', margin: '0 0 14px', fontWeight: 600 }}>Mood</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 32, justifyContent: 'center' }}>
        {MOOD_LABELS.map((label, i) => (
          <button key={i} onClick={() => setMood(i + 1)} style={{
            padding: '10px 18px', borderRadius: 50, fontSize: 13, fontWeight: 600,
            border: mood === i + 1 ? `2px solid ${accent}` : `2px solid ${nightMode ? '#2a3050' : '#e5e7eb'}`,
            background: mood === i + 1 ? `${accent}20` : nightMode ? '#161b2e' : '#f5f5f5',
            color: mood === i + 1 ? accent : muted,
            cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
            boxShadow: mood === i + 1 ? `0 0 0 3px ${accent}25` : 'none',
          }}>{label}</button>
        ))}
      </div>

      <p style={{ fontSize: 12, color: muted, letterSpacing: 0.8, textTransform: 'uppercase', margin: '0 0 14px', fontWeight: 600 }}>Energy</p>
      <div style={{ display: 'flex', gap: 12, marginBottom: 48 }}>
        {ENERGY_EMOJIS.map((e, i) => (
          <button key={i} onClick={() => setEnergy(i + 1)} style={{
            width: 52, height: 52, borderRadius: '50%', fontSize: 18,
            border: energy === i + 1 ? `2.5px solid ${accent}` : '2.5px solid transparent',
            background: energy === i + 1 ? `${accent}20` : nightMode ? '#161b2e' : '#f5f5f5',
            cursor: 'pointer', transition: 'all 0.15s',
            boxShadow: energy === i + 1 ? `0 0 0 3px ${accent}30` : 'none',
          }}>{e}</button>
        ))}
      </div>

      <button
        disabled={!canSubmit}
        onClick={() => onSubmit(mood, energy)}
        style={{
          width: '100%', maxWidth: 300, padding: '17px 0', borderRadius: 50,
          background: canSubmit ? accent : nightMode ? '#1e2236' : '#e5e7eb',
          color: canSubmit ? '#fff' : muted,
          border: 'none', fontSize: 15, fontWeight: 700,
          cursor: canSubmit ? 'pointer' : 'default',
          transition: 'all 0.2s', fontFamily: 'inherit',
          letterSpacing: 0.2,
        }}
      >
        {stage === 'before' ? 'Begin Session' : 'Complete'}
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// BREATHING CIRCLE
// ═══════════════════════════════════════════════════════════

function BreathingCircle({ scale, transitionDur, accent, nightMode, isHold }) {
  const col1 = nightMode ? '#4f46e5' : '#5eead4';
  const col2 = nightMode ? '#818cf8' : '#14b8a6';
  const col3 = nightMode ? '#312e81' : '#6366f1';
  const glow = nightMode
    ? `0 0 ${30 + 50 * scale}px rgba(129,140,248,${0.15 + 0.2 * scale}), 0 0 ${60 + 80 * scale}px rgba(79,70,229,${0.08 + 0.12 * scale})`
    : `0 0 ${30 + 50 * scale}px rgba(20,184,166,${0.2 + 0.25 * scale}), 0 0 ${60 + 80 * scale}px rgba(99,102,241,${0.1 + 0.1 * scale})`;

  return (
    <div style={{ position: 'relative', width: 220, height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* Track ring */}
      <div style={{
        position: 'absolute', width: 220, height: 220, borderRadius: '50%',
        border: `1.5px solid ${nightMode ? 'rgba(129,140,248,0.12)' : 'rgba(20,184,166,0.15)'}`,
      }} />
      {/* Breathing circle */}
      <div style={{
        width: 180, height: 180, borderRadius: '50%',
        background: `radial-gradient(circle at 35% 30%, ${col1}, ${col2} 50%, ${col3})`,
        transform: `scale(${scale})`,
        transition: `transform ${transitionDur}s ease-in-out, box-shadow ${transitionDur}s ease-in-out`,
        boxShadow: glow,
        animation: isHold ? 'bwPulse 2s ease-in-out infinite' : 'none',
      }} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// EXERCISE PLAYER
// ═══════════════════════════════════════════════════════════

function ExercisePlayer({
  exercise, routineSettings, routineId, audioEnabled, ambientType,
  exerciseIdx, totalExercises, onComplete, nightMode, accent,
}) {
  const pattern        = exercise.pattern ? EXERCISE_PATTERNS[exercise.pattern] : null;
  const sessionDur     = exercise.type === 'timed'
    ? (routineSettings[exercise.settingKey] ?? exercise.defaultDur)
    : null;
  const totalReps      = exercise.type === 'reps' ? (exercise.reps ?? 3) : null;

  const [circleScale,   setCircleScale]   = useState(0.32);
  const [transDur,      setTransDur]      = useState(4);
  const [phaseIdx,      setPhaseIdx]      = useState(0);
  const [phaseTime,     setPhaseTime]     = useState(pattern ? pattern[0].dur : 0);
  const [totalTime,     setTotalTime]     = useState(sessionDur ?? 0);
  const [repsDone,      setRepsDone]      = useState(0);
  const [running,       setPaused]        = useState(false); // false = paused
  const [started,       setStarted]       = useState(false);
  const [sessionOver,   setSessionOver]   = useState(false);

  const phaseIdxRef  = useRef(0);
  const repsDoneRef  = useRef(0);
  const totalTimeRef = useRef(sessionDur ?? 0);
  const ambientRef   = useRef(null);
  const intervalRef  = useRef(null);

  useWakeLock(started && !sessionOver);

  const applyPhase = useCallback((idx, patternArr) => {
    const p = patternArr[idx % patternArr.length];
    setCircleScale(p.targetScale);
    setTransDur(p.dur);
    setPhaseTime(p.dur);
    phaseIdxRef.current = idx % patternArr.length;
    if (audioEnabled) playChime(p.tone);
  }, [audioEnabled]);

  const startSession = useCallback(() => {
    setStarted(true);
    setPaused(true);
    if (audioEnabled && ambientType !== 'none') {
      ambientRef.current = startAmbient(ambientType);
    }
    if (pattern) {
      applyPhase(0, pattern);
    } else {
      // Visualisation — gentle slow pulse
      setCircleScale(0.65);
      setTransDur(8);
    }
  }, [audioEnabled, ambientType, pattern, applyPhase]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearInterval(intervalRef.current);
      stopAmbient(ambientRef.current);
    };
  }, []);

  // Timer tick
  useEffect(() => {
    if (!running || sessionOver) return;

    intervalRef.current = setInterval(() => {
      // Decrement total time
      if (exercise.type === 'timed') {
        totalTimeRef.current -= 1;
        if (totalTimeRef.current <= 0) {
          clearInterval(intervalRef.current);
          stopAmbient(ambientRef.current);
          setSessionOver(true);
          return;
        }
        setTotalTime(totalTimeRef.current);
      }

      // Decrement phase time
      setPhaseTime(prev => {
        if (prev <= 1) {
          if (!pattern) {
            // Visualisation: toggle gentle pulse
            setCircleScale(s => s === 0.65 ? 0.75 : 0.65);
            return 5;
          }
          const nextIdx = (phaseIdxRef.current + 1) % pattern.length;
          // Check rep completion (psych sigh: one rep = full pattern cycle back to start)
          if (exercise.type === 'reps' && nextIdx === 0) {
            const newReps = repsDoneRef.current + 1;
            repsDoneRef.current = newReps;
            setRepsDone(newReps);
            if (newReps >= totalReps) {
              clearInterval(intervalRef.current);
              stopAmbient(ambientRef.current);
              setSessionOver(true);
              return 0;
            }
          }
          applyPhase(nextIdx, pattern);
          return pattern[nextIdx].dur;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(intervalRef.current);
  }, [running, sessionOver, pattern, exercise.type, totalReps, applyPhase]);

  const togglePause = () => {
    if (!started) { startSession(); return; }
    setPaused(p => !p);
  };

  const currentPhase = pattern ? pattern[phaseIdxRef.current] : null;
  const isHold = currentPhase?.name?.toLowerCase().startsWith('hold');
  const progress = exercise.type === 'timed' && sessionDur > 0
    ? (sessionDur - totalTime) / sessionDur
    : exercise.type === 'reps' ? repsDone / totalReps
    : null;

  const bg   = nightMode ? '#05070e' : '#f8fafc';
  const text = nightMode ? '#e0e7ff' : '#1c1208';
  const muted = nightMode ? '#4f546e' : '#94a3b8';

  // Open-ended (walking): just show done button
  if (exercise.type === 'open' && sessionOver) {
    onComplete();
    return null;
  }

  if (sessionOver) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: '100dvh', background: bg,
        animation: 'bwFadeIn 0.5s ease',
      }}>
        <div style={{
          width: 80, height: 80, borderRadius: '50%',
          background: `${accent}20`, display: 'flex', alignItems: 'center',
          justifyContent: 'center', marginBottom: 24,
          animation: 'bwScaleIn 0.4s ease',
        }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
            stroke={accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <p style={{ fontSize: 22, fontWeight: 700, color: text, margin: '0 0 8px' }}>{exercise.label}</p>
        <p style={{ fontSize: 14, color: muted, margin: '0 0 40px' }}>Complete</p>
        <button onClick={onComplete} style={{
          padding: '16px 48px', borderRadius: 50, background: accent,
          color: '#fff', border: 'none', fontSize: 15, fontWeight: 700,
          cursor: 'pointer', fontFamily: 'inherit',
        }}>
          {exerciseIdx + 1 < totalExercises ? 'Next Exercise →' : 'Finish Session'}
        </button>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      minHeight: '100dvh', background: bg, padding: '0 28px',
      fontFamily: 'inherit',
    }}>
      {/* Progress bar */}
      <div style={{ width: '100%', height: 2, background: nightMode ? '#1e2236' : '#e2e8f0', marginTop: 0 }}>
        {progress !== null && (
          <div style={{
            height: '100%', width: `${progress * 100}%`,
            background: accent, transition: 'width 1s linear',
          }} />
        )}
      </div>

      {/* Exercise label */}
      <p style={{
        fontSize: 11, fontWeight: 700, color: muted, letterSpacing: 1.2,
        textTransform: 'uppercase', marginTop: 32, marginBottom: 4,
      }}>
        {exerciseIdx + 1} / {totalExercises}
      </p>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: text, margin: '0 0 0', textAlign: 'center' }}>
        {exercise.label}
      </h2>

      {/* Phase label */}
      <p style={{
        fontSize: 15, fontWeight: 600, color: accent,
        margin: '28px 0 0', minHeight: 22, letterSpacing: 0.3,
      }}>
        {!started ? 'Tap to begin' : currentPhase?.name ?? 'Breathe'}
      </p>

      {/* Phase countdown */}
      <p style={{
        fontSize: 52, fontWeight: 200, color: text,
        margin: '8px 0', fontVariantNumeric: 'tabular-nums', letterSpacing: -2,
        lineHeight: 1,
      }}>
        {started && exercise.type !== 'open' ? phaseTime : ''}
      </p>

      {/* Circle */}
      <div style={{ marginTop: exercise.type === 'open' ? 20 : 4, marginBottom: 24 }}>
        <BreathingCircle
          scale={started ? circleScale : 0.32}
          transitionDur={transDur}
          accent={accent}
          nightMode={nightMode}
          isHold={isHold}
        />
      </div>

      {/* Rep counter or total time */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        {exercise.type === 'reps' && (
          <p style={{ fontSize: 14, color: muted, margin: 0 }}>
            Rep {repsDone + 1} of {totalReps}
          </p>
        )}
        {exercise.type === 'timed' && started && (
          <p style={{ fontSize: 14, color: muted, margin: 0 }}>
            {fmtTime(totalTime)} remaining
          </p>
        )}
        {exercise.type === 'open' && started && (
          <p style={{ fontSize: 14, color: muted, margin: 0 }}>
            Walk and breathe — tap Done when finished
          </p>
        )}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 16 }}>
        <button
          onClick={togglePause}
          style={{
            width: 64, height: 64, borderRadius: '50%',
            background: accent, border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 4px 20px ${accent}40`,
          }}
        >
          {!started ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          ) : running ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          )}
        </button>

        {exercise.type === 'open' && started && (
          <button onClick={onComplete} style={{
            padding: '0 28px', height: 64, borderRadius: 32,
            background: nightMode ? '#1e2236' : '#f1f5f9',
            border: 'none', cursor: 'pointer', fontSize: 15, fontWeight: 600,
            color: text, fontFamily: 'inherit',
          }}>
            Done
          </button>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// ROUTINE SESSION ORCHESTRATOR
// ═══════════════════════════════════════════════════════════

function RoutineSession({ routine, settings, session, onBack, onComplete, nightMode }) {
  const accent  = routine.accent;
  const exercises = routine.exercises;
  const sett    = settings[routine.id];

  const [phase, setPhase]             = useState('mood_before'); // mood_before | exercise | mood_after | done
  const [exerciseIdx, setExerciseIdx] = useState(0);
  const [moodBefore, setMoodBefore]   = useState(null);
  const [energyBefore, setEnergyBefore] = useState(null);
  const [startTime]                   = useState(Date.now());

  const bg   = nightMode ? '#05070e' : '#f8fafc';
  const text = nightMode ? '#e0e7ff' : '#1c1208';
  const muted = nightMode ? '#4f546e' : '#94a3b8';

  const handleMoodBefore = (m, e) => {
    setMoodBefore(m); setEnergyBefore(e);
    setPhase('exercise');
  };

  const handleExerciseDone = () => {
    if (exerciseIdx + 1 < exercises.length) {
      setExerciseIdx(i => i + 1);
    } else {
      setPhase('mood_after');
    }
  };

  const handleMoodAfter = async (moodAfter, energyAfter) => {
    const dur = Math.round((Date.now() - startTime) / 1000);
    await supabase.from('breath_completions').insert({
      user_id:       session.user.id,
      routine_type:  routine.id,
      mood_before:   moodBefore,
      energy_before: energyBefore,
      mood_after:    moodAfter,
      energy_after:  energyAfter,
      duration_sec:  dur,
    });
    setPhase('done');
  };

  if (phase === 'mood_before') {
    return <MoodPicker stage="before" onSubmit={handleMoodBefore} accent={accent} nightMode={nightMode} />;
  }

  if (phase === 'exercise') {
    return (
      <div>
        {/* Back button */}
        <button
          onClick={onBack}
          style={{
            position: 'fixed', top: 'max(16px, env(safe-area-inset-top))', left: 20,
            zIndex: 20, background: nightMode ? '#1e2236' : 'rgba(255,255,255,0.9)',
            border: 'none', borderRadius: 50, width: 40, height: 40,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', backdropFilter: 'blur(8px)',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke={nightMode ? '#818cf8' : '#64748b'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>

        <ExercisePlayer
          key={exerciseIdx}
          exercise={exercises[exerciseIdx]}
          routineSettings={sett}
          routineId={routine.id}
          audioEnabled={sett.audio}
          ambientType={sett.ambient}
          exerciseIdx={exerciseIdx}
          totalExercises={exercises.length}
          onComplete={handleExerciseDone}
          nightMode={nightMode}
          accent={accent}
        />
      </div>
    );
  }

  if (phase === 'mood_after') {
    return <MoodPicker stage="after" onSubmit={handleMoodAfter} accent={accent} nightMode={nightMode} />;
  }

  // Done
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '100dvh',
      background: bg, padding: '40px 28px', fontFamily: 'inherit',
      animation: 'bwFadeIn 0.5s ease',
    }}>
      {/* Completion dots */}
      <div style={{ position: 'relative', width: 100, height: 100, marginBottom: 32 }}>
        {[0,1,2,3,4,5].map(i => (
          <div key={i} style={{
            position: 'absolute',
            width: 8, height: 8, borderRadius: '50%',
            background: accent,
            top: '50%', left: '50%',
            transform: `rotate(${i*60}deg) translateY(-36px)`,
            animation: `bwDot 1.6s ease ${i*0.12}s infinite`,
            opacity: 0.6,
          }} />
        ))}
        <div style={{
          position: 'absolute', inset: 20, borderRadius: '50%',
          background: `${accent}20`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
            stroke={accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
      </div>

      <h2 style={{ fontSize: 28, fontWeight: 700, color: text, margin: '0 0 10px', textAlign: 'center' }}>
        {routine.emoji} {routine.label} Complete
      </h2>
      <p style={{ fontSize: 15, color: muted, margin: '0 0 48px', textAlign: 'center', lineHeight: 1.6 }}>
        Great work. Your body and mind thank you.
      </p>

      <button onClick={onComplete} style={{
        padding: '17px 56px', borderRadius: 50, background: accent,
        color: '#fff', border: 'none', fontSize: 15, fontWeight: 700,
        cursor: 'pointer', fontFamily: 'inherit',
        boxShadow: `0 4px 20px ${accent}40`,
      }}>
        Done
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TRACKER VIEW
// ═══════════════════════════════════════════════════════════

function TrackerView({ completions, colors, isDark }) {
  const today = new Date();

  // Build the last 7 days
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (6 - i));
    return d;
  });
  const dayLabels = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

  function dayOfWeekLabel(d) {
    return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()];
  }

  function wasCompleted(routineId, date) {
    return completions.some(c => {
      if (c.routine_type !== routineId) return false;
      const cd = new Date(c.completed_at);
      return cd.toDateString() === date.toDateString();
    });
  }

  // Streaks
  function calcStreak(routineId) {
    let streak = 0;
    const d = new Date(today);
    while (true) {
      if (wasCompleted(routineId, d)) {
        streak++;
        d.setDate(d.getDate() - 1);
      } else { break; }
    }
    return streak;
  }

  const routineList = [
    { id: 'morning',      emoji: '☀️', label: 'Morning',      accent: '#f59e0b' },
    { id: 'post_session', emoji: '📈', label: 'Post-Session', accent: '#14b8a6' },
    { id: 'night',        emoji: '🌙', label: 'Night',        accent: '#818cf8' },
  ];

  const text  = colors.text;
  const muted = colors.muted;
  const card  = colors.card;
  const border = colors.border;

  return (
    <div style={{ padding: '20px 20px 100px', animation: 'bwFadeIn 0.3s ease' }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: text, margin: '0 0 24px' }}>Progress</h2>

      {/* Streaks */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 28 }}>
        {routineList.map(r => {
          const streak = calcStreak(r.id);
          return (
            <div key={r.id} style={{
              flex: 1, background: card, borderRadius: 16, padding: '14px 10px',
              border: `1px solid ${border}`, textAlign: 'center',
              boxShadow: colors.shadow,
            }}>
              <div style={{ fontSize: 22, marginBottom: 4 }}>{r.emoji}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: streak > 0 ? r.accent : muted, lineHeight: 1 }}>
                {streak > 0 ? `🔥${streak}` : '—'}
              </div>
              <div style={{ fontSize: 10, color: muted, marginTop: 4, fontWeight: 600, letterSpacing: 0.5 }}>
                {streak === 1 ? '1 day' : streak > 1 ? `${streak} days` : 'No streak'}
              </div>
            </div>
          );
        })}
      </div>

      {/* Weekly grid */}
      <div style={{
        background: card, borderRadius: 20, padding: '18px 16px',
        border: `1px solid ${border}`, boxShadow: colors.shadow,
        marginBottom: 24,
      }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: muted, letterSpacing: 1, textTransform: 'uppercase', margin: '0 0 16px' }}>
          This Week
        </p>

        {/* Day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: '72px repeat(7, 1fr)', gap: 4, marginBottom: 8 }}>
          <div />
          {days.map((d, i) => (
            <div key={i} style={{
              textAlign: 'center', fontSize: 10, fontWeight: 700,
              color: d.toDateString() === today.toDateString() ? BREATH_ACCENT : muted,
              letterSpacing: 0.5,
            }}>
              {dayOfWeekLabel(d).slice(0,2)}
            </div>
          ))}
        </div>

        {/* Routine rows */}
        {routineList.map(r => (
          <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '72px repeat(7, 1fr)', gap: 4, marginBottom: 8, alignItems: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: muted, whiteSpace: 'nowrap' }}>
              {r.emoji} {r.label.split('-')[0]}
            </div>
            {days.map((d, i) => {
              const done = wasCompleted(r.id, d);
              const isToday = d.toDateString() === today.toDateString();
              return (
                <div key={i} style={{
                  height: 28, borderRadius: 8,
                  background: done ? r.accent : isDark ? '#2a1a0c' : '#f1f5f9',
                  border: isToday && !done ? `1.5px solid ${r.accent}50` : '1.5px solid transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.2s',
                }}>
                  {done && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                      stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Recent sessions */}
      <div style={{
        background: card, borderRadius: 20, padding: '18px 16px',
        border: `1px solid ${border}`, boxShadow: colors.shadow,
      }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: muted, letterSpacing: 1, textTransform: 'uppercase', margin: '0 0 14px' }}>
          Recent Sessions
        </p>
        {completions.length === 0 ? (
          <p style={{ color: muted, fontSize: 14, margin: 0 }}>No sessions yet. Start your first routine.</p>
        ) : (
          completions.slice(0, 8).map(c => {
            const r = routineList.find(r => r.id === c.routine_type);
            const d = new Date(c.completed_at);
            const isToday = d.toDateString() === today.toDateString();
            const label = isToday ? 'Today' : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
            return (
              <div key={c.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 0', borderBottom: `1px solid ${border}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 10,
                    background: `${r?.accent}20`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16,
                  }}>{r?.emoji}</div>
                  <div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: text }}>{r?.label}</p>
                    <p style={{ margin: 0, fontSize: 11, color: muted }}>{label} · {d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
                {c.mood_after && (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: muted }}>{MOOD_LABELS[c.mood_after - 1]}</span>
                    <span style={{ fontSize: 16 }}>{ENERGY_EMOJIS[c.energy_after - 1]}</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// SETTINGS SHEET
// ═══════════════════════════════════════════════════════════

function SettingsSheet({ open, onClose, settings, onSave, routineId, colors, isDark }) {
  const routine = ROUTINES[routineId];
  const [local, setLocal] = useState(() => ({ ...settings[routineId] }));
  useEffect(() => { if (open) setLocal({ ...settings[routineId] }); }, [open, settings, routineId]);

  if (!open) return null;
  const accent = routine.accent;
  const text   = colors.text;
  const muted  = colors.muted;
  const card   = colors.card;
  const bg     = colors.bg;
  const border = colors.border;

  const field = {
    background: isDark ? '#2a1a0c' : '#f5f0e8',
    border: `1px solid ${border}`,
    borderRadius: 12, padding: '12px 14px',
    color: text, fontSize: 14, fontFamily: 'inherit', width: '100%',
    outline: 'none', boxSizing: 'border-box',
  };

  const DurationRow = ({ label, settingKey, min = 60, max = 1200, step = 60 }) => {
    const val = local[settingKey] ?? 300;
    return (
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 14, color: text, fontWeight: 500 }}>{label}</span>
          <span style={{ fontSize: 14, color: accent, fontWeight: 700 }}>{fmtTime(val)}</span>
        </div>
        <input type="range" min={min} max={max} step={step} value={val}
          onChange={e => setLocal(s => ({ ...s, [settingKey]: +e.target.value }))}
          style={{ width: '100%', accentColor: accent }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <span style={{ fontSize: 11, color: muted }}>{fmtTime(min)}</span>
          <span style={{ fontSize: 11, color: muted }}>{fmtTime(max)}</span>
        </div>
      </div>
    );
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      background: 'rgba(0,0,0,0.5)', display: 'flex',
      alignItems: 'flex-end', justifyContent: 'center',
    }} onClick={onClose}>
      <div style={{
        width: '100%', maxWidth: 430, background: bg, borderRadius: '24px 24px 0 0',
        padding: '24px 24px calc(env(safe-area-inset-bottom) + 24px)',
        maxHeight: '85dvh', overflowY: 'auto',
        animation: 'bwSlideUp 0.3s ease',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: muted, margin: '0 auto 20px', opacity: 0.4 }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: text }}>
            {routine.emoji} {routine.label} Settings
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: muted, fontSize: 22, lineHeight: 1, padding: 4 }}>×</button>
        </div>

        {/* Durations */}
        <p style={{ fontSize: 12, fontWeight: 700, color: muted, letterSpacing: 1, textTransform: 'uppercase', margin: '0 0 16px' }}>Durations</p>
        {routine.exercises.filter(e => e.type === 'timed' && e.settingKey).map(e => (
          <DurationRow key={e.settingKey} label={e.label} settingKey={e.settingKey} />
        ))}

        {/* Audio */}
        <p style={{ fontSize: 12, fontWeight: 700, color: muted, letterSpacing: 1, textTransform: 'uppercase', margin: '8px 0 16px' }}>Audio</p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontSize: 14, color: text }}>Sound on</span>
          <button onClick={() => setLocal(s => ({ ...s, audio: !s.audio }))} style={{
            width: 48, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer',
            background: local.audio ? accent : isDark ? '#3a2618' : '#e5e7eb',
            position: 'relative', transition: 'background 0.2s',
          }}>
            <div style={{
              position: 'absolute', top: 3.5, left: local.audio ? 23 : 3.5,
              width: 21, height: 21, borderRadius: '50%', background: '#fff',
              transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
            }} />
          </button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
          {[
            { id: 'rain',       label: '🌧 Rain'   },
            { id: 'brown',      label: '🌊 Ocean'  },
            { id: 'bowl',       label: '🎵 Bowl'   },
            { id: 'white_noise',label: '〰 White'  },
            { id: 'none',       label: '🔇 None'   },
          ].map(({ id, label }) => (
            <button key={id} onClick={() => setLocal(s => ({ ...s, ambient: id }))} style={{
              flex: '1 0 calc(33% - 8px)', padding: '10px 0', borderRadius: 12,
              border: `1.5px solid ${local.ambient === id ? accent : border}`,
              background: local.ambient === id ? `${accent}18` : 'transparent',
              color: local.ambient === id ? accent : muted,
              fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              letterSpacing: 0.3,
            }}>
              {label}
            </button>
          ))}
        </div>

        {/* Notifications */}
        <p style={{ fontSize: 12, fontWeight: 700, color: muted, letterSpacing: 1, textTransform: 'uppercase', margin: '8px 0 16px' }}>Notification</p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontSize: 14, color: text }}>Daily reminder</span>
          <button onClick={() => setLocal(s => ({ ...s, notify: !s.notify }))} style={{
            width: 48, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer',
            background: local.notify ? accent : isDark ? '#3a2618' : '#e5e7eb',
            position: 'relative', transition: 'background 0.2s',
          }}>
            <div style={{
              position: 'absolute', top: 3.5, left: local.notify ? 23 : 3.5,
              width: 21, height: 21, borderRadius: '50%', background: '#fff',
              transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
            }} />
          </button>
        </div>

        {local.notify && (
          <input
            type="time"
            value={local.notify_time}
            onChange={e => setLocal(s => ({ ...s, notify_time: e.target.value }))}
            style={{ ...field, marginBottom: 16 }}
          />
        )}

        <button onClick={() => { onSave(routineId, local); onClose(); }} style={{
          width: '100%', padding: '16px 0', borderRadius: 50,
          background: accent, color: '#fff', border: 'none',
          fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          marginTop: 8,
        }}>
          Save Settings
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// NOTIFICATIONS
// ═══════════════════════════════════════════════════════════

function scheduleNotifications(settings) {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  // Clear any existing scheduled notifications
  const existing = JSON.parse(localStorage.getItem('raiz-notif-timeouts') || '[]');
  existing.forEach(id => clearTimeout(id));

  const now = new Date();
  const ids = [];

  Object.entries(settings).forEach(([routineId, s]) => {
    if (!s.notify || !s.notify_time) return;
    const [h, m] = s.notify_time.split(':').map(Number);
    const target = new Date();
    target.setHours(h, m, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);
    const delay = target - now;
    const labels = { morning: 'Morning Breathwork', post_session: 'Post-Session Breathwork', night: 'Night Wind-Down' };
    const id = setTimeout(() => {
      new Notification('Raíz — ' + labels[routineId], {
        body: "Haven't done it yet? Take a few minutes for yourself.",
        icon: '/icon-192.png',
        data: { routine: routineId },
      });
    }, delay);
    ids.push(id);
  });

  localStorage.setItem('raiz-notif-timeouts', JSON.stringify(ids));
}

async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

// ═══════════════════════════════════════════════════════════
// MAIN BREATHWORK APP
// ═══════════════════════════════════════════════════════════

export default function BreathworkApp({ session, isDark, colors, toggleTheme, onBack }) {
  const [tab,              setTab]              = useState('morning');
  const [activeRoutine,    setActiveRoutine]    = useState(null);
  const [settings,         setSettings]         = useState(() => loadSettings(session.user.id));
  const [showSettings,     setShowSettings]     = useState(false);
  const [settingsFor,      setSettingsFor]      = useState('morning');
  const [completions,      setCompletions]      = useState([]);
  const [notifGranted,     setNotifGranted]     = useState(false);

  // Auto-open from notification tap
  useEffect(() => {
    const pending = localStorage.getItem('raiz-pending-routine');
    if (pending && ROUTINES[pending]) {
      localStorage.removeItem('raiz-pending-routine');
      setActiveRoutine(ROUTINES[pending]);
    }
  }, []);

  // Load completions
  useEffect(() => {
    supabase.from('breath_completions')
      .select('*')
      .eq('user_id', session.user.id)
      .order('completed_at', { ascending: false })
      .limit(90)
      .then(({ data }) => setCompletions(data || []));
  }, [session.user.id]);

  // Notification permission check
  useEffect(() => {
    if ('Notification' in window) {
      setNotifGranted(Notification.permission === 'granted');
    }
  }, []);

  // Schedule notifications when settings change
  useEffect(() => {
    if (notifGranted) scheduleNotifications(settings);
  }, [settings, notifGranted]);

  const handleSaveSettings = (routineId, newSett) => {
    const updated = { ...settings, [routineId]: newSett };
    setSettings(updated);
    saveSettings(session.user.id, updated);
  };

  const handleRoutineComplete = () => {
    // Refresh completions
    supabase.from('breath_completions')
      .select('*')
      .eq('user_id', session.user.id)
      .order('completed_at', { ascending: false })
      .limit(90)
      .then(({ data }) => setCompletions(data || []));
    setActiveRoutine(null);
  };

  const handleEnableNotifications = async () => {
    const granted = await requestNotificationPermission();
    setNotifGranted(granted);
    if (granted) scheduleNotifications(settings);
  };

  const TABS = [
    { id: 'morning',      emoji: '☀️', label: 'Morning' },
    { id: 'post_session', emoji: '📈', label: 'Post' },
    { id: 'night',        emoji: '🌙', label: 'Night' },
    { id: 'tracker',      emoji: '📊', label: 'Tracker' },
  ];

  const NAV_H    = 62;
  const HEADER_H = 70;
  const bg       = isDark ? '#160e06' : '#fdf8f0';
  const text     = colors.text;
  const muted    = colors.muted;
  const card     = colors.card;
  const border   = colors.border;

  // ── Active routine session ──────────────────────────────
  if (activeRoutine) {
    const nightMode = activeRoutine.id === 'night';
    return (
      <>
        <style>{KEYFRAMES}</style>
        <div style={{ maxWidth: 430, margin: '0 auto', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
          <RoutineSession
            routine={activeRoutine}
            settings={settings}
            session={session}
            onBack={() => setActiveRoutine(null)}
            onComplete={handleRoutineComplete}
            nightMode={nightMode}
          />
        </div>
      </>
    );
  }

  // ── Home / Tabs ─────────────────────────────────────────
  return (
    <>
      <style>{KEYFRAMES}</style>
      <div style={{
        minHeight: '100dvh', background: bg,
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
        color: text, maxWidth: 430, margin: '0 auto', position: 'relative',
      }}>
        {/* Header */}
        <div style={{
          position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)',
          width: '100%', maxWidth: 430, zIndex: 10,
          padding: `max(16px, env(safe-area-inset-top)) 20px 14px`,
          background: `${bg}f0`, backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          borderBottom: `1px solid ${border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={onBack} style={{
              width: 36, height: 36, borderRadius: 50,
              background: `${BREATH_ACCENT}18`, border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke={BREATH_ACCENT} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: text, letterSpacing: '-0.3px' }}>
              Breathwork
            </h1>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {tab !== 'tracker' && (
              <button onClick={() => { setSettingsFor(tab); setShowSettings(true); }} style={{
                width: 36, height: 36, borderRadius: 50,
                background: `${BREATH_ACCENT}18`, border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke={BREATH_ACCENT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
                </svg>
              </button>
            )}
            <button onClick={toggleTheme} style={{
              width: 36, height: 36, borderRadius: 50,
              background: `${BREATH_ACCENT}18`, border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {isDark
                ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={BREATH_ACCENT} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={BREATH_ACCENT} strokeWidth="2" strokeLinecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
              }
            </button>
          </div>
        </div>

        {/* Tab content */}
        <div style={{ paddingTop: HEADER_H + 8, paddingBottom: NAV_H + 16 }}>
          {tab !== 'tracker' ? (
            <RoutineHomeTab
              routine={ROUTINES[tab]}
              completions={completions}
              settings={settings}
              onStart={() => setActiveRoutine(ROUTINES[tab])}
              onSettings={() => { setSettingsFor(tab); setShowSettings(true); }}
              colors={colors}
              isDark={isDark}
              notifGranted={notifGranted}
              onEnableNotif={handleEnableNotifications}
            />
          ) : (
            <TrackerView completions={completions} colors={colors} isDark={isDark} />
          )}
        </div>

        {/* Bottom nav */}
        <div style={{
          position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
          width: '100%', maxWidth: 430, zIndex: 10,
          paddingBottom: 'env(safe-area-inset-bottom)',
          background: `${bg}f2`, backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          borderTop: `1px solid ${border}`,
          display: 'flex',
        }}>
          {TABS.map(t => {
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                flex: 1, padding: '10px 0 8px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                background: 'none', border: 'none', cursor: 'pointer',
                color: active ? BREATH_ACCENT : muted,
                transition: 'color 0.2s',
              }}>
                <span style={{ fontSize: 18, lineHeight: 1 }}>{t.emoji}</span>
                <span style={{ fontSize: 10, fontWeight: active ? 700 : 500, letterSpacing: 0.2, fontFamily: 'inherit' }}>
                  {t.label}
                </span>
                {active && <div style={{ width: 4, height: 4, borderRadius: '50%', background: BREATH_ACCENT, marginTop: -2 }} />}
              </button>
            );
          })}
        </div>

        {/* Settings sheet */}
        <SettingsSheet
          open={showSettings}
          onClose={() => setShowSettings(false)}
          settings={settings}
          onSave={handleSaveSettings}
          routineId={settingsFor}
          colors={colors}
          isDark={isDark}
        />
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════
// ROUTINE HOME TAB
// ═══════════════════════════════════════════════════════════

function RoutineHomeTab({ routine, completions, settings, onStart, onSettings, colors, isDark, notifGranted, onEnableNotif }) {
  const sett = settings[routine.id];
  const today = new Date();
  const doneToday = completions.some(c =>
    c.routine_type === routine.id &&
    new Date(c.completed_at).toDateString() === today.toDateString()
  );

  const text  = colors.text;
  const muted = colors.muted;
  const card  = colors.card;
  const border = colors.border;
  const accent = routine.accent;

  // Calculate total routine duration
  const totalSec = routine.exercises.reduce((sum, e) => {
    if (e.type === 'timed') return sum + (sett[e.settingKey] ?? e.defaultDur ?? 0);
    if (e.type === 'reps')  return sum + (e.reps * 11); // ~11s per psych sigh
    return sum + 30; // open-ended rough estimate
  }, 0);

  return (
    <div style={{ padding: '20px 20px 0', animation: 'bwFadeIn 0.3s ease' }}>
      {/* Hero card */}
      <div style={{
        borderRadius: 24, background: routine.grad,
        padding: '28px 24px 24px', marginBottom: 20,
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', right: -20, top: -20, fontSize: 100, opacity: 0.12, lineHeight: 1 }}>
          {routine.emoji}
        </div>
        <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: accent, letterSpacing: 1, textTransform: 'uppercase' }}>
          {doneToday ? '✓ Done today' : 'Ready to begin'}
        </p>
        <h2 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 700, color: isDark ? '#fff' : '#1c1208' }}>
          {routine.emoji} {routine.label}
        </h2>
        <p style={{ margin: '0 0 20px', fontSize: 14, color: isDark ? 'rgba(255,255,255,0.6)' : '#64748b' }}>
          {routine.exercises.length} exercise{routine.exercises.length > 1 ? 's' : ''} · ~{Math.ceil(totalSec / 60)} min
        </p>
        <button onClick={onStart} style={{
          padding: '14px 32px', borderRadius: 50,
          background: accent, color: '#fff',
          border: 'none', fontSize: 15, fontWeight: 700,
          cursor: 'pointer', fontFamily: 'inherit',
          boxShadow: `0 4px 18px ${accent}50`,
          transition: 'transform 0.15s, box-shadow 0.15s',
        }}
          onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
          onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          {doneToday ? 'Run Again' : 'Start Session'}
        </button>
      </div>

      {/* Exercise list */}
      <div style={{
        background: card, borderRadius: 20, padding: '16px',
        border: `1px solid ${border}`, boxShadow: colors.shadow, marginBottom: 16,
      }}>
        <p style={{ margin: '0 0 14px', fontSize: 12, fontWeight: 700, color: muted, letterSpacing: 1, textTransform: 'uppercase' }}>
          Exercises
        </p>
        {routine.exercises.map((e, i) => {
          const dur = e.type === 'timed' ? (sett[e.settingKey] ?? e.defaultDur) : null;
          return (
            <div key={e.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 0',
              borderBottom: i < routine.exercises.length - 1 ? `1px solid ${border}` : 'none',
            }}>
              <div style={{
                width: 34, height: 34, borderRadius: 10,
                background: `${accent}18`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 800, color: accent,
              }}>
                {i + 1}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: text }}>{e.label}</p>
                <p style={{ margin: 0, fontSize: 12, color: muted }}>
                  {e.type === 'timed' ? fmtTime(dur) :
                   e.type === 'reps'  ? `${e.reps} reps` :
                   'Until done'}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Notification CTA */}
      {!notifGranted && (
        <button onClick={onEnableNotif} style={{
          width: '100%', padding: '14px 16px', borderRadius: 16,
          background: isDark ? '#1e2236' : '#f8fafc',
          border: `1px dashed ${border}`,
          color: muted, fontSize: 13, fontWeight: 600,
          cursor: 'pointer', fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          marginBottom: 16,
        }}>
          🔔 Enable reminders at {sett.notify_time}
        </button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// KEYFRAMES
// ═══════════════════════════════════════════════════════════

const KEYFRAMES = `
  @keyframes bwFadeIn {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes bwSlideUp {
    from { transform: translateY(100%); }
    to   { transform: translateY(0); }
  }
  @keyframes bwScaleIn {
    from { transform: scale(0.5); opacity: 0; }
    to   { transform: scale(1); opacity: 1; }
  }
  @keyframes bwPulse {
    0%, 100% { opacity: 0.9; }
    50%       { opacity: 1; }
  }
  @keyframes bwDot {
    0%   { opacity: 0.6; transform: rotate(var(--r)) translateY(-36px) scale(1); }
    50%  { opacity: 1; }
    100% { opacity: 0.6; transform: rotate(var(--r)) translateY(-36px) scale(1); }
  }
`;
