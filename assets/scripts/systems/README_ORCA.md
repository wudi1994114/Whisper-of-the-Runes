# ORCA避让系统使用指南

## 概述

ORCA (Optimal Reciprocal Collision Avoidance) 系统是一个先进的角色避让算法，用于替代传统的Boids系统。它提供更精确、更高效的避让行为，特别适用于密集场景中的多角色避让。

## 系统架构

### 核心组件

1. **OrcaAgent** (`OrcaAgent.ts`) - 挂载在每个需要避让的角色上
2. **OrcaSystem** (`OrcaSystem.ts`) - 核心算法管理器，全局单例
3. **GridManager** (复用现有) - 高性能邻居查询系统

### 与现有系统的关系

- **向后兼容**: 如果角色没有OrcaAgent组件，将自动回退到传统Boids系统
- **性能优化**: 复用GridManager进行O(k)复杂度的邻居查询
- **渐进升级**: 可以逐步为角色添加OrcaAgent组件

## 使用方法

### 1. 自动配置（推荐）

系统会自动为角色创建OrcaAgent组件，无需手动干预：

```typescript
// BaseCharacterDemo会自动添加OrcaAgent组件
// 无需额外代码
```

### 2. 手动配置ORCA参数

如果需要调整避让参数，可以在代码中修改：

```typescript
// 获取OrcaAgent组件
const orcaAgent = this.getComponent(OrcaAgent);
if (orcaAgent) {
    orcaAgent.radius = 40;           // 避让半径
    orcaAgent.neighborDist = 120;    // 邻居搜索距离
    orcaAgent.timeHorizon = 2.0;     // 预测时间
    orcaAgent.maxSpeed = 150;        // 最大速度
}
```

### 3. 查看系统状态

```typescript
// 获取ORCA系统调试信息
const orcaSystem = getOrcaSystem();
if (orcaSystem) {
    orcaSystem.printDebugInfo();
    
    // 获取性能统计
    const stats = orcaSystem.getPerformanceStats();
    console.log('活跃代理数:', stats.activeAgents);
    console.log('平均邻居数:', stats.averageNeighborsPerAgent);
}
```

## 参数调优指南

### 关键参数说明

- **radius**: 避让半径，决定与其他角色保持的最小距离
  - 建议值: 25-50像素
  - 过小: 角色可能重叠
  - 过大: 避让过于激进，影响移动效率

- **neighborDist**: 邻居搜索距离
  - 建议值: 80-150像素
  - 过小: 避让反应迟缓
  - 过大: 计算开销增大

- **timeHorizon**: 预测时间
  - 建议值: 1.0-2.5秒
  - 过小: 避让动作急躁
  - 过大: 避让过于提前，影响路径效率

### 性能优化建议

1. **合理设置邻居搜索距离**: 根据角色密度调整neighborDist
2. **适当的更新频率**: 系统默认20FPS更新，可根据需要调整
3. **避让半径统一**: 相同类型角色使用相同的radius值

## 调试功能

### 系统信息

```typescript
// 打印ORCA系统详细信息
orcaSystem.printDebugInfo();

// 打印网格系统信息（ORCA复用）
gridManager.printDebugInfo();
```

### 常见问题诊断

1. **角色不避让**: 检查是否正确注册到ORCA系统
2. **避让过于激进**: 减小timeHorizon或radius值
3. **性能问题**: 减小neighborDist或降低更新频率

## 与传统系统对比

| 特性 | ORCA系统 | Boids系统 |
|------|----------|-----------|
| 避让精度 | 高 | 中等 |
| 计算复杂度 | O(kn) | O(kn) |
| 参数调优 | 精确控制 | 经验调节 |
| 互惠避让 | 支持 | 不支持 |
| 死锁处理 | 自动解决 | 可能卡住 |

## 注意事项

1. **混合使用**: 避免同一场景中同时使用ORCA和Boids系统
2. **参数一致性**: 相同阵营的角色应使用相似的ORCA参数
3. **边界处理**: ORCA系统依赖物理碰撞体进行边界约束
4. **实时调整**: 可以在运行时动态调整ORCA参数

## 迁移指南

从Boids系统迁移到ORCA系统：

1. 角色会自动获得OrcaAgent组件
2. 原有的Boids参数可以作为ORCA参数的初始值
3. 逐步调优ORCA参数以获得最佳效果
4. 测试密集场景下的性能表现 