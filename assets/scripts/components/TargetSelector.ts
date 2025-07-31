// assets/scripts/core/TargetSelector.ts

import { _decorator, Component, Node, Vec3, director } from 'cc';
import { ITargetSelector, TargetInfo } from './MonsterAI';
import { Faction } from '../configs/FactionConfig';
import { factionManager } from '../managers/FactionManager';
import { CharacterStats } from './CharacterStats';

const { ccclass } = _decorator;

/**
 * 目标选择器
 * 负责为AI查找和选择合适的攻击目标
 * 使用注册/反注册模式管理目标，提供高性能的目标查找服务
 */
@ccclass('TargetSelector')
export class TargetSelector extends Component implements ITargetSelector {
    
    // 单例实例
    private static _instance: TargetSelector | null = null;
    
    // 目标注册表：存储按阵营分类的目标节点
    private targetRegistry: Map<Faction, Node[]> = new Map();
    
    protected onLoad(): void {
        TargetSelector._instance = this;
        console.log(`%c[TargetSelector] 🎯 目标选择器已初始化`, 'color: blue; font-weight: bold');
    }
    
    protected onDestroy(): void {
        if (TargetSelector._instance === this) {
            TargetSelector._instance = null;
        }
        this.targetRegistry.clear();
        console.log(`%c[TargetSelector] 🗑️ 目标选择器已销毁`, 'color: orange');
    }
    
    /**
     * 获取单例实例
     */
    public static getInstance(): TargetSelector | null {
        return TargetSelector._instance;
    }
    
    /**
     * 注册目标到指定阵营
     * @param target 目标节点
     * @param faction 目标所属阵营
     */
    public registerTarget(target: Node, faction: Faction): void {
        if (!target || !target.isValid) {
            return;
        }
        
        // 确保阵营列表存在
        if (!this.targetRegistry.has(faction)) {
            this.targetRegistry.set(faction, []);
        }
        
        const targets = this.targetRegistry.get(faction)!;
        
        // 防止重复注册
        if (targets.indexOf(target) === -1) {
            targets.push(target);
        }
    }
    
    /**
     * 从指定阵营中反注册目标
     * @param target 目标节点
     * @param faction 目标所属阵营
     */
    public deregisterTarget(target: Node, faction: Faction): void {
        const targets = this.targetRegistry.get(faction);
        if (!targets) {
            return;
        }
        
        const index = targets.indexOf(target);
        if (index > -1) {
            targets.splice(index, 1);
        }
    }
    
    /**
     * 查找最佳目标
     */
    public findBestTarget(myPosition: Vec3, myFaction: Faction, detectionRange: number): TargetInfo | null {
        // 【性能优化】减少调试输出频率
        const now = Date.now();
        const shouldDebug = !this.lastDebugTime || (now - this.lastDebugTime > 3000); // 每3秒输出一次详细调试信息
        
        if (shouldDebug) {
            this.lastDebugTime = now;
        }
        
        // 确定敌对阵营      
        const enemyFactions = this.getEnemyFactions(myFaction);
        
        if (enemyFactions.length === 0) {
            if (shouldDebug) {
                console.warn(`[TargetSelector] 没有敌对阵营，无法查找目标`);
            }
            return null;
        }
        
        let bestTarget: TargetInfo | null = null;
        let bestScore = -1;
        let totalTargetsChecked = 0;
        let validTargetsInRange = 0;
        
        // 遍历所有敌对阵营
        for (const enemyFaction of enemyFactions) {
            const targets = this.getTargetsByFaction(enemyFaction);
            
            for (const target of targets) {
                if (!target || !target.isValid) {
                    continue;
                }
                
                totalTargetsChecked++;
                const distance = Vec3.distance(myPosition, target.position);
                
                // 距离检查
                if (distance > detectionRange) {
                    continue;
                }
                
                validTargetsInRange++;
                
                // 生命值检查
                const characterStats = target.getComponent(CharacterStats);
                if (!characterStats || !characterStats.isAlive) {
                    continue;
                }
                
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
        
        if (shouldDebug && bestTarget) {
            console.log(`[TargetSelector] 搜索结果: 检查${totalTargetsChecked}个目标, ${validTargetsInRange}个在范围内, 最佳目标: ${bestTarget.node.name}`);
        }
        
        return bestTarget;
    }
    
    // 添加调试时间跟踪
    private lastDebugTime: number = 0;
    
    /**
     * 获取指定阵营的所有目标
     */
    public getTargetsByFaction(targetFaction: Faction): Node[] {
        const targets = this.targetRegistry.get(targetFaction);
        if (!targets) {
            return [];
        }
        
        // 清理无效的节点并返回有效的目标列表
        const validTargets = targets.filter(node => node && node.isValid);
        
        // 如果发现无效节点，更新注册表
        if (validTargets.length !== targets.length) {
            this.targetRegistry.set(targetFaction, validTargets);
            console.log(`%c[TargetSelector] 🧹 清理无效目标: ${targetFaction} (剩余: ${validTargets.length})`, 'color: gray');
        }
        
        return validTargets;
    }
    
    /**
     * 计算目标优先级
     */
    public calculateTargetPriority(target: Node, myPosition: Vec3): number {
        // 【修改】统一优先级，让选择纯粹基于距离
        return 100; // 所有目标优先级相同
    }
    
    /**
     * 获取敌对阵营列表
     */
    private getEnemyFactions(myFaction: Faction): Faction[] {
        return factionManager.getEnemyFactions(myFaction);
    }
    
    /**
     * 获取所有已注册目标的数量统计
     */
    public getRegistrationStats(): { [key: string]: number } {
        const stats: { [key: string]: number } = {};
        
        for (const [faction, targets] of this.targetRegistry) {
            stats[faction] = targets.filter(node => node && node.isValid).length;
        }
        
        return stats;
    }
    
    /**
     * 获取总的已注册目标数量
     */
    public getTotalRegisteredTargets(): number {
        let total = 0;
        for (const [, targets] of this.targetRegistry) {
            total += targets.filter(node => node && node.isValid).length;
        }
        return total;
    }
    
    /**
     * 打印当前注册状态（调试用）
     */
    public printRegistrationStatus(): void {
        console.log(`%c[TargetSelector] 📊 当前注册状态:`, 'color: cyan; font-weight: bold');
        console.log(`%c[TargetSelector] ├─ 总目标数: ${this.getTotalRegisteredTargets()}`, 'color: cyan');
        
        for (const [faction, targets] of this.targetRegistry) {
            const validTargets = targets.filter(node => node && node.isValid);
            console.log(`%c[TargetSelector] ├─ ${faction}: ${validTargets.length} 个目标`, 'color: lightblue');
            
            validTargets.forEach((target, index) => {
                const isLast = index === validTargets.length - 1;
                const prefix = isLast ? '└─' : '├─';
                console.log(`%c[TargetSelector] │  ${prefix} ${target.name} 位置: (${target.position.x.toFixed(0)}, ${target.position.y.toFixed(0)})`, 'color: lightblue');
            });
        }
    }

    /**
     * 打印注册统计简要信息
     */
    private printRegistrationSummary(): void {
        const stats = this.getRegistrationStats();
        const summaryParts: string[] = [];
        for (const faction in stats) {
            if (stats.hasOwnProperty(faction)) {
                summaryParts.push(`${faction}:${stats[faction]}`);
            }
        }
        const summary = summaryParts.join(', ');
    }
    
    /**
     * 【调试方法】手动创建一个测试目标（玩家阵营）
     */
    public createTestPlayerTarget(): Node | null {
        const testPlayerNode = new Node('TestPlayer');
        
        // 添加必要的组件
        const characterStats = testPlayerNode.addComponent('CharacterStats') as any;
        if (characterStats) {
            characterStats.maxHealth = 100;
            characterStats.currentHealth = 100;
            characterStats.isAlive = true;
        }
        
        // 设置位置（在场景中心附近）
        testPlayerNode.setPosition(100, 100, 0);
        
        // 注册为玩家阵营目标
        this.registerTarget(testPlayerNode, Faction.PLAYER);
        
        // 添加到场景
        const scene = director.getScene();
        if (scene) {
            scene.addChild(testPlayerNode);
            return testPlayerNode;
        }
        
        return null;
    }
    
    /**
     * 打印包围统计信息（基础版本-空实现）
     * @param target 目标
     * @param myFaction 我方阵营
     */
    public printSurroundStats(target: Node, myFaction: Faction): void {
        // 基础版本不支持包围系统，空实现
    }
    
    /**
     * 【调试方法】打印完整的注册表信息
     */
    public printFullRegistryInfo(): void {
        if (this.targetRegistry.size === 0) {
            return;
        }
        
        for (const [faction, targets] of this.targetRegistry) {
            const validTargets = targets.filter(node => node && node.isValid);
            const invalidCount = targets.length - validTargets.length;
        }
        
        const totalValid = this.getTotalRegisteredTargets();
    }
}

// 导出单例访问器
export const targetSelector = {
    getInstance: (): TargetSelector | null => TargetSelector.getInstance()
}; 