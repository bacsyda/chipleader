import { fmt } from './util.js';

// Vị thế của mình với một người: dương = lãi (họ nợ mình), âm = nợ (mình nợ họ).
export const tone = (v) => (v > 0 ? 'up' : v < 0 ? 'down' : 'zero');
export const label = (v) => (v > 0 ? `Lãi ${fmt(v)}` : v < 0 ? `Nợ ${fmt(-v)}` : '0');
export const signed = (v) => (v > 0 ? `+${fmt(v)}` : fmt(v));
