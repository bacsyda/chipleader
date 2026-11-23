// Dòng tiền của mình trong phòng Phỏm, dựng từ log (chỉ cửa sổ LOG_WINDOW giao dịch gần nhất server gửi kèm).
// a > 0: nhận (người khác gửi mình, họ nợ mình thêm); a < 0: gửi (mình ghi nợ cho họ). Cùng chiều với Lãi/Nợ trên màn hình.

/**
 * log: các giao dịch {id, t, fromId, toId, amount}; me: id của mình; otherId: chỉ tính với người này (bỏ trống = cả phòng);
 * members: tập id đang ở trong phòng (bỏ qua giao dịch với người đã rời); current: số hiện tại của mình (đã tính từ sổ nợ).
 * Số dư tích lũy neo vào `current`: điểm cuối luôn khớp số đang hiện, kể cả khi cửa sổ log đã cắt bớt giao dịch cũ.
 */
export function flow(log, me, otherId, members, current) {
  const pts = [];
  for (const e of log) {
    let a = 0;
    if (e.toId === me && (!otherId || e.fromId === otherId) && (!members || members.has(e.fromId))) a = e.amount;
    else if (e.fromId === me && (!otherId || e.toId === otherId) && (!members || members.has(e.toId))) a = -e.amount;
    if (a) pts.push({ id: e.id, t: e.t, a });
  }
  const sum = pts.reduce((s, p) => s + p.a, 0);
  const start = current - sum;
  let c = start;
  for (const p of pts) { c += p.a; p.cum = c; }
  const received = pts.reduce((s, p) => s + (p.a > 0 ? p.a : 0), 0);
  return { pts, start, current, received, sent: received - sum };
}
