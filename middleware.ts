/**
 * Vercel Edge Middleware — password gate for private deployment.
 *
 * 工作原理：
 *   1. 所有到达 Vercel 的请求都先进入此中间件（边缘执行，早于静态资源 / SPA）
 *   2. 环境变量 ACCESS_PASSWORD 未设置 → 直接放行（本地开发和预览无影响）
 *   3. cookie tp_auth == 正确密码 → 放行
 *   4. 否则：
 *      - GET  /__auth__          → 渲染登录页
 *      - POST /__auth__          → 验证密码，正确则 302 回 / 并下发 HttpOnly cookie
 *      - 其它路径                → 302 跳到 /__auth__
 *
 * 部署步骤（Vercel Dashboard）：
 *   Settings → Environment Variables → 新增 ACCESS_PASSWORD = <你的密码>
 *   （勾选 Production / Preview / Development 按需）
 *   本地 `npm run dev` 不走此 middleware，照常工作
 *
 * 登出：访问 /__auth__/logout 清 cookie
 */

export const config = {
  // 拦截所有路径（包括资源文件），即使 JS 包也要通过 gate 才能下载
  matcher: '/:path*',
};

const COOKIE_NAME = 'tp_auth';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 天

export default async function middleware(req: Request): Promise<Response | undefined> {
  const url = new URL(req.url);
  const password = process.env.ACCESS_PASSWORD;

  // 未配置密码 → 完全放行（开发环境、预览环境）
  if (!password) return;

  // ── 登出 ────────────────────────────────────────────────────────────────
  if (url.pathname === '/__auth__/logout') {
    return new Response(null, {
      status: 302,
      headers: {
        'Location': '/__auth__',
        'Set-Cookie': `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
      },
    });
  }

  // ── 登录页 (GET) ────────────────────────────────────────────────────────
  if (url.pathname === '/__auth__' && req.method === 'GET') {
    return renderLoginPage();
  }

  // ── 密码验证 (POST) ─────────────────────────────────────────────────────
  if (url.pathname === '/__auth__' && req.method === 'POST') {
    const form = await req.formData();
    const submitted = form.get('password');
    if (typeof submitted === 'string' && submitted === password) {
      return new Response(null, {
        status: 302,
        headers: {
          'Location': '/',
          'Set-Cookie': `${COOKIE_NAME}=${encodeURIComponent(password)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${COOKIE_MAX_AGE}`,
        },
      });
    }
    return renderLoginPage('密码不正确，请重试');
  }

  // ── 校验 cookie ─────────────────────────────────────────────────────────
  const cookie = req.headers.get('cookie') ?? '';
  const m = cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  if (m && decodeURIComponent(m[1]) === password) {
    return; // 放行
  }

  // ── 未授权 → 跳登录页 ───────────────────────────────────────────────────
  return Response.redirect(new URL('/__auth__', url).toString(), 302);
}

function renderLoginPage(error?: string): Response {
  const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
<meta name="theme-color" content="#3A7A8C" />
<title>滇途 · 登录</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    height: 100%;
    font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
    background: linear-gradient(180deg, #F5F5F2 0%, #EAF0EE 60%, #D4E4E0 100%);
    color: #2B2B2B;
    -webkit-font-smoothing: antialiased;
  }
  body {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }
  .card {
    width: 100%;
    max-width: 340px;
    padding: 28px 24px;
    border-radius: 22px;
    background: rgba(255,255,255,0.8);
    backdrop-filter: blur(24px) saturate(180%);
    -webkit-backdrop-filter: blur(24px) saturate(180%);
    box-shadow: 0 10px 40px rgba(58,122,140,0.12), 0 2px 8px rgba(0,0,0,0.04);
    border: 1px solid rgba(255,255,255,0.6);
  }
  .logo {
    font-size: 40px;
    text-align: center;
    margin-bottom: 8px;
  }
  h1 {
    font-size: 19px;
    text-align: center;
    color: #1F2933;
    margin-bottom: 4px;
    font-weight: 600;
  }
  .sub {
    text-align: center;
    color: #6B7280;
    font-size: 12px;
    margin-bottom: 22px;
    line-height: 1.5;
  }
  input[type="password"] {
    width: 100%;
    padding: 12px 14px;
    font-size: 14px;
    border: 1px solid rgba(58,122,140,0.2);
    background: rgba(255,255,255,0.7);
    border-radius: 12px;
    outline: none;
    transition: border-color 150ms, box-shadow 150ms;
    color: #1F2933;
  }
  input[type="password"]:focus {
    border-color: #3A7A8C;
    box-shadow: 0 0 0 3px rgba(58,122,140,0.12);
  }
  button {
    width: 100%;
    margin-top: 10px;
    padding: 12px 14px;
    font-size: 14px;
    font-weight: 600;
    border: none;
    border-radius: 12px;
    background: linear-gradient(135deg, #3A7A8C 0%, #2C5F6B 100%);
    color: white;
    cursor: pointer;
    transition: transform 100ms, box-shadow 150ms;
    box-shadow: 0 2px 8px rgba(58,122,140,0.3);
  }
  button:hover { box-shadow: 0 4px 14px rgba(58,122,140,0.4); }
  button:active { transform: scale(0.98); }
  .error {
    margin-top: 12px;
    padding: 8px 12px;
    background: rgba(200,90,62,0.1);
    color: #C85A3E;
    font-size: 12px;
    border-radius: 10px;
    text-align: center;
  }
  .foot {
    margin-top: 18px;
    font-size: 11px;
    text-align: center;
    color: #9AA0A6;
  }
</style>
</head>
<body>
<form class="card" method="POST" action="/__auth__" autocomplete="off">
  <div class="logo">🏔️</div>
  <h1>滇途</h1>
  <p class="sub">私人访问 · 请输入密码</p>
  <input type="password" name="password" autofocus required placeholder="密码" />
  <button type="submit">进入</button>
  ${error ? `<div class="error">${escapeHtml(error)}</div>` : ''}
  <div class="foot">云南智能旅行规划</div>
</form>
</body>
</html>`;
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]!));
}
