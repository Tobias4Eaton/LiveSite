# 部署說明

## Cloudflare Workers（網站託管，免費）

> 新版 Cloudflare 後台已將新專案導向 Workers（Pages 建立入口部分帳號已移除）。
> 本 repo 根目錄的 `wrangler.jsonc` 已設定好純靜態資產部署。

1. 登入 Cloudflare Dashboard → Workers & Pages → Create → Import a repository，
   選擇 `Tobias4Eaton/LiveSite` 倉庫。
2. 設定畫面：
   - Project name: `livesite`
   - Build command: `pnpm --filter web build`
   - Deploy command: `npx wrangler deploy`（預設值即可）
   - Root directory（Advanced settings）: 留空（monorepo 由 pnpm filter 處理）
   - Node 版本由根目錄 `.node-version` 檔案指定（22），不需另設環境變數。
3. 建置環境變數（專案 → Settings → Build → Variables and Secrets）：
   - `PUBLIC_SUPABASE_URL`
   - `PUBLIC_SUPABASE_ANON_KEY`
4. 部署完成後，把分配到的網域（`livesite.xxx.workers.dev`，之後有自訂網域也一併）
   加進 `apps/web/src/config/site.ts` 的 `embedParents`，否則 Twitch 播放器黑畫面。
5. 建立 API Token 供每週自動重建使用：
   Dashboard 右上頭像 → My Profile → API Tokens → Create Token →
   使用 **Edit Cloudflare Workers** 範本（限制到自己的帳號即可），
   複製 token 存為 GitHub Secret `CLOUDFLARE_API_TOKEN`；
   帳號 ID（Workers & Pages 總覽頁右側的 Account ID）存為 `CLOUDFLARE_ACCOUNT_ID`。

## GitHub Secrets（Settings → Secrets and variables → Actions）

| Secret | 值 |
|---|---|
| `SUPABASE_URL` | Supabase Project URL |
| `SUPABASE_ANON_KEY` | Supabase anon public key |
| `CLOUDFLARE_API_TOKEN` | 上面建立的 Workers 部署用 API Token |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 帳號 ID |

## Supabase（資料庫，免費）

見 `supabase/migrations/`，依編號順序在 SQL Editor 執行。
發公告：Table Editor → `news` → Insert row。

## 例行維護

`.github/workflows/weekly.yml` 每週一、四自動：
1. 讀取一次資料庫，避免免費層專案因閒置一週被暫停。
2. 在 Actions 內重新建置網站並以 wrangler 部署，讓影片牆抓到最新 YouTube 影片。
（也可在 Actions 頁面手動觸發 `weekly`。）

注意：GitHub 若倉庫超過 60 天沒有任何 commit，會自動停用排程中的 workflow，
需到 Actions 頁面手動重新啟用 weekly workflow。
