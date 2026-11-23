import test from 'node:test';
import assert from 'node:assert/strict';
import { Rooms } from '../server/rooms.js';
import { addChips, placeBet, takePot, derive, undo, publicState, logTail, LIMITS } from '../server/logic.js';
import { LOG_WINDOW, LOG_TAIL_MAX, mergeRows } from '../shared/history.js';
import { addedTxs } from '../client/src/anim.js';

const code = (fn) => { try { fn(); } catch (e) { return e.code; } };
function roomWith(n) {
  const rooms = new Rooms();
  const { room, player: A } = rooms.create('An');
  const { player: B } = rooms.join(room.id, 'Binh');
  addChips(room, A.id, 100000); addChips(room, B.id, 100000);
  while (room.log.length < n) placeBet(room, room.log.length % 2 ? A.id : B.id, 1);
  return { room, A, B };
}
const tx = (id, extra = {}) => ({ id, type: 'bet', playerId: 'x', amount: 1, ...extra });

test('publicState chỉ gửi LOG_WINDOW giao dịch cuối kèm logTotal', () => {
  const { room } = roomWith(LOG_WINDOW + 30);
  const st = publicState(room);
  assert.equal(st.logTotal, LOG_WINDOW + 30);
  assert.equal(st.log.length, LOG_WINDOW);
  assert.deepEqual(st.log.map((t) => t.id), room.log.slice(-LOG_WINDOW).map((t) => t.id));
  // trạng thái (pot, chip) vẫn tính trên TOÀN BỘ log, không phụ thuộc cửa sổ
  assert.equal(st.pot, LOG_WINDOW + 30 - 2);   // log gồm 2 lần nạp chip, còn lại là các lần tố 1 chip
  assert.equal(st.pot, derive(room).pot);
});

test('payload không phình theo độ dài log', () => {
  const small = JSON.stringify(publicState(roomWith(LOG_WINDOW + 10).room)).length;
  const big = JSON.stringify(publicState(roomWith(LOG_WINDOW + 800).room)).length;
  assert.ok(big < small * 1.15, `big=${big} small=${small}`);
});

test('bản ghi hoàn tác kèm ref dù giao dịch bị hoàn tác nằm ngoài cửa sổ', () => {
  const { room, A } = roomWith(5);
  const old = placeBet(room, A.id, 7);
  while (room.log.length < LOG_WINDOW + 40) placeBet(room, A.id, 1);
  undo(room, A.id, old.id);                  // server vẫn cho hoàn tác giao dịch cũ hợp lệ
  const st = publicState(room);
  assert.equal(st.log.some((t) => t.id === old.id), false);        // giao dịch gốc không còn trong cửa sổ
  const u = st.log.at(-1);
  assert.equal(u.type, 'undo');
  assert.deepEqual(u.ref, { type: 'bet', name: 'An', blind: undefined, amount: 7 });
});

test('logTail: lấy N giao dịch cuối, không kèm chip, canUndo theo UNDO_WINDOW', () => {
  const { room, A } = roomWith(LOG_WINDOW + 200);
  const r = logTail(room, A.id, 120);
  assert.equal(r.total, room.log.length);
  assert.equal(r.entries.length, 120);
  assert.deepEqual(r.entries.map((t) => t.id), room.log.slice(-120).map((t) => t.id));
  assert.ok(r.entries.every((t) => t.chips === undefined));
  assert.equal(r.entries.filter((t) => t.canUndo).length <= LIMITS.UNDO_WINDOW, true);
  assert.equal(logTail(room, A.id, 10 ** 6).entries.length, Math.min(LOG_TAIL_MAX, room.log.length));
});

test('logTail từ chối người ngoài phòng và số lượng không hợp lệ', () => {
  const { room, A } = roomWith(5);
  assert.equal(code(() => logTail(room, 'nguoi-la', 10)), 'not_member');
  for (const bad of [0, -3, 1.5, '10', null, undefined, NaN]) assert.equal(code(() => logTail(room, A.id, bad)), 'bad_amount');
});

test('mergeRows: lấy bản cửa sổ khi trùng id, thêm giao dịch mới hơn, không đổi khi chưa tải thêm', () => {
  const win = [tx(3, { cancelled: true }), tx(4), tx(5)];
  assert.equal(mergeRows(win, null), win);
  assert.equal(mergeRows(win, []), win);
  const tail = [tx(1), tx(2), tx(3, { cancelled: false })];            // bản tải hơi cũ: giao dịch 3 chưa bị hoàn tác
  const rows = mergeRows(win, tail);
  assert.deepEqual(rows.map((t) => t.id), [1, 2, 3, 4, 5]);
  assert.equal(rows[2].cancelled, true);                               // lấy cờ mới của cửa sổ
});

test('addedTxs: tìm giao dịch mới theo id, đúng cả khi cửa sổ đã đầy và trượt', () => {
  const full = (from) => ({ id: 'r', log: Array.from({ length: LOG_WINDOW }, (_, i) => tx(from + i)) });
  const a = full(1), b = full(2);                                      // thêm một giao dịch: độ dài log không đổi
  assert.equal(a.log.length, b.log.length);
  assert.deepEqual(addedTxs(a, b).map((t) => t.id), [LOG_WINDOW + 1]);
  assert.deepEqual(addedTxs(b, b), []);
  assert.deepEqual(addedTxs(a, { id: 'khac', log: b.log }), []);        // khác phòng
  assert.deepEqual(addedTxs(null, b), []);
  assert.deepEqual(addedTxs({ id: 'r', log: [] }, { id: 'r', log: [tx(1)] }).map((t) => t.id), [1]);
});

test('lấy pot vẫn chạy đúng khi log dài hơn cửa sổ (không phụ thuộc cửa sổ)', () => {
  const { room, A } = roomWith(LOG_WINDOW + 60);
  const t = takePot(room, A.id, 'all', derive(room).version);
  assert.equal(derive(room).pot, 0);
  assert.equal(publicState(room).log.at(-1).id, t.id);
});
