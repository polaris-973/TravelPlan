# 滇途 — 云南智能旅游规划工具

一个"打开就能用"的云南旅游规划 PWA，支持 AI 助手全程陪伴、地图驱动的行程规划。iPhone Safari 添加到主屏后获得原生 App 体验。

## 快速开始

```bash
pnpm install && pnpm dev
```

访问 http://localhost:3000，进入首次引导页面配置 API Key 即可开始使用。

## 一键部署

### Vercel（推荐）
1. 推送到 GitHub
2. vercel.com → New Project → 导入仓库
3. 框架选 Vite，点击 Deploy

### Cloudflare Pages
1. pages.cloudflare.com → Connect GitHub
2. 构建命令：`pnpm build`，输出目录：`dist`

## iPhone 添加到主屏幕

1. 用 **Safari** 打开网站
2. 点击底部 **分享** 按钮（方块+箭头）
3. 选择 **"添加到主屏幕"** → 添加
4. 从主屏幕图标打开即可全屏使用

## API Key 获取

| 服务 | 用途 | 价格 | 申请地址 |
|------|------|------|---------|
| **高德地图**（必填） | 地图、路线、搜索、天气 | 个人免费 | lbs.amap.com |
| **智谱 AI**（推荐） | AI 助手，新用户免费额度 | ¥0.05/千 tokens | open.bigmodel.cn |
| **DeepSeek** | 最便宜 | ¥0.001/千 tokens | platform.deepseek.com |
| **Anthropic** | 最强能力，需国际卡 | $3/百万 tokens | console.anthropic.com |

**建议**：日常规划用 DeepSeek（省钱）或智谱（中文好），复杂路线优化用 Claude。

## 架构

- **React 19 + TypeScript + Vite 8**
- **Tailwind CSS 4** — 自定义云南意象配色系统
- **Zustand 5** — 轻量状态管理，支持持久化
- **高德地图 JS API 2.0** — 地图、搜索、路线
- **多 Provider LLM 抽象层** — 统一 `LLMClient` 接口，OpenAI SDK（智谱/DeepSeek）+ Anthropic SDK
- **vite-plugin-pwa** — Service Worker + 离线缓存

## 数据安全

所有 API Key 仅存储在用户浏览器本地，不经过任何第三方服务器。
