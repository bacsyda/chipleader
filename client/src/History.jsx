import { useEffect, useState } from 'react';
import { call } from './socket.js';
import { fmt } from './util.js';
import { LOG_STEP, LOG_TAIL_MAX, mergeRows } from '../../shared/history.js';

const label = (t) => ({ add: `${t.name} nạp chip`, bet: `${t.name} → Pot${t.blind === 'small' ? ' · SB' : t.blind === 'big' ? ' · BB' : ''}`, take: `Pot → ${t.name}` })[t.type];
const sign = (type) => (type === 'bet' ? -1 : 1);

export default function History({ room, me, onBack }) {
  const [armed, setArmed] = useState(null); // giao dịch đang chờ bấm lần hai để hoàn tác
  const [want, setWant] = useState(0);       // 0: chỉ cửa sổ mới nhất server gửi kèm; >0: đã xin xem tới chừng này giao dịch
  const [tail, setTail] = useState(null);
  const [busy, setBusy] = useState(false);
  const total = room.logTotal ?? room.log.length;

  // Đã xin xem thêm thì tải lại mỗi khi log dài ra (kể cả khi hoàn tác), để danh sách không có lỗ hổng hay cờ cũ.
  useEffect(() => {
    if (!want) return undefined;
    let live = true;
    setBusy(true);
    call('log:tail', { count: want }).then((r) => {
      if (!live) return;
      if (r.ok) setTail(r.entries);
      setBusy(false);
    });
    return () => { live = false; };
  }, [want, total]);

  const all = mergeRows(room.log, tail);
  const rows = [...all].reverse();
  const capped = all.length >= LOG_TAIL_MAX && total > all.length;
  const more = all.length < total && !capped;
  const isHost = room.hostId === me;
  const time = (t) => new Date(t).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  const undo = (id) => { setArmed(null); call('tx:undo', { txId: id }); };

  return (
    <>
      <header className="bar">
        <button className="round dark" aria-label="Quay lại" onClick={onBack}>
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <h2 className="grow">Lịch sử chip</h2>
      </header>
      {rows.length === 0 && <p className="mute pad">Chưa có giao dịch nào. Nạp chip hoặc tố để bắt đầu.</p>}
      <div className="rows">
        {rows.map((t) => {
          const ref = t.type === 'undo' ? (t.ref ?? room.log.find((x) => x.id === t.refId)) : null;   // t.ref: giao dịch bị hoàn tác có thể nằm ngoài cửa sổ
          const s = ref ? -sign(ref.type) : sign(t.type);
          return (
            <div key={t.id} className={`row${t.cancelled ? ' gone' : ''}${t.type === 'undo' ? ' undo' : ''}`}>
              <span className="time">{time(t.t)}</span>
              <span className="what">{ref ? `↩ Hoàn tác “${label(ref)} ${fmt(ref.amount)}” · ${t.name}` : label(t)}</span>
              <b>{s < 0 ? '−' : '+'}{fmt(t.amount)}</b>
              {isHost && t.canUndo && (armed === t.id
                ? <button className="red small" onClick={() => undo(t.id)}>Chắc chứ?</button>
                : <button className="gold small" onClick={() => setArmed(t.id)}>Back</button>)}
            </div>
          );
        })}
        {more && (
          <div className="row" style={{ justifyContent: 'center' }}>
            <button className="gold small" disabled={busy} onClick={() => setWant(Math.min(LOG_TAIL_MAX, Math.max(want, all.length) + LOG_STEP))}>
              Xem thêm ({total - all.length} giao dịch cũ hơn)
            </button>
          </div>
        )}
        {capped && <p className="mute pad">Chỉ hiện {LOG_TAIL_MAX} giao dịch gần nhất.</p>}
      </div>
    </>
  );
}
