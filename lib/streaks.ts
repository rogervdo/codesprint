export type StreakState = {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string; // "YYYY-MM-DD"
  streakStartDate: string; // "YYYY-MM-DD"
};

export type StreakUpdate = {
  newState: StreakState;
  streakIncremented: boolean;
  streakBroken: boolean;
};

export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateString(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function daysBetween(dateStrA: string, dateStrB: string): number {
  const a = parseDateString(dateStrA);
  const b = parseDateString(dateStrB);
  const msPerDay = 86_400_000;
  return Math.round((b.getTime() - a.getTime()) / msPerDay);
}

export function updateStreak(
  current: StreakState | undefined,
  today: string
): StreakUpdate {
  if (current === undefined) {
    return {
      newState: {
        currentStreak: 1,
        longestStreak: 1,
        lastActiveDate: today,
        streakStartDate: today,
      },
      streakIncremented: true,
      streakBroken: false,
    };
  }

  if (current.lastActiveDate === today) {
    return {
      newState: { ...current },
      streakIncremented: false,
      streakBroken: false,
    };
  }

  const gap = daysBetween(current.lastActiveDate, today);

  if (gap === 1) {
    const newCurrent = current.currentStreak + 1;
    return {
      newState: {
        currentStreak: newCurrent,
        longestStreak: Math.max(current.longestStreak, newCurrent),
        lastActiveDate: today,
        streakStartDate: current.streakStartDate,
      },
      streakIncremented: true,
      streakBroken: false,
    };
  }

  return {
    newState: {
      currentStreak: 1,
      longestStreak: current.longestStreak,
      lastActiveDate: today,
      streakStartDate: today,
    },
    streakIncremented: false,
    streakBroken: true,
  };
}
