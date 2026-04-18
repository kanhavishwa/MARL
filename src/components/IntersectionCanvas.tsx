import { useEffect, useRef } from "react";
import type { Car, TrafficSim } from "@/lib/traffic/simulation";

interface Props {
  sim: TrafficSim;
  size?: number;
}

// Compute a car's screen position + rotation based on its lane direction,
// turn type, and progress 0..1 along the road.
function carScreenPos(
  car: Car,
  w: number,
  h: number,
  cx: number,
  cy: number,
  roadW: number
): { x: number; y: number; rot: number } {
  const laneOffset = roadW * 0.25;
  const ENTER = 0.45;
  const EXIT = 0.60;
  const p = car.pos;

  // Approach line position at parameter `pp` along the incoming road
  const approachAt = (dir: Car["dir"], pp: number): { x: number; y: number; rot: number } => {
    switch (dir) {
      case "N": return { x: cx - laneOffset, y: pp * h, rot: Math.PI / 2 };
      case "S": return { x: cx + laneOffset, y: h - pp * h, rot: -Math.PI / 2 };
      case "E": return { x: w - pp * w, y: cy - laneOffset, rot: Math.PI };
      case "W": return { x: pp * w, y: cy + laneOffset, rot: 0 };
    }
  };

  // Outgoing lane position at parameter `pp` (for pp in [EXIT..1.1])
  const exitAt = (
    dir: Car["dir"],
    turn: Car["turn"],
    pp: number
  ): { x: number; y: number; rot: number } => {
    let outDir: Car["dir"] = dir;
    if (turn === "left") outDir = ({ N: "W", S: "E", E: "N", W: "S" } as const)[dir];
    else if (turn === "right") outDir = ({ N: "E", S: "W", E: "S", W: "N" } as const)[dir];
    const tt = Math.min(1, Math.max(0, (pp - EXIT) / (1.1 - EXIT)));
    const dist = (roadW / 2) + tt * (Math.min(w, h) / 2);
    switch (outDir) {
      case "N": return { x: cx + laneOffset, y: cy - dist, rot: -Math.PI / 2 };
      case "S": return { x: cx - laneOffset, y: cy + dist, rot: Math.PI / 2 };
      case "E": return { x: cx + dist, y: cy + laneOffset, rot: 0 };
      case "W": return { x: cx - dist, y: cy - laneOffset, rot: Math.PI };
    }
  };

  if (p <= ENTER) return approachAt(car.dir, p);
  if (p >= EXIT) return exitAt(car.dir, car.turn, p);

  // Inside intersection: bezier from end-of-approach to start-of-exit
  const a = approachAt(car.dir, ENTER);
  const b = exitAt(car.dir, car.turn, EXIT);
  const t = (p - ENTER) / (EXIT - ENTER);

  let x: number, y: number, rot: number;
  if (car.turn === "straight") {
    x = a.x + (b.x - a.x) * t;
    y = a.y + (b.y - a.y) * t;
    rot = a.rot;
  } else {
    // Quadratic Bezier with control at the intersection center
    const ctrlX = cx;
    const ctrlY = cy;
    const omt = 1 - t;
    x = omt * omt * a.x + 2 * omt * t * ctrlX + t * t * b.x;
    y = omt * omt * a.y + 2 * omt * t * ctrlY + t * t * b.y;
    // Tangent of bezier for rotation
    const dx = 2 * omt * (ctrlX - a.x) + 2 * t * (b.x - ctrlX);
    const dy = 2 * omt * (ctrlY - a.y) + 2 * t * (b.y - ctrlY);
    rot = Math.atan2(dy, dx);
  }
  return { x, y, rot };
}

export function IntersectionCanvas({ sim, size = 480 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const draw = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const bg = getComputedStyle(document.documentElement).getPropertyValue("--paper") || "#fff";
      ctx.fillStyle = `oklch(${bg.trim() || "0.99 0.004 90"})`;
      ctx.fillRect(0, 0, w, h);

      // Grid
      ctx.strokeStyle = "rgba(20,30,60,0.06)";
      ctx.lineWidth = 1;
      const grid = 24;
      for (let x = 0; x < w; x += grid) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      for (let y = 0; y < h; y += grid) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }

      const cx = w / 2;
      const cy = h / 2;
      const roadW = Math.min(w, h) * 0.18;

      // Roads
      ctx.fillStyle = "#2a2f3a";
      ctx.fillRect(0, cy - roadW / 2, w, roadW);
      ctx.fillRect(cx - roadW / 2, 0, roadW, h);

      // Lane center divider
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 12]);
      ctx.beginPath();
      ctx.moveTo(0, cy); ctx.lineTo(cx - roadW / 2, cy);
      ctx.moveTo(cx + roadW / 2, cy); ctx.lineTo(w, cy);
      ctx.moveTo(cx, 0); ctx.lineTo(cx, cy - roadW / 2);
      ctx.moveTo(cx, cy + roadW / 2); ctx.lineTo(cx, h);
      ctx.stroke();
      ctx.setLineDash([]);

      // Intersection box
      ctx.fillStyle = "#34394a";
      ctx.fillRect(cx - roadW / 2, cy - roadW / 2, roadW, roadW);

      // Stop lines
      ctx.fillStyle = "#fff";
      const sl = roadW / 2;
      ctx.fillRect(cx - roadW / 2 + 4, cy - sl - 4, roadW / 2 - 6, 3);
      ctx.fillRect(cx + 2, cy + sl + 1, roadW / 2 - 6, 3);
      ctx.fillRect(cx - sl - 4, cy + 2, 3, roadW / 2 - 6);
      ctx.fillRect(cx + sl + 1, cy - roadW / 2 + 4, 3, roadW / 2 - 6);

      // Traffic lights — show 2 lights per approach: STRAIGHT round + LEFT arrow
      const phase = sim.phase;
      const yellow = sim.yellow;
      const nsStraight = !yellow && phase === 0;
      const ewStraight = !yellow && phase === 2;
      const nsLeft = !yellow && phase === 1;
      const ewLeft = !yellow && phase === 3;

      const colorOf = (on: boolean, ns: boolean) => {
        if (yellow) {
          // Only the ending phase shows yellow
          const ending =
            (phase === 0 && ns) ||
            (phase === 2 && !ns) ||
            (phase === 1 && ns) ||
            (phase === 3 && !ns);
          return ending ? "#f5b300" : "#ef4444";
        }
        return on ? "#22c55e" : "#ef4444";
      };

      const drawDot = (x: number, y: number, color: string, r = 5) => {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;
      };
      const drawArrow = (x: number, y: number, color: string) => {
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.moveTo(x - 4, y);
        ctx.lineTo(x + 2, y - 4);
        ctx.lineTo(x + 2, y - 2);
        ctx.lineTo(x + 5, y - 2);
        ctx.lineTo(x + 5, y + 2);
        ctx.lineTo(x + 2, y + 2);
        ctx.lineTo(x + 2, y + 4);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
      };

      // 4 corner clusters: each shows [straight dot] + [left arrow]
      const clusters = [
        { x: cx - roadW / 2 - 14, y: cy - roadW / 2 - 14, ns: true },   // top-left  (NS)
        { x: cx + roadW / 2 + 14, y: cy + roadW / 2 + 14, ns: true },   // bot-right (NS)
        { x: cx + roadW / 2 + 14, y: cy - roadW / 2 - 14, ns: false },  // top-right (EW)
        { x: cx - roadW / 2 - 14, y: cy + roadW / 2 + 14, ns: false },  // bot-left  (EW)
      ];
      for (const c of clusters) {
        const straightOn = c.ns ? nsStraight : ewStraight;
        const leftOn = c.ns ? nsLeft : ewLeft;
        drawDot(c.x, c.y - 6, colorOf(straightOn, c.ns));
        drawArrow(c.x, c.y + 7, colorOf(leftOn, c.ns));
      }

      // Cars
      const carLen = 14;
      const carWid = 10;
      for (const car of sim.cars) {
        const { x, y, rot } = carScreenPos(car, w, h, cx, cy, roadW);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rot);
        // Body color hints at intent
        const hue =
          car.turn === "left" ? 25 :       // amber
          car.turn === "right" ? 200 :     // cyan
          (car.id * 47) % 360;
        const chroma = car.turn === "straight" ? 0.12 : 0.16;
        ctx.fillStyle = `oklch(0.7 ${chroma} ${hue})`;
        ctx.fillRect(-carLen / 2, -carWid / 2, carLen, carWid);
        ctx.fillStyle = "rgba(20,30,60,0.55)";
        ctx.fillRect(carLen / 4 - 2, -carWid / 2 + 1, 4, carWid - 2);
        // Tiny indicator dot for turn direction
        if (car.turn !== "straight") {
          ctx.fillStyle = "#fffbe6";
          const sx = car.turn === "left" ? -carLen / 2 + 2 : carLen / 2 - 3;
          ctx.fillRect(sx, -carWid / 2, 1.5, 1.5);
        }
        ctx.restore();
      }

      // Phase label
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.font = "500 11px JetBrains Mono, monospace";
      ctx.fillText(sim.phaseLabel(), 12, h - 12);

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [sim]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: size, display: "block", borderRadius: 8 }}
      className="bg-paper border ink-rule"
    />
  );
}
