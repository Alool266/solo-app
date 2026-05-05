import type { DungeonId } from '../constants/dungeons';
import { normalizeEquipmentTags, type EquipmentTagId } from '../constants/equipmentTags';
import { Rank, ranks } from '../constants/theme';
import i18n from '../i18n/config';
import { genId } from '../utils/id';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

const STORAGE_KEYS = ['gym-solo-state-v3', 'gym-solo-state-v2', 'gym-solo-state-v1'] as const;
const SAVE_KEY = 'gym-solo-state-v3';

export type SystemMessage =
  | { legacy: string }
  | { key: string; params?: Record<string, string | number> };

export type Gate = { id: string; xp: number; done: boolean };

export type SetEntry = {
  id: string;
  weight: number;
  reps: number;
  rpe?: number;
};

export type ExerciseEntry = {
  id: string;
  name: string;
  /** Optional photo: native file URI under documentDirectory, or web data URL (base64). */
  imageUri?: string;
  sets: SetEntry[];
};

/** Saved exercise (name + optional photo) to reuse when logging workouts. */
export type MyExercise = {
  id: string;
  name: string;
  imageUri?: string;
};

/** Named workout page (e.g. Leg day) — opens its own logger + history. */
export type WorkoutPlan = {
  id: string;
  title: string;
  createdAt: string;
  /** Gym / travel context chips for this page (optional). */
  equipmentTags?: EquipmentTagId[];
};

export type WorkoutEntry = {
  id: string;
  title: string;
  notes: string;
  exercises: ExerciseEntry[];
  xpEarned: number;
  at: string;
  planId?: string;
  /** Saved when logging so history stays readable if the plan is deleted. */
  planTitleSnapshot?: string;
  /** Session duration when saved (seconds). */
  durationSec?: number;
};

export type WeeklyBoss = {
  cleared: boolean;
  titleKey: string;
  detailKey: string;
};

export type WeeklyGoalMode = 'sessions' | 'manual';

export type WeeklyGoal = {
  label: string;
  target: number;
  progress: number;
  mode: WeeklyGoalMode;
  weekKey: string;
};

export type LogWorkoutPayload = {
  title: string;
  notes: string;
  exercises: ExerciseEntry[];
  planId?: string;
  planTitleSnapshot?: string;
  durationSec?: number;
};

type PersistedState = {
  onboarded: boolean;
  playerName: string;
  rankIndex: number;
  level: number;
  xp: number;
  stats: { str: number; end: number; disc: number; rec: number };
  fatigue: number;
  activeDungeonId: DungeonId;
  dungeonWeek: number;
  gates: Gate[];
  lastGateDate: string;
  weeklyBoss: WeeklyBoss;
  weekKey: string;
  weeklyGoal: WeeklyGoal;
  systemMessages: SystemMessage[];
  workouts: WorkoutEntry[];
  myExercises: MyExercise[];
  workoutPlans: WorkoutPlan[];
};

const defaultGates = (): Gate[] => [
  { id: 'mobility', xp: 15, done: false },
  { id: 'protein', xp: 20, done: false },
  { id: 'walk', xp: 10, done: false },
  { id: 'accessory', xp: 25, done: false },
];

function defaultBoss(): WeeklyBoss {
  return {
    cleared: false,
    titleKey: 'profile.bossDefaultTitle',
    detailKey: 'profile.bossDefaultDetail',
  };
}

function defaultWeeklyGoal(nowKey: string): WeeklyGoal {
  return {
    label: '',
    target: 3,
    progress: 0,
    mode: 'sessions',
    weekKey: nowKey,
  };
}

function defaultFeed(): SystemMessage[] {
  return [{ key: 'feed.contractInit' }, { key: 'feed.gatesRefresh' }];
}

function isoWeekKey(d: Date): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((+t - +yearStart) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${week}`;
}

function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function xpForLevel(level: number): number {
  return Math.round(80 + level * 35 + level * level * 4);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function migrateBoss(raw: unknown): WeeklyBoss {
  if (raw && typeof raw === 'object') {
    const o = raw as WeeklyBoss & { title?: string };
    if (typeof o.titleKey === 'string' && typeof o.detailKey === 'string') {
      return {
        cleared: !!o.cleared,
        titleKey: o.titleKey,
        detailKey: o.detailKey,
      };
    }
    if (typeof o.title === 'string') {
      return { cleared: !!o.cleared, ...defaultBoss() };
    }
  }
  return defaultBoss();
}

function migrateMessages(raw: unknown): SystemMessage[] {
  if (!Array.isArray(raw)) return defaultFeed();
  const out: SystemMessage[] = [];
  for (const x of raw) {
    if (typeof x === 'string') out.push({ legacy: x });
    else if (x && typeof x === 'object') {
      const o = x as SystemMessage;
      if ('legacy' in o && typeof o.legacy === 'string') out.push(o);
      else if ('key' in o && typeof o.key === 'string') out.push(o);
      else out.push({ legacy: JSON.stringify(x) });
    }
  }
  return out.length ? out : defaultFeed();
}

function migrateSet(raw: unknown): SetEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Partial<SetEntry>;
  if (typeof o.id !== 'string') return null;
  return {
    id: o.id,
    weight: typeof o.weight === 'number' && !Number.isNaN(o.weight) ? o.weight : 0,
    reps: typeof o.reps === 'number' && !Number.isNaN(o.reps) ? o.reps : 0,
    rpe:
      typeof o.rpe === 'number' && !Number.isNaN(o.rpe)
        ? clamp(o.rpe, 1, 10)
        : undefined,
  };
}

function migrateMyExercise(raw: unknown): MyExercise | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Partial<MyExercise>;
  if (typeof o.id !== 'string') return null;
  const name = typeof o.name === 'string' ? o.name : '';
  const imageUri =
    typeof o.imageUri === 'string' && o.imageUri.trim().length > 0 ? o.imageUri.trim() : undefined;
  if (!name.trim() && !imageUri) return null;
  return imageUri ? { id: o.id, name, imageUri } : { id: o.id, name };
}

function migrateMyExercises(raw: unknown): MyExercise[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(migrateMyExercise).filter((x): x is MyExercise => Boolean(x)).slice(0, 40);
}

function migrateWorkoutPlan(raw: unknown): WorkoutPlan | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Partial<WorkoutPlan>;
  if (typeof o.id !== 'string') return null;
  const title = typeof o.title === 'string' ? o.title.trim() : '';
  if (!title) return null;
  const createdAt =
    typeof o.createdAt === 'string' && o.createdAt.length > 0
      ? o.createdAt
      : new Date().toISOString();
  const equipmentTags = normalizeEquipmentTags(o.equipmentTags);
  return {
    id: o.id,
    title,
    createdAt,
    ...(equipmentTags.length ? { equipmentTags } : {}),
  };
}

function migrateWorkoutPlans(raw: unknown): WorkoutPlan[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(migrateWorkoutPlan).filter((x): x is WorkoutPlan => Boolean(x)).slice(0, 30);
}

function migrateExercise(raw: unknown): ExerciseEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Partial<ExerciseEntry>;
  if (typeof o.id !== 'string' || typeof o.name !== 'string') return null;
  const setsRaw = Array.isArray(o.sets) ? o.sets : [];
  const sets = setsRaw.map(migrateSet).filter((s): s is SetEntry => Boolean(s));
  const imageUri =
    typeof o.imageUri === 'string' && o.imageUri.trim().length > 0 ? o.imageUri.trim() : undefined;
  return imageUri ? { id: o.id, name: o.name, imageUri, sets } : { id: o.id, name: o.name, sets };
}

function migrateWorkout(raw: unknown): WorkoutEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Partial<WorkoutEntry>;
  if (typeof o.id !== 'string' || typeof o.title !== 'string') return null;
  const exercisesRaw = Array.isArray(o.exercises) ? o.exercises : [];
  const exercises = exercisesRaw.map(migrateExercise).filter((e): e is ExerciseEntry => Boolean(e));
  const planId =
    typeof o.planId === 'string' && o.planId.trim().length > 0 ? o.planId.trim() : undefined;
  const planTitleSnapshot =
    typeof o.planTitleSnapshot === 'string' && o.planTitleSnapshot.trim().length > 0
      ? o.planTitleSnapshot.trim()
      : undefined;
  const durationSecRaw = o.durationSec;
  const durationSec =
    typeof durationSecRaw === 'number' &&
    !Number.isNaN(durationSecRaw) &&
    durationSecRaw >= 0 &&
    durationSecRaw <= 86400
      ? Math.round(durationSecRaw)
      : undefined;
  return {
    id: o.id,
    title: o.title,
    notes: typeof o.notes === 'string' ? o.notes : '',
    exercises,
    xpEarned: typeof o.xpEarned === 'number' ? o.xpEarned : 0,
    at: typeof o.at === 'string' ? o.at : new Date().toISOString(),
    ...(planId ? { planId } : {}),
    ...(planTitleSnapshot ? { planTitleSnapshot } : {}),
    ...(durationSec !== undefined ? { durationSec } : {}),
  };
}

function migrateWorkouts(raw: unknown): WorkoutEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(migrateWorkout).filter((w): w is WorkoutEntry => Boolean(w));
}

function migrateWeeklyGoal(raw: unknown, weekNow: string): WeeklyGoal {
  const base = defaultWeeklyGoal(weekNow);
  if (!raw || typeof raw !== 'object') return base;
  const o = raw as Partial<WeeklyGoal>;
  const mode = o.mode === 'manual' ? 'manual' : 'sessions';
  const target =
    typeof o.target === 'number' && o.target >= 1 ? Math.round(o.target) : base.target;
  let progress =
    typeof o.progress === 'number' && !Number.isNaN(o.progress)
      ? clamp(Math.round(o.progress), 0, target)
      : 0;
  const storedWeek = typeof o.weekKey === 'string' ? o.weekKey : weekNow;
  if (storedWeek !== weekNow) progress = 0;
  return {
    label: typeof o.label === 'string' ? o.label : '',
    target,
    progress,
    mode,
    weekKey: weekNow,
  };
}

function migrateGates(raw: unknown): Gate[] {
  const ids = ['mobility', 'protein', 'walk', 'accessory'];
  if (!Array.isArray(raw)) return defaultGates();
  const mapped = raw
    .filter((g): g is Gate =>
      Boolean(g && typeof g === 'object' && typeof (g as Gate).id === 'string')
    )
    .map((g) => ({
      id: g.id,
      xp: typeof g.xp === 'number' ? g.xp : 15,
      done: !!g.done,
    }))
    .filter((g) => ids.includes(g.id));
  if (mapped.length < 4) return defaultGates();
  return mapped;
}

function isDungeonId(v: unknown): v is DungeonId {
  return v === 'volume' || v === 'spire' || v === 'labyrinth' || v === 'ruins';
}

function migratePersisted(parsed: Partial<PersistedState>): PersistedState {
  const weekNow = isoWeekKey(new Date());
  const base = initialPersisted();
  return {
    onboarded: typeof parsed.onboarded === 'boolean' ? parsed.onboarded : base.onboarded,
    playerName:
      typeof parsed.playerName === 'string' && parsed.playerName.trim()
        ? parsed.playerName
        : base.playerName,
    rankIndex:
      typeof parsed.rankIndex === 'number'
        ? clamp(parsed.rankIndex, 0, ranks.length - 1)
        : base.rankIndex,
    level: typeof parsed.level === 'number' ? Math.max(1, parsed.level) : base.level,
    xp: typeof parsed.xp === 'number' ? Math.max(0, parsed.xp) : base.xp,
    stats: {
      str: clamp(typeof parsed.stats?.str === 'number' ? parsed.stats.str : base.stats.str, 4, 99),
      end: clamp(typeof parsed.stats?.end === 'number' ? parsed.stats.end : base.stats.end, 4, 99),
      disc: clamp(typeof parsed.stats?.disc === 'number' ? parsed.stats.disc : base.stats.disc, 4, 99),
      rec: clamp(typeof parsed.stats?.rec === 'number' ? parsed.stats.rec : base.stats.rec, 4, 99),
    },
    fatigue:
      typeof parsed.fatigue === 'number'
        ? clamp(parsed.fatigue, 0, 100)
        : base.fatigue,
    activeDungeonId: isDungeonId(parsed.activeDungeonId)
      ? parsed.activeDungeonId
      : base.activeDungeonId,
    dungeonWeek:
      typeof parsed.dungeonWeek === 'number' ? Math.max(1, parsed.dungeonWeek) : base.dungeonWeek,
    gates: migrateGates(parsed.gates),
    lastGateDate: typeof parsed.lastGateDate === 'string' ? parsed.lastGateDate : base.lastGateDate,
    weeklyBoss: migrateBoss(parsed.weeklyBoss),
    weekKey: typeof parsed.weekKey === 'string' ? parsed.weekKey : base.weekKey,
    weeklyGoal: migrateWeeklyGoal(parsed.weeklyGoal, weekNow),
    systemMessages: migrateMessages(parsed.systemMessages),
    workouts: migrateWorkouts(parsed.workouts),
    myExercises: migrateMyExercises(parsed.myExercises),
    workoutPlans: migrateWorkoutPlans(parsed.workoutPlans),
  };
}

function countSets(exercises: ExerciseEntry[]): number {
  return exercises.reduce((acc, ex) => acc + ex.sets.length, 0);
}

function volumeScore(exercises: ExerciseEntry[]): number {
  let v = 0;
  for (const ex of exercises) {
    for (const s of ex.sets) {
      v += Math.max(0, s.weight) * Math.max(0, s.reps);
    }
  }
  return v;
}

function computeWorkoutXp(exercises: ExerciseEntry[]): number {
  const sets = countSets(exercises);
  const vol = volumeScore(exercises);
  const base = sets === 0 ? 32 : 42;
  return Math.round(base + sets * 6 + Math.min(vol / 90, 48) + Math.random() * 14);
}

const initialPersisted = (): PersistedState => {
  const wk = isoWeekKey(new Date());
  return {
    onboarded: false,
    playerName: 'Hunter',
    rankIndex: 0,
    level: 1,
    xp: 0,
    stats: { str: 8, end: 8, disc: 10, rec: 9 },
    fatigue: 12,
    activeDungeonId: 'volume',
    dungeonWeek: 1,
    gates: defaultGates(),
    lastGateDate: todayKey(),
    weeklyBoss: defaultBoss(),
    weekKey: wk,
    weeklyGoal: defaultWeeklyGoal(wk),
    systemMessages: defaultFeed(),
    workouts: [],
    myExercises: [],
    workoutPlans: [],
  };
};

type GameContextValue = PersistedState & {
  hydrated: boolean;
  rank: Rank;
  xpToNext: number;
  pushMessage: (msg: SystemMessage) => void;
  completeOnboarding: (name: string) => void;
  toggleGate: (id: string) => void;
  enterDungeon: (dungeonId: DungeonId) => void;
  advanceFloor: () => void;
  logWorkout: (payload: LogWorkoutPayload) => void;
  clearBoss: () => void;
  restRecovery: () => void;
  resetDemo: () => void;
  configureWeeklyGoal: (label: string, target: number, mode: WeeklyGoalMode) => void;
  bumpWeeklyGoalManual: (delta: number) => void;
  getLastWorkoutTemplate: () => LogWorkoutPayload | null;
  getLastWorkoutForPlan: (planId: string) => LogWorkoutPayload | null;
  addWorkoutPlan: (title: string, equipmentTags?: EquipmentTagId[]) => string | null;
  updateWorkoutPlanEquipmentTags: (planId: string, tags: EquipmentTagId[]) => void;
  removeWorkoutPlan: (planId: string) => void;
  exportBackupJson: () => string;
  importBackupJson: (json: string) => { ok: true } | { ok: false; error: string };
  addMyExercise: (payload: { name: string; imageUri?: string }) => void;
  removeMyExercise: (id: string) => void;
};

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [state, setState] = useState<PersistedState>(initialPersisted);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let raw: string | null = null;
        for (const key of STORAGE_KEYS) {
          raw = await AsyncStorage.getItem(key);
          if (raw) break;
        }
        if (cancelled) return;
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<PersistedState>;
          setState(migratePersisted(parsed));
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(SAVE_KEY, JSON.stringify(state)).catch(() => {});
  }, [state, hydrated]);

  const rollWeekAndMaybeResetBoss = useCallback((s: PersistedState): PersistedState => {
    const wk = isoWeekKey(new Date());
    if (s.weekKey === wk) return s;
    return {
      ...s,
      weekKey: wk,
      weeklyBoss: { ...defaultBoss(), cleared: false },
      weeklyGoal: {
        ...s.weeklyGoal,
        weekKey: wk,
        progress: 0,
      },
      systemMessages: [{ key: 'feed.newWeek', params: { week: wk } }, ...s.systemMessages].slice(
        0,
        40
      ),
    };
  }, []);

  const rollDailyGates = useCallback((s: PersistedState): PersistedState => {
    const t = todayKey();
    if (s.lastGateDate === t) return s;
    return {
      ...s,
      lastGateDate: t,
      gates: defaultGates(),
      systemMessages: [
        { key: 'feed.gatesResetDay', params: { date: t } },
        ...s.systemMessages,
      ].slice(0, 40),
    };
  }, []);

  const reconcile = useCallback(
    (fn: (prev: PersistedState) => PersistedState) => {
      setState((prev) => rollDailyGates(rollWeekAndMaybeResetBoss(fn(prev))));
    },
    [rollDailyGates, rollWeekAndMaybeResetBoss]
  );

  const pushMessage = useCallback(
    (msg: SystemMessage) => {
      reconcile((prev) => ({
        ...prev,
        systemMessages: [msg, ...prev.systemMessages].slice(0, 40),
      }));
    },
    [reconcile]
  );

  const completeOnboarding = useCallback(
    (name: string) => {
      const trimmed = name.trim() || i18n.t('onboarding.defaultName');
      reconcile((prev) => ({
        ...prev,
        onboarded: true,
        playerName: trimmed,
        systemMessages: [
          { key: 'feed.registered', params: { name: trimmed } },
          ...prev.systemMessages,
        ].slice(0, 40),
      }));
    },
    [reconcile]
  );

  const toggleGate = useCallback(
    (id: string) => {
      reconcile((prev) => {
        const before = prev.gates.find((x) => x.id === id);
        const wasDone = before?.done ?? false;
        const gates = prev.gates.map((g) =>
          g.id === id ? { ...g, done: !g.done } : g
        );
        const g = gates.find((x) => x.id === id);
        const nowDone = g?.done ?? false;
        const completedNow = !wasDone && nowDone;
        let msgs = prev.systemMessages;
        if (completedNow && g) {
          msgs = [
            { key: 'feed.gateCleared', params: { gateId: g.id, xp: g.xp } },
            ...msgs,
          ].slice(0, 40);
        }
        let xpGain = 0;
        if (completedNow && g) xpGain = g.xp;

        let { level, xp, rankIndex } = prev;
        let xpPool = xp + xpGain;
        let cap = xpForLevel(level);
        while (xpPool >= cap) {
          xpPool -= cap;
          level += 1;
          cap = xpForLevel(level);
          msgs = [{ key: 'feed.levelUp', params: { level } }, ...msgs].slice(0, 40);
          if (level % 4 === 0 && rankIndex < ranks.length - 1) {
            rankIndex += 1;
            msgs = [
              { key: 'feed.rankUp', params: { rank: ranks[rankIndex] } },
              ...msgs,
            ].slice(0, 40);
          }
        }
        return {
          ...prev,
          gates,
          xp: xpPool,
          level,
          rankIndex,
          stats: {
            ...prev.stats,
            disc: completedNow ? prev.stats.disc + 1 : prev.stats.disc,
          },
          systemMessages: msgs,
        };
      });
    },
    [reconcile]
  );

  const enterDungeon = useCallback(
    (dungeonId: DungeonId) => {
      reconcile((prev) => ({
        ...prev,
        activeDungeonId: dungeonId,
        dungeonWeek: 1,
        systemMessages: [
          { key: 'feed.enteredDungeon', params: { dungeonId } },
          ...prev.systemMessages,
        ].slice(0, 40),
      }));
    },
    [reconcile]
  );

  const advanceFloor = useCallback(() => {
    reconcile((prev) => {
      const nextWeek = prev.dungeonWeek + 1;
      return {
        ...prev,
        dungeonWeek: nextWeek,
        stats: { ...prev.stats, end: prev.stats.end + 1 },
        systemMessages: [
          { key: 'feed.floorUp', params: { week: nextWeek } },
          ...prev.systemMessages,
        ].slice(0, 40),
      };
    });
  }, [reconcile]);

  const logWorkout = useCallback(
    (payload: LogWorkoutPayload) => {
      reconcile((prev) => {
        const exercises = payload.exercises;
        const gain = computeWorkoutXp(exercises);
        const sets = countSets(exercises);
        let xpPool = prev.xp + gain;
        let level = prev.level;
        let cap = xpForLevel(level);
        let msgs = prev.systemMessages;
        while (xpPool >= cap) {
          xpPool -= cap;
          level += 1;
          cap = xpForLevel(level);
          msgs = [{ key: 'feed.levelUp', params: { level } }, ...msgs].slice(0, 40);
        }
        let rankIndex = prev.rankIndex;
        if (level % 5 === 0 && rankIndex < ranks.length - 1) {
          rankIndex += 1;
          msgs = [
            { key: 'feed.rankUp', params: { rank: ranks[rankIndex] } },
            ...msgs,
          ].slice(0, 40);
        }
        const entryTitle = payload.title.trim() || i18n.t('log.defaultTitle');
        const ds = payload.durationSec;
        const durationSec =
          typeof ds === 'number' && !Number.isNaN(ds) && ds >= 0 && ds <= 86400
            ? Math.round(ds)
            : undefined;
        const entry: WorkoutEntry = {
          id: `${Date.now()}`,
          title: entryTitle,
          notes: payload.notes,
          exercises,
          xpEarned: gain,
          at: new Date().toISOString(),
          ...(payload.planId ? { planId: payload.planId } : {}),
          ...(payload.planTitleSnapshot?.trim()
            ? { planTitleSnapshot: payload.planTitleSnapshot.trim() }
            : {}),
          ...(durationSec !== undefined ? { durationSec } : {}),
        };

        const wk = isoWeekKey(new Date());
        let wg = migrateWeeklyGoal(prev.weeklyGoal, wk);
        if (wg.mode === 'sessions') {
          wg = { ...wg, progress: Math.min(wg.target, wg.progress + 1) };
        }

        const fatigueDelta = clamp(12 + sets * 2, 12, 42);

        return {
          ...prev,
          xp: xpPool,
          level,
          rankIndex,
          weeklyGoal: wg,
          fatigue: clamp(prev.fatigue + fatigueDelta, 0, 100),
          stats: {
            ...prev.stats,
            str: prev.stats.str + 1 + Math.min(3, Math.floor(sets / 4)),
            rec: clamp(prev.stats.rec - 1, 4, 40),
          },
          workouts: [entry, ...prev.workouts].slice(0, 50),
          systemMessages: [
            {
              key: 'feed.workoutLogged',
              params: { title: entryTitle, xp: gain },
            },
            ...msgs,
          ].slice(0, 40),
        };
      });
    },
    [reconcile]
  );

  const clearBoss = useCallback(() => {
    reconcile((prev) => ({
      ...prev,
      weeklyBoss: { ...prev.weeklyBoss, cleared: true },
      xp: prev.xp + 120,
      stats: { ...prev.stats, str: prev.stats.str + 2, disc: prev.stats.disc + 2 },
      systemMessages: [{ key: 'feed.bossCleared' }, ...prev.systemMessages].slice(0, 40),
    }));
  }, [reconcile]);

  const restRecovery = useCallback(() => {
    reconcile((prev) => ({
      ...prev,
      fatigue: clamp(prev.fatigue - 28, 0, 100),
      stats: { ...prev.stats, rec: prev.stats.rec + 2 },
      systemMessages: [{ key: 'feed.recovery' }, ...prev.systemMessages].slice(0, 40),
    }));
  }, [reconcile]);

  const resetDemo = useCallback(() => {
    for (const key of STORAGE_KEYS) {
      AsyncStorage.removeItem(key).catch(() => {});
    }
    setState(initialPersisted());
  }, []);

  const configureWeeklyGoal = useCallback(
    (label: string, target: number, mode: WeeklyGoalMode) => {
      reconcile((prev) => ({
        ...prev,
        weeklyGoal: {
          label: label.trim(),
          target: Math.max(1, Math.round(target)),
          progress: 0,
          mode,
          weekKey: isoWeekKey(new Date()),
        },
      }));
    },
    [reconcile]
  );

  const bumpWeeklyGoalManual = useCallback(
    (delta: number) => {
      reconcile((prev) => {
        const wk = isoWeekKey(new Date());
        let wg = migrateWeeklyGoal(prev.weeklyGoal, wk);
        if (wg.mode !== 'manual') return prev;
        wg = {
          ...wg,
          progress: clamp(wg.progress + delta, 0, wg.target),
        };
        return { ...prev, weeklyGoal: wg };
      });
    },
    [reconcile]
  );

  const getLastWorkoutTemplate = useCallback((): LogWorkoutPayload | null => {
    const w = state.workouts[0];
    if (!w) return null;
    return {
      title: w.title,
      notes: w.notes,
      exercises: w.exercises.map((ex) => ({
        id: genId(),
        name: ex.name,
        ...(ex.imageUri ? { imageUri: ex.imageUri } : {}),
        sets: ex.sets.map((s) => ({
          id: genId(),
          weight: s.weight,
          reps: s.reps,
          rpe: s.rpe,
        })),
      })),
    };
  }, [state.workouts]);

  const getLastWorkoutForPlan = useCallback(
    (planId: string): LogWorkoutPayload | null => {
      const w = state.workouts.find((x) => x.planId === planId);
      if (!w) return null;
      return {
        title: w.title,
        notes: w.notes,
        planId,
        planTitleSnapshot: w.planTitleSnapshot,
        exercises: w.exercises.map((ex) => ({
          id: genId(),
          name: ex.name,
          ...(ex.imageUri ? { imageUri: ex.imageUri } : {}),
          sets: ex.sets.map((s) => ({
            id: genId(),
            weight: s.weight,
            reps: s.reps,
            rpe: s.rpe,
          })),
        })),
      };
    },
    [state.workouts]
  );

  const addWorkoutPlan = useCallback(
    (title: string, equipmentTags?: EquipmentTagId[]): string | null => {
      const trimmed = title.trim();
      if (!trimmed) return null;
      const id = genId();
      const createdAt = new Date().toISOString();
      const tags = normalizeEquipmentTags(equipmentTags ?? []);
      reconcile((prev) => ({
        ...prev,
        workoutPlans: [
          {
            id,
            title: trimmed,
            createdAt,
            ...(tags.length ? { equipmentTags: tags } : {}),
          },
          ...prev.workoutPlans,
        ].slice(0, 30),
      }));
      return id;
    },
    [reconcile]
  );

  const updateWorkoutPlanEquipmentTags = useCallback(
    (planId: string, tags: EquipmentTagId[]) => {
      const next = normalizeEquipmentTags(tags);
      reconcile((prev) => ({
        ...prev,
        workoutPlans: prev.workoutPlans.map((p) =>
          p.id === planId
            ? { ...p, ...(next.length ? { equipmentTags: next } : { equipmentTags: undefined }) }
            : p
        ),
      }));
    },
    [reconcile]
  );

  const removeWorkoutPlan = useCallback(
    (planId: string) => {
      reconcile((prev) => ({
        ...prev,
        workoutPlans: prev.workoutPlans.filter((p) => p.id !== planId),
      }));
    },
    [reconcile]
  );

  const exportBackupJson = useCallback(() => {
    return JSON.stringify(
      {
        exportVersion: 1,
        savedAt: new Date().toISOString(),
        state: { ...state },
      },
      null,
      2
    );
  }, [state]);

  const addMyExercise = useCallback(
    (payload: { name: string; imageUri?: string }) => {
      const name = payload.name.trim();
      const imageUri = payload.imageUri?.trim();
      if (!name && !imageUri) return;
      reconcile((prev) => ({
        ...prev,
        myExercises: [
          {
            id: genId(),
            name,
            ...(imageUri ? { imageUri } : {}),
          },
          ...prev.myExercises,
        ].slice(0, 40),
      }));
    },
    [reconcile]
  );

  const removeMyExercise = useCallback(
    (id: string) => {
      reconcile((prev) => ({
        ...prev,
        myExercises: prev.myExercises.filter((x) => x.id !== id),
      }));
    },
    [reconcile]
  );

  const importBackupJson = useCallback((json: string) => {
    try {
      const parsed = JSON.parse(json) as { state?: Partial<PersistedState> } & Partial<PersistedState>;
      const inner = parsed.state ?? parsed;
      if (!inner || typeof inner !== 'object') {
        return { ok: false as const, error: 'invalid_shape' };
      }
      const next = migratePersisted(inner as Partial<PersistedState>);
      setState(next);
      return { ok: true as const };
    } catch {
      return { ok: false as const, error: 'parse_failed' };
    }
  }, []);

  const rank = ranks[state.rankIndex];
  const xpToNext = xpForLevel(state.level);

  const value = useMemo<GameContextValue>(
    () => ({
      ...state,
      hydrated,
      rank,
      xpToNext,
      pushMessage,
      completeOnboarding,
      toggleGate,
      enterDungeon,
      advanceFloor,
      logWorkout,
      clearBoss,
      restRecovery,
      resetDemo,
      configureWeeklyGoal,
      bumpWeeklyGoalManual,
      getLastWorkoutTemplate,
      getLastWorkoutForPlan,
      addWorkoutPlan,
      updateWorkoutPlanEquipmentTags,
      removeWorkoutPlan,
      exportBackupJson,
      importBackupJson,
      addMyExercise,
      removeMyExercise,
    }),
    [
      state,
      hydrated,
      rank,
      xpToNext,
      pushMessage,
      completeOnboarding,
      toggleGate,
      enterDungeon,
      advanceFloor,
      logWorkout,
      clearBoss,
      restRecovery,
      resetDemo,
      configureWeeklyGoal,
      bumpWeeklyGoalManual,
      getLastWorkoutTemplate,
      getLastWorkoutForPlan,
      addWorkoutPlan,
      updateWorkoutPlanEquipmentTags,
      removeWorkoutPlan,
      exportBackupJson,
      importBackupJson,
      addMyExercise,
      removeMyExercise,
    ]
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
