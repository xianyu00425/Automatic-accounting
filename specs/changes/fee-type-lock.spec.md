# Spec: 费用类型锁定

**Status**: implemented
**Created**: 2026-04-19

## 背景
账单导入时系统根据账单"收/支"字段自动判定金额正负数。但在分类操作时，如果将收入项分类为支出类目（或反之），金额正负号会被改变，导致汇总金额不正确。

## 需求
1. 账单导入时，系统根据账单"收/支"自动判定金额正负数
2. 账单分类操作时仅调整收支类别归属，不修改原始金额正负数值
3. 存在收入项被错误分类至支出类目场景，金额正负属性保持不变
4. 费用类型为"支出"时同理，保持处理分类时可随意分类收入或支出

## 约束
- 原始 `rawData.incomeExpense` 字段作为费用类型的唯一权威来源
- 内部 `t.type` 字段仅用于账户余额计算，不影响对外显示和汇总
- 新增 `getFeeType(t)` 函数统一获取费用类型

## 实现变更

### 新增函数
- `getFeeType(t)` — 优先读取 `t.rawData.incomeExpense`，回退到 `t.type`

### 修改函数
- `showProcessModal()` — 移除类型选择器，改为只读锁定标签
- `saveTransaction()` — 不再修改 `t.type`，只保存 `categoryId`
- 删除 `toggleProcessTypeFields()` 函数
- 移除 HTML 中的 `<select id="process-type">`

### 汇总显示
以下所有位置改用 `getFeeType(t)` 替代 `t.type`：
- `getMonthlyStats()` — 月度收支统计
- `getAccountStats()` — 账户收支统计
- `getDateRangeStats()` — 日期范围统计
- `getFilteredStats()` — 筛选后统计
- `showAccountSummaryFiltered()` — 账户汇总
- `aggregateByCategory()` — 费用分析图表（3处）
- 日历标记（支出/收入日期）
- 交易列表渲染（类型标签 + 金额正负）
- 账单详情弹窗（金额显示）
- 待处理列表（金额显示）
- 处理预览（金额显示）
- 导入预览表格

## 验收标准
- [x] 费用类型为"收入"时，分类为支出类目后金额仍显示 `+¥500.00`
- [x] 费用类型为"支出"时，分类为收入类目后金额仍显示 `-¥200.00`
- [x] 首页收支汇总按原始费用类型计算
- [x] 费用分析图表按原始费用类型归类
- [x] 处理弹窗不再显示类型选择器，改为锁定标签
