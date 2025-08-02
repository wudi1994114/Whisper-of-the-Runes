// assets/scripts/interfaces/IFactional.ts

import { Faction } from '../configs/FactionConfig';

/**
 * 阵营相关接口
 * 负责处理角色的阵营管理、物理分组等
 */
export interface IFactional {
    /**
     * AI阵营字符串
     */
    readonly aiFaction: string;
    
    /**
     * 设置阵营
     * @param faction 阵营
     */
    setFaction(faction: Faction): void;
    
    /**
     * 获取阵营
     */
    getFaction(): Faction;
    
    /**
     * 更新角色物理分组
     * @param faction 阵营
     */
    updateCharacterPhysicsGroup(faction: Faction): void;
    
    /**
     * 设置默认阵营
     */
    setupDefaultFaction(): void;
}