// assets/scripts/core/MonsterSpawner.ts

import { _decorator, Component, Node, director, Vec3, instantiate, Prefab } from 'cc';
import { AIBehaviorType } from '../components/MonsterAI';
import { Faction, FactionUtils } from '../configs/FactionConfig';
import { dataManager } from './DataManager';
import { eventManager } from './EventManager';
import { GameEvents } from '../components/GameEvents';
import { GameManager } from './GameManager';

import { ControlMode } from '../state-machine/CharacterEnums';
import { UnifiedECSCharacterFactory } from '../factories/UnifiedECSCharacterFactory';
import { flowFieldManager } from './FlowFieldManager';

const { ccclass, property } = _decorator;

/**
 * 怪物生成器接口
 */
interface SpawnerConfig {
    id: string;
    position: { x: number, y: number };
    spawnRadius: number;
    spawnType: string;
    size?: { width: number, height: number };
    randomOffset?: { x: number, y: number }; // 随机偏移范围
    enemies: EnemySpawnConfig[];
}

/**
 * 敌人生成配置接口
 */
interface EnemySpawnConfig {
    type: string;
    count: number;
    spawnInterval: number;
    maxAlive: number;
    spawnDelay: number;
    respawnOnDeath: boolean;
    faction?: string; // 支持每个敌人指定独立的阵营
}

/**
 * 网格刷怪配置接口
 */
interface GridSpawnConfig {
    enabled: boolean;
    cellSize: number;           // 网格单元大小
    edgeOffset: number;         // 距离屏幕边缘的偏移
    rows: number;               // 网格行数
    leftColumns: number;        // 左侧列数
    rightColumns: number;       // 右侧列数
    columnSpacing: number;      // 列间距
}

/**
 * 双侧战斗配置接口 - 用于流场AI测试
 */
interface DualSideBattleConfig {
    enabled: boolean;
    leftSide: {
        faction: string;
        enemyTypes: string[];
        spawnCount: number;
        spawnPosition: { x: number, y: number };
        spawnRadius: number;
    };
    rightSide: {
        faction: string;
        enemyTypes: string[];
        spawnCount: number;
        spawnPosition: { x: number, y: number };
        spawnRadius: number;
    };
    respawnInterval: number; // 重生间隔
    maxUnitsPerSide: number; // 每侧最大单位数
}

/**
 * 怪物生成器组件
 * 负责根据关卡配置生成和管理怪物
 */
@ccclass('MonsterSpawner')
export class MonsterSpawner extends Component {

    @property({ type: Prefab, displayName: "怪物预制体" })
    public monsterPrefab: Prefab | null = null;

    @property({
        displayName: "启用双侧战斗模式",
        tooltip: "启用后将在左右两侧生成敌对阵营进行流场AI测试"
    })
    public enableDualSideBattle: boolean = false;

    // 双侧战斗配置（唯一刷怪模式）
    private dualSideBattleConfig: DualSideBattleConfig | null = null;

    // 双侧战斗的单位管理
    private leftSideUnits: Node[] = [];
    private rightSideUnits: Node[] = [];

    // 双侧战斗计时器
    private dualSideSpawnTimer: number = 0;

    // 是否已初始化
    private isInitialized: boolean = false;

    // 【性能优化】生成器更新定时控制
    private spawnUpdateTimer: number = 0;
    private readonly SPAWN_UPDATE_INTERVAL = 0.5; // 0.5秒更新一次

    // 移除spawnerFaction，每个敌人按照自己的配置设置阵营

    protected onLoad(): void {
        // 双侧战斗模式不需要监听常规怪物死亡事件
    }

    protected onDestroy(): void {
        // 清理所有计时器
        this.unscheduleAllCallbacks();
    }

    protected update(deltaTime: number): void {
        if (!this.isInitialized) {
            return;
        }

        // 【性能优化】降低生成计时器更新频率
        this.spawnUpdateTimer += deltaTime;
        if (this.spawnUpdateTimer >= this.SPAWN_UPDATE_INTERVAL) {
            // 只运行双侧战斗模式
            if (this.dualSideBattleConfig) {
                this.updateDualSideBattle(this.spawnUpdateTimer);
            }

            this.spawnUpdateTimer = 0;
        }
    }



    /**
     * 使用配置初始化生成器 - 现在直接启动双侧战斗模式
     * @param config 生成器配置（仅用于位置设置）
     */
    public initWithConfig(config: SpawnerConfig): void {
        // 只用传入的config设置位置，其他都忽略
        this.node.setPosition(config.position.x, config.position.y);
        
        console.log(`[MonsterSpawner] 位置设置为: (${config.position.x}, ${config.position.y})，启动双侧战斗模式`);

        // 直接初始化双侧战斗模式
        this.initDualSideBattle();
    }

    /**
     * 初始化双侧战斗模式
     */
    public initDualSideBattle(): void {
        console.log('[MonsterSpawner] 初始化双侧战斗模式');

        // 确保流场AI系统启动（双侧战斗模式必需）
        this.ensureFlowFieldSystemActive();

        // 创建默认配置
        this.dualSideBattleConfig = {
            enabled: true,
            leftSide: {
                faction: 'red',  // 左侧红色怪物使用红色阵营
                enemyTypes: ['ent_normal', 'lich_normal'],
                spawnCount: 5,
                spawnPosition: { x: -400, y: 0 },
                spawnRadius: 100
            },
            rightSide: {
                faction: 'blue',  // 右侧蓝色怪物使用蓝色阵营
                enemyTypes: ['ent_normal', 'lich_normal'],
                spawnCount: 5,
                spawnPosition: { x: 400, y: 0 },
                spawnRadius: 100
            },
            respawnInterval: 3.0,
            maxUnitsPerSide: 10
        };

        this.isInitialized = true;
        this.enableDualSideBattle = true;

        // 立即开始双侧生成
        this.startDualSideBattle();

        console.log('[MonsterSpawner] ✅ 双侧战斗模式初始化完成');
    }

    /**
     * 开始双侧战斗
     */
    private async startDualSideBattle(): Promise<void> {
        if (!this.dualSideBattleConfig) return;

        console.log('[MonsterSpawner] 🚀 开始双侧战斗生成');

        // 生成左侧单位
        await this.spawnSideUnits('left');

        // 延迟一秒后生成右侧单位
        setTimeout(async () => {
            await this.spawnSideUnits('right');
        }, 1000);
    }

    /**
     * 更新双侧战斗状态
     */
    private updateDualSideBattle(deltaTime: number): void {
        if (!this.dualSideBattleConfig) return;

        this.dualSideSpawnTimer += deltaTime;

        // 检查是否需要重生单位
        if (this.dualSideSpawnTimer >= this.dualSideBattleConfig.respawnInterval) {
            this.checkAndRespawnSides();
            this.dualSideSpawnTimer = 0;
        }
    }

    /**
     * 检查并重生双方单位
     */
    private async checkAndRespawnSides(): Promise<void> {
        if (!this.dualSideBattleConfig) return;

        // 清理无效单位
        this.leftSideUnits = this.leftSideUnits.filter(unit => unit && unit.isValid);
        this.rightSideUnits = this.rightSideUnits.filter(unit => unit && unit.isValid);

        const config = this.dualSideBattleConfig;

        // 检查左侧
        if (this.leftSideUnits.length < config.maxUnitsPerSide) {
            const needSpawn = Math.min(
                config.leftSide.spawnCount,
                config.maxUnitsPerSide - this.leftSideUnits.length
            );

            if (needSpawn > 0) {
                console.log(`[MonsterSpawner] 补充左侧单位 ${needSpawn}个`);
                await this.spawnSideUnits('left', needSpawn);
            }
        }

        // 检查右侧
        if (this.rightSideUnits.length < config.maxUnitsPerSide) {
            const needSpawn = Math.min(
                config.rightSide.spawnCount,
                config.maxUnitsPerSide - this.rightSideUnits.length
            );

            if (needSpawn > 0) {
                console.log(`[MonsterSpawner] 补充右侧单位 ${needSpawn}个`);
                await this.spawnSideUnits('right', needSpawn);
            }
        }
    }

    /**
     * 生成指定侧的单位
     */
    private async spawnSideUnits(side: 'left' | 'right', overrideCount?: number): Promise<void> {
        if (!this.dualSideBattleConfig) return;

        const sideConfig = side === 'left' ? this.dualSideBattleConfig.leftSide : this.dualSideBattleConfig.rightSide;
        const unitsArray = side === 'left' ? this.leftSideUnits : this.rightSideUnits;
        const spawnCount = overrideCount || sideConfig.spawnCount;

        console.log(`[MonsterSpawner] 开始生成${side === 'left' ? '左' : '右'}侧单位: ${spawnCount}个, 阵营: ${sideConfig.faction}`);

        for (let i = 0; i < spawnCount; i++) {
            // 随机选择敌人类型
            const enemyType = sideConfig.enemyTypes[Math.floor(Math.random() * sideConfig.enemyTypes.length)];

            // 计算生成位置
            const spawnPos = this.getSideSpawnPosition(sideConfig);

            // 创建单位
            const unit = await this.createDualSideBattleUnit(enemyType, spawnPos, sideConfig.faction);

            if (unit) {
                unitsArray.push(unit);
                console.log(`[MonsterSpawner] ✅ ${side === 'left' ? '左' : '右'}侧单位已生成: ${enemyType} (${sideConfig.faction}阵营)`);
            }
        }

        console.log(`[MonsterSpawner] ${side === 'left' ? '左' : '右'}侧单位生成完成，当前总数: ${unitsArray.length}`);
    }

    /**
     * 获取侧边生成位置
     */
    private getSideSpawnPosition(sideConfig: any): Vec3 {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * sideConfig.spawnRadius;

        const x = sideConfig.spawnPosition.x + Math.cos(angle) * radius;
        const y = sideConfig.spawnPosition.y + Math.sin(angle) * radius;

        return new Vec3(x, y, 0);
    }

    /**
     * 创建双侧战斗单位
     */
    private async createDualSideBattleUnit(enemyType: string, position: Vec3, faction: string): Promise<Node | null> {
        try {
            console.log(`[MonsterSpawner] 创建双侧战斗单位: ${enemyType}, 阵营: ${faction}, 位置: (${position.x.toFixed(1)}, ${position.y.toFixed(1)})`);

            // 获取游戏管理器，确保启用流场AI
            const gameManager = GameManager.instance;
            const useFlowField = gameManager && gameManager.useOneDimensionalFlowField;

            // 使用统一ECS工厂创建AI敌人，强制启用流场AI
            const character = await UnifiedECSCharacterFactory.createAIEnemy(enemyType, {
                position: position,
                faction: faction,
                behaviorType: 'melee', // 双侧战斗使用近战模式
                useFlowField: true // 强制启用流场AI
            });

            if (!character) {
                console.error(`[MonsterSpawner] 创建双侧战斗单位失败: ${enemyType}`);
                return null;
            }

            const characterNode = (character as any).node as Node;

            // 添加到Canvas
            this.addMonsterToCanvas(characterNode);

            console.log(`[MonsterSpawner] ✅ 双侧战斗单位创建成功: ${enemyType} (${faction}阵营, 流场AI: ${useFlowField})`);
            return characterNode;

        } catch (error) {
            console.error(`[MonsterSpawner] 创建双侧战斗单位异常:`, error);
            return null;
        }
    }















    /**
     * 创建怪物 - 使用新的模块化角色工厂系统
     */
    private async createMonster(enemyType: string, position: Vec3, enemyConfig?: EnemySpawnConfig): Promise<Node | null> {
        try {
            console.log(`MonsterSpawner: 创建怪物 ${enemyType} 位置: ${position.x}, ${position.y}`);

            // 1. 获取敌人配置数据
            const enemyData = dataManager.getEnemyData(enemyType);
            if (!enemyData) {
                console.error(`MonsterSpawner: 未找到敌人类型 ${enemyType} 的配置数据`);
                return null;
            }

            const behaviorType = this.determineAIBehaviorType(enemyType);

            // 2. 🔥 使用统一ECS工厂创建AI敌人（先确保工厂可用）
            let character = null;
            try {
                // 检查游戏管理器是否启用一维流场AI
                const gameManager = GameManager.instance;
                const useFlowField = gameManager && gameManager.useOneDimensionalFlowField;

                character = await UnifiedECSCharacterFactory.createAIEnemy(enemyType, {
                    position: position,
                    faction: enemyConfig?.faction || 'red',
                    behaviorType: behaviorType,
                    useFlowField: useFlowField
                });

                if (useFlowField) {
                    console.log(`[MonsterSpawner] 创建流场AI怪物: ${enemyType} (${enemyConfig?.faction || 'red'}阵营)`);
                }
            } catch (factoryError) {
                console.error(`[MonsterSpawner] 工厂初始化失败:`, factoryError);
                // 工厂创建失败，直接返回null
                return null;
            }

            if (!character) {
                console.error(`MonsterSpawner: 统一ECS工厂创建怪物失败 ${enemyType}`);
                // 工厂创建失败，直接返回null
                return null;
            }

            // 3. 获取角色节点
            const characterNode = (character as any).node as Node;

            // 3.5. 强制设置位置（确保工厂没有覆盖我们的位置设置）
            characterNode.setPosition(position);
            console.log(`[MonsterSpawner] 强制设置怪物位置为: (${position.x}, ${position.y})`);

            // 4. 添加到Canvas下
            this.addMonsterToCanvas(characterNode);

            const characterName = (character as any).node.name;
            const finalPos = characterNode.getPosition();
            console.log(`MonsterSpawner: ✅ 使用统一ECS工厂创建怪物成功: ${characterName} [${enemyType}]，最终位置: (${finalPos.x}, ${finalPos.y})`);
            return characterNode;

        } catch (error) {
            console.error('MonsterSpawner: 统一ECS工厂创建失败', error);
            return null;
        }
    }
    /**
     * 【新增】确保敌人类型已正确设置的统一方法
     * @param monsterNode 怪物节点
     * @param enemyType 敌人类型
     */
    private ensureEnemyTypeSet(monsterNode: Node, enemyType: string): void {
        try {
            // 1. 使用新的ECS组件设置敌人类型
            const configComponent = monsterNode.getComponent('ConfigComponent');
            if (configComponent && (configComponent as any).setEnemyType) {
                (configComponent as any).setEnemyType(enemyType);
                console.log(`MonsterSpawner: ✅ 确认敌人类型已设置: ${enemyType} (通过ConfigComponent)`);
            } else {
                console.warn(`MonsterSpawner: ⚠️ 未找到ConfigComponent组件或setEnemyType方法`);
            }

            // 3. 设置节点名称（便于调试）
            // 检查并更新节点名称为友好的显示名称
            if (!monsterNode.name.includes(enemyType)) {
                // 获取敌人数据中的中文名称
                const enemyData = dataManager.getEnemyData(enemyType);
                const displayName = enemyData?.name || enemyType;
                const timestamp = Date.now().toString().slice(-6);
                monsterNode.name = `${displayName}_${timestamp}`;
            }

        } catch (error) {
            console.error(`MonsterSpawner: 设置敌人类型失败 - ${enemyType}`, error);
        }
    }

    /**
     * 将怪物节点添加到Canvas下
     * @param monsterNode 怪物节点
     */
    private addMonsterToCanvas(monsterNode: Node): void {
        const scene = director.getScene();
        if (!scene) {
            console.error('MonsterSpawner: 无法获取当前场景。');
            return;
        }

        const canvas = scene.getComponentInChildren('cc.Canvas');
        if (canvas && canvas.node) {
            canvas.node.addChild(monsterNode);
        } else {
            console.warn('MonsterSpawner: 未在场景中找到Canvas节点，怪物将被添加到根节点。');
            scene.addChild(monsterNode);
        }
    }

    /**
     * 手动初始化怪物组件（传统实例化的备用方案）
     */
    private initializeMonsterComponents(monster: Node, enemyType: string, enemyData: any): void {
        try {
            // 【强化】确保敌人类型在组件初始化开始时已设置
            this.ensureEnemyTypeSet(monster, enemyType);

            // 设置怪物类型
            const enemyComponent = monster.getComponent('NormalEnemy');
            if (enemyComponent) {
                const setEnemyIdMethod = (enemyComponent as any).setEnemyId;
                if (setEnemyIdMethod && typeof setEnemyIdMethod === 'function') {
                    setEnemyIdMethod.call(enemyComponent, enemyType);
                }

                // 设置出生位置
                const setSpawnPositionMethod = (enemyComponent as any).setSpawnPosition;
                if (setSpawnPositionMethod && typeof setSpawnPositionMethod === 'function') {
                    setSpawnPositionMethod.call(enemyComponent, monster.position);
                }
            }

            // 手动初始化CharacterStats组件
            const characterStats = monster.getComponent('CharacterStats') as any;
            if (characterStats && characterStats.initWithEnemyData) {
                characterStats.initWithEnemyData(enemyData).catch((error: any) => {
                    console.error('MonsterSpawner: CharacterStats初始化失败', error);
                });
            }

            // 手动初始化血条组件
            const healthBarComponent = monster.getComponent('HealthBarComponent') as any;
            if (healthBarComponent) {
                if (characterStats) {
                    healthBarComponent.bindCharacterStats(characterStats);
                } else {
                    healthBarComponent.setHealthData(enemyData.baseHealth || 100);
                }

                const characterType = enemyType.startsWith('ent_') ? 'ent' : 'lich';
                healthBarComponent.setCharacterType(characterType);
            }

            console.log(`MonsterSpawner: 手动初始化怪物组件完成 - ${enemyType}`);

        } catch (error) {
            console.error('MonsterSpawner: 手动初始化怪物组件失败', error);
        }
    }

    /**
     * 为怪物设置AI控制（传统方式创建的怪物用）
     */
    private addAIController(monster: Node, enemyType: string, enemyData: any, enemyConfig?: EnemySpawnConfig): void {
        try {
            // 【强化】在AI设置开始前确保敌人类型已设置
            this.ensureEnemyTypeSet(monster, enemyType);

            // 使用新的ECS组件检查和设置AI
            const controlComponent = monster.getComponent('ControlComponent');
            if (!controlComponent) {
                console.warn(`MonsterSpawner: ${monster.name} 没有ControlComponent组件，无法设置AI`);
                return;
            }

            // 检查是否已经设置了AI模式（避免重复设置）
            if ((controlComponent as any).controlMode === ControlMode.AI) {
                console.log(`MonsterSpawner: ${monster.name} 已通过ECS系统设置AI，跳过重复设置`);
                return;
            }

            // 【关键修复】确保MonsterSpawner只在正常模式下设置AI，不干扰其他模式
            const gameManager = GameManager?.instance;
            if (gameManager && gameManager.normalMode) {
                // 检查阵营配置
                if (!enemyConfig || !enemyConfig.faction) {
                    console.error(`MonsterSpawner: 敌人 ${enemyType} 缺少阵营配置，无法设置AI`);
                    return;
                }

                const targetFaction = FactionUtils.stringToFaction(enemyConfig.faction);
                console.log(`MonsterSpawner: 设置敌人阵营: ${enemyConfig.faction} -> ${targetFaction}`);

                console.log(`MonsterSpawner: 开始设置 ${enemyType} 的阵营和AI - 目标阵营: ${targetFaction}`);

                // 1. 设置阵营信息到FactionComponent
                const factionComponent = monster.getComponent('FactionComponent');
                if (factionComponent && (factionComponent as any).setFaction) {
                    (factionComponent as any).setFaction(targetFaction);
                    console.log(`MonsterSpawner: ✅ 阵营已设置: ${targetFaction} (通过FactionComponent)`);
                } else {
                    console.warn(`MonsterSpawner: ❌ FactionComponent或setFaction方法不存在`);
                }

                // 2. 设置控制模式为AI
                if ((controlComponent as any).setControlMode) {
                    (controlComponent as any).setControlMode(ControlMode.AI);
                    console.log(`MonsterSpawner: ✅ AI控制模式已设置`);
                } else {
                    console.warn(`MonsterSpawner: ❌ ControlComponent.setControlMode方法不存在`);
                }
            } else {
                console.log(`MonsterSpawner: 跳过AI设置 - 当前不是正常模式，让其他逻辑处理控制模式`);
            }
        } catch (error) {
            console.error(`MonsterSpawner: 设置ECS AI失败 - ${enemyType}`, error);
        }
    }

    /**
     * 根据敌人类型确定AI行为类型
     */
    private determineAIBehaviorType(enemyType: string): string {
        // 巫妖系列为远程攻击
        if (enemyType.includes('lich')) {
            return AIBehaviorType.RANGED;
        }

        // 其他为近战攻击
        return AIBehaviorType.MELEE;
    }

    /**
     * 将Faction枚举转换为字符串
     */
    private factionToString(faction: Faction): string {
        // 使用FactionUtils来转换
        return FactionUtils.factionToString(faction);
    }



    /**
     * 清理所有怪物（只保留双侧战斗模式）
     */
    public clearAllMonsters(): void {
        // 清理双侧战斗的单位
        this.clearDualSideBattleUnits();

        console.log('[MonsterSpawner] 双侧战斗单位已清理');
    }

    /**
     * 确保流场AI系统处于活跃状态
     */
    private ensureFlowFieldSystemActive(): void {
        const gameManager = GameManager.instance;
        if (!gameManager) {
            console.error('[MonsterSpawner] GameManager实例不存在，无法启动流场系统');
            return;
        }

        // 检查是否已启用流场AI
        if (!gameManager.useOneDimensionalFlowField) {
            console.log('[MonsterSpawner] 🚀 双侧战斗模式自动启用流场AI系统');
            
            // 强制启用流场AI
            gameManager.useOneDimensionalFlowField = true;
            
            // 🎯 移除重复初始化：GameManager已在initManagers中初始化了流场系统
            // flowFieldManager.initialize(30, 1920, 1080); // 已移除
            
            console.log('[MonsterSpawner] ✅ 流场AI系统已启动（使用GameManager的初始化）');
        } else {
            console.log('[MonsterSpawner] ✅ 流场AI系统已处于活跃状态');
        }
    }

    /**
     * 清理双侧战斗单位
     */
    public clearDualSideBattleUnits(): void {
        // 清理左侧单位
        this.leftSideUnits.forEach(unit => {
            if (unit && unit.isValid) {
                unit.destroy();
            }
        });
        this.leftSideUnits = [];

        // 清理右侧单位
        this.rightSideUnits.forEach(unit => {
            if (unit && unit.isValid) {
                unit.destroy();
            }
        });
        this.rightSideUnits = [];

        console.log('[MonsterSpawner] 双侧战斗单位已清理');
    }

    /**
     * 获取双侧战斗状态
     */
    public getDualSideBattleStatus(): {
        enabled: boolean;
        leftSideCount: number;
        rightSideCount: number;
        totalUnits: number;
    } {
        return {
            enabled: this.enableDualSideBattle && !!this.dualSideBattleConfig,
            leftSideCount: this.leftSideUnits.filter(unit => unit && unit.isValid).length,
            rightSideCount: this.rightSideUnits.filter(unit => unit && unit.isValid).length,
            totalUnits: this.leftSideUnits.length + this.rightSideUnits.length
        };
    }
} 