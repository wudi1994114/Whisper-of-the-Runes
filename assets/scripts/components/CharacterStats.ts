// assets/scripts/components/CharacterStats.ts

import { _decorator, Component, Sprite } from 'cc';
import { MonsterAnimationController } from '../animation/MonsterAnimationController';
import { EnemyData } from '../configs/EnemyConfig';
import { eventManager } from '../core/EventManager';
import { GameEvents } from '../core/GameEvents';

const { ccclass, property } = _decorator;

/**
 * 角色属性组件
 * 负责管理角色的基本属性、生命值、攻击力、防御力等
 */
@ccclass('CharacterStats')
export class CharacterStats extends Component {
    
    // 基础属性
    private _maxHealth: number = 100;
    private _currentHealth: number = 100;
    private _baseAttack: number = 10;
    private _baseDefense: number = 5;
    private _moveSpeed: number = 1.0;
    private _expReward: number = 0;
    
    // 霸体值属性
    private _maxPoise: number = 50;
    private _currentPoise: number = 50;
    // 阵营管理已移至BaseCharacterDemo的aiFaction属性
    
    // 组件引用
    private _spriteComponent: Sprite | null = null;
    private _animationController: MonsterAnimationController | null = null;
    
    // 敌人数据
    private _enemyData: EnemyData | null = null;
    
    // 状态标记
    private _isInitialized: boolean = false;
    
    protected onLoad() {
        this.setupComponents();
    }
    
    /**
     * 设置组件引用
     */
    private setupComponents() {
        // 获取或添加必要的组件
        this._spriteComponent = this.getComponent(Sprite);
        if (!this._spriteComponent) {
            this._spriteComponent = this.addComponent(Sprite);
        }
        
        this._animationController = this.getComponent(MonsterAnimationController);
        if (!this._animationController) {
            this._animationController = this.addComponent(MonsterAnimationController);
        }
    }
    
    // 注册/反注册逻辑已移至BaseCharacterDemo组件
    
    // ========== 属性访问器 ==========
    
    public get maxHealth(): number {
        return this._maxHealth;
    }
    
    public get currentHealth(): number {
        return this._currentHealth;
    }
    
    public get baseAttack(): number {
        return this._baseAttack;
    }
    
    public get baseDefense(): number {
        return this._baseDefense;
    }
    
    public get moveSpeed(): number {
        return this._moveSpeed;
    }
    
    public get speed(): number {
        return this._moveSpeed;
    }
    
    public get expReward(): number {
        return this._expReward;
    }
    
    public get isAlive(): boolean {
        return this._currentHealth > 0;
    }
    
    public get maxPoise(): number {
        return this._maxPoise;
    }
    
    public get currentPoise(): number {
        return this._currentPoise;
    }
    
    public get enemyData(): EnemyData | null {
        return this._enemyData;
    }
    
    // 阵营属性已移至BaseCharacterDemo的aiFaction
    
    public get isInitialized(): boolean {
        return this._isInitialized;
    }
    
    // ========== 初始化方法 ==========
    
    /**
     * 使用敌人数据初始化属性
     * @param enemyData 敌人数据配置
     */
    public async initWithEnemyData(enemyData: EnemyData) {
        this._enemyData = enemyData;
        
        // 设置基础属性
        this._maxHealth = enemyData.baseHealth;
        this._currentHealth = enemyData.baseHealth;
        this._baseAttack = enemyData.baseAttack;
        this._baseDefense = enemyData.baseDefense;
        this._moveSpeed = enemyData.moveSpeed;
        this._expReward = enemyData.expReward;
        
        // 初始化霸体值
        this._maxPoise = enemyData.poise || 50; // 如果配置中没有，给一个默认值
        this._currentPoise = this._maxPoise;
        
        // 初始化动画控制器
        if (this._animationController) {
            await this._animationController.initializeWithEnemyData(enemyData);
        }
        
        eventManager.emit(GameEvents.CHARACTER_STATS_INITIALIZED, this);
    }

    /**
     * 手动设置属性（用于玩家或其他特殊角色）
     */
    public setStats(maxHealth: number, baseAttack: number, baseDefense: number, moveSpeed: number, expReward: number = 0, maxPoise: number = 50) {
        this._maxHealth = maxHealth;
        this._currentHealth = maxHealth;
        this._baseAttack = baseAttack;
        this._baseDefense = baseDefense;
        this._moveSpeed = moveSpeed;
        this._expReward = expReward;
        this._maxPoise = maxPoise;
        this._currentPoise = maxPoise;
        
        eventManager.emit(GameEvents.CHARACTER_STATS_INITIALIZED, this);
    }

    /**
     * 受到伤害
     * @param damage 伤害值
     * @returns 包含死亡和硬直信息的对象
     */
    public takeDamage(damage: number): { isDead: boolean, isStunned: boolean } {
        if (!this.isAlive) {
            return { isDead: true, isStunned: false };
        }

        // 计算实际伤害（考虑防御力）
        const actualDamage = Math.max(1, damage - this._baseDefense);
        
        this._currentHealth -= actualDamage;
        this._currentHealth = Math.max(0, this._currentHealth);

        let isStunned = false;
        // 只有在霸体值大于0时才扣减，否则每次都会硬直
        if (this._currentPoise > 0) {
            this._currentPoise -= actualDamage; // 简化处理：伤害值直接作为削韧值
        }

        // 如果霸体值被扣光，则产生硬直
        if (this._currentPoise <= 0) {
            isStunned = true;
            this._currentPoise = this._maxPoise; // 硬直后立刻重置霸体值
        }

        // 发送血量变化事件（用于血条组件）
        this.node.emit('health-changed', this._currentHealth, this._maxHealth);
        
        eventManager.emit(GameEvents.CHARACTER_DAMAGED, this, actualDamage);

        if (this._currentHealth <= 0) {
            eventManager.emit(GameEvents.CHARACTER_DIED, this);
            return { isDead: true, isStunned: isStunned };
        }

        return { isDead: false, isStunned: isStunned };
    }

    /**
     * 恢复生命值
     * @param healAmount 恢复量
     */
    public heal(healAmount: number) {
        if (!this.isAlive) {
            return;
        }

        this._currentHealth += healAmount;
        this._currentHealth = Math.min(this._maxHealth, this._currentHealth);

        // 发送血量变化事件（用于血条组件）
        this.node.emit('health-changed', this._currentHealth, this._maxHealth);
        
        eventManager.emit(GameEvents.CHARACTER_HEALED, this, healAmount);
    }

    /**
     * 完全恢复生命值
     */
    public fullHeal() {
        this.heal(this._maxHealth);
    }

    /**
     * 重置属性到初始状态
     */
    public reset() {
        this._currentHealth = this._maxHealth;
        // 重置时也要恢复霸体值
        this._currentPoise = this._maxPoise;
        
        // 重置动画到待机状态
        if (this._animationController && this._animationController.isReady()) {
            this._animationController.playIdleAnimation();
        }
        
        eventManager.emit(GameEvents.CHARACTER_RESET, this);
    }
    
    /**
     * 播放攻击动画
     */
    public playAttackAnimation() {
        if (this._animationController && this._animationController.isReady()) {
            this._animationController.playAttackAnimation();
        }
    }
    
    /**
     * 播放受伤动画
     */
    public playHurtAnimation() {
        if (this._animationController && this._animationController.isReady()) {
            this._animationController.playHurtAnimation();
        }
    }
    
    /**
     * 播放死亡动画
     */
    public playDeathAnimation() {
        if (this._animationController && this._animationController.isReady()) {
            this._animationController.playDieAnimation();
        }
    }
    
    /**
     * 播放施法动画
     */
    public playCastAnimation() {
        if (this._animationController && this._animationController.isReady()) {
            this._animationController.playCastAnimation();
        }
    }
    
    /**
     * 播放移动动画
     */
    public playMoveAnimation() {
        if (this._animationController && this._animationController.isReady()) {
            this._animationController.playMoveAnimation();
        }
    }
    
    /**
     * 播放待机动画
     */
    public playIdleAnimation() {
        if (this._animationController && this._animationController.isReady()) {
            this._animationController.playIdleAnimation();
        }
    }
    
    /**
     * 获取当前动画信息
     */
    public getCurrentAnimationInfo(): { state: string, direction: string } {
        if (this._animationController && this._animationController.isReady()) {
            return {
                state: this._animationController.getCurrentState(),
                direction: this._animationController.getCurrentDirection()
            };
        }
        return { state: 'Unknown', direction: 'Unknown' };
    }
    
    /**
     * 获取属性信息字符串
     */
    public getStatsInfo(): string {
        return `Health: ${this._currentHealth}/${this._maxHealth}, Attack: ${this._baseAttack}, Defense: ${this._baseDefense}, Speed: ${this._moveSpeed}, Poise: ${this._currentPoise}/${this._maxPoise}`;
    }
    
    /**
     * 获取完整的角色信息
     */
    public getFullInfo(): string {
        const enemyName = this._enemyData ? this._enemyData.name : 'Unknown';
        const animInfo = this.getCurrentAnimationInfo();
        
        return `${enemyName} - ${this.getStatsInfo()}, Animation: ${animInfo.state}_${animInfo.direction}`;
    }
    
    /**
     * 检查是否可以执行动作
     */
    public canPerformAction(): boolean {
        return this.isAlive && !!this._animationController && !!this._animationController.isReady();
    }
    
    /**
     * 获取生命值百分比
     */
    public getHealthPercentage(): number {
        return this._maxHealth > 0 ? (this._currentHealth / this._maxHealth) * 100 : 0;
    }
} 