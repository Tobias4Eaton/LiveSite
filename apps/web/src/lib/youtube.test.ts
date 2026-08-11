import { describe, expect, it } from "vitest";
import { feedUrl, parseYouTubeFeed } from "./youtube";

const SAMPLE_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015"
      xmlns:media="http://search.yahoo.com/mrss/"
      xmlns="http://www.w3.org/2005/Atom">
  <title>頻道名</title>
  <entry>
    <yt:videoId>abc123DEF45</yt:videoId>
    <title>第一支影片</title>
    <published>2026-08-01T10:00:00+00:00</published>
  </entry>
  <entry>
    <yt:videoId>xyz789GHI01</yt:videoId>
    <title>第二支影片</title>
    <published>2026-07-20T10:00:00+00:00</published>
  </entry>
</feed>`;

describe("feedUrl", () => {
  it("組出官方 RSS 網址", () => {
    expect(feedUrl("UC_test")).toBe(
      "https://www.youtube.com/feeds/videos.xml?channel_id=UC_test",
    );
  });
});

describe("parseYouTubeFeed", () => {
  it("解析多筆 entry", () => {
    const videos = parseYouTubeFeed(SAMPLE_FEED);
    expect(videos).toHaveLength(2);
    expect(videos[0]).toEqual({
      id: "abc123DEF45",
      title: "第一支影片",
      publishedAt: "2026-08-01T10:00:00+00:00",
      thumbnailUrl: "https://i.ytimg.com/vi/abc123DEF45/hqdefault.jpg",
      url: "https://www.youtube.com/watch?v=abc123DEF45",
    });
  });

  it("只有一筆 entry 時也回傳陣列", () => {
    const single = SAMPLE_FEED.replace(/<entry>[\s\S]*?<\/entry>\s*$/m, "");
    expect(Array.isArray(parseYouTubeFeed(single))).toBe(true);
    expect(parseYouTubeFeed(single)).toHaveLength(1);
  });

  it("沒有任何 entry 時回傳空陣列", () => {
    const empty = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>x</title></feed>`;
    expect(parseYouTubeFeed(empty)).toEqual([]);
  });
});
