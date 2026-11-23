import { useEffect, useRef, useState } from 'react';
import { VB, chipPoint } from './geometry.js';
import { snapshot, startView, landChip, chipList, addedTxs } from './anim.js';

export const FLIGHT_MS = 460;   // thời gian một chip bay
const STEP_MS = 70;             // chip sau bay trễ chip trước chừng này
const SPREAD_MS = 560;          // nhiều chip thì dồn lại để cả đợt không quá lâu
const CAP = 24;                 // tối đa số chip thực sự bay; phần thừa chỉ cộng vào lúc cuối

/**
 * Điều khiển chip đang vẽ. Server gửi trạng thái cuối; hook giữ `view` (pot + chồng chip từng người) đi sau một nhịp:
 * tố → chip bay từ chồng người tố vào pot, lấy pot → chip bay từ pot về chồng người lấy. Mỗi chip chạm đích thì
 * view mới được cộng đúng chip đó, nên chồng chip lớn dần từng chip, đúng mệnh giá, đúng chỗ.
 * Trả về { view, flights }; flights = [{ id, plan: [{ d, from, to, s0, s1, delay }] }] theo toạ độ của wrapRef.
 */
export function useChipAnim(room, wrapRef, potRef, seatRefs) {
  const [view, setView] = useState(() => snapshot(room));
  const [flights, setFlights] = useState([]);
  const prev = useRef(room);
  const timers = useRef([]);
  const stop = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  useEffect(() => stop, []);

  useEffect(() => {
    const before = prev.current;
    prev.current = room;
    stop();
    const final = snapshot(room);
    const snap = () => { setFlights([]); setView(final); };

    const added = addedTxs(before, room);
    const tx = added[0];
    const wrap = wrapRef.current, pot = potRef.current;
    const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    // Chỉ làm hoạt ảnh khi có đúng một giao dịch tố/lấy mới (hoàn tác, nạp chip, nối lại thì cập nhật ngay).
    if (added.length !== 1 || !tx.chips || calm || !wrap || !pot || !seatRefs.current[tx.playerId]) return snap();

    const isBet = tx.type === 'bet';
    const seat = seatRefs.current[tx.playerId];
    const start = startView(before, room, tx);
    const [src, dst] = isBet ? [seat, pot] : [pot, seat];
    const srcMap = isBet ? start.seats[tx.playerId] : before.potChips ?? {};
    const dstMap = isBet ? start.pot : start.seats[tx.playerId];
    const where = isBet ? 'pot' : tx.playerId;

    const wr = wrap.getBoundingClientRect();
    const scaleOf = (el) => el.getBoundingClientRect().width / VB.w;
    const at = (el, v, n) => {
      const r = el.getBoundingClientRect(), k = r.width / VB.w, p = chipPoint(v, n);
      return [r.left - wr.left + (p.x - VB.x) * k, r.top - wr.top + (p.y - VB.y) * k];
    };

    const flying = chipList(tx.chips).slice(0, CAP);
    const step = Math.min(STEP_MS, SPREAD_MS / flying.length);
    const plan = flying.map(({ d, i }, j) => ({
      d,
      delay: Math.round(j * step),
      // tố: chip nhấc khỏi đỉnh chồng còn lại của người tố; lấy: chip nhấc khỏi đỉnh pot
      from: at(src, d.v, isBet ? (srcMap[d.v] || 0) + i : Math.max(0, (srcMap[d.v] || 0) - 1 - i)),
      // đáp xuống đỉnh chồng cùng mệnh giá ở đích, chip sau nằm cao hơn chip trước
      to: at(dst, d.v, (dstMap[d.v] || 0) + i),
      s0: scaleOf(src),
      s1: scaleOf(dst),
    }));

    setView(start);
    setFlights([{ id: tx.id, plan }]);
    for (const c of plan) {
      timers.current.push(setTimeout(() => setView((v) => landChip(v, where, c.d.v)), c.delay + FLIGHT_MS));
    }
    const end = (plan[plan.length - 1]?.delay ?? 0) + FLIGHT_MS + 40;
    timers.current.push(setTimeout(snap, end));   // chốt đúng trạng thái server (kể cả chip vượt CAP)
  }, [room]); // eslint-disable-line react-hooks/exhaustive-deps

  return { view, flights };
}
