# 滇途 · 智能 AI 行程规划功能开发文档

## 功能概述

用户标注想去的景点和酒店后，LLM 自动调用高德地图工具获取真实交通数据、天气预报、景点开放时间，综合用户偏好（活动内容、室内户外、节奏）生成逐时精准日程，结构化输出后一键应用到 App 行程中。

---

## 架构总览

```
用户输入（景点 + 酒店 + 偏好）
        │
        ▼
PlanningWizard（6步向导 UI）
        │
        ▼
planningStore（Zustand，管理规划会话状态）
        │  调用
        ▼
chatStore.sendPlanningRequest()
        │  使用专用 system prompt（planningPrompt.ts）
        ▼
LLM Agentic Loop
   ├── STEP 1: amap_route_matrix    → 全部地点交通矩阵
   ├── STEP 2: amap_get_weather     → 各天天气预报
   ├── STEP 3: amap_place_detail / web_search → 开放时间核实
   ├── STEP 4: 内部推理（TSP最近邻贪心）
   └── STEP 5: propose_smart_plan  → 结构化 JSON 输出
        │
        ▼
planningParser.ts
   ├── parseSmartPlan()       → SmartPlan 类型
   ├── validateSmartPlan()    → 校验必去景点是否全安排
   └── smartPlanToTripDays()  → 转为 tripStore 格式
        │
        ▼
PlanReviewPanel（逐日时间线 UI，用户审核）
        │ 确认
        ▼
tripStore.applySmartPlan()（批量写入 days + places）
        │
        ▼
LeafletMapView + DaySchedule（即时更新）
```

---

## 已创建文件

| 文件 | 说明 |
|---|---|
| `src/services/planning/planningPrompt.ts` | **LLM 专用 Prompt 文件**，含完整 system prompt、步骤约束、云南知识库、输出规则 |
| `src/services/planning/planningParser.ts` | 结构化输出解析器，LLM 原始 JSON → SmartPlan → tripStore 格式 |
| `src/types/trip.ts` | 新增 Hotel、PlacePlanInput、PlanningSession、SmartPlan 等全部类型 |
| `src/services/amap/tools.ts` | 新增 getPlanningTools()、amap_route_matrix、amap_place_detail、web_search、propose_smart_plan |

---

## Prompt 文件说明（planningPrompt.ts）

### 核心设计原则

1. **强制步骤执行**：5个步骤明确标注，每步有"完成标志"，防止 LLM 跳步
2. **工具结果强制性**：transport 时间必须来自 amap_route_matrix，禁止估算
3. **最终输出必须是工具调用**：禁止纯文字描述方案，必须调用 propose_smart_plan
4. **云南专项知识内嵌**：高海拔规则、缆车预约、雨季策略、常见开放时间

### 导出函数

```typescript
// 生成完整 system prompt（运行时构建，注入用户数据）
buildPlanningSystemPrompt(ctx: PlanningContext): string

// LLM 第一条 user 消息（固定文本，让 LLM 立即开始执行）
PLANNING_INITIAL_USER_MESSAGE: string

// 工具调用进度消息映射（展示给用户看）
TOOL_PROGRESS_MESSAGES: Record<string, string>
```

---

## 分阶段实施计划

### Phase 1（已完成）：基础层

- [x] `src/types/trip.ts` — 新增全部规划类型
- [x] `src/services/planning/planningPrompt.ts` — Prompt 文件
- [x] `src/services/planning/planningParser.ts` — 解析器
- [x] `src/services/amap/tools.ts` — 新增规划工具集

### Phase 2：状态管理层

- [ ] `src/store/planningStore.ts`（新建）
  - `createSession(tripId, trip)` — 从现有行程初始化
  - `startGeneration(config, trip)` — 触发 LLM，更新进度
  - `setGeneratedPlan(plan)` — 保存解析后的 SmartPlan
  - `cancelGeneration()` — AbortController 中止
- [ ] `src/store/chatStore.ts`（修改）
  - 新增 `sendPlanningRequest(session, trip, config)`
  - `propose_smart_plan` 处理分支 → parseSmartPlan → planningStore
  - 进度回调 → planningStore.progress
- [ ] `src/store/tripStore.ts`（修改）
  - 新增 `applySmartPlan(tripId, result)` — 批量写入 days
  - 新增 `addHotel / removeHotel / updateHotel`
  - 修复 `acceptProposal`：直接调用 tripStore actions（移除外部回调模式）

### Phase 3：UI 层

- [ ] `src/components/Planning/PlanningWizard.tsx` — 主容器
- [ ] `src/components/Planning/Step1_SelectPlaces.tsx`
- [ ] `src/components/Planning/Step2_AddHotels.tsx`
- [ ] `src/components/Planning/Step3_SetActivities.tsx`
- [ ] `src/components/Planning/Step4_Preferences.tsx`
- [ ] `src/components/Planning/Step5_Generating.tsx` — 进度动画
- [ ] `src/components/Planning/Step6_ReviewPlan.tsx`
- [ ] `src/components/Planning/DayPlanCard.tsx` — 逐日时间线
- [ ] `src/components/Planning/StopCard.tsx` — 单个停留点
- [ ] `src/components/Planning/HotelCard.tsx`
- [ ] `src/components/Map/LeafletMapView.tsx` — 新增 hotels prop
- [ ] `src/pages/HomePage.tsx` — 新增入口按钮

---

## 技术限制与权衡

| 限制 | 处理方案 |
|---|---|
| 高德 distance API 是 N:1 | 循环目的地并发请求，N=10 约需 10 次 API 调用 |
| LLM 上下文长度 | 工具结果只保留关键字段，超过 12k tokens 裁剪中间消息 |
| web_search 浏览器 CORS | 降级：返回空结果+提示，LLM 凭训练知识补充 |
| LLM 输出结构不稳定 | parseSmartPlan 全字段 optional + fallback，errors → UI 重试 |
| acceptProposal 未接通 | Phase 2 直接 import tripStore，移除外部回调 |
| 用户取消规划 | AbortController signal 传递给 fetch，LLM 客户端接受 signal 参数 |
