import { useId } from 'react';
import { stacksFromMap } from '../../shared/chips.js';
import { RX, RY, H, MAX_HEIGHT, VB, SLOT } from './geometry.js';

// Một chồng chip nhìn từ trên xuống: thành bên, mặt trên có khía, chip trên cùng có vòng tâm và ♠.
function Stack({ x, y, d, shadow }) {
  const n = Math.min(d.count, MAX_HEIGHT);
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx="0" cy="8" rx={RX + 8} ry={RY + 3} fill="rgba(0,0,0,.38)" filter={`url(#${shadow})`} />
      {Array.from({ length: n }, (_, i) => {
        const cy = -i * H;
        return (
          <g key={i}>
            <path d={`M${-RX} ${cy} v${H} a${RX} ${RY} 0 0 0 ${2 * RX} 0 v${-H} z`} fill={d.side} />
            <path d={`M${-RX + 1} ${cy + H / 2} a${RX - 1} ${RY - 1} 0 0 0 ${2 * RX - 2} 0`} fill="none"
              stroke={d.mark} strokeOpacity=".55" strokeWidth="2" strokeDasharray="4 5" />
            <ellipse cx="0" cy={cy} rx={RX} ry={RY} fill={d.face} stroke={d.mark} strokeWidth="4" strokeDasharray="9 9" />
            <ellipse cx="0" cy={cy} rx={RX - 3} ry={RY - 3} fill={d.face} />
            {i === n - 1 && (
              <>
                <ellipse cx="0" cy={cy} rx="14" ry="10" fill="none" stroke={d.ink} strokeOpacity=".85" strokeWidth="1.6" />
                <text x="0" y={cy + 4.5} textAnchor="middle" fontSize="13" fill={d.ink}>♠</text>
              </>
            )}
          </g>
        );
      })}
    </g>
  );
}

/** Một chip đang bay: cùng hình dạng với chip trong chồng, tâm mặt trên nằm ở (0,0) của phần tử. */
export function Disc({ d }) {
  return (
    <svg className="disc" viewBox="-28 -22 56 48" width="56" height="48" aria-hidden="true">
      <path d={`M${-RX} 0 v${H} a${RX} ${RY} 0 0 0 ${2 * RX} 0 v${-H} z`} fill={d.side} />
      <ellipse cx="0" cy="0" rx={RX} ry={RY} fill={d.face} stroke={d.mark} strokeWidth="4" strokeDasharray="9 9" />
      <ellipse cx="0" cy="0" rx={RX - 3} ry={RY - 3} fill={d.face} />
      <ellipse cx="0" cy="0" rx="14" ry="10" fill="none" stroke={d.ink} strokeOpacity=".85" strokeWidth="1.6" />
      <text x="0" y="4.5" textAnchor="middle" fontSize="13" fill={d.ink}>♠</text>
    </svg>
  );
}

/**
 * Đống chip thật: map = {mệnh giá: số chip}. Luôn vẽ khung svg cố định (kể cả khi trống) để biết chỗ chip đáp xuống.
 * scale: tỉ lệ so với cỡ gốc (pot ~1, chồng ở ghế nhỏ hơn). svgRef dùng để đo vị trí chip bay.
 */
export default function Chips({ map, scale = 1, svgRef }) {
  const shadow = `soft${useId().replace(/\W/g, '')}`;
  const stacks = stacksFromMap(map);
  return (
    <svg ref={svgRef} viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`} width={VB.w * scale} height={VB.h * scale}
      style={{ overflow: 'visible', display: 'block' }} aria-hidden="true">
      <defs><filter id={shadow} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" /></filter></defs>
      {[...stacks].sort((a, b) => SLOT[a.v].y - SLOT[b.v].y).map((d) => (
        <Stack key={d.v} x={SLOT[d.v].x} y={SLOT[d.v].y} d={d} shadow={shadow} />
      ))}
    </svg>
  );
}
