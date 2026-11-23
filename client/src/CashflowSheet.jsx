import { Sheet } from './Sheets.jsx';
import { Icon } from './Table.jsx';
import { flow } from '../../shared/cashflow.js';
import { tone, signed } from './phomFmt.js';

const tick = (v) => (Math.abs(v) >= 1e6 ? `${+(v / 1e6).toFixed(1)}tr` : Math.abs(v) >= 1e3 ? `${+(v / 1e3).toFixed(1)}k` : String(v));
const hhmm = (t) => new Date(t).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

function Chart({ pts, start }) {
  const W = 320, H = 176, L = 40, R = 10, T = 16, B = 26, n = pts.length;
  const vals = [0, start, ...pts.map((p) => p.cum), ...pts.map((p) => p.a)];
  const hi0 = Math.max(...vals), lo0 = Math.min(...vals), pad = (hi0 - lo0) * 0.12 || 1;
  const hi = hi0 + pad, lo = lo0 - pad;
  const y = (v) => T + ((hi - v) / (hi - lo)) * (H - T - B);
  const slot = (W - L - R) / n;
  const x = (i) => L + (i + 0.5) * slot;
  const bw = Math.min(16, slot * 0.7);
  const last = pts[n - 1];
  const every = Math.ceil(n / 6);   // nhãn giờ thưa ra cho khỏi chồng nhau
  const ticks = [...new Set([hi0, 0, lo0])];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Biểu đồ cột giao dịch và đường số dư tích lũy">
      {ticks.map((v) => (
        <g key={v}>
          <line className={v === 0 ? 'cf-zero' : 'cf-grid'} x1={L} x2={W - R} y1={y(v)} y2={y(v)} />
          <text className="cf-axis" x={L - 6} y={y(v) + 4} textAnchor="end">{tick(v)}</text>
        </g>
      ))}
      {pts.map((p, i) => {
        const y0 = y(0), y1 = y(p.a);
        return (
          <g key={p.id}>
            <rect className={p.a > 0 ? 'cf-bar-up' : 'cf-bar-down'} x={x(i) - bw / 2} y={Math.min(y0, y1)} width={bw} height={Math.max(2, Math.abs(y1 - y0))} rx="3" />
            {(i % every === 0 || i === n - 1) && <text className="cf-axis" x={x(i)} y={H - 8} textAnchor="middle">{hhmm(p.t)}</text>}
          </g>
        );
      })}
      <path className="cf-line" d={pts.map((p, i) => `${i ? 'L' : 'M'}${x(i)} ${y(p.cum)}`).join(' ')} />
      {n <= 20 && pts.slice(0, -1).map((p, i) => <circle key={p.id} className="cf-dot" cx={x(i)} cy={y(p.cum)} r="3" />)}
      <circle className={`cf-dot end ${tone(last.cum)}`} cx={x(n - 1)} cy={y(last.cum)} r="4.5" />
      <text className={`cf-end ${tone(last.cum)}`} x={Math.min(x(n - 1), W - 24)} y={y(last.cum) - 10} textAnchor="middle">{signed(last.cum)}</text>
    </svg>
  );
}

/** Popup dòng tiền của bản thân với cả phòng (mở khi bấm vào ô "Bạn đang Lãi/Âm"). */
export default function CashflowSheet({ room, me, balanceWith, total, onClose }) {
  const members = new Set(room.players.map((p) => p.id));
  const f = flow(room.log, me, undefined, members, total);
  const truncated = (room.logTotal ?? room.log.length) > room.log.length;
  const people = room.players.filter((p) => p.id !== me).map((p) => ({ p, v: balanceWith(p.id) })).filter((r) => r.v !== 0).sort((a, b) => Math.abs(b.v) - Math.abs(a.v));
  const max = Math.max(1, ...people.map((r) => Math.abs(r.v)));

  return (
    <Sheet onClose={onClose}>
      <div className="cf-head">
        <h2>Dòng tiền của bạn</h2>
        <button className="round dark" aria-label="Đóng" onClick={onClose}><Icon name="x" /></button>
      </div>
      {f.pts.length === 0
        ? <p className="mute pad">Chưa có giao dịch để vẽ biểu đồ.</p>
        : (
          <>
            <div className="cf-legend">
              <span><i className="sq up" />Nhận</span><span><i className="sq down" />Gửi</span><span><i className="ln" />Số dư tích lũy</span>
            </div>
            <Chart pts={f.pts} start={f.start} />
          </>
        )}
      {truncated && <p className="mute">Chỉ tính {room.log.length} giao dịch gần nhất của phòng.</p>}
      {people.length > 0 && (
        <div className="cf-who">
          <small>Theo từng người</small>
          {people.map(({ p, v }) => (
            <div key={p.id} className="cf-wrow">
              <span className="cf-wname">{p.name}</span>
              <span className="cf-track"><span className={`cf-fill ${tone(v)}`} style={{ width: `${Math.round((Math.abs(v) / max) * 100)}%` }} /></span>
              <b className={tone(v)}>{signed(v)}</b>
            </div>
          ))}
        </div>
      )}
      <button className="secondary" onClick={onClose}>Đóng</button>
    </Sheet>
  );
}
