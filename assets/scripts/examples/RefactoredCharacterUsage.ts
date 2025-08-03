// assets/scripts/examples/RefactoredCharacterUsage.ts

/**
 * 重构后的角色系统使用示例
 * 展示如何使用新的模块化角色系统来解决依赖倒置原则中的问题
 */

import { Component, Vec3 } from 'cc';
import { ICharacter } from '../interfaces/ICharacter';
import { UnifiedECSCharacterFactory } from '../factories/UnifiedECSCharacterFactory';
import { ControlMode } from '../state-machine/CharacterEnums';
import { Faction } from '../configs/FactionConfig';

export class RefactoredCharacterUsage extends Component {

    protected async start(): Promise<void> {
        await this.demonstrateFactoryPattern();
        await this.demonstrateDependencyInversion();
        await this.demonstrateComponentComposition();
    }

    /**
     * 演示工厂模式如何解决"高层只依赖接口，如何找到具体实现"的问题
     */
    private async demonstrateFactoryPattern(): Promise<void> {
        console.log("=== 工厂模式演示 ===");

        // 1. 高层代码只依赖接口，不知道具体实现
        const createCharacter = async (type: string): Promise<ICharacter | null> => {
            // 🔑 关键：通过统一ECS工厂获取具体实现，高层代码不需要知道具体类
            return await UnifiedECSCharacterFactory.getInstance().createCharacter(type);
        };

        // 2. 工厂内部负责组装具体的组件实现
        const warrior = await createCharacter('ent_normal');
        const mage = await createCharacter('lich_normal');

        if (warrior && mage) {
            console.log(`创建成功: ${warrior.getCharacterDisplayName()}, ${mage.getCharacterDisplayName()}`);
        }
    }

    /**
     * 演示依赖倒置原则的实现
     */
    private async demonstrateDependencyInversion(): Promise<void> {
        console.log("=== 依赖倒置原则演示 ===");

        // 高层模块：游戏逻辑
        class BattleSystem {
            // 🔑 依赖抽象接口，而不是具体实现
            public startBattle(player: ICharacter, enemy: ICharacter): void {
                console.log(`战斗开始: ${player.getCharacterDisplayName()} VS ${enemy.getCharacterDisplayName()}`);
                
                // 使用接口方法，不关心具体实现
                player.transitionToState(1); // CharacterState.ATTACKING
                enemy.takeDamage(50);
                
                console.log(`玩家攻击敌人，敌人受到50点伤害`);
            }
        }

        // 🔑 通过统一ECS工厂创建具体实现
        const factory = UnifiedECSCharacterFactory.getInstance();
        const player = await factory.createCharacter('ent_normal', {
            controlMode: ControlMode.MANUAL,
            aiFaction: 'player'
        });
        const enemy = await factory.createCharacter('lich_normal', {
            controlMode: ControlMode.AI,
            aiFaction: 'red'
        });

        if (player && enemy) {
            const battleSystem = new BattleSystem();
            battleSystem.startBattle(player, enemy);
        }
    }

    /**
     * 演示组件组合模式
     */
    private async demonstrateComponentComposition(): Promise<void> {
        console.log("=== 组件组合模式演示 ===");

        // 🔑 创建角色时，统一ECS工厂自动注入所有必要的组件
        const character = await UnifiedECSCharacterFactory.createPlayer('ent_normal', {
            position: new Vec3(100, 100, 0)
        });

        if (character) {
            // 高层代码只需要调用接口方法
            // 内部会自动委托给对应的组件处理

            // 移动功能 - 委托给 MovementComponent
            character.setNodePosition(200, 200);
            character.handleMovement(0.016);

            // 战斗功能 - 委托给 CombatComponent  
            const result = character.performMeleeAttack();
            if (result) {
                console.log(`攻击结果: 目标死亡=${result.isDead}`);
            }

            // 动画功能 - 委托给 AnimationComponent
            character.playAttackAnimation(() => {
                console.log("攻击动画播放完成");
            });

            // 阵营功能 - 委托给 FactionComponent
            character.setFaction(Faction.PLAYER);
            console.log(`角色阵营: ${character.getFaction()}`);

            console.log("组件组合演示完成，所有功能都通过组件实现");
        }
    }

    /**
     * 演示如何扩展新功能而不修改现有代码（开闭原则）
     */
    private demonstrateOpenClosedPrinciple(): void {
        console.log("=== 开闭原则演示 ===");

        // 假设我们要添加新的"魔法"功能
        // 1. 创建新的 IMagic 接口
        // 2. 创建 MagicComponent 实现该接口
        // 3. 在工厂中注入该组件
        // 4. 在 ModularCharacter 中添加委托方法

        // 🔑 关键：不需要修改现有的组件代码，只需要扩展
        console.log("新功能可以通过添加新组件实现，无需修改现有代码");
    }

    /**
     * 演示便捷的角色创建方法
     */
    private demonstrateConvenienceMethods(): void {
        console.log("=== 便捷方法演示 ===");

        // 🔑 工厂提供便捷方法，封装常用的创建场景
        
        // 创建玩家角色
        const player = UnifiedECSCharacterFactory.createPlayer('ent_normal', {
            position: new Vec3(0, 0, 0)
        });
        
        // 创建AI敌人
        const enemy = UnifiedECSCharacterFactory.createAIEnemy('lich_normal', {
            position: new Vec3(200, 0, 0),
            faction: 'red',
            behaviorType: 'ranged'
        });

        if (player && enemy) {
            console.log(`便捷创建成功: 玩家=${player.getCharacterDisplayName()}, 敌人=${enemy.getCharacterDisplayName()}`);
        }
    }

    /**
     * 演示依赖注入的优势
     */
    private async demonstrateDependencyInjection(): Promise<void> {
        console.log("=== 依赖注入优势演示 ===");

        // 🔑 工厂负责依赖注入，自动解决组件间的依赖关系
        
        // 1. 无需手动管理组件创建顺序
        // 2. 组件间的依赖关系由工厂处理
        // 3. 易于测试 - 可以注入模拟组件
        // 4. 松耦合 - 组件间通过接口和事件通信

        const character = await UnifiedECSCharacterFactory.getInstance().createCharacter('ent_normal');
        
        if (character) {
            console.log("工厂自动处理了以下依赖注入:");
            console.log("- MovementComponent -> 物理移动功能");
            console.log("- CombatComponent -> 战斗功能");
            console.log("- AnimationComponent -> 动画功能");
            console.log("- LifecycleComponent -> 生命周期管理");
            console.log("- ControlComponent -> 输入控制");
            console.log("- FactionComponent -> 阵营管理");
            console.log("- ConfigComponent -> 配置管理");
            console.log("- RenderComponent -> 渲染显示");
            console.log("- ModularCharacter -> 主角色类（组合所有功能）");
        }
    }
}

/**
 * 使用总结：
 * 
 * 🔧 问题解决方案：
 * 1. **工厂模式**: 解决"高层只依赖接口，如何找到具体实现"
 * 2. **依赖注入**: 工厂负责创建和注入具体组件
 * 3. **组合模式**: 将多个单一职责组件组合成完整功能
 * 4. **事件系统**: 组件间松耦合通信
 * 
 * 🎯 设计优势：
 * 1. **单一职责**: 每个组件只负责一种功能
 * 2. **开闭原则**: 可以轻松扩展新功能而不修改现有代码
 * 3. **接口分离**: 客户端只依赖需要的接口
 * 4. **依赖倒置**: 高层模块依赖抽象接口而不是具体实现
 * 5. **可测试性**: 每个组件都可以独立测试
 * 6. **可复用性**: 组件可以在不同的角色类型中复用
 * 
 * 🔄 实际使用流程：
 * 1. 调用工厂方法创建角色
 * 2. 工厂自动注入所有必要组件
 * 3. 组件间通过事件系统协调工作
 * 4. 高层代码只需调用接口方法
 * 5. 接口方法委托给对应组件处理
 */