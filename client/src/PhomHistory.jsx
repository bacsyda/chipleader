import { useEffect, useState } from 'react';
import { call } from './socket.js';
import { fmt } from './util.js';
import { Icon } from './Table.jsx';
import { LOG_STEP, LOG_TAIL_MAX, mergeRows } from '../../shared/history.js';

export default function PhomHistory({ room, me, onBack }) {
  const [want, setWant] = useState(0);   // 0: chỉ cửa sổ mới nhất server gửi kèm; >0: đã xin xem tới chừng này giao dịch
  const [tail, setTail] = useState(null);
  const [busy, setBusy] = useState(false);
  const total = room.logTotal ?? room.log.length;

  // Đã xin xem thêm thì tải lại mỗi khi có giao dịch mới, để danh sách không có lỗ hổng.
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
  const time = (t) => new Date(t).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  const who = (id, name) => (id === me ? 'Bạn' : name);

  return (
    <>
      <header className="bar">
        <button className="round dark" aria-label="Quay lại" onClick={onBack}><Icon name="back" /></button>
        <h2 className="grow">Lịch sử giao dịch</h2>
      </header>
      {rows.length === 0 && <p className="mute pad">Chưa có giao dịch nào. Bấm Gửi để ghi nợ cho một người.</p>}
      <div className="rows">
        {rows.map((t) => {
          const mine = t.fromId === me, toMe = t.toId === me;   // gửi đi: mình nợ thêm (−); nhận về: họ nợ mình (+)
          return (
            <div key={t.id} className="row">
              <span className="time">{time(t.t)}</span>
              <span className="what">{who(t.fromId, t.from)} → {who(t.toId, t.to)}</span>
              <b className={mine ? 'down' : toMe ? 'up' : ''}>{mine ? '−' : toMe ? '+' : ''}{fmt(t.amount)}</b>
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
