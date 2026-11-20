// Âm thanh tổng hợp bằng Web Audio API: không cần file âm thanh nào.
let ctx = null, master = null, noise = null;
let muted = localStorage.getItem('pokerchip.muted') === '1';

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.7;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp).connect(ctx.destination);
    noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.2), ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
// Trình duyệt (nhất là điện thoại) chỉ cho phát âm sau một lần chạm của người dùng.
window.addEventListener('pointerdown', ensure, { passive: true });

const rnd = (a, b) => a + Math.random() * (b - a);

function env(g, t, peak, dur) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}

function tone(t, f0, f1, dur, peak, type = 'sine') {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  env(g, t, peak, dur);
  o.connect(g).connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}

// Một tiếng "cạch" của chip: nhát nhiễu ngắn qua bộ lọc + hai nốt cộng hưởng. Mỗi lần hơi khác để khỏi máy móc.
function clack(t, pitch = 1, vol = 1) {
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = rnd(2600, 3800) * pitch; bp.Q.value = 1.4;
  const g = ctx.createGain();
  env(g, t, 0.55 * vol, 0.045);
  src.connect(bp).connect(g).connect(master);
  src.start(t, rnd(0, 0.1)); src.stop(t + 0.06);
  tone(t, rnd(1900, 2500) * pitch, rnd(1500, 1900) * pitch, 0.07, 0.16 * vol);
  tone(t, rnd(850, 1100) * pitch, 800 * pitch, 0.05, 0.1 * vol);
}

const SOUNDS = {
  click: (t) => tone(t, 1500, 1100, 0.03, 0.12, 'triangle'),
  bet: (t) => { clack(t); clack(t + 0.055, 1.06, 0.85); clack(t + 0.11, 0.94, 0.7); },
  add: (t) => {   // một chồng chip đặt xuống bàn
    [0, 0.05, 0.095, 0.135, 0.17, 0.2].forEach((d, i) => clack(t + d, 1 + i * 0.03, 0.9));
    tone(t + 0.2, 300, 200, 0.12, 0.12);
  },
  take: (t) => {  // kéo chip về phía mình, kèm một nốt chuông nhẹ
    for (let i = 0; i < 8; i++) clack(t + i * 0.05 + rnd(0, 0.015), rnd(0.9, 1.15), 0.9);
    tone(t + 0.45, 880, 880, 0.2, 0.07);
  },
  undo: (t) => { tone(t, 620, 420, 0.12, 0.14, 'triangle'); tone(t + 0.1, 420, 300, 0.14, 0.12, 'triangle'); },
  error: (t) => { tone(t, 180, 150, 0.1, 0.09, 'sawtooth'); tone(t + 0.13, 150, 120, 0.14, 0.09, 'sawtooth'); },
};

export function play(name, delay = 0) {
  if (muted) return;
  const c = ensure();
  if (!c || c.state !== 'running') return;   // chưa được mở khóa thì thôi, không dồn âm cũ
  SOUNDS[name]?.(c.currentTime + 0.005 + delay);
}

export const isMuted = () => muted;
export function setMuted(m) {
  muted = m;
  localStorage.setItem('pokerchip.muted', m ? '1' : '0');
  if (!m) play('click');
}
