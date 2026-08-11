# 實況主 IP 門面站（階段一）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立可上線的 IP 門面站（首頁＋Twitch 嵌入、自介、YouTube 影片牆、社群連結、最新資訊），並打好 monorepo 與 Supabase 基礎，讓後續階段（指令大全、即時遊戲、機器人）直接往上疊。

**Architecture:** pnpm monorepo：`apps/web`（Astro 靜態站，React 島嶼只用在動態區塊）＋ `packages/shared`（網站與未來機器人之間的介接契約 zod schemas）。動態資料（最新資訊）由瀏覽器直讀 Supabase（anon key + RLS 唯讀），網站本體純靜態部署於 Cloudflare Pages。

**Tech Stack:** pnpm 10 / Node 22 / TypeScript (strict) / Astro 5 + @astrojs/react (React 19) / Tailwind CSS 4 / Supabase (Postgres + RLS) / zod 4 / Vitest 3 / fast-xml-parser

## Global Constraints

- 全部程式碼 TypeScript，`strict: true`（繼承根目錄 `tsconfig.base.json`）。
- 月費 $0：只用 Cloudflare Pages 免費層與 Supabase 免費層。
- 所有 Supabase 資料表必須啟用 RLS；本階段的 `news` 只開放公開讀取（select），不開放任何寫入。
- 不使用 YouTube Data API，影片清單一律走官方 RSS（`https://www.youtube.com/feeds/videos.xml?channel_id=...`），於建置時抓取。
- 網站文案為繁體中文；`<html lang="zh-Hant">`。
- 自介、社群連結等靜態內容寫在 `apps/web/src/config/site.ts`，不進資料庫。
- 環境變數只用 `PUBLIC_SUPABASE_URL`、`PUBLIC_SUPABASE_ANON_KEY` 兩個（皆為可公開值）；缺少時網站仍能建置與運行，動態區塊顯示提示而非壞掉。
- 執行環境為 Windows（PowerShell）；計畫中的指令皆可直接在 PowerShell 執行。

**需站主提供的真實資料**（執行 Task 4 前詢問；未提供前先用範例值，不阻塞開發）：Twitch 帳號（login 名）、YouTube 頻道 ID（UC 開頭）、頻道名稱與一句話介紹、自介文案、社群連結清單、（可選）頭像／主視覺圖。

---

### Task 1: Monorepo 基礎建設

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `.gitignore`

**Interfaces:**
- Consumes: 無（起點）。
- Produces: workspace 佈局 `apps/*`、`packages/*`；根指令 `pnpm build` / `pnpm test` / `pnpm check`（遞迴跑各套件同名 script）；`tsconfig.base.json` 供各套件 `extends`。

- [ ] **Step 1: 建立 workspace 定義**

`pnpm-workspace.yaml`：

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 2: 建立根 package.json**

`package.json`：

```json
{
  "name": "livesite",
  "private": true,
  "packageManager": "pnpm@10.4.1",
  "engines": { "node": ">=22" },
  "scripts": {
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "check": "pnpm -r check"
  }
}
```

- [ ] **Step 3: 建立共用 tsconfig**

`tsconfig.base.json`：

```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "verbatimModuleSyntax": true
  }
}
```

- [ ] **Step 4: 建立 .gitignore**

`.gitignore`：

```
node_modules/
dist/
.astro/
.env
.env.*
!.env.example
```

- [ ] **Step 5: 驗證 pnpm 可解析 workspace**

Run: `pnpm install`
Expected: 成功（目前沒有子套件，會顯示 no projects 或安裝 0 依賴，皆屬正常，不能是錯誤）。

- [ ] **Step 6: Commit**

```powershell
git add pnpm-workspace.yaml package.json tsconfig.base.json .gitignore
git commit -m "chore: monorepo 基礎建設（pnpm workspaces）"
```

---

### Task 2: packages/shared 介接契約（TDD）

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/src/game-contract.ts`
- Test: `packages/shared/src/game-contract.test.ts`

**Interfaces:**
- Consumes: `tsconfig.base.json`（Task 1）。
- Produces: 套件 `@livesite/shared`，匯出：
  - `REALTIME_CHANNEL: "game:live"`（Realtime 頻道名常數）
  - `MAX_BROADCASTS_PER_SECOND: 5`（機器人廣播節流上限）
  - `gameSnapshotSchema` / 型別 `GameSnapshot`：`{ gameType: string; sessionId: string; phase: "idle"|"open"|"running"|"ended"; startedAt: string; payload: Record<string, unknown> }`
  - `gameEventSchema` / 型別 `GameEvent`：`{ type: string; at: string; data: Record<string, unknown> }`
  - `gameActionSchema` / 型別 `GameAction`：`{ action: string; args: string[] }`

  本階段網站尚未使用這些型別（階段三才用）；此任務的目的是把「網站⇄機器人」契約在基礎建設期就定案並納入測試。

- [ ] **Step 1: 建立套件骨架**

`packages/shared/package.json`：

```json
{
  "name": "@livesite/shared",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "test": "vitest run",
    "check": "tsc --noEmit",
    "build": "tsc --noEmit"
  },
  "dependencies": { "zod": "^4.0.0" },
  "devDependencies": { "typescript": "^5.7.0", "vitest": "^3.0.0" }
}
```

`packages/shared/tsconfig.json`：

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"]
}
```

Run: `pnpm install`
Expected: 安裝成功，出現 `@livesite/shared` 於 workspace。

- [ ] **Step 2: 寫失敗測試**

`packages/shared/src/game-contract.test.ts`：

```ts
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
```

- [ ] **Step 3: 執行測試，確認失敗**

Run: `pnpm --filter @livesite/shared test`
Expected: FAIL — 找不到模組 `./game-contract`。

- [ ] **Step 4: 實作契約**

`packages/shared/src/game-contract.ts`：

```ts
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
  startedAt: z.string(),
  payload: z.record(z.string(), z.unknown()),
});
export type GameSnapshot = z.infer<typeof gameSnapshotSchema>;

/** 單次遊戲事件：機器人 → 網站/覆蓋層 */
export const gameEventSchema = z.object({
  type: z.string(),
  at: z.string(),
  data: z.record(z.string(), z.unknown()),
});
export type GameEvent = z.infer<typeof gameEventSchema>;

/** 網站玩家操作（寫入 game_actions 表的 payload 欄）：網站 → 機器人 */
export const gameActionSchema = z.object({
  action: z.string(),
  args: z.array(z.string()),
});
export type GameAction = z.infer<typeof gameActionSchema>;
```

`packages/shared/src/index.ts`：

```ts
export * from "./game-contract";
```

- [ ] **Step 5: 執行測試，確認通過**

Run: `pnpm --filter @livesite/shared test`
Expected: PASS（6 tests）。

Run: `pnpm --filter @livesite/shared check`
Expected: 無型別錯誤。

- [ ] **Step 6: Commit**

```powershell
git add packages/shared
git commit -m "feat(shared): 網站⇄機器人介接契約 schemas 與常數"
```

---

### Task 3: apps/web Astro 骨架（React + Tailwind）

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/astro.config.mjs`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/src/styles/global.css`
- Create: `apps/web/src/pages/index.astro`（暫時的最小首頁，Task 5 會重寫）

**Interfaces:**
- Consumes: `tsconfig.base.json`（Task 1）。
- Produces: 可 `pnpm --filter web dev` / `build` / `check` 的 Astro 專案；Tailwind 4 與 React 島嶼已可用；後續任務只新增頁面與元件，不再動整體設定。

- [ ] **Step 1: 建立 package.json**

`apps/web/package.json`：

```json
{
  "name": "web",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "check": "astro check",
    "test": "vitest run",
    "preview": "astro preview"
  },
  "dependencies": {
    "@astrojs/react": "^4.0.0",
    "@livesite/shared": "workspace:*",
    "@supabase/supabase-js": "^2.48.0",
    "astro": "^5.0.0",
    "fast-xml-parser": "^5.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@astrojs/check": "^0.9.0",
    "@tailwindcss/vite": "^4.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: 建立 Astro 設定與 tsconfig**

`apps/web/astro.config.mjs`：

```js
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
  integrations: [react()],
  vite: { plugins: [tailwindcss()] },
});
```

`apps/web/tsconfig.json`：

```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "react"
  },
  "include": [".astro/types.d.ts", "src"]
}
```

- [ ] **Step 3: 建立全域樣式與最小首頁**

`apps/web/src/styles/global.css`：

```css
@import "tailwindcss";
```

`apps/web/src/pages/index.astro`：

```astro
---
import "../styles/global.css";
---

<html lang="zh-Hant">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>LiveSite</title>
  </head>
  <body class="bg-zinc-950 text-zinc-100">
    <h1 class="p-8 text-2xl font-bold">LiveSite 骨架 OK</h1>
  </body>
</html>
```

- [ ] **Step 4: 安裝並驗證建置**

Run: `pnpm install`
Expected: 安裝成功。

Run: `pnpm --filter web build`
Expected: 建置成功，產出 `apps/web/dist/index.html`。

Run: `pnpm --filter web check`
Expected: 0 errors。

- [ ] **Step 5: Commit**

```powershell
git add apps/web
git commit -m "feat(web): Astro + React + Tailwind 骨架"
```

---

### Task 4: 網站設定檔與版面（Layout / Nav / Footer / 社群連結）

**Files:**
- Create: `apps/web/src/config/site.ts`
- Create: `apps/web/src/layouts/BaseLayout.astro`
- Create: `apps/web/src/components/Nav.astro`
- Create: `apps/web/src/components/Footer.astro`
- Create: `apps/web/src/components/SocialLinks.astro`

**Interfaces:**
- Consumes: Task 3 的骨架與 `global.css`。
- Produces:
  - `site` 設定物件：`{ name: string; tagline: string; twitchChannel: string; youtubeChannelId: string; embedParents: string[]; links: { label: string; url: string }[] }`（全站唯一的靜態內容來源）
  - `BaseLayout.astro`：props `{ title: string; description?: string }`，含 `<slot />`、Nav、Footer——之後所有頁面都包在這個 Layout 裡
  - `SocialLinks.astro`：無 props，讀 `site.links` 渲染連結列

**執行前先向站主索取真實資料**（Global Constraints 列的清單）；未取得就先用下方範例值，並在 PR/回報中註明待替換。

- [ ] **Step 1: 建立 site 設定檔**

`apps/web/src/config/site.ts`：

```ts
/** 全站靜態內容唯一來源。真實值由站主提供後替換。 */
export const site = {
  name: "頻道名稱",
  tagline: "一句話介紹你的頻道",
  /** Twitch 登入帳號名（網址上那個，全小寫） */
  twitchChannel: "twitchdev",
  /** YouTube 頻道 ID（UC 開頭，於 YouTube 進階設定可查） */
  youtubeChannelId: "UC_x5XG1OV2P6uZZ5FSM9Ttw",
  /**
   * Twitch 嵌入播放器允許的網域（parent 參數）。
   * 部署後把正式網域加進來；localhost 供本機開發。
   */
  embedParents: ["localhost", "livesite-xxx.pages.dev"],
  links: [
    { label: "Twitch", url: "https://twitch.tv/twitchdev" },
    { label: "YouTube", url: "https://youtube.com/@youtube" },
    { label: "X (Twitter)", url: "https://x.com/example" },
    { label: "Discord", url: "https://discord.gg/example" },
  ],
} as const;
```

- [ ] **Step 2: 建立 Nav 與 Footer**

`apps/web/src/components/Nav.astro`：

```astro
---
import { site } from "../config/site";

const items = [
  { href: "/", label: "首頁" },
  { href: "/about", label: "關於我" },
  { href: "/videos", label: "影片" },
];
const current = Astro.url.pathname;
---

<nav class="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
  <div class="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
    <a href="/" class="text-lg font-bold text-violet-400">{site.name}</a>
    <ul class="flex gap-6 text-sm">
      {
        items.map((item) => (
          <li>
            <a
              href={item.href}
              class:list={[
                "transition-colors hover:text-violet-300",
                current === item.href ? "text-violet-400" : "text-zinc-300",
              ]}
            >
              {item.label}
            </a>
          </li>
        ))
      }
    </ul>
  </div>
</nav>
```

`apps/web/src/components/Footer.astro`：

```astro
---
import { site } from "../config/site";
---

<footer class="border-t border-zinc-800 py-8 text-center text-sm text-zinc-500">
  © {new Date().getFullYear()} {site.name} — All rights reserved.
</footer>
```

- [ ] **Step 3: 建立 SocialLinks**

`apps/web/src/components/SocialLinks.astro`：

```astro
---
import { site } from "../config/site";
---

<ul class="flex flex-wrap gap-3">
  {
    site.links.map((link) => (
      <li>
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          class="inline-block rounded-full border border-zinc-700 px-4 py-1.5 text-sm text-zinc-200 transition-colors hover:border-violet-400 hover:text-violet-300"
        >
          {link.label}
        </a>
      </li>
    ))
  }
</ul>
```

- [ ] **Step 4: 建立 BaseLayout 並改寫首頁使用它**

`apps/web/src/layouts/BaseLayout.astro`：

```astro
---
import Footer from "../components/Footer.astro";
import Nav from "../components/Nav.astro";
import { site } from "../config/site";
import "../styles/global.css";

interface Props {
  title: string;
  description?: string;
}

const { title, description = site.tagline } = Astro.props;
---

<html lang="zh-Hant">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content={description} />
    <title>{title} | {site.name}</title>
  </head>
  <body class="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
    <Nav />
    <main class="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <slot />
    </main>
    <Footer />
  </body>
</html>
```

`apps/web/src/pages/index.astro` 改為：

```astro
---
import BaseLayout from "../layouts/BaseLayout.astro";
import SocialLinks from "../components/SocialLinks.astro";
---

<BaseLayout title="首頁">
  <SocialLinks />
</BaseLayout>
```

- [ ] **Step 5: 驗證**

Run: `pnpm --filter web check && pnpm --filter web build`
Expected: 0 errors、建置成功。

- [ ] **Step 6: Commit**

```powershell
git add apps/web/src
git commit -m "feat(web): site 設定檔與 BaseLayout/Nav/Footer/SocialLinks"
```

---

### Task 5: 首頁（主視覺 + Twitch 嵌入）

**Files:**
- Create: `apps/web/src/components/TwitchEmbed.astro`
- Modify: `apps/web/src/pages/index.astro`

**Interfaces:**
- Consumes: `site.twitchChannel`、`site.embedParents`（Task 4）、`BaseLayout`（Task 4）。
- Produces: `TwitchEmbed.astro`（無 props，讀 site 設定）；完整首頁。Task 9 會在首頁 `<!-- NEWS_SLOT -->` 註解處插入最新消息區塊。

- [ ] **Step 1: 建立 TwitchEmbed 元件**

Twitch 嵌入播放器規則：iframe 的 `parent` 參數必須列出所有嵌入它的網域，可重複多個 `&parent=`；沒列到的網域會顯示黑畫面（部署後務必把正式網域加入 `site.embedParents`）。

`apps/web/src/components/TwitchEmbed.astro`：

```astro
---
import { site } from "../config/site";

const parents = site.embedParents.map((p) => `&parent=${p}`).join("");
const src = `https://player.twitch.tv/?channel=${site.twitchChannel}${parents}&muted=true&autoplay=true`;
---

<div class="aspect-video w-full overflow-hidden rounded-xl border border-zinc-800 bg-black">
  <iframe
    src={src}
    title={`${site.name} 的 Twitch 直播`}
    class="h-full w-full"
    allowfullscreen></iframe>
</div>
<p class="mt-2 text-xs text-zinc-500">
  沒開台時播放器會顯示離線畫面。到
  <a href={`https://twitch.tv/${site.twitchChannel}`} class="underline hover:text-violet-300" target="_blank" rel="noopener noreferrer">Twitch 頻道</a>
  追隨開台通知。
</p>
```

- [ ] **Step 2: 完成首頁**

`apps/web/src/pages/index.astro`：

```astro
---
import SocialLinks from "../components/SocialLinks.astro";
import TwitchEmbed from "../components/TwitchEmbed.astro";
import BaseLayout from "../layouts/BaseLayout.astro";
import { site } from "../config/site";
---

<BaseLayout title="首頁">
  <section class="py-8 text-center">
    <h1 class="text-4xl font-black tracking-tight">{site.name}</h1>
    <p class="mt-3 text-lg text-zinc-400">{site.tagline}</p>
    <div class="mt-6 flex justify-center">
      <SocialLinks />
    </div>
  </section>

  <section class="py-6">
    <h2 class="mb-4 text-xl font-bold">📺 直播</h2>
    <TwitchEmbed />
  </section>

  <!-- NEWS_SLOT：Task 9 在此插入最新消息區塊 -->
</BaseLayout>
```

- [ ] **Step 3: 驗證（建置＋本機目視）**

Run: `pnpm --filter web check && pnpm --filter web build`
Expected: 0 errors、建置成功。

Run: `pnpm --filter web dev`，開 `http://localhost:4321`
Expected: 首頁呈現主視覺、連結列、Twitch 播放器區塊（範例頻道沒開台會顯示離線畫面，屬正常）。確認後停掉 dev server。

- [ ] **Step 4: Commit**

```powershell
git add apps/web/src
git commit -m "feat(web): 首頁主視覺與 Twitch 嵌入播放器"
```

---

### Task 6: 關於我頁

**Files:**
- Create: `apps/web/src/pages/about.astro`

**Interfaces:**
- Consumes: `BaseLayout`、`SocialLinks`、`site`（Task 4）。
- Produces: `/about` 頁面。文案為佔位範例，站主提供後直接替換此檔內文。

- [ ] **Step 1: 建立頁面**

`apps/web/src/pages/about.astro`：

```astro
---
import SocialLinks from "../components/SocialLinks.astro";
import BaseLayout from "../layouts/BaseLayout.astro";
import { site } from "../config/site";
---

<BaseLayout title="關於我">
  <article class="prose prose-invert mx-auto max-w-2xl py-8">
    <h1>關於 {site.name}</h1>
    <p>
      （自介文案佔位——站主提供後替換。）大家好，我是 {site.name}，
      主要在 Twitch 直播、YouTube 上傳精華影片。
    </p>
    <h2>直播時間</h2>
    <p>（時刻表佔位——例如：每週二、四、六晚上 8 點。）</p>
    <h2>找到我</h2>
  </article>
  <div class="mx-auto max-w-2xl">
    <SocialLinks />
  </div>
</BaseLayout>
```

註：`prose` 類別來自 Tailwind Typography。若建置時樣式未生效，安裝官方外掛：`pnpm --filter web add -D @tailwindcss/typography`，並在 `global.css` 加一行 `@plugin "@tailwindcss/typography";`。

- [ ] **Step 2: 驗證**

Run: `pnpm --filter web check && pnpm --filter web build`
Expected: 0 errors、建置成功，`dist/about/index.html` 存在。

- [ ] **Step 3: Commit**

```powershell
git add apps/web/src apps/web/package.json pnpm-lock.yaml
git commit -m "feat(web): 關於我頁"
```

---

### Task 7: YouTube RSS 解析（TDD）與影片牆頁

**Files:**
- Create: `apps/web/src/lib/youtube.ts`
- Test: `apps/web/src/lib/youtube.test.ts`
- Create: `apps/web/src/pages/videos.astro`

**Interfaces:**
- Consumes: `site.youtubeChannelId`（Task 4）、`BaseLayout`（Task 4）。
- Produces:
  - `feedUrl(channelId: string): string`
  - `parseYouTubeFeed(xml: string): YouTubeVideo[]`，其中 `YouTubeVideo = { id: string; title: string; publishedAt: string; thumbnailUrl: string; url: string }`
  - `/videos` 頁（建置時抓 RSS；失敗時顯示錯誤訊息而非建置失敗）

- [ ] **Step 1: 寫失敗測試**

`apps/web/src/lib/youtube.test.ts`：

```ts
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
```

- [ ] **Step 2: 執行測試，確認失敗**

Run: `pnpm --filter web test`
Expected: FAIL — 找不到模組 `./youtube`。

- [ ] **Step 3: 實作解析器**

`apps/web/src/lib/youtube.ts`：

```ts
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
```

- [ ] **Step 4: 執行測試，確認通過**

Run: `pnpm --filter web test`
Expected: PASS（4 tests）。

- [ ] **Step 5: 建立影片牆頁**

建置時抓取；抓不到（斷網、頻道 ID 錯）不讓建置炸掉，改渲染錯誤區塊。

`apps/web/src/pages/videos.astro`：

```astro
---
import BaseLayout from "../layouts/BaseLayout.astro";
import { site } from "../config/site";
import { feedUrl, parseYouTubeFeed, type YouTubeVideo } from "../lib/youtube";

let videos: YouTubeVideo[] = [];
let loadError = false;
try {
  const res = await fetch(feedUrl(site.youtubeChannelId));
  if (!res.ok) throw new Error(`RSS ${res.status}`);
  videos = parseYouTubeFeed(await res.text());
} catch (err) {
  console.error("[videos] 抓取 YouTube RSS 失敗：", err);
  loadError = true;
}
---

<BaseLayout title="影片">
  <h1 class="mb-6 text-2xl font-bold">🎬 最新影片</h1>

  {
    loadError && (
      <p class="rounded-lg border border-amber-700 bg-amber-950/40 p-4 text-amber-300">
        暫時無法載入影片清單，請直接到
        <a
          href={`https://www.youtube.com/channel/${site.youtubeChannelId}`}
          class="underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          YouTube 頻道
        </a>
        觀看。
      </p>
    )
  }

  <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
    {
      videos.map((v) => (
        <a
          href={v.url}
          target="_blank"
          rel="noopener noreferrer"
          class="group overflow-hidden rounded-xl border border-zinc-800 transition-colors hover:border-violet-400"
        >
          <img
            src={v.thumbnailUrl}
            alt={v.title}
            loading="lazy"
            class="aspect-video w-full object-cover"
          />
          <div class="p-3">
            <h2 class="line-clamp-2 text-sm font-semibold group-hover:text-violet-300">
              {v.title}
            </h2>
            <time class="mt-1 block text-xs text-zinc-500" datetime={v.publishedAt}>
              {new Date(v.publishedAt).toLocaleDateString("zh-TW")}
            </time>
          </div>
        </a>
      ))
    }
  </div>
</BaseLayout>
```

- [ ] **Step 6: 驗證**

Run: `pnpm --filter web check && pnpm --filter web build`
Expected: 0 errors、建置成功；建置輸出無 `[videos] 抓取 YouTube RSS 失敗` 訊息（範例頻道 ID 是 Google Developers 官方頻道，可正常抓到）。

- [ ] **Step 7: Commit**

```powershell
git add apps/web/src
git commit -m "feat(web): YouTube RSS 解析與影片牆頁"
```

---

### Task 8: Supabase 基礎（news 資料表、客戶端、環境變數）

**Files:**
- Create: `supabase/migrations/0001_news.sql`
- Create: `apps/web/src/lib/supabase.ts`
- Create: `apps/web/.env.example`

**Interfaces:**
- Consumes: 無程式依賴；需站主手動建立 Supabase 專案（見 Step 1）。
- Produces:
  - `news` 資料表（欄位：`id uuid`、`title text`、`body text`、`pinned boolean`、`published_at timestamptz`），RLS 唯讀公開
  - `hasSupabase: boolean` 與 `getSupabase(): SupabaseClient | null`（env 未設定時回傳 null，網站不炸）
  - env 名稱：`PUBLIC_SUPABASE_URL`、`PUBLIC_SUPABASE_ANON_KEY`

- [ ] **Step 1: 站主手動建立 Supabase 專案**

請站主到 <https://supabase.com> 建立免費專案（區域選 Northeast Asia (Tokyo) 或 Southeast Asia (Singapore)），完成後從 Project Settings → API 取得 **Project URL** 與 **anon public key** 兩個值。此步驟無法自動化；若站主暫時不便，先寫 `.env.example` 與程式碼，此任務其餘步驟照做（網站在無 env 時正常運作）。

- [ ] **Step 2: 撰寫 migration SQL**

`supabase/migrations/0001_news.sql`：

```sql
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
```

站主（或執行者在站主提供專案後）到 Supabase Studio → SQL Editor 貼上執行，並手動插入一筆測試資料：

```sql
insert into public.news (title, body, pinned)
values ('網站上線', '歡迎來到我的新家！之後公告都會發在這裡。', true);
```

- [ ] **Step 3: 建立客戶端工廠與 .env.example**

`apps/web/.env.example`：

```
# Supabase 專案設定（Project Settings → API）。兩者皆為可公開值。
PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

`apps/web/src/lib/supabase.ts`：

```ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined;

/** env 是否已設定。未設定時動態區塊應顯示提示，而非嘗試連線。 */
export const hasSupabase = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!hasSupabase) return null;
  client ??= createClient(url!, anonKey!);
  return client;
}
```

- [ ] **Step 4: 驗證**

Run: `pnpm --filter web check && pnpm --filter web build`
Expected: 0 errors、建置成功（無 `.env` 也必須成功——這驗證了「缺 env 不炸」的約束）。

- [ ] **Step 5: Commit**

```powershell
git add supabase apps/web/src/lib/supabase.ts apps/web/.env.example
git commit -m "feat: Supabase news 資料表 migration 與網站客戶端"
```

---

### Task 9: 最新消息（TDD 排序邏輯 + React 島嶼 + 首頁整合）

**Files:**
- Create: `apps/web/src/lib/news.ts`
- Test: `apps/web/src/lib/news.test.ts`
- Create: `apps/web/src/components/NewsList.tsx`
- Modify: `apps/web/src/pages/index.astro`（`<!-- NEWS_SLOT -->` 處）

**Interfaces:**
- Consumes: `getSupabase` / `hasSupabase`（Task 8）、首頁的 `NEWS_SLOT` 註解（Task 5）。
- Produces:
  - `NewsItem = { id: string; title: string; body: string; pinned: boolean; publishedAt: string }`
  - `toNewsItems(rows: NewsRow[]): NewsItem[]`——置頂優先、再依發布時間新到舊；`NewsRow` 為資料庫列 `{ id: string; title: string; body: string; pinned: boolean; published_at: string }`
  - `<NewsList limit={number} />` React 島嶼（client:load）

- [ ] **Step 1: 寫失敗測試**

`apps/web/src/lib/news.test.ts`：

```ts
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
```

- [ ] **Step 2: 執行測試，確認失敗**

Run: `pnpm --filter web test`
Expected: FAIL — 找不到模組 `./news`（youtube 測試維持 PASS）。

- [ ] **Step 3: 實作排序/映射**

`apps/web/src/lib/news.ts`：

```ts
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
```

- [ ] **Step 4: 執行測試，確認通過**

Run: `pnpm --filter web test`
Expected: PASS（youtube 4 + news 3 = 7 tests）。

- [ ] **Step 5: 建立 NewsList 島嶼**

`apps/web/src/components/NewsList.tsx`：

```tsx
import { useEffect, useState } from "react";
import { getSupabase, hasSupabase } from "../lib/supabase";
import { toNewsItems, type NewsItem, type NewsRow } from "../lib/news";

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; items: NewsItem[] };

export default function NewsList({ limit = 5 }: { limit?: number }) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    supabase
      .from("news")
      .select("id, title, body, pinned, published_at")
      .order("published_at", { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (error) {
          console.error("[news] 讀取失敗：", error.message);
          setState({ status: "error" });
        } else {
          setState({ status: "ready", items: toNewsItems((data ?? []) as NewsRow[]).slice(0, limit) });
        }
      });
  }, [limit]);

  if (!hasSupabase) {
    return <p className="text-sm text-zinc-500">（尚未設定公告資料來源）</p>;
  }
  if (state.status === "loading") {
    return <p className="text-sm text-zinc-500">載入中…</p>;
  }
  if (state.status === "error") {
    return <p className="text-sm text-amber-400">公告暫時無法載入。</p>;
  }
  if (state.items.length === 0) {
    return <p className="text-sm text-zinc-500">目前沒有公告。</p>;
  }

  return (
    <ul className="space-y-4">
      {state.items.map((item) => (
        <li key={item.id} className="rounded-xl border border-zinc-800 p-4">
          <div className="flex items-baseline gap-2">
            {item.pinned && (
              <span className="rounded bg-violet-900/60 px-1.5 py-0.5 text-xs text-violet-300">
                置頂
              </span>
            )}
            <h3 className="font-semibold">{item.title}</h3>
            <time
              className="ml-auto shrink-0 text-xs text-zinc-500"
              dateTime={item.publishedAt}
            >
              {new Date(item.publishedAt).toLocaleDateString("zh-TW")}
            </time>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-300">{item.body}</p>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 6: 首頁整合**

`apps/web/src/pages/index.astro` 的 frontmatter 加入：

```astro
import NewsList from "../components/NewsList";
```

並將 `<!-- NEWS_SLOT：Task 9 在此插入最新消息區塊 -->` 替換為：

```astro
<section class="py-6">
  <h2 class="mb-4 text-xl font-bold">📢 最新消息</h2>
  <NewsList client:load limit={5} />
</section>
```

- [ ] **Step 7: 驗證**

Run: `pnpm --filter web check && pnpm --filter web build && pnpm --filter web test`
Expected: 全數通過。

若站主已提供 Supabase env：建立 `apps/web/.env`（照 `.env.example` 填真值），`pnpm --filter web dev` 開首頁，最新消息區塊應顯示 Task 8 插入的「網站上線」測試公告。無 env 則應顯示「（尚未設定公告資料來源）」。

- [ ] **Step 8: Commit**

```powershell
git add apps/web/src
git commit -m "feat(web): 最新消息區塊（Supabase news + React 島嶼）"
```

---

### Task 10: 部署與自動化（Cloudflare Pages + 每週維持任務）

**Files:**
- Create: `.github/workflows/weekly.yml`
- Create: `docs/deploy.md`

**Interfaces:**
- Consumes: 完整可建置的網站（Task 1–9）；站主的 Cloudflare 與 GitHub 帳號權限。
- Produces: 部署說明文件；每週排程（ping Supabase 防閒置暫停 + 觸發 Cloudflare Pages 重建以更新影片牆）。需要的 GitHub Secrets：`SUPABASE_URL`、`SUPABASE_ANON_KEY`、`CF_PAGES_DEPLOY_HOOK_URL`。

- [ ] **Step 1: 建立每週排程 workflow**

`.github/workflows/weekly.yml`：

```yaml
name: weekly
on:
  schedule:
    - cron: "0 3 * * 1" # 每週一 03:00 UTC（台灣時間 11:00）
  workflow_dispatch: {}

jobs:
  ping-supabase:
    runs-on: ubuntu-latest
    steps:
      - name: 讀一筆 news 保持 Supabase 專案活躍
        run: |
          code=$(curl -s -o /dev/null -w "%{http_code}" \
            "$SUPABASE_URL/rest/v1/news?select=id&limit=1" \
            -H "apikey: $SUPABASE_ANON_KEY")
          echo "HTTP $code"
          test "$code" = "200"
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}

  rebuild-site:
    runs-on: ubuntu-latest
    steps:
      - name: 觸發 Cloudflare Pages 重建（更新影片牆）
        run: curl -s -X POST "${{ secrets.CF_PAGES_DEPLOY_HOOK_URL }}"
```

- [ ] **Step 2: 撰寫部署說明**

`docs/deploy.md`：

```markdown
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
```

- [ ] **Step 3: Commit 並推送**

```powershell
git add .github docs/deploy.md
git commit -m "chore: 每週維持排程與部署說明"
git push
```

- [ ] **Step 4: 站主手動完成部署**

依 `docs/deploy.md` 操作 Cloudflare Pages 與 GitHub Secrets。完成後：

- 開啟 `https://<分配網域>.pages.dev`，三個頁面（`/`、`/about`、`/videos`）正常顯示。
- 首頁最新消息顯示測試公告。
- 把 `pages.dev` 網域加入 `embedParents` 後重新部署，確認 Twitch 播放器有畫面（離線畫面亦可）。
- GitHub Actions 手動觸發一次 `weekly`，兩個 job 均綠燈。

---

## 驗收清單（整個計畫完成的定義）

- [ ] `pnpm build`、`pnpm test`、`pnpm check` 於根目錄全數通過。
- [ ] 網站部署於 Cloudflare Pages，`/`、`/about`、`/videos` 可公開存取。
- [ ] Twitch 播放器在正式網域正常顯示（開台有畫面/離線顯示離線畫面）。
- [ ] 在 Supabase Studio 新增一筆 `news`，重新整理首頁即可看到（無需重新部署）。
- [ ] `weekly` workflow 手動觸發成功。
- [ ] 站主真實資料（頻道帳號、連結、自介文案）已填入 `site.ts` 與 `about.astro`，或已明確記錄為待補。
