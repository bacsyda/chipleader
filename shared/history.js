// Lịch sử giao dịch gửi theo cửa sổ để payload không phình theo độ dài ván. Dùng chung server, client, test.

export const LOG_WINDOW = 50;       // room:state chỉ kèm chừng này giao dịch gần nhất (kèm logTotal = tổng số)
export const LOG_STEP = 100;        // mỗi lần bấm "Xem thêm" xin thêm chừng này
export const LOG_TAIL_MAX = 1000;   // tối đa một lần xin (server chặn trên)

/**
 * Ghép bản tải thêm (`tail`, tăng dần theo id) với cửa sổ mới nhất server vừa gửi (`win`).
 * Giao dịch có trong cả hai lấy bản của cửa sổ (mới hơn: cờ cancelled/canUndo), giao dịch mới hơn bản tải thì thêm vào cuối.
 */
export function mergeRows(win, tail) {
  if (!tail?.length) return win;
  const fresh = new Map(win.map((t) => [t.id, t]));
  const rows = tail.map((t) => fresh.get(t.id) ?? t);
  const last = tail[tail.length - 1].id;
  for (const t of win) if (t.id > last) rows.push(t);
  return rows;
}

/** "vừa xong", "10 giây trước", "1 phút trước", "2 giờ trước", "3 ngày trước". ms = khoảng cách tới hiện tại. */
export function ago(ms) {
  const s = Math.floor(ms / 1000);
  if (s < 5) return 'vừa xong';      // gồm cả lệch đồng hồ nhỏ (ms âm)
  if (s < 60) return `${s} giây trước`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} phút trước`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} giờ trước`;
  return `${Math.floor(h / 24)} ngày trước`;
}
