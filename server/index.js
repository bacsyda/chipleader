import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { Server } from 'socket.io';
import { RuleError, addChips, placeBet, takePot, undo, logTail } from './logic.js';
import { sendDebt } from './phom.js';
import { stateOf } from './state.js';
import { Rooms } from './rooms.js';

const PORT = process.env.PORT || 3000;
const DIST = path.resolve('client/dist');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.woff2': 'font/woff2',
};

function serveStatic(req, res) {
  let url;
  try { url = decodeURIComponent((req.url || '/').split('?')[0]); } catch { res.writeHead(400); return res.end(); }
  let file = path.join(DIST, url);
  if (!file.startsWith(DIST + path.sep) && file !== DIST) { res.writeHead(403); return res.end(); }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
  if (!fs.existsSync(file)) {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    return res.end('Poker chip server đang chạy. Chưa có client/dist.');
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}

const rooms = new Rooms();
const server = http.createServer(serveStatic);
// Client đặt ở nơi khác (vd Vercel) thì cần cho phép origin đó: CLIENT_ORIGIN=https://ten-ban.vercel.app (nhiều nơi cách nhau dấu phẩy).
const ORIGINS = (process.env.CLIENT_ORIGIN || '').split(',').map((o) => o.trim()).filter(Boolean);
const io = new Server(server, ORIGINS.length ? { cors: { origin: ORIGINS } } : {});

io.on('connection', (socket) => {
  let ctx = null; // { roomId, playerId }

  const broadcast = (room) => io.to(room.id).emit('room:state', stateOf(room));
  const bind = (room, player) => {
    ctx = { roomId: room.id, playerId: player.id };
    rooms.setOnline(room, player, socket.id);
    socket.join(room.id);
  };
  const current = (type) => {   // type: chỉ nhận phòng đúng loại (poker | phom); bỏ trống = loại nào cũng được
    const room = ctx && rooms.rooms.get(ctx.roomId);
    if (!room) throw new RuleError('not_in_room');
    if (type && room.type !== type) throw new RuleError('wrong_type');
    return room;
  };
  const on = (event, fn) => socket.on(event, (data = {}, ack = () => {}) => {
    try {
      ack({ ok: true, ...(fn(data) ?? {}) });
    } catch (e) {
      if (e instanceof RuleError) {
        ack({ ok: false, error: e.code });
        socket.emit('room:error', { code: e.code });
      } else {
        console.error(e);
        ack({ ok: false, error: 'server_error' });
      }
    }
  });
  const session = ({ room, player }) => {
    bind(room, player); broadcast(room);
    return { roomId: room.id, playerId: player.id, token: player.token };
  };

  on('room:create', ({ name, smallBlind, bigBlind, type }) => session(rooms.create(name, smallBlind, bigBlind, type)));
  on('rooms:list', () => ({ rooms: rooms.list() }));   // chỉ đọc, không cần đã vào phòng
  on('room:join', ({ roomId, name }) => session(rooms.join(roomId, name)));
  on('room:rejoin', ({ roomId, token }) => session(rooms.rejoin(roomId, token)));
  on('room:leave', () => {
    const room = current();
    rooms.leave(room, ctx.playerId);
    socket.leave(room.id); ctx = null;
    if (rooms.rooms.has(room.id)) broadcast(room);
  });

  on('chips:add', ({ amount }) => { const r = current('poker'); addChips(r, ctx.playerId, amount); broadcast(r); });
  on('bet:place', ({ amount, blind }) => { const r = current('poker'); placeBet(r, ctx.playerId, amount, blind); broadcast(r); });
  on('pot:take', ({ amount, version }) => { const r = current('poker'); takePot(r, ctx.playerId, amount, version); broadcast(r); });
  on('log:tail', ({ count }) => logTail(current('poker'), ctx.playerId, count));   // chỉ đọc, không broadcast
  on('debt:send', ({ toId, amount }) => { const r = current('phom'); sendDebt(r, ctx.playerId, toId, amount); broadcast(r); });
  on('tx:undo', ({ txId }) => { const r = current('poker'); undo(r, ctx.playerId, txId); broadcast(r); });

  socket.on('disconnect', () => {
    const room = ctx && rooms.rooms.get(ctx.roomId);
    const player = room?.players.find((p) => p.id === ctx.playerId);
    if (!player || player.socketId !== socket.id) return; // đã nối lại bằng socket khác
    rooms.setOffline(room, player);
    broadcast(room);
  });
});

setInterval(() => rooms.sweep(6 * 3600 * 1000), 10 * 60 * 1000).unref();
server.listen(PORT, () => console.log(`Poker chip server: http://localhost:${PORT}`));
