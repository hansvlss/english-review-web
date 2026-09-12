import assert from "node:assert/strict";
import test from "node:test";
import { formatNextDue, isDue, scheduleReview, toLocalDateKey } from "../src/review.ts";

const now = new Date("2026-09-12T08:00:00.000Z");

test("记得后阶段递增，并采用当前阶段对应的间隔", () => {
  const first = scheduleReview({ stage: 0, dueAt: now.toISOString() }, "remembered", now);
  assert.equal(first.stage, 1);
  assert.equal(first.dueAt, "2026-09-13T08:00:00.000Z");

  const second = scheduleReview(first, "remembered", now);
  assert.equal(second.stage, 2);
  assert.equal(second.dueAt, "2026-09-15T08:00:00.000Z");
});

test("忘了会降低一级，并在一分钟后重新出现", () => {
  const result = scheduleReview({ stage: 3, dueAt: now.toISOString() }, "again", now);
  assert.equal(result.stage, 2);
  assert.equal(result.dueAt, "2026-09-12T08:01:00.000Z");
});

test("连续忘记不会低于第零级", () => {
  const first = scheduleReview({ stage: 0, dueAt: now.toISOString() }, "again", now);
  const second = scheduleReview(first, "again", now);
  assert.equal(second.stage, 0);
  assert.equal(second.dueAt, "2026-09-12T08:01:00.000Z");
});

test("到期判断包含边界并可跨日", () => {
  assert.equal(isDue("2026-09-12T08:00:00.000Z", now), true);
  assert.equal(isDue("2026-09-13T07:59:59.000Z", now), false);
  assert.equal(formatNextDue("2026-09-13T08:00:00.000Z", now), "1 天后");
});

test("打卡日期使用本地日历日期", () => {
  const localDate = new Date(2026, 8, 12, 23, 59);
  assert.equal(toLocalDateKey(localDate), "2026-09-12");
});
