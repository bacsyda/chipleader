// Bố cục bàn (phần thuần, không React): đặt từng ghế và cụm "nhãn tố + chồng chip" của họ sao cho
// không thứ gì đè lên thứ khác, ở mọi cỡ màn hình và số người chơi.
import { VB } from './geometry.js';

export const RIM = 14;   // bề dày viền bàn (px), khớp .felt trong styles.css

/** Ghế k (0 = "bạn", ở dưới cùng) nằm trên viền bàn dạng viên thuốc; trả về toạ độ tương đối 0..1 của khung bàn. */
export const seatFrac = (k, total) => {
  const a = ((90 + (k * 360) / total) * Math.PI) / 180;
  const f = (c) => (50 + 50 * Math.sign(c) * Math.abs(c) ** 0.77) / 100;
  return { fx: f(Math.cos(a)), fy: f(Math.sin(a)) };
};

/** Hệ số co theo cỡ màn hình điện thoại (1 = màn lớn). */
export const scaleFor = (vw, vh) => Math.max(0.8, Math.min(1, vw / 390, vh / 760));

/** Kích thước các phần tử (px) theo hệ số u. */
export const sizes = (u) => ({
  A: 44 * u,            // đường kính avatar
  crownW: 16 * u, crownH: 12 * u,
  em: 12 * Math.max(u, 0.9),   // cỡ chữ nhãn: không nhỏ hơn ~10.8px dù màn nhỏ
  badgeH: 12 * Math.max(u, 0.9) * 1.18,   // nhãn số chip bên dưới avatar
  pillH: 12 * Math.max(u, 0.9) * 1.32,    // nhãn số vừa tố
  pile: 0.28 * u,       // tỉ lệ chồng chip của ghế
});
const textW = (s, em) => [...String(s)].length * em * 0.64;   // ước lượng dư một chút
export const badgeW = (s, z) => textW(s, z.em) + 14 * (z.em / 12);
export const pillW = (s, z) => textW(s, z.em) + 16 * (z.em / 12);

/** Cỡ chồng chip ở giữa bàn, vừa với bàn. */
export const potScaleFor = (W, H, u) => Math.min(0.9 * u, (W * 0.42) / VB.w, (H * 0.24) / VB.h);

// Hướng thử đặt cụm chip quanh ghế: ưu tiên hướng về tâm bàn, rồi lệch dần sang hai bên.
const ANGLES = [0, 20, -20, 40, -40, 60, -60, 80, -80, 100, -100, 120, -120, 140, -140, 160, -160, 180];

const hit = (a, b, pad = 3) =>
  Math.abs(a.x - b.x) < (a.w + b.w) / 2 + pad && Math.abs(a.y - b.y) < (a.h + b.h) / 2 + pad;

/**
 * seats: [{ fx, fy, host, count: 'chuỗi số chip', pill: 'chuỗi nhãn tố' | null }]
 * Trả về { ok, pileMul, items: [{ pile: {dx, dy}, pill: {dx, dy} | null }], pot } với dx, dy tính từ tâm ghế.
 */
export function computeLayout({ W, H, u, seats, potText = '0' }) {
  const z = sizes(u);
  const R = Math.min(170, W / 2, H / 2) - RIM;
  const inFelt = (px, py) => {
    const cx = Math.min(Math.max(px, RIM + R), W - RIM - R), cy = Math.min(Math.max(py, RIM + R), H - RIM - R);
    return Math.hypot(px - cx, py - cy) <= R;
  };
  const fits = (g) => [[-1, -1], [1, -1], [-1, 1], [1, 1]].every(([sx, sy]) => inFelt(g.x + (sx * g.w) / 2, g.y + (sy * g.h) / 2));
  const pos = seats.map((s) => ({ x: 7 + (W - 14) * s.fx, y: 7 + (H - 14) * s.fy }));

  let last = null;
  // Màn rất nhỏ thì thu nhỏ dần chồng chip ở ghế, rồi cả chồng chip ở giữa bàn, cho đến khi vừa.
  for (const potMul of [1, 0.8, 0.65, 0.5]) {
    const potScale = potScaleFor(W, H, u) * potMul;
    // Pot gồm chồng chip và hàng số + nút $ (nút $ nằm bên phải số): hai hộp riêng cho sát thực tế.
    const potBox = { x: W / 2, y: H * 0.47 };   // chỉ dùng để chọn hướng
    const chipsH = VB.h * potScale, top = H * 0.47 - (chipsH + 6 + 28 * u) / 2;
    const numW = textW(potText, 20 * u) + 36 * u;
    const fixed = [   // những thứ không được đè: pot, avatar, nhãn số chip, vương miện
      { x: W / 2, y: top + chipsH / 2, w: VB.w * potScale, h: chipsH },
      { x: W / 2 + 19 * u, y: top + chipsH + 6 + 14 * u, w: numW + 38 * u, h: 28 * u },
    ];
    seats.forEach((s, i) => {
      const { x, y } = pos[i];
      fixed.push({ x, y, w: z.A, h: z.A });
      fixed.push({ x, y: y + z.A / 2 - 4 + z.badgeH / 2, w: badgeW(s.count, z), h: z.badgeH });
      if (s.host) fixed.push({ x, y: y - z.A / 2 - z.crownH / 2 + 2, w: z.crownW, h: z.crownH });
    });
    for (const mul of [1, 0.85, 0.7, 0.55, 0.42]) {
      const pileW = VB.w * z.pile * mul, pileH = VB.h * z.pile * mul;
      const placed = [];
      let ok = true;
      const items = seats.map((s, i) => {
        const { x, y } = pos[i];
        const gw = Math.max(pileW, s.pill ? pillW(s.pill, z) : 0), gh = pileH + (s.pill ? z.pillH + 2 : 0);
        const base = Math.atan2(potBox.y - y, potBox.x - x);
        let g = null;
        search: for (let t = z.A / 2 + 6; t <= 160; t += 3) {
          for (const d of ANGLES) {
            const a = base + (d * Math.PI) / 180;
            const c = { x: x + t * Math.cos(a), y: y + t * Math.sin(a), w: gw, h: gh };
            if (fits(c) && !fixed.some((f) => hit(c, f)) && !placed.some((f) => hit(c, f))) { g = c; break search; }
          }
        }
        if (!g) { ok = false; g = { x: x + 50 * Math.cos(base), y: y + 50 * Math.sin(base), w: gw, h: gh }; }
        placed.push(g);
        const pile = { x: g.x, y: g.y + g.h / 2 - pileH / 2 };
        const pill = s.pill ? { x: g.x, y: g.y - g.h / 2 + z.pillH / 2 } : null;
        return { pile: { dx: pile.x - x, dy: pile.y - y }, pill: pill && { dx: pill.x - x, dy: pill.y - y } };
      });
      last = { ok, pileMul: mul, items, potScale, potBox };
      if (ok) return last;
    }
  }
  return last;
}
