# 角色系统接口包

本包提供了基于ECS（Entity-Component-System）架构和SOLID原则设计的角色系统接口，将原有的巨型BaseCharacterDemo类重构为多个职责明确的接口。

## 🏗️ 架构设计

### 设计原则

1. **单一职责原则 (SRP)**: 每个接口只负责一种功能
2. **开闭原则 (OCP)**: 对扩展开放，对修改封闭
3. **接口分离原则 (ISP)**: 客户端只依赖需要的接口
4. **依赖倒置原则 (DIP)**: 依赖抽象而非具体实现
5. **组合优于继承**: 使用组合模式而非继承链

### 接口分层

```
ICharacter (复合接口)
├── IMovable (移动功能)
├── ICombat (战斗功能)
├── IAnimatable (动画功能)
├── ILifecycle (生命周期)
├── IControllable (控制逻辑)
├── IFactional (阵营管理)
├── IConfigurable (配置管理)
└── IRenderable (渲染显示)
```

## 📦 接口说明

### 核心功能接口

#### `IMovable` - 移动功能
负责角色的移动、位置、物理相关功能。
```typescript
interface IMovable {
    handleMovement(deltaTime: number): void;
    stopMovement(): void;
    setNodePosition(x: number, y: number, z?: number): void;
    // ...
}
```

#### `ICombat` - 战斗功能
负责攻击、伤害、目标选择等战斗相关功能。
```typescript
interface ICombat {
    performMeleeAttack(): IAttackResult | null;
    performRangedAttack(): void;
    takeDamage(damage: number): void;
    // ...
}
```

#### `IAnimatable` - 动画功能
负责动画播放、朝向控制等视觉表现。
```typescript
interface IAnimatable {
    playAttackAnimation(onFinished?: () => void): void;
    playHurtAnimation(): void;
    updateDirectionTowards(targetPosition: any): void;
    // ...
}
```

#### `ILifecycle` - 生命周期管理
负责对象池、状态重置、生命周期回调。
```typescript
interface ILifecycle {
    returnToPool(): void;
    onReuseFromPool(): void;
    resetCharacterState(): void;
    // ...
}
```

#### `IControllable` - 控制逻辑
负责输入处理、状态机、控制模式。
```typescript
interface IControllable {
    setupInput(): void;
    transitionToState(state: CharacterState): void;
    update(deltaTime: number): void;
    // ...
}
```

#### `IFactional` - 阵营管理
负责阵营设置、物理分组管理。
```typescript
interface IFactional {
    setFaction(faction: Faction): void;
    getFaction(): Faction;
    updateCharacterPhysicsGroup(faction: Faction): void;
    // ...
}
```

#### `IConfigurable` - 配置管理
负责配置数据加载、类型管理。
```typescript
interface IConfigurable {
    setEnemyType(enemyType: string): void;
    loadEnemyConfig(): void;
    initializeAI(): void;
    // ...
}
```

#### `IRenderable` - 渲染显示
负责UI渲染、血条、特效等视觉元素。
```typescript
interface IRenderable {
    createHealthBar(): void;
    showDamageText(damage: number): void;
    playRedFlashEffect(): void;
    // ...
}
```

### 复合接口

#### `ICharacter` - 完整角色接口
组合所有功能接口，代表一个完整的角色实体。

#### `ICharacterFactory` - 角色工厂
负责角色的创建和回收。

#### `ICharacterManager` - 角色管理器
负责角色的注册、查询、批量操作。

## 🚀 使用方法

### 1. 基础使用

```typescript
import { ICharacter, IMovable, ICombat } from './interfaces';

// 使用特定功能
function moveCharacter(character: IMovable, deltaTime: number) {
    character.handleMovement(deltaTime);
}

function attackWithCharacter(character: ICombat) {
    const result = character.performMeleeAttack();
    if (result?.isDead) {
        console.log('目标已死亡');
    }
}
```

### 2. 组件化实现

```typescript
// 实现特定功能组件
class MovementComponent implements IMovable {
    handleMovement(deltaTime: number): void {
        // 具体移动逻辑
    }
    // ... 其他方法
}

class CombatComponent implements ICombat {
    performMeleeAttack(): IAttackResult | null {
        // 具体攻击逻辑
    }
    // ... 其他方法
}

// 组合成完整角色
class ModularCharacter implements ICharacter {
    private movement: MovementComponent;
    private combat: CombatComponent;
    
    // 委托模式实现接口方法
    handleMovement(deltaTime: number): void {
        this.movement.handleMovement(deltaTime);
    }
    
    performMeleeAttack(): IAttackResult | null {
        return this.combat.performMeleeAttack();
    }
}
```

### 3. 工厂模式使用

```typescript
class CharacterFactory implements ICharacterFactory {
    createCharacter(characterType: string, options?: any): ICharacter | null {
        // 根据类型创建不同的角色实现
        switch (characterType) {
            case 'warrior':
                return new WarriorCharacter();
            case 'mage':
                return new MageCharacter();
            default:
                return null;
        }
    }
}
```

## 📁 文件结构

```
interfaces/
├── README.md                    # 本文档
├── index.ts                     # 统一导出
├── IMovable.ts                  # 移动接口
├── ICombat.ts                   # 战斗接口
├── IAnimatable.ts               # 动画接口
├── ILifecycle.ts                # 生命周期接口
├── IControllable.ts             # 控制接口
├── IFactional.ts                # 阵营接口
├── IConfigurable.ts             # 配置接口
├── IRenderable.ts               # 渲染接口
├── ICharacter.ts                # 复合接口
└── examples/
    └── CharacterComponentExample.ts  # 使用示例
```

## 🔄 迁移指南

### 从BaseCharacterDemo迁移

1. **分析现有功能**: 确定每个方法属于哪个功能类别
2. **创建组件**: 为每个功能类别创建独立组件
3. **实现接口**: 让组件实现对应的接口
4. **组合角色**: 使用组合模式创建完整角色
5. **重构调用**: 修改外部代码使用新接口

### 迁移示例

```typescript
// 原有代码
class BaseCharacterDemo {
    handleMovement(deltaTime: number) { /* 复杂逻辑 */ }
    performMeleeAttack() { /* 复杂逻辑 */ }
    playAttackAnimation() { /* 复杂逻辑 */ }
    // ... 2000+ 行代码
}

// 重构后
class MovementComponent implements IMovable {
    handleMovement(deltaTime: number) { /* 专注移动逻辑 */ }
}

class CombatComponent implements ICombat {
    performMeleeAttack() { /* 专注战斗逻辑 */ }
}

class AnimationComponent implements IAnimatable {
    playAttackAnimation() { /* 专注动画逻辑 */ }
}

class Character implements ICharacter {
    // 组合各个组件，委托调用
}
```

## ✅ 优势

1. **可维护性**: 代码分离，易于理解和修改
2. **可测试性**: 每个组件可独立测试
3. **可复用性**: 组件可在不同角色间复用
4. **可扩展性**: 易于添加新功能而不影响现有代码
5. **松耦合**: 组件间通过接口通信，降低依赖
6. **团队协作**: 不同开发者可并行开发不同组件

## 🔧 最佳实践

1. **保持接口简洁**: 每个接口方法数量控制在10个以内
2. **明确职责边界**: 避免功能重叠
3. **使用组合而非继承**: 优先考虑组合模式
4. **接口版本管理**: 新增方法时保持向后兼容
5. **文档同步**: 接口变更时及时更新文档
6. **单元测试**: 为每个接口实现编写测试

## 📞 支持

如有问题或建议，请通过以下方式联系：
- 项目仓库: [项目地址]
- 文档更新: [文档地址]
- 技术讨论: [讨论区地址]