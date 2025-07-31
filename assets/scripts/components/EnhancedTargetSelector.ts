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
    
    // 目标锁定系统：确保1对1对战
    private targetLocks: Map<Node, { attacker: Node; lockTime: number }> = new Map();
    private attackerLocks: Map<Node, Node> = new Map(); // 攻击者 -> 目标的反向映射
    
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
    
    @property({
        displayName: "对战状态检测范围",
        tooltip: "检测目标周围多远范围内是否有敌人（对战状态判断）"
    })
    public combatDetectionRange: number = 150;
    
    @property({
        displayName: "对战优先级惩罚",
        tooltip: "正在对战的目标优先级降低倍数（0.1=降低90%）"
    })
    public combatPriorityPenalty: number = 0.3;
    
    @property({
        displayName: "启用对战状态检测",
        tooltip: "是否启用对战状态检测和优先级调整"
    })
    public enableCombatDetection: boolean = true;
    
    @property({
        displayName: "友军阻挡视线",
        tooltip: "友军单位是否会阻挡对敌人的视线检测"
    })
    public alliesBlockLineOfSight: boolean = false;
    
    @property({
        displayName: "敌军阻挡视线", 
        tooltip: "敌军单位是否会阻挡视线检测"
    })
    public enemiesBlockLineOfSight: boolean = true;
    
    @property({
        displayName: "启用1对1对战锁定",
        tooltip: "确保每个敌人只被一个我方单位作为主要攻击目标"
    })
    public enableOneVsOneCombat: boolean = true;
    
    @property({
        displayName: "启用包围系统",
        tooltip: "启用轻量级包围系统，实现自然的包围效果"
    })
    public enableSurroundSystem: boolean = true;
    
    @property({
        displayName: "扇形拥挤惩罚",
        tooltip: "同一扇形内怪物过多时的优先级惩罚倍数"
    })
    public sectorCrowdingPenalty: number = 0.2; // 更强的惩罚
    
    @property({
        displayName: "包围奖励",
        tooltip: "填补包围空缺时的优先级奖励倍数"
    })
    public surroundBonus: number = 2.0; // 更强的奖励
    
    @property({
        displayName: "扇形拥挤阈值",
        tooltip: "扇形内多少个单位算作拥挤"
    })
    public sectorCrowdingThreshold: number = 1; // 更敏感的拥挤检测
    
    @property({
        displayName: "锁定双方优先级惩罚",
        tooltip: "正在锁定对战的双方优先级降低倍数（0.1=降低90%）"
    })
    public lockedPairPriorityPenalty: number = 0.2;
    
    // 性能优化：射线检测缓存
    private losCache: Map<string, { result: LineOfSightResult; timestamp: number }> = new Map();
    // 【性能优化】增加缓存时间从0.5秒到1.5秒，显著减少射线检测频率
    private losCacheTimeout: number = 1.5; // 射线检测缓存时间
    
    protected onLoad(): void {
        EnhancedTargetSelector._instance = this;
        // 定期清理过期记忆
        this.schedule(this.cleanupExpiredMemories, 2.0);
        this.schedule(this.cleanupLOSCache, 1.0);
        // 定期清理过期的目标锁定
        this.schedule(this.cleanupExpiredTargetLocks, 1.0);
    }
    
    protected onDestroy(): void {
        if (EnhancedTargetSelector._instance === this) {
            EnhancedTargetSelector._instance = null;
        }
        this.targetRegistry.clear();
        this.targetMemories.clear();
        this.losCache.clear();
        this.targetLocks.clear();
        this.attackerLocks.clear();
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
        
        const enemyFactions = this.getEnemyFactions(myFaction);
        
        if (enemyFactions.length === 0) {
            console.warn(`%c[EnhancedTargetSelector] ⚠️ 没有敌对阵营，无法查找目标`, 'color: red');
            return null;
        }
        
        let bestTarget: TargetInfo | null = null;
        let bestScore = -1;
        let totalTargetsChecked = 0;
        let validTargetsInRange = 0;
        let visibleTargets = 0;
        
        // 第一阶段：查找可见的活跃目标
        for (const enemyFaction of enemyFactions) {

            const targets = this.getTargetsByFaction(enemyFaction);
            
            for (const target of targets) {
                if (!target || !target.isValid) {
                    console.warn(`%c[EnhancedTargetSelector] ⚠️ 跳过无效目标节点`, 'color: orange');
                    continue;
                }
                
                totalTargetsChecked++;
                const distance = Vec3.distance(myPosition, target.position);
                
                if (distance > detectionRange) {
                    continue;
                }
                
                validTargetsInRange++;
                
                const characterStats = target.getComponent(CharacterStats);
                if (!characterStats || !characterStats.isAlive) {
                    console.log(`%c[EnhancedTargetSelector] 💀 目标 ${target.name} 不存活或无生命值组件`, 'color: gray');
                    continue;
                }
                
                // 视线检测
                const losResult = this.checkLineOfSight(myPosition, target.position, target, myFaction);
                
                if (losResult.visible) {
                    visibleTargets++;
                    // 更新记忆
                    this.updateTargetMemory(target, target.position, enemyFaction, true);
                    
                    // 计算增强评分
                    const score = this.calculateEnhancedTargetScore(target, myPosition, distance, losResult, myFaction);
                    
                    if (score > bestScore) {
                        bestScore = score;
                        bestTarget = {
                            node: target,
                            position: target.position.clone(),
                            distance: distance,
                            faction: enemyFaction,
                            priority: score
                        };
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
        
        // 第二阶段：如果没有找到可见目标，尝试基于记忆搜索
        if (!bestTarget) {
            bestTarget = this.searchBasedOnMemory(myPosition, myFaction, detectionRange);
            
            if (bestTarget) {
                console.log(`%c[EnhancedTargetSelector] 🧠 基于记忆找到目标: ${bestTarget.node.name}`, 'color: purple');
            } else {
                console.log(`%c[EnhancedTargetSelector] 🧠 基于记忆也未找到目标`, 'color: gray');
            }
        }
        
        // 【新增】打印包围统计信息
        if (bestTarget && this.enableSurroundSystem) {
            this.printSurroundStats(bestTarget.node, myFaction);
        }
        
        return bestTarget;
    }
    
    /**
     * 视线检测 - 使用射线检测确认目标可见性
     */
    private checkLineOfSight(fromPos: Vec3, toPos: Vec3, target: Node, myFaction?: Faction): LineOfSightResult {
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
            if (hitNode !== target && this.isObstacle(hitNode, myFaction)) {
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
     * @param node 要检查的节点
     * @param myFaction 检测者的阵营（可选，用于判断友军/敌军关系）
     */
    private isObstacle(node: Node, myFaction?: Faction): boolean {
        // 1. 检查传统障碍物（地形、建筑等）
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
        
        // 2. 检查角色单位是否阻挡视线
        if (myFaction) {
            const character = node.getComponent('BaseCharacterDemo') as any;
            if (character) {
                // 获取该角色的阵营
                const characterFaction = character.getFaction?.();
                if (characterFaction) {
                    const enemyFactions = this.getEnemyFactions(myFaction);
                    const isEnemy = enemyFactions.indexOf(characterFaction) !== -1;
                    const isAlly = characterFaction === myFaction;
                    
                    // 根据配置决定友军/敌军是否阻挡视线
                    if (isAlly && this.alliesBlockLineOfSight) {
                        console.log(`%c[EnhancedTargetSelector] 👥 友军单位 ${node.name} 阻挡视线`, 'color: blue');
                        return true;
                    }
                    
                    if (isEnemy && this.enemiesBlockLineOfSight) {
                        console.log(`%c[EnhancedTargetSelector] 👹 敌军单位 ${node.name} 阻挡视线`, 'color: red');
                        return true;
                    }
                }
            }
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
            const searchResult = this.searchAroundPosition(memory.lastSeenPosition, myPosition, memory.faction, myFaction);
            
            if (searchResult) {
                // 增加搜索尝试次数
                memory.searchAttempts++;
                
                const score = this.calculateMemoryTargetScore(searchResult, memory, memoryDistance, myFaction);
                
                if (score > bestMemoryScore) {
                    bestMemoryScore = score;
                    bestMemoryTarget = searchResult;
                }
            } else {
                // 搜索失败，增加尝试次数
                memory.searchAttempts++;
            }
        }
        
        return bestMemoryTarget;
    }
    
    /**
     * 在指定位置周围搜索目标
     */
    private searchAroundPosition(centerPos: Vec3, myPosition: Vec3, targetFaction: Faction, myFaction?: Faction): TargetInfo | null {
        const targets = this.getTargetsByFaction(targetFaction);
        
        for (const target of targets) {
            if (!target || !target.isValid) continue;
            
            const characterStats = target.getComponent(CharacterStats);
            if (!characterStats || !characterStats.isAlive) continue;
            
            const distanceFromCenter = Vec3.distance(target.position, centerPos);
            if (distanceFromCenter <= this.searchRadius) {
                // 检查视线
                const losResult = this.checkLineOfSight(myPosition, target.position, target, myFaction);
                if (losResult.visible) {
                    const distance = Vec3.distance(myPosition, target.position);
                    return {
                        node: target,
                        position: target.position.clone(),
                        distance: distance,
                        faction: targetFaction,
                                                    priority: this.calculateEnhancedTargetScore(target, myPosition, distance, losResult, myFaction)
                    };
                }
            }
        }
        
        return null;
    }
    
    /**
     * 清理死亡的目标锁定（死锁机制：只有死亡才释放）
     */
    private cleanupExpiredTargetLocks(): void {
        const expiredTargets: Node[] = [];
        
        for (const [target, lockInfo] of this.targetLocks) {
            let shouldRelease = false;
            let releaseReason = '';
            
            // 检查节点有效性
            if (!target.isValid || !lockInfo.attacker.isValid) {
                shouldRelease = true;
                releaseReason = '节点无效';
            } else {
                // 检查目标是否死亡
                const targetStats = target.getComponent('CharacterStats') as any;
                if (targetStats && !targetStats.isAlive) {
                    shouldRelease = true;
                    releaseReason = '目标死亡';
                }
                
                // 检查攻击者是否死亡
                const attackerStats = lockInfo.attacker.getComponent('CharacterStats') as any;
                if (attackerStats && !attackerStats.isAlive) {
                    shouldRelease = true;
                    releaseReason = '攻击者死亡';
                }
            }
            
            if (shouldRelease) {
                console.log(`%c[EnhancedTargetSelector] ⚰️ 死锁释放: ${lockInfo.attacker.name} vs ${target.name} (${releaseReason})`, 'color: red');
                expiredTargets.push(target);
            }
        }
        
        for (const target of expiredTargets) {
            this.releaseTargetLock(target);
        }
    }
    
    /**
     * 锁定目标（1对1对战）
     * @param target 要锁定的目标
     * @param attacker 攻击者
     * @returns 是否成功锁定
     */
    public lockTarget(target: Node, attacker: Node): boolean {
        if (!this.enableOneVsOneCombat) {
            return true; // 如果未启用1对1，总是允许
        }
        
        const currentTime = Date.now() / 1000;
        
        // 检查目标是否已被其他单位锁定
        const existingLock = this.targetLocks.get(target);
        if (existingLock && existingLock.attacker !== attacker) {
            // 死锁机制：检查锁定是否仍然有效（只有死亡才释放）
            let lockStillValid = true;
            
            if (!existingLock.attacker.isValid) {
                lockStillValid = false;
            } else {
                const attackerStats = existingLock.attacker.getComponent('CharacterStats') as any;
                if (attackerStats && !attackerStats.isAlive) {
                    lockStillValid = false;
                }
            }
            
            if (lockStillValid) {
                console.log(`%c[EnhancedTargetSelector] 🔒 目标 ${target.name} 已被 ${existingLock.attacker.name} 死锁中`, 'color: orange');
                return false;
            } else {
                // 攻击者已死亡，释放旧锁定
                console.log(`%c[EnhancedTargetSelector] ⚰️ 原攻击者已死亡，释放锁定: ${target.name}`, 'color: red');
                this.releaseTargetLock(target);
            }
        }
        
        // 释放攻击者的旧锁定
        this.releaseAttackerLock(attacker);
        
        // 创建新锁定
        this.targetLocks.set(target, { attacker, lockTime: currentTime });
        this.attackerLocks.set(attacker, target);
        
        console.log(`%c[EnhancedTargetSelector] 🎯 ${attacker.name} 锁定目标 ${target.name}`, 'color: green');
        return true;
    }
    
    /**
     * 释放目标锁定
     * @param target 要释放的目标
     */
    public releaseTargetLock(target: Node): void {
        const lockInfo = this.targetLocks.get(target);
        if (lockInfo) {
            this.attackerLocks.delete(lockInfo.attacker);
            this.targetLocks.delete(target);
            console.log(`%c[EnhancedTargetSelector] 🔓 释放目标锁定: ${target.name}`, 'color: gray');
        }
    }
    
    /**
     * 释放攻击者的锁定
     * @param attacker 攻击者
     */
    public releaseAttackerLock(attacker: Node): void {
        const lockedTarget = this.attackerLocks.get(attacker);
        if (lockedTarget) {
            this.targetLocks.delete(lockedTarget);
            this.attackerLocks.delete(attacker);
            console.log(`%c[EnhancedTargetSelector] 🔓 ${attacker.name} 释放目标锁定`, 'color: gray');
        }
    }
    
    /**
     * 检查目标是否被锁定
     * @param target 目标
     * @param attacker 攻击者（可选，如果提供则检查是否被此攻击者锁定）
     * @returns 是否被锁定
     */
    public isTargetLocked(target: Node, attacker?: Node): boolean {
        if (!this.enableOneVsOneCombat) {
            return false;
        }
        
        const lockInfo = this.targetLocks.get(target);
        if (!lockInfo) {
            return false;
        }
        
        // 死锁机制：检查锁定是否仍然有效（只有死亡才释放）
        if (!lockInfo.attacker.isValid) {
            this.releaseTargetLock(target);
            return false;
        }
        
        const attackerStats = lockInfo.attacker.getComponent('CharacterStats') as any;
        if (attackerStats && !attackerStats.isAlive) {
            this.releaseTargetLock(target);
            return false;
        }
        
        const targetStats = target.getComponent('CharacterStats') as any;
        if (targetStats && !targetStats.isAlive) {
            this.releaseTargetLock(target);
            return false;
        }
        
        if (attacker) {
            return lockInfo.attacker === attacker;
        }
        
        return true;
    }
    
    /**
     * 轻量级包围系统：获取攻击者相对目标的扇形ID
     * @param attackerPos 攻击者位置
     * @param targetPos 目标位置  
     * @returns 扇形ID (0-7)
     */
    private getSector(attackerPos: Vec3, targetPos: Vec3): number {
        const dx = attackerPos.x - targetPos.x;
        const dy = attackerPos.y - targetPos.y;
        const angle = Math.atan2(dy, dx);
        // 将角度转换为0-7的扇形ID（8个扇形，每个45度）
        return Math.floor((angle + Math.PI + Math.PI / 8) / (Math.PI / 4)) % 8;
    }
    
    /**
     * 统计目标周围各扇形的攻击者数量
     * @param target 目标
     * @param myFaction 我方阵营
     * @returns 8个扇形的攻击者数量数组
     */
    private getSectorCounts(target: Node, myFaction: Faction): number[] {
        const counts = new Array(8).fill(0);
        
        if (!this.enableSurroundSystem) {
            return counts;
        }
        
        // 获取我方所有单位 - 扫描场景中的所有角色
        const myUnits = this.getAllMyFactionUnits(myFaction);
        
        for (const unit of myUnits) {
            if (!unit || !unit.isValid) continue;
            
            // 检查该单位是否正在攻击这个目标
            const character = unit.getComponent('BaseCharacterDemo') as any;
            if (character && character.currentTarget === target) {
                const sector = this.getSector(unit.position, target.position);
                counts[sector]++;
            }
        }
        
        return counts;
    }
    
    // 【新增】缓存我方单位列表以提高性能
    private myFactionUnitsCache: Node[] = [];
    private myFactionCacheTime: number = 0;
    private readonly FACTION_CACHE_DURATION: number = 0.5; // 缓存0.5秒
    
    /**
     * 获取场景中所有我方单位（带缓存）
     * @param myFaction 我方阵营
     * @returns 我方单位列表
     */
    private getAllMyFactionUnits(myFaction: Faction): Node[] {
        const now = Date.now() / 1000; // 转换为秒
        
        // 如果缓存还有效，直接返回缓存
        if (now - this.myFactionCacheTime < this.FACTION_CACHE_DURATION && this.myFactionUnitsCache.length > 0) {
            return this.myFactionUnitsCache.filter(unit => unit && unit.isValid);
        }
        
        const myUnits: Node[] = [];
        
        // 从场景根节点开始遍历所有节点
        const scene = this.node.scene;
        if (!scene) return myUnits;
        
        this.searchMyFactionUnitsRecursive(scene, myFaction, myUnits);
        
        // 更新缓存
        this.myFactionUnitsCache = myUnits;
        this.myFactionCacheTime = now;
        
        console.log(`%c[包围系统] 扫描到 ${myUnits.length} 个我方单位`, 'color: orange');
        
        return myUnits;
    }
    
    /**
     * 递归搜索我方单位
     * @param node 当前节点
     * @param myFaction 我方阵营  
     * @param results 结果数组
     */
    private searchMyFactionUnitsRecursive(node: Node, myFaction: Faction, results: Node[]): void {
        // 检查当前节点是否是我方单位
        const character = node.getComponent('BaseCharacterDemo') as any;
        if (character && character.getFaction) {
            const unitFaction = character.getFaction();
            if (unitFaction === myFaction) {
                results.push(node);
            }
        }
        
        // 递归检查子节点
        for (let i = 0; i < node.children.length; i++) {
            this.searchMyFactionUnitsRecursive(node.children[i], myFaction, results);
        }
    }
    
    /**
     * 根据包围情况调整目标优先级
     * @param baseScore 基础评分
     * @param attackerPos 攻击者位置  
     * @param target 目标
     * @param myFaction 我方阵营
     * @returns 调整后的评分
     */
    private adjustScoreForSurround(baseScore: number, attackerPos: Vec3, target: Node, myFaction: Faction): number {
        if (!this.enableSurroundSystem) {
            return baseScore;
        }
        
        const mySector = this.getSector(attackerPos, target.position);
        const sectorCounts = this.getSectorCounts(target, myFaction);
        const myCount = sectorCounts[mySector];
        
        let adjustedScore = baseScore;
        let reason = '';
        
        // 检查当前扇形是否拥挤
        if (myCount >= this.sectorCrowdingThreshold) {
            adjustedScore *= this.sectorCrowdingPenalty;
            reason = `扇形${mySector}拥挤(${myCount}个单位)`;
        } else {
            // 检查相邻扇形，鼓励填补空缺
            const leftSector = (mySector + 7) % 8;
            const rightSector = (mySector + 1) % 8;
            const oppositeSector = (mySector + 4) % 8;
            
            // 相邻扇形有空缺，提高优先级
            if (sectorCounts[leftSector] === 0 || sectorCounts[rightSector] === 0) {
                adjustedScore *= this.surroundBonus;
                reason = `填补包围空缺(相邻扇形)`;
            }
            // 对面扇形空缺，也给予一定奖励
            else if (sectorCounts[oppositeSector] === 0) {
                adjustedScore *= (this.surroundBonus * 0.8);
                reason = `填补对面空缺`;
            }
        }
        
        // 输出调试信息
        if (reason) {
            const percentage = (adjustedScore / baseScore * 100).toFixed(0);
            const arrow = adjustedScore > baseScore ? '↗️' : '↘️';
            console.log(`%c[包围系统] ${target.name} 扇形${mySector}: ${reason} ${arrow} 优先级${percentage}%`, 'color: teal; font-weight: bold');
        }
        
        return adjustedScore;
    }
    
    /**
     * 获取包围统计信息（调试用）
     * @param target 目标
     * @param myFaction 我方阵营
     */
    public printSurroundStats(target: Node, myFaction: Faction): void {
        if (!this.enableSurroundSystem) return;
        
        const sectorCounts = this.getSectorCounts(target, myFaction);
        const totalAttackers = sectorCounts.reduce((sum, count) => sum + count, 0);
        
        if (totalAttackers > 0) {
            const sectorNames = ['东', '东北', '北', '西北', '西', '西南', '南', '东南'];
            const distribution = sectorCounts.map((count, index) => 
                count > 0 ? `${sectorNames[index]}:${count}` : null
            ).filter(Boolean).join(', ');
            
            // 找出空缺的扇形
            const emptySectors = sectorCounts.map((count, index) => 
                count === 0 ? sectorNames[index] : null
            ).filter(Boolean);
            
            const emptyInfo = emptySectors.length > 0 ? ` | 空缺: ${emptySectors.join(', ')}` : ' | 包围完成! 🎯';
            
            console.log(`%c[包围系统] 目标 ${target.name} 包围情况: ${distribution} (共${totalAttackers}个攻击者)${emptyInfo}`, 'color: teal; font-weight: bold');
            
            // 显示包围密度
            const density = (totalAttackers / 8 * 100).toFixed(0);
            console.log(`%c[包围系统] 包围密度: ${density}% (${totalAttackers}/8个扇形被占用)`, 'color: teal');
        } else {
            console.log(`%c[包围系统] 目标 ${target.name} 当前无攻击者`, 'color: gray');
        }
    }
    
    /**
     * 检查攻击者是否正在锁定其他目标
     * @param attacker 攻击者
     * @returns 是否正在锁定其他目标
     */
    public isAttackerLocked(attacker: Node): boolean {
        if (!this.enableOneVsOneCombat) {
            return false;
        }
        
        const lockedTarget = this.attackerLocks.get(attacker);
        if (!lockedTarget) {
            return false;
        }
        
        // 检查锁定是否仍然有效
        return this.isTargetLocked(lockedTarget, attacker);
    }
    
    /**
     * 检测目标是否正在与我方进行对战（改进版 - 支持1对1锁定）
     * @param target 要检测的目标
     * @param myFaction 我方阵营
     * @param attacker 攻击者（可选，用于1对1检测）
     * @returns 是否正在对战
     */
    private isTargetInCombat(target: Node, myFaction: Faction, attacker?: Node): boolean {
        if (!this.enableCombatDetection) {
            return false;
        }
        
        // 【新增】1对1锁定检测 - 优先级最高
        if (this.enableOneVsOneCombat) {
            const isLocked = this.isTargetLocked(target, attacker);
            if (isLocked && attacker) {
                // 目标被当前攻击者锁定，不算在对战中（允许当前攻击者继续攻击）
                return false;
            } else if (this.isTargetLocked(target)) {
                // 目标被其他单位锁定，算作在对战中
                const lockInfo = this.targetLocks.get(target);
                if (lockInfo) {
                    console.log(`%c[EnhancedTargetSelector] 🔒 目标 ${target.name} 被 ${lockInfo.attacker.name} 锁定中`, 'color: orange');
                    return true;
                }
            }
        }
        
        const targetCharacter = target.getComponent('BaseCharacterDemo') as any;
        if (!targetCharacter) {
            return false;
        }
        
        // 1. 检查目标当前状态
        const targetStateMachine = targetCharacter.stateMachine;
        if (targetStateMachine) {
            const currentState = targetStateMachine.getCurrentState?.();
            if (currentState === 'attacking') {
                console.log(`%c[EnhancedTargetSelector] ⚔️ 目标 ${target.name} 正在攻击状态`, 'color: orange');
                return true;
            }
        }
        
        // 2. 检查目标是否有当前攻击目标
        const targetCurrentTarget = targetCharacter.currentTarget;
        if (targetCurrentTarget) {
            const targetTargetCharacter = targetCurrentTarget.getComponent('BaseCharacterDemo') as any;
            if (targetTargetCharacter) {
                const targetTargetFaction = targetTargetCharacter.getFaction?.();
                // 如果目标的攻击目标是我方阵营，说明正在与我方对战
                if (targetTargetFaction === myFaction) {
                    console.log(`%c[EnhancedTargetSelector] ⚔️ 目标 ${target.name} 正在攻击我方单位 ${targetCurrentTarget.name}`, 'color: orange');
                    return true;
                }
            }
        }
        
        // 3. 检查目标周围是否有我方单位正在攻击它（排除当前攻击者）
        const myFactionTargets = this.getTargetsByFaction(myFaction);
        for (const allyTarget of myFactionTargets) {
            if (!allyTarget || !allyTarget.isValid) continue;
            if (attacker && allyTarget === attacker) continue; // 排除当前攻击者
            
            const distance = Vec3.distance(target.position, allyTarget.position);
            if (distance > this.combatDetectionRange) continue;
            
            const allyCharacter = allyTarget.getComponent('BaseCharacterDemo') as any;
            if (allyCharacter && allyCharacter.currentTarget === target) {
                // 其他我方单位正在攻击这个目标
                const allyStateMachine = allyCharacter.stateMachine;
                if (allyStateMachine) {
                    const allyState = allyStateMachine.getCurrentState?.();
                    if (allyState === 'attacking') {
                        console.log(`%c[EnhancedTargetSelector] ⚔️ 目标 ${target.name} 正被其他我方单位 ${allyTarget.name} 攻击`, 'color: orange');
                        return true;
                    }
                }
            }
        }
        
        return false;
    }
    
    /**
     * 计算增强版目标评分（支持死锁双方优先级降低）
     */
    private calculateEnhancedTargetScore(target: Node, myPosition: Vec3, distance: number, losResult: LineOfSightResult, myFaction?: Faction, attacker?: Node): number {
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
        
        // 【新增】包围系统优先级调整
        if (myFaction && attacker) {
            score = this.adjustScoreForSurround(score, myPosition, target, myFaction);
        }
        
        // 【新增】死锁双方优先级降低机制
        if (myFaction && this.enableOneVsOneCombat) {
            let isInLockedPair = false;
            let lockReason = '';
            
            // 检查目标是否被锁定
            if (this.isTargetLocked(target)) {
                const lockInfo = this.targetLocks.get(target);
                if (lockInfo && attacker) {
                    if (lockInfo.attacker === attacker) {
                        // 当前攻击者锁定了这个目标 - 死锁对
                        isInLockedPair = true;
                        lockReason = `攻击者 ${attacker.name} 锁定目标 ${target.name}`;
                    } else {
                        // 目标被其他单位锁定 - 大幅降低优先级
                        score *= 0.05; // 降至5%
                        console.log(`%c[EnhancedTargetSelector] 🔒 目标 ${target.name} 被其他单位锁定，优先级降低至 5%`, 'color: red');
                        return score;
                    }
                }
            }
            
            // 检查攻击者是否正在锁定其他目标
            if (attacker && this.isAttackerLocked(attacker)) {
                const lockedTarget = this.attackerLocks.get(attacker);
                if (lockedTarget && lockedTarget !== target) {
                    // 攻击者已锁定其他目标 - 大幅降低对新目标的优先级
                    score *= 0.05; // 降至5%
                    console.log(`%c[EnhancedTargetSelector] 🔗 攻击者 ${attacker.name} 已锁定其他目标，对新目标优先级降低至 5%`, 'color: red');
                    return score;
                } else if (lockedTarget === target) {
                    // 攻击者锁定了当前目标 - 死锁对
                    isInLockedPair = true;
                    lockReason = `攻击者 ${attacker.name} 已锁定当前目标 ${target.name}`;
                }
            }
            
            // 死锁对：双方都降低优先级
            if (isInLockedPair) {
                score *= this.lockedPairPriorityPenalty;
                console.log(`%c[EnhancedTargetSelector] 💀 死锁对: ${lockReason}，优先级降低至 ${(this.lockedPairPriorityPenalty * 100).toFixed(0)}%`, 'color: purple');
            }
            // 检查常规对战状态
            else if (this.isTargetInCombat(target, myFaction, attacker)) {
                score *= this.combatPriorityPenalty;
                console.log(`%c[EnhancedTargetSelector] ⚔️ 目标 ${target.name} 正在对战，优先级降低至 ${(this.combatPriorityPenalty * 100).toFixed(0)}%`, 'color: red');
            }
        }
        
        return score;
    }
    
    /**
     * 计算记忆目标评分
     */
    private calculateMemoryTargetScore(targetInfo: TargetInfo, memory: TargetMemory, memoryDistance: number, myFaction?: Faction): number {
        let score = this.calculateEnhancedTargetScore(targetInfo.node, memory.lastSeenPosition, targetInfo.distance, { visible: true, distance: targetInfo.distance }, myFaction);
        
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
        const losResult = this.checkLineOfSight(myPosition, target.position, target); // 不传阵营，不进行友军/敌军检查
        return this.calculateEnhancedTargetScore(target, myPosition, distance, losResult);
    }
    
    /**
     * 获取敌对阵营列表
     */
    private getEnemyFactions(myFaction: Faction): Faction[] {
        return factionManager.getEnemyFactions(myFaction);
    }
    
    /**
     * 查找最佳目标（带攻击者信息的内部版本）
     * @param myPosition 攻击者位置
     * @param myFaction 攻击者阵营
     * @param detectionRange 检测范围
     * @param attacker 攻击者节点
     * @returns 最佳目标信息
     */
    private findBestTargetWithAttacker(myPosition: Vec3, myFaction: Faction, detectionRange: number, attacker: Node): TargetInfo | null {
        const enemyFactions = this.getEnemyFactions(myFaction);
        
        if (enemyFactions.length === 0) {
            console.warn(`%c[EnhancedTargetSelector] ⚠️ 没有敌对阵营，无法查找目标`, 'color: red');
            return null;
        }
        
        let bestTarget: TargetInfo | null = null;
        let bestScore = -1;
        let totalTargetsChecked = 0;
        let validTargetsInRange = 0;
        let visibleTargets = 0;
        
        // 第一阶段：查找可见的活跃目标
        for (const enemyFaction of enemyFactions) {
            const targets = this.getTargetsByFaction(enemyFaction);
            
            for (const target of targets) {
                if (!target || !target.isValid) {
                    console.warn(`%c[EnhancedTargetSelector] ⚠️ 跳过无效目标节点`, 'color: orange');
                    continue;
                }
                
                totalTargetsChecked++;
                const distance = Vec3.distance(myPosition, target.position);
                
                if (distance > detectionRange) {
                    continue;
                }
                
                validTargetsInRange++;
                
                const characterStats = target.getComponent(CharacterStats);
                if (!characterStats || !characterStats.isAlive) {
                    console.log(`%c[EnhancedTargetSelector] 💀 目标 ${target.name} 不存活或无生命值组件`, 'color: gray');
                    continue;
                }
                
                // 视线检测
                const losResult = this.checkLineOfSight(myPosition, target.position, target, myFaction);
                
                if (losResult.visible) {
                    visibleTargets++;
                    // 更新记忆
                    this.updateTargetMemory(target, target.position, enemyFaction, true);
                    
                    // 计算增强评分（带攻击者信息）
                    const score = this.calculateEnhancedTargetScore(target, myPosition, distance, losResult, myFaction, attacker);
                    
                    if (score > bestScore) {
                        bestScore = score;
                        bestTarget = {
                            node: target,
                            position: target.position.clone(),
                            distance: distance,
                            faction: enemyFaction,
                            priority: score
                        };
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
        
        // 第二阶段：如果没有找到可见目标，尝试基于记忆搜索
        if (!bestTarget) {
            bestTarget = this.searchBasedOnMemoryWithAttacker(myPosition, myFaction, detectionRange, attacker);
            
            if (bestTarget) {
                console.log(`%c[EnhancedTargetSelector] 🧠 基于记忆找到目标: ${bestTarget.node.name}`, 'color: purple');
            } else {
                console.log(`%c[EnhancedTargetSelector] 🧠 基于记忆也未找到目标`, 'color: gray');
            }
        }
        
        // 【新增】打印包围统计信息
        if (bestTarget && this.enableSurroundSystem) {
            this.printSurroundStats(bestTarget.node, myFaction);
        }
        
        return bestTarget;
    }
    
    /**
     * 基于记忆进行搜索（带攻击者信息）
     */
    private searchBasedOnMemoryWithAttacker(myPosition: Vec3, myFaction: Faction, detectionRange: number, attacker: Node): TargetInfo | null {
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
            const searchResult = this.searchAroundPosition(memory.lastSeenPosition, myPosition, memory.faction, myFaction);
            
            if (searchResult) {
                // 增加搜索尝试次数
                memory.searchAttempts++;
                
                const score = this.calculateMemoryTargetScoreWithAttacker(searchResult, memory, memoryDistance, myFaction, attacker);
                
                if (score > bestMemoryScore) {
                    bestMemoryScore = score;
                    bestMemoryTarget = searchResult;
                }
            } else {
                // 搜索失败，增加尝试次数
                memory.searchAttempts++;
            }
        }
        
        return bestMemoryTarget;
    }
    
    /**
     * 计算记忆目标评分（带攻击者信息）
     */
    private calculateMemoryTargetScoreWithAttacker(targetInfo: TargetInfo, memory: TargetMemory, memoryDistance: number, myFaction?: Faction, attacker?: Node): number {
        let score = this.calculateEnhancedTargetScore(targetInfo.node, memory.lastSeenPosition, targetInfo.distance, { visible: true, distance: targetInfo.distance }, myFaction, attacker);
        
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
     * 尝试锁定最佳目标（供外部调用）
     * @param attacker 攻击者
     * @param myPosition 攻击者位置
     * @param myFaction 攻击者阵营
     * @param detectionRange 检测范围
     * @returns 锁定的目标信息，如果无法锁定则返回null
     */
    public findAndLockBestTarget(attacker: Node, myPosition: Vec3, myFaction: Faction, detectionRange: number): TargetInfo | null {
        // 使用带攻击者信息的内部版本进行目标搜索
        const bestTarget = this.findBestTargetWithAttacker(myPosition, myFaction, detectionRange, attacker);
        
        if (bestTarget && bestTarget.node) {
            // 尝试锁定目标
            if (this.lockTarget(bestTarget.node, attacker)) {
                console.log(`%c[EnhancedTargetSelector] 🎯 ${attacker.name} 成功死锁目标 ${bestTarget.node.name}`, 'color: green');
                return bestTarget;
            } else {
                console.log(`%c[EnhancedTargetSelector] ❌ ${attacker.name} 无法锁定目标 ${bestTarget.node.name}（已被其他单位死锁）`, 'color: orange');
                return null;
            }
        }
        
        return null;
    }
    
    /**
     * 获取目标锁定统计信息
     */
    public getLockStats(): { totalLocks: number; validLocks: number } {
        let validLocks = 0;
        
        for (const [target, lockInfo] of this.targetLocks) {
            // 死锁机制：检查双方是否都还存活
            let isValid = true;
            
            if (!target.isValid || !lockInfo.attacker.isValid) {
                isValid = false;
            } else {
                const targetStats = target.getComponent('CharacterStats') as any;
                const attackerStats = lockInfo.attacker.getComponent('CharacterStats') as any;
                
                if ((targetStats && !targetStats.isAlive) || (attackerStats && !attackerStats.isAlive)) {
                    isValid = false;
                }
            }
            
            if (isValid) {
                validLocks++;
            }
        }
        
        return {
            totalLocks: this.targetLocks.size,
            validLocks: validLocks
        };
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
}

// 导出单例访问器
export const enhancedTargetSelector = {
    getInstance: (): EnhancedTargetSelector | null => EnhancedTargetSelector.getInstance()
};