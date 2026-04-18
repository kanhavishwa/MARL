import { useEffect, useMemo, useRef, useState } from "react";
import { IntersectionCanvas } from "./IntersectionCanvas";
import {
  TrafficSim,
  type SimMetrics,
  TICK_MS,
  ticksToSeconds,
} from "@/lib/traffic/simulation";
import { QLearningAgent } from "@/lib/traffic/qlearning";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

type Mode = "rl" | "fixed";
type DirKey = "N" | "S" | "E" | "W";

interface Preset {
  spawn: Record<DirKey, number>;
  turnMix: { straight: number; left: number; right: number };
  description: string;
}

const PRESETS: Record<string, Preset> = {
  Balanced: {
    spawn: { N: 0.20, S: 0.20, E: 0.20, W: 0.20 },
    turnMix: { straight: 0.7, left: 0.15, right: 0.15 },
    description: "Even demand from all four directions.",
  },
  Light: {
    spawn: { N: 0.08, S: 0.08, E: 0.08, W: 0.08 },
    turnMix: { straight: 0.75, left: 0.12, right: 0.13 },
    description: "Late-night / suburban — sparse traffic.",
  },
  "Rush hour (E-W)": {
    spawn: { N: 0.15, S: 0.12, E: 0.45, W: 0.40 },
    turnMix: { straight: 0.78, left: 0.10, right: 0.12 },
    description: "Morning commute on the main E-W corridor.",
  },
  "Indian chowk": {
    spawn: { N: 0.55, S: 0.50, E: 0.55, W: 0.52 },
    turnMix: { straight: 0.45, left: 0.30, right: 0.25 },
    description: "Dense mixed traffic, lots of turns — classic chowk gridlock.",
  },
  "Market street": {
    spawn: { N: 0.30, S: 0.32, E: 0.42, W: 0.38 },
    turnMix: { straight: 0.50, left: 0.28, right: 0.22 },
    description: "Heavy turning into shops on a busy bazaar road.",
  },
  "Highway merge": {
    spawn: { N: 0.55, S: 0.55, E: 0.12, W: 0.10 },
    turnMix: { straight: 0.85, left: 0.07, right: 0.08 },
    description: "Fast N-S throughput, minor cross street.",
  },
  "T-junction (W blocked)": {
    spawn: { N: 0.30, S: 0.30, E: 0.40, W: 0.0 },
    turnMix: { straight: 0.55, left: 0.25, right: 0.20 },
    description: "Three-way flow — west approach closed.",
  },
  Gridlock: {
    spawn: { N: 0.50, S: 0.50, E: 0.50, W: 0.50 },
    turnMix: { straight: 0.6, left: 0.20, right: 0.20 },
    description: "Saturated from every side — stress test.",
  },
};

export function SimulationPanel() {
  const agentRef = useRef<QLearningAgent>(new QLearningAgent());
  const simRef = useRef<TrafficSim>(new TrafficSim(agentRef.current));
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(2);
  const [mode, setMode] = useState<Mode>("rl");
  const [metrics, setMetrics] = useState<SimMetrics>(simRef.current.getMetrics());
  const [spawn, setSpawn] = useState<Record<DirKey, number>>({
    ...simRef.current.cfg.spawnRate,
  });
  const [turnMix, setTurnMix] = useState({ ...simRef.current.cfg.turnMix });
  const [activePreset, setActivePreset] = useState<string>("Balanced");

  useEffect(() => {
    simRef.current.mode = mode;
  }, [mode]);

  // Push slider values into the live sim
  useEffect(() => {
    simRef.current.cfg.spawnRate = { ...spawn };
  }, [spawn]);

  useEffect(() => {
    simRef.current.cfg.turnMix = { ...turnMix };
  }, [turnMix]);

  useEffect(() => {
    let raf = 0;
    let acc = 0;
    let last = performance.now();
    let lastUpdate = 0;
    const loop = (t: number) => {
      const dt = t - last;
      last = t;
      if (running) {
        acc += dt * speed;
        let safety = 200;
        while (acc >= TICK_MS && safety-- > 0) {
          simRef.current.tick();
          acc -= TICK_MS;
        }
      }
      if (t - lastUpdate > 200) {
        setMetrics(simRef.current.getMetrics());
        lastUpdate = t;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running, speed]);

  const rebuildSim = (freshAgent: boolean) => {
    if (freshAgent) {
      agentRef.current = new QLearningAgent();
    } else {
      agentRef.current.reset();
    }
    const next = new TrafficSim(agentRef.current);
    next.mode = mode;
    next.cfg.spawnRate = { ...spawn };
    next.cfg.turnMix = { ...turnMix };
    simRef.current = next;
    setMetrics(next.getMetrics());
  };

  const handleReset = () => rebuildSim(false);
  const handleNewAgent = () => rebuildSim(true);

  const applyPreset = (name: string) => {
    const p = PRESETS[name];
    if (!p) return;
    setSpawn({ ...p.spawn });
    setTurnMix({ ...p.turnMix });
    setActivePreset(name);
    // Clear existing cars/queues so the new scenario is visible immediately.
    // Keep the trained agent (no freshAgent) but inject the new config directly
    // since React state updates above won't be applied to simRef yet this tick.
    agentRef.current.reset();
    const next = new TrafficSim(agentRef.current);
    next.mode = mode;
    next.cfg.spawnRate = { ...p.spawn };
    next.cfg.turnMix = { ...p.turnMix };
    simRef.current = next;
    setMetrics(next.getMetrics());
  };

  // Turn-mix slider: a single 0..1 "non-straight ratio"; left/right split evenly
  const setStraightPct = (s: number) => {
    const rest = (1 - s) / 2;
    setTurnMix({ straight: s, left: rest, right: rest });
  };

  const stats = useMemo(
    () => [
      { label: "Episode step", value: metrics.step.toLocaleString(), hint: "Total simulation ticks since reset (1 tick ≈ 100 ms)." },
      { label: "Cars passed", value: metrics.totalPassed.toLocaleString(), hint: "Total vehicles that have crossed the intersection." },
      { label: "Avg wait (sec)", value: ticksToSeconds(metrics.avgWait).toFixed(2) + "s", hint: "Average real time each completed car spent stopped." },
      { label: "Live wait (sec)", value: ticksToSeconds(metrics.currentWait).toFixed(2) + "s", hint: "Mean wait time of cars currently queued." },
      { label: "Live queue", value: metrics.currentQueue.toString(), hint: "How many cars are stopped at the stop line right now." },
      { label: "Phase switches", value: metrics.switches.toString(), hint: "How many times the lights have changed." },
      { label: "Cumulative reward", value: metrics.reward.toFixed(1), hint: "Sum of rewards earned by the agent." },
      { label: "ε (exploration)", value: metrics.epsilon.toFixed(3), hint: "Probability of a random action." },
      { label: "Q-states learned", value: metrics.qStates.toString(), hint: "Distinct (queues, phase) states stored." },
    ],
    [metrics]
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="pill">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: running ? "var(--success)" : "var(--warning)" }}
            />
            {running ? "running" : "paused"}
          </span>
          <span className="pill">mode · {mode === "rl" ? "Q-learning" : "fixed timer"}</span>
          <span className="pill">phase · {metrics.phaseLabel}</span>
          <span className="pill">speed · {speed}×</span>
        </div>

        <IntersectionCanvas sim={simRef.current} size={460} />

        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setRunning((r) => !r)}>{running ? "Pause" : "Play"}</Button>
          <Button size="sm" variant="outline" onClick={() => setSpeed((s) => (s >= 8 ? 1 : s * 2))}>
            Speed × {speed}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setMode((m) => (m === "rl" ? "fixed" : "rl"))}>
            {mode === "rl" ? "Use fixed-timer" : "Use RL agent"}
          </Button>
          <Button size="sm" variant="ghost" onClick={handleReset}>Reset env</Button>
          <Button size="sm" variant="ghost" onClick={handleNewAgent}>New agent</Button>
        </div>

        {/* Traffic situation controls */}
        <div className="border ink-rule rounded-md p-4 bg-paper space-y-4">
          <div>
            <h4 className="font-serif text-base">Traffic situation</h4>
            <p className="text-[11px] text-muted-foreground font-mono">
              Drag sliders to change demand per direction. Or pick a preset.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {Object.keys(PRESETS).map((name) => (
              <Button
                key={name}
                size="sm"
                variant={activePreset === name ? "default" : "outline"}
                onClick={() => applyPreset(name)}
              >
                {name}
              </Button>
            ))}
          </div>

          <p className="text-[11px] text-muted-foreground font-mono italic">
            {PRESETS[activePreset]?.description}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(["N", "S", "E", "W"] as DirKey[]).map((d) => (
              <div key={d} className="space-y-1.5">
                <div className="flex justify-between text-[11px] font-mono">
                  <span className="text-muted-foreground">{d} spawn rate</span>
                  <span className="text-ink">{(spawn[d] * 100).toFixed(0)}%</span>
                </div>
                <Slider
                  value={[spawn[d] * 100]}
                  min={0}
                  max={60}
                  step={1}
                  onValueChange={([v]) => setSpawn((s) => ({ ...s, [d]: v / 100 }))}
                />
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] font-mono">
              <span className="text-muted-foreground">
                Straight % (rest splits evenly: left / right)
              </span>
              <span className="text-ink">
                S {(turnMix.straight * 100).toFixed(0)}% · L {(turnMix.left * 100).toFixed(0)}% · R {(turnMix.right * 100).toFixed(0)}%
              </span>
            </div>
            <Slider
              value={[turnMix.straight * 100]}
              min={20}
              max={100}
              step={1}
              onValueChange={([v]) => setStraightPct(v / 100)}
            />
          </div>
        </div>
      </div>

      <aside className="space-y-4">
        <div>
          <h3 className="font-serif text-xl">Live telemetry</h3>
          <p className="text-xs text-muted-foreground font-mono">updated 5×/sec</p>
        </div>
        <div className="grid grid-cols-2 gap-px bg-rule border ink-rule rounded-md overflow-hidden">
          {stats.map((s) => (
            <div key={s.label} className="bg-paper p-3" title={s.hint}>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
                {s.label}
              </div>
              <div className="font-mono text-base mt-1 text-ink">{s.value}</div>
            </div>
          ))}
        </div>

        <div className="border ink-rule rounded-md p-3 bg-paper">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
            Signal phases
          </div>
          <ul className="text-xs leading-relaxed mt-2 space-y-1 text-ink font-mono">
            <li>0 · N–S straight + right green</li>
            <li>1 · N–S left-turn arrow</li>
            <li>2 · E–W straight + right green</li>
            <li>3 · E–W left-turn arrow</li>
          </ul>
        </div>

        <div className="border ink-rule rounded-md p-3 bg-paper">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
            Reward function
          </div>
          <pre className="font-mono text-xs mt-2 leading-relaxed text-ink">
{`r = -|waiting_cars|
    - 0.5 if action = SWITCH`}
          </pre>
        </div>

        <div className="border ink-rule rounded-md p-3 bg-paper">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
            Car colours
          </div>
          <ul className="text-xs leading-relaxed mt-2 space-y-1 text-ink">
            <li><span className="inline-block w-3 h-3 align-middle mr-2 rounded-sm" style={{ background: "oklch(0.7 0.16 25)" }} /> Left turn</li>
            <li><span className="inline-block w-3 h-3 align-middle mr-2 rounded-sm" style={{ background: "oklch(0.7 0.16 200)" }} /> Right turn</li>
            <li><span className="inline-block w-3 h-3 align-middle mr-2 rounded-sm" style={{ background: "oklch(0.7 0.12 140)" }} /> Straight (varied hue)</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
