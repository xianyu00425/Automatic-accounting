---
name: 修复费用分析与首页统计不一致
description: 修复首页选择日期筛选后，当月无账单数据但费用分析区域仍显示数据的问题
type: fix
status: implemented
---

**问题原因：**

首页费用分析（`aggregateByCategory`）和统计卡片（`getMonthlyStats` / `getDateRangeStats`）使用不同的数据过滤逻辑：

1. **统计卡片**：当 `homeDateFilter` 被设置时，使用 `getDateRangeStats(homeDateFilter)` 筛选
2. **费用分析**：`aggregateByCategory` 优先使用 `homeDateFilter`，否则用 `currentMonth`
3. **账单列表**：`renderTransactions` 仅使用 `transactionDateFilter`，不使用首页的月份/日期筛选

关键问题：
- `aggregateByCategory` 中日期比较使用字符串截取 `t.date.substring(0, 10)` 与 `getMonthlyStats` 的 `new Date(t.date)` 解析方式不一致，若交易日期格式不统一会导致过滤结果不同
- `confirmCalendarSelection` 在 `clickCount === 1`（仅选择起始日期）时缺少 `startDate` 为空值的防御性检查
- 账单列表页不响应首页的月份选择，导致用户切换月份后账单页仍显示所有交易

**修复方案：**
- 统一 `aggregateByCategory` 中的日期比较方式，使用 `new Date(t.date)` 解析后转为 `YYYY-MM-DD` 字符串，与 `getDateRangeStats` 保持一致
- `confirmCalendarSelection` 增加 `startDate` 空值检查
- 账单列表 `renderTransactions` 在没有独立日期筛选时，回退使用首页的 `homeDateFilter` 或 `currentMonth`

**验收标准：**
- ✅ 切换月份时，费用分析与首页统计卡片显示一致（都显示该月数据或都为空）
- ✅ 使用日历选择日期范围时，费用分析与首页统计显示一致
- ✅ 无数据时费用分析区域显示空状态提示
- ✅ 账单列表页响应首页的月份/日期筛选

**修改文件：**
- `自动记账V10整合版.html`
  - `aggregateByCategory` 函数：日期比较统一为 `new Date(t.date)` 解析
  - `confirmCalendarSelection` 函数：增加 `startDate` 空值防御
  - `renderTransactions` 函数：增加首页日期筛选回退逻辑
