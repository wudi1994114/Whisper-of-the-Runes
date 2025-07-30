import { _decorator, Component, Node, Vec3, PhysicsSystem2D, ERaycast2DType, geometry, Vec2 } from 'cc';
import { ITargetSelector, TargetInfo } from '../components/MonsterAI';
import { Faction } from '../configs/FactionConfig';
import { factionManager } from '../managers/FactionManager';
import { CharacterStats } from './CharacterStats';

const { ccclass, property } = _decorator;

/**
 * 目标记忆信息
 */
interface TargetMemory {
    node: Node;
    lastSeenPosition: Vec3;
    lastSeenTime: number;
    faction: Faction;
    wasVisible: boolean;
    searchAttempts: number; // 搜索尝试次数
}

/**
 * 视线检测结果
 */
interface LineOfSightResult {
    visible: boolean;
    blockedBy?: Node;
    distance: number;
}

/**
 * 增强版目标选择器
 * 特性：
 * 1. 视线检测 - 确认目标可见性，考虑障碍物遮挡
 * 2. 记忆系统 - 记住上次看到敌人的位置并智能搜索
 * 3. 智能优先级 - 综合距离、威胁等级、血量、可见性等因素
 * 4. 威胁评估 - 基于目标的攻击力、移动速度等评估威胁
 * 5. 预测系统 - 预测移动目标的未来位置
 */
@ccclass('EnhancedTargetSelector')
export class EnhancedTargetSelector extends Component implements ITargetSelector {
    
    // 单例实例
    private static _instance: EnhancedTargetSelector | null = null;
    
    // 目标注册表：存储按阵营分类的目标节点
    private targetRegistry: Map<Faction, Node[]> = new Map();
    
    // 记忆系统：存储目标的历史信息
    private targetMemories: Map<Node, TargetMemory> = new Map();
    
    @property({
        displayName: "记忆持续时间",
        tooltip: "记住敌人位置的时间（秒）"
    })
    public memoryDuration: number = 10.0;
    
    @property({
        displayName: "视线检测距离",
        tooltip: "最远视线检测距离"
    })
    public maxLineOfSightDistance: number = 500;
    
    @property({
        displayName: "搜索区域半径",
        tooltip: "在记忆位置周围的搜索半径"
    })
    public searchRadius: number = 100;
    
    @property({
        displayName: "最大搜索尝试",
        tooltip: "在记忆位置搜索的最大次数"
    })
    public maxSearchAttempts: number = 3;
    
    // 性能优化：射线检测缓存
    private losCache: Map<string, { result: LineOfSightResult; timestamp: number }> = new Map();
    private losCacheTimeout: number = 0.5; // 射线检测缓存时间
    
    protected onLoad(): void {
        EnhancedTargetSelector._instance = this;
        console.log(`%c[EnhancedTargetSelector] 🎯 增强版目标选择器已初始化`, 'color: blue; font-weight: bold');
        
        // 定期清理过期记忆
        this.schedule(this.cleanupExpiredMemories, 2.0);
        this.schedule(this.cleanupLOSCache, 1.0);
    }
    
    protected onDestroy(): void {
        if (EnhancedTargetSelector._instance === this) {
            EnhancedTargetSelector._instance = null;
        }
        this.targetRegistry.clear();
        this.targetMemories.clear();
        this.losCache.clear();
        console.log(`%c[EnhancedTargetSelector] 🗑️ 增强版目标选择器已销毁`, 'color: orange');
    }
    
    /**
     * 获取单例实例
     */
    public static getInstance(): EnhancedTargetSelector | null {
        return EnhancedTargetSelector._instance;
    }
    
    /**
     * 注册目标到指定阵营
     */
    public registerTarget(target: Node, faction: Faction): void {
        if (!target || !target.isValid) {
            console.warn(`%c[EnhancedTargetSelector] ⚠️ 尝试注册无效的目标节点`, 'color: orange');
            return;
        }
        
        // 确保阵营列表存在
        if (!this.targetRegistry.has(faction)) {
            this.targetRegistry.set(faction, []);
            console.log(`%c[EnhancedTargetSelector] 🆕 创建阵营注册表: ${faction}`, 'color: green');
        }
        
        const targets = this.targetRegistry.get(faction)!;
        
        // 防止重复注册
        if (targets.indexOf(target) === -1) {
            targets.push(target);
            console.log(`%c[EnhancedTargetSelector] ✅ 注册目标: ${target.name} → ${faction} (总数: ${targets.length})`, 'color: green');
        }
    }
    
    /**
     * 从指定阵营中反注册目标
     */
    public deregisterTarget(target: Node, faction: Faction): void {
        const targets = this.targetRegistry.get(faction);
        if (!targets) {
            console.warn(`%c[EnhancedTargetSelector] ⚠️ 阵营不存在，无法反注册: ${faction}`, 'color: orange');
            return;
        }
        
        const index = targets.indexOf(target);
        if (index > -1) {
            targets.splice(index, 1);
            console.log(`%c[EnhancedTargetSelector] ❌ 反注册目标: ${target.name} ← ${faction} (剩余: ${targets.length})`, 'color: red');
        }
        
        // 清理相关记忆
        if (this.targetMemories.has(target)) {
            this.targetMemories.delete(target);
            console.log(`%c[EnhancedTargetSelector] 🧠 清理目标记忆: ${target.name}`, 'color: gray');
        }
    }
    
    /**
     * 查找最佳目标（增强版 - 包含视线检测和记忆系统）
     */
    public findBestTarget(myPosition: Vec3, myFaction: Faction, detectionRange: number): TargetInfo | null {
        console.log(`%c[EnhancedTargetSelector] 🎯 开始查找最佳目标`, 'color: blue');
        console.log(`%c[EnhancedTargetSelector] 📍 搜索位置: (${myPosition.x.toFixed(1)}, ${myPosition.y.toFixed(1)})`, 'color: blue');
        console.log(`%c[EnhancedTargetSelector] 🏛️ 我的阵营: ${myFaction}`, 'color: blue');
        console.log(`%c[EnhancedTargetSelector] 📏 搜索范围: ${detectionRange}`, 'color: blue');
        
        // 【调试】打印当前完整的注册表状态
        console.log(`%c[EnhancedTargetSelector] 📋 当前注册表状态:`, 'color: cyan');
        for (const [faction, targets] of this.targetRegistry) {
            const validTargets = targets.filter(node => node && node.isValid);
            console.log(`%c[EnhancedTargetSelector] 🏛️ 阵营 ${faction}: ${validTargets.length} 个目标 [${validTargets.map(t => t.name).join(', ')}]`, 'color: lightblue');
        }
        
        const enemyFactions = this.getEnemyFactions(myFaction);
        console.log(`%c[EnhancedTargetSelector] 👹 敌对阵营列表: [${enemyFactions.join(', ')}]`, 'color: orange');
        
        if (enemyFactions.length === 0) {
            console.warn(`%c[EnhancedTargetSelector] ⚠️ 没有敌对阵营，无法查找目标`, 'color: red');
            return null;
        }
        
        let bestTarget: TargetInfo | null = null;
        let bestScore = -1;
        let totalTargetsChecked = 0;
        let validTargetsInRange = 0;
        let visibleTargets = 0;
        
        console.log(`%c[EnhancedTargetSelector] 🔍 第一阶段：查找可见的活跃目标`, 'color: green');
        
        // 第一阶段：查找可见的活跃目标
        for (const enemyFaction of enemyFactions) {
            console.log(`%c[EnhancedTargetSelector] 查找阵营 ${enemyFaction} 的目标`);

            const targets = this.getTargetsByFaction(enemyFaction);
            console.log(`%c[EnhancedTargetSelector] 🏛️ 检查阵营 ${enemyFaction}: ${targets.length} 个目标`, 'color: yellow');
            
            for (const target of targets) {
                if (!target || !target.isValid) {
                    console.warn(`%c[EnhancedTargetSelector] ⚠️ 跳过无效目标节点`, 'color: orange');
                    continue;
                }
                
                totalTargetsChecked++;
                const distance = Vec3.distance(myPosition, target.position);
                
                console.log(`%c[EnhancedTargetSelector] 📍 检查目标 ${target.name}: 距离=${distance.toFixed(1)}`, 'color: gray');
                
                if (distance > detectionRange) {
                    console.log(`%c[EnhancedTargetSelector] 📏 目标 ${target.name} 超出搜索范围 (${distance.toFixed(1)} > ${detectionRange})`, 'color: gray');
                    continue;
                }
                
                validTargetsInRange++;
                
                const characterStats = target.getComponent(CharacterStats);
                if (!characterStats || !characterStats.isAlive) {
                    console.log(`%c[EnhancedTargetSelector] 💀 目标 ${target.name} 不存活或无生命值组件`, 'color: gray');
                    continue;
                }
                
                console.log(`%c[EnhancedTargetSelector] 👁️ 对目标 ${target.name} 进行视线检测...`, 'color: cyan');
                
                // 视线检测
                const losResult = this.checkLineOfSight(myPosition, target.position, target);
                
                console.log(`%c[EnhancedTargetSelector] 👁️ 目标 ${target.name} 视线检测结果: ${losResult.visible ? '可见' : '不可见'} (距离: ${losResult.distance.toFixed(1)})`, `color: ${losResult.visible ? 'green' : 'red'}`);
                
                if (losResult.visible) {
                    visibleTargets++;
                    // 更新记忆
                    this.updateTargetMemory(target, target.position, enemyFaction, true);
                    
                    // 计算增强评分
                    const score = this.calculateEnhancedTargetScore(target, myPosition, distance, losResult);
                    
                    console.log(`%c[EnhancedTargetSelector] ⭐ 可见目标 ${target.name}: 距离=${distance.toFixed(1)}, 评分=${score.toFixed(2)}`, 'color: cyan');
                    
                    if (score > bestScore) {
                        bestScore = score;
                        bestTarget = {
                            node: target,
                            position: target.position.clone(),
                            distance: distance,
                            faction: enemyFaction,
                            priority: score
                        };
                        console.log(`%c[EnhancedTargetSelector] 🏆 新的最佳目标: ${target.name} (评分: ${score.toFixed(2)})`, 'color: green');
                    }
                } else {
                    // 目标不可见，更新记忆但不选择
                    this.updateTargetMemory(target, target.position, enemyFaction, false);
                    if (losResult.blockedBy) {
                        console.log(`%c[EnhancedTargetSelector] 🚧 目标 ${target.name} 被 ${losResult.blockedBy.name} 阻挡`, 'color: orange');
                    }
                }
            }
        }
        
        console.log(`%c[EnhancedTargetSelector] 📊 第一阶段结果: 检查了${totalTargetsChecked}个目标, ${validTargetsInRange}个在范围内, ${visibleTargets}个可见, 最佳目标: ${bestTarget ? bestTarget.node.name : '无'}`, 'color: purple');
        
        // 第二阶段：如果没有找到可见目标，尝试基于记忆搜索
        if (!bestTarget) {
            console.log(`%c[EnhancedTargetSelector] 🧠 第二阶段：基于记忆搜索`, 'color: purple');
            bestTarget = this.searchBasedOnMemory(myPosition, myFaction, detectionRange);
            
            if (bestTarget) {
                console.log(`%c[EnhancedTargetSelector] 🧠 基于记忆找到目标: ${bestTarget.node.name}`, 'color: purple');
            } else {
                console.log(`%c[EnhancedTargetSelector] 🧠 基于记忆也未找到目标`, 'color: gray');
            }
        }
        
        console.log(`%c[EnhancedTargetSelector] ✅ 查找完成，最终目标: ${bestTarget ? bestTarget.node.name : '无'}`, `color: ${bestTarget ? 'green' : 'red'}`);
        
        return bestTarget;
    }
    
    /**
     * 视线检测 - 使用射线检测确认目标可见性
     */
    private checkLineOfSight(fromPos: Vec3, toPos: Vec3, target: Node): LineOfSightResult {
        const cacheKey = `${fromPos.x.toFixed(1)},${fromPos.y.toFixed(1)}-${toPos.x.toFixed(1)},${toPos.y.toFixed(1)}`;
        const currentTime = Date.now() / 1000;
        
        // 检查缓存
        const cached = this.losCache.get(cacheKey);
        if (cached && currentTime - cached.timestamp < this.losCacheTimeout) {
            return cached.result;
        }
        
        const distance = Vec3.distance(fromPos, toPos);
        
        // 距离太远直接返回不可见
        if (distance > this.maxLineOfSightDistance) {
            const result: LineOfSightResult = { visible: false, distance };
            this.losCache.set(cacheKey, { result, timestamp: currentTime });
            return result;
        }
        
        // 执行射线检测
        const startPoint = new Vec2(fromPos.x, fromPos.y);
        const endPoint = new Vec2(toPos.x, toPos.y);
        
        // 使用物理系统进行射线检测
        const results = PhysicsSystem2D.instance.raycast(startPoint, endPoint, ERaycast2DType.Closest);
        
        let visible = true;
        let blockedBy: Node | undefined;
        
        if (results.length > 0) {
            const hit = results[0];
            const hitNode = hit.collider.node;
            
            // 如果射线击中的不是目标本身，且击中物体是障碍物，则被阻挡
            if (hitNode !== target && this.isObstacle(hitNode)) {
                visible = false;
                blockedBy = hitNode;
            }
        }
        
        const result: LineOfSightResult = { visible, blockedBy, distance };
        
        // 缓存结果
        this.losCache.set(cacheKey, { result, timestamp: currentTime });
        
        return result;
    }
    
    /**
     * 判断节点是否为障碍物
     */
    private isObstacle(node: Node): boolean {
        // 检查节点名称或标签来判断是否为障碍物
        const nodeName = node.name.toLowerCase();
        
        // 常见的障碍物命名模式
        if (nodeName.includes('wall') || 
            nodeName.includes('obstacle') || 
            nodeName.includes('barrier') ||
            nodeName.includes('building') ||
            nodeName.includes('rock') ||
            nodeName.includes('tree')) {
            return true;
        }
        
        // 检查是否有静态刚体组件（通常是障碍物）
        const rigidBody = node.getComponent('RigidBody2D') as any;
        if (rigidBody && rigidBody.type === 0) { // Static类型
            return true;
        }
        
        return false;
    }
    
    /**
     * 更新目标记忆
     */
    private updateTargetMemory(target: Node, position: Vec3, faction: Faction, wasVisible: boolean): void {
        const currentTime = Date.now() / 1000;
        
        if (!this.targetMemories.has(target)) {
            this.targetMemories.set(target, {
                node: target,
                lastSeenPosition: position.clone(),
                lastSeenTime: currentTime,
                faction: faction,
                wasVisible: wasVisible,
                searchAttempts: 0
            });
        } else {
            const memory = this.targetMemories.get(target)!;
            if (wasVisible) {
                memory.lastSeenPosition.set(position);
                memory.lastSeenTime = currentTime;
                memory.searchAttempts = 0; // 重置搜索次数
            }
            memory.wasVisible = wasVisible;
        }
    }
    
    /**
     * 基于记忆进行搜索
     */
    private searchBasedOnMemory(myPosition: Vec3, myFaction: Faction, detectionRange: number): TargetInfo | null {
        const currentTime = Date.now() / 1000;
        let bestMemoryTarget: TargetInfo | null = null;
        let bestMemoryScore = -1;
        
        for (const [target, memory] of this.targetMemories) {
            // 检查记忆是否过期
            if (currentTime - memory.lastSeenTime > this.memoryDuration) {
                continue;
            }
            
            // 检查是否为敌对阵营
            const enemyFactions = this.getEnemyFactions(myFaction);
            if (enemyFactions.indexOf(memory.faction) === -1) {
                continue;
            }
            
            // 检查搜索次数
            if (memory.searchAttempts >= this.maxSearchAttempts) {
                continue;
            }
            
            const memoryDistance = Vec3.distance(myPosition, memory.lastSeenPosition);
            if (memoryDistance > detectionRange) continue;
            
            // 在记忆位置周围搜索
            const searchResult = this.searchAroundPosition(memory.lastSeenPosition, myPosition, memory.faction);
            
            if (searchResult) {
                // 增加搜索尝试次数
                memory.searchAttempts++;
                
                const score = this.calculateMemoryTargetScore(searchResult, memory, memoryDistance);
                
                if (score > bestMemoryScore) {
                    bestMemoryScore = score;
                    bestMemoryTarget = searchResult;
                }
            } else {
                // 搜索失败，增加尝试次数
                memory.searchAttempts++;
            }
        }
        
        if (bestMemoryTarget) {
            console.log(`%c[EnhancedTargetSelector] 🧠 基于记忆找到目标: ${bestMemoryTarget.node.name}`, 'color: purple');
        }
        
        return bestMemoryTarget;
    }
    
    /**
     * 在指定位置周围搜索目标
     */
    private searchAroundPosition(centerPos: Vec3, myPosition: Vec3, targetFaction: Faction): TargetInfo | null {
        const targets = this.getTargetsByFaction(targetFaction);
        
        for (const target of targets) {
            if (!target || !target.isValid) continue;
            
            const characterStats = target.getComponent(CharacterStats);
            if (!characterStats || !characterStats.isAlive) continue;
            
            const distanceFromCenter = Vec3.distance(target.position, centerPos);
            if (distanceFromCenter <= this.searchRadius) {
                // 检查视线
                const losResult = this.checkLineOfSight(myPosition, target.position, target);
                if (losResult.visible) {
                    const distance = Vec3.distance(myPosition, target.position);
                    return {
                        node: target,
                        position: target.position.clone(),
                        distance: distance,
                        faction: targetFaction,
                        priority: this.calculateEnhancedTargetScore(target, myPosition, distance, losResult)
                    };
                }
            }
        }
        
        return null;
    }
    
    /**
     * 计算增强版目标评分
     */
    private calculateEnhancedTargetScore(target: Node, myPosition: Vec3, distance: number, losResult: LineOfSightResult): number {
        let score = 100; // 基础分数
        
        const characterStats = target.getComponent(CharacterStats);
        if (characterStats) {
            // 血量因子（血量越少优先级越高）
            const healthRatio = characterStats.currentHealth / characterStats.maxHealth;
            score += (1 - healthRatio) * 100;
            
            // 威胁评估（攻击力越高威胁越大）
            const threatLevel = characterStats.baseAttack / 50; // 标准化威胁等级
            score += threatLevel * 30;
            
            // 目标类型优先级
            if (target.name.includes('player')) {
                score += 300; // 玩家最高优先级
            } else if (target.name.includes('boss')) {
                score += 150;
            } else if (target.name.includes('elite')) {
                score += 50;
            }
        }
        
        // 距离因子（距离越近分数越高）
        const distanceFactor = Math.max(0, (200 - distance) / 200);
        score *= (0.5 + distanceFactor * 0.5);
        
        // 可见性奖励
        if (losResult.visible) {
            score *= 1.2; // 可见目标获得20%奖励
        }
        
        return score;
    }
    
    /**
     * 计算记忆目标评分
     */
    private calculateMemoryTargetScore(targetInfo: TargetInfo, memory: TargetMemory, memoryDistance: number): number {
        let score = this.calculateEnhancedTargetScore(targetInfo.node, memory.lastSeenPosition, targetInfo.distance, { visible: true, distance: targetInfo.distance });
        
        // 记忆时间惩罚（记忆越旧分数越低）
        const currentTime = Date.now() / 1000;
        const memoryAge = currentTime - memory.lastSeenTime;
        const memoryFactor = Math.max(0.3, 1 - (memoryAge / this.memoryDuration));
        score *= memoryFactor;
        
        // 搜索尝试惩罚
        score *= Math.max(0.5, 1 - (memory.searchAttempts * 0.2));
        
        return score;
    }
    
    /**
     * 清理过期记忆
     */
    private cleanupExpiredMemories(): void {
        const currentTime = Date.now() / 1000;
        const expiredTargets: Node[] = [];
        
        for (const [target, memory] of this.targetMemories) {
            if (currentTime - memory.lastSeenTime > this.memoryDuration || 
                !target.isValid ||
                memory.searchAttempts >= this.maxSearchAttempts) {
                expiredTargets.push(target);
            }
        }
        
        for (const target of expiredTargets) {
            this.targetMemories.delete(target);
        }
        
        if (expiredTargets.length > 0) {
            console.log(`%c[EnhancedTargetSelector] 🧹 清理过期记忆: ${expiredTargets.length} 个`, 'color: gray');
        }
    }
    
    /**
     * 清理视线检测缓存
     */
    private cleanupLOSCache(): void {
        const currentTime = Date.now() / 1000;
        const expiredKeys: string[] = [];
        
        for (const [key, cached] of this.losCache) {
            if (currentTime - cached.timestamp > this.losCacheTimeout) {
                expiredKeys.push(key);
            }
        }
        
        for (const key of expiredKeys) {
            this.losCache.delete(key);
        }
    }
    
    /**
     * 获取指定阵营的所有目标
     */
    public getTargetsByFaction(targetFaction: Faction): Node[] {
        const targets = this.targetRegistry.get(targetFaction);
        if (!targets) {
            return [];
        }
        
        const validTargets = targets.filter(node => node && node.isValid);
        
        if (validTargets.length !== targets.length) {
            this.targetRegistry.set(targetFaction, validTargets);
        }
        
        return validTargets;
    }
    
    /**
     * 计算目标优先级（兼容接口）
     */
    public calculateTargetPriority(target: Node, myPosition: Vec3): number {
        const distance = Vec3.distance(myPosition, target.position);
        const losResult = this.checkLineOfSight(myPosition, target.position, target);
        return this.calculateEnhancedTargetScore(target, myPosition, distance, losResult);
    }
    
    /**
     * 获取敌对阵营列表
     */
    private getEnemyFactions(myFaction: Faction): Faction[] {
        return factionManager.getEnemyFactions(myFaction);
    }
    
    /**
     * 获取记忆统计信息
     */
    public getMemoryStats(): { totalMemories: number; activeMemories: number; averageAge: number } {
        const currentTime = Date.now() / 1000;
        let totalAge = 0;
        let activeCount = 0;
        
        for (const [, memory] of this.targetMemories) {
            const age = currentTime - memory.lastSeenTime;
            totalAge += age;
            if (age < this.memoryDuration && memory.searchAttempts < this.maxSearchAttempts) {
                activeCount++;
            }
        }
        
        return {
            totalMemories: this.targetMemories.size,
            activeMemories: activeCount,
            averageAge: this.targetMemories.size > 0 ? totalAge / this.targetMemories.size : 0
        };
    }
    
    /**
     * 打印调试信息
     */
    public printDebugInfo(): void {
        console.log(`%c[EnhancedTargetSelector] 📊 增强版目标选择器状态:`, 'color: cyan; font-weight: bold');
        
        const memoryStats = this.getMemoryStats();
        console.log(`%c[EnhancedTargetSelector] 🧠 记忆统计: 总记忆=${memoryStats.totalMemories}, 活跃=${memoryStats.activeMemories}, 平均年龄=${memoryStats.averageAge.toFixed(1)}s`, 'color: purple');
        
        console.log(`%c[EnhancedTargetSelector] 👁️ 视线缓存: ${this.losCache.size} 条记录`, 'color: blue');
        
        for (const [faction, targets] of this.targetRegistry) {
            const validTargets = targets.filter(node => node && node.isValid);
            console.log(`%c[EnhancedTargetSelector] ├─ ${faction}: ${validTargets.length} 个目标`, 'color: lightblue');
        }
    }
}

// 导出单例访问器
export const enhancedTargetSelector = {
    getInstance: (): EnhancedTargetSelector | null => EnhancedTargetSelector.getInstance()
}; 