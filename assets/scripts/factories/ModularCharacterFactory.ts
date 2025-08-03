// assets/scripts/factories/ModularCharacterFactory.ts

import { Node, Vec3, instantiate, Prefab } from 'cc';
import { ICharacter, ICharacterFactory } from '../interfaces/ICharacter';
import { ControlMode } from '../state-machine/CharacterEnums';
import { ModularCharacter } from '../entities/ModularCharacter';

// 组件导入
import { MovementComponent } from '../components/MovementComponent';
import { CombatComponent } from '../components/CombatComponent';
import { AnimationComponent } from '../components/AnimationComponent';
import { LifecycleComponent } from '../components/LifecycleComponent';
import { ControlComponent } from '../components/ControlComponent';
import { FactionComponent } from '../components/FactionComponent';
import { ConfigComponent } from '../components/ConfigComponent';
import { RenderComponent } from '../components/RenderComponent';

/**
 * 模块化角色工厂
 * 负责创建和组装模块化角色，解决依赖倒置原则中的"如何找到具体实现"问题
 * 
 * 设计模式：
 * 1. 工厂模式 - 封装角色创建逻辑
 * 2. 依赖注入 - 注入具体的组件实现
 * 3. 组合模式 - 将多个组件组合成完整角色
 * 4. 单例模式 - 全局唯一的工厂实例
 */
export class ModularCharacterFactory implements ICharacterFactory {
    private static instance: ModularCharacterFactory | null = null;
    private activeCharacters: Set<ICharacter> = new Set();
    private characterPrefabs: Map<string, Prefab> = new Map();

    private constructor() {}

    /**
     * 获取工厂单例实例
     */
    public static getInstance(): ModularCharacterFactory {
        if (!ModularCharacterFactory.instance) {
            ModularCharacterFactory.instance = new ModularCharacterFactory();
        }
        return ModularCharacterFactory.instance;
    }

    /**
     * 注册角色预制体
     * @param characterType 角色类型
     * @param prefab 预制体资源
     */
    public registerCharacterPrefab(characterType: string, prefab: Prefab): void {
        this.characterPrefabs.set(characterType, prefab);
        console.log(`[ModularCharacterFactory] 注册角色预制体: ${characterType}`);
    }

    /**
     * 创建角色 - 工厂方法的核心实现
     * @param characterType 角色类型
     * @param options 创建选项
     */
    async createCharacter(characterType: string, options?: any): Promise<ICharacter | null> {
        try {
            console.log(`[ModularCharacterFactory] 开始创建角色: ${characterType}`, options);

            // 1. 创建基础节点
            const characterNode = this.createBaseNode(characterType, options);
            if (!characterNode) {
                console.error(`[ModularCharacterFactory] 创建基础节点失败: ${characterType}`);
                return null;
            }

            // 2. 依赖注入 - 添加所有必要的组件
            this.injectComponents(characterNode);

            // 3. 获取主角色组件
            const character = characterNode.getComponent(ModularCharacter);
            if (!character) {
                console.error(`[ModularCharacterFactory] 主角色组件不存在`);
                characterNode.destroy();
                return null;
            }

            // 4. 配置角色属性
            this.configureCharacter(character, characterType, options);

            // 5. 初始化组件依赖关系
            await this.initializeComponents(character);

            // 6. 注册到活跃角色列表
            this.activeCharacters.add(character);

            console.log(`[ModularCharacterFactory] ✅ 角色创建成功: ${characterType}`);
            return character;

        } catch (error) {
            console.error(`[ModularCharacterFactory] 角色创建失败: ${characterType}`, error);
            return null;
        }
    }

    /**
     * 回收角色
     * @param character 角色实例
     */
    recycleCharacter(character: ICharacter): void {
        if (!this.activeCharacters.has(character)) {
            console.warn(`[ModularCharacterFactory] 尝试回收未注册的角色`);
            return;
        }

        // 触发回收逻辑
        const lifecycleComponent = (character as any).node.getComponent(LifecycleComponent);
        if (lifecycleComponent) {
            lifecycleComponent.returnToPool();
        }

        // 从活跃列表移除
        this.activeCharacters.delete(character);

        console.log(`[ModularCharacterFactory] 角色已回收: ${character.id}`);
    }

    /**
     * 按类型回收所有角色
     * @param characterType 角色类型
     */
    recycleAllByType(characterType: string): void {
        const charactersToRecycle: ICharacter[] = [];
        
        this.activeCharacters.forEach(character => {
            const configComponent = (character as any).node.getComponent(ConfigComponent);
            if (configComponent && configComponent.getCharacterType() === characterType) {
                charactersToRecycle.push(character);
            }
        });

        charactersToRecycle.forEach(character => {
            this.recycleCharacter(character);
        });

        console.log(`[ModularCharacterFactory] 已回收${characterType}类型角色，数量: ${charactersToRecycle.length}`);
    }

    /**
     * 获取活跃角色数量
     */
    getActiveCharacterCount(): number {
        return this.activeCharacters.size;
    }

    /**
     * 创建基础节点
     * @param characterType 角色类型
     * @param options 创建选项
     */
    private createBaseNode(characterType: string, options?: any): Node | null {
        let characterNode: Node;

        // 尝试从预制体创建
        const prefab = this.characterPrefabs.get(characterType);
        if (prefab) {
            characterNode = instantiate(prefab);
            console.log(`[ModularCharacterFactory] 从预制体创建节点: ${characterType}`);
        } else {
            // 创建空节点
            characterNode = new Node(`Character_${characterType}`);
            console.log(`[ModularCharacterFactory] 创建空节点: ${characterType}`);
        }

        // 设置位置
        if (options?.position) {
            characterNode.setPosition(options.position);
        }

        return characterNode;
    }

    /**
     * 依赖注入 - 添加所有组件
     * @param node 角色节点
     */
    private injectComponents(node: Node): void {
        console.log(`[ModularCharacterFactory] 开始注入组件到节点: ${node.name}`);

        // 按依赖顺序添加组件
        // 1. 基础组件（无依赖）
        const lifecycleComponent = node.addComponent(LifecycleComponent);
        const configComponent = node.addComponent(ConfigComponent);
        const factionComponent = node.addComponent(FactionComponent);

        // 2. 功能组件（可能有基础依赖）
        const movementComponent = node.addComponent(MovementComponent);
        const combatComponent = node.addComponent(CombatComponent);
        const animationComponent = node.addComponent(AnimationComponent);
        const renderComponent = node.addComponent(RenderComponent);

        // 3. 控制组件（依赖其他组件）
        const controlComponent = node.addComponent(ControlComponent);

        // 4. 主角色组件（组合所有功能）
        const mainCharacter = node.addComponent(ModularCharacter);

        console.log(`[ModularCharacterFactory] 组件注入完成，共注入 9 个组件`);
    }

    /**
     * 配置角色属性
     * @param character 角色实例
     * @param characterType 角色类型
     * @param options 配置选项
     */
    private configureCharacter(character: ICharacter, characterType: string, options?: any): void {
        const node = (character as any).node;

        // 配置生命周期组件
        const lifecycleComponent = node.getComponent(LifecycleComponent);
        if (lifecycleComponent && options) {
            const characterId = options.characterId || `${characterType}_${Date.now()}`;
            lifecycleComponent.setPoolingProperties(
                options.isFromPool || false,
                options.poolName || `${characterType}_pool`,
                characterId
            );
        }

        // 配置控制组件
        const controlComponent = node.getComponent(ControlComponent);
        if (controlComponent && options?.controlMode !== undefined) {
            controlComponent.controlMode = options.controlMode;
        }

        // 配置阵营组件
        const factionComponent = node.getComponent(FactionComponent);
        if (factionComponent && options?.aiFaction) {
            factionComponent.aiFaction = options.aiFaction;
        }

        // 配置配置组件
        const configComponent = node.getComponent(ConfigComponent);
        if (configComponent) {
            if (options?.aiBehaviorType) {
                configComponent.aiBehaviorType = options.aiBehaviorType;
            }
            // 设置敌人类型
            configComponent.setEnemyType(characterType);
        }

        console.log(`[ModularCharacterFactory] 角色配置完成: ${characterType}`);
    }

    /**
     * 初始化组件依赖关系
     * @param character 角色实例
     */
    private async initializeComponents(character: ICharacter): Promise<void> {
        const node = (character as any).node;

        // 1. 等待配置组件加载数据
        const configComponent = node.getComponent(ConfigComponent);
        if (configComponent) {
            await configComponent.waitForDataManager();
            configComponent.loadEnemyConfig();
        }

        // 2. 初始化动画组件
        const animationComponent = node.getComponent(AnimationComponent);
        const enemyData = configComponent?.getEnemyData();
        if (animationComponent && enemyData) {
            await animationComponent.initializeAnimations(enemyData);
        }

        // 3. 设置输入系统
        const controlComponent = node.getComponent(ControlComponent);
        if (controlComponent) {
            controlComponent.setupInput();
        }

        // 4. 设置默认阵营（使用微任务延迟执行确保物理组件已初始化）
        const factionComponent = node.getComponent(FactionComponent);
        if (factionComponent) {
            // 使用微任务延迟执行，确保所有组件都已初始化
            Promise.resolve().then(() => {
                factionComponent.setupDefaultFaction();
            });
        }

        // 6. 初始化AI（如果是AI模式）
        if (controlComponent?.controlMode === ControlMode.AI && configComponent) {
            configComponent.initializeAI();
        }

        console.log(`[ModularCharacterFactory] 组件初始化完成`);
    }

    /**
     * 便捷方法：创建玩家角色
     */
    public static async createPlayer(characterType: string, position?: Vec3): Promise<ICharacter | null> {
        return await ModularCharacterFactory.getInstance().createCharacter(characterType, {
            controlMode: ControlMode.MANUAL,
            position: position,
            aiFaction: "player"
        });
    }

    /**
     * 便捷方法：创建AI敌人
     */
    public static async createAIEnemy(characterType: string, options: {
        position?: Vec3;
        faction: string;
        behaviorType?: string;
    }): Promise<ICharacter | null> {
        return await ModularCharacterFactory.getInstance().createCharacter(characterType, {
            controlMode: ControlMode.AI,
            position: options.position,
            aiFaction: options.faction,
            aiBehaviorType: options.behaviorType || 'melee'
        });
    }

    /**
     * 获取指定类型的活跃角色
     */
    public getActiveCharactersByType(characterType: string): ICharacter[] {
        const result: ICharacter[] = [];
        
        this.activeCharacters.forEach(character => {
            const configComponent = (character as any).node.getComponent(ConfigComponent);
            if (configComponent && configComponent.getCharacterType() === characterType) {
                result.push(character);
            }
        });

        return result;
    }
}