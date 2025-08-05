// assets/scripts/components/CombatComponent.ts

import { Component, Node } from 'cc';
import { ICombat, IAttackResult } from '../interfaces/ICombat';
import { CharacterStats } from './CharacterStats';

/**
 * 战斗组件 - 负责攻击、伤害、战斗相关功能
 * 实现 ICombat 接口，专注于战斗功能的单一职责
 */
export class CombatComponent extends Component implements ICombat {
    // 战斗相关属性
    private _attackCooldown: number = 1.0;
    private _lastAttackTime: number = 0;
    private _currentTarget: Node | null = null;
    private _wantsToAttack: boolean = false;
    private _isInvincible: boolean = false;

    // 组件依赖
    private characterStats: CharacterStats | null = null;

    // ICombat 接口属性
    get attackCooldown(): number { return this._attackCooldown; }
    set attackCooldown(value: number) { this._attackCooldown = value; }

    get lastAttackTime(): number { return this._lastAttackTime; }
    set lastAttackTime(value: number) { this._lastAttackTime = value; }

    get currentTarget(): Node | null { return this._currentTarget; }
    set currentTarget(value: Node | null) { this._currentTarget = value; }

    get wantsToAttack(): boolean { return this._wantsToAttack; }
    set wantsToAttack(value: boolean) { this._wantsToAttack = value; }

    protected onLoad(): void {
        // 获取必要的组件
        this.characterStats = this.getComponent(CharacterStats);
    }

    /**
     * 执行特殊攻击
     */
    performSpecialAttack(): IAttackResult | null {
        // 智能选择攻击方式（近战或远程）
        return this.performMeleeAttack();
    }

    /**
     * 执行特殊攻击并返回目标信息
     */
    performSpecialAttackWithTarget(): IAttackResult | null {
        return this.performMeleeAttackWithTarget();
    }

    /**
     * 执行近战攻击
     */
    performMeleeAttack(): IAttackResult | null {
        if (!this.characterStats) {
            console.warn(`[CombatComponent] 缺少CharacterStats组件，无法执行攻击`);
            return null;
        }

        const target = this.findNearestEnemy();
        if (target) {
            const damage = this.characterStats.baseAttack;
            return this.dealDamageToTarget(target, damage);
        }
        
        return null;
    }

    /**
     * 执行近战攻击并返回目标信息
     */
    performMeleeAttackWithTarget(): IAttackResult | null {
        if (!this.characterStats) {
            console.warn(`[CombatComponent] 缺少CharacterStats组件，无法执行攻击`);
            return null;
        }

        const target = this.findNearestEnemy();
        if (target) {
            const damage = this.characterStats.baseAttack;
            const result = this.dealDamageToTarget(target, damage);
            if (result) {
                return {
                    isDead: result.isDead,
                    isStunned: result.isStunned,
                    target: target
                };
            }
        }
        
        return null;
    }

    /**
     * 执行远程攻击
     */
    performRangedAttack(): void {
        // 远程攻击逻辑，需要与ProjectileLauncher协调
        console.log(`[CombatComponent] 执行远程攻击`);
    }

    /**
     * 寻找最近的敌人
     */
    findNearestEnemy(): Node | null {
        // 这里需要与目标选择器服务协调
        // 通过服务定位器获取目标选择器
        console.log(`[CombatComponent] 查找最近敌人`);
        return null; // 临时返回，实际需要实现
    }

    /**
     * 对目标造成伤害
     * @param target 攻击目标
     * @param damage 伤害值
     */
    dealDamageToTarget(target: Node, damage: number): IAttackResult | null {
        if (!target || !target.isValid) {
            console.warn(`[CombatComponent] 无效的攻击目标`);
            return null;
        }

        // 获取目标的战斗组件或CharacterStats
        const targetCombat = target.getComponent(CombatComponent);
        const targetStats = target.getComponent(CharacterStats);

        if (targetCombat) {
            // 调用目标的受伤逻辑
            targetCombat.takeDamage(damage);
            return {
                isDead: targetStats ? !targetStats.isAlive : false,
                isStunned: false, // 需要根据实际逻辑判断
                target: target
            };
        } else if (targetStats) {
            // 直接处理CharacterStats
            const result = targetStats.takeDamage(damage);
            return result;
        }

        console.warn(`[CombatComponent] 目标没有可攻击的组件`);
        return null;
    }

    /**
     * 受到伤害
     * @param damage 伤害值
     */
    takeDamage(damage: number): void {
        // 检查无敌状态
        if (this._isInvincible) {
            console.log(`[CombatComponent] 处于无敌状态，免疫伤害`);
            return;
        }

        if (!this.characterStats) {
            console.warn(`[CombatComponent] 缺少CharacterStats组件，无法处理伤害`);
            return;
        }

        // 委托给CharacterStats处理
        const result = this.characterStats.takeDamage(damage);

        // 根据结果触发不同的反应
        if (result.isDead) {
            this.onCharacterDeath();
        } else if (result.isStunned) {
            this.onCharacterStunned();
        }

        // 激活短暂无敌时间
        const invincibilityDuration = result.isStunned ? 0.6 : 0.2;
        this.activateInvincibility(invincibilityDuration);
    }

    /**
     * 激活无敌状态
     * @param duration 无敌持续时间（秒）
     */
    activateInvincibility(duration: number): void {
        if (this._isInvincible) return;

        this._isInvincible = true;
        this.scheduleOnce(() => {
            this._isInvincible = false;
        }, duration);
    }

    /**
     * 检查攻击冷却
     */
    canAttack(): boolean {
        const currentTime = Date.now() / 1000;
        return (currentTime - this._lastAttackTime) >= this._attackCooldown;
    }

    /**
     * 重置攻击时间
     */
    resetAttackTime(): void {
        this._lastAttackTime = Date.now() / 1000;
    }

    /**
     * 角色死亡处理
     */
    private onCharacterDeath(): void {
        console.log(`[CombatComponent] 角色死亡`);
        // 触发死亡事件，通知其他组件
    }

    /**
     * 角色被击晕处理
     */
    private onCharacterStunned(): void {
        console.log(`[CombatComponent] 角色被击晕`);
        // 触发击晕事件，通知其他组件
    }

    /**
     * 重置战斗状态
     */
    resetCombatState(): void {
        this._currentTarget = null;
        this._wantsToAttack = false;
        this._lastAttackTime = 0;
        this._isInvincible = false;
    }
}