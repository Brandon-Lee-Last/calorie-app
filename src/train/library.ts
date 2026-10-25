import type { components } from '../api/schema';

/** One exercise in a planned workout, the same shape whether it comes from the server or the built-in library. */
export type PlanExercise = {
  slug: string;
  name: string;
  muscles: string[];
  equipment: string[];
  sets: number;
  repsMin: number | null;
  repsMax: number | null;
  /** Timed exercises (planks, stretches) have a duration instead of reps. */
  durationS: number | null;
  restS: number;
  cue: string | null;
};

export type Kind = 'strength' | 'cardio' | 'mobility';

export type PlannedWorkout = {
  key: string;
  title: string;
  minutes: number | null;
  kind: Kind;
  /** Where it is listed on Train. */
  place: 'home' | 'gym' | 'quick';
  exercises: PlanExercise[];
  /** Set for workouts from a server program. */
  workoutId: string | null;
  programId: string | null;
};

type Move = Omit<PlanExercise, 'sets' | 'repsMin' | 'repsMax' | 'durationS' | 'restS'>;

/** Exercises written for Pango. Plain descriptions, no third-party content. */
const MOVES: Record<string, Move> = {
  squat: { slug: 'bodyweight-squat', name: 'Bodyweight squat', muscles: ['Quads', 'Glutes'], equipment: [], cue: 'Feet shoulder-width, sit back and down, chest up, drive through your heels.' },
  pushUp: { slug: 'push-up', name: 'Push-up', muscles: ['Chest', 'Triceps'], equipment: [], cue: 'Body in one straight line. Drop to your knees if you need to; that still counts.' },
  lunge: { slug: 'reverse-lunge', name: 'Reverse lunge', muscles: ['Quads', 'Glutes'], equipment: [], cue: 'Step back, lower the back knee towards the floor, push through the front heel. Alternate legs.' },
  bridge: { slug: 'glute-bridge', name: 'Glute bridge', muscles: ['Glutes', 'Hamstrings'], equipment: [], cue: 'On your back, knees bent. Squeeze your glutes to lift your hips, pause, lower slowly.' },
  plank: { slug: 'plank', name: 'Plank', muscles: ['Abs'], equipment: [], cue: 'Elbows under shoulders, body straight, breathe. Stop before your hips sag.' },
  sidePlank: { slug: 'side-plank', name: 'Side plank', muscles: ['Obliques'], equipment: [], cue: 'Elbow under shoulder, hips up. Do half the time on each side.' },
  deadBug: { slug: 'dead-bug', name: 'Dead bug', muscles: ['Abs'], equipment: [], cue: 'Lower back pressed down. Reach the opposite arm and leg away slowly, then swap.' },
  superman: { slug: 'superman', name: 'Superman', muscles: ['Lower back', 'Glutes'], equipment: [], cue: 'Face down, lift arms and legs a little off the floor, hold a breath, lower.' },
  jacks: { slug: 'jumping-jack', name: 'Jumping jacks', muscles: ['Full body'], equipment: [], cue: 'Light on your feet. Step side to side instead if jumping is not for today.' },
  knees: { slug: 'high-knees', name: 'High knees', muscles: ['Cardio'], equipment: [], cue: 'Run on the spot, knees to hip height, pump your arms.' },
  climbers: { slug: 'mountain-climber', name: 'Mountain climbers', muscles: ['Abs', 'Cardio'], equipment: [], cue: 'From a push-up position, drive one knee to your chest at a time.' },
  burpee: { slug: 'burpee', name: 'Burpee', muscles: ['Full body'], equipment: [], cue: 'Squat, hands down, step or jump back, return, stand tall. Go at your own pace.' },
  gobletSquat: { slug: 'goblet-squat', name: 'Goblet squat', muscles: ['Quads', 'Glutes'], equipment: ['1 dumbbell'], cue: 'Hold the dumbbell at your chest, elbows inside your knees at the bottom.' },
  row: { slug: 'dumbbell-row', name: 'One-arm dumbbell row', muscles: ['Back', 'Biceps'], equipment: ['1 dumbbell'], cue: 'Hand and knee on a bench, pull the dumbbell to your hip. Do each side.' },
  press: { slug: 'dumbbell-floor-press', name: 'Dumbbell floor press', muscles: ['Chest', 'Triceps'], equipment: ['2 dumbbells'], cue: 'On your back, press the dumbbells up, lower until your elbows touch the floor.' },
  rdl: { slug: 'romanian-deadlift', name: 'Romanian deadlift', muscles: ['Hamstrings', 'Glutes'], equipment: ['2 dumbbells'], cue: 'Soft knees, push your hips back, keep the weights close to your legs, flat back.' },
  shoulder: { slug: 'dumbbell-shoulder-press', name: 'Shoulder press', muscles: ['Shoulders'], equipment: ['2 dumbbells'], cue: 'Press overhead without arching your back. Seated is fine.' },
  catCow: { slug: 'cat-cow', name: 'Cat-cow', muscles: ['Back'], equipment: [], cue: 'On hands and knees, round your back up, then let it dip. Move with your breath.' },
  hipFlexor: { slug: 'hip-flexor-stretch', name: 'Hip flexor stretch', muscles: ['Hips'], equipment: [], cue: 'Half kneel, tuck your hips under until you feel the front of the hip. Half the time each side.' },
  hamstring: { slug: 'hamstring-stretch', name: 'Hamstring stretch', muscles: ['Hamstrings'], equipment: [], cue: 'One leg out straight, hinge forward with a long back. Half the time each side.' },
  child: { slug: 'childs-pose', name: "Child's pose", muscles: ['Back', 'Hips'], equipment: [], cue: 'Knees wide, sit back on your heels, arms long, breathe slowly.' },
  rotation: { slug: 'thoracic-rotation', name: 'Open book rotation', muscles: ['Upper back'], equipment: [], cue: 'On your side, knees bent, open your top arm across to the other side and follow it with your eyes.' },
};

const reps = (m: Move, sets: number, repsMin: number, repsMax: number, restS = 60): PlanExercise => ({ ...m, sets, repsMin, repsMax, durationS: null, restS });
const timed = (m: Move, sets: number, durationS: number, restS = 45): PlanExercise => ({ ...m, sets, repsMin: null, repsMax: null, durationS, restS });
const builtIn = (key: string, title: string, minutes: number, kind: Kind, place: PlannedWorkout['place'], exercises: PlanExercise[]): PlannedWorkout => ({
  key: `builtin:${key}`,
  title,
  minutes,
  kind,
  place,
  exercises,
  workoutId: null,
  programId: null,
});

export const BUILT_IN: PlannedWorkout[] = [
  builtIn('bodyweight', 'Bodyweight full body', 20, 'strength', 'home', [
    reps(MOVES.squat, 3, 10, 15),
    reps(MOVES.pushUp, 3, 6, 12),
    reps(MOVES.lunge, 3, 8, 12),
    reps(MOVES.bridge, 3, 12, 15, 45),
    timed(MOVES.plank, 3, 30),
  ]),
  builtIn('dumbbell', 'Dumbbell full body', 30, 'strength', 'gym', [
    reps(MOVES.gobletSquat, 3, 8, 12, 90),
    reps(MOVES.row, 3, 8, 12, 75),
    reps(MOVES.press, 3, 8, 12, 75),
    reps(MOVES.rdl, 3, 8, 12, 90),
    reps(MOVES.shoulder, 3, 8, 12, 75),
  ]),
  builtIn('core', '10-minute core', 10, 'strength', 'quick', [timed(MOVES.plank, 2, 30, 30), reps(MOVES.deadBug, 2, 8, 12, 30), timed(MOVES.sidePlank, 2, 40, 30), reps(MOVES.superman, 2, 10, 12, 30)]),
  builtIn('cardio', '15-minute cardio', 15, 'cardio', 'quick', [timed(MOVES.jacks, 3, 40, 20), timed(MOVES.knees, 3, 30, 20), timed(MOVES.climbers, 3, 30, 20), reps(MOVES.burpee, 3, 6, 10, 40)]),
  builtIn('mobility', 'Mobility reset', 15, 'mobility', 'quick', [
    reps(MOVES.catCow, 2, 8, 10, 15),
    timed(MOVES.hipFlexor, 2, 60, 15),
    timed(MOVES.hamstring, 2, 60, 15),
    reps(MOVES.rotation, 2, 6, 8, 15),
    timed(MOVES.child, 1, 60, 0),
  ]),
];

export const builtInByKey = (key: string) => BUILT_IN.find((w) => w.key === key) ?? null;

type ServerWorkout = components['schemas']['WorkoutDetail'];
const nice = (s: string) => s.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

/** A workout from a server program in the same shape as the built-in ones. */
export function fromServer(w: ServerWorkout, programId: string | null): PlannedWorkout {
  const muscles = new Set(w.exercises.flatMap((e) => e.exercise.muscleGroups));
  const kind: Kind = muscles.has('cardio') ? 'cardio' : 'strength';
  return {
    key: `server:${w.id}`,
    title: w.title,
    minutes: w.estMinutes,
    kind,
    place: 'home',
    workoutId: w.id,
    programId,
    exercises: [...w.exercises]
      .sort((a, b) => a.position - b.position)
      .map((e) => ({
        slug: e.exercise.slug,
        name: e.exercise.name,
        muscles: e.exercise.muscleGroups.map(nice),
        equipment: e.exercise.equipment.filter((q) => q !== 'bodyweight').map(nice),
        sets: e.sets,
        repsMin: e.repsMin,
        repsMax: e.repsMax,
        durationS: e.durationS,
        restS: e.restS ?? 60,
        cue: e.notes ?? e.exercise.tips ?? null,
      })),
  };
}

/** Rough energy used, from standard MET values (strength 5, cardio 8, mobility 2.5) and body weight. */
export function caloriesBurned(kind: Kind, minutes: number, weightKg: number): number {
  const met = { strength: 5, cardio: 8, mobility: 2.5 }[kind];
  return Math.round((met * 3.5 * weightKg * minutes) / 200);
}

/** Whether to show a weight control: anything held. */
export const usesWeight = (e: PlanExercise) => e.equipment.some((q) => /dumbbell|barbell|kettlebell|machine|cable/i.test(q));
