// Phần thuần của hoạt ảnh chip (không React, không DOM) để test được.
// "view" là thứ đang được VẼ: { pot: {mệnh giá: số chip}, seats: {playerId: {mệnh giá: số chip}} }.
// Server luôn gửi trạng thái cuối; khi có chip bay thì view đi sau một nhịp, mỗi chip chạm đích mới cộng vào view.
import { DENOMS } from '../../shared/chips.js';

export const seatsOf = (room) => Object.fromEntries(room.players.map((p) => [p.id, p.chipMap ?? {}]));
export const snapshot = (room) => ({ pot: room.potChips ?? {}, seats: seatsOf(room) });

/**
 * Giao dịch mới giữa hai trạng thái liên tiếp của cùng một phòng, so theo id (log chỉ gửi một cửa sổ cuối nên không
 * so được theo độ dài). Khác phòng hoặc chưa có trạng thái trước thì không có gì mới.
 */
export const addedTxs = (before, room) => {
  if (!before || before.id !== room.id) return [];
  const last = before.log.length ? before.log[before.log.length - 1].id : 0;
  return room.log.filter((t) => t.id > last);
};

const plus = (map = {}, v) => ({ ...map, [v]: (map[v] || 0) + 1 });

/** Cộng một chip mệnh giá v vào pot (where = 'pot') hoặc vào chồng của một người (where = playerId). */
export const landChip = (view, where, v) => (
  where === 'pot'
    ? { ...view, pot: plus(view.pot, v) }
    : { ...view, seats: { ...view.seats, [where]: plus(view.seats[where], v) } }
);

/** Mọi chip của một đống thành danh sách [{d, i}] (i = thứ tự trong cùng mệnh giá), từ lớn đến nhỏ. */
export const chipList = (map = {}) => DENOMS.flatMap((d) => Array.from({ length: map[d.v] || 0 }, (_, i) => ({ d, i })));

/**
 * Trạng thái vẽ ngay TRƯỚC khi chip của giao dịch `tx` bắt đầu bay.
 * - tố: chip đã rời chồng người tố, nhưng pot còn như cũ (chip chưa tới);
 * - lấy: chip đã rời pot, nhưng chồng người lấy còn như cũ (chip chưa về).
 * Cộng mọi chip bay vào view này thì ra đúng snapshot(room).
 */
export function startView(before, room, tx) {
  if (tx.type === 'bet') return { pot: before.potChips ?? {}, seats: seatsOf(room) };
  const mine = before.players.find((p) => p.id === tx.playerId)?.chipMap ?? {};
  return { pot: room.potChips ?? {}, seats: { ...seatsOf(room), [tx.playerId]: mine } };
}
