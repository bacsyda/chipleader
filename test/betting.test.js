import test from 'node:test';
import assert from 'node:assert/strict';
import { Rooms } from '../server/rooms.js';
import { addChips, placeBet, publicState } from '../server/logic.js';
import { toCall, raiseAmount, highestBet } from '../shared/betting.js';

function setup() {
  const rooms = new Rooms();
  const { room, player: A } = rooms.create('An');
  const { player: B } = rooms.join(room.id, 'Binh');
  const { player: C } = rooms.join(room.id, 'Cuong');
  for (const p of [A, B, C]) addChips(room, p.id, 1000);
  return { room, A, B, C };
}

test('call = mức cao nhất trừ số mình đã tố (A tố 20, B tố 30 thì A call 10)', () => {
  const { room, A, B, C } = setup();
  placeBet(room, A.id, 20); placeBet(room, B.id, 30);
  const ps = publicState(room).players;
  assert.equal(highestBet(ps), 30);
  assert.equal(toCall(ps, A.id), 10);
  assert.equal(toCall(ps, B.id), 0);        // người tố cao nhất không phải call
  assert.equal(toCall(ps, C.id), 30);       // chưa tố gì thì call đủ 30
});

test('sau khi A call 10 thì A và B bằng nhau, call về 0', () => {
  const { room, A, B } = setup();
  placeBet(room, A.id, 20); placeBet(room, B.id, 30);
  placeBet(room, A.id, toCall(publicState(room).players, A.id));
  const ps = publicState(room).players;
  assert.equal(toCall(ps, A.id), 0);
  assert.equal(toCall(ps, B.id), 0);
});

test('tố nhiều lần: call tính trên tổng cược, không phải lần tố gần nhất', () => {
  const { room, A, B } = setup();
  placeBet(room, A.id, 20); placeBet(room, B.id, 20);   // cùng 20
  placeBet(room, A.id, 15); placeBet(room, A.id, 25);   // A tổng 60
  const ps = publicState(room).players;
  assert.equal(toCall(ps, B.id), 40);                   // chứ không phải 25 (lần tố gần nhất)
});

test('raise ×2 nâng tổng cược lên gấp đôi mức cao nhất', () => {
  const { room, A, B } = setup();
  placeBet(room, A.id, 20); placeBet(room, B.id, 30);
  const ps = publicState(room).players;
  assert.equal(raiseAmount(ps, A.id, 2), 40);           // 20 + 40 = 60 = 2 × 30
  assert.equal(raiseAmount(ps, A.id, 3), 70);           // 20 + 70 = 90 = 3 × 30
});
