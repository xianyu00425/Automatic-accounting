# CLAUDE.md — Spec-Driven Development

## 核心规则

**所有功能开发和变更必须先写 spec。** 不要跳过规范直接写代码。

## 开发流程

1. 新功能 → 在 `specs/features/` 下创建 `feature-name.spec.md`
2. 修改现有功能 → 在 `specs/changes/` 下创建 `change-name.spec.md`
3. 编码前确认 spec 已评审通过（Status: approved）
4. 严格按照 spec 的需求和验收标准实现
5. 完成后更新 spec Status 为 implemented，并移至 `specs/archive/`

## 项目信息

- 单页 HTML 应用：`自动记账V10整合版.html`
- JavaScript：`js/app.js`
- CSS：内嵌在 HTML 文件中
- 数据存储：`localStorage`
- 移动端优先，最大宽度 480px
- 界面语言：中文

## 文件约定

- 新增功能规范放在 `specs/features/`
- 变更/修复规范放在 `specs/changes/`
- 已完成的 spec 移至 `specs/archive/`
- 模板参考 `specs/features/TEMPLATE.md`
