import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect, useState } from "react";

export function scoreTone(score: number) {
  if (score >= 75) return { text: "text-success", ring: "var(--success)", label: "Strong match" };
  if (score >= 50) return { text: "text-warning", ring: "var(--warning)", label: "Partial match" };
  return { text: "text-danger", ring: "var(--danger)", label: "Weak match" };
}

export function CountUp({ value, className }: { value: number; className?: string }) {
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, (v) => Math.round(v));
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const unsub = rounded.on("change", setDisplay);
    const controls = animate(mv, value, { duration: 0.8, ease: "easeOut" });
    return () => {
      controls.stop();
      unsub();
    };
  }, [value, mv, rounded]);

  return <span className={className}>{display}</span>;
}

export function ScoreRing({
  score,
  size = 112,
  strokeWidth = 9,
}: {
  score: number;
  size?: number;
  strokeWidth?: number;
}) {
  const tone = scoreTone(score);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={tone.ring}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - Math.min(100, score) / 100) }}
          transition={{ duration: 1, ease: "easeInOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <CountUp value={score} className={`text-2xl font-semibold ${tone.text}`} />
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">score</span>
      </div>
    </div>
  );
}
