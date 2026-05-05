import type { WorkoutEntry } from '../context/GameContext';

/** Stable key for matching saved exercises on this plan (name-first; photo fallback). */
export function exercisePrKey(name: string, imageUri?: string): string | null {
  const n = name.trim().toLowerCase();
  if (n.length > 0) return `n:${n}`;
  const uri = imageUri?.trim();
  if (uri && uri.length > 8) return `p:${uri.slice(-32)}`;
  return null;
}

function calendarMonthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, '0')}`;
}

export type MonthlyBestSet = { weight: number; reps: number; score: number };

/** Best weight×reps set this calendar month on the given plan for this exercise key. */
export function bestSetThisMonthOnPlan(
  workouts: WorkoutEntry[],
  planId: string,
  exerciseKey: string,
  now: Date = new Date()
): MonthlyBestSet | null {
  const ym = `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, '0')}`;
  let best: MonthlyBestSet | null = null;

  for (const w of workouts) {
    if (w.planId !== planId) continue;
    if (calendarMonthKey(w.at) !== ym) continue;
    for (const ex of w.exercises) {
      const ek = exercisePrKey(ex.name, ex.imageUri);
      if (ek !== exerciseKey) continue;
      for (const s of ex.sets) {
        if (s.weight <= 0 || s.reps <= 0) continue;
        const score = s.weight * s.reps;
        if (
          !best ||
          score > best.score ||
          (score === best.score && s.weight > best.weight) ||
          (score === best.score && s.weight === best.weight && s.reps > best.reps)
        ) {
          best = { weight: s.weight, reps: s.reps, score };
        }
      }
    }
  }
  return best;
}

export function formatSessionDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  if (m < 60) return `${m}:${`${rs}`.padStart(2, '0')}`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h}h ${rm}m`;
}
