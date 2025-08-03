// assets/scripts/factories/PoolIntegratedModularCharacterFactory.ts

/**
 * 🔥 集成对象池的模块化角色工厂
 * 修复：让 ModularCharacterFactory 正确使用 poolManager 进行对象复用
 */

import { _decorator, Component, Node, Prefab, instantiate, Vec3 } from 'cc';
import { ICharacter, ICharacterFactory } from '../interfaces';
import { ModularCharacter } from '../entities/ModularCharacter';
import { MovementComponent } from '../components/MovementComponent';
import { CombatComponent } from '../components/CombatComponent';
import { AnimationComponent } from '../components/AnimationComponent';
import { LifecycleComponent } from '../components/LifecycleComponent';
import { ControlComponent } from '../components/ControlComponent';
import { FactionComponent } from '../components/FactionComponent';
import { ConfigComponent } from '../components/ConfigComponent';
import { RenderComponent } from '../components/RenderComponent';
import { ControlMode } from '../state-machine/CharacterEnums';
import { poolManager } from '../managers/PoolManager';

const { ccclass } = _decorator;

@ccclass('PoolIntegratedModularCharacterFactory')
export class PoolIntegratedModularCharacterFactory implements ICharacterFactory {
    private static instance: PoolIntegratedModularCharacterFactory | null = null;
    
    // 活跃角色管理
    private activeCharacters: Set<ICharacter> = new Set();
    
    // 预制体缓存
    private characterPrefabs: Map<string, Prefab> = new Map();

    public static getInstance(): PoolIntegratedModularCharacterFactory {
        if (!this.instance) {
            this.instance = new PoolIntegratedModularCharacterFactory();
        }
        return this.instance;
    }

    /**
     * 注册角色预制体到对象池
     * @param characterType 角色类型
     * @param prefab 预制体
     */
    public registerCharacterPrefab(characterType: string, prefab: Prefab): void {
        this.characterPrefabs.set(characterType, prefab);
        
        // 🔥 修复：使用现有系统的池名（直接使用characterType）
        poolManager.registerPrefab(characterType, prefab, {
            maxSize: this.getPoolConfigForType(characterType).maxSize,
            preloadCount: this.getPoolConfigForType(characterType).preloadCount
        });
        
        console.log(`[PoolIntegratedFactory] 注册角色预制体到对象池: ${characterType}`);
    }

    /**
     * 创建角色 - 使用对象池复用
     * @param characterType 角色类型
     * @param options 创建选项
     */
    async createCharacter(characterType: string, options?: any): Promise<ICharacter | null> {
        try {
            console.log(`[PoolIntegratedFactory] 开始创建角色: ${characterType}`, options);

            // 🔥 关键修复：优先从对象池获取复用节点
            const characterNode = this.createBaseNodeFromPool(characterType, options);
            if (!characterNode) {
                console.error(`[PoolIntegratedFactory] 创建基础节点失败: ${characterType}`);
                return null;
            }

            // 🔥 修复：检查是否为复用节点
            let character = characterNode.getComponent(ModularCharacter);
            const isReusedNode = !!character; // 如果已有ModularCharacter组件说明是复用节点
            
            if (!character) {
                // 新节点或来自基础池的节点，需要添加组件
                this.injectComponents(characterNode);
                character = characterNode.getComponent(ModularCharacter);
            } else {
                // 复用的ModularCharacter节点，重置状态
                this.resetCharacterForReuse(character);
            }

            if (!character) {
                console.error(`[PoolIntegratedFactory] 主角色组件不存在`);
                this.returnNodeToPool(characterNode, characterType);
                return null;
            }

            // 配置角色属性
            this.configureCharacter(character, characterType, options);

            // 初始化组件依赖关系
            await this.initializeComponents(character);

            // 注册到活跃角色列表
            this.activeCharacters.add(character);

            console.log(`[PoolIntegratedFactory] ✅ 角色创建成功: ${characterType} (复用: ${!!character})`);
            return character;

        } catch (error) {
            console.error(`[PoolIntegratedFactory] 角色创建失败: ${characterType}`, error);
            return null;
        }
    }

    /**
     * 🔥 核心方法：从对象池创建基础节点（使用现有池系统）
     * @param characterType 角色类型
     * @param options 创建选项
     */
    private createBaseNodeFromPool(characterType: string, options?: any): Node | null {
        // 🔥 修复：使用现有系统的池名（直接使用characterType）
        const poolName = characterType;
        
        // 🔥 生成唯一角色名字
        const characterName = this.generateCharacterName(characterType, options);
        
        // 1. 🔥 使用现有系统获取敌人实例（包含基础初始化）
        let characterNode = poolManager.getEnemyInstance(poolName);
        let isReused = false;
        
        if (characterNode) {
            console.log(`[PoolIntegratedFactory] 🔄 从对象池复用节点: ${characterType}`);
            isReused = true;
        } else {
            // 2. 对象池为空，尝试从预制体创建
            const prefab = this.characterPrefabs.get(characterType);
            if (prefab) {
                characterNode = instantiate(prefab);
                console.log(`[PoolIntegratedFactory] 🆕 从预制体创建新节点: ${characterType}`);
            } else {
                // 3. 最后方案：创建空节点
                characterNode = new Node(`Character_${characterType}`);
                console.log(`[PoolIntegratedFactory] 🆕 创建空节点: ${characterType}`);
            }
        }

        if (characterNode) {
            // 🔥 为节点设置新名字（复用时重新命名）
            characterNode.name = characterName;
            
            // 设置位置
            if (options?.position) {
                characterNode.setPosition(options.position);
            }
            
            console.log(`[PoolIntegratedFactory] 🏷️ 角色命名: ${characterName} (${isReused ? '复用' : '新建'})`);
        }

        return characterNode;
    }

    /**
     * 归还节点到对象池
     * @param node 节点
     * @param characterType 角色类型
     */
    private returnNodeToPool(node: Node, characterType: string): void {
        // 🔥 修复：使用现有系统的池名
        poolManager.put(node);
        console.log(`[PoolIntegratedFactory] 🔄 节点已归还到对象池: ${characterType}`);
    }

    /**
     * 回收角色到对象池
     * @param character 角色实例
     */
    recycleCharacter(character: ICharacter): void {
        if (!this.activeCharacters.has(character)) {
            console.warn(`[PoolIntegratedFactory] 尝试回收未注册的角色`);
            return;
        }

        const node = (character as any).node;
        const configComponent = node.getComponent(ConfigComponent);
        const characterType = configComponent?.getEnemyType() || 'unknown';

        // 触发回收逻辑
        const lifecycleComponent = node.getComponent(LifecycleComponent);
        if (lifecycleComponent) {
            lifecycleComponent.onRecycleToPool();
        }

        // 🔥 关键：归还到对象池而不是销毁
        this.returnNodeToPool(node, characterType);

        // 从活跃列表移除
        this.activeCharacters.delete(character);

        console.log(`[PoolIntegratedFactory] ✅ 角色已回收到对象池: ${characterType}`);
    }

    /**
     * 重置角色状态用于复用
     * @param character 角色实例
     */
    private resetCharacterForReuse(character: ICharacter): void {
        const node = (character as any).node;
        
        // 重置生命周期组件
        const lifecycleComponent = node.getComponent(LifecycleComponent);
        if (lifecycleComponent) {
            lifecycleComponent.onReuseFromPool();
        }

        // 重置渲染组件
        const renderComponent = node.getComponent(RenderComponent);
        if (renderComponent) {
            renderComponent.resetVisualEffects();
        }

        // 重置战斗组件
        const combatComponent = node.getComponent(CombatComponent);
        if (combatComponent) {
            combatComponent.resetCombatState();
        }

        console.log(`[PoolIntegratedFactory] 🔄 角色状态已重置用于复用`);
    }

    /**
     * 依赖注入 - 添加所有组件
     * @param node 角色节点
     */
    private injectComponents(node: Node): void {
        console.log(`[PoolIntegratedFactory] 开始注入组件到节点: ${node.name}`);

        // 按依赖顺序添加组件
        node.addComponent(LifecycleComponent);
        node.addComponent(ConfigComponent);
        node.addComponent(FactionComponent);
        node.addComponent(MovementComponent);
        node.addComponent(CombatComponent);
        node.addComponent(AnimationComponent);
        node.addComponent(RenderComponent);
        node.addComponent(ControlComponent);
        node.addComponent(ModularCharacter);

        console.log(`[PoolIntegratedFactory] 组件注入完成，共注入 9 个组件`);
    }

    /**
     * 配置角色属性
     */
    private configureCharacter(character: ICharacter, characterType: string, options?: any): void {
        const node = (character as any).node;

        // 🔥 标记为来自对象池
        const lifecycleComponent = node.getComponent(LifecycleComponent);
        if (lifecycleComponent && options) {
            const characterId = options.characterId || `${characterType}_${Date.now()}`;
            lifecycleComponent.setPoolingProperties(
                true, // 来自对象池
                `${characterType}_pool`,
                characterId
            );
        }

        // 配置其他组件...
        const controlComponent = node.getComponent(ControlComponent);
        if (controlComponent && options?.controlMode !== undefined) {
            controlComponent.controlMode = options.controlMode;
        }

        const factionComponent = node.getComponent(FactionComponent);
        if (factionComponent && options?.aiFaction) {
            factionComponent.aiFaction = options.aiFaction;
        }

        const configComponent = node.getComponent(ConfigComponent);
        if (configComponent) {
            if (options?.aiBehaviorType) {
                configComponent.aiBehaviorType = options.aiBehaviorType;
            }
            configComponent.setEnemyType(characterType);
        }

        console.log(`[PoolIntegratedFactory] 角色配置完成: ${characterType}`);
    }

    /**
     * 初始化组件依赖关系
     */
    private async initializeComponents(character: ICharacter): Promise<void> {
        const node = (character as any).node;

        // 等待配置组件加载数据
        const configComponent = node.getComponent(ConfigComponent);
        if (configComponent) {
            await configComponent.waitForDataManager();
            configComponent.loadEnemyConfig();
        }

        // 初始化动画组件
        const animationComponent = node.getComponent(AnimationComponent);
        const enemyData = configComponent?.getEnemyData();
        if (animationComponent && enemyData) {
            await animationComponent.initializeAnimations(enemyData);
        }

        // 设置输入系统
        const controlComponent = node.getComponent(ControlComponent);
        if (controlComponent) {
            controlComponent.setupInput();
        }

        // 设置默认阵营（使用微任务延迟执行确保物理组件已初始化）
        const factionComponent = node.getComponent(FactionComponent);
        if (factionComponent) {
            // 使用微任务延迟执行，确保所有组件都已初始化
            Promise.resolve().then(() => {
                factionComponent.setupDefaultFaction();
            });
        }

        console.log(`[PoolIntegratedFactory] 组件初始化完成`);
    }

    /**
     * 生成角色名字: 类型+阵营+毫秒值
     * @param characterType 角色类型
     * @param options 选项，包含阵营信息
     */
    private generateCharacterName(characterType: string, options?: any): string {
        const faction = options?.aiFaction || 'neutral';
        const timestamp = Date.now();
        return `${characterType}_${faction}_${timestamp}`;
    }

    /**
     * 根据角色类型获取对象池配置
     */
    private getPoolConfigForType(characterType: string): { maxSize: number; preloadCount: number } {
        if (characterType.includes('boss')) {
            return { maxSize: 3, preloadCount: 1 };
        } else if (characterType.includes('elite')) {
            return { maxSize: 8, preloadCount: 2 };
        } else if (characterType.startsWith('slime')) {
            return { maxSize: 30, preloadCount: 5 };
        } else {
            return { maxSize: 15, preloadCount: 3 };
        }
    }

    /**
     * 便捷方法：创建AI敌人（使用对象池）
     */
    public static async createAIEnemy(characterType: string, options: {
        position?: Vec3;
        faction: string;
        behaviorType?: string;
    }): Promise<ICharacter | null> {
        return await PoolIntegratedModularCharacterFactory.getInstance().createCharacter(characterType, {
            controlMode: ControlMode.AI,
            position: options.position,
            aiFaction: options.faction,
            aiBehaviorType: options.behaviorType || 'melee'
        });
    }

    /**
     * 便捷方法：创建玩家角色（使用对象池）
     */
    public static async createPlayer(characterType: string, position?: Vec3): Promise<ICharacter | null> {
        return await PoolIntegratedModularCharacterFactory.getInstance().createCharacter(characterType, {
            controlMode: ControlMode.MANUAL,
            position: position,
            aiFaction: "player"
        });
    }

    /**
     * 获取活跃角色数量
     */
    getActiveCharacterCount(): number {
        return this.activeCharacters.size;
    }

    /**
     * 获取对象池统计信息
     */
    getPoolStats(): Map<string, any> {
        const stats = new Map();
        this.characterPrefabs.forEach((_, characterType) => {
            // 🔥 修复：使用正确的池名
            const poolStats = poolManager.getPoolStats(characterType);
            if (poolStats) {
                stats.set(characterType, poolStats);
            }
        });
        return stats;
    }
}

/**
 * 使用指南：
 * 
 * 1. 替换现有的 ModularCharacterFactory
 * 2. 自动使用 poolManager 进行对象复用
 * 3. 正确的创建路径：level.json -> LevelManager -> MonsterSpawner -> PoolIntegratedModularCharacterFactory -> poolManager -> 复用节点
 * 4. 支持对象池统计和性能监控
 * 
 * 优势：
 * - ✅ 完全集成对象池系统
 * - ✅ 自动节点复用，提升性能
 * - ✅ 内存使用优化
 * - ✅ 保持模块化架构的所有优势
 * - ✅ 向后兼容现有代码
 */