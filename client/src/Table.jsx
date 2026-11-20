import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { call } from './socket.js';
import Chips, { Disc } from './Chips.jsx';
import { valueOf } from '../../shared/chips.js';
import { highestBet, toCall, raiseAmount } from '../../shared/betting.js';
import { useChipAnim, FLIGHT_MS } from './useChipAnim.js';
import { AddSheet, TakeSheet, ConfirmSheet, LeaveSheet } from './Sheets.jsx';
import { fmt, short, colorOf } from './util.js';
import { isMuted, setMuted } from './sound.js';
import { computeLayout, seatFrac, sizes, potScaleFor } from './layout.js';
import { useScale } from './useScale.js';

const ICONS = {
  call: <path d="M9 6l6 6-6 6" />,
  up: <path d="M6 15l6-6 6 6" />,
  all: <><path d="M6 11l6-6 6 6" /><path d="M6 19l6-6 6 6" /></>,
  back: <path d="M15 6l-6 6 6 6" />,
  clock: <><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  sound: <><path d="M4 9v6h4l5 4V5L8 9z" /><path d="M16.5 9a4 4 0 010 6M19 6.5a8 8 0 010 11" /></>,
  muted: <><path d="M4 9v6h4l5 4V5L8 9z" /><path d="M17 9l5 6M22 9l-5 6" /></>,
};
export const Icon = ({ name }) => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
    {ICONS[name]}
  </svg>
);
function SoundToggle() {
  const [m, setM] = useState(isMuted());
  return (
    <button className="round dark" aria-label={m ? 'Bật âm thanh' : 'Tắt âm thanh'} aria-pressed={m} onClick={() => { setMuted(!m); setM(!m); }}>
      <Icon name={m ? 'muted' : 'sound'} />
    </button>
  );
}

const Crown = () => (
  <svg className="crown" viewBox="0 0 24 20" aria-label="Chủ phòng" role="img">
    <path d="M2 17 L1 5 l6 5 L12 2 l5 8 l6 -5 -1 12z" fill="#E8B04A" stroke="#151a18" strokeWidth="1.2" strokeLinejoin="round" />
  </svg>
);

const seatPos = (k, total) => {
  const { fx, fy } = seatFrac(k, total);
  return { left: `calc(7px + (100% - 14px) * ${fx})`, top: `calc(7px + (100% - 14px) * ${fy})` };
};
// "Bạn" đứng đầu, những người còn lại theo thứ tự vào phòng.
const orderOf = (room, me) => {
  const i = room.players.findIndex((p) => p.id === me);
  return i < 0 ? room.players : [...room.players.slice(i), ...room.players.slice(0, i)];
};

// Một đợt chip bay: mỗi chip đi theo một đường cong nhẹ, từ đỉnh chồng nguồn tới đỉnh chồng đích.
function Flight({ f }) {
  const ref = useRef(null);
  useEffect(() => {
    [...ref.current.children].forEach((n, i) => {
      const c = f.plan[i];
      const [x0, y0] = c.from, [x1, y1] = c.to;
      const wobble = (Math.random() - 0.5) * 14;
      n.animate([
        { transform: `translate(${x0}px, ${y0}px) scale(${c.s0})` },
        { transform: `translate(${(x0 + x1) / 2 + wobble}px, ${(y0 + y1) / 2 - 34}px) scale(${Math.max(c.s0, c.s1) * 1.12})`, offset: 0.5 },
        { transform: `translate(${x1}px, ${y1}px) scale(${c.s1})` },
      ], { duration: FLIGHT_MS, delay: c.delay, easing: 'cubic-bezier(.3,.1,.3,1)', fill: 'both' });
    });
  }, [f]);
  return <div ref={ref}>{f.plan.map((c, i) => <Disc key={i} d={c.d} />)}</div>;
}

// Avatar nằm trên viền bàn, số chip ở ngay dưới; nhãn số vừa tố và chồng chip của ghế do layout.js đặt vào chỗ trống.
function Seat({ room, p, k, total, map, setRef, u, z, item, pileMul }) {
  const host = p.id === room.hostId;
  const chars = [...p.name].length;
  const nameSize = Math.max(9, Math.min(15 * u, (z.A * 0.82) / (chars * 0.56)));
  const allIn = p.chips === 0 && p.lastBet > 0;
  return (
    <div className={`seat${p.online ? '' : ' off'}`} style={seatPos(k, total)} title={p.online ? '' : 'Đang mất kết nối'}>
      {item && (
        <div className="seatpile" style={{ left: item.pile.dx, top: item.pile.dy }}>
          <Chips map={map} scale={z.pile * pileMul} svgRef={setRef} />
        </div>
      )}
      {item?.pill && (
        <div className={`pill${allIn ? ' allin' : ''}`} style={{ left: item.pill.dx, top: item.pill.dy }}
          aria-label={`${allIn ? 'All-in ' : 'Vừa tố '}${fmt(p.lastBet)}`}>{short(p.lastBet)}</div>
      )}
      {host && <Crown />}
      <div className={`avatar${k === 0 ? ' me' : ''}`} style={{ background: colorOf(room, p.id), fontSize: nameSize }}>{p.name}</div>
      <div className="stack">{short(valueOf(map))}</div>
    </div>
  );
}

function Act({ tone, icon, text, label, off, aria, onClick }) {
  return (
    <button className="act" disabled={off} aria-label={aria || label} onClick={onClick}>
      <span className={`round ${tone}`}>{icon ? <Icon name={icon} /> : <b>{text}</b>}</span>
      <span>{label}</span>
    </button>
  );
}

export default function Table({ room, me, onHistory, onLeave }) {
  const [sheet, setSheet] = useState(null); // 'add' | 'leave' | { take: phiên bản pot }
  const [panel, setPanel] = useState(false);
  const [amount, setAmount] = useState('');
  const [ask, setAsk] = useState(null); // lệnh đang chờ xác nhận: { title, amount, blind? }
  const wrapRef = useRef(null), potRef = useRef(null), seatRefs = useRef({});
  const [size, setSize] = useState([0, 0]);
  const { view, flights } = useChipAnim(room, wrapRef, potRef, seatRefs);
  const u = useScale();
  const z = sizes(u);

  useLayoutEffect(() => {   // đo bàn để xếp chỗ cho chồng chip và nhãn của từng ghế
    const el = wrapRef.current;
    if (!el) return undefined;
    const fit = () => setSize([el.clientWidth, el.clientHeight]);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Có người đã đặt blind này trong lúc bạn đang xác nhận thì đóng bảng xác nhận.
  const posted = room.blindsPosted ?? {};
  useEffect(() => {
    if (ask?.blind && posted[ask.blind]) setAsk(null);
  }, [posted.small, posted.big, ask]); // eslint-disable-line react-hooks/exhaustive-deps

  const mine = room.players.find((p) => p.id === me);
  const seats = mine ? orderOf(room, me) : [];
  const layKey = JSON.stringify([size, u, short(room.pot), seats.map((p) => [p.id === room.hostId, short(p.chips), p.lastBet > 0 ? short(p.lastBet) : null])]);
  const lay = useMemo(() => (size[0] && seats.length
    ? computeLayout({
      W: size[0], H: size[1], u, potText: short(room.pot),
      seats: seats.map((p, k) => ({ ...seatFrac(k, seats.length), host: p.id === room.hostId, count: short(p.chips), pill: p.lastBet > 0 ? short(p.lastBet) : null })),
    })
    : null), [layKey]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!mine) return null;

  const potScale = lay?.potScale ?? potScaleFor(size[0] || 280, size[1] || 380, u);
  const top = highestBet(room.players);
  const owe = toCall(room.players, me);                  // số chip phải thêm để bằng người tố cao nhất
  const raise = (times) => raiseAmount(room.players, me, times);
  const { small, big } = room.blinds;
  const bet = async (n, blind) => { const r = await call('bet:place', { amount: n, blind }); if (r.ok) setAmount(''); };
  const typed = Number(amount) || 0;
  const quick = (title, amt, blind) => () => setAsk({ title, amount: amt, blind });
  const yes = () => { const a = ask; setAsk(null); bet(a.amount, a.blind); };
  const openPot = () => room.pot > 0 && setSheet({ take: room.version });

  // SB và BB chỉ bấm một lần mỗi ván: ai đặt xong thì nút đó biến mất với tất cả cho đến khi pot trống.
  const acts = [
    !posted.small && <Act key="sb" tone="blue" text="SB" label={fmt(small)} aria="Small blind" off={!mine.chips} onClick={quick('Small blind', Math.min(small, mine.chips), 'small')} />,
    !posted.big && <Act key="bb" tone="blue" text="BB" label={fmt(big)} aria="Big blind" off={!mine.chips} onClick={quick('Big blind', Math.min(big, mine.chips), 'big')} />,
    <Act key="call" tone="green" icon="call" label={`Call ${fmt(owe)}`} off={!owe || !mine.chips} onClick={quick('Call', Math.min(owe, mine.chips))} />,
    <Act key="r2" tone="orange" icon="up" label="Raise ×2" off={!top || raise(2) > mine.chips} onClick={quick('Raise ×2', raise(2))} />,
    <Act key="r3" tone="orange" icon="up" label="Raise ×3" off={!top || raise(3) > mine.chips} onClick={quick('Raise ×3', raise(3))} />,
    <Act key="all" tone="red" icon="all" label="All-in" off={!mine.chips} onClick={quick('All-in', mine.chips)} />,
  ].filter(Boolean);

  return (
    <>
      <header className="bar">
        <button className="round dark" aria-label="Rời phòng" onClick={() => setSheet('leave')}><Icon name="back" /></button>
        <div className="code"><small>Phòng</small><strong>{room.id}</strong></div>
        <SoundToggle />
        <button className="round dark" aria-label="Lịch sử" onClick={onHistory}><Icon name="clock" /></button>
        <button className={`round green${room.pot > 0 ? ' dim' : ''}`} aria-label="Nạp chip" onClick={() => setSheet('add')}><Icon name="plus" /></button>
      </header>

      <main className="tablewrap" ref={wrapRef}>
        <div className="felt" />
        {panel && (
          <>
            <div className="shade" onClick={() => setPanel(false)} />
            <div className="panel">
              <small>Tổng pot</small>
              <strong>{fmt(room.pot)}</strong>
              {room.players.map((p) => <div key={p.id} className="line"><span>{p.name}</span><b>{fmt(p.totalBet)}</b></div>)}
            </div>
          </>
        )}
        {seats.map((p, k) => (
          <Seat key={p.id} room={room} p={p} k={k} total={seats.length} u={u} z={z}
            item={lay?.items[k]} pileMul={lay?.pileMul ?? 1}
            map={view.seats[p.id] ?? p.chipMap}
            setRef={(el) => { if (el) seatRefs.current[p.id] = el; else delete seatRefs.current[p.id]; }} />
        ))}
        <div className="potbox">
          <button className="pot" aria-label="Pot, chạm để lấy chip" disabled={room.pot === 0} onClick={openPot}>
            <Chips map={view.pot} scale={potScale} svgRef={potRef} />
          </button>
          <div className="potrow">
            <button className="potnum" aria-label="Lấy chip từ pot" disabled={room.pot === 0} onClick={openPot}>{short(valueOf(view.pot))}</button>
            <button className="dollar" aria-label="Bảng cược" onClick={() => setPanel(true)}>$</button>
          </div>
        </div>
        <div className="flights" aria-hidden="true">{flights.map((f) => <Flight key={f.id} f={f} />)}</div>
      </main>

      <div className="actions" style={{ gridTemplateColumns: `repeat(${acts.length}, 1fr)` }}>{acts}</div>
      <div className="entry">
        <input inputMode="numeric" placeholder="Nhập số chip" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} />
        <button className="gold" disabled={typed < 1 || typed > mine.chips} onClick={() => bet(typed)}>Tố</button>
      </div>

      {sheet === 'leave' && <LeaveSheet text="Chip của bạn sẽ không còn." onYes={onLeave} onClose={() => setSheet(null)} />}
      {sheet === 'add' && <AddSheet blocked={room.pot > 0} onClose={() => setSheet(null)} />}
      {sheet?.take !== undefined && <TakeSheet me={mine} pot={room.pot} version={sheet.take} onClose={() => setSheet(null)} />}
      {ask && <ConfirmSheet title={ask.title} amount={ask.amount} left={mine.chips - ask.amount} onYes={yes} onClose={() => setAsk(null)} />}
    </>
  );
}
