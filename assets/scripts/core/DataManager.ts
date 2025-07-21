// assets/scripts/core/DataManager.ts

import { _decorator, JsonAsset } from 'cc';
import { EnemyData, EnemyCategory, AiBehavior, EnemySkill } from '../configs/EnemyConfig';
import { handleError, ErrorType, ErrorSeverity } from './ErrorHandler';
import { LevelData } from './LevelManager';
import { resourceManager, PrefabConfig } from './ResourceManager';
import { resourceManager as rm } from './ResourceManager';
import { poolManager } from './PoolManager';

const { ccclass } = _decorator;

@ccclass('DataManager')
export class DataManager {
    private static _instance: DataManager;
    private _enemyDatabase: Record<string, EnemyData> = {};
    private _isLoaded: boolean = false;
    
    // 其他数据存储（技能、关卡等）
    public skillData: any = null;
    private _projectileDatabase: Record<string, any> = {};
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
            console.log("DataManager: 数据已加载");
            return;
        }

        try {
            console.log("DataManager: 开始加载游戏数据...");
            
            // 并行加载所有数据文件
            const [enemyJsonAsset, skillJsonAsset, levelJsonAsset] = await Promise.all([
                resourceManager.loadResource('data/enemies', JsonAsset),
                resourceManager.loadResource('data/skills', JsonAsset),
                resourceManager.loadResource('data/levels', JsonAsset)
            ]);

            // 处理敌人数据
            if (enemyJsonAsset) {
                await this.processEnemyData(enemyJsonAsset);
            } else {
                throw new Error("Failed to load enemy data");
            }

            // 处理技能数据
            if (skillJsonAsset) {
                await this.processSkillData(skillJsonAsset);
            } else {
                throw new Error("Failed to load skills data");
            }

            // 处理关卡数据
            if (levelJsonAsset) {
                await this.processLevelData(levelJsonAsset);
            } else {
                throw new Error("Failed to load level data");
            }
            
            this._isLoaded = true;
            console.log(`✅ DataManager: 数据加载完成，_isLoaded = true`);
            console.log(`- 敌人: ${Object.keys(this._enemyDatabase).length} 个`);
            console.log(`- 技能: ${this.skillData?.skills?.length || 0} 个`);
            console.log(`- 投射物: ${Object.keys(this._projectileDatabase).length} 个`);
            console.log(`- 关卡: ${Object.keys(this._levelDatabase).length} 个`);
            console.log(`✅ DataManager: isDataLoaded() = ${this.isDataLoaded()}`);
        } catch (error) {
            handleError(
                ErrorType.DATA_LOADING,
                ErrorSeverity.CRITICAL,
                "DataManager: 无法加载游戏数据，游戏可能无法正常运行",
                { error: error },
                error as Error
            );
            throw new Error("Failed to load game data");
        }
    }

    /**
     * 处理敌人数据
     */
    private async processEnemyData(jsonAsset: JsonAsset): Promise<void> {
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
            
            console.log("DataManager: 敌人数据处理成功");
        } catch (parseError) {
            console.error("DataManager: 解析敌人数据失败", parseError);
            throw parseError;
        }
    }

    /**
     * 处理技能和投射物数据
     */
    private async processSkillData(jsonAsset: JsonAsset): Promise<void> {
        try {
            console.log("DataManager: 开始处理技能数据...");
            const jsonData = jsonAsset.json;
            if (jsonData) {
                // 存储技能数据
                this.skillData = jsonData;
                console.log("DataManager: 技能数据已存储到 this.skillData");
                
                // 处理投射物数据
                if (jsonData.projectiles) {
                    this._projectileDatabase = jsonData.projectiles;
                    const projectileCount = Object.keys(jsonData.projectiles).length;
                    console.log(`DataManager: 投射物数据处理成功，加载了 ${projectileCount} 个投射物`);
                } else {
                    console.warn("DataManager: 技能文件中没有找到 projectiles 数据");
                }
                
                // 处理技能数据
                if (jsonData.skills && Array.isArray(jsonData.skills)) {
                    const skillCount = jsonData.skills.length;
                    console.log(`DataManager: 技能数据处理成功，加载了 ${skillCount} 个技能`);
                } else {
                    console.log("DataManager: 技能文件中没有找到 skills 数组（这是正常的，当前只有投射物数据）");
                }
                
                console.log("DataManager: 技能数据处理完成");
            } else {
                throw new Error("Invalid skills data format");
            }
        } catch (parseError) {
            console.error("DataManager: 解析技能数据失败", parseError);
            throw parseError;
        }
    }

    /**
     * 处理关卡数据
     */
    private async processLevelData(jsonAsset: JsonAsset): Promise<void> {
        try {
            const jsonData = jsonAsset.json;
            if (jsonData && jsonData.levels && Array.isArray(jsonData.levels)) {
                // 将数组转换为以ID为键的对象
                const levelDatabase: Record<number, LevelData> = {};
                jsonData.levels.forEach((level: LevelData) => {
                    levelDatabase[level.id] = level;
                });
                
                this._levelDatabase = levelDatabase;
                console.log(`DataManager: 关卡数据处理成功`);
            } else {
                throw new Error("Invalid level data format");
            }
        } catch (parseError) {
            console.error("DataManager: 解析关卡数据失败", parseError);
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

    // 技能和投射物数据访问方法
    public getSkillDataById(id: number) {
        return this.skillData?.skills?.find((skill: any) => skill.id === id);
    }

    /**
     * 根据投射物ID获取投射物配置
     * @param projectileId 投射物ID
     * @returns 投射物配置数据
     */
    public getProjectileData(projectileId: string): any | null {
        if (!this._isLoaded) {
            console.error("DataManager: 数据尚未加载，请先调用 loadAllData()");
            return null;
        }

        const projectileData = this._projectileDatabase[projectileId];
        if (!projectileData) {
            console.error(`DataManager: 未找到投射物数据: ${projectileId}`);
            return null;
        }
        return projectileData;
    }

    /**
     * 获取所有投射物数据
     * @returns 投射物数据对象
     */
    public getAllProjectiles(): Record<string, any> {
        if (!this._isLoaded) {
            console.error("DataManager: 数据尚未加载，请先调用 loadAllData()");
            return {};
        }
        return this._projectileDatabase;
    }

    /**
     * 根据技能ID获取关联的投射物数据
     * @param skillId 技能ID
     * @returns 投射物配置数据
     */
    public getProjectileBySkillId(skillId: number): any | null {
        const skill = this.getSkillDataById(skillId);
        if (skill && skill.projectileId) {
            return this.getProjectileData(skill.projectileId);
        }
        return null;
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

    /**
     * 获取所有投射物的预制体配置
     * @returns 投射物预制体配置数组
     */
    public getAllProjectilePrefabConfigs(): PrefabConfig[] {
        const configs: PrefabConfig[] = [];
        
        if (!this._projectileDatabase) {
            console.warn('DataManager: 投射物数据库未加载');
            return configs;
        }

        // 手动迭代对象，兼容旧版TypeScript
        for (const key in this._projectileDatabase) {
            if (this._projectileDatabase.hasOwnProperty(key)) {
                const projectileData = this._projectileDatabase[key];
                if (projectileData.resources?.prefab) {
                    const config: PrefabConfig = {
                        name: projectileData.id,
                        resourcePath: projectileData.resources.prefab,
                        loadStrategy: 'hybrid',  // 支持备用方案
                        poolConfig: {
                            poolName: projectileData.poolConfig?.poolName || projectileData.id,
                            maxSize: projectileData.poolConfig?.maxSize || 30,
                            preloadCount: projectileData.poolConfig?.preloadCount || 5
                        },
                        priority: 100  // 投射物高优先级，启动时加载
                    };
                    configs.push(config);
                    
                    console.log(`DataManager: 提取投射物配置 ${projectileData.id}`);
                } else {
                    console.warn(`DataManager: 投射物 ${projectileData.id} 缺少预制体路径`);
                }
            }
        }

        console.log(`DataManager: 共提取 ${configs.length} 个投射物预制体配置`);
        return configs;
    }

    /**
     * 根据关卡ID获取该关卡需要的敌人预制体配置
     * @param levelId 关卡ID
     * @returns 敌人预制体配置数组
     */
    public getEnemyPrefabConfigsForLevel(levelId: number): PrefabConfig[] {
        const configs: PrefabConfig[] = [];
        
        // 获取关卡数据
        const levelData = this._levelDatabase[levelId];
        if (!levelData) {
            console.error(`DataManager: 未找到关卡 ${levelId} 的数据`);
            return configs;
        }

        // 收集关卡中所有的敌人类型
        const enemyTypes = new Set<string>();
        
        // 从新格式的monsterSpawners中提取
        if (levelData.monsterSpawners) {
            levelData.monsterSpawners.forEach(spawner => {
                spawner.enemies?.forEach(enemy => {
                    enemyTypes.add(enemy.type);
                });
            });
        }
        
        // 从旧格式的enemies中提取（兼容性）
        if (levelData.enemies) {
            levelData.enemies.forEach(enemy => {
                enemyTypes.add(enemy.type);
            });
        }

        console.log(`DataManager: 关卡 ${levelId} 需要敌人类型:`, Array.from(enemyTypes));

        // 【关键修复】检查所有敌人类型是否都已在对象池中
        let missingCount = 0;
        let availableCount = 0;
        
        enemyTypes.forEach(enemyType => {
            const enemyData = this._enemyDatabase[enemyType];
            if (enemyData) {
                // 检查对象池中是否已有该敌人类型
                const poolStats = poolManager.getStats(enemyType) as any;
                if (poolStats && poolStats.size >= 0) {
                    console.log(`✅ DataManager: 敌人 ${enemyType} 已在对象池中可用`);
                    availableCount++;
                } else {
                    console.error(`❌ DataManager: 敌人 ${enemyType} 未在对象池中！这应该在GameManager启动时就注册好！`);
                    missingCount++;
                }
            } else {
                console.error(`DataManager: 未找到敌人类型 ${enemyType} 的数据`);
                missingCount++;
            }
        });

        // 统计检查结果
        console.log(`DataManager: 关卡 ${levelId} 敌人类型检查结果:`);
        console.log(`  - 总共需要: ${Array.from(enemyTypes).length} 个敌人类型`);
        console.log(`  - 对象池可用: ${availableCount} 个`);
        console.log(`  - 缺失/异常: ${missingCount} 个`);
        
        if (missingCount > 0) {
            console.error(`❌ DataManager: 关卡 ${levelId} 有 ${missingCount} 个敌人类型未正确配置！`);
            console.error(`❌ 这表明GameManager在启动时没有正确注册所有需要的敌人类型到对象池`);
        } else {
            console.log(`✅ DataManager: 关卡 ${levelId} 所有敌人类型都已正确配置在对象池中`);
        }
        
        // 【核心修复】正常模式下不返回任何配置，因为所有敌人应该已经在GameManager中注册
        // 返回空数组表示不需要动态加载
        return [];
    }

    /**
     * 获取所有敌人类型的预制体配置（用于预加载所有敌人）
     * @returns 所有敌人预制体配置数组
     */
    public getAllEnemyPrefabConfigs(): PrefabConfig[] {
        const configs: PrefabConfig[] = [];
        
        // 手动迭代对象，兼容旧版TypeScript
        for (const key in this._enemyDatabase) {
            if (this._enemyDatabase.hasOwnProperty(key)) {
                const enemyData = this._enemyDatabase[key];
                const prefabPath = this.getEnemyPrefabPath(enemyData);
                
                const config: PrefabConfig = {
                    name: enemyData.id,
                    resourcePath: prefabPath,
                    loadStrategy: 'hybrid',
                    poolConfig: {
                        poolName: enemyData.id,
                        maxSize: this.getEnemyPoolSize(enemyData),
                        preloadCount: this.getEnemyPreloadCount(enemyData)
                    },
                    priority: this.getEnemyPriority(enemyData)
                };
                configs.push(config);
            }
        }

        console.log(`DataManager: 共提取 ${configs.length} 个敌人预制体配置`);
        return configs;
    }

    /**
     * 根据敌人数据推断预制体路径
     * @param enemyData 敌人数据
     * @returns 预制体路径
     */
    private getEnemyPrefabPath(enemyData: EnemyData): string {
        // 敌人ID到预制体文件名的映射
        // 每种敌人都有普通、精英、boss三种变体
        // 除了lich系列使用lich.prefab外，其他都使用ent.prefab
        const enemyIdToPrefabMap: { [key: string]: string } = {
            // 小树精系列 - 使用ent.prefab
            'ent_normal': 'ent',
            'ent_elite': 'ent',
            'ent_boss': 'ent',
            
            // 骷髅系列 - 使用ent.prefab
            'skeleton_normal': 'ent',
            'skeleton_elite': 'ent', 
            'skeleton_boss': 'ent',
            'skeleton': 'ent', // 兼容旧配置
            
            // 兽人系列 - 使用ent.prefab
            'orc_normal': 'ent',
            'orc_elite': 'ent',
            'orc_boss': 'ent',
            'orc': 'ent', // 兼容旧配置
            
            // 哥布林系列 - 使用ent.prefab
            'goblin_normal': 'ent',
            'goblin_elite': 'ent',
            'goblin_boss': 'ent',
            'goblin': 'ent', // 兼容旧配置
            
            // 史莱姆系列 - 使用ent.prefab
            'slime_normal': 'ent',
            'slime_elite': 'ent',
            'slime_boss': 'ent',
            'slime1': 'ent', // 兼容旧配置
            'slime2': 'ent', // 兼容旧配置
            'slime3': 'ent', // 兼容旧配置
            
            // 石像怪系列 - 使用ent.prefab
            'golem_normal': 'ent',
            'golem_elite': 'ent',
            'golem_boss': 'ent',
            'golem': 'ent', // 兼容旧配置
            
            // 巫妖系列 - 现在也使用ent.prefab（UniversalCharacterDemo会动态配置）
            'lich_normal': 'ent',
            'lich_elite': 'ent',
            'lich_boss': 'ent'
        };
        
        // 从映射表获取预制体文件名
        const prefabFileName = enemyIdToPrefabMap[enemyData.id];
        
        if (prefabFileName) {
            return `enemies/${prefabFileName}`;
        }
        
        // 如果映射表中没有，则从plistUrl推断
        if (enemyData.plistUrl) {
            const baseName = enemyData.plistUrl.split('/').pop();
            console.log(`DataManager: 从plistUrl推断预制体路径，敌人 ${enemyData.id} -> ${baseName}`);
            return `enemies/${baseName}`;
        }
        
        // 最后的备用方案：直接使用敌人ID
        console.warn(`DataManager: 未找到敌人 ${enemyData.id} 的预制体映射，使用ID作为文件名`);
        return `enemies/${enemyData.id}`;
    }

    /**
     * 根据敌人类型确定对象池大小
     * @param enemyData 敌人数据
     * @returns 对象池最大大小
     */
    private getEnemyPoolSize(enemyData: EnemyData): number {
        switch (enemyData.category) {
            case EnemyCategory.Normal:
                return 20;  // 普通敌人可能会大量生成
            case EnemyCategory.Elite:
                return 10;  // 精英敌人数量中等
            case EnemyCategory.Boss:
                return 3;   // Boss数量很少
            default:
                return 15;
        }
    }

    /**
     * 根据敌人类型确定预加载数量
     * @param enemyData 敌人数据
     * @returns 预加载数量
     */
    private getEnemyPreloadCount(enemyData: EnemyData): number {
        switch (enemyData.category) {
            case EnemyCategory.Normal:
                return 5;   // 普通敌人预加载较多
            case EnemyCategory.Elite:
                return 2;   // 精英敌人预加载少量
            case EnemyCategory.Boss:
                return 1;   // Boss预加载1个即可
            default:
                return 3;
        }
    }

    /**
     * 根据敌人类型确定加载优先级
     * @param enemyData 敌人数据
     * @returns 优先级数值（越大越优先）
     */
    private getEnemyPriority(enemyData: EnemyData): number {
        switch (enemyData.category) {
            case EnemyCategory.Normal:
                return 80;  // 普通敌人高优先级
            case EnemyCategory.Elite:
                return 60;  // 精英敌人中优先级
            case EnemyCategory.Boss:
                return 40;  // Boss优先级较低（数量少，可以延迟加载）
            default:
                return 50;
        }
    }

    /**
     * 根据技能ID数组获取技能预制体配置
     * @param skillIds 技能ID数组
     * @returns 技能预制体配置数组
     */
    public getSkillPrefabConfigs(skillIds: string[]): PrefabConfig[] {
        const configs: PrefabConfig[] = [];
        
        if (!this._projectileDatabase) {
            console.warn('DataManager: 投射物数据库未加载，无法获取技能预制体配置');
            return configs;
        }

        skillIds.forEach(skillId => {
            const projectileData = this._projectileDatabase[skillId];
            if (projectileData && projectileData.resources?.prefab) {
                const config: PrefabConfig = {
                    name: projectileData.id,
                    resourcePath: projectileData.resources.prefab,
                    loadStrategy: 'hybrid',  // 支持备用方案
                    poolConfig: {
                        poolName: projectileData.poolConfig?.poolName || projectileData.id,
                        maxSize: projectileData.poolConfig?.maxSize || 30,
                        preloadCount: projectileData.poolConfig?.preloadCount || 5
                    },
                    priority: 100  // 技能预制体高优先级
                };
                configs.push(config);
                
                console.log(`DataManager: 提取技能配置 ${skillId} -> ${projectileData.resources.prefab}`);
            } else {
                console.warn(`DataManager: 技能 ${skillId} 未找到预制体路径`);
            }
        });

        return configs;
    }

    /**
     * 获取敌人相关的技能预制体配置
     * @param enemyData 敌人数据
     * @returns 技能预制体配置数组
     */
    public getEnemySkillPrefabConfigs(enemyData: EnemyData): PrefabConfig[] {
        const skillIds: string[] = [];
        
        // 从敌人的skills字段提取技能ID
        if (enemyData.skills && Array.isArray(enemyData.skills)) {
            enemyData.skills.forEach(skill => {
                if (skill.id) {
                    skillIds.push(skill.id);
                }
            });
        }

        // 从projectileId字段提取（兼容旧配置）
        if (enemyData.projectileId) {
            skillIds.push(enemyData.projectileId);
        }

        if (skillIds.length === 0) {
            console.log(`DataManager: 敌人 ${enemyData.id} 没有配置技能`);
            return [];
        }

        console.log(`DataManager: 敌人 ${enemyData.id} 需要技能: ${skillIds.join(', ')}`);
        return this.getSkillPrefabConfigs(skillIds);
    }

    /**
     * 统计并去重预制体配置列表
     * @param configs 预制体配置数组
     * @returns 去重后的预制体配置数组
     */
    public deduplicatePrefabConfigs(configs: PrefabConfig[]): PrefabConfig[] {
        const uniqueConfigs = new Map<string, PrefabConfig>();
        const duplicateStats = new Map<string, number>();

        configs.forEach(config => {
            const key = config.resourcePath || config.name;
            if (uniqueConfigs.has(key)) {
                // 统计重复数量
                duplicateStats.set(key, (duplicateStats.get(key) || 1) + 1);
                console.log(`DataManager: 检测到重复预制体配置 ${key} (第${duplicateStats.get(key)}次)`);
            } else {
                uniqueConfigs.set(key, config);
            }
        });

        // 打印去重统计
        if (duplicateStats.size > 0) {
            console.log(`DataManager: 预制体去重统计:`);
            duplicateStats.forEach((count, key) => {
                console.log(`  - ${key}: 重复${count - 1}次，已去重`);
            });
        }

        const result = Array.from(uniqueConfigs.values());
        console.log(`DataManager: 预制体配置去重完成: ${configs.length} -> ${result.length}`);
        return result;
    }
}

export const dataManager = DataManager.instance; 