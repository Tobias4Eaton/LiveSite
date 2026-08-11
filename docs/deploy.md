# 部署說明

## Cloudflare Pages（網站託管，免費）

1. 登入 Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git，
   選擇 `Tobias4Eaton/LiveSite` 倉庫。
2. 建置設定：
   - Framework preset: **Astro**
   - Build command: `pnpm --filter web build`
   - Build output directory: `apps/web/dist`
   - Root directory: 留空（monorepo 由 pnpm filter 處理）
3. 環境變數（Settings → Environment variables，Production 與 Preview 都設）：
   - `PUBLIC_SUPABASE_URL`
   - `PUBLIC_SUPABASE_ANON_KEY`
4. 部署完成後，把分配到的網域（`xxx.pages.dev`，之後有自訂網域也一併）
   加進 `apps/web/src/config/site.ts` 的 `embedParents`，否則 Twitch 播放器黑畫面。
5. Settings → Builds & deployments → Deploy hooks → 建一個 hook，
   複製網址存為 GitHub Secret `CF_PAGES_DEPLOY_HOOK_URL`。

## GitHub Secrets（Settings → Secrets and variables → Actions）

| Secret | 值 |
|---|---|
| `SUPABASE_URL` | Supabase Project URL |
| `SUPABASE_ANON_KEY` | Supabase anon public key |
| `CF_PAGES_DEPLOY_HOOK_URL` | 上面建立的 Deploy hook 網址 |

## Supabase（資料庫，免費）

見 `supabase/migrations/`，依編號順序在 SQL Editor 執行。
發公告：Table Editor → `news` → Insert row。

## 例行維護

`.github/workflows/weekly.yml` 每週一自動：
1. 讀取一次資料庫，避免免費層專案因閒置一週被暫停。
2. 觸發 Pages 重建，讓影片牆抓到最新 YouTube 影片。
（也可在 Actions 頁面手動觸發 `weekly`。）
