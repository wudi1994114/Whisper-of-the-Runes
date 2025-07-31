import { Vec3 } from 'cc';
import { poolManager } from '../managers/PoolManager';
import { ControlMode } from '../state-machine/CharacterEnums';

// 前向声明，避免循环依赖
export interface IBaseCharacter {
    node: any;
    characterId: string;
    controlMode: ControlMode;
    aiFaction: string;
    aiBehaviorType: string;
    setEnemyType(enemyType: string): void;
    setPoolingProperties(isFromPool: boolean, poolName: string, characterId: string): void;
    onReuseFromPool(): void;
    onRecycleToPool(): void;
    getIsFromPool(): boolean;
    getPoolName(): string;
    getCharacterType?(): string;
    returnToPool(): void;
}

/**
 * 角色对象池配置
 */
export interface CharacterPoolConfig {
    poolName: string;
    characterClass: string;
    enemyConfigId: string;
    initialSize?: number;
    maxSize?: number;
}

/**
 * 角色池化工厂管理器
 * 统一管理所有BaseCharacterDemo子类的对象池创建
 */
export class CharacterPoolFactory {
    private static instance: CharacterPoolFactory | null = null;
    private poolConfigs: Map<string, CharacterPoolConfig> = new Map();
    private activeCharacters: Set<IBaseCharacter> = new Set();
    
    private constructor() {}
    
    public static getInstance(): CharacterPoolFactory {
        if (!CharacterPoolFactory.instance) {
            CharacterPoolFactory.instance = new CharacterPoolFactory();
        }
        return CharacterPoolFactory.instance;
    }
    
    /**
     * 注册角色类型的对象池配置
     */
    public registerCharacterPool(config: CharacterPoolConfig): void {
        this.poolConfigs.set(config.characterClass, config);
        
        // 预热对象池
        if (config.initialSize && config.initialSize > 0) {
            this.preWarmPool(config);
        }
        
        console.log(`[PoolFactory] 注册角色池: ${config.characterClass} -> ${config.poolName}`);
    }
    
    /**
     * 预热对象池
     */
    private preWarmPool(config: CharacterPoolConfig): void {
        const preWarmCount = config.initialSize || 5;
        console.log(`[PoolFactory] 预热对象池 ${config.poolName}，数量: ${preWarmCount}`);
        
        for (let i = 0; i < preWarmCount; i++) {
            // 这里需要具体的预制体或节点创建逻辑
            // 暂时先注释，等具体实现
            // const node = this.createPoolNode(config);
            // poolManager.put(node);
        }
    }
    
    /**
     * 创建角色实例（强制从对象池）
     */
    public createCharacter(characterClass: string, options?: {
        characterId?: string;
        position?: Vec3;
        controlMode?: ControlMode;
        aiFaction?: string;
        aiBehaviorType?: string;
    }): IBaseCharacter | null {
        const config = this.poolConfigs.get(characterClass);
        if (!config) {
            console.error(`[PoolFactory] 未注册的角色类型: ${characterClass}`);
            return null;
        }
        
        // 从对象池获取节点
        const node = poolManager.get(config.poolName);
        if (!node) {
            console.error(`[PoolFactory] 对象池 ${config.poolName} 获取节点失败`);
            return null;
        }
        
        // 获取BaseCharacterDemo组件（检查类是否已注册）
        const BaseCharacterDemo = this.getBaseCharacterClass();
        if (!BaseCharacterDemo) {
            console.error(`[PoolFactory] BaseCharacterDemo类未注册 - 请确保至少有一个BaseCharacterDemo实例已初始化`);
            poolManager.put(node); // 归还无效节点
            return null;
        }
        
        let character = node.getComponent(BaseCharacterDemo) as unknown as IBaseCharacter;
        if (!character) {
            console.error(`[PoolFactory] 节点缺少BaseCharacterDemo组件`);
            poolManager.put(node); // 归还无效节点
            return null;
        }
        
        character.setEnemyType(characterClass);
        console.log(`[PoolFactory] ✅ 已设置敌人类型: ${characterClass}`);
        
        // 设置池化属性
        const characterId = options?.characterId || `${characterClass}_${Date.now()}`;
        character.setPoolingProperties(true, config.poolName, characterId);
        
        // 设置角色配置
        if (options?.controlMode !== undefined) {
            character.controlMode = options.controlMode;
        }
        if (options?.aiFaction) {
            character.aiFaction = options.aiFaction;
        }
        if (options?.aiBehaviorType) {
            character.aiBehaviorType = options.aiBehaviorType;
        }
        console.log(`[PoolFactory] 设置角色配置: ${characterClass}`, options);
        
        // 【修复】先执行重用回调，再设置位置（避免位置被重置）
        character.onReuseFromPool();
        
        // 设置位置（在重用回调之后，确保不被重置）
        if (options?.position) {
            // 使用角色的统一位置设置接口，确保z轴深度正确
            if (character.setNodePosition) {
                character.setNodePosition(options.position.x, options.position.y, options.position.z);
            } else {
                // 如果没有统一接口，手动设置z轴深度
                const newZDepth = -options.position.y * 0.1; // Y轴越大，Z轴越小
                node.setPosition(options.position.x, options.position.y, newZDepth);
            }
            // 确保角度锁定为0
            node.setRotationFromEuler(0, 0, 0);
            console.log(`[PoolFactory] ✅ 设置最终位置: (${options.position.x}, ${options.position.y}, z深度: ${node.position.z})`);
        }
        
        // 加入活跃角色集合
        this.activeCharacters.add(character);
        
        console.log(`[PoolFactory] 创建角色成功: ${character.aiFaction}`);
        return character;
    }
    
    /**
     * BaseCharacterDemo类引用（运行时注册以避免循环依赖）
     */
    private static BaseCharacterClass: any = null;
    private static isClassRegistered: boolean = false;
    
    /**
     * 注册BaseCharacterDemo类（由BaseCharacterDemo在运行时调用）
     * 使用防重复注册机制，确保只注册一次
     */
    public static registerBaseCharacterClass(baseCharacterClass: any): void {
        // 防重复注册检查
        if (CharacterPoolFactory.isClassRegistered && CharacterPoolFactory.BaseCharacterClass) {
            // 已经注册过了，静默跳过
            return;
        }
        
        CharacterPoolFactory.BaseCharacterClass = baseCharacterClass;
        CharacterPoolFactory.isClassRegistered = true;
        console.warn(`[PoolFactory] ✅ BaseCharacterDemo类已注册（全局唯一）`);
    }
    
    /**
     * 检查BaseCharacterDemo类是否已注册
     */
    public static isBaseCharacterClassRegistered(): boolean {
        return CharacterPoolFactory.isClassRegistered && CharacterPoolFactory.BaseCharacterClass !== null;
    }
    
    /**
     * 获取BaseCharacterDemo类
     */
    private getBaseCharacterClass(): any {
        return CharacterPoolFactory.BaseCharacterClass;
    }
    
    /**
     * 回收角色到对象池
     */
    public recycleCharacter(character: IBaseCharacter): void {
        if (!character || !character.getIsFromPool()) {
            console.warn(`[PoolFactory] 尝试回收非池化角色`);
            return;
        }
        
        // 从活跃集合移除
        this.activeCharacters.delete(character);
        
        // 执行回收回调
        character.onRecycleToPool();
        
        // 归还到对象池
        poolManager.put(character.node);
        
        console.log(`[PoolFactory] 角色已回收: ${character.characterId} -> ${character.getPoolName()}`);
    }
    
    /**
     * 回收所有活跃角色
     */
    public recycleAllCharacters(): void {
        const charactersToRecycle = Array.from(this.activeCharacters);
        charactersToRecycle.forEach(character => {
            this.recycleCharacter(character);
        });
        console.log(`[PoolFactory] 已回收所有角色，数量: ${charactersToRecycle.length}`);
    }
    
    /**
     * 获取活跃角色数量
     */
    public getActiveCharacterCount(): number {
        return this.activeCharacters.size;
    }
    
    /**
     * 获取指定类型的活跃角色
     */
    public getActiveCharactersByType(characterClass: string): IBaseCharacter[] {
        return Array.from(this.activeCharacters).filter(character => 
            character.getCharacterType && character.getCharacterType() === characterClass
        );
    }
}

/**
 * 角色池化系统初始化管理器
 * 用于根据关卡需要动态注册和初始化角色对象池
 */
export class CharacterPoolInitializer {
    private static initializedPools: Set<string> = new Set();
    
    /**
     * 根据关卡数据初始化所需的角色对象池
     * @param levelData 关卡数据或者敌人类型数组
     */
    public static initializePoolsForLevel(levelData: any): void {
        const factory = CharacterPoolFactory.getInstance();
        let enemyTypes: string[] = [];
        
        // 从关卡数据中提取敌人类型
        if (Array.isArray(levelData)) {
            // 直接是敌人类型数组
            enemyTypes = levelData;
        } else if (levelData.monsterSpawners) {
            // 新格式的关卡数据
            levelData.monsterSpawners.forEach((spawner: any) => {
                spawner.enemies?.forEach((enemy: any) => {
                    if (enemy.type && enemyTypes.indexOf(enemy.type) === -1) {
                        enemyTypes.push(enemy.type);
                    }
                });
            });
        } else if (levelData.enemies) {
            // 旧格式的关卡数据
            levelData.enemies.forEach((enemy: any) => {
                if (enemy.type && enemyTypes.indexOf(enemy.type) === -1) {
                    enemyTypes.push(enemy.type);
                }
            });
        }
        
        console.log(`[PoolInitializer] 关卡需要敌人类型:`, enemyTypes);
        
        // 为每个敌人类型注册对象池
        enemyTypes.forEach(enemyType => {
            CharacterPoolInitializer.initializePoolForEnemyType(enemyType);
        });
    }
    
    /**
     * 为单个敌人类型初始化对象池
     * @param enemyType 敌人类型
     */
    public static initializePoolForEnemyType(enemyType: string): void {
        if (CharacterPoolInitializer.initializedPools.has(enemyType)) {
            console.log(`[PoolInitializer] 对象池 ${enemyType} 已存在，跳过初始化`);
            return;
        }
        
        const factory = CharacterPoolFactory.getInstance();
        const config = CharacterPoolInitializer.getPoolConfigForEnemyType(enemyType);
        
        try {
            factory.registerCharacterPool({
                poolName: enemyType,           // 【修复】去掉"Pool"后缀，与GameManager保持一致
                characterClass: enemyType,
                enemyConfigId: enemyType,
                initialSize: config.initialSize,
                maxSize: config.maxSize
            });
            
            CharacterPoolInitializer.initializedPools.add(enemyType);
            console.log(`[PoolInitializer] ✅ 对象池 ${enemyType} 初始化完成 (初始:${config.initialSize}, 最大:${config.maxSize})`);
        } catch (error) {
            console.error(`[PoolInitializer] ❌ 对象池 ${enemyType} 初始化失败:`, error);
        }
    }
    
    /**
     * 根据敌人类型获取对象池配置
     * @param enemyType 敌人类型
     * @returns 池配置
     */
    private static getPoolConfigForEnemyType(enemyType: string): { initialSize: number; maxSize: number } {
        // Boss类敌人
        if (enemyType.includes('boss')) {
            return { initialSize: 1, maxSize: 3 };
        }
        // 精英敌人
        else if (enemyType.includes('elite')) {
            return { initialSize: 2, maxSize: 8 };
        }
        // 史莱姆类（数量较多）
        else if (enemyType.startsWith('slime')) {
            return { initialSize: 5, maxSize: 30 };
        }
        // 常规敌人
        else if (enemyType.includes('normal')) {
            return { initialSize: 3, maxSize: 15 };
        }
        // 特殊类型
        else {
            return { initialSize: 3, maxSize: 15 };
        }
    }
    
    /**
     * 初始化所有预定义的角色对象池（测试模式用）
     */
    public static initializeAllPools(): void {
        const allEnemyTypes = [
            'ent_normal', 'ent_elite', 'ent_boss',
            'lich_normal', 'lich_elite', 'lich_boss',
            'skeleton_normal', 'skeleton_elite', 'skeleton_boss',
            'orc_normal', 'orc_elite', 'orc_boss',
            'goblin_normal', 'goblin_elite', 'goblin_boss',
            'slime_normal', 'slime_fire', 'slime_ice', 'slime_bomb',
            'slime_ghost', 'slime_lightning', 'slime_crystal', 'slime_devil', 'slime_lava',
            'golem_normal', 'golem_elite', 'golem_boss'
        ];
        
        console.log('[PoolInitializer] 测试模式：初始化所有角色对象池');
        CharacterPoolInitializer.initializePoolsForLevel(allEnemyTypes);
    }
    
    /**
     * 清理所有对象池
     */
    public static cleanup(): void {
        CharacterPoolFactory.getInstance().recycleAllCharacters();
        CharacterPoolInitializer.initializedPools.clear();
        console.log('[PoolInitializer] 对象池已清理');
    }
    
    /**
     * 检查是否已初始化指定类型的对象池
     */
    public static isPoolInitialized(enemyType: string): boolean {
        return CharacterPoolInitializer.initializedPools.has(enemyType);
    }
    
    /**
     * 获取已初始化的对象池数量
     */
    public static getInitializedPoolCount(): number {
        return CharacterPoolInitializer.initializedPools.size;
    }
} 