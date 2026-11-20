import test from 'node:test';
import assert from 'node:assert/strict';
import { Rooms } from '../server/rooms.js';
import { addChips, placeBet, takePot, derive, publicState } from '../server/logic.js';
import { snapshot, startView, landChip, chipList } from '../client/src/anim.js';
import { chipPoint, H, MAX_HEIGHT } from '../client/src/geometry.js';

const norm = (v) => JSON.parse(JSON.stringify(v));

function setup() {
  const rooms = new Rooms();
  const { room, player: A } = rooms.create('An');
  const { player: B } = rooms.join(room.id, 'Binh');
  const { player: C } = rooms.join(room.id, 'Cuong');
  for (const p of [A, B, C]) addChips(room, p.id, 1000);
  return { room, ps: [A, B, C] };
}

test('cộng từng chip bay vào view lúc bắt đầu thì ra đúng trạng thái cuối của server', () => {
  let seed = 99;
  const rand = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const { room, ps } = setup();
  let checked = 0;
  for (let i = 0; i < 300; i++) {
    const p = ps[Math.floor(rand() * 3)];
    const s = derive(room);
    const before = publicState(room);
    try {
      if (rand() < 0.6) placeBet(room, p.id, 1 + Math.floor(rand() * Math.min(300, s.chips[p.id] || 1)));
      else takePot(room, p.id, rand() < 0.3 ? 'all' : 1 + Math.floor(rand() * 200), s.version);
    } catch { continue; }
    const after = publicState(room);
    const tx = after.log[after.log.length - 1];
    let view = startView(before, after, tx);
    const where = tx.type === 'bet' ? 'pot' : tx.playerId;
    for (const { d } of chipList(tx.chips)) view = landChip(view, where, d.v);
    assert.deepEqual(norm(view), norm(snapshot(after)));
    checked++;
  }
  assert.ok(checked > 100);
});

test('điểm chip đáp: chip mới nằm ngay trên đỉnh chồng, chồng quá cao thì dừng ở đỉnh', () => {
  assert.equal(chipPoint(10, 0).y, chipPoint(10, 1).y + H);   // chip thứ 2 cao hơn chip thứ 1 đúng một bề dày
  assert.equal(chipPoint(10, 50).y, chipPoint(10, MAX_HEIGHT - 1).y);
  assert.notEqual(chipPoint(10, 0).x, chipPoint(100, 0).x);   // mỗi mệnh giá một ô riêng
});
