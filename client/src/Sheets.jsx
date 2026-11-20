import { useState } from 'react';
import { call } from './socket.js';
import { fmt } from './util.js';

export function Sheet({ onClose, children }) {
  return (
    <div className="backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="grab" />
        {children}
      </div>
    </div>
  );
}

const digits = (s) => s.replace(/\D/g, '');

export function AddSheet({ onClose, blocked }) {
  const [v, setV] = useState('100');
  const n = Number(v) || 0;
  const add = async () => { const r = await call('chips:add', { amount: n }); if (r.ok) onClose(); };
  if (blocked) {
    return (
      <Sheet onClose={onClose}>
        <h2>Chưa nạp được chip</h2>
        <p className="mute">Chỉ nạp chip khi pot trống, tức là sau khi hết ván. Hãy lấy hết pot trước.</p>
        <button className="secondary" onClick={onClose}>Đã hiểu</button>
      </Sheet>
    );
  }
  return (
    <Sheet onClose={onClose}>
      <h2>Nạp chip cho bạn</h2>
      <div className="quick">
        {[100, 500, 1000, 5000].map((x) => <button key={x} onClick={() => setV(String(x))}>{fmt(x)}</button>)}
      </div>
      <input inputMode="numeric" value={v} onChange={(e) => setV(digits(e.target.value))} />
      <button className="primary" disabled={n <= 0} onClick={add}>Nạp {fmt(n)} chip</button>
    </Sheet>
  );
}

// Lấy pot. Số lớn (từ nửa pot trở lên) phải qua một bước xác nhận.
export function TakeSheet({ me, pot, version, onClose }) {
  const max = me.maxTake;
  const [v, setV] = useState(String(Math.min(Math.floor(pot / 2), max)));
  const [pending, setPending] = useState(null);
  const n = Number(v) || 0;
  const send = async (amount) => {
    const r = await call('pot:take', { amount, version });
    if (r.ok || r.error === 'pot_changed') onClose();
  };
  const ask = (amount) => (amount * 2 >= pot ? setPending(amount) : send(amount));
  const set = (x) => setV(String(Math.min(x, max)));

  if (pending !== null) {
    return (
      <Sheet onClose={onClose}>
        <h2>Lấy {fmt(pending)} chip?</h2>
        <p className="mute">Pot sẽ còn {fmt(pot - pending)} chip.</p>
        <button className="primary" onClick={() => send(pending)}>Xác nhận lấy {fmt(pending)}</button>
        <button className="secondary" onClick={() => setPending(null)}>Quay lại</button>
      </Sheet>
    );
  }
  return (
    <Sheet onClose={onClose}>
      <p className="mute">Pot hiện có</p>
      <div className="big">{fmt(pot)} chip</div>
      {max === 0 ? (
        <p className="mute">Bạn chưa tố chip nào trong ván này nên chưa thể lấy pot.</p>
      ) : (
        <>
          <button className="primary" onClick={() => ask(max)}>
            {max === pot ? `Lấy hết ${fmt(pot)}` : `Lấy tối đa ${fmt(max)}`}
          </button>
          <p className="mute">hoặc lấy tùy chỉnh (khi hòa, chia pot)</p>
          <input inputMode="numeric" value={v} onChange={(e) => setV(digits(e.target.value))} />
          <div className="quick">
            <button onClick={() => set(Math.floor(pot / 2))}>½ · {fmt(Math.min(Math.floor(pot / 2), max))}</button>
            <button onClick={() => set(Math.floor(pot / 3))}>⅓ · {fmt(Math.min(Math.floor(pot / 3), max))}</button>
            <button onClick={() => set(max)}>Tối đa · {fmt(max)}</button>
          </div>
          <button className="outline" disabled={n < 1 || n > max} onClick={() => ask(n)}>
            Lấy {fmt(n)} · pot còn {fmt(Math.max(pot - n, 0))}
          </button>
          <p className="note">Mức tối đa tính theo số bạn đã cược ({fmt(me.totalBet)}). Phần chưa lấy ở lại pot.</p>
        </>
      )}
    </Sheet>
  );
}

// Bước xác nhận trước khi tố nhanh (blind, Call, Raise, All-in) để tránh bấm nhầm.
export function ConfirmSheet({ title, amount, left, onYes, onClose }) {
  return (
    <Sheet onClose={onClose}>
      <h2>{title}</h2>
      <div className="big">{fmt(amount)} chip</div>
      <p className="mute">Bạn còn {fmt(left)} chip sau khi tố.</p>
      <button className="primary" onClick={onYes}>Xác nhận</button>
      <button className="secondary" onClick={onClose}>Hủy</button>
    </Sheet>
  );
}

// Xác nhận rời phòng (thay cho hộp thoại confirm của trình duyệt, cùng kiểu với ConfirmSheet).
export function LeaveSheet({ text, onYes, onClose }) {
  return (
    <Sheet onClose={onClose}>
      <h2>Rời phòng?</h2>
      <p className="mute">{text}</p>
      <button className="primary" onClick={onYes}>Rời phòng</button>
      <button className="secondary" onClick={onClose}>Hủy</button>
    </Sheet>
  );
}
