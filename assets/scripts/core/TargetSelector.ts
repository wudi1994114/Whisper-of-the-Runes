// assets/scripts/core/TargetSelector.ts

import { _decorator, Component, Node, Vec3, director } from 'cc';
import { ITargetSelector, TargetInfo, Faction } from './MonsterAI';
import { CharacterStats } from '../components/CharacterStats';

const { ccclass, property } = _decorator;

/**
 * 目标选择器
 * 负责为AI查找和选择合适的攻击目标
 */
@ccclass('TargetSelector')
export class TargetSelector extends Component implements ITargetSelector {
    
    // 单例实例
    private static _instance: TargetSelector | null = null;
    
    // 缓存系统
    private targetCache: Map<Faction, Node[]> = new Map();
    private lastCacheUpdateTime: number = 0;
    private cacheUpdateInterval: number = 500; // 500ms更新一次缓存
    
    protected onLoad(): void {
        TargetSelector._instance = this;
    }
    
    protected onDestroy(): void {
        if (TargetSelector._instance === this) {
            TargetSelector._instance = null;
        }
    }
    
    /**
     * 获取单例实例
     */
    public static getInstance(): TargetSelector | null {
        return TargetSelector._instance;
    }
    
    /**
     * 查找最佳目标
     */
    public findBestTarget(myPosition: Vec3, myFaction: Faction, detectionRange: number): TargetInfo | null {
        const currentTime = Date.now();
        
        // 更新缓存
        if (currentTime - this.lastCacheUpdateTime > this.cacheUpdateInterval) {
            this.updateTargetCache();
            this.lastCacheUpdateTime = currentTime;
        }
        
        // 确定敌对阵营
        const enemyFactions = this.getEnemyFactions(myFaction);
        
        let bestTarget: TargetInfo | null = null;
        let bestScore = -1;
        
        // 遍历所有敌对阵营
        for (const enemyFaction of enemyFactions) {
            const targets = this.getTargetsByFaction(enemyFaction);
            
            for (const target of targets) {
                if (!target || !target.isValid) continue;
                
                const distance = Vec3.distance(myPosition, target.position);
                
                // 距离检查
                if (distance > detectionRange) continue;
                
                // 生命值检查
                const characterStats = target.getComponent(CharacterStats);
                if (!characterStats || !characterStats.isAlive) continue;
                
                // 计算目标评分
                const priority = this.calculateTargetPriority(target, myPosition);
                const score = priority / (distance + 1); // 距离越近，优先级越高
                
                if (score > bestScore) {
                    bestScore = score;
                    bestTarget = {
                        node: target,
                        position: target.position.clone(),
                        distance: distance,
                        faction: enemyFaction,
                        priority: priority
                    };
                }
            }
        }
        
        return bestTarget;
    }
    
    /**
     * 获取指定阵营的所有目标
     */
    public getTargetsByFaction(targetFaction: Faction): Node[] {
        const cached = this.targetCache.get(targetFaction);
        if (cached) {
            return cached.filter(node => node && node.isValid);
        }
        return [];
    }
    
    /**
     * 计算目标优先级
     */
    public calculateTargetPriority(target: Node, myPosition: Vec3): number {
        let priority = 100; // 基础优先级
        
        // 根据目标类型调整优先级
        const characterStats = target.getComponent(CharacterStats);
        if (characterStats) {
            // 血量越少，优先级越高（更容易击杀）
            const healthRatio = characterStats.currentHealth / characterStats.maxHealth;
            priority += (1 - healthRatio) * 50;
            
            // 根据目标类型调整
            if (target.name.includes('player') || target.getComponent('PlayerController')) {
                priority += 200; // 玩家优先级最高
            } else if (target.name.includes('elite')) {
                priority += 30; // 精英怪优先级较高
            } else if (target.name.includes('boss')) {
                priority += 100; // Boss优先级很高
            }
        }
        
        return priority;
    }
    
    /**
     * 更新目标缓存
     */
    public updateTargetCache(): void {
        this.targetCache.clear();
        
        const scene = director.getScene();
        if (!scene) return;
        
        const allNodes = scene.children;
        
        for (const node of allNodes) {
            const faction = this.determineFaction(node);
            if (faction) {
                if (!this.targetCache.has(faction)) {
                    this.targetCache.set(faction, []);
                }
                this.targetCache.get(faction)!.push(node);
            }
            
            // 递归检查子节点
            this.checkChildrenForTargets(node, this.targetCache);
        }
        
        for (const [faction, targets] of this.targetCache.entries()) {
            targets.forEach(target => console.log(`    · ${target.name} 位置: (${target.position.x.toFixed(0)}, ${target.position.y.toFixed(0)})`));
        }
    }
    
    /**
     * 递归检查子节点
     */
    private checkChildrenForTargets(parentNode: Node, cache: Map<Faction, Node[]>): void {
        for (const child of parentNode.children) {
            const faction = this.determineFaction(child);
            if (faction) {
                if (!cache.has(faction)) {
                    cache.set(faction, []);
                }
                cache.get(faction)!.push(child);
            }
            
            // 继续递归
            if (child.children.length > 0) {
                this.checkChildrenForTargets(child, cache);
            }
        }
    }
    
    /**
     * 确定节点的阵营
     */
    private determineFaction(node: Node): Faction | null {
        // 通过节点名称判断
        const nodeName = node.name.toLowerCase();
        
        // 玩家
        if (nodeName.includes('player') || node.getComponent('PlayerController')) {
            return Faction.PLAYER;
        }
        
        // 【重构】检查BaseCharacterDemo组件和AI模式
        const characterDemo = node.getComponent('BaseCharacterDemo');
        const characterStats = node.getComponent(CharacterStats);
        
        if (characterDemo || characterStats) {
            const position = node.position;
            
            // 如果有BaseCharacterDemo组件，检查是否为AI模式
            if (characterDemo) {
                const controlMode = (characterDemo as any).controlMode;
                const isAI = controlMode === 1; // ControlMode.AI = 1
                
                if (isAI) {
                    // AI模式下，通过阵营属性直接获取阵营
                    const aiFaction = (characterDemo as any).aiFaction;
                    
                    switch (aiFaction) {
                        case 'enemy_left': return Faction.ENEMY_LEFT;
                        case 'enemy_right': return Faction.ENEMY_RIGHT;
                        case 'player': return Faction.PLAYER;
                        default:
                            // 如果阵营属性不明确，回退到位置判断
                            console.log(`%c[TARGET DEBUG] 阵营属性不明确，使用位置判断: ${node.name}`, 'color: orange');
                            break;
                    }
                } else {
                    console.log(`%c[TARGET DEBUG] 手动角色 ${node.name}: 跳过目标选择`, 'color: gray');
                    return null; // 手动控制的角色不参与AI目标选择
                }
            }
            
            // 回退到位置判断（用于没有阵营属性或阵营属性不明确的情况）
            // 左侧敌人（x < 0）
            if (position.x < 0) {
                return Faction.ENEMY_LEFT;
            }
            // 右侧敌人（x > 0）
            else if (position.x > 0) {
                return Faction.ENEMY_RIGHT;
            }
        }
        
        return null;
    }
    
    /**
     * 获取敌对阵营列表
     */
    private getEnemyFactions(myFaction: Faction): Faction[] {
        switch (myFaction) {
            case Faction.PLAYER:
                return [Faction.ENEMY_LEFT, Faction.ENEMY_RIGHT];
            case Faction.ENEMY_LEFT:
                return [Faction.PLAYER, Faction.ENEMY_RIGHT];
            case Faction.ENEMY_RIGHT:
                return [Faction.PLAYER, Faction.ENEMY_LEFT];
            default:
                return [];
        }
    }
    
    /**
     * 强制刷新缓存
     */
    public forceRefreshCache(): void {
        this.updateTargetCache();
        this.lastCacheUpdateTime = Date.now();
    }
    
    /**
     * 获取缓存统计信息
     */
    public getCacheStats(): { [key: string]: number } {
        const stats: { [key: string]: number } = {};
        
        for (const [faction, targets] of this.targetCache) {
            stats[faction] = targets.filter(node => node && node.isValid).length;
        }
        
        return stats;
    }
}

// 导出单例访问器
export const targetSelector = {
    getInstance: (): TargetSelector | null => TargetSelector.getInstance()
}; 