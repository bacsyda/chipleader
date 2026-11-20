// Phòng Phỏm: sổ ghi nợ giữa các người trong phòng. Không có hoàn tác, không có lịch sử.
// Mỗi lần "Gửi" là ghi nợ thêm cho người nhận (số nguyên dương). Trả nợ = người kia gửi ngược lại.

import { LIMITS, RuleError } from './logic.js';

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
}

/** Xóa mọi khoản nợ liên quan tới một người (khi họ rời phòng). */
export function forget(room, playerId) {
  delete room.debts[playerId];
  for (const m of Object.values(room.debts)) delete m[playerId];
}

export function phomState(room) {
  return {
    type: 'phom',
    id: room.id,
    hostId: room.hostId,
    players: room.players.map(({ id, name, online }) => ({ id, name, online })),
    debts: room.debts,
  };
}
