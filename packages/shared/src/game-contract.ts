import { z } from "zod";

/** 機器人與網站共用的 Supabase Realtime 頻道名 */
export const REALTIME_CHANNEL = "game:live";

/** 機器人廣播節流上限（次/秒）——避免撞 Supabase 免費層額度 */
export const MAX_BROADCASTS_PER_SECOND = 5;

/** 遊戲狀態快照：機器人 → 網站/覆蓋層 */
export const gameSnapshotSchema = z.object({
  gameType: z.string(),
  sessionId: z.string(),
  phase: z.enum(["idle", "open", "running", "ended"]),
  startedAt: z.iso.datetime(),
  payload: z.record(z.string(), z.unknown()),
});
export type GameSnapshot = z.infer<typeof gameSnapshotSchema>;

/** 單次遊戲事件：機器人 → 網站/覆蓋層 */
export const gameEventSchema = z.object({
  type: z.string(),
  at: z.iso.datetime(),
  data: z.record(z.string(), z.unknown()),
});
export type GameEvent = z.infer<typeof gameEventSchema>;

/** 網站玩家操作（寫入 game_actions 表的 payload 欄）：網站 → 機器人 */
export const gameActionSchema = z.object({
  action: z.string(),
  args: z.array(z.string()),
});
export type GameAction = z.infer<typeof gameActionSchema>;
