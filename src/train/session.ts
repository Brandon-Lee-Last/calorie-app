import type { components } from '../api/schema';
import type { PlanExercise, PlannedWorkout } from './library';

export type SetLog = components['schemas']['SetLog'];

/** One set as it is being done. */
export type LiveSet = { kg: number; reps: number; durationS: number; done: boolean };

/** Starting values for an exercise's sets: last time's numbers when there are any, else the plan. */
export function startSets(e: PlanExercise, last: SetLog[]): LiveSet[] {
  return Array.from({ length: e.sets }, (_, i) => {
    const prev = last.find((s) => s.setNo === i + 1) ?? last[last.length - 1];
    return {
      kg: prev?.weightKg ?? 0,
      reps: prev?.reps ?? e.repsMax ?? e.repsMin ?? 10,
      durationS: prev?.durationS ?? e.durationS ?? 30,
      done: false,
    };
  });
}

/** The sets of every exercise as the server stores them (only the ones done). */
export function toSetLogs(plan: PlannedWorkout, sets: LiveSet[][]): SetLog[] {
  return plan.exercises.flatMap((e, i) =>
    (sets[i] ?? [])
      .map((s, n) => ({ s, n }))
      .filter(({ s }) => s.done)
      .map(({ s, n }): SetLog => ({
        exercise: e.slug,
        setNo: n + 1,
        reps: e.durationS ? null : s.reps,
        weightKg: s.kg > 0 ? s.kg : null,
        durationS: e.durationS ? s.durationS : null,
      })),
  );
}

/** "16 × 12", "40 s" or "12". */
export function setText(s: SetLog | LiveSet | undefined, timed: boolean): string {
  if (!s) return '–';
  const kg = 'kg' in s ? s.kg : (s.weightKg ?? 0);
  if (timed) return `${('durationS' in s ? s.durationS : null) ?? 0} s`;
  return kg > 0 ? `${kg} × ${s.reps ?? 0}` : `${s.reps ?? 0}`;
}

export const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, Math.floor(s % 60))).padStart(2, '0')}`;

/** The plan's reps as text: "8 to 12 reps", "30 s". */
export function targetText(e: PlanExercise): string {
  if (e.durationS) return `${e.sets} × ${e.durationS} s`;
  if (e.repsMin && e.repsMax && e.repsMin !== e.repsMax) return `${e.sets} × ${e.repsMin} to ${e.repsMax}`;
  return `${e.sets} × ${e.repsMax ?? e.repsMin ?? 10}`;
}
