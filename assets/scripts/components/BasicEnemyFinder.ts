// assets/scripts/components/BasicEnemyFinder.ts

import { _decorator, Component, Node, Vec3, director } from 'cc';
import { Faction } from '../configs/FactionConfig';
import { factionManager } from '../managers/FactionManager';
import { gridSystem } from '../systems/GridSystem';
import { EntityType, QueryOptions } from '../interfaces/IGrid';

const { ccclass } = _decorator;

/**
 * 基础敌人查找器 - 基于网格系统的高性能索敌
 * 使用网格空间索引提供快速的敌人查找功能
 */
@ccclass('BasicEnemyFinder')
export class BasicEnemyFinder {
    private static instance: BasicEnemyFinder | null = null;
    
    // 性能优化：限制搜索频率
    private lastSearchTime: number = 0;
    private readonly SEARCH_COOLDOWN = 0.05; // 50ms搜索间隔（比原来更频繁，因为网格系统更高效）
    
    // 清理计时器
    private cleanupTimer = 0;
    private readonly CLEANUP_INTERVAL = 5.0; // 5秒清理一次
    
    // 统计信息
    private queryCount = 0;
    private cacheHits = 0;
    
    private constructor() {
        console.log('[BasicEnemyFinder] 初始化基于网格系统的索敌器');
    }
    
    public static getInstance(): BasicEnemyFinder {
        if (!BasicEnemyFinder.instance) {
            BasicEnemyFinder.instance = new BasicEnemyFinder();
        }
        return BasicEnemyFinder.instance;
    }
    
    /**
     * 获取网格系统的敌对阵营列表
     */
    private getEnemyFactions(searcherFaction: Faction): Faction[] {
        const allFactions = [Faction.PLAYER, Faction.RED, Faction.BLUE, Faction.GREEN, Faction.PURPLE];
        return allFactions.filter(faction => factionManager.doesAttack(searcherFaction, faction));
    }
    
    /**
     * 注册角色到索敌系统（现在使用网格系统）
     * @param characterNode 角色节点
     * @param faction 角色阵营
     */
    public registerCharacter(characterNode: Node, faction: Faction): void {
        gridSystem.registerEntity(characterNode, faction, EntityType.CHARACTER);
        console.log(`[BasicEnemyFinder] 注册角色到网格系统: ${characterNode.name} -> ${faction}`);
    }
    
    /**
     * 从索敌系统移除角色（现在使用网格系统）
     * @param characterNode 角色节点
     * @param faction 角色阵营  
     */
    public unregisterCharacter(characterNode: Node, faction: Faction): void {
        gridSystem.unregisterEntity(characterNode);
        console.log(`[BasicEnemyFinder] 从网格系统移除角色: ${characterNode.name} -> ${faction}`);
    }
    
    /**
     * 查找最近的敌人 - 使用网格系统优化
     * @param searcherNode 搜索者节点
     * @param searcherFaction 搜索者阵营
     * @param maxRange 最大搜索范围
     * @returns 最近的敌人节点，如果没找到返回null
     */
    public findNearestEnemy(searcherNode: Node, searcherFaction: Faction, maxRange: number = 200): Node | null {
        // 性能优化：限制搜索频率
        const now = Date.now();
        if (now - this.lastSearchTime < this.SEARCH_COOLDOWN * 1000) {
            this.cacheHits++;
            return null; // 搜索冷却中
        }
        this.lastSearchTime = now;
        this.queryCount++;
        
        const searcherPos = searcherNode.getWorldPosition();
        const enemyFactions = this.getEnemyFactions(searcherFaction);
        
        // 使用网格系统查找最近的敌人
        const queryOptions: QueryOptions = {
            factions: enemyFactions,
            entityTypes: [EntityType.CHARACTER],
            maxDistance: maxRange,
            ignoreEntity: searcherNode,
            onlyAlive: true
        };
        
        const result = gridSystem.findNearestEntity(searcherPos, queryOptions);
        
        if (result) {
            console.log(`[BasicEnemyFinder] ${searcherNode.name} 找到敌人: ${result.entity.node.name}, 距离: ${result.distance.toFixed(1)} (网格查询)`);
            return result.entity.node;
        }
        
        return null;
    }
    
    /**
     * 获取指定阵营的所有敌人 - 使用网格系统优化
     * @param searcherFaction 搜索者阵营
     * @param maxRange 最大搜索范围
     * @param searcherPos 搜索者位置
     * @returns 敌人节点数组
     */
    public getAllEnemies(searcherFaction: Faction, maxRange: number = 300, searcherPos?: Vec3): Node[] {
        if (!searcherPos) {
            console.warn('[BasicEnemyFinder] getAllEnemies需要搜索位置参数');
            return [];
        }
        
        this.queryCount++;
        const enemyFactions = this.getEnemyFactions(searcherFaction);
        
        // 使用网格系统查找范围内的所有敌人
        const queryOptions: QueryOptions = {
            factions: enemyFactions,
            entityTypes: [EntityType.CHARACTER],
            onlyAlive: true
        };
        
        const results = gridSystem.findEntitiesInRange(searcherPos, maxRange, queryOptions);
        const enemies = results.map(result => result.entity.node);
        
        console.log(`[BasicEnemyFinder] 在范围${maxRange}内找到${enemies.length}个敌人 (网格查询)`);
        return enemies;
    }
    
    /**
     * 清理所有缓存（现在使用网格系统清理）
     */
    public clearAll(): void {
        gridSystem.cleanup();
        this.queryCount = 0;
        this.cacheHits = 0;
        console.log('[BasicEnemyFinder] 已清理所有角色缓存（网格系统）');
    }
    
    /**
     * 手动触发清理
     */
    public triggerCleanup(): void {
        gridSystem.cleanup();
        console.log('[BasicEnemyFinder] 手动触发网格系统清理');
    }
    
    /**
     * 获取调试信息
     */
    public getDebugInfo(): string {
        return `[BasicEnemyFinder] 基于网格系统的索敌统计:
- 查询次数: ${this.queryCount}
- 缓存命中: ${this.cacheHits}
- 命中率: ${this.queryCount > 0 ? (this.cacheHits / this.queryCount * 100).toFixed(1) : 0}%
- 搜索冷却: ${this.SEARCH_COOLDOWN * 1000}ms

${gridSystem.getDebugInfo()}`;
    }
    
    /**
     * 更新实体位置通知网格系统
     * 应该在角色移动时调用
     */
    public updateEntityPosition(node: Node): void {
        gridSystem.updateEntityPosition(node);
    }
    
    /**
     * 基于网格的范围攻击目标查找
     * @param centerPos 攻击中心位置
     * @param radius 攻击半径
     * @param attackerFaction 攻击者阵营
     * @returns 范围内的敌人节点数组
     */
    public findTargetsInAOE(centerPos: Vec3, radius: number, attackerFaction: Faction): Node[] {
        const enemyFactions = this.getEnemyFactions(attackerFaction);
        
        const queryOptions: QueryOptions = {
            factions: enemyFactions,
            entityTypes: [EntityType.CHARACTER],
            onlyAlive: true
        };
        
        const results = gridSystem.findEntitiesInRange(centerPos, radius, queryOptions);
        return results.map(result => result.entity.node);
    }
}

// 导出单例实例
export const basicEnemyFinder = BasicEnemyFinder.getInstance();