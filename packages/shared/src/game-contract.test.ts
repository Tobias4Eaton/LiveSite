import { describe, expect, it } from "vitest";
import {
  gameActionSchema,
  gameEventSchema,
  gameSnapshotSchema,
  MAX_BROADCASTS_PER_SECOND,
  REALTIME_CHANNEL,
} from "./game-contract";

describe("介接契約常數", () => {
  it("頻道名與節流上限固定不變", () => {
    expect(REALTIME_CHANNEL).toBe("game:live");
    expect(MAX_BROADCASTS_PER_SECOND).toBe(5);
  });
});

describe("gameSnapshotSchema", () => {
  it("接受合法快照", () => {
    const snap = {
      gameType: "bet",
      sessionId: "s-001",
      phase: "open",
      startedAt: "2026-08-11T12:00:00Z",
      payload: { pool: 300 },
    };
    expect(gameSnapshotSchema.parse(snap)).toEqual(snap);
  });

  it("拒絕未知的 phase", () => {
    const bad = {
      gameType: "bet",
      sessionId: "s-001",
      phase: "paused",
      startedAt: "2026-08-11T12:00:00Z",
      payload: {},
    };
    expect(() => gameSnapshotSchema.parse(bad)).toThrow();
  });

  it("拒絕非 ISO 格式的 startedAt", () => {
    const bad = {
      gameType: "bet",
      sessionId: "s-001",
      phase: "open",
      startedAt: "yesterday",
      payload: {},
    };
    expect(() => gameSnapshotSchema.parse(bad)).toThrow();
  });
});

describe("gameEventSchema", () => {
  it("接受合法事件", () => {
    const ev = { type: "player-joined", at: "2026-08-11T12:00:01Z", data: { user: "abc" } };
    expect(gameEventSchema.parse(ev)).toEqual(ev);
  });
});

describe("gameActionSchema", () => {
  it("接受合法操作且 args 必須是字串陣列", () => {
    expect(gameActionSchema.parse({ action: "bet", args: ["100"] })).toEqual({
      action: "bet",
      args: ["100"],
    });
    expect(() => gameActionSchema.parse({ action: "bet", args: [100] })).toThrow();
  });
});
