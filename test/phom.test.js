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
  assert.equal('log' in s, false);
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
