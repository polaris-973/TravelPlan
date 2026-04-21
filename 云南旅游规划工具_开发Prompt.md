# 云南智能旅游规划工具 — 开发 Prompt

## 🎭 你的角色

你是一位资深全栈工程师 + 产品设计师，同时深度理解云南旅游场景（高海拔、多民族、立体气候、山路交通）。你将设计并交付一个**移动端优先**、**地图驱动**、**LLM 智能助手全程陪伴**的云南旅游规划 Web 应用。请用**一次性产出高质量可运行代码**的标准来要求自己，不要占位符、不要 TODO。

---

## 🎯 产品目标

构建一个"打开就能用"的云南旅游规划工具，用户可以：
1. 在地图上自由增删、拖拽调整想去的地点
2. 获得基于实时路况/距离/时间的**最优路线规划**
3. 每个景点自动附带攻略备注、天气、最佳游览时段
4. 通过内嵌的 LLM 助手用自然语言调整行程（"帮我在大理多加一天"、"避开雨天景点"）
5. 在 iPhone Safari / 微信内置浏览器中流畅使用，支持离线查看已规划行程

---

## 📱 平台与技术栈要求

### 必须满足
- **部署形态：PWA（渐进式 Web 应用）**。用户通过 iPhone Safari 打开网址 → "添加到主屏幕" → 获得接近原生 App 的全屏体验，无需 App Store 审核
- **移动端优先**：基准视口 iPhone 14 (390×844)，支持安全区（notch/home indicator），所有交互为触摸优先
- **自适应**：iPad、桌面端自动适配，但不牺牲移动体验
- **技术栈**：React + TypeScript + Tailwind CSS，使用 Vite 构建
- **地图**：通过 **Amap MCP (高德地图 MCP Server)** 调用，包含路线规划、POI 搜索、天气、地理编码等
- **LLM 接入**：**多提供商架构**，用户在设置中选择使用哪家。默认支持以下三家，且架构要保留后续扩展能力（设计成 Provider 接口，新增一家只需实现接口）：
  - **智谱 AI**（默认推荐）：`glm-4-plus` 或 `glm-4-air`，baseURL `https://open.bigmodel.cn/api/paas/v4`
  - **DeepSeek**：`deepseek-chat`，baseURL `https://api.deepseek.com/v1`
  - **Anthropic**：`claude-sonnet-4-20250514`
  - 智谱和 DeepSeek 兼容 OpenAI SDK 格式，用统一 OpenAI-compatible client 调用；Anthropic 用官方 SDK
  - 所有 Provider 实现统一接口：`chat(messages, tools) → stream`，对上层业务透明
- **状态管理**：Zustand（轻量，适合移动端）
- **持久化**：使用 `window.storage` API 保存用户行程（非 localStorage）
- **未来可扩展**：代码结构要保证未来可用 Capacitor 零改动打包为原生 iOS App（即避免用任何浏览器独有、无 Capacitor 等价实现的能力）

### PWA 必需配置（让"添加到主屏"后有原生 App 观感）
- `manifest.json` 配置 `display: "standalone"`、主题色、图标（192×192 + 512×512 + Apple Touch Icon 180×180）
- Service Worker 缓存应用壳（HTML/CSS/JS）+ 策略性缓存地图瓦片与已规划行程，断网可打开已访问页
- `<meta name="apple-mobile-web-app-capable" content="yes">` + `apple-mobile-web-app-status-bar-style="black-translucent"`
- Apple Splash Screen 适配主流 iPhone 尺寸，启动不闪白屏
- 所有固定元素用 `env(safe-area-inset-*)` 处理刘海与 Home Indicator
- 关闭默认的橡皮筋回弹、双击缩放、长按选中文本等"网页感"行为

### 接口配置约定
```ts
// 用户在设置面板填入，保存在 window.storage
type LLMProvider = 'zhipu' | 'deepseek' | 'anthropic';

interface APIConfig {
  // LLM 配置（多提供商，用户选一个激活）
  activeLLMProvider: LLMProvider;
  llmKeys: {
    zhipu?: string;      // 智谱 API Key
    deepseek?: string;   // DeepSeek API Key
    anthropic?: string;  // Anthropic API Key
  };
  llmModel?: {
    // 每个 provider 下用户可选模型（给默认值但允许覆盖）
    zhipu?: string;      // 默认 'glm-4-plus'
    deepseek?: string;   // 默认 'deepseek-chat'
    anthropic?: string;  // 默认 'claude-sonnet-4-20250514'
  };

  // 地图配置
  amapMcpEndpoint: string;   // Amap MCP server URL
  amapApiKey?: string;       // 降级方案：直接调 Amap Web API
}
```

### LLM Provider 抽象层（必须实现）
所有 LLM 调用经过统一的 `LLMClient` 接口，上层业务代码完全不感知具体厂商：

```ts
interface LLMClient {
  chat(params: {
    messages: ChatMessage[];
    tools?: ToolDefinition[];       // 统一用 OpenAI function calling 格式
    stream: true;
    systemPrompt?: string;
  }): AsyncIterable<ChatChunk>;     // 统一的流式输出格式
}

// 工厂方法根据 activeLLMProvider 返回对应实现
function createLLMClient(config: APIConfig): LLMClient;
```

**实现要点：**
- `ZhipuClient` 和 `DeepSeekClient` 底层共用 OpenAI SDK（`openai` npm 包），只改 `baseURL` 和 `apiKey`
- `AnthropicClient` 用 `@anthropic-ai/sdk`
- 三家的工具调用格式、流式事件格式做统一适配，上层只看到标准化的 `ChatChunk`
- 切换 Provider 不需要重启，不丢失对话历史

---

## 🗺️ 核心功能（P0，必须完整实现）

### 1. 地图可视化与交互
- **全屏地图**占据主视图，底部抽屉式面板（可上拉展开/下拉收起，类似 Apple Maps、小红书地图）
- 地点标记（marker）要**可点击、可长按拖动、可滑动删除**
- 不同类型地点**图标区分**：自然景观（山）、人文古迹（塔）、美食（碗）、住宿（床）、交通枢纽（火车）
- 路线以**渐变色折线**绘制，显示不同交通方式（自驾/高铁/飞行）
- 支持**地图图层切换**：标准 / 卫星 / 地形（云南多山，地形图很重要）
- **当前位置**蓝点 + 朝向指示
- 点击标记弹出 **Bottom Sheet** 显示景点详情（不要用居中弹窗，移动端难用）

### 2. 地点管理
用户可以通过以下方式添加地点：
- **搜索**（顶部搜索栏，Amap POI 搜索 + 拼音/模糊匹配）
- **地图长按空白处** → "添加此位置"
- **从推荐列表点击**（如"大理经典 5 日"模板）
- **语音**（调用浏览器 Web Speech API，说"我想去玉龙雪山"）
- **LLM 助手对话**（"帮我加上丽江古城和束河"）

每个地点卡片包含：
- 名称、类型、评分、开放时间、门票
- 用户自定义**停留时长**（滑块调整，影响总行程）
- 用户自定义**优先级**（必去 / 想去 / 备选）
- **备注**（文字 + 拍照/相册图片）
- **到达日期**（可拖拽重排改变顺序）

### 3. 路线规划（核心算法）
- 调用 Amap MCP 的路线规划接口，支持**驾车 / 步行 / 公共交通 / 骑行**
- 对多点行程执行**TSP 近似优化**（用户可选"起终点固定"或"自由优化"）
- 按**每日**自动分段：考虑每天 8 小时游览 + 景点停留时长 + 通勤时间
- 显示总里程、总耗时、预估油费/车费、高速费
- **云南特色逻辑**：
  - 标注海拔 > 2500m 的路段（预警高反）
  - 山路路段提示"弯道多，易晕车"
  - 雨季（6-9 月）对泥石流高发路段给出警告（结合天气接口）
- 用户可**锁定某段**（"大理→丽江必须走高铁"），算法在此约束下优化其余路段

### 4. 天气与气候信息
- 每个地点显示**未来 7 天天气**（通过 Amap MCP 天气接口）
- **紫外线指数**（云南高原紫外线强，重要）
- **穿衣建议**：云南"一天四季"，早晚温差大，要明确提示
- **雨季/旱季判断**并给出季节性推荐
- 如果某日预报不佳（暴雨/冰雹），在时间轴上**高亮警告**并建议调整顺序

### 5. LLM 智能助手
- 悬浮按钮（右下角，避开 iPhone 底部手势区域），点击展开聊天面板
- 助手**全程感知当前行程状态**（当前地点列表、日期、用户偏好），通过 system prompt 注入
- 支持的交互：
  - 自然语言修改行程："把第三天改成轻松点，只去一个景点"
  - 智能推荐："我是文艺青年，推荐大理适合我的咖啡馆"
  - 实时问答："玉龙雪山需要带什么"、"香格里拉有高反怎么办"
  - **通过 MCP 调用工具**：搜 POI、查路线、查天气、订票链接
- **流式响应**（SSE），不要等全部返回再显示
- 保存历史对话，支持**多轮上下文**

---

## ✨ 增强功能（P1，强烈建议加入）

基于云南旅游特性和移动端最佳实践，以下功能应当内置：

### 6. 云南专属功能
- **海拔图表**：整个行程的海拔变化曲线图，标注超过 3000m 的区段
- **高反预警与建议**：基于目的地海拔（香格里拉 3280m、德钦 3400m、梅里雪山垭口 4292m）给出适应建议、药品清单
- **少数民族文化卡片**：到达白族（大理）、纳西族（丽江）、傣族（西双版纳）、藏族（迪庆）聚居地时，弹出礼仪提醒、常用问候语、禁忌说明
- **本地美食推荐**：每到一个城市自动推荐在地美食，附带"哪家店口碑最好"（通过 LLM 结合 POI 评分综合给出）
- **最佳摄影点与时间**：日出日落时刻 + 推荐机位（如洱海生态廊道日出、玉龙雪山蓝月谷午后逆光）

### 7. 行程辅助工具
- **预算计算器**：交通 + 住宿 + 门票 + 餐饮 + 杂项，给出总预算 / 人均 / 每日花费
- **打包清单生成**：根据季节 + 海拔 + 活动类型自动生成（例如：防晒霜、冲锋衣、高反药、身份证、学生证）
- **门票/交通预订提醒**：标记哪些景点需提前预约（如普达措、玉龙雪山冰川公园）
- **紧急信息页**：离线可查的医院、报警、领事馆、道路救援电话，每个城市一张卡片
- **离线行程导出**：一键导出为 PDF / 分享链接 / 添加到日历

### 8. 移动端专属体验
- **语音输入**到处可用（搜索框、助手、备注）
- **触感反馈**（`navigator.vibrate`）在拖拽、添加、删除时轻震
- **手势导航**：底部抽屉支持上下滑动、左右切换不同日程
- **深色模式**自动跟随系统
- **省流模式**：弱网下降低地图瓦片分辨率、禁用动画
- **添加到主屏幕**（PWA manifest + Service Worker 缓存关键资源）
- **状态恢复**：意外关闭浏览器后，下次打开保留所有规划

### 9. 协作与记忆
- **分享行程**：生成短链 / 二维码，同伴打开可见只读版本
- **旅行日记**：到达某地点后可录入文字+照片，行程结束后自动生成图文回忆册
- **历史行程**：保存过去规划过的行程，支持"基于上次的云南行再规划一次"

---

## 🎨 UI/UX 设计要求（审美是本项目的一级标准，不是装饰）

### 设计哲学
这不是一个"工具感"的 App，也不是 SaaS 后台。它的气质应当像 **苹果原生地图 × 小宇宙 × 日本旅行杂志 × 少数派**。用户打开时要有"**这做得真讲究**"的第一反应，而不是"这像个 Demo"。

关键原则：
- **少即是多**：一屏只解决一件事，信息用留白和层级区分，不靠边框和分割线
- **节制的动效**：所有过渡使用 iOS 标准 `cubic-bezier(0.25, 0.1, 0.25, 1)`，150-350ms，不要弹跳、不要浮夸
- **地图是主角**：UI 元素是地图的"辅助浮层"，要轻、要透,不能遮挡风景
- **质感优于图标**：合理使用毛玻璃、微投影、细微渐变，拒绝扁平纯色块的廉价感

### 配色系统（云南意象，慎用高饱和）
```
主色 Primary：   #3A7A8C  洱海青（沉静、可信）
强调色 Accent：  #C85A3E  古城砖红（仅用于关键 CTA 与当前位置标记）
辅助色：         #8BA888  茶山绿（自然类景点）
                #D4A574  茶马驼（文化类景点）
                #6B7FA8  雪山蓝（高海拔标识）
中性色：         #FAFAF7 浅底 / #1C1C1E 深底
文字：           #1C1C1E 主 / #6E6E73 次 / #A1A1A6 辅
```
**禁用**：饱和度超过 80% 的荧光色、渐变彩虹、纯黑 `#000`、纯白 `#FFF`（会显得廉价和刺眼）

### 字体
- 中文：`"PingFang SC", -apple-system, "Helvetica Neue", sans-serif`
- 数字和英文：`"SF Pro Display", "Inter", sans-serif`
- 字号层级：11 / 13 / 15 / 17（正文）/ 20 / 24 / 28 / 34（大标题）
- 行高：正文 1.5，标题 1.2
- 大标题用 `font-weight: 600`（semibold），不要 bold；正文 400

### 图标
- 统一使用 **Lucide React**，线型为主，`strokeWidth={1.5}`
- 景点类型图标可以用更有性格的 emoji 或自定义 SVG（如 🏔️ 🏯 🍜），但整个 App 风格要一致
- 永远不要混用线型和填充图标

### 质感细节
- **圆角层级**：按钮 `rounded-xl` (12px)、卡片 `rounded-2xl` (16px)、Bottom Sheet `rounded-t-3xl` (24px)
- **投影**：仅用柔和大范围投影 `box-shadow: 0 8px 32px rgba(0,0,0,0.08)`，不要 Tailwind 默认 `shadow-md/lg`
- **毛玻璃**：顶栏、Bottom Sheet 头部、浮动按钮背景用 `backdrop-blur-xl bg-white/70`（浅色）或 `bg-black/40`（深色）
- **分割线**：用 `rgba(0,0,0,0.06)` 的 1px，不要用 `border-gray-200`
- **图片**：所有景点图都要有极轻的渐变遮罩（底部 20% 从透明到 `rgba(0,0,0,0.3)`），便于叠加文字且增加质感

### 动效规范
- 页面切换：fade + 上移 8px，250ms
- Bottom Sheet 展开：spring-like 缓动，320ms
- 按钮点击：轻微 `scale(0.97)` + 触感振动（`navigator.vibrate(10)`）
- 列表项拖拽：跟手 + 投影加深 + 微放大到 `scale(1.02)`
- **绝对禁止**：弹跳式 bounce、闪烁、旋转加载图标（用苹果式的三点脉冲或骨架屏）

### 关键界面范式
- **首屏**：地图铺满，顶部一个浮动搜索栏（毛玻璃），底部抽屉收起时只露出一条"今日行程"（3 个地点预览 + 当前天气），上拉展开完整日程
- **景点详情卡片**：顶部大图（16:9），下方景点名大字 + 一行辅助信息，评分/门票/时长用 iOS 风格小 pill
- **LLM 助手**：悬浮气泡按钮（右下 `safe-area-inset-bottom + 20px`），展开为全屏模态（从底部滑上，可下拉关闭），对话气泡用 iMessage 风格
- **空状态**：一定要精心设计，用淡雅的插图或引导文案，不要"暂无数据"这种冰冷字样
- **设置页 - LLM Provider 切换**：用 iOS 风格分组列表，每个 Provider 一张卡片：显示 logo/名称、当前状态（已配置/未配置）、轻点展开填入 API Key 和选择模型；顶部有一个当前激活 Provider 的明显指示；切换 Provider 不需要重启也不丢失对话历史

### 关键交互原则
1. **任何破坏性操作**（删除地点、清空行程）都要有**撤销** toast（3 秒内可撤回），toast 样式参考 iOS 灵动岛
2. **LLM 每次修改行程前都要预览 diff**，用户确认后再应用，绝不静默改写
3. **加载状态**：地图瓦片、路线计算、LLM 响应都要有骨架屏或明确进度，不留白屏
4. **错误处理**：Amap/LLM 接口失败给出友好提示（比如"信号不太好呢"而不是"Error 500"）+ 一键重试 + 降级方案
5. **首次使用**：3 步引导（输入 key → 选模板/空白 → 添加第一个地点），不超过 30 秒可开始用，引导动画要精致

### 审美验收标准（任一项不满足都视为未完成）
- [ ] 关闭 App 截屏给朋友看，朋友会问"这是什么 App，看起来很高级"
- [ ] 每个页面能独立作为 Dribbble 作品上传
- [ ] 深色模式不是简单反色，而是独立调校过的一套配色
- [ ] 任何位置没有 Tailwind 默认的 `bg-blue-500` / `text-gray-500` 这种"未设计"的颜色
- [ ] 所有空状态、错误页、加载页都经过设计，不是系统默认样式

---

## 🧱 推荐的核心数据结构

```ts
interface Trip {
  id: string;
  title: string;              // "云南 7 日环线"
  startDate: string;          // ISO
  endDate: string;
  travelers: number;
  preferences: {
    pace: 'relaxed' | 'balanced' | 'packed';
    interests: ('nature' | 'culture' | 'food' | 'photography' | 'adventure')[];
    budget: 'budget' | 'mid' | 'luxury';
    avoidAltitude: boolean;   // 避开高海拔
  };
  days: Day[];
}

interface Day {
  date: string;
  places: PlaceVisit[];
  transportBetween: RouteSegment[];
  notes: string;
}

interface PlaceVisit {
  placeId: string;            // Amap POI id
  name: string;
  location: { lng: number; lat: number; altitude?: number };
  category: PlaceCategory;
  arrivalTime?: string;
  durationMinutes: number;
  priority: 'must' | 'want' | 'maybe';
  userNotes: string;
  photos: string[];
  ticketRequired: boolean;
  rating?: number;
}

interface RouteSegment {
  fromPlaceId: string;
  toPlaceId: string;
  mode: 'driving' | 'transit' | 'walking' | 'flight' | 'highspeedrail';
  distanceMeters: number;
  durationSeconds: number;
  polyline: string;           // encoded
  warnings: string[];         // ["海拔变化 2000m", "山路弯道多"]
}
```

---

## 🔌 MCP 与 LLM 调用规范（关键架构：前端代理 MCP）

### 架构决策
由于**智谱和 DeepSeek 不原生支持 MCP 协议**（只有 Anthropic 原生支持），为了让所有 Provider 体验一致，采用 **"前端充当 MCP Host"** 架构：

```
用户消息 → LLM（只负责决策） → 返回 tool_calls
        ↓
前端 MCP 适配层 → 调用 Amap MCP Server → 拿到结果
        ↓
把 tool_result 塞回对话 → 再次请求 LLM → 最终回复
```

**优势：** 统一的工具调用层，切换 LLM 提供商不影响工具能力；所有工具定义用标准 OpenAI function calling 格式描述。

### 实现要求
1. **启动时**：前端连接 Amap MCP Server，调用 `list_tools` 发现可用工具，转换为 OpenAI tools schema 缓存
2. **对话中**：把 tools schema 传给 LLM（三家 Provider 都兼容）
3. **工具执行循环**：LLM 返回 `tool_calls` → 前端执行对应 MCP 调用 → 结果作为 `tool` role 消息加入历史 → 继续请求直到 LLM 返回纯文本回复
4. **超时与重试**：MCP 调用设 10 秒超时，失败给 LLM 返回带错误信息的 tool_result，让它自然降级回复

### Amap MCP 必用工具（实际工具名以 MCP `list_tools` 返回为准）
- POI 搜索 / 关键词搜索
- 地理编码 / 逆地理编码
- 驾车 / 步行 / 公交 / 骑行路线规划
- 实时天气 / 天气预报
- 距离测量

### 业务层工具（前端自己实现的"本地工具"，也用 function calling 形式暴露给 LLM）
除了 MCP 工具，LLM 还需要能操作行程本身，这些工具前端本地实现：
- `add_place(placeId, day)` / `remove_place(placeId)` / `reorder_places(...)` / `update_notes(...)`
- `get_current_itinerary()` — 让 LLM 查询当前行程状态
- `propose_itinerary_change(patch)` — **不直接改，生成 diff 让用户确认**

### System Prompt 要点
每次请求都注入：
- 当前行程的精简 JSON（只含关键字段，节省 token）
- 用户偏好（节奏、兴趣、预算）
- 当前日期与行程起止日期
- 云南本地知识补充（高反、雨季、少数民族礼仪要点）
- 明确约束：修改行程必须通过 `propose_itinerary_change`，不要自己生成完整新行程

### Token 优化
- 行程 JSON 超过一定大小时，只注入"今日 + 相邻两天"摘要
- 对话历史超过 20 轮时，用 LLM 自己做一次摘要压缩
- 智谱 glm-4-air 和 DeepSeek-chat 价格低，默认可以保留更长上下文；Anthropic 贵，默认更激进压缩

---

## ✅ 交付标准

1. **可运行**：`pnpm install && pnpm dev` 后可直接用，无需额外配置（除 API key）
2. **代码质量**：TypeScript 严格模式无报错，组件拆分合理，无超过 300 行的单文件
3. **性能**：首屏 < 2s（4G 网络），地图交互 60fps，LLM 响应流式显示
4. **可访问性**：语义化标签、键盘可操作、对比度符合 WCAG AA
5. **文档**：README 说明架构、配置步骤、MCP 接入方式、如何扩展新功能

---

## 🚫 反模式（请避免）

- ❌ 使用原生 `<form>`、`alert()`、`confirm()`（在内嵌 WebView 中表现差）
- ❌ 居中模态弹窗（移动端用 Bottom Sheet）
- ❌ 小于 44×44px 的点击目标
- ❌ 依赖 hover 状态的功能（触摸设备无 hover）
- ❌ LLM 响应前阻塞 UI
- ❌ 把所有景点 marker 一次性渲染（多于 50 个时要聚合）
- ❌ 静默修改用户行程

---

## 🚀 部署与使用说明（必须包含）

使用者为**非专业开发者**，代码交付后需要能快速部署并在 iPhone 上使用。README 中必须包含：

1. **本地启动**：`pnpm install && pnpm dev` 能直接跑通
2. **一键部署**：提供 Vercel / Cloudflare Pages 的部署步骤（截图或分步说明），点几下鼠标就能拿到公网网址
3. **iPhone 添加到主屏**：Safari 打开 → 分享按钮 → "添加到主屏幕"的图文步骤
4. **API Key 获取与对比**：分别说明各 Provider 的申请地址、大致价格、新用户额度：
   - **智谱 AI**（推荐首选）：https://open.bigmodel.cn，新用户有免费额度，`glm-4-plus` 约 ¥0.05/千 tokens
   - **DeepSeek**：https://platform.deepseek.com，`deepseek-chat` 价格极低（约 ¥0.001-0.002/千 tokens），性价比最高
   - **Anthropic**：https://console.anthropic.com，需要国际信用卡，价格最贵但能力最强
   - **Amap**：https://lbs.amap.com，个人开发者免费额度足够使用
   - README 中给出三家 Provider 的**适用场景建议**（比如"日常规划用 DeepSeek，复杂路线优化用智谱 glm-4-plus，不差钱用 Claude"）
5. **数据安全**：所有 API Key 存在用户浏览器本地，不经过任何第三方服务器；行程数据仅本地存储
6. **离线使用**：说明哪些功能离线可用（已缓存行程、备注、打包清单）、哪些需要联网（地图瓦片更新、LLM 对话、实时天气）

## 🎬 开始

请按以下顺序输出：
1. 项目结构树
2. 关键文件代码（从入口、路由、状态管理开始，再到地图、助手、路线模块）
3. 样式和主题定义（Tailwind config + 全局 CSS）
4. PWA 配置（manifest、Service Worker、Apple meta 标签）
5. README（含部署、iPhone 添加主屏、API key 申请全流程）

开始构建吧。优先保证 P0 功能完整，P1 功能按优先级实现。记住两件事：

1. **这是一个要被真实游客在洱海边、茶马古道上、雪山脚下使用的工具**——每一个交互都要经得起"信号不好、手冷、赶路、边走边用"的考验
2. **审美不是加分项，是及格线**——用户添加到主屏后，这个图标会和微信、相册、Apple Maps 排在一起，它必须看起来属于那里
