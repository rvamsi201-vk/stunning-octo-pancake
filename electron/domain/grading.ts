export interface ScoreScenario { finalExam: number; quiz1: number; quiz2: number; bonus?: number }

export function calculateBaseT({ finalExam: f, quiz1: q1, quiz2: q2 }: ScoreScenario) {
  const first = 0.6 * f + 0.3 * Math.max(q1, q2);
  const second = 0.45 * f + 0.25 * q1 + 0.3 * q2;
  return Math.round(Math.max(first, second) * 100) / 100;
}
