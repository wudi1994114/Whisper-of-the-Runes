/**
 * 角色演示基类 - 支持对象池管理
 * 
 * 🎮 基础控制：
 * - WSAD: 移动控制
 * - J: 攻击
 * - 攻击时无法移动
 * 
 * 🔧 提供状态机管理、动画控制、输入处理和对象池支持
 */

import { _decorator, Component, Animation, Node, Sprite, Vec2, Vec3, input, Input, EventKeyboard, KeyCode, UITransform, instantiate, Prefab, Label, Color, tween, Graphics, director, Enum } from 'cc';
import { dataManager } from '../core/DataManager';
import { EnemyData } from '../configs/EnemyConfig';
import { AnimationState, AnimationDirection } from './AnimationConfig';
import { animationManager } from './AnimationManager';
import { poolManager } from '../core/PoolManager';
import { CharacterStats } from '../components/CharacterStats';
import { eventManager } from '../core/EventManager';
import { GameEvents } from '../core/GameEvents';
import { systemConfigManager } from '../core/SystemConfig';
import { AIConfig, AIBehaviorType, Faction, TargetInfo } from '../core/MonsterAI';
import { targetSelector } from '../core/TargetSelector';

const { ccclass, property } = _decorator;

// 控制模式枚举
export enum ControlMode {
    MANUAL = 0,    // 手动控制（键盘输入）
    AI = 1         // AI控制
}

// 角色状态枚举
export enum CharacterState {
    IDLE = 'idle',
    WALKING = 'walking', 
    ATTACKING = 'attacking',
    HURT = 'hurt',
    DEAD = 'dead'
}

// 状态机基类
export abstract class State {
    protected character: BaseCharacterDemo;
    
    constructor(character: BaseCharacterDemo) {
        this.character = character;
    }
    
    abstract enter(): void;
    abstract update(deltaTime: number): void;
    abstract exit(): void;
    abstract canTransitionTo(newState: CharacterState): boolean;
}

// 待机状态
export class IdleState extends State {
    enter(): void {
        console.log('[StateMachine] 进入 Idle 状态');
        this.character.playCurrentAnimation(AnimationState.IDLE);
    }
    
    update(deltaTime: number): void {
        // Idle状态下可以检查输入
    }
    
    exit(): void {
        console.log('[StateMachine] 离开 Idle 状态');
    }
    
    canTransitionTo(newState: CharacterState): boolean {
        return newState === CharacterState.WALKING || newState === CharacterState.ATTACKING || 
               newState === CharacterState.HURT || newState === CharacterState.DEAD;
    }
}

// 行走状态
export class WalkingState extends State {
    enter(): void {
        console.log('[StateMachine] 进入 Walking 状态');
        this.character.playCurrentAnimation(AnimationState.WALK);
    }
    
    update(deltaTime: number): void {
        // 执行移动逻辑
        this.character.handleMovement(deltaTime);
    }
    
    exit(): void {
        console.log('[StateMachine] 离开 Walking 状态');
    }
    
    canTransitionTo(newState: CharacterState): boolean {
        return newState === CharacterState.IDLE || newState === CharacterState.ATTACKING || 
               newState === CharacterState.HURT || newState === CharacterState.DEAD;
    }
}

// 攻击状态
export class AttackingState extends State {
    private attackDuration: number = 0;
    private maxAttackDuration: number = 0.6; // 攻击持续时间（秒）
    
    enter(): void {
        console.log('[StateMachine] 进入 Attacking 状态');
        this.attackDuration = 0;
        
        // 根据角色配置计算攻击动画持续时间
        this.calculateAttackDuration();
        
        this.character.playAttackAnimation();
    }
    
    update(deltaTime: number): void {
        this.attackDuration += deltaTime;
        // 攻击状态下不处理移动，防止移动
    }
    
    exit(): void {
        console.log('[StateMachine] 离开 Attacking 状态');
        this.attackDuration = 0;
    }
    
    canTransitionTo(newState: CharacterState): boolean {
        // 攻击状态可以转换到任何状态（包括死亡和受伤）
        return true;
    }
    
    /**
     * 根据角色配置计算攻击动画持续时间
     */
    private calculateAttackDuration(): void {
        const enemyData = this.character.getEnemyData();
        if (enemyData) {
            // 从动画配置中计算持续时间（假设攻击动画为7帧，帧率12FPS）
            const frameCount = 7; // 这里可以从动画配置中动态获取
            const frameRate = 12;
            this.maxAttackDuration = frameCount / frameRate;
            console.log(`[StateMachine] 攻击动画持续时间: ${this.maxAttackDuration.toFixed(2)}秒`);
        }
    }
}

// 受伤状态
export class HurtState extends State {
    private animationFinished: boolean = false;
    
    enter(): void {
        console.log('[StateMachine] 进入 Hurt 状态');
        this.animationFinished = false;
        
        // 播放受伤动画，并注册完成回调
        this.character.playHurtAnimationWithCallback(() => {
            console.log('[StateMachine] 受伤动画完成，准备转换状态');
            this.animationFinished = true;
            this.handleAnimationFinished();
        });
    }
    
    update(deltaTime: number): void {
        // 受伤状态不需要在update中处理，完全依赖动画完成事件
    }
    
    exit(): void {
        console.log('[StateMachine] 离开 Hurt 状态');
        this.animationFinished = false;
    }
    
    canTransitionTo(newState: CharacterState): boolean {
        // 受伤状态可以被攻击和死亡状态立即打断，或者动画完成后可以转换
        return newState === CharacterState.ATTACKING || newState === CharacterState.DEAD || 
               this.animationFinished;
    }
    
    /**
     * 处理动画完成后的状态转换
     */
    private handleAnimationFinished(): void {
        // 检查是否有移动输入决定转换到哪个状态
        if (this.character.hasMovementInput()) {
            console.log('[StateMachine] 转换到行走状态');
            this.character.transitionToState(CharacterState.WALKING);
        } else {
            console.log('[StateMachine] 转换到待机状态');
            this.character.transitionToState(CharacterState.IDLE);
        }
    }
}

// 死亡状态
export class DeadState extends State {
    enter(): void {
        console.log('[StateMachine] 进入 Dead 状态');
        this.character.playDeathAnimation();
    }
    
    update(deltaTime: number): void {
        // 死亡状态不需要更新
    }
    
    exit(): void {
        console.log('[StateMachine] 离开 Dead 状态');
    }
    
    canTransitionTo(newState: CharacterState): boolean {
        // 死亡状态不可转换到其他状态
        return false;
    }
}

// 状态机管理器
export class StateMachine {
    private currentState: State | null = null;
    private states: Map<CharacterState, State> = new Map();
    private character: BaseCharacterDemo;
    
    constructor(character: BaseCharacterDemo) {
        this.character = character;
        this.initializeStates();
    }
    
    private initializeStates(): void {
        this.states.set(CharacterState.IDLE, new IdleState(this.character));
        this.states.set(CharacterState.WALKING, new WalkingState(this.character));
        this.states.set(CharacterState.ATTACKING, new AttackingState(this.character));
        this.states.set(CharacterState.HURT, new HurtState(this.character));
        this.states.set(CharacterState.DEAD, new DeadState(this.character));
    }
    
    public start(): void {
        this.transitionTo(CharacterState.IDLE);
    }
    
    public update(deltaTime: number): void {
        if (this.currentState) {
            this.currentState.update(deltaTime);
        }
    }
    
    public transitionTo(newState: CharacterState): boolean {
        const targetState = this.states.get(newState);
        if (!targetState) {
            console.warn(`[StateMachine] 状态 ${newState} 不存在`);
            return false;
        }
        
        // 检查是否可以转换
        if (this.currentState && !this.currentState.canTransitionTo(newState)) {
            const currentStateName = this.getCurrentStateName();
            console.log(`[StateMachine] 无法从当前状态 ${currentStateName} 转换到 ${newState}`);
            return false;
        }
        
        // 执行状态转换
        const previousState = this.getCurrentStateName();
        if (this.currentState) {
            this.currentState.exit();
        }
        
        this.currentState = targetState;
        this.currentState.enter();
        
        console.log(`[StateMachine] 状态转换: ${previousState} -> ${newState}`);
        return true;
    }
    
    public getCurrentState(): CharacterState | null {
        for (const [state, stateInstance] of this.states) {
            if (stateInstance === this.currentState) {
                return state;
            }
        }
        return null;
    }
    
    public getCurrentStateName(): string {
        const currentState = this.getCurrentState();
        return currentState ? currentState.toString() : 'null';
    }
    
    public isInState(state: CharacterState): boolean {
        return this.getCurrentState() === state;
    }
    
    public reset(): void {
        if (this.currentState) {
            this.currentState.exit();
        }
        this.currentState = null;
    }
}

/**
 * 角色演示基类
 * 支持对象池管理的角色演示系统
 */
@ccclass('BaseCharacterDemo')
export abstract class BaseCharacterDemo extends Component {

    @property({
        displayName: "移动速度",
        tooltip: "角色移动速度倍数"
    })
    protected moveSpeed: number = 200;

    @property({
        displayName: "角色ID",
        tooltip: "用于对象池管理的角色标识"
    })
    public characterId: string = '';

    @property({
        displayName: "是否启用对象池",
        tooltip: "是否使用对象池管理此角色"
    })
    public enablePooling: boolean = false;

    @property({
        type: Enum(ControlMode),
        displayName: "控制模式",
        tooltip: "MANUAL: 键盘手动控制, AI: 自动AI控制"
    })
    public controlMode: ControlMode = ControlMode.MANUAL;

    @property({
        displayName: "AI阵营",
        tooltip: "AI模式下的阵营 (enemy_left/enemy_right/player)"
    })
    public aiFaction: string = "enemy_left";

    @property({
        displayName: "AI行为类型",
        tooltip: "AI行为类型 (melee近战/ranged远程)"
    })
    public aiBehaviorType: string = "melee";

    // 核心组件
    protected animationComponent: Animation | null = null;
    protected spriteComponent: Sprite | null = null;
    protected characterStats: CharacterStats | null = null;
    
    // 敌人配置数据
    protected enemyData: EnemyData | null = null;
    
    // 状态机
    protected stateMachine: StateMachine | null = null;
    protected currentDirection: AnimationDirection = AnimationDirection.FRONT;
    
    // 输入状态
    protected keyStates: { [key: number]: boolean } = {};
    protected moveDirection: Vec2 = new Vec2(0, 0);
    
    // 攻击间隔控制
    protected lastAttackTime: number = 0;
    protected attackCooldown: number = 1.0; // 默认攻击间隔（秒）
    
    // AI相关属性
    protected aiConfig: AIConfig | null = null;
    protected currentTarget: Node | null = null;
    protected targetInfo: TargetInfo | null = null;
    protected lastTargetSearchTime: number = 0;
    protected targetSearchInterval: number = 1000; // 1秒搜索一次目标
    protected originalPosition: Vec3 = new Vec3(); // AI回归位置
    protected lastAIDebugTime: number = 0; // AI调试日志频率控制
    
    // 血条显示系统
    protected healthBarNode: Node | null = null;
    protected healthBarGraphics: Graphics | null = null;
    
    // 位置相关
    protected originalSpritePosition: Vec3 = new Vec3();
    
    // 对象池相关
    protected isFromPool: boolean = false;
    protected poolName: string = '';

    /**
     * 获取敌人配置ID - 子类必须实现
     */
    protected abstract getEnemyConfigId(): string;

    /**
     * 执行特殊攻击逻辑 - 子类可以重写
     */
    protected performSpecialAttack(): void {
        // 【修复】添加基础近战攻击伤害逻辑
        this.performMeleeAttack();
    }

    /**
     * 执行近战攻击伤害逻辑
     */
    protected performMeleeAttack(): void {
        if (!this.characterStats || !this.enemyData) {
            console.warn(`[${this.getCharacterDisplayName()}] 缺少必要组件，无法执行近战攻击`);
            return;
        }

        let targetToAttack: Node | null = null;
        let attackDamage = this.characterStats.baseAttack;

        // AI模式：攻击当前目标
        if (this.controlMode === ControlMode.AI && this.currentTarget) {
            const distance = Vec3.distance(this.node.position, this.currentTarget.position);
            const attackRange = this.aiConfig?.attackRange || this.enemyData.attackRange || 60;
            
            if (distance <= attackRange) {
                targetToAttack = this.currentTarget;
                console.log(`%c[MELEE] ${this.getCharacterDisplayName()} AI近战攻击目标: ${targetToAttack.name}`, 'color: red');
            } else {
                console.log(`%c[MELEE] ${this.getCharacterDisplayName()} 目标超出攻击范围 (${distance.toFixed(0)} > ${attackRange})`, 'color: orange');
            }
        }
        // 手动模式：搜索附近的敌人
        else if (this.controlMode === ControlMode.MANUAL) {
            targetToAttack = this.findNearestEnemy();
            if (targetToAttack) {
                console.log(`%c[MELEE] ${this.getCharacterDisplayName()} 手动近战攻击目标: ${targetToAttack.name}`, 'color: blue');
            }
        }

        // 对目标造成伤害
        if (targetToAttack) {
            this.dealDamageToTarget(targetToAttack, attackDamage);
        } else {
            console.log(`%c[MELEE] ${this.getCharacterDisplayName()} 攻击落空 - 没有有效目标`, 'color: gray');
        }
    }

    /**
     * 寻找最近的敌人（手动模式用）
     */
    protected findNearestEnemy(): Node | null {
        if (!this.enemyData) return null;

        const attackRange = this.enemyData.attackRange || 60;
        const selector = targetSelector.getInstance();
        if (!selector) return null;

        // 获取当前角色的阵营（手动模式通常是玩家阵营）
        let myFaction = Faction.PLAYER;
        
        // 查找最近的敌人
        const targetInfo = selector.findBestTarget(this.node.position, myFaction, attackRange);
        return targetInfo ? targetInfo.node : null;
    }

    /**
     * 对目标造成伤害
     */
    protected dealDamageToTarget(target: Node, damage: number): void {
        if (!target || !target.isValid) {
            console.warn(`[${this.getCharacterDisplayName()}] 无效的攻击目标`);
            return;
        }

        // 获取目标的BaseCharacterDemo组件来造成伤害
        const targetCharacterDemo = target.getComponent('BaseCharacterDemo');
        if (targetCharacterDemo && (targetCharacterDemo as any).takeDamage) {
            (targetCharacterDemo as any).takeDamage(damage);
            console.log(`%c[DAMAGE] ${this.getCharacterDisplayName()} 对 ${target.name} 造成 ${damage} 点伤害`, 'color: red; font-weight: bold');
        } else {
            // 如果没有BaseCharacterDemo，尝试CharacterStats组件
            const targetStats = target.getComponent('CharacterStats');
            if (targetStats && (targetStats as any).takeDamage) {
                (targetStats as any).takeDamage(damage);
                console.log(`%c[DAMAGE] ${this.getCharacterDisplayName()} 对 ${target.name} 造成 ${damage} 点伤害 (直接命中CharacterStats)`, 'color: red; font-weight: bold');
            } else {
                console.warn(`[${this.getCharacterDisplayName()}] 目标 ${target.name} 没有可攻击的组件`);
            }
        }
    }

    /**
     * 获取敌人数据配置
     */
    public getEnemyData(): EnemyData | null {
        return this.enemyData;
    }

    /**
     * 检查是否有移动输入
     */
    public hasMovementInput(): boolean {
        return this.moveDirection.length() > 0;
    }

    /**
     * 播放受伤动画
     */
    public playHurtAnimation(): void {
        this.playHurtAnimationWithCallback(null);
    }

    /**
     * 播放受伤动画并设置完成回调
     */
    public playHurtAnimationWithCallback(callback: (() => void) | null): void {
        if (!this.animationComponent || !this.enemyData) {
            console.warn(`[${this.getCharacterDisplayName()}] 动画组件或敌人数据未初始化`);
            if (callback) callback();
            return;
        }

        // 构建完整的动画名称
        const animationName = `${this.enemyData.assetNamePrefix}_${AnimationState.HURT}_${this.currentDirection}`;

        // 使用 AnimationManager 播放受伤动画
        const success = animationManager.playAnimation(this.animationComponent, animationName);
        
        if (success) {
            // 清除之前的监听器
            this.animationComponent.off(Animation.EventType.FINISHED);
            
            console.log(`[${this.getCharacterDisplayName()}] 播放受伤动画: ${animationName}`);
            
            // 设置受伤动画结束回调
            this.animationComponent.once(Animation.EventType.FINISHED, () => {
                console.log(`[${this.getCharacterDisplayName()}] 受伤动画结束: ${animationName}`);
                if (callback) {
                    callback();
                }
            });
        } else {
            console.warn(`[${this.getCharacterDisplayName()}] 受伤动画播放失败: ${animationName}`);
            if (callback) callback();
        }
    }

    /**
     * 播放死亡动画
     */
    public playDeathAnimation(): void {
        this.playCurrentAnimation(AnimationState.DEATH);
    }

    /**
     * 创建血条
     */
    private createHealthBar(): void {
        // 获取角色类型和基础血条配置
        const characterName = this.getCharacterDisplayName();
        const baseConfig = systemConfigManager.getHealthBarConfigForCharacter(characterName);
        
        // 获取角色的实际尺寸用于比例计算
        const uiTransform = this.node.getComponent(UITransform);
        const characterWidth = uiTransform ? uiTransform.contentSize.width : 64;
        const characterHeight = uiTransform ? uiTransform.contentSize.height : 64;
        
        // 计算最终血条配置（支持比例）
        const finalConfig = systemConfigManager.calculateFinalHealthBarConfig(
            baseConfig, 
            characterWidth, 
            characterHeight,
            this.enemyData
        );
        
        // 创建血条容器
        this.healthBarNode = new Node('HealthBar');
        this.healthBarNode.setParent(this.node);
        
        // 设置血条位置
        this.healthBarNode.setPosition(0, finalConfig.offsetY, 0);
        
        // 添加 UITransform 组件
        const transform = this.healthBarNode.addComponent(UITransform);
        transform.setContentSize(finalConfig.width, finalConfig.height);
        
        // 添加 Graphics 组件用于绘制血条
        this.healthBarGraphics = this.healthBarNode.addComponent(Graphics);
        
        // 绘制血条
        this.updateHealthBar();
        
        console.log(`[${this.getCharacterDisplayName()}] 血条已创建`);
        console.log(`- 角色类型: ${characterName}`);
        console.log(`- 血条配置: ${finalConfig.width}x${finalConfig.height}`);
        console.log(`- 血条位置: Y=${finalConfig.offsetY}px`);
        console.log(`- 角色尺寸: ${characterWidth}x${characterHeight}px`);
        console.log(`- 配置来源: ${baseConfig.width !== undefined ? '固定像素值' : '比例计算'}`);
    }

    /**
     * 更新血条显示
     */
    private updateHealthBar(): void {
        if (!this.healthBarGraphics || !this.characterStats || !this.healthBarNode) return;
        
        const currentHealth = this.characterStats.currentHealth;
        const maxHealth = this.characterStats.maxHealth;
        const healthPercent = maxHealth > 0 ? currentHealth / maxHealth : 0;
        
        // 获取血条的实际尺寸
        const healthBarTransform = this.healthBarNode.getComponent(UITransform);
        if (!healthBarTransform) return;
        
        const barWidth = healthBarTransform.contentSize.width;
        const barHeight = healthBarTransform.contentSize.height;
        const halfWidth = barWidth / 2;
        const halfHeight = barHeight / 2;
        
        // 清除之前的绘制
        this.healthBarGraphics.clear();
        
        // 绘制背景（深灰色边框）
        this.healthBarGraphics.strokeColor = new Color(30, 30, 30, 255);
        this.healthBarGraphics.lineWidth = 1;
        this.healthBarGraphics.rect(-halfWidth, -halfHeight, barWidth, barHeight);
        this.healthBarGraphics.stroke();
        
        // 绘制背景填充（深灰色）
        this.healthBarGraphics.fillColor = new Color(50, 50, 50, 255);
        this.healthBarGraphics.rect(-halfWidth, -halfHeight, barWidth, barHeight);
        this.healthBarGraphics.fill();
        
        // 绘制血量填充
        if (healthPercent > 0) {
            const fillWidth = barWidth * healthPercent;
            
            // 根据血量百分比选择颜色
            let fillColor: Color;
            if (healthPercent > 0.6) {
                fillColor = new Color(0, 255, 0, 255); // 绿色
            } else if (healthPercent > 0.3) {
                fillColor = new Color(255, 255, 0, 255); // 黄色
            } else {
                fillColor = new Color(255, 0, 0, 255); // 红色
            }
            
            this.healthBarGraphics.fillColor = fillColor;
            this.healthBarGraphics.rect(-halfWidth, -halfHeight, fillWidth, barHeight);
            this.healthBarGraphics.fill();
        }
        
        console.log(`[${this.getCharacterDisplayName()}] 血条更新: ${currentHealth}/${maxHealth} (${(healthPercent * 100).toFixed(1)}%)`);
        console.log(`- 血条尺寸: ${barWidth}x${barHeight}`);
    }



    /**
     * 受到伤害
     */
    public takeDamage(damage: number): void {
        if (!this.characterStats) return;
        
        const currentStateName = this.stateMachine?.getCurrentStateName() || 'unknown';
        console.log(`[${this.getCharacterDisplayName()}] 受到 ${damage} 点伤害前，当前状态: ${currentStateName}`);
        
        // 使用CharacterStats的takeDamage方法
        const isDead = this.characterStats.takeDamage(damage);
        
        // 显示伤害数字
        this.showDamageText(damage);
        
        // 更新血条
        this.updateHealthBar();
        
        console.log(`[${this.getCharacterDisplayName()}] 伤害处理结果: isDead=${isDead}, 血量: ${this.characterStats.currentHealth}/${this.characterStats.maxHealth}`);
        
        // 根据死亡状态决定状态转换
        if (!isDead) {
            console.log(`[${this.getCharacterDisplayName()}] 尝试转换到受伤状态`);
            this.stateMachine?.transitionTo(CharacterState.HURT);
        } else {
            console.log(`[${this.getCharacterDisplayName()}] 尝试转换到死亡状态`);
            const transitionResult = this.stateMachine?.transitionTo(CharacterState.DEAD);
            console.log(`[${this.getCharacterDisplayName()}] 死亡状态转换结果: ${transitionResult}`);
        }
        
        console.log(`[${this.getCharacterDisplayName()}] 受到 ${damage} 点伤害，当前血量: ${this.characterStats.currentHealth}/${this.characterStats.maxHealth}`);
    }

    /**
     * 显示伤害数字（使用PoolManager的伤害文字池）
     */
    private showDamageText(damage: number): void {
        // 从PoolManager获取伤害文字节点
        const damageNode = poolManager.getDamageTextNode(damage);
        
        if (!damageNode) {
            console.error(`[${this.getCharacterDisplayName()}] 无法从PoolManager获取伤害值 ${damage} 的显示节点`);
            return;
        }
        
        // 设置父节点
        damageNode.setParent(this.node.parent || this.node);
        
        // 激活节点
        damageNode.active = true;
        
        // 设置位置（在角色上方随机偏移）
        const randomX = (Math.random() - 0.5) * 40;
        damageNode.setPosition(this.node.position.x + randomX, this.node.position.y + 60, 0);
        
        // 文字内容已经在创建时设置好了，无需更新
        
        // 重置初始缩放
        damageNode.setScale(1, 1, 1);
        
        // 动画效果：向上飘动并逐渐消失
        tween(damageNode)
            .parallel(
                tween().by(0.5, { position: new Vec3(0, 50, 0) }),
                tween().delay(0.1).to(0.4, { scale: new Vec3(0.5, 0.5, 1) })
            )
            .call(() => {
                // 归还到PoolManager
                poolManager.returnDamageTextNode(damageNode);
            })
            .start();
    }

    /**
     * 伤害测试 - 按H键触发
     */
    private testDamage(): void {
        if (this.stateMachine?.isInState(CharacterState.DEAD)) {
            console.log(`[${this.getCharacterDisplayName()}] 角色已死亡，无法受伤`);
            return;
        }
        
        const damage = Math.floor(Math.random() * 10) + 1; // 1-10000点随机伤害
        this.takeDamage(damage);
    }

    /**
     * 死亡测试 - 按K键触发
     */
    private testDeath(): void {
        console.log(`[${this.getCharacterDisplayName()}] 执行死亡测试`);
        if (this.characterStats) {
            // 直接造成致命伤害
            this.characterStats.takeDamage(this.characterStats.maxHealth);
            this.updateHealthBar();
            this.stateMachine?.transitionTo(CharacterState.DEAD);
        }
    }

    /**
     * 获取角色显示名称 - 子类可以重写
     */
    protected getCharacterDisplayName(): string {
        return this.getEnemyConfigId();
    }

    /**
     * 初始化AI配置
     */
    public initializeAI(enemyData: EnemyData, aiConfig: AIConfig): void {
        if (this.controlMode !== ControlMode.AI) {
            console.warn(`[${this.getCharacterDisplayName()}] 不是AI模式，无法初始化AI配置`);
            return;
        }

        this.aiConfig = aiConfig;
        this.enemyData = enemyData;
        
        // 保存初始位置用于AI回归
        this.originalPosition.set(this.node.position);

        console.log(`[${this.getCharacterDisplayName()}] AI配置已初始化 - 阵营: ${aiConfig.faction}, 行为: ${aiConfig.behaviorType}`);
        console.log(`  探测范围: ${aiConfig.detectionRange}, 攻击范围: ${aiConfig.attackRange}`);
        
        // 【新增】通知TargetSelector有新的AI角色加入
        this.scheduleOnce(() => {
            const selector = targetSelector.getInstance();
            if (selector) {
                (selector as any).updateTargetCache?.();
                console.log(`%c[AI] ${this.getCharacterDisplayName()} 已通知TargetSelector更新缓存`, 'color: cyan');
            }
        }, 0.1);
    }

    /**
     * AI目标搜索
     */
    private updateAITargetSearch(): void {
        if (!this.aiConfig) return;

        const currentTime = Date.now();
        if (currentTime - this.lastTargetSearchTime < this.targetSearchInterval) {
            return;
        }

        this.lastTargetSearchTime = currentTime;

        const selector = targetSelector.getInstance();
        if (!selector) {
            console.warn(`[${this.getCharacterDisplayName()}] TargetSelector不可用`);
            return;
        }

        // 搜索最佳目标
        const bestTarget = selector.findBestTarget(
            this.node.position,
            this.aiConfig.faction,
            this.aiConfig.detectionRange
        );

        // 更新目标
        if (bestTarget && bestTarget.node !== this.currentTarget) {
            console.log(`%c[AI] ${this.getCharacterDisplayName()} 发现新目标: ${bestTarget.node.name}`, 'color: cyan');
            this.currentTarget = bestTarget.node;
            this.targetInfo = bestTarget;
        } else if (this.currentTarget) {
            // 检查当前目标是否仍然有效
            const targetStats = this.currentTarget.getComponent(CharacterStats);
            const distance = Vec3.distance(this.node.position, this.currentTarget.position);

            if (!targetStats || !targetStats.isAlive || distance > this.aiConfig.pursuitRange) {
                console.log(`%c[AI] ${this.getCharacterDisplayName()} 目标失效，清除目标`, 'color: orange');
                this.currentTarget = null;
                this.targetInfo = null;
            }
        }
    }

    /**
     * AI移动决策
     */
    private updateAIMovement(): void {
        if (!this.aiConfig || !this.currentTarget) {
            // 没有目标时，检查是否需要回到原位
            const distanceFromHome = Vec3.distance(this.node.position, this.originalPosition);
            const returnDistance = this.aiConfig?.returnDistance || 100;
            if (distanceFromHome > returnDistance) {
                this.setAIMoveDirection(this.originalPosition);
                return;
            } else {
                // 已经在原位附近，停止移动
                this.moveDirection.set(0, 0);
                return;
            }
        }

        const distance = Vec3.distance(this.node.position, this.currentTarget.position);
        
        // 如果在攻击范围内，停止移动
        if (distance <= this.aiConfig.attackRange) {
            this.moveDirection.set(0, 0);
            return;
        }

        // 如果超出追击范围，返回原位
        if (distance > this.aiConfig.pursuitRange) {
            console.log(`%c[AI] ${this.getCharacterDisplayName()} 目标超出追击范围，返回原位`, 'color: yellow');
            this.currentTarget = null;
            this.setAIMoveDirection(this.originalPosition);
            return;
        }

        // 移动向目标
        this.setAIMoveDirection(this.currentTarget.position);
    }

    /**
     * 设置AI移动方向
     */
    private setAIMoveDirection(targetPosition: Vec3): void {
        const direction = new Vec3();
        Vec3.subtract(direction, targetPosition, this.node.position);
        
        if (direction.length() < 10) {
            this.moveDirection.set(0, 0);
            return;
        }
        
        direction.normalize();
        this.moveDirection.set(direction.x, direction.y);
        
        // 更新角色朝向
        this.updateDirection();
    }

    /**
     * AI攻击决策
     */
    private updateAIAttack(): void {
        if (!this.aiConfig || !this.currentTarget) return;

        const distance = Vec3.distance(this.node.position, this.currentTarget.position);
        
        // 检查是否在攻击范围内
        if (distance <= this.aiConfig.attackRange) {
            // 检查攻击冷却
            const currentTime = Date.now() / 1000;
            if (currentTime - this.lastAttackTime >= this.attackCooldown) {
                console.log(`%c[AI] ${this.getCharacterDisplayName()} 开始攻击 ${this.currentTarget.name}`, 'color: red');
                this.aiTryAttack();
            }
        }
    }

    /**
     * AI攻击执行
     */
    private aiTryAttack(): void {
        // 直接调用现有的攻击逻辑
        this.tryAttack();
    }

    async onLoad() {
        console.log(`[${this.getCharacterDisplayName()}] 开始初始化角色演示（状态机版本）...`);
        
        // 等待数据管理器加载完成
        await this.waitForDataManager();
        
        // 加载角色配置
        this.loadEnemyConfig();
        
        // 设置组件
        this.setupComponents();
        
        // 设置输入系统
        this.setupInput();
        
        // 使用 AnimationManager 加载资源和创建动画
        await this.setupAnimationsWithManager();
        
        // 检查是否已有HealthBarComponent，如果没有则创建内置血条
        const healthBarComponent = this.node.getComponent('HealthBarComponent');
        if (!healthBarComponent) {
            this.createHealthBar();
        } else {
            console.log(`[${this.getCharacterDisplayName()}] 检测到HealthBarComponent，跳过内置血条创建`);
        }
        
        // 初始化状态机
        this.stateMachine = new StateMachine(this);
        this.stateMachine.start();

        console.log(`[${this.getCharacterDisplayName()}] 初始化完成！`);
        console.log('🎮 控制说明：WSAD移动，J键攻击（攻击时无法移动），H键受伤测试，K键死亡测试');
    }

    /**
     * 使用 AnimationManager 设置动画
     */
    private async setupAnimationsWithManager(): Promise<void> {
        if (!this.enemyData) {
            console.error(`[${this.getCharacterDisplayName()}] 无敌人配置数据，无法设置动画`);
            return;
        }

        try {
            // 使用 AnimationManager 创建所有动画剪辑
            const animationClips = await animationManager.createAllAnimationClips(this.enemyData);
            
            if (animationClips.size === 0) {
                console.warn(`[${this.getCharacterDisplayName()}] 没有创建任何动画剪辑`);
                return;
            }

            // 使用 AnimationManager 设置动画组件
            this.animationComponent = animationManager.setupAnimationComponent(this.node, animationClips);
            
            console.log(`[${this.getCharacterDisplayName()}] 通过 AnimationManager 成功创建 ${animationClips.size} 个动画剪辑`);
        } catch (error) {
            console.error(`[${this.getCharacterDisplayName()}] 动画设置失败:`, error);
        }
    }

    /**
     * 等待数据管理器加载完成（事件驱动方式）
     */
    private async waitForDataManager(): Promise<void> {
        // 检查数据是否已经加载
        if (dataManager.isDataLoaded()) {
            console.log(`[${this.getCharacterDisplayName()}] 数据已加载，无需等待`);
            return;
        }
        
        console.log(`[${this.getCharacterDisplayName()}] 等待数据加载完成...`);
        
        // 使用事件监听方式等待数据加载完成
        return new Promise((resolve) => {
            const onDataLoaded = () => {
                console.log(`[${this.getCharacterDisplayName()}] 数据加载完成`);
                // 移除监听器
                eventManager.off(GameEvents.GAME_DATA_LOADED, onDataLoaded);
                resolve();
            };
            
            // 监听数据加载完成事件
            eventManager.on(GameEvents.GAME_DATA_LOADED, onDataLoaded);
            
            // 备用方案：如果事件系统不可用，手动触发数据加载
            if (!dataManager.isDataLoaded()) {
                dataManager.loadAllData().then(() => {
                    onDataLoaded();
                }).catch((error) => {
                    console.error(`[${this.getCharacterDisplayName()}] 数据加载失败:`, error);
                    // 即使失败也要resolve，避免永久等待
                    onDataLoaded();
                });
            }
        });
    }

    /**
     * 加载角色敌人配置
     */
    private loadEnemyConfig(): void {
        const configId = this.getEnemyConfigId();
        this.enemyData = dataManager.getEnemyData(configId);
        if (this.enemyData) {
            // 设置攻击冷却时间
            this.attackCooldown = this.enemyData.attackInterval;
            
            // 初始化CharacterStats组件
            if (this.characterStats) {
                this.characterStats.initWithEnemyData(this.enemyData);
            }
            
            console.log(`[${this.getCharacterDisplayName()}] 成功加载配置:`, this.enemyData.name);
            console.log(`[${this.getCharacterDisplayName()}] 攻击间隔: ${this.attackCooldown}秒, 血量: ${this.enemyData.baseHealth}, 移动速度: ${this.enemyData.moveSpeed}`);
        } else {
            console.error(`[${this.getCharacterDisplayName()}] 无法加载配置 ${configId}`);
        }
    }

    private setupComponents() {
        // 获取或添加当前节点的Sprite组件
        this.spriteComponent = this.getComponent(Sprite) || this.addComponent(Sprite);
        
        // 获取或添加CharacterStats组件
        this.characterStats = this.getComponent(CharacterStats) || this.addComponent(CharacterStats);
        
        // 保存节点的原始位置
        this.originalSpritePosition.set(this.node.position);
        console.log(`[${this.getCharacterDisplayName()}] 已保存节点原始位置:`, this.originalSpritePosition);
        
        this.animationComponent = this.getComponent(Animation) || this.addComponent(Animation);
        console.log(`[${this.getCharacterDisplayName()}] Animation 组件已准备就绪`);
        console.log(`[${this.getCharacterDisplayName()}] Sprite组件已配置`);
        console.log(`[${this.getCharacterDisplayName()}] CharacterStats组件已配置`);
    }

    /**
     * 设置输入系统
     */
    protected setupInput(): void {
        // 只有手动模式才监听键盘输入
        if (this.controlMode === ControlMode.MANUAL) {
            input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
            input.on(Input.EventType.KEY_UP, this.onKeyUp, this);
            console.log(`[${this.getCharacterDisplayName()}] 手动控制输入系统已设置`);
        } else {
            console.log(`[${this.getCharacterDisplayName()}] AI模式，跳过输入系统设置`);
        }
    }

    /**
     * 按键按下处理
     */
    private onKeyDown = (event: EventKeyboard): void => {
        this.keyStates[event.keyCode] = true;
        
        // J键攻击 - 只有在非攻击状态才能攻击
        if (event.keyCode === KeyCode.KEY_J) {
            this.tryAttack();
        }
        
        // H键受伤测试
        if (event.keyCode === KeyCode.KEY_H) {
            this.testDamage();
        }
        
        // K键死亡测试
        if (event.keyCode === KeyCode.KEY_K) {
            this.testDeath();
        }
        
        // 更新移动方向（WSAD）- 始终更新移动方向，但状态转换在updateMoveDirection中控制
        this.updateMoveDirection();
    }

    /**
     * 按键松开处理  
     */
    private onKeyUp = (event: EventKeyboard): void => {
        this.keyStates[event.keyCode] = false;
        
        // 始终更新移动方向，但状态转换在updateMoveDirection中控制
        this.updateMoveDirection();
    }

    /**
     * 尝试攻击
     */
    private tryAttack(): void {
        // 检查是否在攻击状态中
        if (this.stateMachine?.isInState(CharacterState.ATTACKING)) {
            console.log(`[${this.getCharacterDisplayName()}] 正在攻击中，无法重复攻击`);
            return;
        }
        
        // 检查攻击冷却时间
        const currentTime = Date.now() / 1000;
        if (currentTime - this.lastAttackTime < this.attackCooldown) {
            const remainingCooldown = this.attackCooldown - (currentTime - this.lastAttackTime);
            console.log(`[${this.getCharacterDisplayName()}] 攻击冷却中，剩余时间: ${remainingCooldown.toFixed(1)}秒`);
            return;
        }
        
        // 记录攻击时间
        this.lastAttackTime = currentTime;
        console.log(`[${this.getCharacterDisplayName()}] 发起攻击，下次攻击间隔: ${this.attackCooldown}秒`);
        
        this.stateMachine?.transitionTo(CharacterState.ATTACKING);
    }

    /**
     * 更新移动方向
     */
    private updateMoveDirection(): void {
        this.moveDirection.set(0, 0);
        
        // WSAD 移动
        if (this.keyStates[KeyCode.KEY_A]) this.moveDirection.x -= 1;
        if (this.keyStates[KeyCode.KEY_D]) this.moveDirection.x += 1;
        if (this.keyStates[KeyCode.KEY_W]) this.moveDirection.y += 1;
        if (this.keyStates[KeyCode.KEY_S]) this.moveDirection.y -= 1;
        
        // 归一化方向向量
        if (this.moveDirection.length() > 0) {
            this.moveDirection.normalize();
        }
        
        // 根据移动方向更新角色朝向
        if (this.moveDirection.length() > 0) {
            this.updateDirection();
        }
        
        // 只有在非攻击状态下才根据移动状态切换状态机
        if (!this.stateMachine?.isInState(CharacterState.ATTACKING)) {
            const isMoving = this.moveDirection.length() > 0;
            if (isMoving && !this.stateMachine?.isInState(CharacterState.WALKING)) {
                this.stateMachine?.transitionTo(CharacterState.WALKING);
            } else if (!isMoving && this.stateMachine?.isInState(CharacterState.WALKING)) {
                this.stateMachine?.transitionTo(CharacterState.IDLE);
            }
        }
    }

    /**
     * 根据移动方向更新角色朝向
     */
    private updateDirection(): void {
        const prevDirection = this.currentDirection;
        
        if (Math.abs(this.moveDirection.x) > Math.abs(this.moveDirection.y)) {
            // 水平方向为主
            this.currentDirection = this.moveDirection.x > 0 ? AnimationDirection.RIGHT : AnimationDirection.LEFT;
        } else {
            // 垂直方向为主
            this.currentDirection = this.moveDirection.y > 0 ? AnimationDirection.BACK : AnimationDirection.FRONT;
        }
        
        // 如果方向改变了且在行走状态，重新播放动画
        if (prevDirection !== this.currentDirection && this.stateMachine?.isInState(CharacterState.WALKING)) {
            this.playCurrentAnimation(AnimationState.WALK);
        }
    }

    /**
     * 播放当前方向的指定动画
     */
    public playCurrentAnimation(state: AnimationState): void {
        if (!this.animationComponent || !this.enemyData) {
            console.warn(`[${this.getCharacterDisplayName()}] 动画组件或敌人数据未初始化`);
            return;
        }

        // 构建完整的动画名称
        const animationName = `${this.enemyData.assetNamePrefix}_${state}_${this.currentDirection}`;

        // 使用 AnimationManager 播放动画
        const success = animationManager.playAnimation(this.animationComponent, animationName);
        
        if (success) {
            console.log(`[${this.getCharacterDisplayName()}] 播放动画: ${animationName}`);
        } else {
            console.warn(`[${this.getCharacterDisplayName()}] 动画播放失败: ${animationName}`);
        }
    }

    /**
     * 播放攻击动画并处理结束回调
     */
    public playAttackAnimation(): void {
        if (!this.animationComponent || !this.enemyData) {
            console.warn(`[${this.getCharacterDisplayName()}] 动画组件或敌人数据未初始化`);
            this.determineStateAfterAttack();
            return;
        }

        // 构建完整的动画名称
        const animationName = `${this.enemyData.assetNamePrefix}_${AnimationState.ATTACK}_${this.currentDirection}`;

        // 使用 AnimationManager 播放攻击动画
        const success = animationManager.playAnimation(this.animationComponent, animationName);
        
        if (success) {
            // 清除之前的监听器
            this.animationComponent.off(Animation.EventType.FINISHED);
            
            console.log(`[${this.getCharacterDisplayName()}] 播放攻击动画: ${animationName}`);
            
            // 执行特殊攻击逻辑（子类可重写）
            this.performSpecialAttack();
            
            // 设置攻击动画结束回调
            this.animationComponent.once(Animation.EventType.FINISHED, () => {
                console.log(`[${this.getCharacterDisplayName()}] 攻击动画结束: ${animationName}`);
                // 根据当前按键状态决定进入的状态
                this.determineStateAfterAttack();
            });
        } else {
            console.warn(`[${this.getCharacterDisplayName()}] 攻击动画播放失败: ${animationName}`);
            // 如果动画播放失败，也根据当前按键状态决定状态
            this.determineStateAfterAttack();
        }
    }

    /**
     * 攻击结束后根据当前按键状态决定进入的状态
     */
    private determineStateAfterAttack(): void {
        // 重新检查当前按键状态
        this.updateMoveDirection();
        
        if (this.stateMachine) {
            // 根据当前移动方向决定状态
            if (this.moveDirection.length() > 0) {
                // 有移动输入，进入行走状态
                console.log(`[${this.getCharacterDisplayName()}] 攻击结束，检测到移动输入，进入行走状态`);
                this.stateMachine.transitionTo(CharacterState.WALKING);
            } else {
                // 没有移动输入，进入待机状态
                console.log(`[${this.getCharacterDisplayName()}] 攻击结束，无移动输入，进入待机状态`);
                this.stateMachine.transitionTo(CharacterState.IDLE);
            }
        }
    }

    /**
     * 状态机转换接口
     */
    public transitionToState(state: CharacterState): void {
        this.stateMachine?.transitionTo(state);
    }

    /**
     * 更新函数 - 支持AI和手动模式
     */
    protected update(deltaTime: number): void {
        // AI模式下的更新逻辑
        if (this.controlMode === ControlMode.AI && this.characterStats?.isAlive) {
            this.updateAI(deltaTime);
        }

        // 让状态机处理当前状态（无论是AI设置的移动方向还是手动输入的移动方向）
        if (this.stateMachine) {
            this.stateMachine.update(deltaTime);
        }
    }

    /**
     * AI主更新逻辑
     */
    private updateAI(deltaTime: number): void {
        // 【调试】减少AI更新日志频率（每3秒打印一次）
        const currentTime = Date.now();
        if (currentTime - this.lastAIDebugTime > 3000) {
            console.log(`%c[AI UPDATE] ${this.getCharacterDisplayName()} AI更新中...`, 'color: lightblue');
            this.lastAIDebugTime = currentTime;
        }
        
        // 1. 搜索目标
        this.updateAITargetSearch();
        
        // 2. 移动决策
        this.updateAIMovement();
        
        // 3. 攻击决策
        this.updateAIAttack();
        
        // 4. 根据移动状态更新状态机（复用现有逻辑）
        this.updateAIStateMachine();
    }

    /**
     * AI状态机更新
     */
    private updateAIStateMachine(): void {
        // 让现有的移动方向系统驱动状态机转换
        const isMoving = this.moveDirection.length() > 0;
        
        if (!this.stateMachine?.isInState(CharacterState.ATTACKING)) {
            if (isMoving && !this.stateMachine?.isInState(CharacterState.WALKING)) {
                this.stateMachine?.transitionTo(CharacterState.WALKING);
            } else if (!isMoving && this.stateMachine?.isInState(CharacterState.WALKING)) {
                this.stateMachine?.transitionTo(CharacterState.IDLE);
            }
        }
    }

    /**
     * 处理角色移动 - 由状态机调用
     */
    public handleMovement(deltaTime: number): void {
        if (!this.enemyData || this.moveDirection.length() === 0) return;
        
        // 使用配置中的移动速度
        const speed = this.enemyData.moveSpeed * this.moveSpeed;
        const moveDistance = speed * deltaTime;
        
        // 计算新位置
        const currentPos = this.node.position;
        const newPos = new Vec3(
            currentPos.x + this.moveDirection.x * moveDistance,
            currentPos.y + this.moveDirection.y * moveDistance,
            currentPos.z
        );
        
        // 简单边界检查
        newPos.x = Math.max(-960, Math.min(960, newPos.x));
        newPos.y = Math.max(-540, Math.min(540, newPos.y));
        
        // 应用新位置
        this.node.position = newPos;
    }

    // ============= 对象池管理相关方法 =============

    /**
     * 从对象池创建角色实例
     * @param poolName 对象池名称
     * @param characterId 角色ID
     * @returns 角色节点
     */
    public static createFromPool(poolName: string, characterId: string): Node | null {
        const node = poolManager.get(poolName);
        if (node) {
            const character = node.getComponent(BaseCharacterDemo);
            if (character) {
                character.setPoolingProperties(true, poolName, characterId);
                character.onReuseFromPool();
            }
        }
        return node;
    }

    /**
     * 设置对象池属性
     */
    public setPoolingProperties(isFromPool: boolean, poolName: string, characterId: string): void {
        this.isFromPool = isFromPool;
        this.poolName = poolName;
        this.characterId = characterId;
        this.enablePooling = true;
    }

    /**
     * 回收到对象池
     */
    public returnToPool(): void {
        if (this.isFromPool && this.poolName) {
            this.onRecycleToPool();
            poolManager.put(this.node);
        } else {
            console.warn(`[${this.getCharacterDisplayName()}] 非池化对象，无法回收到对象池`);
        }
    }

    /**
     * 从池中重用时的回调
     */
    public onReuseFromPool(): void {
        console.log(`[${this.getCharacterDisplayName()}] 从对象池重用 ID: ${this.characterId}`);
        
        // 重置状态
        this.resetCharacterState();
        
        // 激活节点
        this.node.active = true;
        
        // 重新设置输入（因为可能在回收时被清理）
        this.setupInput();
        
        // 启动状态机
        if (this.stateMachine) {
            this.stateMachine.start();
        }
    }

    /**
     * 回收到池时的回调
     */
    public onRecycleToPool(): void {
        console.log(`[${this.getCharacterDisplayName()}] 回收到对象池 ID: ${this.characterId}`);
        
        // 清理输入监听
        this.cleanupInput();
        
        // 停止动画
        if (this.animationComponent) {
            this.animationComponent.stop();
        }
        
        // 重置状态机
        if (this.stateMachine) {
            this.stateMachine.reset();
        }
        
        // 重置位置和状态
        this.resetCharacterState();
    }

    /**
     * 重置角色状态
     */
    protected resetCharacterState(): void {
        // 重置位置
        this.node.position = this.originalSpritePosition.clone();
        
        // 重置方向
        this.currentDirection = AnimationDirection.FRONT;
        
        // 重置输入状态
        this.keyStates = {};
        this.moveDirection.set(0, 0);
        
        // 重置攻击时间
        this.lastAttackTime = 0;
        
        // 重置血量
        if (this.characterStats) {
            this.characterStats.reset();
            this.updateHealthBar();
        }
        
        console.log(`[${this.getCharacterDisplayName()}] 角色状态已重置`);
    }

    /**
     * 清理输入监听
     */
    protected cleanupInput(): void {
        // 只有手动模式才需要清理输入监听
        if (this.controlMode === ControlMode.MANUAL) {
            input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
            input.off(Input.EventType.KEY_UP, this.onKeyUp, this);
        }
    }

    /**
     * 获取角色是否来自对象池
     */
    public getIsFromPool(): boolean {
        return this.isFromPool;
    }

    /**
     * 获取对象池名称
     */
    public getPoolName(): string {
        return this.poolName;
    }

    /**
     * 获取AI当前目标（供外部查询）
     */
    public getAICurrentTarget(): Node | null {
        return this.currentTarget;
    }

    /**
     * 获取AI当前状态（供外部查询）
     */
    public getAICurrentState(): string {
        if (!this.stateMachine) {
            // console.warn(`[${this.getCharacterDisplayName()}] 状态机未初始化`);
            return 'no_state_machine';
        }
        
        const currentState = this.stateMachine.getCurrentStateName();
        // console.log(`[${this.getCharacterDisplayName()}] 当前状态查询: ${currentState}`);
        return currentState;
    }

    onDestroy() {
        // 清理输入监听
        this.cleanupInput();
        
        // 停止动画
        if (this.animationComponent) {
            this.animationComponent.stop();
        }
        
        console.log(`[${this.getCharacterDisplayName()}] 组件已清理`);
    }
} 