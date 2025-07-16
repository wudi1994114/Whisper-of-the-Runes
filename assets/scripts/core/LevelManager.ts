// assets/scripts/core/LevelManager.ts

import { _decorator, Component } from 'cc';
import { dataManager } from './DataManager';
import { animationManager } from '../animation/AnimationManager';
import { eventManager } from './EventManager';
import { GameEvents } from './GameEvents';

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
    }[];
}

/**
 * 遗留敌人数据接口（兼容旧格式）
 */
export interface LegacyEnemyData {
    type: string;
    spawnCount: number;
    spawnInterval: number;
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

            // 预加载关卡所需的动画资源
            await this.preloadLevelAnimations(levelData);

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
     * 从关卡数据中提取敌人类型
     * @param levelData 关卡数据
     * @returns 敌人类型数组
     */
    private extractEnemyTypesFromLevel(levelData: LevelData): string[] {
        const enemyTypes = new Set<string>();

        // 从 monsterSpawners 中提取敌人类型（新格式）
        if (levelData.monsterSpawners) {
            levelData.monsterSpawners.forEach(spawner => {
                spawner.enemies.forEach(enemy => {
                    enemyTypes.add(enemy.type);
                });
            });
        }

        // 从 enemies 中提取敌人类型（旧格式，兼容性）
        if (levelData.enemies) {
            levelData.enemies.forEach(enemy => {
                enemyTypes.add(enemy.type);
            });
        }

        return Array.from(enemyTypes);
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