// assets/scripts/interfaces/IConfigurable.ts

import { EnemyData } from '../configs/EnemyConfig';

/**
 * 可配置对象接口
 * 负责处理角色的配置数据加载、类型管理等
 */
export interface IConfigurable {
    /**
     * 敌人配置数据
     */
    readonly enemyData: EnemyData | null;
    
    /**
     * AI行为类型
     */
    readonly aiBehaviorType: string;
    
    /**
     * 设置敌人类型
     * @param enemyType 敌人类型ID
     */
    setEnemyType(enemyType: string): void;
    
    /**
     * 获取敌人配置ID
     */
    getEnemyConfigId(): string;
    
    /**
     * 获取敌人数据
     */
    getEnemyData(): EnemyData | null;
    
    /**
     * 获取角色类型
     */
    getCharacterType(): string;
    
    /**
     * 获取角色显示名称
     */
    getCharacterDisplayName(): string;
    
    /**
     * 加载敌人配置
     */
    loadEnemyConfig(): void;
    
    /**
     * 初始化AI
     */
    initializeAI(): void;
}