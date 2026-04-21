# Deploy to Vercel（私有访问）

## 一次性配置

### 1. 推到 Git 仓库
把项目推到 GitHub / GitLab / Bitbucket 任一即可。

### 2. 在 Vercel 导入
- 登录 <https://vercel.com> → **Add New Project** → 选中这个仓库
- Framework preset 会自动识别为 **Vite**
- Build command / Output directory 会自动读取 `vercel.json`，无需手改

### 3. 设置访问密码（⚠️ 必做，否则任何人都能访问）
Project 页 → **Settings** → **Environment Variables** → **Add New**

| Name | Value | Environments |
|------|-------|--------------|
| `ACCESS_PASSWORD` | 你自己设的强密码（别太短） | ✅ Production ✅ Preview |

保存后 **必须触发一次新部署** 让环境变量生效（Settings → Deployments → Redeploy，或推一个新 commit）。

## 工作原理

- `middleware.ts` 在 Vercel 边缘节点拦截 **所有请求**
- 未登录 → 302 到 `/__auth__` 登录页（一个单文件的毛玻璃风格输入框）
- 密码正确 → 下发 `HttpOnly; Secure; SameSite=Strict` 的 30 天 Cookie
- 之后每次请求自动带 cookie 通过，用户无感知
- 扫描器和机器人看到的永远是登录页，拿不到 JS bundle、API Key、行程数据

## 日常使用

- 一台设备登录一次，30 天有效
- 手动退出：访问 `https://<你的域名>/__auth__/logout`
- 换密码：改 Vercel 环境变量 → Redeploy（已登录的 cookie 自动失效）

## 安全性说明

| 防护 | 强度 |
|---|---|
| 阻止未授权访问 app UI + 资源文件 | ✅ 强（边缘拦截，HTML/JS/CSS 全被挡） |
| 防暴力破解 | ⚠️ 一般（Vercel 本身无速率限制；如需严格请改加 Cloudflare 或 rate-limit 逻辑） |
| Cookie 防劫持 | ✅ HttpOnly + Secure + SameSite=Strict |
| 密码明文存储 | ✅ 仅存 Vercel 环境变量，不进代码仓库 |

如果你有更高安全需求：
- 改用带 TOTP 的短时 token
- 在前面套 Cloudflare Access（免费、5 分钟配完、有 IP/邮箱白名单）

## 本地开发

本地 `npm run dev` 时 **不经过 middleware**（Vite 原生不支持 Vercel middleware），照常无密码使用。middleware 仅在 Vercel 部署时激活。

## 故障排查

| 症状 | 可能原因 |
|---|---|
| 部署后还是能直接访问，没让输密码 | 环境变量 `ACCESS_PASSWORD` 没生效 → 去 Redeploy |
| 输密码正确但循环回登录页 | 浏览器 Cookie 被第三方拦截 → 确认用的是 HTTPS 主域名 |
| 分享链接打不开 | 接收方也得先输密码；如果想让别人看，建议换部署（不启用密码）或用一次性公开 URL |

## 如果以后想彻底公开

把 Vercel 的 `ACCESS_PASSWORD` 删掉并 Redeploy 即可。middleware 检测不到变量就完全放行。
