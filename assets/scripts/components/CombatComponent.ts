// assets/scripts/components/CombatComponent.ts

import { _decorator, Component, Node } from 'cc';
import { ICombat, IAttackResult } from '../interfaces/ICombat';
import { CharacterStats } from './CharacterStats';
import { basicEnemyFinder } from './BasicEnemyFinder';
import { FactionComponent } from './FactionComponent';
import { OneDimensionalUnitAI } from './OneDimensionalUnitAI';

const { ccclass, property } = _decorator;

/**
 * 战斗组件 - 负责攻击、伤害、战斗相关功能
 * 实现 ICombat 接口，专注于战斗功能的单一职责
 */
@ccclass('CombatComponent')
export class CombatComponent extends Component implements ICombat {
    // 战斗相关属性
    private _attackCooldown: number = 1.0;
    private _lastAttackTime: number = 0;
    private _currentTarget: Node | null = null;
    private _wantsToAttack: boolean = false;
    private _isInvincible: boolean = false;

    // 投射物发射起点配置
    private _projectileOrigin: { x: number; y: number } = { x: 0, y: 0 };

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
     * 设置投射物发射起点
     */
    setProjectileOrigin(x: number, y: number): void {
        this._projectileOrigin.x = x;
        this._projectileOrigin.y = y;
        console.log(`[CombatComponent] 投射物发射起点已设置: (${x}, ${y})`);
    }

    /**
     * 获取投射物发射起点
     */
    get projectileOrigin(): { x: number; y: number } {
        return { ...this._projectileOrigin };
    }

    /**
     * 获取世界坐标的投射物发射起点
     */
    getWorldProjectileOrigin(): { x: number; y: number } {
        const nodePos = this.node.getWorldPosition();
        return {
            x: nodePos.x + this._projectileOrigin.x,
            y: nodePos.y + this._projectileOrigin.y
        };
    }

    /**
     * 使用敌人配置数据配置战斗组件
     */
    configure(enemyData: any): void {
        // 应用攻击冷却时间
        if (enemyData.attackInterval) {
            this._attackCooldown = enemyData.attackInterval;
            console.log(`[CombatComponent] ✅ 攻击间隔已设置: ${enemyData.attackInterval}秒`);
        }

        // 如果配置中有发射起点，设置它
        if (enemyData.projectileOrigin) {
            this.setProjectileOrigin(enemyData.projectileOrigin.x, enemyData.projectileOrigin.y);
        } else if (enemyData.uiSize) {
            // 根据UI尺寸计算默认发射起点
            const defaultY = enemyData.uiSize.height * 0.3;
            this.setProjectileOrigin(0, defaultY);
        }

        console.log(`[CombatComponent] 🗡️ 战斗配置应用完成: ${enemyData.name || enemyData.id}`);
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
     * 寻找最近的敌人 - 使用三列检查（当前列+左右相邻列）
     */
    findNearestEnemy(): Node | null {
        // 获取阵营组件
        const factionComponent = this.getComponent(FactionComponent) as any;
        if (!factionComponent) {
            console.warn(`[CombatComponent] 缺少FactionComponent，无法查找敌人`);
            return null;
        }

        // 尝试通过OneDimensionalUnitAI获取网格系统引用
        const aiComponent = this.getComponent(OneDimensionalUnitAI) as any;
        if (aiComponent && typeof aiComponent.findAttackableEnemies === 'function') {
            // 使用AI组件的攻击范围检查方法（三列检查+攻击范围过滤）
            const attackableEnemies = aiComponent.findAttackableEnemies();
            if (attackableEnemies && attackableEnemies.length > 0) {
                // 返回最近的可攻击敌人（已按距离排序）
                const nearestResult = attackableEnemies[0];
                const targetNode = nearestResult.entity ? nearestResult.entity.node : null;
                if (targetNode) {
                    console.log(`[CombatComponent] ${this.node.name} 通过三列+攻击范围检查找到目标: ${targetNode.name} (距离: ${nearestResult.distance.toFixed(1)})`);
                    return targetNode;
                }
            }
        }

        // 回退方案：使用basicEnemyFinder
        const myFaction = factionComponent.getFaction();
        const nearestEnemy = basicEnemyFinder.findNearestEnemy(this.node, myFaction, 100); // 100像素攻击范围
        
        if (nearestEnemy) {
            console.log(`[CombatComponent] ${this.node.name} 通过距离检查找到攻击目标: ${nearestEnemy.name}`);
        }
        
        return nearestEnemy;
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