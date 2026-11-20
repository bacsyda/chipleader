import test from 'node:test';
import assert from 'node:assert/strict';
import { Rooms } from '../server/rooms.js';

const code = (fn) => { try { fn(); } catch (e) { return e.code; } };

test('tạo, vào, trùng tên, tên quá dài, phòng không tồn tại', () => {
  const rooms = new Rooms();
  const { room } = rooms.create('An');
  assert.match(room.id, /^\d{5}$/);
  rooms.join(room.id.toLowerCase(), 'Binh');
  assert.equal(code(() => rooms.join(room.id, 'binh')), 'name_taken');
  assert.equal(code(() => rooms.join(room.id, 'Nguyenvanan')), 'bad_name');
  assert.equal(code(() => rooms.join('ZZZZZ', 'X')), 'room_not_found');
});

test('đủ 8 người thì từ chối', () => {
  const rooms = new Rooms();
  const { room } = rooms.create('P0');
  for (let i = 1; i < 8; i++) rooms.join(room.id, `P${i}`);
  assert.equal(code(() => rooms.join(room.id, 'P8')), 'room_full');
});

test('rejoin bằng token và chuyển quyền chủ phòng', () => {
  const rooms = new Rooms();
  const { room, player: A } = rooms.create('An');
  const { player: B } = rooms.join(room.id, 'Binh');
  assert.equal(rooms.rejoin(room.id, B.token).player.id, B.id);
  assert.equal(code(() => rooms.rejoin(room.id, 'sai')), 'bad_token');
  rooms.setOnline(room, B, 's1');
  rooms.leave(room, A.id);
  assert.equal(room.hostId, B.id);
  rooms.leave(room, B.id);
  assert.equal(rooms.rooms.size, 0);             // hết người thì xóa phòng
});

test('small/big blind: mặc định, tùy chỉnh, sai thì từ chối', () => {
  const rooms = new Rooms();
  assert.deepEqual(rooms.create('An').room.blinds, { small: 1, big: 2 });
  assert.deepEqual(rooms.create('An', 5, 10).room.blinds, { small: 5, big: 10 });
  assert.equal(code(() => rooms.create('An', 10, 5)), 'bad_blinds');
  assert.equal(code(() => rooms.create('An', 0, 5)), 'bad_blinds');
});
