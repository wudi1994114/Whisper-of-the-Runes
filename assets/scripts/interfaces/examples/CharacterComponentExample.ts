// assets/scripts/interfaces/examples/CharacterComponentExample.ts

/**
 * 使用新接口系统重构角色的示例
 * 
 * 本文件展示了如何将原有的BaseCharacterDemo按照ECS模式重构为多个组件，
 * 每个组件实现特定的接口，负责单一职责。
 */

import { Component, Vec2, Vec3, RigidBody2D, Animation, Sprite, Graphics, Node } from 'cc';
import { 
    IMovable, 
    ICombat, 
    IAnimatable, 
    ILifecycle, 
    IControllable, 
    IFactional, 
    IConfigurable, 
    IRenderable,
    ICharacter,
    IAttackResult,
    IInputSignals
} from '../index';

import { ControlMode, CharacterState } from '../../state-machine/CharacterEnums';
import { AnimationState, AnimationDirection } from '../../configs/AnimationConfig';
import { Faction } from '../../configs/FactionConfig';
import { EnemyData } from '../../configs/EnemyConfig';

/**
 * 移动组件实现
 */
export class MovementComponent extends Component implements IMovable {
    public moveSpeed: number = 150;
    public moveDirection: Vec2 = new Vec2(0, 0);
    public rigidBody: RigidBody2D | null = null;

    handleMovement(deltaTime: number): void {
        // 移动逻辑实现
        if (!this.rigidBody || this.moveDirection.length() === 0) {
            this.stopMovement();
            return;
        }

        const normalizedDirection = this.moveDirection.clone().normalize();
        const velocity = normalizedDirection.multiplyScalar(this.moveSpeed);
        this.rigidBody.linearVelocity = velocity;
    }

    stopMovement(): void {
        if (this.rigidBody) {
            this.rigidBody.linearVelocity = new Vec2(0, 0);
        }
        this.moveDirection.set(0, 0);
    }

    stopPhysicalMovement(): void {
        if (this.rigidBody) {
            this.rigidBody.linearVelocity = new Vec2(0, 0);
        }
    }

    setNodePosition(x: number, y: number, z?: number): void {
        this.node.setPosition(x, y, z || this.node.position.z);
    }

    hasMovementInput(): boolean {
        return this.moveDirection.lengthSqr() > 0.01;
    }

    getMoveSpeed(): number {
        return this.moveSpeed;
    }

    getRigidBody(): RigidBody2D | null {
        return this.rigidBody;
    }
}

/**
 * 战斗组件实现
 */
export class CombatComponent extends Component implements ICombat {
    public attackCooldown: number = 1.0;
    public lastAttackTime: number = 0;
    public currentTarget: Node | null = null;
    public wantsToAttack: boolean = false;

    performSpecialAttack(): IAttackResult | null {
        // 特殊攻击逻辑
        const target = this.findNearestEnemy();
        if (target) {
            return this.dealDamageToTarget(target, 100);
        }
        return null;
    }

    performSpecialAttackWithTarget(): IAttackResult | null {
        if (this.currentTarget) {
            return this.dealDamageToTarget(this.currentTarget, 100);
        }
        return null;
    }

    performMeleeAttack(): IAttackResult | null {
        // 近战攻击逻辑
        const target = this.findNearestEnemy();
        if (target) {
            return this.dealDamageToTarget(target, 50);
        }
        return null;
    }

    performMeleeAttackWithTarget(): IAttackResult | null {
        if (this.currentTarget) {
            return this.dealDamageToTarget(this.currentTarget, 50);
        }
        return null;
    }

    performRangedAttack(): void {
        // 远程攻击逻辑
        console.log('执行远程攻击');
    }

    findNearestEnemy(): Node | null {
        // 寻找最近敌人的逻辑
        return null;
    }

    dealDamageToTarget(target: Node, damage: number): IAttackResult | null {
        // 造成伤害的逻辑
        console.log(`对 ${target.name} 造成 ${damage} 点伤害`);
        return { isDead: false, isStunned: false, target };
    }

    takeDamage(damage: number): void {
        console.log(`承受 ${damage} 点伤害`);
    }

    activateInvincibility(duration: number): void {
        console.log(`激活 ${duration} 秒无敌状态`);
    }
}

/**
 * 动画组件实现
 */
export class AnimationComponent extends Component implements IAnimatable {
    public animationComponent: Animation | null = null;
    public currentDirection: AnimationDirection = AnimationDirection.FRONT;

    playCurrentAnimation(state: AnimationState): void {
        console.log(`播放动画: ${state}`);
    }

    playAttackAnimation(onFinished?: () => void): void {
        console.log('播放攻击动画');
        if (onFinished) {
            // 模拟动画完成
            setTimeout(onFinished, 500);
        }
    }

    playHurtAnimation(): void {
        console.log('播放受伤动画');
    }

    playHurtAnimationWithCallback(callback: (() => void) | null): void {
        console.log('播放受伤动画（带回调）');
        if (callback) {
            setTimeout(callback, 300);
        }
    }

    playDeathAnimation(): void {
        console.log('播放死亡动画');
    }

    updateDirectionTowards(targetPosition: any): void {
        // 更新角色朝向逻辑
        console.log('更新角色朝向');
    }
}

/**
 * 重构后的角色类示例
 * 使用组合模式，将各个功能组件组合成完整的角色
 */
export class ModularCharacter extends Component implements ICharacter {
    // 组件引用
    private movementComponent: MovementComponent;
    private combatComponent: CombatComponent;
    private animationComponent: AnimationComponent;
    
    // ICharacter 基础属性
    public readonly id: string = '';
    public readonly name: string = '';
    
    // 实现各个接口的方法，委托给对应的组件
    
    // IMovable 接口实现 - 委托给 MovementComponent
    get moveSpeed(): number { return this.movementComponent.moveSpeed; }
    get moveDirection(): Vec2 { return this.movementComponent.moveDirection; }
    get rigidBody(): RigidBody2D | null { return this.movementComponent.rigidBody; }
    
    handleMovement(deltaTime: number): void {
        this.movementComponent.handleMovement(deltaTime);
    }
    
    stopMovement(): void {
        this.movementComponent.stopMovement();
    }
    
    stopPhysicalMovement(): void {
        this.movementComponent.stopPhysicalMovement();
    }
    
    setNodePosition(x: number, y: number, z?: number): void {
        this.movementComponent.setNodePosition(x, y, z);
    }
    
    hasMovementInput(): boolean {
        return this.movementComponent.hasMovementInput();
    }
    
    getMoveSpeed(): number {
        return this.movementComponent.getMoveSpeed();
    }
    
    getRigidBody(): RigidBody2D | null {
        return this.movementComponent.getRigidBody();
    }
    
    // ICombat 接口实现 - 委托给 CombatComponent
    get attackCooldown(): number { return this.combatComponent.attackCooldown; }
    get lastAttackTime(): number { return this.combatComponent.lastAttackTime; }
    get currentTarget(): Node | null { return this.combatComponent.currentTarget; }
    get wantsToAttack(): boolean { return this.combatComponent.wantsToAttack; }
    
    performSpecialAttack(): IAttackResult | null {
        return this.combatComponent.performSpecialAttack();
    }
    
    performSpecialAttackWithTarget(): IAttackResult | null {
        return this.combatComponent.performSpecialAttackWithTarget();
    }
    
    performMeleeAttack(): IAttackResult | null {
        return this.combatComponent.performMeleeAttack();
    }
    
    performMeleeAttackWithTarget(): IAttackResult | null {
        return this.combatComponent.performMeleeAttackWithTarget();
    }
    
    performRangedAttack(): void {
        this.combatComponent.performRangedAttack();
    }
    
    findNearestEnemy(): Node | null {
        return this.combatComponent.findNearestEnemy();
    }
    
    dealDamageToTarget(target: Node, damage: number): IAttackResult | null {
        return this.combatComponent.dealDamageToTarget(target, damage);
    }
    
    takeDamage(damage: number): void {
        this.combatComponent.takeDamage(damage);
    }
    
    activateInvincibility(duration: number): void {
        this.combatComponent.activateInvincibility(duration);
    }
    
    // IAnimatable 接口实现 - 委托给 AnimationComponent
    get animationComponent(): Animation | null { return this.animationComponent.animationComponent; }
    get currentDirection(): AnimationDirection { return this.animationComponent.currentDirection; }
    
    playCurrentAnimation(state: AnimationState): void {
        this.animationComponent.playCurrentAnimation(state);
    }
    
    playAttackAnimation(onFinished?: () => void): void {
        this.animationComponent.playAttackAnimation(onFinished);
    }
    
    playHurtAnimation(): void {
        this.animationComponent.playHurtAnimation();
    }
    
    playHurtAnimationWithCallback(callback: (() => void) | null): void {
        this.animationComponent.playHurtAnimationWithCallback(callback);
    }
    
    playDeathAnimation(): void {
        this.animationComponent.playDeathAnimation();
    }
    
    updateDirectionTowards(targetPosition: any): void {
        this.animationComponent.updateDirectionTowards(targetPosition);
    }
    
    // 其他接口的简化实现（生产环境中需要完整实现）
    characterId: string = '';
    isFromPool: boolean = false;
    poolName: string = '';
    controlMode: ControlMode = ControlMode.MANUAL;
    currentInputSignals: IInputSignals = { hasMovementInput: false, wantsToAttack: false };
    aiFaction: string = 'red';
    enemyData: EnemyData | null = null;
    aiBehaviorType: string = 'melee';
    spriteComponent: Sprite | null = null;
    healthBarNode: Node | null = null;
    healthBarGraphics: Graphics | null = null;
    
    // 简化的方法实现
    isAlive(): boolean { return true; }
    setPoolingProperties(isFromPool: boolean, poolName: string, characterId: string): void {}
    returnToPool(): void {}
    onReuseFromPool(): void {}
    onRecycleToPool(): void {}
    resetCharacterState(): void {}
    getIsFromPool(): boolean { return this.isFromPool; }
    getPoolName(): string { return this.poolName; }
    setupInput(): void {}
    cleanupInput(): void {}
    transitionToState(state: CharacterState): void {}
    getCurrentState(): CharacterState | null { return null; }
    update(deltaTime: number): void {}
    setFaction(faction: Faction): void {}
    getFaction(): Faction { return Faction.RED; }
    updateCharacterPhysicsGroup(faction: Faction): void {}
    setupDefaultFaction(): void {}
    setEnemyType(enemyType: string): void {}
    getEnemyConfigId(): string { return ''; }
    getEnemyData(): EnemyData | null { return null; }
    getCharacterType(): string { return ''; }
    getCharacterDisplayName(): string { return ''; }
    loadEnemyConfig(): void {}
    initializeAI(): void {}
    createHealthBar(): void {}
    updateHealthBar(): void {}
    showDamageText(damage: number): void {}
    playRedFlashEffect(): void {}
    updateZDepthBasedOnY(): void {}
    updateHealthBarZDepth(characterZDepth: number): void {}
    createUIRangeDisplay(): void {}
    createColliderRangeDisplay(): void {}
    
    protected onLoad(): void {
        // 初始化各个组件
        this.movementComponent = this.addComponent(MovementComponent);
        this.combatComponent = this.addComponent(CombatComponent);
        this.animationComponent = this.addComponent(AnimationComponent);
    }
}

/**
 * 使用示例：
 * 
 * ```typescript
 * const character = new ModularCharacter();
 * 
 * // 使用特定功能
 * const movable: IMovable = character;
 * movable.handleMovement(deltaTime);
 * 
 * const combat: ICombat = character;
 * combat.performMeleeAttack();
 * 
 * // 这种设计的优势：
 * // 1. 单一职责：每个组件只负责一种功能
 * // 2. 可测试性：可以独立测试每个组件
 * // 3. 可复用性：组件可以在不同角色间复用
 * // 4. 可扩展性：可以轻松添加新功能组件
 * // 5. 松耦合：组件之间通过接口通信
 * ```
 */