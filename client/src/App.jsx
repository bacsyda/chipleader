import { useCallback, useEffect, useState } from 'react';
import { socket, call, ERR } from './socket.js';
import Home from './Home.jsx';
import Table from './Table.jsx';
import History from './History.jsx';
import PhomBoard from './PhomBoard.jsx';
import { play } from './sound.js';
import { addedTxs } from './anim.js';

const KEY = 'pokerchip.session';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } };

export default function App() {
  const [room, setRoom] = useState(null);
  const [me, setMe] = useState(null);
  const [view, setView] = useState('table');
  const [toast, setToast] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    // Mỗi lần (nối lại) kết nối, xin vào lại đúng người bằng token đã lưu.
    const rejoin = async () => {
      const s = load();
      if (s) {
        const r = await call('room:rejoin', { roomId: s.roomId, token: s.token });
        if (r.ok) setMe(s.playerId);
        else { localStorage.removeItem(KEY); setRoom(null); setMe(null); }
      }
      setReady(true);
    };
    const onErr = ({ code }) => { setToast(ERR[code] || 'Có lỗi xảy ra'); play('error'); };
    // Phát tiếng theo giao dịch mới nhất, để mọi người trong phòng cùng nghe (kể cả người thao tác).
    let seen = null;   // trạng thái trước đó, để biết giao dịch nào mới (so theo id, log chỉ là cửa sổ cuối)
    const onState = (s) => {
      const added = s.type === 'phom' ? [] : addedTxs(seen, s);   // phòng Phỏm không có log giao dịch để phát tiếng
      if (added.length && added.length <= 3) {
        const type = added[added.length - 1].type;
        play(type, type === 'bet' ? 0.4 : 0);   // tiếng chip chạm pot khớp lúc chip bay tới
      }
      seen = s;
      setRoom(s);
    };
    socket.on('room:state', onState);
    socket.on('room:error', onErr);
    socket.on('connect', rejoin);
    if (socket.connected) rejoin();
    return () => { socket.off('room:state', onState); socket.off('room:error', onErr); socket.off('connect', rejoin); };
  }, []);

  useEffect(() => {   // tiếng bấm cho mọi nút đang bật
    const h = (e) => { const b = e.target.closest?.('button'); if (b && !b.disabled) play('click'); };
    document.addEventListener('click', h, true);
    return () => document.removeEventListener('click', h, true);
  }, []);

  const enter = useCallback((r) => {
    localStorage.setItem(KEY, JSON.stringify({ roomId: r.roomId, token: r.token, playerId: r.playerId }));
    setMe(r.playerId); setView('table');
  }, []);

  const leave = async () => {
    await call('room:leave');
    localStorage.removeItem(KEY); setRoom(null); setMe(null);
  };

  if (!ready) return null;
  const inRoom = room && me;
  return (
    <div className="app">
      {!inRoom && <Home onEnter={enter} />}
      {inRoom && room.type === 'phom' && <PhomBoard room={room} me={me} onLeave={leave} />}
      {inRoom && room.type !== 'phom' && view === 'table' && <Table room={room} me={me} onHistory={() => setView('history')} onLeave={leave} />}
      {inRoom && room.type !== 'phom' && view === 'history' && <History room={room} me={me} onBack={() => setView('table')} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
