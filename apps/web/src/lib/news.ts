export interface NewsRow {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  published_at: string;
}

export interface NewsItem {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  publishedAt: string;
}

export function toNewsItems(rows: NewsRow[]): NewsItem[] {
  return rows
    .map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      pinned: r.pinned,
      publishedAt: r.published_at,
    }))
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.publishedAt.localeCompare(a.publishedAt);
    });
}
