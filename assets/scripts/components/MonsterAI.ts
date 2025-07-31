// assets/scripts/core/MonsterAI.ts

import { _decorator, Component, Node, Vec3, Vec2 } from 'cc';
import { EnemyData } from '../configs/EnemyConfig';
import { Faction } from '../configs/FactionConfig';

const { ccclass, property } = _decorator;

/**
 * AI状态枚举
 */
export enum AIState {
    IDLE = 'idle',              // 待机状态
    PATROL = 'patrol',          // 巡逻状态
    SEEKING = 'seeking',        // 寻找目标状态
    CHASING = 'chasing',        // 追击目标状态
    ATTACKING = 'attacking',    // 攻击状态
    RETURNING = 'returning',    // 返回原位状态
    STUNNED = 'stunned',        // 眩晕状态
    DEAD = 'dead'               // 死亡状态
}

/**
 * AI行为类型
 */
export enum AIBehaviorType {
    MELEE = 'melee',            // 近战型AI
    RANGED = 'ranged',          // 远程型AI
    MIXED = 'mixed'             // 混合型AI
}



/**
 * 目标信息接口
 */
export interface TargetInfo {
    node: Node;
    position: Vec3;
    distance: number;
    faction: Faction;
    priority: number;           // 目标优先级
}

/**
 * AI配置已迁移到 EnemyData 中，不再需要单独的配置接口
 */

/**
 * 怪物AI基础接口
 */
export interface IMonsterAI {
    // 初始化AI（直接使用enemyData中的配置）
    initialize(enemyData: EnemyData): void;
    
    // 更新AI逻辑
    updateAI(deltaTime: number): void;
    
    // 设置阵营
    setFaction(faction: Faction): void;
    
    // 获取当前状态
    getCurrentState(): AIState;
    
    // 强制切换状态
    forceState(state: AIState): void;
    
    // 设置目标
    setTarget(target: Node | null): void;
    
    // 获取当前目标
    getCurrentTarget(): Node | null;
    
    // 是否可以攻击
    canAttack(): boolean;
    
    // 重置AI状态
    resetAI(): void;
    
    // 清理AI
    cleanup(): void;
}

/**
 * 目标选择策略接口
 */
export interface ITargetSelector {
    // 查找最佳目标
    findBestTarget(myPosition: Vec3, faction: Faction, detectionRange: number): TargetInfo | null;
    
    // 获取指定阵营的所有目标
    getTargetsByFaction(targetFaction: Faction): Node[];
    
    // 计算目标优先级
    calculateTargetPriority(target: Node, myPosition: Vec3): number;
    
    // 注册目标到指定阵营
    registerTarget(target: Node, faction: Faction): void;
    
    // 从指定阵营中反注册目标
    deregisterTarget(target: Node, faction: Faction): void;
    
    // 【新增】尝试锁定最佳目标（1对1对战）
    findAndLockBestTarget?(attacker: Node, myPosition: Vec3, myFaction: Faction, detectionRange: number): TargetInfo | null;
    
    // 【新增】释放攻击者的目标锁定
    releaseAttackerLock?(attacker: Node): void;
    
    // 【新增】检查目标是否被锁定
    isTargetLocked?(target: Node, attacker?: Node): boolean;
    
    // 【新增】检查攻击者是否正在锁定其他目标
    isAttackerLocked?(attacker: Node): boolean;
    
    // 【新增】打印包围统计信息
    printSurroundStats?(target: Node, myFaction: Faction): void;
} 