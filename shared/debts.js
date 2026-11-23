// Sổ nợ theo cặp (dùng chung server, client, test).
// debts[A][B] = tổng A đã "gửi" cho B (ghi nợ thêm cho B).
// Số hiển thị ở hàng B trên máy A = A đã gửi B − B đã gửi A.
//   dương: A nợ B,  âm: B nợ A.

export const owed = (debts = {}, me, other) => (debts[me]?.[other] ?? 0) - (debts[other]?.[me] ?? 0);

/** Số dư của `me` so với những người trong `ids` (bỏ qua chính mình): dương = lãi (người khác nợ mình), âm = đang nợ. */
export const net = (debts, me, ids) => 0 - ids.filter((id) => id !== me).reduce((sum, id) => sum + owed(debts, me, id), 0);   // 0 - x, không dùng -x để tránh ra -0
