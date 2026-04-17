# 规范驱动开发

本项目采用 **Spec-Driven Development** 工作流。

## 目录结构

```
specs/
├── _conventions.md     ← 全局约定和工作流规则
├── features/           ← 功能规范（一个新功能一个 .spec.md）
│   └── TEMPLATE.md     ← Spec 模板
├── changes/            ← 变更/修复规范
├── archive/            ← 已完成的 spec（归档）
└── README.md           ← 本文件
```

## 快速开始

### 添加新功能

```bash
# 1. 复制模板并填写内容
cp specs/features/TEMPLATE.md specs/features/新功能名称.spec.md

# 2. 评审通过后开始实现

# 3. 完成后归档
mv specs/features/新功能名称.spec.md specs/archive/
```

### 修改现有功能

```bash
# 在 changes/ 目录下创建变更规范
# 描述变更内容、原因和验收标准
```

## Spec 格式要求

每个 spec 必须包含：
- **背景**：为什么要做这个变更
- **需求**：具体的功能描述
- **约束**：技术或业务上的限制
- **验收标准**：可测试的判断条件，用于确认功能是否完成

## 更多规则

详见 [`_conventions.md`](_conventions.md)
