import test from 'node:test';
import assert from 'node:assert/strict';
import { Rooms } from '../server/rooms.js';
import { sendDebt } from '../server/phom.js';
import { stateOf } from '../server/state.js';
import { owed, net } from '../shared/debts.js';
import { LIMITS } from '../server/logic.js';

const code = (fn) => { try { fn(); } catch (e) { return e.code; } };

function setup() {
  const rooms = new Rooms();
  const { room, player: A } = rooms.create('An', undefined, undefined, 'phom');
  const { player: B } = rooms.join(room.id, 'Binh');
  const { player: C } = rooms.join(room.id, 'Cuong');
  return { rooms, room, A, B, C };
}

test('tạo phòng Phỏm: đúng loại, không blind; loại lạ bị từ chối', () => {
  const rooms = new Rooms();
  const { room } = rooms.create('An', undefined, undefined, 'phom');
  assert.equal(room.type, 'phom'); assert.equal(room.blinds, null);
  assert.equal(rooms.create('An').room.type, 'poker');
  assert.equal(code(() => rooms.create('An', 1, 2, 'xyz')), 'bad_type');
});

test('Gửi ghi nợ thêm cho người nhận, số ở hàng người đó tăng', () => {
  const { room, A, B } = setup();
  sendDebt(room, A.id, B.id, 50);
  assert.equal(owed(room.debts, A.id, B.id), 50);    // trên máy A: nợ B 50
  assert.equal(owed(room.debts, B.id, A.id), -50);   // trên máy B: A nợ B, hàng A là -50
  sendDebt(room, A.id, B.id, 20);
  assert.equal(owed(room.debts, A.id, B.id), 70);
});

test('trả nợ bằng cách gửi ngược lại, về 0', () => {
  const { room, A, B } = setup();
  sendDebt(room, A.id, B.id, 50);
  sendDebt(room, B.id, A.id, 50);
  assert.equal(owed(room.debts, A.id, B.id), 0);
  assert.equal(owed(room.debts, B.id, A.id), 0);
});

test('tổng của mình: dương là lãi, âm là đang nợ, bỏ qua chính mình', () => {
  const { room, A, B, C } = setup();
  const ids = room.players.map((p) => p.id);
  assert.equal(net(room.debts, A.id, ids), 0);
  sendDebt(room, A.id, B.id, 50);    // A nợ B 50
  sendDebt(room, C.id, A.id, 30);    // C nợ A 30
  assert.equal(net(room.debts, A.id, ids), -20);
  assert.equal(net(room.debts, B.id, ids), 50);
  assert.equal(net(room.debts, C.id, ids), -30);
  assert.equal(net(room.debts, A.id, ids) + net(room.debts, B.id, ids) + net(room.debts, C.id, ids), 0);   // tổng cả phòng luôn 0
});

test('số gửi không hợp lệ bị từ chối: 0, âm, lẻ, quá hạn mức', () => {
  const { room, A, B } = setup();
  for (const bad of [0, -5, 1.5, NaN, '10', null]) assert.equal(code(() => sendDebt(room, A.id, B.id, bad)), 'bad_amount');
  assert.equal(code(() => sendDebt(room, A.id, B.id, LIMITS.MAX_ADD + 1)), 'over_cap');
  sendDebt(room, A.id, B.id, LIMITS.MAX_ADD);
  assert.equal(owed(room.debts, A.id, B.id), LIMITS.MAX_ADD);
});

test('gửi cho chính mình, người ngoài phòng, hoặc người gửi không ở trong phòng', () => {
  const { room, A } = setup();
  assert.equal(code(() => sendDebt(room, A.id, A.id, 5)), 'bad_target');
  assert.equal(code(() => sendDebt(room, A.id, 'khong-co', 5)), 'bad_target');
  assert.equal(code(() => sendDebt(room, 'la', A.id, 5)), 'not_member');
});

test('phòng Poker không dùng được Gửi nợ', () => {
  const rooms = new Rooms();
  const { room, player: A } = rooms.create('An');
  const { player: B } = rooms.join(room.id, 'Binh');
  assert.equal(code(() => sendDebt(room, A.id, B.id, 5)), 'wrong_type');
});

test('trạng thái gửi cho client rẽ nhánh theo loại phòng', () => {
  const { room, A, B } = setup();
  sendDebt(room, A.id, B.id, 40);
  const s = stateOf(room);
  assert.equal(s.type, 'phom');
  assert.deepEqual(s.players.map((p) => p.name), ['An', 'Binh', 'Cuong']);
  assert.equal(s.debts[A.id][B.id], 40);
  assert.deepEqual(s.log.map((e) => e.amount), [40]);   // phòng Phỏm có log gửi nợ, không có chip/pot của Poker
  assert.equal('pot' in s, false);
  const rooms = new Rooms();
  assert.equal(stateOf(rooms.create('An').room).type, 'poker');
});

test('người rời phòng: các khoản nợ liên quan bị xóa', () => {
  const { rooms, room, A, B, C } = setup();
  sendDebt(room, A.id, B.id, 50); sendDebt(room, B.id, C.id, 10); sendDebt(room, C.id, A.id, 5);
  rooms.leave(room, B.id);
  const ids = room.players.map((p) => p.id);
  assert.equal(owed(room.debts, A.id, B.id), 0);
  assert.equal(net(room.debts, A.id, ids), 5);   // chỉ còn khoản C nợ A 5
});

test('danh sách phòng: loại, chủ phòng, số người, đầy, blind chỉ có ở Poker', () => {
  const rooms = new Rooms();
  const poker = rooms.create('An', 5, 10).room;
  const phom = rooms.create('Binh', undefined, undefined, 'phom').room;
  for (let i = 1; i < 8; i++) rooms.join(phom.id, `P${i}`);
  const byId = Object.fromEntries(rooms.list().map((r) => [r.id, r]));
  assert.deepEqual(byId[poker.id], { id: poker.id, type: 'poker', host: 'An', count: 1, max: 8, full: false, blinds: { small: 5, big: 10 } });
  assert.deepEqual(byId[phom.id], { id: phom.id, type: 'phom', host: 'Binh', count: 8, max: 8, full: true });
  rooms.leave(poker, poker.hostId);
  assert.equal(rooms.list().length, 1);   // phòng bỏ trống đã bị xóa khỏi danh sách
});

import { phomTail, phomState } from '../server/phom.js';
import { ago, LOG_WINDOW, LOG_TAIL_MAX } from '../shared/history.js';

test('mỗi lần Gửi ghi vào lịch sử (tên, số, thời gian) và giao dịch gần nhất của cặp', () => {
  const { room, A, B } = setup();
  const before = Date.now();
  sendDebt(room, A.id, B.id, 50);
  sendDebt(room, B.id, A.id, 20);
  assert.equal(room.log.length, 2);
  assert.deepEqual(room.log.map((e) => [e.from, e.to, e.amount]), [['An', 'Binh', 50], ['Binh', 'An', 20]]);
  assert.ok(room.log[0].t >= before && room.log[1].id > room.log[0].id);
  assert.equal(room.last[A.id][B.id].amount, 50);
  assert.equal(room.last[B.id][A.id].amount, 20);
  const s = phomState(room);
  assert.equal(s.logTotal, 2); assert.ok(s.serverTime >= before);
});

test('lịch sử: cửa sổ LOG_WINDOW trong trạng thái, xem thêm bằng phomTail, giới hạn LOG_TAIL_MAX', () => {
  const { room, A, B } = setup();
  for (let i = 0; i < LOG_WINDOW + 30; i++) sendDebt(room, A.id, B.id, 1);
  const s = phomState(room);
  assert.equal(s.log.length, LOG_WINDOW); assert.equal(s.logTotal, LOG_WINDOW + 30);
  const t = phomTail(room, B.id, 70);
  assert.equal(t.entries.length, 70); assert.equal(t.total, LOG_WINDOW + 30);
  assert.ok(t.entries[0].id < t.entries[69].id);   // cũ nhất trước
  assert.equal(code(() => phomTail(room, B.id, 0)), 'bad_amount');
  assert.equal(code(() => phomTail(room, 'la', 5)), 'not_member');
  for (let i = 0; i < LOG_TAIL_MAX; i++) sendDebt(room, A.id, B.id, 1);
  assert.equal(room.log.length, LOG_TAIL_MAX);
  assert.equal(owed(room.debts, A.id, B.id), LOG_WINDOW + 30 + LOG_TAIL_MAX);   // sổ nợ không mất khi log bị cắt
});

test('người rời phòng: xóa cả giao dịch gần nhất liên quan', () => {
  const { rooms, room, A, B, C } = setup();
  sendDebt(room, A.id, B.id, 5); sendDebt(room, C.id, B.id, 7); sendDebt(room, B.id, A.id, 3);
  rooms.leave(room, B.id);
  assert.equal(JSON.stringify(room.last).includes(B.id), false);
});

test('ago: vừa xong, giây, phút, giờ, ngày; lệch đồng hồ âm vẫn là vừa xong', () => {
  assert.equal(ago(-3000), 'vừa xong'); assert.equal(ago(0), 'vừa xong'); assert.equal(ago(4999), 'vừa xong');
  assert.equal(ago(10_000), '10 giây trước'); assert.equal(ago(59_999), '59 giây trước');
  assert.equal(ago(60_000), '1 phút trước'); assert.equal(ago(3_599_000), '59 phút trước');
  assert.equal(ago(3_600_000), '1 giờ trước'); assert.equal(ago(86_400_000), '1 ngày trước');
});

import { flow } from '../shared/cashflow.js';

test('dòng tiền: nhận dương, gửi âm, số dư tích lũy neo vào số hiện tại', () => {
  const { room, A, B, C } = setup();
  sendDebt(room, A.id, B.id, 50);    // An gửi Binh 50
  sendDebt(room, B.id, A.id, 120);   // Binh gửi An 120
  sendDebt(room, A.id, C.id, 30);
  sendDebt(room, B.id, A.id, 40);
  const members = new Set(room.players.map((p) => p.id));
  const ids = [...members];
  const cur = net(room.debts, A.id, ids);                       // −50 + 120 − 30 + 40 = 80
  const all = flow(room.log, A.id, undefined, members, cur);
  assert.deepEqual(all.pts.map((p) => p.a), [-50, 120, -30, 40]);
  assert.deepEqual(all.pts.map((p) => p.cum), [-50, 70, 40, 80]);
  assert.equal(all.start, 0); assert.equal(all.received, 160); assert.equal(all.sent, 80);
  const withB = flow(room.log, A.id, B.id, members, 0 - owed(room.debts, A.id, B.id));   // chỉ với Binh
  assert.deepEqual(withB.pts.map((p) => p.a), [-50, 120, 40]);
  assert.equal(withB.pts.at(-1).cum, 110);
});

test('dòng tiền: cửa sổ log bị cắt thì điểm cuối vẫn khớp số hiện tại; người đã rời bị bỏ qua', () => {
  const { rooms, room, A, B, C } = setup();
  for (let i = 0; i < LOG_WINDOW + 10; i++) sendDebt(room, B.id, A.id, 2);   // An nhận 2 × 60 = 120
  const cut = phomState(room).log;                                           // chỉ 50 giao dịch cuối
  const members = new Set(room.players.map((p) => p.id));
  const f = flow(cut, A.id, undefined, members, net(room.debts, A.id, [...members]));
  assert.equal(f.pts.length, LOG_WINDOW);
  assert.equal(f.start, 20);                       // phần của 10 giao dịch cũ bị cắt
  assert.equal(f.pts.at(-1).cum, 120);             // khớp số hiện tại
  rooms.leave(room, B.id);
  const m2 = new Set(room.players.map((p) => p.id));
  assert.equal(flow(room.log, A.id, undefined, m2, 0).pts.length, 0);   // Binh đã rời: không còn trong biểu đồ
  sendDebt(room, C.id, A.id, 5);
  assert.deepEqual(flow(room.log, A.id, undefined, m2, 5).pts.map((p) => p.a), [5]);
});
