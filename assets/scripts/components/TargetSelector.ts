// assets/scripts/core/TargetSelector.ts

import { _decorator, Component, Node, Vec3, director } from 'cc';
import { ITargetSelector, TargetInfo } from './MonsterAI';
import { Faction } from '../configs/FactionConfig';
import { factionManager } from '../managers/FactionManager';
import { CharacterStats } from './CharacterStats';

const { ccclass, property } = _decorator;

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
            console.log(`%c[TARGET_DEBUG] ⚠️ 尝试注册无效的目标节点`, 'color: orange');
            return;
        }
        
        // 确保阵营列表存在
        if (!this.targetRegistry.has(faction)) {
            this.targetRegistry.set(faction, []);
            console.log(`%c[TARGET_DEBUG] 🆕 创建阵营注册表: ${faction}`, 'color: green');
        }
        
        const targets = this.targetRegistry.get(faction)!;
        
        // 防止重复注册
        if (targets.indexOf(target) === -1) {
            targets.push(target);
            console.log(`%c[TARGET_DEBUG] ✅ 注册目标成功: ${target.name} → ${faction} (该阵营总数: ${targets.length})`, 'color: green');
            
            // 打印当前注册统计
            this.printRegistrationSummary();
        } else {
            console.log(`%c[TARGET_DEBUG] ⚠️ 目标已存在，跳过重复注册: ${target.name} → ${faction}`, 'color: orange');
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
            console.log(`%c[TARGET_DEBUG] ⚠️ 阵营不存在，无法反注册: ${faction}`, 'color: orange');
            return;
        }
        
        const index = targets.indexOf(target);
        if (index > -1) {
            targets.splice(index, 1);
            console.log(`%c[TARGET_DEBUG] ❌ 反注册目标成功: ${target.name} ← ${faction} (该阵营剩余: ${targets.length})`, 'color: red');
            
            // 打印当前注册统计
            this.printRegistrationSummary();
            
            // 如果该阵营没有目标了，可以选择清理注册表（可选）
            if (targets.length === 0) {
                console.log(`%c[TARGET_DEBUG] 🧹 阵营 ${faction} 已无目标，保留空列表`, 'color: gray');
            }
        } else {
            console.log(`%c[TARGET_DEBUG] ⚠️ 目标不在注册表中，无法反注册: ${target.name} ← ${faction}`, 'color: orange');
        }
    }
    
    /**
     * 查找最佳目标
     */
    public findBestTarget(myPosition: Vec3, myFaction: Faction, detectionRange: number): TargetInfo | null {
        console.log(`%c[TARGET_DEBUG] 🎯 TargetSelector开始查找目标 - 我的阵营: ${myFaction}, 搜索范围: ${detectionRange}`, 'color: purple');
        
        // 【调试】打印当前完整的注册表状态
        console.log(`%c[TARGET_DEBUG] 📋 当前注册表状态:`, 'color: purple');
        for (const [faction, targets] of this.targetRegistry) {
            const validTargets = targets.filter(node => node && node.isValid);
            console.log(`%c[TARGET_DEBUG] 🏛️ 阵营 ${faction}: ${validTargets.length} 个目标 [${validTargets.map(t => t.name).join(', ')}]`, 'color: purple');
        }
        
        // 确定敌对阵营      
        const enemyFactions = this.getEnemyFactions(myFaction);
        console.log(`%c[TARGET_DEBUG] 👹 敌对阵营列表: [${enemyFactions.join(', ')}]`, 'color: purple');
        
        if (enemyFactions.length === 0) {
            console.log(`%c[TARGET_DEBUG] ⚠️ 没有敌对阵营，无法查找目标`, 'color: orange');
            return null;
        }
        
        // 移除频繁的调试日志
        let bestTarget: TargetInfo | null = null;
        let bestScore = -1;
        let totalTargetsChecked = 0;
        let validTargetsInRange = 0;
        
        // 遍历所有敌对阵营
        for (const enemyFaction of enemyFactions) {
            const targets = this.getTargetsByFaction(enemyFaction);
            console.log(`%c[TARGET_DEBUG] 🏛️ 阵营 ${enemyFaction} 有 ${targets.length} 个注册目标`, 'color: blue');
            
            for (const target of targets) {
                if (!target || !target.isValid) {
                    console.log(`%c[TARGET_DEBUG] ⚠️ 跳过无效目标节点`, 'color: orange');
                    continue;
                }
                
                totalTargetsChecked++;
                const distance = Vec3.distance(myPosition, target.position);
                
                // 距离检查
                if (distance > detectionRange) {
                    console.log(`%c[TARGET_DEBUG] 📏 目标 ${target.name} 超出范围 (${distance.toFixed(1)} > ${detectionRange})`, 'color: gray');
                    continue;
                }
                
                validTargetsInRange++;
                
                // 生命值检查
                const characterStats = target.getComponent(CharacterStats);
                if (!characterStats || !characterStats.isAlive) {
                    console.log(`%c[TARGET_DEBUG] 💀 目标 ${target.name} 不存活或无生命值组件`, 'color: gray');
                    continue;
                }
                
                // 计算目标评分
                const priority = this.calculateTargetPriority(target, myPosition);
                const score = priority / (distance + 1); // 距离越近，优先级越高
                
                console.log(`%c[TARGET_DEBUG] ⭐ 候选目标 ${target.name}: 距离=${distance.toFixed(1)}, 优先级=${priority.toFixed(1)}, 评分=${score.toFixed(2)}`, 'color: cyan');
                
                if (score > bestScore) {
                    bestScore = score;
                    bestTarget = {
                        node: target,
                        position: target.position.clone(),
                        distance: distance,
                        faction: enemyFaction,
                        priority: priority
                    };
                    console.log(`%c[TARGET_DEBUG] 🏆 新的最佳目标: ${target.name} (评分: ${score.toFixed(2)})`, 'color: green');
                }
            }
        }
        
        console.log(`%c[TARGET_DEBUG] 📊 搜索结果: 检查了${totalTargetsChecked}个目标, ${validTargetsInRange}个在范围内, 最佳目标: ${bestTarget ? bestTarget.node.name : '无'}`, 'color: purple');
        
        return bestTarget;
    }
    
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
        console.log(`%c[TARGET_DEBUG] 📊 当前注册统计: ${summary}`, 'color: lightblue');
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
            console.log(`%c[TARGET_DEBUG] 🎮 已创建测试玩家目标: ${testPlayerNode.name} (阵营: ${Faction.PLAYER})`, 'color: green; font-weight: bold');
            return testPlayerNode;
        }
        
        return null;
    }
    
    /**
     * 【调试方法】打印完整的注册表信息
     */
    public printFullRegistryInfo(): void {
        console.log(`%c[TARGET_DEBUG] 📋 完整注册表信息:`, 'color: cyan; font-weight: bold');
        
        if (this.targetRegistry.size === 0) {
            console.log(`%c[TARGET_DEBUG] ❌ 注册表为空，没有任何目标注册`, 'color: red');
            return;
        }
        
        for (const [faction, targets] of this.targetRegistry) {
            const validTargets = targets.filter(node => node && node.isValid);
            const invalidCount = targets.length - validTargets.length;
            
            console.log(`%c[TARGET_DEBUG] 🏛️ 阵营 ${faction}:`, 'color: cyan');
            console.log(`%c[TARGET_DEBUG]   - 有效目标: ${validTargets.length} 个`, 'color: cyan');
            console.log(`%c[TARGET_DEBUG]   - 无效目标: ${invalidCount} 个`, 'color: orange');
            
            validTargets.forEach((target, index) => {
                const pos = target.position;
                const characterStats = target.getComponent('CharacterStats') as any;
                const isAlive = characterStats ? characterStats.isAlive : '未知';
                console.log(`%c[TARGET_DEBUG]   [${index + 1}] ${target.name} 位置:(${pos.x.toFixed(0)},${pos.y.toFixed(0)}) 存活:${isAlive}`, 'color: lightblue');
            });
        }
        
        const totalValid = this.getTotalRegisteredTargets();
        console.log(`%c[TARGET_DEBUG] 📊 总计有效目标数: ${totalValid}`, 'color: cyan; font-weight: bold');
    }
}

// 导出单例访问器
export const targetSelector = {
    getInstance: (): TargetSelector | null => TargetSelector.getInstance()
}; 