-- 最新資訊/公告。站主用 Supabase Studio 後台直接新增/編輯。
create table if not exists public.news (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  pinned boolean not null default false,
  published_at timestamptz not null default now()
);

alter table public.news enable row level security;

-- 僅開放公開讀取；不建立任何 insert/update/delete policy（後台走 service role）。
create policy "news_public_read"
  on public.news for select
  using (true);

-- Test data for site owner (to be inserted manually via Supabase Studio):
-- insert into public.news (title, body, pinned)
-- values ('網站上線', '歡迎來到我的新家！之後公告都會發在這裡。', true);
