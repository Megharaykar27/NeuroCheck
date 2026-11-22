// Half-circle gauge. The scale is not linear: most people are under 10%,
// so the first part of the arc is stretched to make small risks readable.
import { useEffect, useState } from "react";
import { animate, motion, useMotionValue } from "framer-motion";
import { LEVELS } from "../lib/risk";

const toAngle = (p) => {
  const v = Math.min(Math.max(p, 0), 0.5);
  return Math.sqrt(v / 0.5) * 180; // square-root scale
};

export default function RiskGauge({ risk, level, size = 280, thresholds }) {
  const [shown, setShown] = useState(0);
  const mv = useMotionValue(0);
  const color = LEVELS[level]?.color || "#101418";
  const r = size / 2 - 18;
  const cx = size / 2, cy = size / 2;
  const arc = (a0, a1) => {
    const p = (a) => [cx - r * Math.cos((a * Math.PI) / 180), cy - r * Math.sin((a * Math.PI) / 180)];
    const [x0, y0] = p(a0), [x1, y1] = p(a1);
    return `M ${x0} ${y0} A ${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`;
  };

  useEffect(() => {
    const c = animate(mv, risk, { duration: 1.4, ease: [0.22, 1, 0.36, 1], onUpdate: (v) => setShown(v) });
    return c.stop;
  }, [risk]); // eslint-disable-line react-hooks/exhaustive-deps

  const angle = toAngle(shown);
  const zones = thresholds
    ? [
        [0, toAngle(thresholds.moderate), LEVELS.low.color],
        [toAngle(thresholds.moderate), toAngle(thresholds.high), LEVELS.moderate.color],
        [toAngle(thresholds.high), 180, LEVELS.high.color],
      ]
    : [];
  const needle = [cx - (r - 30) * Math.cos((angle * Math.PI) / 180), cy - (r - 30) * Math.sin((angle * Math.PI) / 180)];

  return (
    <div className="relative mx-auto" style={{ width: size, height: size / 2 + 64 }}>
      <svg width={size} height={size / 2 + 20} viewBox={`0 0 ${size} ${size / 2 + 20}`}>
        <path d={arc(0, 180)} stroke="#ECEAE4" strokeWidth="16" fill="none" strokeLinecap="round" />
        {zones.map(([a, b, c]) => (
          <path key={a} d={arc(a + 0.5, b - 0.5)} stroke={c} strokeOpacity="0.18" strokeWidth="16" fill="none" />
        ))}
        {angle > 0.5 && <path d={arc(0, angle)} stroke={color} strokeWidth="16" fill="none" strokeLinecap="round" />}
        <motion.line x1={cx} y1={cy} x2={needle[0]} y2={needle[1]} stroke="#101418" strokeWidth="3" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="7" fill="#101418" />
        <text x={18} y={cy + 18} fontSize="11" fill="#5B6470">0%</text>
        <text x={size - 18} y={cy + 18} fontSize="11" fill="#5B6470" textAnchor="end">50%+</text>
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center">
        <p className="font-display text-5xl font-bold tabular-nums" style={{ color }}>
          {(shown * 100).toFixed(1)}
          <span className="text-2xl">%</span>
        </p>
      </div>
    </div>
  );
}
