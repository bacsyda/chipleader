import { useEffect, useState } from 'react';
import { call } from './socket.js';
import { fmt } from './util.js';

const digits = (s) => s.replace(/\D/g, '');
const TYPE = { poker: 'Poker', phom: 'Phỏm' };

export default function Home({ onEnter }) {
  const [name, setName] = useState(localStorage.getItem('pokerchip.name') || '');
  const [code, setCode] = useState('');
  const [sb, setSb] = useState('1');
  const [bb, setBb] = useState('2');
  const [list, setList] = useState(null);   // null = đang tải

  // Danh sách phòng đang có trên server, làm mới mỗi vài giây khi đang ở màn hình chính.
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const r = await call('rooms:list');
      if (alive && r.ok) setList(r.rooms);
    };
    load();
    const t = setInterval(load, 4000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const go = async (event, data) => {
    localStorage.setItem('pokerchip.name', name.trim());
    const r = await call(event, { name: name.trim(), ...data });
    if (r.ok) onEnter(r);
  };
  const blindsOk = Number(sb) >= 1 && Number(bb) >= Number(sb);
  const hasName = !!name.trim();
  return (
    <div className="home">
      <h1>Chip Poker</h1>
      <p className="mute">Quản lý chip, pot và sổ nợ khi chơi cùng bạn bè.</p>
      <label>Tên của bạn</label>
      <input value={name} maxLength={8} placeholder="Tối đa 8 ký tự" onChange={(e) => setName(e.target.value)} />

      <label>Tạo phòng mới</label>
      <div className="blinds">
        <input inputMode="numeric" aria-label="Small blind" placeholder="Small blind" value={sb} onChange={(e) => setSb(digits(e.target.value))} />
        <input inputMode="numeric" aria-label="Big blind" placeholder="Big blind" value={bb} onChange={(e) => setBb(digits(e.target.value))} />
      </div>
      <button className="primary" disabled={!hasName || !blindsOk} onClick={() => go('room:create', { type: 'poker', smallBlind: Number(sb), bigBlind: Number(bb) })}>Tạo phòng Poker</button>
      <button className="gold wide" disabled={!hasName} onClick={() => go('room:create', { type: 'phom' })}>Tạo phòng Phỏm</button>

      <div className="or">phòng đang có</div>
      <div className="roomlist" aria-live="polite">
        {list === null && <p className="mute center">Đang tải…</p>}
        {list?.length === 0 && <p className="mute center">Chưa có phòng nào. Hãy tạo phòng đầu tiên.</p>}
        {list?.map((r) => (
          <button key={r.id} className="roomitem" disabled={!hasName || r.full} onClick={() => go('room:join', { roomId: r.id })}>
            <span className={`tag t-${r.type}`}>{TYPE[r.type] ?? r.type}</span>
            <span className="rid">{r.id}</span>
            <span className="rinfo">
              {r.host || '—'}{r.blinds ? ` · ${fmt(r.blinds.small)}/${fmt(r.blinds.big)}` : ''}
            </span>
            <span className="rcount">{r.full ? 'Đầy' : `${r.count}/${r.max}`}</span>
          </button>
        ))}
        {list?.length > 0 && !hasName && <p className="note">Nhập tên của bạn ở trên để bấm vào phòng.</p>}
      </div>

      <div className="or">hoặc vào bằng mã</div>
      <input className="code" inputMode="numeric" value={code} maxLength={5} placeholder="Mã phòng (5 số)" onChange={(e) => setCode(digits(e.target.value))} />
      <button className="secondary" disabled={!hasName || code.length < 5} onClick={() => go('room:join', { roomId: code })}>Vào phòng</button>
    </div>
  );
}
