import { randomUUID, randomInt } from 'node:crypto';
import { LIMITS, RuleError } from './logic.js';
import { forget } from './phom.js';

export const TYPES = ['poker', 'phom'];

function cleanName(name) {
  const n = String(name ?? '').trim().replace(/\s+/g, ' ');
  if (!n || [...n].length > LIMITS.MAX_NAME) throw new RuleError('bad_name');
  return n;
}

function cleanBlinds(small = 1, big = 2) {
  const ok = (n) => Number.isSafeInteger(n) && n >= 1 && n <= LIMITS.MAX_ADD;
  if (!ok(small) || !ok(big) || big < small) throw new RuleError('bad_blinds');
  return { small, big };
}

function addPlayer(room, name) {
  const player = { id: randomUUID().slice(0, 8), token: randomUUID(), name, online: false, socketId: null };
  room.players.push(player);
  return player;
}

export class Rooms {
  constructor() { this.rooms = new Map(); }

  #newId() {
    let id;
    do { id = String(randomInt(10000, 100000)); } while (this.rooms.has(id)); // mã phòng 5 chữ số
    return id;
  }

  get(id) {
    const room = this.rooms.get(String(id ?? '').trim());
    if (!room) throw new RuleError('room_not_found');
    return room;
  }

  create(name, small, big, type = 'poker') {
    if (!TYPES.includes(type)) throw new RuleError('bad_type');
    const clean = cleanName(name);
    const blinds = type === 'poker' ? cleanBlinds(small, big) : null;   // Phỏm không có blind
    const room = { id: this.#newId(), type, hostId: null, blinds, players: [], log: [], debts: {}, seq: 0, emptySince: null, createdAt: Date.now() };
    this.rooms.set(room.id, room);
    const player = addPlayer(room, clean);
    room.hostId = player.id;
    return { room, player };
  }

  join(roomId, name) {
    const room = this.get(roomId);
    const clean = cleanName(name);
    if (room.players.length >= LIMITS.MAX_PLAYERS) throw new RuleError('room_full');
    if (room.players.some((p) => p.name.toLowerCase() === clean.toLowerCase())) throw new RuleError('name_taken');
    return { room, player: addPlayer(room, clean) };
  }

  rejoin(roomId, token) {
    const room = this.get(roomId);
    const player = room.players.find((p) => p.token === token);
    if (!player) throw new RuleError('bad_token');
    return { room, player };
  }

  /** Rời hẳn. Chủ phòng rời thì chuyển quyền cho người vào sớm nhất đang online. */
  leave(room, playerId) {
    room.players = room.players.filter((p) => p.id !== playerId);
    if (room.type === 'phom') forget(room, playerId);
    if (room.hostId === playerId) {
      room.hostId = (room.players.find((p) => p.online) ?? room.players[0])?.id ?? null;
    }
    if (!room.players.length) this.rooms.delete(room.id);
  }

  /** Danh sách phòng để hiện ở màn hình chính. */
  list() {
    return [...this.rooms.values()].map((r) => ({
      id: r.id, type: r.type,
      host: r.players.find((p) => p.id === r.hostId)?.name ?? '',
      count: r.players.length, max: LIMITS.MAX_PLAYERS, full: r.players.length >= LIMITS.MAX_PLAYERS,
      ...(r.type === 'poker' ? { blinds: r.blinds } : {}),
    }));
  }

  setOnline(room, player, socketId) {
    player.online = true; player.socketId = socketId; room.emptySince = null;
  }

  setOffline(room, player) {
    player.online = false; player.socketId = null;
    if (!room.players.some((p) => p.online)) room.emptySince = Date.now();
  }

  /** Xóa phòng không ai kết nối quá maxIdleMs. */
  sweep(maxIdleMs, now = Date.now()) {
    for (const [id, r] of this.rooms) if (r.emptySince && now - r.emptySince > maxIdleMs) this.rooms.delete(id);
  }
}
