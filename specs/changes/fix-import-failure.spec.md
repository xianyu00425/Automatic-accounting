# Spec: 修复导入账单功能 — 所有模板导入失败

**Status**: implemented
**Created**: 2026-05-21

## 问题

电脑端与手机端导入账单功能，任何模板（美团、京东、支付宝、微信、默认）都显示"导入失败 — 无法识别文件格式"。

## 根因分析

### 1. 表头扫描范围不足（主要根因）

`parseExcelFileAutoDetect` 和 `parseExcelFilePreview` 只扫描 Excel 文件的前 **10 行**来查找表头行。

但美团/京东导出的账单文件包含大量元数据行：
- **美团文件**：表头在第 **19 行**（前 18 行是账单标题、用户名、时间范围、统计摘要、特别提示等元数据）
- **京东文件**：表头在第 **21 行**（前 20 行是导出信息、账号名、日期区间、统计摘要、特别提示等元数据）

因此扫描前 10 行找不到匹配的表头，默认使用第 0 行（"美团交易账单明细"），该行不包含"时间"和"金额"关键字，导致 `hasTime && hasAmount` 校验失败，报错"无法识别文件格式"。

### 2. `hasTime && hasAmount` 校验过于严格

原逻辑要求表头同时包含"时间"/"日期" AND "金额"关键字。但某些合法表头可能只包含其中一个。

### 3. `parseExcelRow` 缺少支付宝专用解析

`parseExcelRow` 有 `meituan` 和 `jd` 的专用解析，但没有 `alipay` 专用解析。支付宝文件走通用解析器时，由于列名不匹配（如支付宝用"收/支"而非"收支"），导致 `counterpartyIndex` 找不到，整行被跳过。

### 4. 通用解析器要求 counterparty 列必须存在

通用解析器要求 `timeIndex`, `amountIndex`, `counterpartyIndex` 三列都存在才解析。但某些文件格式可能缺少"对方"/"商户"列。

## 修复方案

### 修复 1：扩大表头扫描范围

将扫描范围从 10 行增加到 **30 行**，确保能覆盖美团（19行）、京东（21行）等有大量元数据的文件。

修改位置：
- `parseExcelFileAutoDetect`（第 8175 行附近）
- `parseExcelFilePreview`（第 8313 行附近）

### 修复 2：放宽表头校验

将 `if (!hasTime || !hasAmount)` 改为 `if (!hasTime && !hasAmount)`，只需包含"时间"或"金额"之一即可通过校验。

### 修复 3：新增 `parseAlipayRow` 函数

在 `parseExcelRow` 中添加 `alipay` 专用解析分支，调用新函数 `parseAlipayRow`，正确处理支付宝模板的列映射（交易时间、交易分类、交易对方、商品说明、收/支、金额、收/付款方式）。

### 修复 4：通用解析器放宽 counterparty 要求

- 移除对 `counterpartyIndex` 的强制要求（只要求 `timeIndex` 和 `amountIndex`）
- `counterparty` 值可以从多个列名中 fallback（交易对方、对方、商户名称）
- 移除"counterparty 为空则跳过"的限制

### 修复 5：增加调试日志

在导入流程关键节点增加 `console.log` 调试日志，便于后续排查：
- 文件选择时：文件名、大小、类型
- FileReader 完成时：result 类型和大小
- workbook 加载时：sheet 列表
- jsonData 解析时：行数、首行内容
- 表头检测时：索引、模板、表头内容
- 校验结果：hasTime、hasAmount

## 测试验证

使用 Node.js + XLSX 库验证修复效果：

```
美团: 表头行索引=19, 模板=meituan, 解析 75/75 条
京东: 表头行索引=21, 模板=jd, 解析 36/36 条
```
