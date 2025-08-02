// assets/scripts/interfaces/ICombat.ts

import { Node } from 'cc';

/**
 * 攻击结果接口
 */
export interface IAttackResult {
    isDead: boolean;
    isStunned: boolean;
    target?: Node | null;
}

/**
 * 战斗相关接口
 * 负责处理角色的攻击、伤害、目标选择等战斗功能
 */
export interface ICombat {
    /**
     * 攻击冷却时间（秒）
     */
    readonly attackCooldown: number;
    
    /**
     * 上次攻击时间
     */
    readonly lastAttackTime: number;
    
    /**
     * 当前目标
     */
    readonly currentTarget: Node | null;
    
    /**
     * 是否想要攻击
     */
    readonly wantsToAttack: boolean;
    
    /**
     * 执行特殊攻击
     */
    performSpecialAttack(): IAttackResult | null;
    
    /**
     * 执行特殊攻击并返回目标信息
     */
    performSpecialAttackWithTarget(): IAttackResult | null;
    
    /**
     * 执行近战攻击
     */
    performMeleeAttack(): IAttackResult | null;
    
    /**
     * 执行近战攻击并返回目标信息
     */
    performMeleeAttackWithTarget(): IAttackResult | null;
    
    /**
     * 执行远程攻击
     */
    performRangedAttack(): void;
    
    /**
     * 寻找最近的敌人
     */
    findNearestEnemy(): Node | null;
    
    /**
     * 对目标造成伤害
     * @param target 目标节点
     * @param damage 伤害值
     */
    dealDamageToTarget(target: Node, damage: number): IAttackResult | null;
    
    /**
     * 承受伤害
     * @param damage 伤害值
     */
    takeDamage(damage: number): void;
    
    /**
     * 激活无敌状态
     * @param duration 持续时间（秒）
     */
    activateInvincibility(duration: number): void;
}