# Spec-Driven Development 约定

## 工作流

1. **写规范** — 在 `specs/features/` 或 `specs/changes/` 下创建 `.spec.md` 文件
2. **评审通过** — 规范确认后再开始编码
3. **实现** — 严格按照规范编写代码
4. **验证** — 逐条检查 acceptance criteria 是否满足
5. **归档** — 完成后将 spec 移至 `specs/archive/`

## Spec 文件格式

每个 spec 必须包含：

```markdown
# Spec: 功能名称

**Status**: draft | approved | implemented | archived
**Created**: YYYY-MM-DD

## 背景
[问题描述或需求动机]

## 需求
1. [需求1]
2. [需求2]

## 约束
- [约束1]

## 验收标准
- [ ] [可测试的标准1]
- [ ] [可测试的标准2]
```

## 项目规则

- 单页 HTML 应用（`自动记账V10整合版.html`）
- JS 代码在 `js/app.js`
- CSS 内嵌在 HTML 中
- 数据存储在 `localStorage`
- 移动端优先（max-width: 480px）
- 全中文界面
