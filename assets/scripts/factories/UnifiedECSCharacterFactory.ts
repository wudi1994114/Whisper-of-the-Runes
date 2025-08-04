// assets/scripts/factories/UnifiedECSCharacterFactory.ts

import { _decorator, Component, Node, Prefab, instantiate, Vec3 } from 'cc';
import { ICharacter } from '../interfaces/ICharacter';
import { ICharacterFactory } from '../interfaces/ICharacterFactory';
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
export class UnifiedECSCharacterFactory implements ICharacterFactory {
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
     * 创建角色 - 统一入口
     * @param characterType 角色类型
     * @param options 创建选项
     */
    async createCharacter(characterType: string, options: CharacterCreationOptions = {}): Promise<ICharacter | null> {
        try {
            console.log(`[UnifiedECSFactory] 🎯 开始创建角色: ${characterType}`, options);

            // 1. 验证敌人数据
            const enemyData = dataManager.getEnemyData(characterType);
            if (!enemyData) {
                console.error(`[UnifiedECSFactory] 未找到敌人数据: ${characterType}`);
                return null;
            }

            // 2. 创建完整的角色节点（节点获取+组件管理一体化）
            const character = await this.createCompleteCharacterNode(characterType, options);
            if (!character) {
                console.error(`[UnifiedECSFactory] 角色节点创建失败: ${characterType}`);
                return null;
            }

            // 3. 配置和初始化组件
            const success = await this.configureAndInitialize(character, characterType, options);
            if (!success) {
                console.error(`[UnifiedECSFactory] 配置初始化失败: ${characterType}`);
                const node = (character as any).node;
                this.returnNodeToPool(node, characterType);
                return null;
            }

            // 4. 注册到活跃角色列表
            this.activeCharacters.add(character);

            console.log(`[UnifiedECSFactory] ✅ 角色创建成功: ${characterType} (类型: ModularCharacter)`);
            return character;

        } catch (error) {
            console.error(`[UnifiedECSFactory] 角色创建失败: ${characterType}`, error);
            return null;
        }
    }

    /**
     * 创建完整的角色节点（节点获取+组件管理一体化）
     */
    private async createCompleteCharacterNode(characterType: string, options: CharacterCreationOptions): Promise<ICharacter | null> {
        console.log(`[UnifiedECSFactory] 🏗️ 开始创建完整角色节点: ${characterType}`);
        
        const characterName = this.generateCharacterName(characterType, options);
        let characterNode: Node | null = null;
        let character: ICharacter | null = null;
        let isReused = false;
        
        // 1. 尝试从对象池获取（这些节点已经有完整组件）
        characterNode = poolManager.getEnemyInstance(characterType);
        if (characterNode) {
            console.log(`[UnifiedECSFactory] 🔄 从对象池复用节点: ${characterType}`);
            isReused = true;
            
            // 复用节点已有组件，只需重置状态
            character = characterNode.getComponent(ModularCharacter);
            if (character) {
                this.resetCharacterForReuse(character);
                console.log(`[UnifiedECSFactory] ✅ 复用节点组件状态重置完成`);
            } else {
                console.error(`[UnifiedECSFactory] 对象池节点缺少ModularCharacter组件`);
                this.returnNodeToPool(characterNode, characterType);
                return null;
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
            
            // 新节点需要注入组件
            if (characterNode) {
                this.injectModularComponents(characterNode);
                character = characterNode.getComponent(ModularCharacter);
                console.log(`[UnifiedECSFactory] ✅ 新节点组件注入完成`);
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
     * 配置和初始化组件
     */
    private async configureAndInitialize(character: ICharacter, characterType: string, options: CharacterCreationOptions): Promise<boolean> {
        console.log(`[UnifiedECSFactory] 🎛️ 开始配置和初始化: ${characterType}`);
        
        try {
            // 配置角色属性
            this.configureCharacter(character, characterType, options);

            // 统一初始化流程
            await this.initializeComponents(character);

            console.log(`[UnifiedECSFactory] ✅ 配置和初始化完成: ${characterType}`);
            return true;
        } catch (error) {
            console.error(`[UnifiedECSFactory] 配置和初始化失败: ${characterType}`, error);
            return false;
        }
    }





    /**
     * 注入 ModularCharacter 所需组件
     */
    private injectModularComponents(node: Node): void {

        const lifecycle = node.addComponent(LifecycleComponent);
        const config = node.addComponent(ConfigComponent);
        const control = node.addComponent(ControlComponent);  // 提前添加，确保在FactionComponent之前
        const faction = node.addComponent(FactionComponent);
        const aiIntention = node.addComponent(AIIntentionComponent); // AI意向组件
        const movement = node.addComponent(MovementComponent);
        const combat = node.addComponent(CombatComponent);
        const animation = node.addComponent(AnimationComponent);
        const render = node.addComponent(RenderComponent);
        const character = node.addComponent(ModularCharacter);
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
            configComponent.setEnemyType(characterType);
            if (options.aiBehaviorType) {
                configComponent.aiBehaviorType = options.aiBehaviorType;
            }
        }

        console.log(`[UnifiedECSFactory] 🎛️ 角色配置完成: ${characterType}`);
    }



    /**
     * 统一组件初始化流程 - 重构版本，解决初始化时序问题
     */
    private async initializeComponents(character: ICharacter): Promise<void> {
        const node = (character as any).node;
        console.log(`[UnifiedECSFactory] 🔄 开始初始化组件: ${node.name}`);

        // 步骤1: 等待所有组件的onLoad完成
        await this.waitForComponentsReady(node);
        
        // 验证关键组件是否已准备好
        this.verifyComponentsAfterOnLoad(node);

        // 步骤2: 加载配置数据（不触发组件初始化）
        const configComponent = node.getComponent(ConfigComponent);
        if (configComponent) {
            await configComponent.waitForDataManager();
            configComponent.loadEnemyConfig();
            console.log(`[UnifiedECSFactory] ✅ 配置数据加载完成`);
        }

        // 步骤3: 等待配置数据传播
        await this.waitForFrame();

        // 步骤4: 让ConfigComponent初始化相关组件（设置敌人数据）
        if (configComponent) {
            configComponent.initializeRelatedComponentsManually();
            console.log(`[UnifiedECSFactory] ✅ 相关组件数据设置完成`);
        }

        // 步骤5: 初始化动画组件（统一路径）
        await this.initializeAnimationComponent(node, configComponent);

        // 步骤6: 初始化控制组件
        await this.initializeControlComponent(node);

        // 步骤7: 初始化阵营组件（确保控制组件就绪）
        await this.initializeFactionComponent(node);

        // 步骤8: 初始化AI系统
        await this.initializeAISystem(node, configComponent);

        console.log(`[UnifiedECSFactory] 🔄 组件初始化完成: ${node.name}`);
    }

    /**
     * 等待所有组件的onLoad完成
     */
    private async waitForComponentsReady(node: Node): Promise<void> {
        // 等待多帧确保所有组件的onLoad都已执行
        await this.waitForFrame();
        await this.waitForFrame();
        await this.waitForFrame(); // 增加等待时间
        console.log(`[UnifiedECSFactory] ✅ 组件onLoad等待完成`);
    }

    /**
     * 验证组件在onLoad后的状态
     */
    private verifyComponentsAfterOnLoad(node: Node): void {
        const controlComponent = node.getComponent(ControlComponent);
        const animationComponent = node.getComponent(AnimationComponent);
        const factionComponent = node.getComponent(FactionComponent);
        
        console.log(`[UnifiedECSFactory] 组件验证结果:`);
        console.log(`  - ControlComponent: ${!!controlComponent}`);
        console.log(`  - AnimationComponent: ${!!animationComponent}`);
        console.log(`  - FactionComponent: ${!!factionComponent}`);
        
        if (animationComponent) {
            console.log(`  - Animation内部组件: ${!!animationComponent.animationComponent}`);
        }
        
        if (controlComponent) {
            console.log(`  - Control模式: ${controlComponent.controlMode}`);
        }
    }

    /**
     * 等待一帧
     */
    private async waitForFrame(): Promise<void> {
        return new Promise(resolve => {
            setTimeout(resolve, 16); // 约1帧的时间（60fps）
        });
    }

    /**
     * 初始化动画组件 - 简化版本，完全委托给AnimationComponent和animationManager
     */
    private async initializeAnimationComponent(node: Node, configComponent: ConfigComponent | null): Promise<void> {
        const animationComponent = node.getComponent(AnimationComponent);
        const enemyData = configComponent?.getEnemyData();
        
        if (!animationComponent) {
            console.warn(`[UnifiedECSFactory] AnimationComponent不存在，跳过动画初始化`);
            return;
        }

        if (!enemyData) {
            console.warn(`[UnifiedECSFactory] 敌人数据未就绪，跳过动画初始化`);
            return;
        }

        try {
            console.log(`[UnifiedECSFactory] 开始初始化动画组件，委托给AnimationComponent...`);
            // 直接调用AnimationComponent的初始化方法，它会使用animationManager统一管理
            await animationComponent.initializeAnimations(enemyData);
            console.log(`[UnifiedECSFactory] ✅ 动画组件初始化完成`);
        } catch (error) {
            console.error(`[UnifiedECSFactory] 动画组件初始化失败:`, error);
        }
    }

    /**
     * 初始化控制组件
     */
    private async initializeControlComponent(node: Node): Promise<void> {
        const controlComponent = node.getComponent(ControlComponent);
        if (controlComponent) {
            controlComponent.setupInput();
            console.log(`[UnifiedECSFactory] ✅ 控制组件初始化完成`);
        }
    }

    /**
     * 初始化阵营组件 - 确保控制组件就绪
     */
    private async initializeFactionComponent(node: Node): Promise<void> {
        const factionComponent = node.getComponent(FactionComponent);
        
        if (!factionComponent) {
            console.warn(`[UnifiedECSFactory] FactionComponent不存在，跳过阵营初始化`);
            return;
        }

        // 详细检查控制组件
        let controlComponent = node.getComponent(ControlComponent);
        if (!controlComponent) {
            console.error(`[UnifiedECSFactory] ControlComponent不存在，尝试重新获取...`);
            
            // 等待几帧后重试
            await this.waitForFrame();
            await this.waitForFrame();
            
            controlComponent = node.getComponent(ControlComponent);
            if (!controlComponent) {
                console.error(`[UnifiedECSFactory] 仍然无法获取ControlComponent，检查组件列表...`);
                const components = node.components;
                console.log(`[UnifiedECSFactory] 节点组件列表:`, components.map(c => c.constructor.name));
                
                // 尝试通过组件名称获取
                controlComponent = node.getComponent('ControlComponent') as any;
                if (!controlComponent) {
                    console.error(`[UnifiedECSFactory] 通过名称也无法获取ControlComponent，阵营初始化失败`);
                    return;
                }
            }
        }

        console.log(`[UnifiedECSFactory] 找到ControlComponent，当前controlMode: ${controlComponent.controlMode}`);

        // 等待控制组件完全就绪
        let retryCount = 0;
        const maxRetries = 10;
        
        while (retryCount < maxRetries) {
            if (controlComponent.controlMode !== undefined) {
                console.log(`[UnifiedECSFactory] ControlComponent就绪，controlMode: ${controlComponent.controlMode}`);
                break;
            }
            console.log(`[UnifiedECSFactory] 等待ControlComponent设置controlMode... (尝试 ${retryCount + 1}/${maxRetries})`);
            await this.waitForFrame();
            retryCount++;
        }

        if (retryCount >= maxRetries) {
            console.error(`[UnifiedECSFactory] 控制组件初始化超时，controlMode仍为: ${controlComponent.controlMode}`);
        }

        factionComponent.setupDefaultFaction();
        console.log(`[UnifiedECSFactory] ✅ 阵营组件初始化完成`);
    }

    /**
     * 初始化AI系统
     */
    private async initializeAISystem(node: Node, configComponent: ConfigComponent | null): Promise<void> {
        const controlComponent = node.getComponent(ControlComponent);
        
        if (controlComponent?.controlMode === ControlMode.AI && configComponent) {
            configComponent.initializeAI();
            console.log(`[UnifiedECSFactory] ✅ AI系统初始化完成`);
        }
    }

    /**
     * 重置角色状态以供复用
     */
    private resetCharacterForReuse(character: ICharacter): void {
        const node = (character as any).node;
        
        // 触发重用事件
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
    public static async createAIEnemy(characterType: string, options: {
        position?: Vec3;
        faction: string;
        behaviorType?: string;
    }): Promise<ICharacter | null> {
        return await UnifiedECSCharacterFactory.getInstance().createCharacter(characterType, {
            controlMode: ControlMode.AI,
            position: options.position,
            aiFaction: options.faction,
            aiBehaviorType: options.behaviorType || 'melee'
        });
    }

    /**
     * 创建玩家角色
     */
    public static async createPlayer(characterType: string, options: {
        position?: Vec3;
    } = {}): Promise<ICharacter | null> {
        return await UnifiedECSCharacterFactory.getInstance().createCharacter(characterType, {
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