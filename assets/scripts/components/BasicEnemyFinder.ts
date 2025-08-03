// assets/scripts/components/BasicEnemyFinder.ts

import { _decorator, Component, Node, Vec3, director } from 'cc';
import { Faction } from '../configs/FactionConfig';
import { factionManager } from '../managers/FactionManager';

const { ccclass } = _decorator;

/**
 * 基础敌人查找器
 * 替代复杂的TargetSelectorFactory，提供简单直接的索敌功能
 */
@ccclass('BasicEnemyFinder')
export class BasicEnemyFinder {
    private static instance: BasicEnemyFinder | null = null;
    
    // 缓存所有活跃的角色节点，按阵营分组
    private charactersByFaction: Map<Faction, Set<Node>> = new Map();
    
    // 性能优化：限制搜索频率
    private lastSearchTime: number = 0;
    private readonly SEARCH_COOLDOWN = 0.1; // 100ms搜索间隔
    
    private constructor() {
        // 初始化阵营映射
        this.initializeFactionMaps();
    }
    
    public static getInstance(): BasicEnemyFinder {
        if (!BasicEnemyFinder.instance) {
            BasicEnemyFinder.instance = new BasicEnemyFinder();
        }
        return BasicEnemyFinder.instance;
    }
    
    /**
     * 初始化阵营映射
     */
    private initializeFactionMaps(): void {
        const allFactions = [Faction.PLAYER, Faction.RED, Faction.BLUE, Faction.GREEN, Faction.PURPLE];
        allFactions.forEach(faction => {
            this.charactersByFaction.set(faction, new Set());
        });
    }
    
    /**
     * 注册角色到索敌系统
     * @param characterNode 角色节点
     * @param faction 角色阵营
     */
    public registerCharacter(characterNode: Node, faction: Faction): void {
        const factionSet = this.charactersByFaction.get(faction);
        if (factionSet) {
            factionSet.add(characterNode);
            console.log(`[BasicEnemyFinder] 注册角色: ${characterNode.name} -> ${faction}`);
        }
    }
    
    /**
     * 从索敌系统移除角色
     * @param characterNode 角色节点
     * @param faction 角色阵营
     */
    public unregisterCharacter(characterNode: Node, faction: Faction): void {
        const factionSet = this.charactersByFaction.get(faction);
        if (factionSet) {
            factionSet.delete(characterNode);
            console.log(`[BasicEnemyFinder] 移除角色: ${characterNode.name} -> ${faction}`);
        }
    }
    
    /**
     * 查找最近的敌人
     * @param searcherNode 搜索者节点
     * @param searcherFaction 搜索者阵营
     * @param maxRange 最大搜索范围
     * @returns 最近的敌人节点，如果没找到返回null
     */
    public findNearestEnemy(searcherNode: Node, searcherFaction: Faction, maxRange: number = 200): Node | null {
        // 性能优化：限制搜索频率
        const now = Date.now();
        if (now - this.lastSearchTime < this.SEARCH_COOLDOWN * 1000) {
            return null; // 搜索冷却中
        }
        this.lastSearchTime = now;
        
        let nearestEnemy: Node | null = null;
        let nearestDistance = maxRange;
        
        const searcherPos = searcherNode.getWorldPosition();
        
        // 遍历所有阵营，找出敌对阵营
        this.charactersByFaction.forEach((characters, faction) => {
            // 检查是否为敌对阵营
            if (factionManager.doesAttack(searcherFaction, faction)) {
                characters.forEach(character => {
                    // 检查角色是否有效且存活
                    if (!character || !character.isValid) {
                        characters.delete(character); // 清理无效节点
                        return;
                    }
                    
                    // 检查角色是否存活
                    const characterStats = character.getComponent('CharacterStats');
                    if (characterStats && !(characterStats as any).isAlive) {
                        return;
                    }
                    
                    // 计算距离
                    const enemyPos = character.getWorldPosition();
                    const distance = Vec3.distance(searcherPos, enemyPos);
                    
                    if (distance < nearestDistance) {
                        nearestDistance = distance;
                        nearestEnemy = character;
                    }
                });
            }
        });
        
        if (nearestEnemy) {
            console.log(`[BasicEnemyFinder] ${searcherNode.name} 找到敌人: ${nearestEnemy.name}, 距离: ${nearestDistance.toFixed(1)}`);
        }
        
        return nearestEnemy;
    }
    
    /**
     * 获取指定阵营的所有敌人
     * @param searcherFaction 搜索者阵营
     * @param maxRange 最大搜索范围
     * @param searcherPos 搜索者位置
     * @returns 敌人节点数组
     */
    public getAllEnemies(searcherFaction: Faction, maxRange: number = 300, searcherPos?: Vec3): Node[] {
        const enemies: Node[] = [];
        
        this.charactersByFaction.forEach((characters, faction) => {
            if (factionManager.doesAttack(searcherFaction, faction)) {
                characters.forEach(character => {
                    if (!character || !character.isValid) {
                        characters.delete(character);
                        return;
                    }
                    
                    // 检查存活状态
                    const characterStats = character.getComponent('CharacterStats');
                    if (characterStats && !(characterStats as any).isAlive) {
                        return;
                    }
                    
                    // 检查距离
                    if (searcherPos) {
                        const enemyPos = character.getWorldPosition();
                        const distance = Vec3.distance(searcherPos, enemyPos);
                        if (distance <= maxRange) {
                            enemies.push(character);
                        }
                    } else {
                        enemies.push(character);
                    }
                });
            }
        });
        
        return enemies;
    }
    
    /**
     * 清理所有缓存
     */
    public clearAll(): void {
        this.charactersByFaction.forEach(factionSet => {
            factionSet.clear();
        });
        console.log('[BasicEnemyFinder] 已清理所有角色缓存');
    }
    
    /**
     * 获取调试信息
     */
    public getDebugInfo(): string {
        let info = '[BasicEnemyFinder] 当前注册角色:\n';
        this.charactersByFaction.forEach((characters, faction) => {
            info += `  ${faction}: ${characters.size} 个角色\n`;
        });
        return info;
    }
}

// 导出单例实例
export const basicEnemyFinder = BasicEnemyFinder.getInstance();