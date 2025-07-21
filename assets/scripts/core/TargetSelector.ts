// assets/scripts/core/TargetSelector.ts

import { _decorator, Component, Node, Vec3, director } from 'cc';
import { ITargetSelector, TargetInfo } from './MonsterAI';
import { Faction } from '../configs/FactionConfig';
import { factionManager } from './FactionManager';
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
        
        console.log(`%c[TARGET CACHE] 开始更新缓存...`, 'color: blue');
        
        const allNodes = scene.children;
        let totalProcessed = 0;
        
        for (const node of allNodes) {
            totalProcessed++;
            const faction = this.determineFaction(node);
            if (faction) {
                if (!this.targetCache.has(faction)) {
                    this.targetCache.set(faction, []);
                }
                this.targetCache.get(faction)!.push(node);
                console.log(`%c[TARGET CACHE] ✅ 添加目标: ${node.name} → ${faction}`, 'color: blue');
            } else {
                // 【调试】输出未识别阵营的节点
                const hasCharacterStats = !!node.getComponent('CharacterStats');
                const hasBaseCharacterDemo = !!node.getComponent('BaseCharacterDemo');
                if (hasCharacterStats || hasBaseCharacterDemo) {
                    console.log(`%c[TARGET CACHE] ⚠️ 跳过节点: ${node.name} (未识别阵营) - CharacterStats:${hasCharacterStats}, BaseCharacterDemo:${hasBaseCharacterDemo}`, 'color: orange');
                }
            }
            
            // 递归检查子节点
            this.checkChildrenForTargets(node, this.targetCache);
        }
        
        console.log(`%c[TARGET CACHE] 缓存更新完成！处理了 ${totalProcessed} 个顶级节点`, 'color: blue');
        for (const [faction, targets] of this.targetCache.entries()) {
            console.log(`%c[TARGET CACHE]   ${faction}: ${targets.length} 个目标`, 'color: blue');
            targets.forEach(target => console.log(`%c[TARGET CACHE]     · ${target.name} 位置: (${target.position.x.toFixed(0)}, ${target.position.y.toFixed(0)})`, 'color: lightblue'));
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
                    
                    // 使用CharacterStats组件中的阵营信息
                    const characterStats = node.getComponent('CharacterStats');
                    if (characterStats) {
                        const faction = (characterStats as any).faction;
                        if (faction) {
                            return faction;
                        }
                    }
                    
                    // 阵营字符串转换：只支持颜色阵营
                    switch (aiFaction) {
                        case 'red':
                            return Faction.FACTION_RED;
                        case 'blue':
                            return Faction.FACTION_BLUE;
                        case 'green':
                            return Faction.FACTION_GREEN;
                        case 'purple':
                            return Faction.FACTION_PURPLE;
                        case 'player': 
                            return Faction.PLAYER;
                        default:
                            // 如果阵营属性不明确，默认为玩家阵营
                            console.log(`%c[TARGET DEBUG] 阵营属性不明确，设为player: ${node.name}`, 'color: orange');
                            return Faction.PLAYER;
                    }
                } else {
                    console.log(`%c[TARGET DEBUG] 手动角色 ${node.name}: 跳过目标选择`, 'color: gray');
                    return null; // 手动控制的角色不参与AI目标选择
                }
            }
            
            // 对于没有明确阵营信息的情况，返回null (不参与目标选择)
            console.log(`%c[TARGET DEBUG] 无法确定阵营，跳过目标选择: ${node.name}`, 'color: orange');
            return null;
        }
        
        return null;
    }
    
    /**
     * 获取敌对阵营列表
     */
    private getEnemyFactions(myFaction: Faction): Faction[] {
        // 使用新的FactionManager来获取敌对阵营
        return factionManager.getEnemyFactions(myFaction);
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