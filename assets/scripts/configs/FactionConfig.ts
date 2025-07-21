// assets/scripts/configs/FactionConfig.ts

import { _decorator } from 'cc';

const { ccclass } = _decorator;

/**
 * 阵营枚举
 * 4大主要阵营 + 玩家阵营
 */
export enum Faction {
    PLAYER = 'player',              // 玩家阵营
    FACTION_RED = 'red',            // 红色阵营 (火系/暴力)
    FACTION_BLUE = 'blue',          // 蓝色阵营 (冰系/秩序)
    FACTION_GREEN = 'green',        // 绿色阵营 (自然/野性)
    FACTION_PURPLE = 'purple',      // 紫色阵营 (暗系/邪恶)
}

/**
 * 阵营关系接口
 * 定义某个阵营攻击哪些其他阵营
 */
export interface FactionRelation {
    attacks: Faction[];             // 该阵营会攻击的目标阵营列表
}

/**
 * 阵营关系配置接口
 * 完整的阵营关系映射表
 */
export interface FactionRelationships {
    [key: string]: FactionRelation; // 键为阵营名，值为该阵营的攻击关系
}

/**
 * 阵营配置接口
 * 关卡中的阵营系统完整配置
 */
export interface FactionConfig {
    factionRelationships: FactionRelationships;
}

/**
 * 默认阵营关系配置
 * 4大阵营相互对立的混战模式
 */
export const DEFAULT_FACTION_RELATIONSHIPS: FactionRelationships = {
    [Faction.PLAYER]: { 
        attacks: [Faction.FACTION_RED, Faction.FACTION_BLUE, Faction.FACTION_GREEN, Faction.FACTION_PURPLE] 
    },
    [Faction.FACTION_RED]: { 
        attacks: [Faction.PLAYER, Faction.FACTION_BLUE, Faction.FACTION_GREEN, Faction.FACTION_PURPLE] 
    },
    [Faction.FACTION_BLUE]: { 
        attacks: [Faction.PLAYER, Faction.FACTION_RED, Faction.FACTION_GREEN, Faction.FACTION_PURPLE] 
    },
    [Faction.FACTION_GREEN]: { 
        attacks: [Faction.PLAYER, Faction.FACTION_RED, Faction.FACTION_BLUE, Faction.FACTION_PURPLE] 
    },
    [Faction.FACTION_PURPLE]: { 
        attacks: [Faction.PLAYER, Faction.FACTION_RED, Faction.FACTION_BLUE, Faction.FACTION_GREEN] 
    }
};

/**
 * 阵营相关工具函数
 */
export class FactionUtils {
    /**
     * 字符串转阵营枚举
     */
    static stringToFaction(factionStr: string): Faction {
        const normalizedStr = factionStr.toLowerCase();
        
        // 手动检查每个阵营值
        for (const key in Faction) {
            if (Faction.hasOwnProperty(key)) {
                const factionValue = Faction[key as keyof typeof Faction];
                if (factionValue.toLowerCase() === normalizedStr) {
                    return factionValue as Faction;
                }
            }
        }
        
        console.warn(`FactionUtils: 未知阵营字符串 "${factionStr}"，默认返回 PLAYER`);
        return Faction.PLAYER;
    }

    /**
     * 阵营枚举转字符串
     */
    static factionToString(faction: Faction): string {
        return faction.toString();
    }

    /**
     * 验证阵营关系配置的有效性
     */
    static validateFactionRelationships(relationships: FactionRelationships): boolean {
        try {
            // 获取所有有效的阵营值
            const validFactions: Faction[] = [];
            for (const key in Faction) {
                if (Faction.hasOwnProperty(key)) {
                    validFactions.push(Faction[key as keyof typeof Faction]);
                }
            }

            for (const factionKey in relationships) {
                if (relationships.hasOwnProperty(factionKey)) {
                    const relation = relationships[factionKey];
                    
                    // 检查阵营key是否有效
                    if (validFactions.indexOf(factionKey as Faction) === -1) {
                        console.error(`FactionUtils: 无效的阵营key "${factionKey}"`);
                        return false;
                    }

                    // 检查攻击目标是否有效
                    for (const targetFaction of relation.attacks) {
                        if (validFactions.indexOf(targetFaction) === -1) {
                            console.error(`FactionUtils: 无效的攻击目标阵营 "${targetFaction}"`);
                            return false;
                        }
                    }
                }
            }
            return true;
        } catch (error) {
            console.error('FactionUtils: 验证阵营关系配置时出错:', error);
            return false;
        }
    }
} 