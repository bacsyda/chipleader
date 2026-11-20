// Hình học chồng chip (đơn vị SVG, không phụ thuộc React) để vẽ và để tính điểm chip bay tới.
export const RX = 26, RY = 19.5, H = 5, MAX_HEIGHT = 10;

// Khung nhìn cố định cho mọi đống chip (pot và chồng ở ghế), để chồng cũ không nhảy chỗ khi có mệnh giá mới.
export const VB = { x: -90, y: -92, w: 180, h: 152 };

// Mỗi mệnh giá một ô cố định, xếp lục giác quanh tâm (hàng sau y=-20, giữa y=0, trước y=20).
export const SLOT = {
  1000: { x: -27, y: -20 }, 500: { x: 27, y: -20 },
  100: { x: -54, y: 0 }, 10: { x: 0, y: 0 }, 50: { x: 54, y: 0 },
  5: { x: -27, y: 20 }, 1: { x: 27, y: 20 },
};

/** Tâm mặt trên của chip thứ `n` (đếm từ 0) trong chồng mệnh giá `v`. Chip mới đặt lên chồng đang có n chip thì dùng n. */
export function chipPoint(v, n) {
  const s = SLOT[v];
  return { x: s.x, y: s.y - Math.min(n, MAX_HEIGHT - 1) * H };
}
