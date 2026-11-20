// Luật chơi thuần túy, không biết gì về mạng.
// Nguồn sự thật là room.log (chỉ thêm vào). Chip, pot, bảng cược đều được TÍNH LẠI từ log,
// nên hoàn tác và reset khi pot về 0 luôn nhất quán.
// Chip là chip THẬT: mỗi người có một đống chip (stacks), pot có một đống (potChips). Tố/lấy chuyển đúng
// những chip đó từ đống này sang đống kia, và ghi lại chip nào đã đi (moved) để client vẽ hoạt ảnh.

import { addToMap, transfer } from '../shared/chips.js';
import { LOG_WINDOW, LOG_TAIL_MAX } from '../shared/history.js';

// UNDO_WINDOW: chỉ tính canUndo (nút Hoàn tác trên giao diện) cho từng này giao dịch gần nhất, để publicState không phải
// phát lại cả log cho mỗi giao dịch. Server vẫn kiểm tra đầy đủ khi nhận tx:undo.
export const LIMITS = { MAX_ADD: 1_000_000, MAX_NAME: 8, MAX_PLAYERS: 8, UNDO_WINDOW: 20 };

export class RuleError extends Error {
  constructor(code) { super(code); this.code = code; }
}

const positiveInt = (n) => Number.isSafeInteger(n) && n > 0;
const cancelledIds = (log) => new Set(log.filter((t) => t.type === 'undo').map((t) => t.refId));

function applyTx(s, tx) {
  const p = tx.playerId;
  s.chips[p] ??= 0;
  s.bets[p] ??= 0;
  s.stacks[p] ??= {};
  if (tx.type === 'add') {
    s.chips[p] += tx.amount;
    addToMap(s.stacks[p], tx.amount);
  } else if (tx.type === 'bet') {
    s.chips[p] -= tx.amount; s.pot += tx.amount;
    s.bets[p] += tx.amount; s.lastBet[p] = tx.amount; s.version++;
    const moved = transfer(s.stacks[p], s.potChips, tx.amount);   // chip rời chồng người tố, vào pot
    if (moved) s.moved[tx.id] = moved; else s.broken = true;
    if (tx.blind) s.blindsPosted[tx.blind] = true;   // blind này đã có người đặt trong ván
  } else if (tx.type === 'take') {
    s.chips[p] += tx.amount; s.pot -= tx.amount; s.version++;
    const moved = transfer(s.potChips, s.stacks[p], tx.amount);   // chip rời pot, về chồng người lấy
    if (moved) s.moved[tx.id] = moved; else s.broken = true;
  }
  if (s.chips[p] < 0 || s.pot < 0) s.broken = true;
  // Hết ván: pot về 0 thì reset bảng cược và nhãn tố gần nhất.
  if (tx.type !== 'add' && s.pot === 0) { s.bets = {}; s.lastBet = {}; s.potChips = {}; s.blindsPosted = { small: false, big: false }; }
}

/** Phát lại log (bỏ qua giao dịch đã bị hoàn tác) để ra trạng thái hiện tại. */
export function derive(room) {
  const s = { chips: {}, pot: 0, potChips: {}, stacks: {}, moved: {}, blindsPosted: { small: false, big: false }, bets: {}, lastBet: {}, version: 0, broken: false };
  const gone = cancelledIds(room.log);
  for (const tx of room.log) if (tx.type !== 'undo' && !gone.has(tx.id)) applyTx(s, tx);
  return s;
}

// Log chỉ được thêm vào, nên kết quả derive của một phòng chỉ đổi khi log dài ra. Lưu theo phòng (WeakMap, không đụng
// vào object phòng) để các lần broadcast không đổi log (vào phòng, rớt mạng...) khỏi phát lại log.
const cache = new WeakMap();
function snapshot(room) {
  const len = room.log.length;
  let c = cache.get(room);
  if (!c || c.len !== len) {
    c = { len, s: derive(room), gone: cancelledIds(room.log), undo: new Map(), byId: new Map(room.log.map((t) => [t.id, t])) };
    cache.set(room, c);
  }
  return c;
}
const derived = (room) => snapshot(room).s;

/** Mức lấy tối đa của một người: tổng min(cược_j, cược_mình), bị chặn bởi pot hiện có. */
export function maxTake(s, id) {
  const mine = s.bets[id] ?? 0;
  let sum = 0;
  for (const b of Object.values(s.bets)) sum += Math.min(b, mine);
  return Math.min(sum, s.pot);
}

function member(room, id) {
  const p = room.players.find((x) => x.id === id);
  if (!p) throw new RuleError('not_member');
  return p;
}

function push(room, me, tx) {
  const entry = { id: ++room.seq, t: Date.now(), playerId: me.id, name: me.name, ...tx };
  room.log.push(entry);
  return entry;
}

export function addChips(room, playerId, amount) {
  const me = member(room, playerId);
  if (!positiveInt(amount)) throw new RuleError('bad_amount');
  if (amount > LIMITS.MAX_ADD) throw new RuleError('over_cap');
  if (derived(room).pot > 0) throw new RuleError('pot_not_empty'); // chỉ nạp chip khi hết ván
  return push(room, me, { type: 'add', amount });
}

/** blind: 'small' | 'big' để đặt blind (số tiền do phòng quy định, mỗi blind chỉ một người đặt mỗi ván). */
export function placeBet(room, playerId, amount, blind) {
  const me = member(room, playerId);
  const s = derived(room);
  if (blind !== undefined && blind !== null) {
    if (blind !== 'small' && blind !== 'big') throw new RuleError('bad_amount');
    if (s.blindsPosted[blind]) throw new RuleError('blind_posted');
    const n = Math.min(room.blinds[blind], s.chips[playerId] ?? 0);   // thiếu chip thì đặt nốt phần còn lại
    if (n < 1) throw new RuleError('insufficient_chips');
    return push(room, me, { type: 'bet', amount: n, blind });
  }
  if (!positiveInt(amount)) throw new RuleError('bad_amount');
  if (amount > (s.chips[playerId] ?? 0)) throw new RuleError('insufficient_chips');
  return push(room, me, { type: 'bet', amount });
}

/** amount: số chip, hoặc 'all' (= mức tối đa). version: phiên bản pot client đang thấy. */
export function takePot(room, playerId, amount, version) {
  const me = member(room, playerId);
  const s = derived(room);
  if (version !== s.version) throw new RuleError('pot_changed');
  const max = maxTake(s, playerId);
  const n = amount === 'all' ? max : amount;
  if (!positiveInt(n)) throw new RuleError('bad_amount');
  if (n > max) throw new RuleError('over_max');
  return push(room, me, { type: 'take', amount: n });
}

/** Chủ phòng hoàn tác bằng bản ghi đảo ngược; chỉ cho phép nếu không ai bị âm chip / pot âm. */
export function undo(room, actorId, txId) {
  const me = member(room, actorId);
  if (actorId !== room.hostId) throw new RuleError('not_host');
  const tx = room.log.find((t) => t.id === txId);
  if (!tx || tx.type === 'undo') throw new RuleError('tx_not_found');
  if (room.log.some((t) => t.type === 'undo' && t.refId === txId)) throw new RuleError('already_undone');
  const trial = { log: [...room.log, { type: 'undo', id: -1, refId: txId }] };
  if (derive(trial).broken) throw new RuleError('undo_blocked');
  return push(room, me, { type: 'undo', refId: txId, amount: tx.amount });
}

// Giao dịch này có hoàn tác được không (bỏ nó đi thì không ai âm chip, pot không âm). Kết quả nhớ theo độ dài log.
function undoable(room, tx, c) {
  if (tx.type === 'undo' || c.gone.has(tx.id)) return false;
  if (!c.undo.has(tx.id)) c.undo.set(tx.id, !derive({ log: [...room.log, { type: 'undo', id: -1, refId: tx.id }] }).broken);
  return c.undo.get(tx.id);
}

// Một giao dịch trong log gửi cho client. i = vị trí trong room.log (canUndo chỉ tính cho UNDO_WINDOW giao dịch cuối).
// Bản ghi hoàn tác kèm `ref` (loại, tên, blind, số chip của giao dịch bị hoàn tác) vì giao dịch đó có thể nằm ngoài cửa sổ.
function toEntry(room, c, t, i, withChips) {
  const e = { ...t, cancelled: c.gone.has(t.id), canUndo: i >= room.log.length - LIMITS.UNDO_WINDOW && undoable(room, t, c) };
  if (withChips) e.chips = c.s.moved[t.id];
  if (t.type === 'undo') {
    const r = c.byId.get(t.refId);
    if (r) e.ref = { type: r.type, name: r.name, blind: r.blind, amount: r.amount };
  }
  return e;
}

/** Trạng thái gửi cho client (không có token). Log chỉ có LOG_WINDOW giao dịch cuối; logTotal là tổng số. */
export function publicState(room) {
  const c = snapshot(room);
  const s = c.s;
  const from = Math.max(0, room.log.length - LOG_WINDOW);
  return {
    id: room.id,
    hostId: room.hostId,
    blinds: room.blinds,
    blindsPosted: s.blindsPosted,
    pot: s.pot,
    potChips: s.potChips,
    version: s.version,
    players: room.players.map(({ id, name, online }) => ({
      id, name, online,
      chips: s.chips[id] ?? 0,
      chipMap: s.stacks[id] ?? {},     // chồng chip thật của người này {mệnh giá: số chip}
      totalBet: s.bets[id] ?? 0,
      lastBet: s.lastBet[id] ?? 0,
      maxTake: maxTake(s, id),
    })),
    logTotal: room.log.length,
    log: room.log.slice(from).map((t, k) => toEntry(room, c, t, from + k, true)),
  };
}

/** `count` giao dịch cuối của log (để xem lịch sử dài hơn cửa sổ), không kèm chip đã đi vì chỉ dùng để hiển thị. */
export function logTail(room, playerId, count) {
  member(room, playerId);
  if (!Number.isSafeInteger(count) || count < 1) throw new RuleError('bad_amount');
  const c = snapshot(room);
  const from = Math.max(0, room.log.length - Math.min(count, LOG_TAIL_MAX));
  return { total: room.log.length, entries: room.log.slice(from).map((t, k) => toEntry(room, c, t, from + k, false)) };
}
