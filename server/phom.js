// Phòng Phỏm: sổ ghi nợ giữa các người trong phòng. Không có hoàn tác, không có lịch sử.
// Mỗi lần "Gửi" là ghi nợ thêm cho người nhận (số nguyên dương). Trả nợ = người kia gửi ngược lại.

import { LIMITS, RuleError } from './logic.js';
import { LOG_WINDOW, LOG_TAIL_MAX } from '../shared/history.js';

export function sendDebt(room, fromId, toId, amount) {
  if (room.type !== 'phom') throw new RuleError('wrong_type');
  const ids = new Set(room.players.map((p) => p.id));
  if (!ids.has(fromId)) throw new RuleError('not_member');
  if (toId === fromId || !ids.has(toId)) throw new RuleError('bad_target');
  if (!Number.isSafeInteger(amount) || amount < 1) throw new RuleError('bad_amount');
  if (amount > LIMITS.MAX_ADD) throw new RuleError('over_cap');
  const next = (room.debts[fromId]?.[toId] ?? 0) + amount;
  if (!Number.isSafeInteger(next)) throw new RuleError('over_cap');
  room.debts[fromId] ??= {};
  room.debts[fromId][toId] = next;
  // Lịch sử (chỉ để xem, không hoàn tác) và giao dịch gần nhất của từng cặp (để hiện trên hàng mỗi người).
  const names = Object.fromEntries(room.players.map((p) => [p.id, p.name]));
  const t = Date.now();
  room.log.push({ id: ++room.seq, t, fromId, toId, from: names[fromId], to: names[toId], amount });
  if (room.log.length > LOG_TAIL_MAX) room.log.shift();
  room.last[fromId] ??= {};
  room.last[fromId][toId] = { amount, t };
}

/** Xóa mọi khoản nợ liên quan tới một người (khi họ rời phòng). */
export function forget(room, playerId) {
  for (const book of [room.debts, room.last]) {
    delete book[playerId];
    for (const m of Object.values(book)) delete m[playerId];
  }
}

export function phomState(room) {
  return {
    type: 'phom',
    id: room.id,
    hostId: room.hostId,
    players: room.players.map(({ id, name, online }) => ({ id, name, online })),
    debts: room.debts,
    last: room.last,                  // last[A][B] = lần gần nhất A gửi B {amount, t}
    serverTime: Date.now(),           // để client hiện "x giây trước" đúng dù đồng hồ máy lệch
    logTotal: room.log.length,
    log: room.log.slice(-LOG_WINDOW),
  };
}

/** `count` giao dịch cuối (để xem lịch sử dài hơn cửa sổ), cũ nhất trước. */
export function phomTail(room, playerId, count) {
  if (!room.players.some((p) => p.id === playerId)) throw new RuleError('not_member');
  if (!Number.isSafeInteger(count) || count < 1) throw new RuleError('bad_amount');
  return { total: room.log.length, entries: room.log.slice(-Math.min(count, LOG_TAIL_MAX)) };
}
