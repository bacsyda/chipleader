import test from 'node:test';
import assert from 'node:assert/strict';
import { computeLayout, seatFrac, sizes, scaleFor, badgeW, pillW } from '../client/src/layout.js';
import { VB } from '../client/src/geometry.js';

// Cỡ khung bàn (px) gần với các điện thoại thật: nhỏ (320x568), 360x640, 375x667, 390x844, 412x915.
const SCREENS = [[320, 568], [360, 640], [375, 667], [390, 844], [412, 915]];
// Phần bàn còn lại sau thanh trên, hàng nút, ô nhập và lề (khớp styles.css: màn thấp dưới 720px dùng cỡ nhỏ).
const tableOf = (vw, vh) => ({ W: Math.min(vw, 430) - 28 - 52, H: vh - (vh < 720 ? 179 : 208) - 76 });

test('ở mọi cỡ màn hình và 2–8 người, chip/nhãn của ai cũng không bị che hay đè', () => {
  for (const [vw, vh] of SCREENS) {
    const u = scaleFor(vw, vh), { W, H } = tableOf(vw, vh);
    for (let n = 2; n <= 8; n++) {
      for (const host of [0, n - 1]) {
        const seats = Array.from({ length: n }, (_, k) => ({
          ...seatFrac(k, n), host: k === host, count: '999.999', pill: k % 2 ? '999.999' : '1.000',
        }));
        const lay = computeLayout({ W, H, u, seats, potText: '999.999' });
        assert.ok(lay.ok, `${vw}x${vh} (bàn ${W}x${Math.round(H)}) ${n} người: không xếp được`);
      }
    }
  }
});

test('avatar không to quá, chữ nhãn đủ đọc', () => {
  for (const [vw, vh] of SCREENS) {
    const z = sizes(scaleFor(vw, vh));
    assert.ok(z.A >= 35 && z.A <= 44, `avatar ${z.A}`);
    assert.ok(z.em >= 10.5, `chữ ${z.em}`);
  }
  const z = sizes(1);
  assert.ok(badgeW('999.999', z) > badgeW('0', z) && pillW('999.999', z) > pillW('1', z));
  assert.ok(VB.w > 0);
});
