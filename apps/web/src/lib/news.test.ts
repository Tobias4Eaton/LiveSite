import { describe, expect, it } from "vitest";
import { toNewsItems, type NewsRow } from "./news";

const rows: NewsRow[] = [
  { id: "1", title: "舊公告", body: "b", pinned: false, published_at: "2026-07-01T00:00:00Z" },
  { id: "2", title: "新公告", body: "b", pinned: false, published_at: "2026-08-01T00:00:00Z" },
  { id: "3", title: "置頂舊文", body: "b", pinned: true, published_at: "2026-06-01T00:00:00Z" },
];

describe("toNewsItems", () => {
  it("置頂優先，其餘依時間新到舊", () => {
    const items = toNewsItems(rows);
    expect(items.map((i) => i.id)).toEqual(["3", "2", "1"]);
  });

  it("欄位映射為 camelCase", () => {
    const [first] = toNewsItems([rows[0]!]);
    expect(first).toEqual({
      id: "1",
      title: "舊公告",
      body: "b",
      pinned: false,
      publishedAt: "2026-07-01T00:00:00Z",
    });
  });

  it("空輸入回傳空陣列", () => {
    expect(toNewsItems([])).toEqual([]);
  });
});
