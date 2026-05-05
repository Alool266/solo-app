import type { ExerciseEntry, WorkoutEntry } from '../context/GameContext';
import { exercisePrKey } from './workoutPr';

/** Same ISO week label as GameContext (UTC-based week number). */
export function isoWeekKey(d: Date): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((+t - +yearStart) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${week}`;
}

export function parseIsoWeekKey(key: string): { year: number; week: number } | null {
  const m = /^(\d{4})-W(\d{1,2})$/.exec(key.trim());
  if (!m) return null;
  return { year: Number(m[1]), week: Number(m[2]) };
}

export function compareIsoWeekKeys(a: string, b: string): number {
  const pa = parseIsoWeekKey(a);
  const pb = parseIsoWeekKey(b);
  if (!pa || !pb) return a.localeCompare(b);
  if (pa.year !== pb.year) return pa.year - pb.year;
  return pa.week - pb.week;
}

/** Walk calendar days backward until we have `count` distinct ISO week keys (chronological). */
export function lastDistinctIsoWeekKeys(count: number): string[] {
  const seen = new Set<string>();
  const keys: string[] = [];
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  for (let guard = 0; guard < 500 && keys.length < count; guard++) {
    const k = isoWeekKey(new Date(d));
    if (!seen.has(k)) {
      seen.add(k);
      keys.push(k);
    }
    d.setDate(d.getDate() - 1);
  }
  keys.sort(compareIsoWeekKeys);
  return keys;
}

export function workoutVolumeKg(exercises: ExerciseEntry[]): number {
  let v = 0;
  for (const ex of exercises) {
    for (const s of ex.sets) {
      v += Math.max(0, s.weight) * Math.max(0, s.reps);
    }
  }
  return v;
}

export type WeekVolumePoint = {
  weekKey: string;
  /** Short label e.g. W19 */
  label: string;
  volumeKg: number;
};

export function weeklyVolumeSeries(workouts: WorkoutEntry[], numWeeks: number): WeekVolumePoint[] {
  const keys = lastDistinctIsoWeekKeys(numWeeks);
  const vol = new Map<string, number>();
  for (const w of workouts) {
    const k = isoWeekKey(new Date(w.at));
    const add = workoutVolumeKg(w.exercises);
    vol.set(k, (vol.get(k) ?? 0) + add);
  }
  return keys.map((weekKey) => {
    const p = parseIsoWeekKey(weekKey);
    return {
      weekKey,
      label: p ? `W${p.week}` : weekKey,
      volumeKg: vol.get(weekKey) ?? 0,
    };
  });
}

/** Local calendar day YYYY-MM-DD for streak math. */
export function localDayKeyFromIso(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Consecutive calendar days with ≥1 workout, counting backward from the
 * most recent day that has a session (today does not break if you trained yesterday).
 */
export function trainingDayStreak(workouts: WorkoutEntry[]): number {
  const days = new Set(workouts.map((w) => localDayKeyFromIso(w.at)));
  if (days.size === 0) return 0;
  const sorted = [...days].sort();
  const last = sorted[sorted.length - 1]!;
  let cursor = parseDayKey(last);
  let count = 0;
  while (days.has(formatDayKey(cursor))) {
    count++;
    cursor = addLocalDays(cursor, -1);
  }
  return count;
}

type Ymd = { y: number; m: number; d: number };

function parseDayKey(key: string): Ymd {
  const [y, m, d] = key.split('-').map((x) => Number(x));
  return { y, m: m || 1, d: d || 1 };
}

function formatDayKey(ymd: Ymd): string {
  const m = `${ymd.m}`.padStart(2, '0');
  const d = `${ymd.d}`.padStart(2, '0');
  return `${ymd.y}-${m}-${d}`;
}

function addLocalDays(ymd: Ymd, delta: number): Ymd {
  const dt = new Date(ymd.y, ymd.m - 1, ymd.d + delta);
  return { y: dt.getFullYear(), m: dt.getMonth() + 1, d: dt.getDate() };
}

export type PrTimelineEvent = {
  at: string;
  exerciseLabel: string;
  weight: number;
  reps: number;
  score: number;
};

/** New best weight×reps per exercise identity, chronological scan; returned newest-first. */
export function buildPrTimeline(workouts: WorkoutEntry[], limit = 30): PrTimelineEvent[] {
  const chronological = [...workouts].sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()
  );
  const bestByKey = new Map<string, number>();
  const events: PrTimelineEvent[] = [];

  for (const w of chronological) {
    for (const ex of w.exercises) {
      const ek = exercisePrKey(ex.name, ex.imageUri);
      if (!ek) continue;
      for (const s of ex.sets) {
        if (s.weight <= 0 || s.reps <= 0) continue;
        const score = s.weight * s.reps;
        const prev = bestByKey.get(ek) ?? 0;
        if (score > prev) {
          bestByKey.set(ek, score);
          events.push({
            at: w.at,
            exerciseLabel: ex.name.trim(),
            weight: s.weight,
            reps: s.reps,
            score,
          });
        }
      }
    }
  }

  return events.slice(-limit).reverse();
}
