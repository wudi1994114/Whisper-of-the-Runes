import { _decorator, Component, Node, Prefab, instantiate, Vec3, Sprite } from 'cc';
import { ICharacter } from '../interfaces/ICharacter';
import { ControlMode } from '../state-machine/CharacterEnums';
import { poolManager } from '../managers/PoolManager';
import { dataManager } from '../managers/DataManager';

// 组件导入
import { LifecycleComponent } from '../components/LifecycleComponent';
import { ConfigComponent } from '../components/ConfigComponent';
import { FactionComponent } from '../components/FactionComponent';
import { MovementComponent } from '../components/MovementComponent';
import { CombatComponent } from '../components/CombatComponent';
import { AnimationComponent } from '../components/AnimationComponent';
import { RenderComponent } from '../components/RenderComponent';
import { CharacterStats } from '../components/CharacterStats';
import { HealthBarComponent } from '../components/HealthBarComponent';
import { ControlComponent } from '../components/ControlComponent';
import { AIIntentionComponent } from '../components/AIIntentionComponent';
import { ModularCharacter } from '../entities/ModularCharacter';


const { ccclass } = _decorator;

/**
 * 角色创建选项
 */
export interface CharacterCreationOptions {
    /** 位置 */
    position?: Vec3;
    /** 控制模式 */
    controlMode?: ControlMode;
    /** AI阵营 */
    aiFaction?: string;
    /** AI行为类型 */
    aiBehaviorType?: string;
    /** 角色ID */
    characterId?: string;
}

/**
 * 统一的 ECS 角色工厂
 * 基于 ModularCharacter 的纯 ECS 架构
 * 统一初始化流程，解决组件依赖问题
 */
@ccclass('UnifiedECSCharacterFactory')
export class UnifiedECSCharacterFactory {
    private static instance: UnifiedECSCharacterFactory | null = null;
    
    // 注册的预制体
    private characterPrefabs: Map<string, Prefab> = new Map();
    
    // 活跃角色列表
    private activeCharacters: Set<ICharacter> = new Set();

    /**
     * 获取单例实例
     */
    public static getInstance(): UnifiedECSCharacterFactory {
        if (!UnifiedECSCharacterFactory.instance) {
            UnifiedECSCharacterFactory.instance = new UnifiedECSCharacterFactory();
        }
        return UnifiedECSCharacterFactory.instance;
    }

    /**
     * 注册角色预制体
     */
    public registerCharacterPrefab(characterType: string, prefab: Prefab): void {
        this.characterPrefabs.set(characterType, prefab);
        console.log(`[UnifiedECSFactory] 注册预制体: ${characterType}`);
    }

    /**
     * 创建角色 - 统一入口（简化版本，回归生命周期管理）
     * @param characterType 角色类型
     * @param options 创建选项
     */
    createCharacter(characterType: string, options: CharacterCreationOptions = {}): ICharacter | null {
        try {
            console.log(`[UnifiedECSFactory] 🎯 开始创建角色: ${characterType}`, options);

            // 1. 验证敌人数据
            const enemyData = dataManager.getEnemyData(characterType);
            if (!enemyData) {
                console.error(`[UnifiedECSFactory] 未找到敌人数据: ${characterType}`);
                return null;
            }

            // 2. 获取节点并确保组件存在
            const characterNode = this.getNodeWithComponents(characterType, options);
            if (!characterNode) {
                console.error(`[UnifiedECSFactory] 角色节点创建失败: ${characterType}`);
                return null;
            }

            // 3. 获取 ICharacter 接口
            const character = characterNode.getComponent(ModularCharacter);
            if (!character) {
                console.error(`[UnifiedECSFactory] ModularCharacter组件不存在: ${characterType}`);
                this.returnNodeToPool(characterNode, characterType);
                return null;
            }

            // 4. 配置组件（这是工厂的核心职责！）
            // 在所有组件的 onLoad 之前，将配置数据注入
            this.configureCharacter(character, characterType, options);

            // 5. 检查是否从对象池复用，发送复用事件
            if (this.isNodeFromPool(characterNode)) {
                characterNode.emit('reuse-from-pool');
            }

            // 6. 激活节点，让引擎开始调用 onLoad, start 等
            characterNode.active = true;

            // 7. 注册到活跃角色列表
            this.activeCharacters.add(character);

            console.log(`[UnifiedECSFactory] ✅ 角色配置完成，即将交由引擎初始化: ${characterType}`);
            return character;

        } catch (error) {
            console.error(`[UnifiedECSFactory] 角色创建失败: ${characterType}`, error);
            return null;
        }
    }

    /**
     * 获取节点并确保组件存在（简化版本）
     */
    private getNodeWithComponents(characterType: string, options: CharacterCreationOptions = {}): Node | null {
        let characterNode: Node | null = null;
        
        // 1. 尝试从对象池获取
        characterNode = poolManager.getEnemyInstance(characterType);
        if (characterNode) {
            console.log(`[UnifiedECSFactory] 🔄 从对象池获取节点: ${characterType}`);
            
            // 确保所有必要的组件都已附加
            this.ensureAllComponents(characterNode);
            
            // 重置节点状态（为生命周期做准备）
            this.prepareNodeForReuse(characterNode);
            
            // 增强生命周期重置机制
            this.enhanceLifecycleReset(characterNode, characterType, options);
        } else {
            // 2. 创建新节点（从预制体或空节点）
            const prefab = this.characterPrefabs.get(characterType);
            if (prefab) {
                characterNode = instantiate(prefab);
                console.log(`[UnifiedECSFactory] 🆕 从预制体创建节点: ${characterType}`);
            } else {
                characterNode = new Node(`Character_${characterType}`);
                console.log(`[UnifiedECSFactory] 🆕 创建空节点: ${characterType}`);
            }
            
            // 新节点需要注入完整的ECS组件
            if (characterNode) {
                this.ensureAllComponents(characterNode);
            }
        }
        
        return characterNode;
    }

    /**
     * 创建完整的角色节点（节点获取+组件管理一体化）- 已废弃，保留用于向后兼容
     */
    private async createCompleteCharacterNode(characterType: string, options: CharacterCreationOptions): Promise<ICharacter | null> {
        console.log(`[UnifiedECSFactory] 🏗️ 开始创建完整角色节点: ${characterType}`);
        
        const characterName = this.generateCharacterName(characterType, options);
        let characterNode: Node | null = null;
        let character: ICharacter | null = null;
        let isReused = false;
        
        // 1. 尝试从对象池获取
        characterNode = poolManager.getEnemyInstance(characterType);
        if (characterNode) {
            console.log(`[UnifiedECSFactory] 🔄 从对象池获取节点: ${characterType}`);
            isReused = true;
            
            // 检查基础架构组件（PoolManager应该已经注入了）
            character = characterNode.getComponent(ModularCharacter);
            if (character) {
                console.log(`[UnifiedECSFactory] ✅ 基础架构组件已存在`);
                
                // 确保实例特定组件也已注入（分层注入策略）
                this.injectInstanceSpecificComponents(characterNode);
                
                // 重置角色状态
                this.resetCharacterForReuse(character);
                console.log(`[UnifiedECSFactory] ✅ 复用节点组件完整性检查和状态重置完成`);
            } else {
                // 兜底：如果连基础组件都没有，说明PoolManager逻辑有问题
                console.error(`[UnifiedECSFactory] 严重错误：对象池节点缺少基础架构组件！执行完整注入...`);
                this.injectModularComponents(characterNode);
                character = characterNode.getComponent(ModularCharacter);
                if (character) {
                    console.log(`[UnifiedECSFactory] ⚠️ 完整组件注入成功，但应检查PoolManager逻辑`);
                } else {
                    console.error(`[UnifiedECSFactory] 完整注入也失败，返回节点到对象池`);
                    this.returnNodeToPool(characterNode, characterType);
                    return null;
                }
            }
        } else {
            // 2. 创建新节点（从预制体或空节点）
            const prefab = this.characterPrefabs.get(characterType);
            if (prefab) {
                characterNode = instantiate(prefab);
                console.log(`[UnifiedECSFactory] 🆕 从预制体创建节点: ${characterType}`);
            } else {
                characterNode = new Node(`Character_${characterType}`);
                console.log(`[UnifiedECSFactory] 🆕 创建空节点: ${characterType}`);
            }
            
            // 新节点需要注入完整的ECS组件
            if (characterNode) {
                this.injectModularComponents(characterNode);
                character = characterNode.getComponent(ModularCharacter);
                console.log(`[UnifiedECSFactory] ✅ 新节点完整组件注入完成`);
            }
        }
        
        if (!characterNode || !character) {
            console.error(`[UnifiedECSFactory] 角色节点或组件创建失败`);
            if (characterNode) {
                this.returnNodeToPool(characterNode, characterType);
            }
            return null;
        }
        
        // 3. 设置基础节点属性
        characterNode.name = characterName;
        if (options.position) {
            characterNode.setPosition(options.position);
        }
        
        console.log(`[UnifiedECSFactory] ✅ 完整角色节点创建完成: ${characterName} (${isReused ? '复用' : '新建'})`);
        return character;
    }

    /**
     * 配置和初始化组件 - 已废弃，现在只需要配置，初始化由生命周期自动处理
     */
    private async configureAndInitialize(character: ICharacter, characterType: string, options: CharacterCreationOptions): Promise<boolean> {
        console.warn(`[UnifiedECSFactory] configureAndInitialize已废弃，现在由生命周期方法自动管理`);
        // 只保留配置逻辑
        this.configureCharacter(character, characterType, options);
        return true;
    }

    /**
     * 确保所有必要组件都存在
     */
    private ensureAllComponents(node: Node): void {
        // 基础架构组件
        if (!node.getComponent(ModularCharacter)) {
            console.log(`[UnifiedECSFactory] 注入基础架构组件...`);
            node.addComponent(MovementComponent);
            node.addComponent(CombatComponent);
            node.addComponent(AnimationComponent);
            node.addComponent(RenderComponent);
            node.addComponent(CharacterStats);
            node.addComponent(HealthBarComponent);
            node.addComponent(ModularCharacter);
        }

        // 实例特定组件
        this.ensureInstanceSpecificComponents(node);
    }

    /**
     * 注入完整的ECS组件（已废弃，保留用于向后兼容）
     */
    private injectModularComponents(node: Node): void {
        this.ensureAllComponents(node);
    }

    /**
     * 确保实例特定组件存在
     */
    private ensureInstanceSpecificComponents(node: Node): void {
        console.log(`[UnifiedECSFactory] 确保实例特定组件存在...`);
        
        // 检查并注入实例特定组件
        if (!node.getComponent(LifecycleComponent)) {
            node.addComponent(LifecycleComponent);      // 生命周期管理
        }
        if (!node.getComponent(ConfigComponent)) {
            node.addComponent(ConfigComponent);         // 配置管理
        }
        if (!node.getComponent(ControlComponent)) {
            node.addComponent(ControlComponent);        // 控制模式
        }
        if (!node.getComponent(FactionComponent)) {
            node.addComponent(FactionComponent);        // 阵营管理
        }
        if (!node.getComponent(AIIntentionComponent)) {
            node.addComponent(AIIntentionComponent);    // AI意向状态
        }

        console.log(`[UnifiedECSFactory] 实例特定组件检查完成`);
    }

    /**
     * 注入实例特定组件（已废弃，保留用于向后兼容）
     */
    private injectInstanceSpecificComponents(node: Node): void {
        this.ensureInstanceSpecificComponents(node);
    }

    /**
     * 配置角色属性
     */
    private configureCharacter(character: ICharacter, characterType: string, options: CharacterCreationOptions): void {
        const node = (character as any).node;

        // 配置生命周期组件
        const lifecycleComponent = node.getComponent(LifecycleComponent);
        if (lifecycleComponent) {
            const characterId = options.characterId || `${characterType}_${Date.now()}`;
            lifecycleComponent.setPoolingProperties(true, `${characterType}_pool`, characterId);
        }

        // 配置控制组件
        const controlComponent = node.getComponent(ControlComponent);
        if (controlComponent && options.controlMode !== undefined) {
            controlComponent.controlMode = options.controlMode;
            console.log(`[UnifiedECSFactory] 设置ControlComponent.controlMode = ${options.controlMode} (节点: ${node.name})`);
        } else {
            console.warn(`[UnifiedECSFactory] 无法配置ControlComponent: 组件=${!!controlComponent}, 选项控制模式=${options.controlMode} (节点: ${node.name})`);
        }

        // 配置阵营组件
        const factionComponent = node.getComponent(FactionComponent);
        if (factionComponent && options.aiFaction) {
            factionComponent.aiFaction = options.aiFaction;
        }

        // 配置配置组件
        const configComponent = node.getComponent(ConfigComponent);
        if (configComponent) {
            // 直接设置属性，让组件自己在生命周期中处理
            configComponent.characterType = characterType;
            configComponent.setEnemyType(characterType);
            if (options.aiBehaviorType) {
                configComponent.aiBehaviorType = options.aiBehaviorType;
            }
        }

        console.log(`[UnifiedECSFactory] 🎛️ 角色配置完成: ${characterType}`);
    }

    /**
     * 检查节点是否来自对象池
     */
    private isNodeFromPool(node: Node): boolean {
        // 可以通过节点名称或者其他标识来判断
        // 这里简化处理，可以根据实际需要调整判断逻辑
        return node.name.includes('Pool') || (poolManager as any).isFromPool?.(node) || false;
    }

    /**
     * 为复用准备节点状态
     */
    private prepareNodeForReuse(node: Node): void {
        // 设置节点为非激活状态，等待配置完成后激活
        node.active = false;
        
        // 重置位置（如果需要）
        node.setPosition(0, 0, 0);
        
        console.log(`[UnifiedECSFactory] 🔄 节点已准备好复用: ${node.name}`);
    }

    /**
     * 增强生命周期重置机制：为复用节点设置必要的状态
     */
    private enhanceLifecycleReset(node: Node, characterType: string, options: CharacterCreationOptions): void {
        // 为ConfigComponent设置必要的信息以便重用
        const configComponent = node.getComponent(ConfigComponent);
        if (configComponent && typeof configComponent.reuse === 'function') {
            configComponent.reuse(characterType, options);
        }
        
        // 确保FactionComponent有正确的阵营信息
        const factionComponent = node.getComponent(FactionComponent);
        if (factionComponent && options.aiFaction) {
            factionComponent.aiFaction = options.aiFaction;
        }
        
        console.log(`[UnifiedECSFactory] 🔄 生命周期重置机制配置完成: ${node.name}`);
    }



    /**
     * 统一组件初始化流程 - 已废弃，现在由各组件的生命周期方法自行管理
     * 保留用于向后兼容，但不再使用
     */
    private async initializeComponents(character: ICharacter): Promise<void> {
        console.warn(`[UnifiedECSFactory] initializeComponents已废弃，组件初始化现在由生命周期方法自动管理`);
        // 不再执行任何初始化逻辑，交给生命周期管理
    }

    /**
     * 这些初始化方法已废弃，现在由各组件的生命周期方法自行管理
     * 保留用于向后兼容，但不再使用
     */
    
    // 已废弃的方法，保留用于向后兼容
    private async waitForComponentsReady(node: Node): Promise<void> {}
    private verifyComponentsAfterOnLoad(node: Node): void {}
    private async waitForFrame(): Promise<void> {}
    private async initializeAnimationComponent(node: Node, configComponent: ConfigComponent | null): Promise<void> {}
    private async initializeControlComponent(node: Node): Promise<void> {}
    private async initializeFactionComponent(node: Node): Promise<void> {}
    private async initializeAISystem(node: Node, configComponent: ConfigComponent | null): Promise<void> {}

    /**
     * 重置角色状态以供复用（增强生命周期重置机制）
     */
    private resetCharacterForReuse(character: ICharacter): void {
        const node = (character as any).node;
        
        // 触发重用事件，组件会响应这些事件进行自我重置
        node.emit('reuse-from-pool');
        node.emit('reset-character-state');
        
        console.log(`[UnifiedECSFactory] 🔄 角色状态重置完成: ${node.name}`);
    }

    /**
     * 归还节点到对象池
     */
    private returnNodeToPool(node: Node, characterType: string): void {
        // 触发回收事件
        node.emit('on-recycle-to-pool');
        
        // 归还到对应池
        poolManager.put(node);
        
        console.log(`[UnifiedECSFactory] 🔄 节点已归还对象池: ${characterType}`);
    }

    /**
     * 生成唯一角色名称
     */
    private generateCharacterName(characterType: string, options: CharacterCreationOptions): string {
        const faction = options.aiFaction || 'neutral';
        const timestamp = Date.now();
        return `${characterType}_${faction}_${timestamp}`;
    }

    /**
     * 回收角色
     */
    recycleCharacter(character: ICharacter): void {
        if (this.activeCharacters.has(character)) {
            this.activeCharacters.delete(character);
            const node = (character as any).node;
            this.returnNodeToPool(node, 'unknown');
            console.log(`[UnifiedECSFactory] 角色已回收: ${node.name}`);
        }
    }

    /**
     * 创建AI敌人
     */
    public static createAIEnemy(characterType: string, options: {
        position?: Vec3;
        faction: string;
        behaviorType?: string;
    }): ICharacter | null {
        return UnifiedECSCharacterFactory.getInstance().createCharacter(characterType, {
            controlMode: ControlMode.AI,
            position: options.position,
            aiFaction: options.faction,
            aiBehaviorType: options.behaviorType || 'melee'
        });
    }

    /**
     * 创建玩家角色
     */
    public static createPlayer(characterType: string, options: {
        position?: Vec3;
    } = {}): ICharacter | null {
        return UnifiedECSCharacterFactory.getInstance().createCharacter(characterType, {
            controlMode: ControlMode.MANUAL,
            position: options.position,
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
     * 获取活跃角色列表
     */
    getActiveCharacters(): ICharacter[] {
        return Array.from(this.activeCharacters);
    }

    /**
     * 清理所有活跃角色
     */
    recycleAllCharacters(): void {
        console.log(`[UnifiedECSFactory] 🧹 开始清理 ${this.activeCharacters.size} 个活跃角色`);
        
        const charactersToRecycle = Array.from(this.activeCharacters);
        charactersToRecycle.forEach(character => {
            this.recycleCharacter(character);
        });
        
        console.log(`[UnifiedECSFactory] ✅ 所有角色已清理完成`);
    }
}

/**
 * 默认导出单例实例
 */
export const unifiedECSFactory = UnifiedECSCharacterFactory.getInstance();

/**
 * 确保工厂在模块加载时就初始化
 */
export function ensureFactoryInitialized(): UnifiedECSCharacterFactory {
    return UnifiedECSCharacterFactory.getInstance();
}

// 自动初始化工厂
const factoryInstance = ensureFactoryInitialized();
console.log('[UnifiedECSFactory] 模块加载时自动初始化完成');