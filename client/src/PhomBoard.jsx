import { useEffect, useMemo, useState } from 'react';
import { call } from './socket.js';
import { fmt, colorOf } from './util.js';
import { Sheet, LeaveSheet } from './Sheets.jsx';
import { Icon } from './Table.jsx';
import CashflowSheet from './CashflowSheet.jsx';
import { tone, label, signed } from './phomFmt.js';
import { owed, net } from '../../shared/debts.js';
import { ago } from '../../shared/history.js';

const digits = (s) => s.replace(/\D/g, '');
const MAX = 1_000_000;


function Row({ player, color, mine, theirNet, last, now, onAsk }) {
  const [v, setV] = useState('1');
  const n = Number(v) || 0;
  const step = (d) => setV(String(Math.min(MAX, Math.max(1, n + d))));
  return (
    <div className="prow">
      <div className="ptop">
        <span className="pdot" style={{ background: color }} />
        <span className="pname">{player.name}</span>
        <span className={`pnet ${tone(theirNet)}`} aria-label={`${player.name} ${theirNet >= 0 ? 'lãi' : 'lỗ'} ${fmt(Math.abs(theirNet))}`}>{signed(theirNet)}</span>
        <span className={`pbal ${tone(mine)}`}>{label(mine)}</span>
      </div>
      {last && (
        <div className="plast">
          {last.mine ? `Bạn chuyển cho ${player.name}` : `${player.name} chuyển cho bạn`} <b>{fmt(last.amount)}</b> · {ago(now - last.t)}
        </div>
      )}
      <div className="pctl">
        <button className="round dark" aria-label="Giảm" disabled={n <= 1} onClick={() => step(-1)}>−</button>
        <input className="pnum" inputMode="numeric" aria-label={`Số gửi cho ${player.name}`} value={v}
          onChange={(e) => setV(String(Math.min(MAX, Number(digits(e.target.value)) || 0)).replace(/^0$/, ''))} />
        <button className="round dark" aria-label="Tăng" disabled={n >= MAX} onClick={() => step(1)}>+</button>
        <button className="gold small" disabled={n < 1} onClick={() => onAsk(player, n, () => setV('1'))}>Gửi</button>
      </div>
    </div>
  );
}

export default function PhomBoard({ room, me, onHistory, onLeave }) {
  const [pending, setPending] = useState(null);   // { player, amount, done }
  const [leaving, setLeaving] = useState(false);
  const [showFlow, setShowFlow] = useState(false);   // popup dòng tiền của bản thân
  const ids = room.players.map((p) => p.id);
  const others = room.players.filter((p) => p.id !== me);
  const total = net(room.debts, me, ids);
  const state = total > 0 ? 'win' : total < 0 ? 'lose' : 'even';
  const mineWith = (id) => 0 - owed(room.debts, me, id);   // 0 - x để không ra -0

  // Đồng hồ cho "x giây trước": đếm theo giờ server (lệch giữa đồng hồ máy và server được bù khi nhận trạng thái mới).
  const skew = useMemo(() => (room.serverTime ?? Date.now()) - Date.now(), [room.serverTime]);
  const [, tick] = useState(0);
  useEffect(() => { const i = setInterval(() => tick((x) => x + 1), 1000); return () => clearInterval(i); }, []);
  const now = Date.now() + skew;
  // Giao dịch gần nhất giữa mình và một người (bên nào gửi sau thì lấy bên đó).
  const lastWith = (id) => {
    const out = room.last?.[me]?.[id], inn = room.last?.[id]?.[me];
    if (!out && !inn) return null;
    return !inn || (out && out.t >= inn.t) ? { ...out, mine: true } : { ...inn, mine: false };
  };

  const confirm = async () => {
    const r = await call('debt:send', { toId: pending.player.id, amount: pending.amount });
    if (r.ok) pending.done();
    setPending(null);
  };

  return (
    <>
      <header className="bar">
        <button className="round dark" aria-label="Rời phòng" onClick={() => setLeaving(true)}><Icon name="back" /></button>
        <div className="code"><small>Phòng Phỏm</small><strong>{room.id}</strong></div>
        <button className="round dark" aria-label="Lịch sử" onClick={onHistory}><Icon name="clock" /></button>
      </header>

      <button className={`psummary ${state}`} aria-label="Xem dòng tiền của bạn" onClick={() => setShowFlow(true)}>
        <small>Bạn đang</small>
        <strong>{state === 'win' ? `Lãi ${fmt(total)}` : state === 'lose' ? `Âm ${fmt(-total)}` : 'Hòa (0)'}</strong>
      </button>

      <div className="plist">
        {others.length === 0 && <p className="mute center">Chưa có ai khác trong phòng. Chia sẻ mã {room.id} cho bạn bè.</p>}
        {others.map((p) => (
          <Row key={p.id} player={p} color={colorOf(room, p.id)}
            mine={mineWith(p.id)} theirNet={net(room.debts, p.id, ids)} last={lastWith(p.id)} now={now}
            onAsk={(player, amount, done) => setPending({ player, amount, done })} />
        ))}
      </div>

      {showFlow && <CashflowSheet room={room} me={me} balanceWith={mineWith} total={total} onClose={() => setShowFlow(false)} />}
      {leaving && <LeaveSheet text="Các khoản nợ của bạn trong phòng này sẽ bị xóa." onYes={onLeave} onClose={() => setLeaving(false)} />}
      {pending && (() => {
        const now = mineWith(pending.player.id);
        const after = now - pending.amount;   // ghi nợ thêm cho họ: mình nợ họ nhiều hơn
        return (
          <Sheet onClose={() => setPending(null)}>
            <h2>Ghi nợ {fmt(pending.amount)} cho {pending.player.name}?</h2>
            <div className={`big ${tone(after)}`}>{label(after)}</div>
            <p className="mute">Hàng {pending.player.name} sau khi gửi (hiện {label(now)}). Gửi nhầm thì người kia gửi ngược lại để cân.</p>
            <button className="primary" onClick={confirm}>Xác nhận gửi</button>
            <button className="secondary" onClick={() => setPending(null)}>Hủy</button>
          </Sheet>
        );
      })()}
    </>
  );
}
