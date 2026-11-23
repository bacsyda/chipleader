import test from 'node:test';
import assert from 'node:assert/strict';
import { breakdown, transfer, valueOf } from '../shared/chips.js';

const total = (pot) => breakdown(pot).reduce((s, d) => s + d.count * d.v, 0);

test('tổng giá trị các chồng luôn bằng số tiền', () => {
  for (let pot = 1; pot <= 5000; pot++) assert.equal(total(pot), pot, `pot ${pot}`);
  assert.equal(total(1_000_000), 1_000_000);
});

test('100 không còn là một chip đen duy nhất mà chia nhiều mệnh giá, số chip gần đều', () => {
  const s = breakdown(100);
  assert.deepEqual(s.map((d) => [d.v, d.count]), [[50, 1], [10, 4], [5, 1], [1, 5]]);
});

test('640 có nhiều mệnh giá; số rất lớn tối đa 7 chồng; 0 không vẽ gì', () => {
  assert.ok(breakdown(640).length >= 4);
  assert.equal(breakdown(1_000_000).length, 7);
  assert.deepEqual(breakdown(0), []);
});

test('transfer: tố 30 từ chồng có chip 10 thì đi đúng 3 chip 10', () => {
  const from = { 100: 2, 50: 1, 10: 4, 5: 1, 1: 5 }, to = {};
  assert.deepEqual(transfer(from, to, 30), { 10: 3 });
  assert.deepEqual(from, { 100: 2, 50: 1, 10: 1, 5: 1, 1: 5 });
  assert.deepEqual(to, { 10: 3 });
});

test('transfer: thiếu chip nhỏ thì đổi tiền lẻ, thối trả lại bên đưa', () => {
  const from = { 100: 1 }, to = {};
  const moved = transfer(from, to, 30);
  assert.deepEqual(moved, { 10: 3 });
  assert.equal(valueOf(from), 70);
  assert.equal(valueOf(to), 30);
  assert.equal(from[100], undefined);
});

test('transfer: không đủ thì trả về null và không đổi gì', () => {
  const from = { 5: 1 }, to = {};
  assert.equal(transfer(from, to, 6), null);
  assert.equal(transfer(from, to, 0), null);
  assert.deepEqual(from, { 5: 1 });
  assert.deepEqual(to, {});
});

test('transfer: ngẫu nhiên, bảo toàn giá trị và chip đi đúng bằng số tiền', () => {
  let seed = 7;
  const rand = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  for (let i = 0; i < 2000; i++) {
    const from = {};
    for (const v of [1000, 500, 100, 50, 10, 5, 1]) if (rand() < 0.6) from[v] = Math.floor(rand() * 6);
    const have = valueOf(from);
    if (!have) continue;
    const to = { 10: 2 }, toBefore = valueOf(to);
    const amount = 1 + Math.floor(rand() * have);
    const moved = transfer(from, to, amount);
    assert.equal(valueOf(moved), amount);
    assert.equal(valueOf(from), have - amount);
    assert.equal(valueOf(to), toBefore + amount);
    for (const k of Object.values(from)) assert.ok(k > 0);
  }
});
