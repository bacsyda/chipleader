import test from 'node:test';
import assert from 'node:assert/strict';
import { Rooms } from '../server/rooms.js';
import { derive, maxTake, addChips, placeBet, takePot, undo, publicState, LIMITS } from '../server/logic.js';
import { valueOf } from '../shared/chips.js';

function setup() {
  const rooms = new Rooms();
  const { room, player: A } = rooms.create('An');
  const { player: B } = rooms.join(room.id, 'Binh');
  const { player: C } = rooms.join(room.id, 'Cuong');
  for (const p of [A, B, C]) addChips(room, p.id, 1000);
  return { room, A, B, C };
}
const code = (fn) => { try { fn(); } catch (e) { return e.code; } };

test('tố trừ chip, cộng pot, ghi tổng cược', () => {
  const { room, A } = setup();
  placeBet(room, A.id, 200);
  const s = derive(room);
  assert.equal(s.pot, 200); assert.equal(s.chips[A.id], 800); assert.equal(s.bets[A.id], 200);
  assert.equal(code(() => placeBet(room, A.id, 801)), 'insufficient_chips');
  assert.equal(code(() => placeBet(room, A.id, 0)), 'bad_amount');
});

test('mức lấy tối đa, chia pot, reset khi pot về 0', () => {
  const { room, A, B, C } = setup();
  placeBet(room, A.id, 200); placeBet(room, B.id, 200); placeBet(room, C.id, 40);
  let s = derive(room);
  assert.equal(s.pot, 440);
  assert.equal(maxTake(s, C.id), 120);           // 40 + 40 + 40
  assert.equal(maxTake(s, A.id), 440);           // 200 + 200 + 40, chặn bởi pot
  assert.equal(code(() => takePot(room, C.id, 121, s.version)), 'over_max');
  takePot(room, C.id, 'all', s.version);         // lấy 120
  s = derive(room);
  assert.equal(s.pot, 320); assert.equal(s.chips[C.id], 1080);
  takePot(room, A.id, 'all', s.version);         // lấy nốt 320
  s = derive(room);
  assert.equal(s.pot, 0); assert.deepEqual(s.bets, {}); assert.deepEqual(s.lastBet, {});
});

test('lấy pot với phiên bản cũ bị từ chối', () => {
  const { room, A, B } = setup();
  placeBet(room, A.id, 100);
  const v = derive(room).version;
  placeBet(room, B.id, 100);
  assert.equal(code(() => takePot(room, A.id, 'all', v)), 'pot_changed');
});

test('hoàn tác: chỉ chủ phòng, hoàn lại cả bảng cược đã reset', () => {
  const { room, A, B } = setup();
  const bet = placeBet(room, A.id, 200);
  assert.equal(code(() => undo(room, B.id, bet.id)), 'not_host');
  const take = takePot(room, A.id, 'all', derive(room).version);
  assert.equal(derive(room).pot, 0);
  undo(room, A.id, take.id);                     // như chưa từng lấy
  let s = derive(room);
  assert.equal(s.pot, 200); assert.equal(s.bets[A.id], 200);
  assert.equal(code(() => undo(room, A.id, take.id)), 'already_undone');
  undo(room, A.id, bet.id);
  s = derive(room);
  assert.equal(s.pot, 0); assert.equal(s.chips[A.id], 1000);
  assert.equal(room.log.length, 3 + 1 + 1 + 2);  // log chỉ thêm, không xóa
});

test('không hoàn tác được lần nạp mà người đó đã tố mất', () => {
  const { room, A } = setup();
  const extra = addChips(room, A.id, 500);
  placeBet(room, A.id, 1500);                    // chip còn 0
  assert.equal(code(() => undo(room, A.id, extra.id)), 'undo_blocked');
});

test('nạp chip có trần; publicState không lộ token', () => {
  const { room, A } = setup();
  assert.equal(code(() => addChips(room, A.id, 1_000_001)), 'over_cap');
  assert.equal(JSON.stringify(publicState(room)).includes('token'), false);
});

test('chỉ nạp chip khi pot trống', () => {
  const { room, A, B } = setup();
  placeBet(room, A.id, 100);
  assert.equal(code(() => addChips(room, B.id, 10)), 'pot_not_empty');
  takePot(room, A.id, 'all', derive(room).version);
  addChips(room, B.id, 10);                      // pot đã về 0 nên nạp được
});

test('hoàn tác giao dịch cũ khi hợp lệ; canUndo phản ánh đúng', () => {
  const { room, A, B } = setup();
  const b1 = placeBet(room, A.id, 100);
  placeBet(room, B.id, 50);
  const st = publicState(room);
  assert.equal(st.log.find((t) => t.id === b1.id).canUndo, true);
  assert.equal(st.log[0].canUndo, false);        // bỏ lần nạp đầu của An sẽ làm An âm chip
  undo(room, A.id, b1.id);
  assert.equal(derive(room).pot, 50);
});

const potValue = (room) => valueOf(derive(room).potChips);

test('chip thật: tố 30 thì đúng 3 chip 10 rời chồng người tố sang pot', () => {
  const { room, A, B } = setup();                       // mỗi người nạp 1000 = 500:1 100:4 50:1 10:4 5:1 1:5
  const tx = placeBet(room, A.id, 30);
  let s = derive(room);
  assert.deepEqual(s.moved[tx.id], { 10: 3 });
  assert.deepEqual(s.potChips, { 10: 3 });
  assert.equal(s.stacks[A.id][10], 1);
  placeBet(room, B.id, 20);                             // thêm 2 chip 10 nữa, chồng chip cộng dồn
  s = derive(room);
  assert.deepEqual(s.potChips, { 10: 5 });
  assert.equal(potValue(room), 50);
});

test('lấy pot: chip thật về chồng người lấy, đổi tiền lẻ đúng, hết ván thì pot trống', () => {
  const { room, A, B } = setup();
  placeBet(room, A.id, 100); placeBet(room, B.id, 100);
  const t = takePot(room, A.id, 7, derive(room).version);
  assert.equal(potValue(room), 193);
  assert.equal(valueOf(derive(room).moved[t.id]), 7);
  takePot(room, A.id, 'all', derive(room).version);     // An lấy nốt 193, hết ván
  const s = derive(room);
  assert.equal(s.pot, 0);
  assert.deepEqual(s.potChips, {});
  assert.equal(valueOf(s.stacks[A.id]), s.chips[A.id]);
});

test('publicState có chồng chip của từng người và chip đã đi của từng giao dịch', () => {
  const { room, A } = setup();
  const tx = placeBet(room, A.id, 30);
  const st = publicState(room);
  assert.deepEqual(st.log.find((t) => t.id === tx.id).chips, { 10: 3 });
  assert.equal(valueOf(st.players.find((p) => p.id === A.id).chipMap), 970);
});

test('ngẫu nhiên: chip thật luôn khớp số dư của từng người và pot, kể cả khi hoàn tác', () => {
  let seed = 12345;
  const rand = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const { room, A, B, C } = setup();
  const ps = [A, B, C];
  for (let i = 0; i < 400; i++) {
    const p = ps[Math.floor(rand() * 3)];
    const s = derive(room);
    try {
      const r = rand();
      if (r < 0.5) placeBet(room, p.id, 1 + Math.floor(rand() * Math.min(300, s.chips[p.id] || 1)));
      else if (r < 0.8) takePot(room, p.id, rand() < 0.3 ? 'all' : 1 + Math.floor(rand() * 200), s.version);
      else if (r < 0.9) addChips(room, p.id, 1 + Math.floor(rand() * 500));
      else undo(room, A.id, 1 + Math.floor(rand() * room.log.length));
    } catch (e) { /* lệnh bị từ chối là bình thường */ }
    const now = derive(room);
    assert.equal(now.broken, false);
    assert.equal(potValue(room), now.pot);
    for (const q of ps) assert.equal(valueOf(now.stacks[q.id]), now.chips[q.id]);
  }
});

test('SB/BB mỗi ván chỉ đặt một lần; hết ván (pot trống) thì đặt lại được', () => {
  const { room, A, B, C } = setup();                       // blind mặc định 1/2
  placeBet(room, A.id, undefined, 'small');
  assert.equal(derive(room).pot, 1);
  assert.deepEqual(publicState(room).blindsPosted, { small: true, big: false });
  assert.equal(code(() => placeBet(room, B.id, undefined, 'small')), 'blind_posted');
  placeBet(room, B.id, undefined, 'big');
  assert.equal(derive(room).pot, 3);
  assert.equal(code(() => placeBet(room, C.id, undefined, 'big')), 'blind_posted');
  assert.deepEqual(publicState(room).blindsPosted, { small: true, big: true });
  takePot(room, B.id, 'all', derive(room).version);        // hết ván
  assert.equal(derive(room).pot, 0);
  assert.deepEqual(publicState(room).blindsPosted, { small: false, big: false });
  placeBet(room, C.id, undefined, 'small');                // ván mới: đặt lại được
});

test('SB/BB: số tiền do phòng quy định, thiếu chip thì đặt nốt; hoàn tác trả lại nút', () => {
  const rooms = new Rooms();
  const { room, player: A } = rooms.create('An', 5, 10);
  const { player: B } = rooms.join(room.id, 'Binh');
  addChips(room, A.id, 1000); addChips(room, B.id, 3);
  const sb = placeBet(room, A.id, 99999, 'small');         // client không quyết được số tiền blind
  assert.equal(sb.amount, 5);
  const bb = placeBet(room, B.id, undefined, 'big');       // Bình chỉ có 3 chip
  assert.equal(bb.amount, 3);
  assert.equal(code(() => placeBet(room, A.id, undefined, 'huge')), 'bad_amount');
  undo(room, A.id, sb.id);
  assert.deepEqual(publicState(room).blindsPosted, { small: false, big: true });
  placeBet(room, A.id, undefined, 'small');                // nút SB hiện lại sau hoàn tác
});

test('publicState cập nhật ngay sau mỗi giao dịch mới (cache theo độ dài log không bị cũ)', () => {
  const { room, A } = setup();
  assert.equal(publicState(room).pot, 0);
  placeBet(room, A.id, 100);
  assert.equal(publicState(room).pot, 100);
  assert.equal(publicState(room).players.find((p) => p.id === A.id).chips, 900);
  const b = placeBet(room, A.id, 50);
  undo(room, A.id, b.id);
  const st = publicState(room);
  assert.equal(st.pot, 100);
  assert.equal(st.log.find((t) => t.id === b.id).cancelled, true);
});

test('publicState lặp lại khi log không đổi cho cùng kết quả, kể cả khi trạng thái online đổi', () => {
  const { room, A } = setup();
  placeBet(room, A.id, 100);
  const first = JSON.stringify(publicState(room));
  assert.equal(JSON.stringify(publicState(room)), first);
  room.players[1].online = true;
  const st = publicState(room);
  assert.equal(st.players[1].online, true);
  assert.equal(st.pot, 100);
});

test('canUndo chỉ tính cho các giao dịch gần nhất (UNDO_WINDOW); server vẫn cho hoàn tác giao dịch cũ hợp lệ', () => {
  const { room, A, B } = setup();
  const old = placeBet(room, A.id, 10);
  for (let i = 0; i < LIMITS.UNDO_WINDOW + 5; i++) placeBet(room, B.id, 1);
  const st = publicState(room);
  assert.equal(st.log.find((t) => t.id === old.id).canUndo, false);   // ngoài cửa sổ: không hiện nút
  assert.equal(st.log.at(-1).canUndo, true);                           // giao dịch mới nhất: hiện nút
  undo(room, A.id, old.id);                                            // nhưng tx:undo trực tiếp vẫn hợp lệ
  assert.equal(derive(room).pot, LIMITS.UNDO_WINDOW + 5);
});
