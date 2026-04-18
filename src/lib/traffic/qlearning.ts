// Tabular Q-learning agent for traffic light control.
// State = discretized queue lengths per direction (straight + left) + current phase.
// Actions = { 0: keep current phase, 1: switch to next phase }.
// Reward = - (sum of waiting cars) - small penalty for switching.

export type QState = string;
export type QAction = 0 | 1;

export interface QLearningConfig {
  alpha: number;
  gamma: number;
  epsilon: number;
  epsilonMin: number;
  epsilonDecay: number;
}

export const defaultQConfig: QLearningConfig = {
  alpha: 0.1,
  gamma: 0.9,
  epsilon: 1.0,
  epsilonMin: 0.05,
  epsilonDecay: 0.9995,
};

export class QLearningAgent {
  private q: Map<QState, [number, number]> = new Map();
  cfg: QLearningConfig;
  episodes = 0;
  totalReward = 0;
  lastReward = 0;
  lastTDError = 0;

  constructor(cfg: Partial<QLearningConfig> = {}) {
    this.cfg = { ...defaultQConfig, ...cfg };
  }

  private getQ(s: QState): [number, number] {
    let v = this.q.get(s);
    if (!v) {
      v = [0, 0];
      this.q.set(s, v);
    }
    return v;
  }

  selectAction(s: QState): QAction {
    if (Math.random() < this.cfg.epsilon) {
      return (Math.random() < 0.5 ? 0 : 1) as QAction;
    }
    const [q0, q1] = this.getQ(s);
    return (q1 > q0 ? 1 : 0) as QAction;
  }

  update(s: QState, a: QAction, r: number, sNext: QState) {
    const qsa = this.getQ(s);
    const qNext = this.getQ(sNext);
    const maxNext = Math.max(qNext[0], qNext[1]);
    const target = r + this.cfg.gamma * maxNext;
    const tdError = target - qsa[a];
    qsa[a] = qsa[a] + this.cfg.alpha * tdError;
    this.lastTDError = tdError;
    this.lastReward = r;
    this.totalReward += r;
    this.cfg.epsilon = Math.max(
      this.cfg.epsilonMin,
      this.cfg.epsilon * this.cfg.epsilonDecay
    );
  }

  reset() {
    this.q.clear();
    this.episodes = 0;
    this.totalReward = 0;
    this.lastReward = 0;
    this.lastTDError = 0;
    this.cfg = { ...defaultQConfig };
  }

  get stateCount() {
    return this.q.size;
  }
}

// Coarser bins so 8-dimensional state stays tractable (3^8 * 4 ~= 26k).
export function bin(n: number): number {
  if (n <= 0) return 0;
  if (n <= 3) return 1;
  return 2;
}

export interface QueueSnapshot {
  Ns: number; Ss: number; Es: number; Ws: number; // straight queues
  Nl: number; Sl: number; El: number; Wl: number; // left-turn queues
}

export function encodeState(q: QueueSnapshot, phase: 0 | 1 | 2 | 3): QState {
  return `${bin(q.Ns)}${bin(q.Ss)}${bin(q.Es)}${bin(q.Ws)}${bin(q.Nl)}${bin(q.Sl)}${bin(q.El)}${bin(q.Wl)}-${phase}`;
}
