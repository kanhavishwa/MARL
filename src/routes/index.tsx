import { createFileRoute } from "@tanstack/react-router";
import { SimulationPanel } from "@/components/SimulationPanel";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Multi-Agent Traffic Simulation & Control using Reinforcement Learning" },
      {
        name: "description",
        content:
          "Final-year project: a browser-based multi-agent traffic intersection trained in real time with tabular Q-learning. Compare RL control against fixed-timer baselines with live metrics.",
      },
      {
        property: "og:title",
        content: "Multi-Agent Traffic Simulation & Control using Reinforcement Learning",
      },
      {
        property: "og:description",
        content:
          "Live in-browser Q-learning agent controlling a 4-way intersection. Watch reward, ε-decay, and Q-table grow.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="border-b ink-rule">
        <div className="mx-auto max-w-6xl px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-sm bg-ink text-paper grid place-items-center font-serif text-sm">
              τ
            </div>
            <div className="leading-tight">
              <div className="font-serif text-base">TraffiQ</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">
                Final Year Project · 2025
              </div>
            </div>
          </div>
          <nav className="hidden sm:flex items-center gap-5 text-sm">
            <a href="#simulation" className="hover:underline underline-offset-4">Simulation</a>
            <a href="#method" className="hover:underline underline-offset-4">Method</a>
            <a href="#results" className="hover:underline underline-offset-4">Results</a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b ink-rule">
        <div className="absolute inset-0 paper-grid opacity-60 pointer-events-none" />
        <div className="relative mx-auto max-w-6xl px-5 py-16 sm:py-24 grid lg:grid-cols-12 gap-10">
          <div className="lg:col-span-7 space-y-6">
            <span className="pill">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
              Live Q-learning · runs entirely in your browser
            </span>
            <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl leading-[1.05] tracking-tight">
              Multi-Agent Traffic Simulation
              <span className="italic text-[color:var(--accent-academic)]"> & Control</span>{" "}
              using Reinforcement Learning.
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl leading-relaxed">
              A 4-way urban intersection where a tabular{" "}
              <span className="font-mono text-ink">Q-learning</span> agent decides — every few
              ticks — whether to <em>hold</em> the current signal phase or <em>switch</em>. The
              reward signal punishes waiting cars; the agent gradually discovers a smarter policy
              than a fixed-timer baseline. Toggle between the two below and watch the metrics
              diverge.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <a
                href="#simulation"
                className="inline-flex items-center gap-2 rounded-md bg-ink text-paper px-4 py-2 text-sm font-medium hover:opacity-90 transition"
              >
                Run the simulation →
              </a>
              <a
                href="#method"
                className="inline-flex items-center gap-2 rounded-md border ink-rule px-4 py-2 text-sm hover:bg-secondary transition"
              >
                Read the method
              </a>
            </div>
          </div>
          <aside className="lg:col-span-5 border ink-rule rounded-lg bg-paper p-5 space-y-3 self-start">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">
              Abstract
            </div>
            <p className="text-sm leading-relaxed">
              Urban congestion is fundamentally a sequential decision problem. We model a
              signalized intersection as a Markov Decision Process and train a value-based
              reinforcement learning agent to minimise cumulative vehicle waiting time. The
              system is implemented as a multi-agent traffic controller, demonstrated here in a
              fully reproducible browser environment with no server backend.
            </p>
            <dl className="grid grid-cols-2 gap-3 pt-2 text-xs font-mono">
              <div>
                <dt className="text-muted-foreground">Algorithm</dt>
                <dd className="text-ink">Q-learning (ε-greedy)</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">State space</dt>
                <dd className="text-ink">|Q| × phases ≈ 1250</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Action space</dt>
                <dd className="text-ink">{"{ keep, switch }"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Update rule</dt>
                <dd className="text-ink">TD(0)</dd>
              </div>
            </dl>
          </aside>
        </div>
      </section>

      {/* Simulation */}
      <section id="simulation" className="border-b ink-rule">
        <div className="mx-auto max-w-6xl px-5 py-14">
          <div className="flex items-end justify-between gap-4 mb-6 flex-wrap">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">
                Section 01 — Live Environment
              </div>
              <h2 className="font-serif text-3xl sm:text-4xl mt-1">
                The intersection, learning in real time.
              </h2>
            </div>
            <p className="text-sm text-muted-foreground max-w-md">
              Cars spawn from each direction with asymmetric arrival rates. Watch the Q-table
              grow and ε decay as the policy improves.
            </p>
          </div>
          <SimulationPanel />
        </div>
      </section>

      {/* Method */}
      <section id="method" className="border-b ink-rule">
        <div className="mx-auto max-w-6xl px-5 py-14 grid md:grid-cols-3 gap-8">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">
              Section 02
            </div>
            <h2 className="font-serif text-3xl mt-1">Methodology</h2>
            <p className="text-sm text-muted-foreground mt-3">
              We formalise control as an MDP and solve it with off-policy temporal-difference
              learning.
            </p>
          </div>
          <div className="md:col-span-2 space-y-6">
            <div className="border ink-rule rounded-md p-5 bg-paper">
              <h3 className="font-serif text-xl">State representation</h3>
              <p className="text-sm mt-2 leading-relaxed">
                Each direction's queue length is discretised into 5 bins{" "}
                <span className="font-mono text-xs">{"{0, 1–2, 3–5, 6–9, 10+}"}</span>. Combined
                with the current signal phase, this yields a compact state{" "}
                <span className="font-mono text-xs">s = ⟨b_N, b_S, b_E, b_W, φ⟩</span> with at
                most <span className="font-mono">5⁴ × 2 = 1250</span> entries — small enough for
                a tabular Q-function.
              </p>
            </div>
            <div className="border ink-rule rounded-md p-5 bg-paper">
              <h3 className="font-serif text-xl">Action & reward</h3>
              <p className="text-sm mt-2 leading-relaxed">
                The agent chooses{" "}
                <span className="font-mono text-xs">a ∈ {"{KEEP, SWITCH}"}</span> every 20 ticks,
                subject to a minimum-phase safety constraint. The reward at decision step{" "}
                <span className="font-mono text-xs">t</span> is{" "}
                <span className="font-mono text-xs">
                  r_t = −|waiting| − 0.5·𝟙[a = SWITCH]
                </span>
                , directly minimising mean delay while penalising flicker.
              </p>
            </div>
            <div className="border ink-rule rounded-md p-5 bg-paper">
              <h3 className="font-serif text-xl">Learning rule</h3>
              <pre className="font-mono text-xs mt-3 overflow-x-auto leading-relaxed">
{`Q(s, a) ← Q(s, a) + α [ r + γ · max_a' Q(s', a') − Q(s, a) ]
α = 0.1   γ = 0.9   ε: 1.0 → 0.05  (decay 0.9995/step)`}
              </pre>
            </div>
            <div className="border ink-rule rounded-md p-5 bg-paper">
              <h3 className="font-serif text-xl">Multi-agent extension</h3>
              <p className="text-sm mt-2 leading-relaxed">
                The architecture generalises: each intersection in a city grid runs an
                independent Q-learner observing only its own queues — a{" "}
                <em>decentralised, partially-observable</em> setting. Coordination emerges from
                shared traffic flow rather than explicit communication, the same paradigm used
                in IDQN and MA2C literature.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Results */}
      <section id="results" className="border-b ink-rule">
        <div className="mx-auto max-w-6xl px-5 py-14">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">
            Section 03
          </div>
          <h2 className="font-serif text-3xl mt-1">Expected behaviour</h2>
          <p className="text-sm text-muted-foreground max-w-2xl mt-3">
            Run the simulation for ~5,000+ steps in RL mode, then toggle to the fixed-timer
            baseline. The Q-learning controller should produce a lower steady-state{" "}
            <span className="font-mono text-xs">avg wait</span> on the asymmetric arrival
            pattern (E lane is busiest).
          </p>
          <div className="grid sm:grid-cols-3 gap-4 mt-8">
            {[
              {
                k: "Adaptivity",
                v: "Allocates green time toward the busiest approach without hand-tuning.",
              },
              {
                k: "Stability",
                v: "Switch-penalty term suppresses oscillation once Q-values converge.",
              },
              {
                k: "Reproducibility",
                v: "100% client-side: no GPU, no server, no installs. Just open and run.",
              },
            ].map((c) => (
              <div key={c.k} className="border ink-rule rounded-md p-5 bg-paper">
                <div className="font-serif text-lg">{c.k}</div>
                <p className="text-sm text-muted-foreground mt-2">{c.v}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer>
        <div className="mx-auto max-w-6xl px-5 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground font-mono">
            © {new Date().getFullYear()} TraffiQ — Final Year Project
          </div>
          <div className="text-xs text-muted-foreground font-mono">
            Built with TanStack Start · Tabular Q-learning · Canvas 2D
          </div>
        </div>
      </footer>
    </div>
  );
}
