// Mệnh giá hệ thập phân: vàng 1000, tím 500, đen 100, xanh lá 50, xanh dương 10, đỏ 5, trắng 1.
// Chỉ cần sửa mảng này (và SLOT trong client/src/geometry.js) để đổi bộ mệnh giá.
export const DENOMS = [
  { v: 1000, face: '#E8B04A', side: '#B9862A', mark: '#fff', ink: '#fff' },
  { v: 500, face: '#7B4FB5', side: '#5A3790', mark: '#fff', ink: '#fff' },
  { v: 100, face: '#2A2A2A', side: '#101010', mark: '#fff', ink: '#fff' },
  { v: 50, face: '#0E6B3B', side: '#094A29', mark: '#fff', ink: '#fff' },
  { v: 10, face: '#2F6DB5', side: '#214E85', mark: '#fff', ink: '#fff' },
  { v: 5, face: '#D8452B', side: '#A82F1B', mark: '#fff', ink: '#fff' },
  { v: 1, face: '#F1F1EC', side: '#C4C4BC', mark: '#5B6B8C', ink: '#4a4a4a' },
];

/** Tổng giá trị của một đống chip {mệnh giá: số chip}. */
export const valueOf = (map = {}) => DENOMS.reduce((s, d) => s + d.v * (map[d.v] || 0), 0);

/**
 * Chia một số tiền thành các chồng chip có SỐ CHIP gần bằng nhau giữa các mệnh giá (dùng cho lần nạp chip,
 * để người chơi có đủ loại chip lẻ mà tố). Tổng giá trị luôn bằng `pot`.
 */
export function breakdown(pot) {
  let D = DENOMS.filter((d) => d.v <= pot);
  const sum = (list) => list.reduce((s, d) => s + d.v, 0);
  while (D.length > 1 && pot < sum(D)) D = D.slice(1);
  if (!D.length) return [];
  const q = Math.floor(pot / sum(D));
  let rest = pot - q * sum(D);
  return D.map((d) => {
    const extra = Math.floor(rest / d.v);
    rest -= extra * d.v;
    return { ...d, count: q + extra };
  });
}

/** Thêm các chip biểu diễn `amount` (chia đều mệnh giá) vào đống `map`. */
export function addToMap(map, amount) {
  for (const d of breakdown(amount)) map[d.v] = (map[d.v] || 0) + d.count;
}

// Ít chip nhất cho một số tiền nhỏ (dùng khi phải đổi tiền lẻ).
function greedy(amount) {
  const m = {};
  let r = amount;
  for (const d of DENOMS) {
    const k = Math.floor(r / d.v);
    if (k) { m[d.v] = k; r -= k * d.v; }
  }
  return m;
}

/**
 * Chuyển ĐÚNG `amount` bằng chip thật từ đống `from` sang đống `to` (cả hai bị sửa tại chỗ).
 * Lấy tham lam từ chip lớn đến nhỏ, ví dụ chồng có nhiều chip 10 mà tố 30 thì đi đúng 3 chip 10.
 * Nếu thiếu chip nhỏ thì đổi tiền lẻ: tách chip nhỏ nhất lớn hơn phần thiếu, phần thối trả lại bên đưa.
 * Trả về đống chip đã chuyển {mệnh giá: số chip}, hoặc null (không đổi gì) nếu `from` không đủ.
 */
export function transfer(from, to, amount) {
  if (!Number.isSafeInteger(amount) || amount <= 0 || valueOf(from) < amount) return null;
  const moved = {};
  const give = (v, k) => { moved[v] = (moved[v] || 0) + k; };
  let rest = amount;
  for (const d of DENOMS) {
    const k = Math.min(from[d.v] || 0, Math.floor(rest / d.v));
    if (k) { from[d.v] -= k; give(d.v, k); rest -= k * d.v; }
  }
  if (rest > 0) {
    // valueOf(from) >= amount nên luôn còn một chip lớn hơn `rest` để tách.
    const big = [...DENOMS].reverse().find((d) => (from[d.v] || 0) > 0 && d.v > rest);
    from[big.v] -= 1;
    addToMap(from, big.v - rest);
    for (const [v, k] of Object.entries(greedy(rest))) give(v, k);
  }
  for (const k of Object.keys(from)) if (!from[k]) delete from[k];
  for (const [v, k] of Object.entries(moved)) to[v] = (to[v] || 0) + k;
  return moved;
}

/** Đống chip -> danh sách chồng (từ mệnh giá lớn đến nhỏ) kèm màu, để vẽ. */
export function stacksFromMap(map = {}) {
  return DENOMS.filter((d) => map[d.v] > 0).map((d) => ({ ...d, count: map[d.v] }));
}
