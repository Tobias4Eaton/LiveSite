import { XMLParser } from "fast-xml-parser";

export interface YouTubeVideo {
  id: string;
  title: string;
  publishedAt: string;
  thumbnailUrl: string;
  url: string;
}

export function feedUrl(channelId: string): string {
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
}

interface FeedEntry {
  "yt:videoId": string;
  title: string;
  published: string;
}

export function parseYouTubeFeed(xml: string): YouTubeVideo[] {
  const doc = new XMLParser().parse(xml) as {
    feed?: { entry?: FeedEntry | FeedEntry[] };
  };
  const raw = doc.feed?.entry ?? [];
  const entries = Array.isArray(raw) ? raw : [raw];
  return entries.map((e) => ({
    id: e["yt:videoId"],
    title: String(e.title),
    publishedAt: e.published,
    thumbnailUrl: `https://i.ytimg.com/vi/${e["yt:videoId"]}/hqdefault.jpg`,
    url: `https://www.youtube.com/watch?v=${e["yt:videoId"]}`,
  }));
}
