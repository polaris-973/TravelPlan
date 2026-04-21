# TravelPlan 功能升级方案

> 编写日期：2026-04-21

---

## 一、智能路线编排（Amap 路径规划 + LLM 编排）

### 1.1 目标效果

两地之间展示步行 / 骑行 / 驾车 / 公交的距离与耗时；LLM 根据各段路程自动优化当天景点顺序，减少无效来回（参考截图右侧「交通信息」面板）。

### 1.2 数据模型改动（`src/types/trip.ts`）

新增：

```ts
export interface TransportOption {
  mode: TransportMode;
  distance_m: number;
  duration_s: number;
  label: string;        // "2.7公里 · 9分钟"
}

export interface RouteMatrix {
  fromId: string;
  toId: string;
  options: TransportOption[];
  recommended: TransportMode;
  fetchedAt: string;    // ISO timestamp，用于判断是否过期
}
```

`RouteSegment` 补全：

```ts
export interface RouteSegment {
  // 原有字段...
  legs?: RouteLeg[];
}

export interface RouteLeg {
  instruction: string;
  duration_s: number;
  distance_m: number;
}
```

### 1.3 新增 Amap 路径规划服务（`src/services/amap/routing.ts`）

封装四种交通方式的 Amap REST API（不依赖 JS SDK）：

| 方式 | Amap REST 端点 |
|------|---------------|
| 步行 | `/v3/direction/walking` |
| 驾车 | `/v3/direction/driving` |
| 骑行 | `/v4/direction/bicycling` |
| 公交 | `/v3/direction/transit/integrated` |

导出：`getRouteOptions(apiKey, from: Location, to: Location): Promise<TransportOption[]>`

并发请求四种方式，合并结果，自动推荐（景区间：<3 km 优先步行，否则驾车/公交）。

### 1.4 UI 改动

**新文件：`src/components/Route/RouteConnector.tsx`**

插入在 `DaySchedule` 相邻两个 `PlaceCard` 之间：

```
[景点 A]
  ↕  🚶 18分钟  /  🚴 6分钟  /  🚗 4分钟     ← 默认折叠，仅显示最优方式
[景点 B]
```

- 点击展开所有交通方式，液态玻璃卡片样式
- 展示距离 + 时间 pill
- 「驾车导航」按钮跳转高德 App（DeepLink）

**`src/components/PlaceCard/PlaceDetail.tsx`** 底部新增「到下一站」section。

### 1.5 LLM 工具扩展（`src/services/amap/tools.ts`）

新增两个工具：

```ts
amap_get_route: { from_name, from_location, to_name, to_location }
// → 返回各交通方式耗时/距离

optimize_day_order: { day_id }
// → LLM 分析 routeMatrix 后通过 propose_itinerary_change 提议新顺序
```

---

## 二、按地点天气预报

### 2.1 天气 API 选择

推荐 **和风天气（QWeather）** 免费订阅：
- 官网：`dev.qweather.com`，免费额度 1000 次/天
- 支持经纬度直接查询（比按城市 adcode 更精准）
- 返回 7 天预报，包含降水概率、UV、风速

备选：`wttr.in`（无需注册，适合 MVP 占位，精度粗糙）。

### 2.2 新增天气服务（`src/services/weather/qweather.ts`）

```ts
export async function getDailyForecast(
  apiKey: string, lat: number, lng: number, days?: 3 | 7
): Promise<WeatherInfo[]>
```

### 2.3 数据模型补全（`src/types/trip.ts`）

`WeatherInfo` 新增可选字段：

```ts
export interface WeatherInfo {
  // 原有字段...
  precipProbability?: number;   // 降水概率 0-100
  iconCode?: string;             // QWeather 图标代码
}
```

### 2.4 展示位置

| 位置 | 内容 |
|------|------|
| `DaySchedule` header | 当天天气图标 + 高低温，如 ⛅ 18°–26° |
| `PlaceDetail` | 游览日天气卡片（降水概率 + UV + 风速） |
| 设置页 | 添加 QWeather API Key 输入框 |

### 2.5 触发时机

DaySchedule 展开时，若 `Day.weather` 为空且有 qweatherApiKey，自动后台拉取（debounce 60s）。

---

## 三、备注功能重构（手账风格）

### 3.1 数据模型改动（`src/types/trip.ts`）

将 `PlaceVisit.userNotes: string` 替换为：

```ts
export type NoteColor = 'yellow' | 'mint' | 'peach' | 'lavender';
export type NoteMood = '😊' | '🤩' | '😌' | '🤔' | '😴';

export interface PlaceNote {
  id: string;
  content: string;
  createdAt: string;        // ISO timestamp
  color: NoteColor;         // 便签底色
  mood?: NoteMood;          // 心情标签（可选）
}

export interface PlaceVisit {
  // userNotes: string  ← 废弃，迁移到 notes
  notes: PlaceNote[];       // 多条便签（向后兼容：加载时自动迁移）
  // ...其余字段不变
}
```

`tripStore` 加载时自动迁移旧数据：

```ts
// 若 place.userNotes 存在，转为 notes[0]
// 确保所有 place 都有 notes: []
```

### 3.2 Store 新增方法（`src/store/tripStore.ts`）

```ts
addNote(tripId, dayId, placeId, note: Omit<PlaceNote, 'id' | 'createdAt'>): void
removeNote(tripId, dayId, placeId, noteId: string): void
updateNote(tripId, dayId, placeId, noteId: string, patch: Partial<PlaceNote>): void
```

### 3.3 新增组件

**`src/components/Notes/NoteCard.tsx`** — 单条便签卡片

```
┌─────────────────────────────────────┐
│  "早上八点开门，停车场很小！"  😊   │  ← glass-note-yellow
│   4月20日 · 09:23                  │
└─────────────────────────────────────┘
```

- `backdrop-filter: blur(12px)` + 彩色半透明底色
- 长按弹出 ActionSheet（删除、换色）
- 短按进入编辑状态

**`src/components/Notes/AddNoteSheet.tsx`** — 添加备注 ModalSheet

- 自动聚焦的 textarea
- 4 色圆形颜色选择器
- 5 个心情 emoji 选择器
- 取消 / 保存按钮

### 3.4 PlaceDetail 备注区重构

新布局：

```
📝 旅行笔记                   [+ 添加]
┌──────────────────────────────────┐
│ 便签卡片 1 (yellow)              │
└──────────────────────────────────┘
┌──────────────────────────────────┐
│ 便签卡片 2 (mint)                │
└──────────────────────────────────┘
        长按可删除或切换颜色
```

---

## 四、液态玻璃 UI 统一

### 4.1 CSS 新增层级（`src/index.css`）

在现有 `glass-light` / `glass-dark` 基础上，增加：

```css
/* pill 工具类 */
.pill {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 8px;
  border-radius: 99px;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.4;
}

/* 主要容器（底色较重，替换部分 bg-surface 场景） */
.glass-surface {
  backdrop-filter: blur(24px) saturate(1.8);
  background-color: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(255, 255, 255, 0.6);
}

/* 嵌套卡片（更轻） */
.glass-card {
  backdrop-filter: blur(16px) saturate(1.6);
  background-color: rgba(255, 255, 255, 0.52);
  border: 1px solid rgba(255, 255, 255, 0.4);
}

/* 便签色系（4 色） */
.glass-note-yellow { background-color: rgba(255, 237, 140, 0.58); ... }
.glass-note-mint   { background-color: rgba(148, 213, 172, 0.50); ... }
.glass-note-peach  { background-color: rgba(255, 185, 150, 0.52); ... }
.glass-note-lavender { background-color: rgba(190, 170, 230, 0.50); ... }

/* 深色模式自动适配 */
```

### 4.2 组件改造清单

| 组件 | 改动 |
|------|------|
| `PersistentSheet` | 背景改用 `glass-surface` + 顶部边框 |
| `DaySchedule` 卡片 | 改用 `glass-card`，圆角 `rounded-3xl` |
| `PlaceCard` | 半透明边框 + 轻阴影 |
| `PlaceDetail` hero | 双层渐变 + 毛玻璃覆盖 |
| `ChatPanel` 气泡 | 用户气泡 `glass-surface`，AI 气泡 `glass-card` |
| `Toast` | 改为毛玻璃 toast |
| `NoteCard`（新） | 手账 glass-note-* 风格 |
| `RouteConnector`（新） | pill 形态，`glass-card` |

---

## 五、新增设置项（`src/components/Settings/SettingsPage.tsx`）

### 5.1 天气预报 section

- QWeather API Key 输入框（带注册链接提示）
- 天气语言选项（默认中文）

### 5.2 路线规划 section

- 默认出行方式选择器（步行 / 骑行 / 驾车 / 公交）

### 5.3 settingsStore 新增字段

```ts
qweatherApiKey: string;
preferredTransport: TransportMode;  // default: 'walking'
```

---

## 六、实施优先级

| 优先级 | 功能模块 | 关键文件 | 工作量 |
|--------|---------|---------|-------|
| **P0** | CSS 液态玻璃统一 | `index.css` | 0.5天 |
| **P0** | 备注多条支持 + 手账 UI | `trip.ts`, `tripStore`, `Notes/*`, `PlaceDetail` | 1天 |
| **P1** | 天气预报（QWeather） | `qweather.ts`, `settingsStore`, `DaySchedule` | 0.5天 |
| **P1** | 路段交通信息 | `routing.ts`, `RouteConnector`, `DaySchedule` | 1天 |
| **P2** | LLM 智能路线优化 | `tools.ts`, `chatStore` | 1天 |

---

## 七、数据迁移说明

旧 `PlaceVisit.userNotes: string` → 新 `PlaceVisit.notes: PlaceNote[]`

`tripStore` 启动时执行一次性迁移：

```ts
function migrateTrips(trips: Trip[]): Trip[] {
  return trips.map(trip => ({
    ...trip,
    days: trip.days.map(day => ({
      ...day,
      places: day.places.map(place => {
        const p = place as any;
        if (!Array.isArray(p.notes)) {
          return {
            ...place,
            notes: p.userNotes
              ? [{ id: nanoid(), content: p.userNotes, createdAt: new Date().toISOString(), color: 'yellow' }]
              : [],
          };
        }
        return place;
      }),
    })),
  }));
}
```
