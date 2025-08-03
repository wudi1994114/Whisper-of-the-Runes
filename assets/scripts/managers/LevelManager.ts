// assets/scripts/core/LevelManager.ts

import { _decorator, Component, Node, director } from 'cc';
import { dataManager } from './DataManager';
import { animationManager } from './AnimationManager';
import { eventManager } from './EventManager';
import { GameEvents } from '../components/GameEvents';
import { resourceManager } from './ResourceManager';
import { FactionRelationships } from '../configs/FactionConfig';
import { factionManager } from './FactionManager';
import { MonsterSpawner } from './MonsterSpawner';
// import { CharacterPoolInitializer } from '../pool/CharacterPoolSystem'; // 已移除
// import { ModularCharacterFactory } from '../factories/ModularCharacterFactory'; // 已移除

const { ccclass } = _decorator;

/**
 * 关卡数据接口
 */
export interface LevelData {
    id: number;
    name: string;
    backgroundImage: string;
    mapSize?: { width: number; height: number };
    playerSpawn?: { x: number; y: number };
    factionRelationships?: FactionRelationships;
    monsterSpawners?: MonsterSpawnerData[];
    enemies?: LegacyEnemyData[];
    objectives?: any[];
    duration: number;
    description: string;
}

/**
 * 怪物生成器数据接口
 */
export interface MonsterSpawnerData {
    id: string;
    position: { x: number; y: number };
    spawnRadius: number;
    spawnType: string;
    enemies: {
        type: string;
        count: number;
        spawnInterval: number;
        maxAlive: number;
        spawnDelay: number;
        respawnOnDeath: boolean;
        faction: string; // 每个敌人必须有自己的阵营
    }[];
}

/**
 * 遗留敌人数据接口（兼容旧格式）
 */
export interface LegacyEnemyData {
    type: string;
    spawnCount: number;
    spawnInterval: number;
    faction?: string;
}

/**
 * 关卡管理器
 * 负责管理关卡的生命周期、动画资源的预加载和释放
 */
@ccclass('LevelManager')
export class LevelManager {
    private static _instance: LevelManager;
    
    // 当前关卡数据
    private _currentLevel: LevelData | null = null;
    private _currentLevelId: number = -1;
    
    // 已加载的关卡数据
    private _levelDatabase: Record<number, LevelData> = {};
    
    // 关卡状态
    private _isLevelLoaded: boolean = false;
    private _isLevelActive: boolean = false;
    
    // 怪物生成器实例列表
    private _activeSpawners: Node[] = [];

    public static get instance(): LevelManager {
        if (!this._instance) {
            this._instance = new LevelManager();
        }
        return this._instance;
    }

    /**
     * 初始化关卡管理器
     */
    public async initialize(): Promise<void> {
        // 加载关卡数据
        this._levelDatabase = dataManager.getLevelDatabase();
        
        console.log(`LevelManager: Loaded ${Object.keys(this._levelDatabase).length} levels`);
    }

    /**
     * 开始关卡
     * @param levelId 关卡ID
     */
    public async startLevel(levelId: number): Promise<void> {
        if (this._isLevelActive) {
            console.warn(`LevelManager: Level ${this._currentLevelId} is already active`);
            return;
        }

        const levelData = this._levelDatabase[levelId];
        if (!levelData) {
            throw new Error(`LevelManager: Level ${levelId} not found`);
        }

        console.log(`LevelManager: Starting level ${levelId} - ${levelData.name}`);

        try {
            // 设置当前关卡
            this._currentLevel = levelData;
            this._currentLevelId = levelId;
            this._isLevelActive = true;

            // 设置阵营关系
            this.setupFactionRelationships(levelData);

            // 【新增】根据关卡数据初始化角色对象池和模块化工厂
            console.log(`🎮 [正常模式] 为关卡 ${levelId} 初始化角色系统...`);
            this.initializeCharacterSystemForLevel(levelData);

            // 加载关卡所需的敌人预制体
            await this.loadLevelEnemyPrefabs(levelData);

            // 预加载关卡所需的动画资源
            await this.preloadLevelAnimations(levelData);

            // 创建怪物生成器
            this.createMonsterSpawners(levelData);

            // 发送关卡开始事件
            eventManager.emit(GameEvents.LEVEL_STARTED, levelData);

            console.log(`LevelManager: Level ${levelId} started successfully`);

        } catch (error) {
            console.error(`LevelManager: Failed to start level ${levelId}`, error);
            this._currentLevel = null;
            this._currentLevelId = -1;
            this._isLevelActive = false;
            throw error;
        }
    }

    /**
     * 结束关卡
     */
    public async endLevel(): Promise<void> {
        if (!this._isLevelActive) {
            console.warn('LevelManager: No active level to end');
            return;
        }

        const levelId = this._currentLevelId;
        console.log(`LevelManager: Ending level ${levelId}`);

        try {
            // 清理怪物生成器
            this.cleanupMonsterSpawners();

            // 清理关卡动画缓存
            await this.cleanupLevelAnimations();

            // 发送关卡结束事件
            eventManager.emit(GameEvents.LEVEL_ENDED, this._currentLevel);

            // 重置状态
            this._currentLevel = null;
            this._currentLevelId = -1;
            this._isLevelActive = false;

            console.log(`LevelManager: Level ${levelId} ended successfully`);

        } catch (error) {
            console.error(`LevelManager: Failed to end level ${levelId}`, error);
            throw error;
        }
    }

    /**
     * 创建怪物生成器
     * @param levelData 关卡数据
     */
    private createMonsterSpawners(levelData: LevelData): void {
        if (!levelData.monsterSpawners || levelData.monsterSpawners.length === 0) {
            console.log(`LevelManager: 关卡 ${levelData.id} 没有配置怪物生成器。`);
            return;
        }

        const scene = director.getScene();
        if (!scene) {
            console.error('LevelManager: 无法获取当前场景，无法创建怪物生成器。');
            return;
        }
        
        console.log(`LevelManager: 为关卡 ${levelData.id} 创建 ${levelData.monsterSpawners.length} 个怪物生成器...`);

        levelData.monsterSpawners.forEach(spawnerData => {
            try {
                const spawnerNode = new Node(spawnerData.id || 'MonsterSpawner');
                const monsterSpawner = spawnerNode.addComponent(MonsterSpawner);
                
                // 初始化生成器
                monsterSpawner.initWithConfig(spawnerData as any);
                
                // 将生成器节点添加到场景中
                scene.addChild(spawnerNode);
                this._activeSpawners.push(spawnerNode);
                
                console.log(`✅ LevelManager: 怪物生成器 ${spawnerNode.name} 创建成功。`);

            } catch (error) {
                console.error(`LevelManager: 创建怪物生成器失败 (ID: ${spawnerData.id})`, error);
            }
        });
    }

    /**
     * 为关卡初始化角色系统（包括旧的对象池和新的模块化工厂）
     * @param levelData 关卡数据
     */
    private initializeCharacterSystemForLevel(levelData: LevelData): void {
        try {
            // 1. 初始化旧的对象池系统（向后兼容）
            // CharacterPoolInitializer.initializePoolsForLevel(levelData); // 已移除，现在使用UnifiedECSCharacterFactory
            
            // 2. 初始化新的模块化工厂系统
            this.initializeModularCharacterFactory(levelData);
            
            console.log(`LevelManager: 关卡 ${levelData.id} 角色系统初始化完成`);
        } catch (error) {
            console.error(`LevelManager: 关卡 ${levelData.id} 角色系统初始化失败`, error);
        }
    }

    /**
     * 初始化模块化角色工厂
     * @param levelData 关卡数据
     */
    private initializeModularCharacterFactory(levelData: LevelData): void {
        // const factory = ModularCharacterFactory.getInstance(); // 已移除，现在使用UnifiedECSCharacterFactory
        
        // 从关卡数据提取敌人类型
        const enemyTypes = this.extractEnemyTypesFromLevel(levelData);
        
        console.log(`LevelManager: 为模块化工厂注册敌人类型:`, enemyTypes);
        
        // 预注册所有敌人类型到工厂（如果需要预制体的话）
        enemyTypes.forEach(enemyType => {
            // 这里可以添加预制体注册逻辑
            // factory.registerCharacterPrefab(enemyType, prefab);
            console.log(`LevelManager: 模块化工厂已准备敌人类型: ${enemyType}`);
        });
    }

    /**
     * 从关卡数据中提取敌人类型
     * @param levelData 关卡数据
     * @returns 敌人类型数组
     */
    private extractEnemyTypesFromLevel(levelData: LevelData): string[] {
        const enemyTypes = new Set<string>();

        // 从 monsterSpawners 中提取敌人类型（新格式）
        if (levelData.monsterSpawners) {
            levelData.monsterSpawners.forEach(spawner => {
                spawner.enemies?.forEach(enemy => {
                    if (enemy.type) {
                        enemyTypes.add(enemy.type);
                    }
                });
            });
        }

        // 从 enemies 中提取敌人类型（旧格式，兼容性）
        if (levelData.enemies) {
            levelData.enemies.forEach(enemy => {
                if (enemy.type) {
                    enemyTypes.add(enemy.type);
                }
            });
        }

        return Array.from(enemyTypes);
    }

    /**
     * 清理所有活动的怪物生成器
     */
    private cleanupMonsterSpawners(): void {
        console.log(`LevelManager: 清理 ${this._activeSpawners.length} 个怪物生成器...`);
        this._activeSpawners.forEach(spawnerNode => {
            if (spawnerNode && spawnerNode.isValid) {
                // 在销毁节点前，可以调用生成器内部的清理方法（如果需要）
                const spawnerComponent = spawnerNode.getComponent(MonsterSpawner);
                if (spawnerComponent) {
                    spawnerComponent.clearAllMonsters();
                }
                spawnerNode.destroy();
            }
        });
        this._activeSpawners = [];
        console.log('LevelManager: 所有怪物生成器已清理。');
    }

    /**
     * 预加载关卡动画资源
     * @param levelData 关卡数据
     */
    private async preloadLevelAnimations(levelData: LevelData): Promise<void> {
        console.log('LevelManager: Preloading level animations...');
        
        // 收集关卡中所有的敌人类型
        const enemyTypes = this.extractEnemyTypesFromLevel(levelData);
        
        if (enemyTypes.length === 0) {
            console.log('LevelManager: No enemies found in level, skipping animation preload');
            return;
        }

        console.log(`LevelManager: Found enemy types: ${enemyTypes.join(', ')}`);

        // 为关卡创建动画缓存
        await animationManager.createLevelAnimationCache(levelData.id, enemyTypes);
        
        console.log('LevelManager: Level animations preloaded successfully');
    }

    /**
     * 加载关卡所需的敌人预制体
     * @param levelData 关卡数据
     */
    private async loadLevelEnemyPrefabs(levelData: LevelData): Promise<void> {
        console.log(`LevelManager: 开始加载关卡 ${levelData.id} 的敌人预制体...`);
        
        try {
            // 从DataManager获取该关卡需要的敌人预制体配置
            const enemyConfigs = dataManager.getEnemyPrefabConfigsForLevel(levelData.id);
            
            if (enemyConfigs.length === 0) {
                console.log(`LevelManager: 关卡 ${levelData.id} 不需要额外的敌人预制体`);
                return;
            }

            // 批量初始化敌人预制体
            const batchConfig = {
                category: `level_${levelData.id}_enemies`,
                prefabs: enemyConfigs,
                loadConcurrency: 2,  // 关卡加载时并发数较小，避免阻塞
                retryCount: 1,       // 关卡加载重试次数较少
                onProgress: (loaded: number, total: number) => {
                    console.log(`LevelManager: 关卡 ${levelData.id} 敌人预制体加载进度: ${loaded}/${total}`);
                },
                onItemComplete: (result: any) => {
                    if (result.success) {
                        console.log(`LevelManager: 敌人预制体 ${result.name} 加载成功，策略: ${result.strategy}`);
                    } else {
                        console.warn(`LevelManager: 敌人预制体 ${result.name} 加载失败: ${result.error}`);
                    }
                }
            };

            const results = await resourceManager.initializePrefabBatch(batchConfig);
            
            // 统计加载结果
            const successCount = results.filter(r => r.success).length;
            const failCount = results.length - successCount;
            
            console.log(`LevelManager: 关卡 ${levelData.id} 敌人预制体加载完成`);
            console.log(`  - 成功: ${successCount} 个`);
            console.log(`  - 失败: ${failCount} 个`);
            
            // 即使有失败也不阻塞关卡启动，因为可能有备用方案
            if (failCount > 0) {
                console.warn(`LevelManager: 部分敌人预制体加载失败，将尝试使用备用方案`);
            }

        } catch (error) {
            console.error(`LevelManager: 关卡 ${levelData.id} 敌人预制体加载异常`, error);
            // 不抛出错误，让关卡继续启动
        }
    }



    /**
     * 清理关卡动画缓存
     */
    private async cleanupLevelAnimations(): Promise<void> {
        if (this._currentLevelId === -1) {
            return;
        }

        console.log(`LevelManager: Cleaning up animations for level ${this._currentLevelId}`);
        
        // 清理关卡特定的动画缓存
        animationManager.clearLevelAnimationCache(this._currentLevelId);
        
        console.log('LevelManager: Level animations cleaned up');
    }

    /**
     * 获取当前关卡数据
     */
    public getCurrentLevel(): LevelData | null {
        return this._currentLevel;
    }

    /**
     * 获取当前关卡ID
     */
    public getCurrentLevelId(): number {
        return this._currentLevelId;
    }

    /**
     * 检查关卡是否活跃
     */
    public isLevelActive(): boolean {
        return this._isLevelActive;
    }

    /**
     * 设置关卡的阵营关系
     * @param levelData 关卡数据
     */
    private setupFactionRelationships(levelData: LevelData): void {
        if (levelData.factionRelationships) {
            console.log(`LevelManager: 设置关卡 ${levelData.id} 的阵营关系配置`);
            factionManager.setFactionRelationships(levelData.factionRelationships);
            factionManager.printDebugInfo();
        } else {
            console.log(`LevelManager: 关卡 ${levelData.id} 没有阵营关系配置，使用默认配置`);
            factionManager.resetToDefaultRelationships();
        }
    }

    /**
     * 获取关卡数据
     * @param levelId 关卡ID
     */
    public getLevelData(levelId: number): LevelData | null {
        return this._levelDatabase[levelId] || null;
    }

    /**
     * 获取所有关卡数据
     */
    public getAllLevels(): Record<number, LevelData> {
        return { ...this._levelDatabase };
    }

    /**
     * 检查关卡是否已加载
     */
    public isLevelLoaded(): boolean {
        return this._isLevelLoaded;
    }
}

export const levelManager = LevelManager.instance; 