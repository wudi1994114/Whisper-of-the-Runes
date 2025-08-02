// assets/scripts/interfaces/index.ts

/**
 * 角色系统接口包
 * 
 * 本包基于ECS（Entity-Component-System）架构和SOLID原则设计，
 * 将原本的BaseCharacterDemo类拆分为多个职责明确的接口：
 * 
 * 核心功能接口：
 * - IMovable: 移动相关功能
 * - ICombat: 战斗相关功能  
 * - IAnimatable: 动画相关功能
 * - ILifecycle: 生命周期管理
 * - IControllable: 控制和状态管理
 * - IFactional: 阵营管理
 * - IConfigurable: 配置数据管理
 * - IRenderable: 渲染和UI相关
 * 
 * 复合接口：
 * - ICharacter: 组合所有功能的完整角色接口
 * 
 * 工厂和管理接口：
 * - ICharacterFactory: 角色创建工厂
 * - ICharacterManager: 角色管理器
 */

// 核心功能接口
export { IMovable } from './IMovable';
export { ICombat, IAttackResult } from './ICombat';
export { IAnimatable } from './IAnimatable';
export { ILifecycle } from './ILifecycle';
export { IControllable, IInputSignals } from './IControllable';
export { IFactional } from './IFactional';
export { IConfigurable } from './IConfigurable';
export { IRenderable } from './IRenderable';

// 复合接口
export { ICharacter, ICharacterFactory, ICharacterManager } from './ICharacter';

/**
 * 使用示例：
 * 
 * ```typescript
 * import { ICharacter, IMovable, ICombat } from '../interfaces';
 * 
 * // 实现特定功能的组件
 * class MovementComponent implements IMovable {
 *   // 实现移动相关功能
 * }
 * 
 * class CombatComponent implements ICombat {
 *   // 实现战斗相关功能
 * }
 * 
 * // 组合成完整的角色
 * class Character implements ICharacter {
 *   private movementComponent: IMovable;
 *   private combatComponent: ICombat;
 *   // ... 其他组件
 * }
 * ```
 * 
 * 设计优势：
 * 1. 单一职责：每个接口只负责一种功能
 * 2. 开闭原则：可以轻松扩展新功能而不修改现有代码
 * 3. 接口分离：客户端只依赖需要的接口
 * 4. 依赖倒置：高层模块依赖抽象接口而不是具体实现
 * 5. 可测试性：每个组件都可以独立测试
 * 6. 可复用性：组件可以在不同的角色类型中复用
 */