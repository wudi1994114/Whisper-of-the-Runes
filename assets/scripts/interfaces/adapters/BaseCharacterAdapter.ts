// assets/scripts/interfaces/adapters/BaseCharacterAdapter.ts

/**
 * BaseCharacterDemo适配器
 * 
 * 本适配器展示了如何将现有的BaseCharacterDemo类适配到新的接口系统，
 * 在不修改原有代码的情况下，让其符合新的接口规范。
 * 
 * 这种适配器模式特别适用于：
 * 1. 渐进式重构：逐步迁移到新架构
 * 2. 兼容性保持：保持现有代码正常工作
 * 3. 平滑过渡：新旧系统并存的过渡期
 */

import { 
    ICharacter, 
    IMovable, 
    ICombat, 
    IAnimatable, 
    ILifecycle, 
    IControllable, 
    IFactional, 
    IConfigurable, 
    IRenderable,
    IAttackResult,
    IInputSignals
} from '../index';

import { BaseCharacterDemo } from '../../entities/BaseCharacterDemo';
import { Vec2, Vec3, RigidBody2D, Animation, Sprite, Graphics, Node } from 'cc';
import { ControlMode, CharacterState } from '../../state-machine/CharacterEnums';
import { AnimationState, AnimationDirection } from '../../configs/AnimationConfig';
import { Faction } from '../../configs/FactionConfig';
import { EnemyData } from '../../configs/EnemyConfig';

/**
 * BaseCharacterDemo的适配器类
 * 将现有的BaseCharacterDemo适配到新的ICharacter接口
 */
export class BaseCharacterAdapter implements ICharacter {
    private baseCharacter: BaseCharacterDemo;

    constructor(baseCharacter: BaseCharacterDemo) {
        this.baseCharacter = baseCharacter;
    }

    // ICharacter 基础属性
    get id(): string {
        return this.baseCharacter.characterId;
    }

    get name(): string {
        return this.baseCharacter.getCharacterDisplayName();
    }

    // IMovable 接口适配
    get moveSpeed(): number {
        return this.baseCharacter.getMoveSpeed();
    }

    get moveDirection(): Vec2 {
        return (this.baseCharacter as any).moveDirection;
    }

    get rigidBody(): RigidBody2D | null {
        return this.baseCharacter.getRigidBody();
    }

    handleMovement(deltaTime: number): void {
        this.baseCharacter.handleMovement(deltaTime);
    }

    stopMovement(): void {
        this.baseCharacter.stopMovement();
    }

    stopPhysicalMovement(): void {
        this.baseCharacter.stopPhysicalMovement();
    }

    setNodePosition(x: number, y: number, z?: number): void {
        this.baseCharacter.setNodePosition(x, y, z);
    }

    hasMovementInput(): boolean {
        return this.baseCharacter.hasMovementInput();
    }

    getMoveSpeed(): number {
        return this.baseCharacter.getMoveSpeed();
    }

    getRigidBody(): RigidBody2D | null {
        return this.baseCharacter.getRigidBody();
    }

    // ICombat 接口适配
    get attackCooldown(): number {
        return (this.baseCharacter as any).attackCooldown;
    }

    get lastAttackTime(): number {
        return (this.baseCharacter as any).lastAttackTime;
    }

    get currentTarget(): Node | null {
        return (this.baseCharacter as any).currentTarget;
    }

    get wantsToAttack(): boolean {
        return this.baseCharacter.wantsToAttack;
    }

    performSpecialAttack(): IAttackResult | null {
        const result = this.baseCharacter.performSpecialAttack();
        return result ? {
            isDead: result.isDead,
            isStunned: result.isStunned
        } : null;
    }

    performSpecialAttackWithTarget(): IAttackResult | null {
        const result = this.baseCharacter.performSpecialAttackWithTarget();
        return result ? {
            isDead: result.isDead,
            isStunned: result.isStunned,
            target: result.target
        } : null;
    }

    performMeleeAttack(): IAttackResult | null {
        const result = this.baseCharacter.performMeleeAttack();
        return result ? {
            isDead: result.isDead,
            isStunned: result.isStunned
        } : null;
    }

    performMeleeAttackWithTarget(): IAttackResult | null {
        const result = this.baseCharacter.performMeleeAttackWithTarget();
        return result ? {
            isDead: result.isDead,
            isStunned: result.isStunned,
            target: result.target
        } : null;
    }

    performRangedAttack(): void {
        this.baseCharacter.performRangedAttack();
    }

    findNearestEnemy(): Node | null {
        return this.baseCharacter.findNearestEnemy();
    }

    dealDamageToTarget(target: Node, damage: number): IAttackResult | null {
        const result = this.baseCharacter.dealDamageToTarget(target, damage);
        return result ? {
            isDead: result.isDead,
            isStunned: result.isStunned,
            target: target
        } : null;
    }

    takeDamage(damage: number): void {
        this.baseCharacter.takeDamage(damage);
    }

    activateInvincibility(duration: number): void {
        this.baseCharacter.activateInvincibility(duration);
    }

    // IAnimatable 接口适配
    get animationComponent(): Animation | null {
        return (this.baseCharacter as any).animationComponent;
    }

    get currentDirection(): AnimationDirection {
        return (this.baseCharacter as any).currentDirection;
    }

    playCurrentAnimation(state: AnimationState): void {
        this.baseCharacter.playCurrentAnimation(state);
    }

    playAttackAnimation(onFinished?: () => void): void {
        this.baseCharacter.playAttackAnimation(onFinished);
    }

    playHurtAnimation(): void {
        this.baseCharacter.playHurtAnimation();
    }

    playHurtAnimationWithCallback(callback: (() => void) | null): void {
        this.baseCharacter.playHurtAnimationWithCallback(callback);
    }

    playDeathAnimation(): void {
        this.baseCharacter.playDeathAnimation();
    }

    updateDirectionTowards(targetPosition: any): void {
        (this.baseCharacter as any).updateDirectionTowards(targetPosition);
    }

    // ILifecycle 接口适配
    get characterId(): string {
        return this.baseCharacter.characterId;
    }

    get isFromPool(): boolean {
        return this.baseCharacter.getIsFromPool();
    }

    get poolName(): string {
        return this.baseCharacter.getPoolName();
    }

    isAlive(): boolean {
        return this.baseCharacter.isAlive();
    }

    setPoolingProperties(isFromPool: boolean, poolName: string, characterId: string): void {
        this.baseCharacter.setPoolingProperties(isFromPool, poolName, characterId);
    }

    returnToPool(): void {
        this.baseCharacter.returnToPool();
    }

    onReuseFromPool(): void {
        this.baseCharacter.onReuseFromPool();
    }

    onRecycleToPool(): void {
        this.baseCharacter.onRecycleToPool();
    }

    resetCharacterState(): void {
        (this.baseCharacter as any).resetCharacterState();
    }

    getIsFromPool(): boolean {
        return this.baseCharacter.getIsFromPool();
    }

    getPoolName(): string {
        return this.baseCharacter.getPoolName();
    }

    // IControllable 接口适配
    get controlMode(): ControlMode {
        return this.baseCharacter.controlMode;
    }

    get currentInputSignals(): IInputSignals {
        return (this.baseCharacter as any).currentInputSignals;
    }

    setupInput(): void {
        (this.baseCharacter as any).setupInput();
    }

    cleanupInput(): void {
        (this.baseCharacter as any).cleanupInput();
    }

    transitionToState(state: CharacterState): void {
        this.baseCharacter.transitionToState(state);
    }

    getCurrentState(): CharacterState | null {
        return this.baseCharacter.getCurrentState();
    }

    update(deltaTime: number): void {
        // BaseCharacterDemo的update方法是protected，需要通过反射调用
        (this.baseCharacter as any).update(deltaTime);
    }

    // IFactional 接口适配
    get aiFaction(): string {
        return this.baseCharacter.aiFaction;
    }

    setFaction(faction: Faction): void {
        this.baseCharacter.setFaction(faction);
    }

    getFaction(): Faction {
        return this.baseCharacter.getFaction();
    }

    updateCharacterPhysicsGroup(faction: Faction): void {
        (this.baseCharacter as any).updateCharacterPhysicsGroup(faction);
    }

    setupDefaultFaction(): void {
        (this.baseCharacter as any).setupDefaultFaction();
    }

    // IConfigurable 接口适配
    get enemyData(): EnemyData | null {
        return this.baseCharacter.getEnemyData();
    }

    get aiBehaviorType(): string {
        return this.baseCharacter.aiBehaviorType;
    }

    setEnemyType(enemyType: string): void {
        this.baseCharacter.setEnemyType(enemyType);
    }

    getEnemyConfigId(): string {
        return (this.baseCharacter as any).getEnemyConfigId();
    }

    getEnemyData(): EnemyData | null {
        return this.baseCharacter.getEnemyData();
    }

    getCharacterType(): string {
        return this.baseCharacter.getCharacterType();
    }

    getCharacterDisplayName(): string {
        return (this.baseCharacter as any).getCharacterDisplayName();
    }

    loadEnemyConfig(): void {
        (this.baseCharacter as any).loadEnemyConfig();
    }

    initializeAI(): void {
        this.baseCharacter.initializeAI();
    }

    // IRenderable 接口适配
    get spriteComponent(): Sprite | null {
        return (this.baseCharacter as any).spriteComponent;
    }

    get healthBarNode(): Node | null {
        return (this.baseCharacter as any).healthBarNode;
    }

    get healthBarGraphics(): Graphics | null {
        return (this.baseCharacter as any).healthBarGraphics;
    }

    createHealthBar(): void {
        (this.baseCharacter as any).createHealthBar();
    }

    updateHealthBar(): void {
        (this.baseCharacter as any).updateHealthBar();
    }

    showDamageText(damage: number): void {
        (this.baseCharacter as any).showDamageText(damage);
    }

    playRedFlashEffect(): void {
        (this.baseCharacter as any).playRedFlashEffect();
    }

    updateZDepthBasedOnY(): void {
        (this.baseCharacter as any).updateZDepthBasedOnY();
    }

    updateHealthBarZDepth(characterZDepth: number): void {
        (this.baseCharacter as any).updateHealthBarZDepth(characterZDepth);
    }

    createUIRangeDisplay(): void {
        this.baseCharacter.createUIRangeDisplay();
    }

    createColliderRangeDisplay(): void {
        this.baseCharacter.createColliderRangeDisplay();
    }
}

/**
 * 适配器工厂函数
 * 将BaseCharacterDemo实例包装为ICharacter接口
 */
export function adaptBaseCharacter(baseCharacter: BaseCharacterDemo): ICharacter {
    return new BaseCharacterAdapter(baseCharacter);
}

/**
 * 使用示例：
 * 
 * ```typescript
 * // 现有代码
 * const baseCharacter = new BaseCharacterDemo();
 * 
 * // 适配到新接口
 * const character: ICharacter = adaptBaseCharacter(baseCharacter);
 * 
 * // 现在可以使用新接口
 * const movable: IMovable = character;
 * movable.handleMovement(deltaTime);
 * 
 * const combat: ICombat = character;
 * const result = combat.performMeleeAttack();
 * ```
 * 
 * 这种适配器模式的优势：
 * 1. 无需修改现有的BaseCharacterDemo代码
 * 2. 可以渐进式地迁移到新架构
 * 3. 新旧代码可以并存
 * 4. 降低重构风险
 * 5. 为团队提供了学习新架构的缓冲期
 */