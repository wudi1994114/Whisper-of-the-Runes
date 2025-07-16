# Requirements Document

## Introduction

当前项目中的怪物系统存在测试模式和正常模式逻辑混合的问题。在 `NormalEnemy` 类中，AI控制逻辑和手动测试控制逻辑耦合在一起，导致代码复杂且容易相互干扰。需要将这两套逻辑完全分离，让它们互不干扰地独立运行。系统需要支持不同类型的怪物（小怪、Boss等），并且测试模式一旦启动就保持独立运行，不考虑运行时切换。

## Requirements

### Requirement 1

**User Story:** 作为开发者，我希望怪物的AI逻辑和测试控制逻辑完全分离，这样我可以在不同模式下获得清晰的行为表现

#### Acceptance Criteria

1. WHEN 游戏处于正常模式时 THEN 怪物应该只执行AI逻辑，不响应任何手动输入
2. WHEN 游戏处于测试模式时 THEN 怪物应该只响应手动控制，完全禁用AI逻辑
3. WHEN 模式切换时 THEN 当前模式的逻辑应该立即停止，新模式的逻辑应该立即生效
4. WHEN 怪物初始化时 THEN 应该根据当前游戏模式只激活对应的控制系统

### Requirement 2

**User Story:** 作为开发者，我希望有独立的怪物控制器类，这样我可以更好地管理不同模式下的怪物行为

#### Acceptance Criteria

1. WHEN 创建怪物时 THEN 系统应该根据游戏模式选择合适的控制器类型
2. WHEN 怪物需要AI控制时 THEN 应该使用专门的AI控制器组件
3. WHEN 怪物需要手动控制时 THEN 应该使用专门的测试控制器组件
4. IF 同一个怪物节点上存在多个控制器 THEN 只有当前模式对应的控制器应该处于激活状态

### Requirement 3

**User Story:** 作为开发者，我希望系统支持不同类型的怪物（小怪、Boss等），这样我可以对各种怪物类型进行测试和开发

#### Acceptance Criteria

1. WHEN 系统设计控制器时 THEN 应该支持NormalEnemy（小怪）和Boss等不同怪物类型
2. WHEN 创建不同类型怪物时 THEN 每种类型都应该能够使用相同的控制器接口
3. WHEN Boss怪物被创建时 THEN 应该能够像小怪一样支持AI模式和测试模式
4. WHEN 扩展新的怪物类型时 THEN 应该能够复用现有的控制器架构

### Requirement 4

**User Story:** 作为开发者，我希望每种模式都有清晰的接口定义，这样我可以轻松扩展和维护不同的控制逻辑

#### Acceptance Criteria

1. WHEN 定义控制器接口时 THEN 应该包含所有必要的控制方法（移动、攻击、状态查询等）
2. WHEN 实现AI控制器时 THEN 应该只包含AI相关的逻辑，不包含任何手动控制代码
3. WHEN 实现测试控制器时 THEN 应该只包含手动控制逻辑，不包含任何AI代码
4. WHEN 添加新的控制逻辑时 THEN 应该能够通过实现接口轻松添加新的控制器类型

### Requirement 5

**User Story:** 作为开发者，我希望系统能够正确处理怪物的生命周期，这样我可以确保在不同模式下怪物都能正常创建和销毁

#### Acceptance Criteria

1. WHEN 怪物被创建时 THEN 应该根据当前游戏模式初始化对应的控制器
2. WHEN 怪物被销毁时 THEN 所有相关的控制器和事件监听器都应该被正确清理
3. WHEN 游戏模式改变时 THEN 现有怪物应该能够动态切换控制器而不需要重新创建
4. IF 控制器初始化失败 THEN 应该有适当的错误处理和回退机制