import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { placeholderEmail } from "@/lib/auth/placeholder-email";
import type { DashboardData, Metric } from "../types";
import { getDashboard } from "./metrics";

const NOW = new Date("2031-05-20T12:00:00.000Z"); // 21:00 KST
const RANGE = new URLSearchParams({ from: "2031-05-10", to: "2031-05-19" });
const ids: string[] = [];
let previousConfig: { id: string; startedAt: Date } | null;

const date = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`);
const instant = (iso: string) => new Date(iso);

async function user(
  key: string,
  createdAt: string,
  flags: { excluded?: boolean; deleted?: boolean; suspended?: boolean } = {},
) {
  const id = randomUUID();
  ids.push(id);
  return prisma.user.create({
    data: {
      id,
      name: key,
      username: `metric_${key}_${id.slice(0, 6)}`,
      displayUsername: `metric_${key}_${id.slice(0, 6)}`,
      email: placeholderEmail(`metric_${key}_${id.slice(0, 6)}`),
      createdAt: instant(createdAt),
      analyticsExcluded: flags.excluded ?? false,
      deletedAt: flags.deleted ? instant("2031-05-20T00:00:00Z") : null,
      suspendedAt: flags.suspended ? instant("2031-05-20T00:00:00Z") : null,
    },
  });
}

function metric(data: DashboardData, id: string): Metric {
  const found = data.metrics.find((item) => item.id === id);
  expect(found, `missing metric ${id}`).toBeDefined();
  return found!;
}

beforeAll(async () => {
  previousConfig = await prisma.analyticsConfig.findUnique({ where: { id: "product" } });
  await prisma.analyticsConfig.upsert({
    where: { id: "product" },
    create: { id: "product", startedAt: instant("2031-04-01T03:00:00Z") },
    update: { startedAt: instant("2031-04-01T03:00:00Z") },
  });

  const [old, first, second, excluded, deleted, , backlog] = await Promise.all([
    user("old", "2031-03-01T00:00:00Z"),
    user("first", "2031-05-12T00:00:00Z"),
    user("second", "2031-05-12T01:00:00Z"),
    user("excluded", "2031-05-12T02:00:00Z", { excluded: true }),
    user("deleted", "2031-05-13T00:00:00Z", { deleted: true }),
    user("suspended", "2031-05-14T00:00:00Z", { suspended: true }),
    user("backlog", "2031-03-02T00:00:00Z"),
  ]);

  await prisma.userDailyActivity.createMany({
    data: [
      [first.id, "2031-05-12", "2031-05-12T00:10:00Z"],
      [second.id, "2031-05-12", "2031-05-12T01:10:00Z"],
      [excluded.id, "2031-05-12", "2031-05-12T02:10:00Z"],
      [first.id, "2031-05-13", "2031-05-13T00:10:00Z"],
      [second.id, "2031-05-13", "2031-05-13T01:10:00Z"],
      [deleted.id, "2031-05-13", "2031-05-13T02:10:00Z"],
      [first.id, "2031-05-19", "2031-05-19T00:10:00Z"],
    ].map(([userId, activityDate, seen]) => ({
      userId,
      activityDate: date(activityDate),
      firstSeenAt: instant(seen),
      lastSeenAt: instant(seen),
    })),
  });

  const firstRun = await prisma.dailyRun.create({
    data: {
      userId: first.id,
      runDate: date("2031-05-12"),
      tapCount: 10_000,
      stage: 5,
      firstTapAt: instant("2031-05-12T00:00:20Z"),
      lastTapAt: instant("2031-05-12T05:00:00Z"),
      tapEvents: {
        create: [
          { batchSize: 4_000, tappedAt: instant("2031-05-12T03:00:00Z") },
          { batchSize: 6_000, tappedAt: instant("2031-05-12T05:00:00Z") },
        ],
      },
    },
  });
  const secondRun = await prisma.dailyRun.create({
    data: {
      userId: second.id,
      runDate: date("2031-05-12"),
      tapCount: 3_200,
      stage: 2,
      firstTapAt: instant("2031-05-12T02:00:00Z"),
      lastTapAt: instant("2031-05-12T03:00:00Z"),
      tapEvents: { create: { batchSize: 3_200, tappedAt: instant("2031-05-12T03:00:00Z") } },
    },
  });
  await prisma.dailyRun.createMany({
    data: [
      {
        userId: excluded.id,
        runDate: date("2031-05-12"),
        tapCount: 10_000,
        stage: 5,
        firstTapAt: instant("2031-05-12T02:00:10Z"),
        lastTapAt: instant("2031-05-12T02:00:10Z"),
      },
      {
        userId: deleted.id,
        runDate: date("2031-05-13"),
        tapCount: 1_500,
        stage: 1,
        firstTapAt: instant("2031-05-13T03:00:00Z"),
        lastTapAt: instant("2031-05-13T03:00:00Z"),
      },
      {
        userId: backlog.id,
        runDate: date("2031-05-18"),
        tapCount: 1,
        stage: 0,
        firstTapAt: instant("2031-05-18T03:00:00Z"),
        lastTapAt: instant("2031-05-18T03:00:00Z"),
      },
    ],
  });

  await prisma.dailyResult.createMany({
    data: [
      {
        dailyRunId: firstRun.id,
        primaryTitleId: "heart_already_home",
        titleIds: ["heart_already_home", "early_leaver"],
        rank: 1,
        rankTotal: 2,
        settledAt: instant("2031-05-13T00:00:00Z"),
      },
      {
        dailyRunId: secondRun.id,
        primaryTitleId: "bearable_day",
        titleIds: ["bearable_day"],
        rank: 2,
        rankTotal: 2,
        settledAt: instant("2031-05-13T00:00:00Z"),
      },
    ],
  });
  await prisma.productEvent.createMany({
    data: [
      {
        userId: first.id,
        otherUserId: old.id,
        type: "friend_accepted",
        entityId: "friendship-1",
        occurredAt: instant("2031-05-12T12:00:00Z"),
      },
      {
        userId: first.id,
        type: "result_viewed",
        entityId: firstRun.id,
        occurredAt: instant("2031-05-13T01:00:00Z"),
      },
      {
        userId: second.id,
        type: "result_viewed",
        entityId: secondRun.id,
        occurredAt: instant("2031-05-14T02:00:00Z"),
      },
    ],
  });
  await prisma.signal.createMany({
    data: [
      {
        senderId: first.id,
        receiverId: second.id,
        level: "normal",
        sentAt: instant("2031-05-15T00:00:00Z"),
        readAt: instant("2031-05-15T02:00:00Z"),
      },
      {
        senderId: second.id,
        receiverId: first.id,
        level: "strong",
        sentAt: instant("2031-05-16T00:00:00Z"),
        readAt: instant("2031-05-17T01:00:00Z"),
      },
    ],
  });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  if (previousConfig) {
    await prisma.analyticsConfig.upsert({
      where: { id: previousConfig.id },
      create: previousConfig,
      update: { startedAt: previousConfig.startedAt },
    });
  } else {
    await prisma.analyticsConfig.deleteMany({ where: { id: "product" } });
  }
});

describe("getDashboard", () => {
  it("aggregates bounded historical behavior while excluding analytics accounts", async () => {
    const expectedActive = await prisma.user.count({
      where: {
        analyticsExcluded: false,
        deletedAt: null,
        suspendedAt: null,
        createdAt: { lte: NOW },
      },
    });
    const data = await getDashboard(RANGE, NOW);

    expect(data.range).toEqual({ from: "2031-05-10", to: "2031-05-19", days: 10 });
    expect(data.collectionStartedAt).toBe("2031-04-01T03:00:00.000Z");
    expect(metric(data, "active_members").value).toBe(expectedActive);
    expect(metric(data, "signups")).toMatchObject({ value: 4, status: "ready" });
    expect(metric(data, "activation_30s")).toMatchObject({ value: 25, numerator: 1, denominator: 4 });
    expect(metric(data, "activation_24h")).toMatchObject({ value: 75, numerator: 3, denominator: 4 });
    expect(metric(data, "completion_rate")).toMatchObject({ value: 25, numerator: 1, denominator: 4 });
    expect(metric(data, "signal_read_24h")).toMatchObject({ value: 50, numerator: 1, denominator: 2 });
    expect(metric(data, "result_viewed_24h")).toMatchObject({ value: 50, numerator: 1, denominator: 2 });

    expect(data.trend.find((point) => point.date === "2031-05-12")).toEqual({
      date: "2031-05-12",
      visitors: 2,
      players: 2,
      signups: 2,
      activated: 2,
    });
    expect(data.trend.find((point) => point.date === "2031-05-13")).toMatchObject({
      visitors: 3,
      players: 1,
      signups: 1,
    });
  });

  it("uses distinct rolling visitors and exact D1/D7 cohort dates", async () => {
    const data = await getDashboard(RANGE, NOW);

    expect(metric(data, "wau")).toMatchObject({ value: 3, status: "ready" });
    expect(metric(data, "mau")).toMatchObject({ value: 3, status: "ready" });
    expect(metric(data, "stickiness")).toMatchObject({
      value: 33.3,
      numerator: 1,
      denominator: 3,
      status: "ready",
    });
    expect(metric(data, "d7_retention")).toHaveProperty("previous", null);
    const cohort = data.cohorts.find((item) => item.date === "2031-05-12");
    expect(cohort).toMatchObject({
      size: 2,
      d1: { value: 100, numerator: 2, denominator: 2, status: "ready" },
      d7: { value: 50, numerator: 1, denominator: 2, status: "ready" },
    });
  });

  it("aggregates stages, server-received tap batches, catalog titles and social groups", async () => {
    const data = await getDashboard(RANGE, NOW);

    expect(data.stages.map(({ threshold, count, total, rate }) => ({ threshold, count, total, rate }))).toEqual([
      { threshold: 1, count: 4, total: 4, rate: 100 },
      { threshold: 1500, count: 3, total: 4, rate: 75 },
      { threshold: 3200, count: 2, total: 4, rate: 50 },
      { threshold: 5000, count: 1, total: 4, rate: 25 },
      { threshold: 7300, count: 1, total: 4, rate: 25 },
      { threshold: 10000, count: 1, total: 4, rate: 25 },
    ]);
    expect(data.hourly.find(({ hour }) => hour === 12)).toEqual({ hour: 12, taps: 7_200, players: 2 });
    expect(data.hourly.find(({ hour }) => hour === 14)).toEqual({ hour: 14, taps: 6_000, players: 1 });
    expect(data.titles.find(({ id }) => id === "heart_already_home")).toMatchObject({
      name: "마음만 이미 집에 있음",
      count: 1,
    });
    expect(data.social).toEqual([
      { label: "24시간 내 친구 연결", size: 1, retained: 1, rate: 100 },
      { label: "친구 연결 없음", size: 1, retained: 0, rate: 0 },
    ]);
    expect(data.unsettledRuns).toBe(1);
  });

  it("returns collecting instead of zero before full collection windows mature", async () => {
    await prisma.analyticsConfig.update({
      where: { id: "product" },
      data: { startedAt: instant("2031-05-13T03:00:00Z") },
    });
    try {
      const data = await getDashboard(RANGE, NOW);
      expect(data.trend.find((point) => point.date === "2031-05-10")?.visitors).toBeNull();
      expect(data.trend.find((point) => point.date === "2031-05-14")?.visitors).toBe(0);
      expect(metric(data, "wau")).toMatchObject({ value: null, status: "collecting" });
      expect(metric(data, "mau")).toMatchObject({ value: null, status: "collecting" });
      expect(metric(data, "stickiness")).toMatchObject({ value: null, status: "collecting" });
      expect(metric(data, "result_viewed_24h")).toMatchObject({ value: null, status: "collecting" });
      expect(data.cohorts.find((item) => item.date === "2031-05-10")?.d1).toMatchObject({
        value: null,
        status: "collecting",
      });
    } finally {
      await prisma.analyticsConfig.update({
        where: { id: "product" },
        data: { startedAt: instant("2031-04-01T03:00:00Z") },
      });
    }
  });

  it("keeps result views unmeasured when event collection has never started", async () => {
    await prisma.analyticsConfig.delete({ where: { id: "product" } });
    try {
      const data = await getDashboard(RANGE, NOW);
      expect(metric(data, "result_viewed_24h")).toMatchObject({ value: null, status: "collecting" });
    } finally {
      await prisma.analyticsConfig.create({ data: { id: "product", startedAt: instant("2031-04-01T03:00:00Z") } });
    }
  });

  it("does not compare a partial current day with a completed previous day", async () => {
    const future = await user("future", "2031-05-20T13:00:00Z");
    await prisma.dailyRun.create({
      data: {
        userId: future.id,
        runDate: date("2031-05-20"),
        tapCount: 50,
        stage: 0,
        firstTapAt: instant("2031-05-20T13:01:00Z"),
        lastTapAt: instant("2031-05-20T13:01:00Z"),
        tapEvents: { create: { batchSize: 50, tappedAt: instant("2031-05-20T13:01:00Z") } },
      },
    });
    const data = await getDashboard(
      new URLSearchParams({ from: "2031-05-20", to: "2031-05-20" }),
      NOW,
    );

    expect(metric(data, "signups")).not.toHaveProperty("previous");
    expect(metric(data, "play_dau")).not.toHaveProperty("previous");
    expect(metric(data, "completion_rate")).not.toHaveProperty("previous");
    expect(metric(data, "wau")).toMatchObject({ value: null, status: "collecting" });
    expect(data.trend[0]).toMatchObject({ signups: 0, players: 0 });
    expect(data.hourly.reduce((sum, item) => sum + item.taps, 0)).toBe(0);
  });
});
