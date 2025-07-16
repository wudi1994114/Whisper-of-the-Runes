// assets/scripts/core/DataManager.ts

import { _decorator, JsonAsset } from 'cc';
import { EnemyData, EnemyCategory, AiBehavior } from '../configs/EnemyConfig';
import { handleError, ErrorType, ErrorSeverity, safeAsync } from './ErrorHandler';
import { resourceManager } from './ResourceManager';
import { LevelData } from './LevelManager';

const { ccclass } = _decorator;

@ccclass('DataManager')
export class DataManager {
    private static _instance: DataManager;
    private _enemyDatabase: Record<string, EnemyData> = {};
    private _isLoaded: boolean = false;
    
    // 其他数据存储（技能、关卡等）
    public skillData: any = null;
    private _levelDatabase: Record<number, LevelData> = {};

    public static get instance(): DataManager {
        if (!this._instance) {
            this._instance = new DataManager();
        }
        return this._instance;
    }

    /**
     * 初始化数据管理器
     * 从JSON文件加载敌人数据
     */
    public async loadAllData(): Promise<void> {
        if (this._isLoaded) {
            console.log("DataManager: 敌人数据已加载");
            return;
        }

        const result = await safeAsync(
            async () => {
                // 加载敌人数据
                await this.loadEnemyData();
                
                // 如果还有其他需要动态加载的数据，可以在这里添加
                // await this.loadSkillData();
                await this.loadLevelData();
                
                this._isLoaded = true;
                console.log(`DataManager: 成功加载 ${Object.keys(this._enemyDatabase).length} 个敌人配置`);
            },
            ErrorType.DATA_LOADING,
            "DataManager: 加载游戏数据失败"
        );

        if (!result) {
            handleError(
                ErrorType.DATA_LOADING,
                ErrorSeverity.CRITICAL,
                "DataManager: 无法加载游戏数据，游戏可能无法正常运行"
            );
            throw new Error("Failed to load game data");
        }
    }

    /**
     * 从JSON文件加载敌人数据
     */
    private async loadEnemyData(): Promise<void> {
        const jsonAsset = await resourceManager.loadResource('data/enemies', JsonAsset);
        
        if (!jsonAsset) {
            throw new Error("Failed to load enemy data");
        }

        try {
            const jsonData = jsonAsset.json;
            this._enemyDatabase = jsonData as Record<string, EnemyData>;
            
            // 验证数据并转换枚举值
            for (const key in this._enemyDatabase) {
                const enemy = this._enemyDatabase[key];
                
                // 确保ID匹配
                if (enemy.id !== key) {
                    console.warn(`DataManager: 敌人 ${key} 的ID不匹配，已自动修正`);
                    enemy.id = key;
                }
                
                // 验证必需字段
                if (!enemy.name || !enemy.plistUrl || !enemy.assetNamePrefix) {
                    const errorMsg = `DataManager: 敌人 ${key} 缺少必需字段`;
                    console.error(errorMsg);
                    throw new Error(`Invalid enemy data for ${key}`);
                }
            }
            
            console.log("DataManager: 敌人数据加载成功");
        } catch (parseError) {
            console.error("DataManager: 解析敌人数据失败", parseError);
            throw parseError;
        }
    }

    /**
     * 检查数据是否已加载
     */
    public isDataLoaded(): boolean {
        return this._isLoaded;
    }
    
    /**
     * 根据敌人ID获取完整的敌人配置数据
     * @param enemyId 敌人的唯一标识符
     * @returns 敌人的配置数据对象
     */
    public getEnemyData(enemyId: string): EnemyData | null {
        if (!this._isLoaded) {
            console.error("DataManager: 数据尚未加载，请先调用 loadAllData()");
            return null;
        }

        const enemyData = this._enemyDatabase[enemyId];
        if (!enemyData) {
            console.error(`DataManager: 未找到敌人数据: ${enemyId}`);
            return null;
        }
        return enemyData;
    }

    /**
     * 获取所有敌人数据
     * @returns 敌人数据数组
     */
    public getAllEnemies(): EnemyData[] {
        if (!this._isLoaded) {
            console.error("DataManager: 数据尚未加载，请先调用 loadAllData()");
            return [];
        }
        return Object.keys(this._enemyDatabase).map(key => this._enemyDatabase[key]);
    }

    /**
     * 根据类别获取敌人数据
     * @param category 敌人类别
     * @returns 敌人数据数组
     */
    public getEnemiesByCategory(category: EnemyCategory): EnemyData[] {
        if (!this._isLoaded) {
            console.error("DataManager: 数据尚未加载，请先调用 loadAllData()");
            return [];
        }
        
        const enemies: EnemyData[] = [];
        for (const key in this._enemyDatabase) {
            if (this._enemyDatabase[key].category === category) {
                enemies.push(this._enemyDatabase[key]);
            }
        }
        return enemies;
    }

    /**
     * 根据AI行为获取敌人数据
     * @param ai AI行为类型
     * @returns 敌人数据数组
     */
    public getEnemiesByAI(ai: AiBehavior): EnemyData[] {
        if (!this._isLoaded) {
            console.error("DataManager: 数据尚未加载，请先调用 loadAllData()");
            return [];
        }
        
        const enemies: EnemyData[] = [];
        for (const key in this._enemyDatabase) {
            if (this._enemyDatabase[key].ai === ai) {
                enemies.push(this._enemyDatabase[key]);
            }
        }
        return enemies;
    }

    /**
     * 获取随机敌人数据
     * @param category 可选的敌人类别过滤
     * @returns 随机敌人数据
     */
    public getRandomEnemy(category?: EnemyCategory): EnemyData | null {
        if (!this._isLoaded) {
            console.error("DataManager: 数据尚未加载，请先调用 loadAllData()");
            return null;
        }
        
        const enemies = category ? this.getEnemiesByCategory(category) : Object.keys(this._enemyDatabase).map(key => this._enemyDatabase[key]);
        if (enemies.length === 0) {
            console.warn("DataManager: 没有找到符合条件的敌人");
            return null;
        }
        
        const randomIndex = Math.floor(Math.random() * enemies.length);
        return enemies[randomIndex];
    }

    /**
     * 获取所有敌人ID列表
     * @returns 敌人ID数组
     */
    public getAllEnemyIds(): string[] {
        if (!this._isLoaded) {
            console.error("DataManager: 数据尚未加载，请先调用 loadAllData()");
            return [];
        }
        return Object.keys(this._enemyDatabase);
    }

    /**
     * 根据名称搜索敌人
     * @param name 敌人名称（支持部分匹配）
     * @returns 匹配的敌人数据数组
     */
    public searchEnemiesByName(name: string): EnemyData[] {
        if (!this._isLoaded) {
            console.error("DataManager: 数据尚未加载，请先调用 loadAllData()");
            return [];
        }
        
        const allEnemies = this.getAllEnemies();
        return allEnemies.filter(enemy => 
            enemy.name.includes(name) || enemy.id.includes(name)
        );
    }

    /**
     * 获取敌人统计信息
     * @returns 敌人统计信息
     */
    public getEnemyStatistics(): {
        total: number;
        byCategory: Record<string, number>;
        byAI: Record<string, number>;
    } {
        if (!this._isLoaded) {
            console.error("DataManager: 数据尚未加载，请先调用 loadAllData()");
            return { total: 0, byCategory: {}, byAI: {} };
        }
        
        const allEnemies = this.getAllEnemies();
        const byCategory: Record<string, number> = {};
        const byAI: Record<string, number> = {};

        allEnemies.forEach(enemy => {
            // 统计类别
            const categoryName = EnemyCategory[enemy.category];
            byCategory[categoryName] = (byCategory[categoryName] || 0) + 1;

            // 统计AI行为
            const aiName = AiBehavior[enemy.ai];
            byAI[aiName] = (byAI[aiName] || 0) + 1;
        });

        return {
            total: allEnemies.length,
            byCategory,
            byAI
        };
    }

    // 保留原有的技能和其他数据访问方法（如果未来需要）
    public getSkillDataById(id: number) {
        return this.skillData?.skills?.find((skill: any) => skill.id === id);
    }

    // 未来可能需要的数据加载方法
    private async loadSkillData() {
        // 实现技能数据加载逻辑
        console.log("DataManager: 加载技能数据...");
    }

    public async loadLevelData(): Promise<void> {
        console.log("DataManager: 加载关卡数据...");
        
        const jsonAsset = await resourceManager.loadResource('data/levels', JsonAsset);
        
        if (!jsonAsset) {
            throw new Error("Failed to load level data");
        }

        try {
            const jsonData = jsonAsset.json;
            if (jsonData && jsonData.levels && Array.isArray(jsonData.levels)) {
                // 将数组转换为以ID为键的对象
                const levelDatabase: Record<number, LevelData> = {};
                jsonData.levels.forEach((level: LevelData) => {
                    levelDatabase[level.id] = level;
                });
                
                this._levelDatabase = levelDatabase;
                console.log(`DataManager: 成功加载 ${Object.keys(this._levelDatabase).length} 个关卡配置`);
            } else {
                throw new Error("Invalid level data format");
            }
        } catch (parseError) {
            console.error("DataManager: 解析关卡数据失败", parseError);
            throw parseError;
        }
    }

    /**
     * 获取关卡数据库
     */
    public getLevelDatabase(): Record<number, LevelData> {
        return { ...this._levelDatabase };
    }

    /**
     * 根据ID获取关卡数据
     */
    public getLevelData(levelId: number): LevelData | null {
        return this._levelDatabase[levelId] || null;
    }
}

export const dataManager = DataManager.instance; 