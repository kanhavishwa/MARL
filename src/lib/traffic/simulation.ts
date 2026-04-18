// 4-way intersection with left/right/straight turns and 4-phase signals.
//
// Phases:
//   0 = NS straight + right green   (NS left red, EW red)
//   1 = NS left-turn arrow green    (everything else red)
//   2 = EW straight + right green
//   3 = EW left-turn arrow green
//
// Right turns are always allowed when the corresponding straight phase is green
// (no separate arrow needed — typical real-world rule).

import { QLearningAgent, encodeState, type QAction, type QueueSnapshot } from "./qlearning";

export type Direction = "N" | "S" | "E" | "W";
export type Turn = "straight" | "left" | "right";

export interface Car {
  id: number;
  dir: Direction;     // approach direction
  turn: Turn;
  pos: number;        // 0 = far edge, 1 = past intersection
  vel: number;
  waiting: number;
  // Turn animation: angle progress 0..1 once the car enters the intersection box.
  turnProgress: number;
}

export const TICK_MS = 100;
export const ticksToSeconds = (t: number) => (t * TICK_MS) / 1000;

export interface SimMetrics {
  step: number;
  totalPassed: number;
  avgWait: number;
  currentWait: number;
  currentQueue: number;
  switches: number;
  reward: number;
  epsilon: number;
  qStates: number;
  phaseLabel: string;
}

export interface SimConfig {
  spawnRate: { N: number; S: number; E: number; W: number };
  turnMix: { straight: number; left: number; right: number };
  carSpeed: number;
  decisionEvery: number;
  minPhaseTicks: number;
  yellowTicks: number;
}

export const defaultSimConfig: SimConfig = {
  spawnRate: { N: 0.22, S: 0.18, E: 0.28, W: 0.16 },
  turnMix: { straight: 0.7, left: 0.15, right: 0.15 },
  carSpeed: 0.011,
  decisionEvery: 20,
  minPhaseTicks: 40,
  yellowTicks: 12,
};

const ACCEL = 0.0009;
const DECEL = 0.0018;
const MIN_GAP = 0.075;

const STOP_LINE = 0.40;
const ENTER_LINE = 0.45;   // car crosses into the intersection box
const EXIT_LINE = 0.60;    // car has cleared the intersection box

export type Phase = 0 | 1 | 2 | 3;

export class TrafficSim {
  cars: Car[] = [];
  phase: Phase = 0;
  yellow = false;
  yellowCounter = 0;
  phaseTicks = 0;
  step = 0;
  totalPassed = 0;
  totalWaitAccum = 0;
  passedCount = 0;
  switches = 0;
  cfg: SimConfig;
  agent: QLearningAgent;
  private nextId = 1;

  private prevState: string | null = null;
  private prevAction: QAction | null = null;

  mode: "rl" | "fixed" = "rl";
  fixedPhaseLen = 70;

  constructor(agent: QLearningAgent, cfg: Partial<SimConfig> = {}) {
    this.agent = agent;
    this.cfg = { ...defaultSimConfig, ...cfg };
  }

  reset() {
    this.cars = [];
    this.phase = 0;
    this.yellow = false;
    this.yellowCounter = 0;
    this.phaseTicks = 0;
    this.step = 0;
    this.totalPassed = 0;
    this.totalWaitAccum = 0;
    this.passedCount = 0;
    this.switches = 0;
    this.prevState = null;
    this.prevAction = null;
    this.nextId = 1;
  }

  private pickTurn(): Turn {
    const r = Math.random();
    const { straight, left } = this.cfg.turnMix;
    if (r < straight) return "straight";
    if (r < straight + left) return "left";
    return "right";
  }

  private spawn() {
    (Object.keys(this.cfg.spawnRate) as Direction[]).forEach((d) => {
      if (Math.random() < this.cfg.spawnRate[d]) {
        const inLane = this.cars.filter((c) => c.dir === d).length;
        if (inLane < 16) {
          const last = this.cars
            .filter((c) => c.dir === d)
            .reduce((m, c) => Math.min(m, c.pos), 1);
          if (last > MIN_GAP) {
            this.cars.push({
              id: this.nextId++,
              dir: d,
              turn: this.pickTurn(),
              pos: 0,
              vel: this.cfg.carSpeed * 0.6,
              waiting: 0,
              turnProgress: 0,
            });
          }
        }
      }
    });
  }

  // Can this car proceed past the stop line right now?
  private canGo(car: Car): boolean {
    if (this.yellow) return false;
    const ns = car.dir === "N" || car.dir === "S";
    const ew = car.dir === "E" || car.dir === "W";
    // Right turn on red is NOT allowed in this sim — only when own straight is green.
    if (car.turn === "right" || car.turn === "straight") {
      if (this.phase === 0 && ns) return true;
      if (this.phase === 2 && ew) return true;
      return false;
    }
    // Left turn — only on dedicated arrow phase
    if (this.phase === 1 && ns) return true;
    if (this.phase === 3 && ew) return true;
    return false;
  }

  private moveCars() {
    const carsByLane = new Map<Direction, Car[]>();
    (["N", "S", "E", "W"] as Direction[]).forEach((d) =>
      carsByLane.set(
        d,
        this.cars.filter((c) => c.dir === d).sort((a, b) => b.pos - a.pos)
      )
    );

    const survivors: Car[] = [];
    for (const d of ["N", "S", "E", "W"] as Direction[]) {
      const lane = carsByLane.get(d)!;
      let frontPos = 1.3;
      let frontVel = this.cfg.carSpeed;

      for (const car of lane) {
        const followCap = frontPos - MIN_GAP;
        const lightCap = !this.canGo(car) && car.pos < STOP_LINE ? STOP_LINE : 1.3;
        const cap = Math.min(followCap, lightCap);

        const distToCap = cap - car.pos;
        const stopDist = (car.vel * car.vel) / (2 * DECEL);
        let targetVel: number;
        if (distToCap <= 0.001) {
          targetVel = 0;
        } else if (stopDist >= distToCap - 0.005) {
          targetVel = Math.max(0, car.vel - DECEL);
        } else {
          // Slow down a bit while turning through the box
          const cruise =
            car.pos > ENTER_LINE && car.pos < EXIT_LINE && car.turn !== "straight"
              ? this.cfg.carSpeed * 0.6
              : this.cfg.carSpeed;
          targetVel = Math.min(cruise, car.vel + ACCEL);
        }
        if (followCap - car.pos < MIN_GAP * 1.5) {
          targetVel = Math.min(targetVel, frontVel);
        }
        car.vel = targetVel;

        const next = Math.min(car.pos + car.vel, cap);
        car.pos = next;

        // Update turn animation progress while inside the intersection box
        if (car.turn !== "straight") {
          if (car.pos > ENTER_LINE && car.pos < EXIT_LINE) {
            car.turnProgress = Math.min(
              1,
              (car.pos - ENTER_LINE) / (EXIT_LINE - ENTER_LINE)
            );
          } else if (car.pos >= EXIT_LINE) {
            car.turnProgress = 1;
          }
        }

        if (car.vel < this.cfg.carSpeed * 0.15) {
          car.waiting += 1;
        }

        if (car.pos < 1.1) {
          survivors.push(car);
          frontPos = car.pos;
          frontVel = car.vel;
        } else {
          this.totalPassed += 1;
          this.totalWaitAccum += car.waiting;
          this.passedCount += 1;
        }
      }
    }
    this.cars = survivors;
  }

  private queueSnapshot(): QueueSnapshot {
    const q: QueueSnapshot = {
      Ns: 0, Ss: 0, Es: 0, Ws: 0,
      Nl: 0, Sl: 0, El: 0, Wl: 0,
    };
    for (const c of this.cars) {
      if (c.pos >= STOP_LINE) continue;
      const isLeft = c.turn === "left";
      if (c.dir === "N") isLeft ? q.Nl++ : q.Ns++;
      else if (c.dir === "S") isLeft ? q.Sl++ : q.Ss++;
      else if (c.dir === "E") isLeft ? q.El++ : q.Es++;
      else if (c.dir === "W") isLeft ? q.Wl++ : q.Ws++;
    }
    return q;
  }

  private totalWaitingNow(): number {
    let w = 0;
    for (const c of this.cars) if (c.pos < STOP_LINE) w += 1;
    return w;
  }

  private requestSwitch() {
    if (this.yellow) return;
    if (this.phaseTicks < this.cfg.minPhaseTicks) return;
    this.yellow = true;
    this.yellowCounter = this.cfg.yellowTicks;
    this.switches += 1;
  }

  phaseLabel(): string {
    if (this.yellow) return "YELLOW";
    switch (this.phase) {
      case 0: return "N–S STRAIGHT";
      case 1: return "N–S LEFT ARROW";
      case 2: return "E–W STRAIGHT";
      case 3: return "E–W LEFT ARROW";
    }
  }

  tick() {
    this.step += 1;
    this.phaseTicks += 1;
    this.spawn();

    if (this.yellow) {
      this.yellowCounter -= 1;
      if (this.yellowCounter <= 0) {
        this.phase = ((this.phase + 1) % 4) as Phase;
        this.yellow = false;
        this.phaseTicks = 0;
      }
    }

    this.moveCars();

    if (this.mode === "fixed") {
      // Shorter time on left-arrow phases (lower demand)
      const target =
        this.phase === 1 || this.phase === 3
          ? Math.round(this.fixedPhaseLen * 0.45)
          : this.fixedPhaseLen;
      if (!this.yellow && this.phaseTicks >= target) this.requestSwitch();
      return;
    }

    if (this.step % this.cfg.decisionEvery === 0) {
      const queues = this.queueSnapshot();
      const state = encodeState(queues, this.phase);
      const waitNow = this.totalWaitingNow();

      if (this.prevState !== null && this.prevAction !== null) {
        const reward = -waitNow - (this.prevAction === 1 ? 0.5 : 0);
        this.agent.update(this.prevState, this.prevAction, reward, state);
      }

      const action = this.agent.selectAction(state);
      if (action === 1) this.requestSwitch();

      this.prevState = state;
      this.prevAction = action;
    }
  }

  getMetrics(): SimMetrics {
    const avgWait = this.passedCount > 0 ? this.totalWaitAccum / this.passedCount : 0;
    const waitingCars = this.cars.filter((c) => c.pos < STOP_LINE);
    const currentWait =
      waitingCars.length > 0
        ? waitingCars.reduce((s, c) => s + c.waiting, 0) / waitingCars.length
        : 0;
    return {
      step: this.step,
      totalPassed: this.totalPassed,
      avgWait,
      currentWait,
      currentQueue: waitingCars.length,
      switches: this.switches,
      reward: this.agent.totalReward,
      epsilon: this.agent.cfg.epsilon,
      qStates: this.agent.stateCount,
      phaseLabel: this.phaseLabel(),
    };
  }
}
