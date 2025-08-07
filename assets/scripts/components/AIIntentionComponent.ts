// assets/scripts/components/AIIntentionComponent.ts

import { _decorator, Component, Node, Vec3 } from 'cc';
import { Faction } from '../configs/FactionConfig';
import { basicEnemyFinder } from './BasicEnemyFinder';

const { ccclass, property } = _decorator;

/**
 * AI意向枚举
 */
export enum AIIntention {
    IDLE = 'idle',           // 待机
    SEEK_ENEMY = 'seek',     // 寻找敌人
    CHASE_ENEMY = 'chase',   // 追击敌人  
    ATTACK_ENEMY = 'attack', // 攻击敌人
    FLEE = 'flee',           // 逃跑
    PATROL = 'patrol'        // 巡逻
}

/**
 * AI意向数据
 */
export interface AIIntentionData {
    intention: AIIntention;
    targetNode?: Node;       // 目标节点
    targetPosition?: Vec3;   // 目标位置
    priority: number;        // 优先级（0-10，10最高）
    expirationTime?: number; // 过期时间（毫秒）
    reason?: string;         // 意向产生原因（用于调试）
}

/**
 * AI意向组件
 * 负责管理AI的意图和目标，作为索敌系统和状态机之间的桥梁
 */
@ccclass('AIIntentionComponent')
export class AIIntentionComponent extends Component {
    // 当前意向
    private _currentIntention: AIIntentionData | null = null;

    // AI配置
    private _detectionRange: number = 150;    // 索敌范围
    private _attackRange: number = 50;        // 攻击范围
    private _chaseRange: number = 200;        // 追击范围
    private _updateInterval: number = 0.2;    // 意向更新间隔（秒）

    // 更新计时器
    private _lastUpdateTime: number = 0;

    // 组件依赖
    private _factionComponent: any = null;

    protected onLoad(): void {
        // 获取阵营组件
        this._factionComponent = this.getComponent('FactionComponent');

        // 监听生命周期事件
        this.node.on('reset-character-state', this.onResetState, this);

        console.log(`[AIIntentionComponent] 初始化完成 (节点: ${this.node.name})`);
    }

    protected onDestroy(): void {
        // 清理事件监听
        this.node.off('reset-character-state', this.onResetState, this);
    }

    /**
     * 更新AI意向（现在主要用于清理过期意向）
     * 注意：意向分析现在由OneDimensionalUnitAI负责，这里只处理过期清理
     */
    update(deltaTime: number): void {
        // 控制更新频率
        this._lastUpdateTime += deltaTime;
        if (this._lastUpdateTime < this._updateInterval) {
            return;
        }
        this._lastUpdateTime = 0;

        // 清理过期的意向
        this.clearExpiredIntention();

        // 如果没有OneDimensionalUnitAI组件，则执行原有的意向分析逻辑
        const aiComponent = this.getComponent('OneDimensionalUnitAI');
        if (!aiComponent) {
            this.analyzeAndUpdateIntention();
        }
    }

    /**
     * 获取当前意向
     */
    getCurrentIntention(): AIIntentionData | null {
        return this._currentIntention;
    }

    /**
     * 手动设置意向（用于外部强制设置）
     */
    setIntention(intentionData: AIIntentionData): void {
        this._currentIntention = intentionData;
        console.log(`[AIIntentionComponent] 设置意向: ${intentionData.intention} (原因: ${intentionData.reason || '手动设置'})`);
    }

    /**
     * 清除当前意向
     */
    clearIntention(): void {
        if (this._currentIntention) {
            console.log(`[AIIntentionComponent] 清除意向: ${this._currentIntention.intention}`);
            this._currentIntention = null;
        }
    }

    /**
     * 检查是否有攻击意向
     */
    wantsToAttack(): boolean {
        return this._currentIntention?.intention === AIIntention.ATTACK_ENEMY;
    }

    /**
     * 检查是否有移动意向
     */
    wantsToMove(): boolean {
        const intention = this._currentIntention?.intention;
        return intention === AIIntention.CHASE_ENEMY ||
            intention === AIIntention.SEEK_ENEMY ||
            intention === AIIntention.PATROL ||
            intention === AIIntention.FLEE;
    }

    /**
     * 获取移动目标位置
     */
    getMovementTarget(): Vec3 | null {
        if (!this.wantsToMove()) {
            return null;
        }

        // 优先使用目标节点的位置
        if (this._currentIntention?.targetNode && this._currentIntention.targetNode.isValid) {
            return this._currentIntention.targetNode.getWorldPosition();
        }

        // 使用预设的目标位置
        return this._currentIntention?.targetPosition || null;
    }

    /**
     * 分析和更新意向
     */
    private analyzeAndUpdateIntention(): void {
        if (!this._factionComponent) {
            return;
        }

        const myFaction = this._factionComponent.getFaction();
        const myPosition = this.node.getWorldPosition();

        // 1. 寻找最近的敌人 - 优先使用三列检查
        let nearestEnemy: Node | null = null;
        
        // 尝试通过OneDimensionalUnitAI使用三列检查
        const aiComponent = this.getComponent('OneDimensionalUnitAI') as any;
        if (aiComponent && typeof aiComponent.findEnemiesInThreeColumns === 'function') {
            const enemies = aiComponent.findEnemiesInThreeColumns();
            if (enemies && enemies.length > 0) {
                // 获取最近的敌人
                const nearestResult = enemies[0];
                nearestEnemy = nearestResult.entity ? nearestResult.entity.node : null;
            }
        }
        
        // 回退方案：使用basicEnemyFinder
        if (!nearestEnemy) {
            nearestEnemy = basicEnemyFinder.findNearestEnemy(this.node, myFaction, this._detectionRange);
        }

        if (nearestEnemy) {
            const enemyPosition = nearestEnemy.getWorldPosition();
            const distance = Vec3.distance(myPosition, enemyPosition);

            // 2. 根据距离决定意向
            if (distance <= this._attackRange) {
                // 在攻击范围内 - 攻击意向
                this.setIntention({
                    intention: AIIntention.ATTACK_ENEMY,
                    targetNode: nearestEnemy,
                    priority: 10,
                    expirationTime: Date.now() + 2000, // 2秒过期
                    reason: `敌人在攻击范围内 (距离: ${distance.toFixed(1)})`
                });
            } else if (distance <= this._chaseRange) {
                // 在追击范围内 - 追击意向
                this.setIntention({
                    intention: AIIntention.CHASE_ENEMY,
                    targetNode: nearestEnemy,
                    targetPosition: enemyPosition,
                    priority: 8,
                    expirationTime: Date.now() + 3000, // 3秒过期
                    reason: `追击敌人 (距离: ${distance.toFixed(1)})`
                });
            } else {
                // 超出追击范围但在索敌范围内 - 寻找意向
                this.setIntention({
                    intention: AIIntention.SEEK_ENEMY,
                    targetNode: nearestEnemy,
                    targetPosition: enemyPosition,
                    priority: 6,
                    expirationTime: Date.now() + 1500, // 1.5秒过期
                    reason: `发现敌人但距离较远 (距离: ${distance.toFixed(1)})`
                });
            }
        } else {
            // 3. 没有发现敌人 - 待机意向
            if (!this._currentIntention || this._currentIntention.intention !== AIIntention.IDLE) {
                this.setIntention({
                    intention: AIIntention.IDLE,
                    priority: 1,
                    reason: '未发现敌人'
                });
            }
        }
    }

    /**
     * 清理过期的意向
     */
    private clearExpiredIntention(): void {
        if (this._currentIntention?.expirationTime) {
            if (Date.now() > this._currentIntention.expirationTime) {
                console.log(`[AIIntentionComponent] 意向过期: ${this._currentIntention.intention}`);
                this.clearIntention();
            }
        }
    }

    /**
     * 重置状态回调
     */
    private onResetState(): void {
        this.clearIntention();
        this._lastUpdateTime = 0;
    }

    // ================== 配置方法 ==================

    /**
     * 设置索敌范围
     */
    setDetectionRange(range: number): void {
        this._detectionRange = range;
    }

    /**
     * 设置攻击范围
     */
    setAttackRange(range: number): void {
        this._attackRange = range;
    }

    /**
     * 设置追击范围
     */
    setChaseRange(range: number): void {
        this._chaseRange = range;
    }

    /**
     * 获取调试信息
     */
    getDebugInfo(): string {
        if (!this._currentIntention) {
            return '[AIIntentionComponent] 当前意向: 无';
        }

        const { intention, priority, reason, targetNode } = this._currentIntention;
        const targetInfo = targetNode ? `目标: ${targetNode.name}` : '无目标';

        return `[AIIntentionComponent] 意向: ${intention}, 优先级: ${priority}, ${targetInfo}, 原因: ${reason}`;
    }
}