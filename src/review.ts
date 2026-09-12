export const REVIEW_INTERVAL_DAYS = [1, 3, 7, 14, 30, 60, 120] as const;

export type ReviewRating = "again" | "remembered";

export type ReviewState = {
  stage: number;
  dueAt: string;
  lastRating?: ReviewRating;
  reviewedAt?: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function scheduleReview(
  current: ReviewState,
  rating: ReviewRating,
  now = new Date(),
): ReviewState {
  if (rating === "again") {
    return {
      stage: Math.max(0, current.stage - 1),
      dueAt: new Date(now.getTime() + 60_000).toISOString(),
      lastRating: rating,
      reviewedAt: now.toISOString(),
    };
  }

  const stage = Math.min(REVIEW_INTERVAL_DAYS.length - 1, current.stage + 1);
  return {
    stage,
    dueAt: new Date(now.getTime() + REVIEW_INTERVAL_DAYS[current.stage] * DAY_MS).toISOString(),
    lastRating: rating,
    reviewedAt: now.toISOString(),
  };
}

export function isDue(dueAt: string, now = new Date()) {
  return new Date(dueAt).getTime() <= now.getTime();
}

export function toLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatNextDue(dueAt: string, now = new Date()) {
  const difference = new Date(dueAt).getTime() - now.getTime();
  if (difference <= 60_000) return "1 分钟内";
  if (difference < DAY_MS) return `${Math.max(1, Math.ceil(difference / 3_600_000))} 小时后`;
  return `${Math.max(1, Math.ceil(difference / DAY_MS))} 天后`;
}
