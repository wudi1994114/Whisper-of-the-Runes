// assets/scripts/entities/ModularCharacter.ts

import { Component, Vec2, RigidBody2D, Animation, Sprite, Node, Graphics } from 'cc';
import { ICharacter, IAttackResult } from '../interfaces';
import { AnimationState, AnimationDirection } from '../configs/AnimationConfig';
import { Faction } from '../configs/FactionConfig';
import { EnemyData } from '../configs/EnemyConfig';
import { ControlMode, CharacterState } from '../state-machine/CharacterEnums';
import { IInputSignals } from '../interfaces/IControllable';

// 组件导入
import { MovementComponent } from '../components/MovementComponent';
import { CombatComponent } from '../components/CombatComponent';
import { AnimationComponent } from '../components/AnimationComponent';
import { LifecycleComponent } from '../components/LifecycleComponent';
import { ControlComponent } from '../components/ControlComponent';
import { FactionComponent } from '../components/FactionComponent';
import { ConfigComponent } from '../components/ConfigComponent';
import { RenderComponent } from '../components/RenderComponent';

/**
 * 模块化角色类 - 组合所有组件实现完整的ICharacter接口
 * 
 * 设计模式：
 * 1. 组合模式 - 将各个功能组件组合成完整角色
 * 2. 委托模式 - 将接口方法委托给对应的组件处理
 * 3. 门面模式 - 为复杂的组件系统提供统一的接口
 * 4. 观察者模式 - 组件间通过事件系统通信
 */
export class ModularCharacter extends Component implements ICharacter {
    // 组件引用（延迟初始化）- 使用下划线前缀避免与getter冲突
    private _movementComponent: MovementComponent | null = null;
    private _combatComponent: CombatComponent | null = null;
    private _animationComponent: AnimationComponent | null = null;
    private _lifecycleComponent: LifecycleComponent | null = null;
    private _controlComponent: ControlComponent | null = null;
    private _factionComponent: FactionComponent | null = null;
    private _configComponent: ConfigComponent | null = null;
    private _renderComponent: RenderComponent | null = null;

    // ICharacter 基础属性
    public readonly id: string = '';
    // 注意：name 属性继承自 Component 类，无需重新定义

    protected onLoad(): void {
        // 获取所有组件引用
        this.initializeComponentReferences();
        
        // 设置组件间的事件监听
        this.setupComponentCommunication();
        
        console.log(`[ModularCharacter] 模块化角色初始化完成: ${this.node.name}`);
    }

    protected onDestroy(): void {
        // 清理组件间的事件监听
        this.cleanupComponentCommunication();
    }

    // ==================== IMovable 接口实现 ====================
    get moveSpeed(): number { 
        return this._movementComponent?.moveSpeed || 0; 
    }
    
    set moveSpeed(value: number) { 
        if (this._movementComponent) {
            this._movementComponent.moveSpeed = value;
        }
    }
    
    get moveDirection(): Vec2 { 
        return this._movementComponent?.moveDirection || new Vec2(0, 0); 
    }
    
    set moveDirection(value: Vec2) { 
        if (this._movementComponent) {
            this._movementComponent.moveDirection = value;
        }
    }
    
    get rigidBody(): RigidBody2D | null { 
        return this._movementComponent?.rigidBody || null; 
    }
    
    handleMovement(deltaTime: number): void {
        this._movementComponent?.handleMovement(deltaTime);
    }
    
    stopMovement(): void {
        this._movementComponent?.stopMovement();
    }
    
    stopPhysicalMovement(): void {
        this._movementComponent?.stopPhysicalMovement();
    }
    
    setNodePosition(x: number, y: number, z?: number): void {
        this._movementComponent?.setNodePosition(x, y, z);
    }
    
    hasMovementInput(): boolean {
        return this._movementComponent?.hasMovementInput() || false;
    }
    
    getMoveSpeed(): number {
        return this._movementComponent?.getMoveSpeed() || 0;
    }
    
    getRigidBody(): RigidBody2D | null {
        return this._movementComponent?.getRigidBody() || null;
    }

    // ==================== ICombat 接口实现 ====================
    get attackCooldown(): number { 
        return this._combatComponent?.attackCooldown || 1.0; 
    }
    
    set attackCooldown(value: number) { 
        if (this._combatComponent) {
            this._combatComponent.attackCooldown = value;
        }
    }
    
    get lastAttackTime(): number { 
        return this._combatComponent?.lastAttackTime || 0; 
    }
    
    set lastAttackTime(value: number) { 
        if (this._combatComponent) {
            this._combatComponent.lastAttackTime = value;
        }
    }
    
    get currentTarget(): Node | null { 
        return this._combatComponent?.currentTarget || null; 
    }
    
    set currentTarget(value: Node | null) { 
        if (this._combatComponent) {
            this._combatComponent.currentTarget = value;
        }
    }
    
    get wantsToAttack(): boolean { 
        return this._combatComponent?.wantsToAttack || false; 
    }
    
    set wantsToAttack(value: boolean) { 
        if (this._combatComponent) {
            this._combatComponent.wantsToAttack = value;
        }
    }
    
    performSpecialAttack(): IAttackResult | null {
        return this._combatComponent?.performSpecialAttack() || null;
    }
    
    performSpecialAttackWithTarget(): IAttackResult | null {
        return this._combatComponent?.performSpecialAttackWithTarget() || null;
    }
    
    performMeleeAttack(): IAttackResult | null {
        return this._combatComponent?.performMeleeAttack() || null;
    }
    
    performMeleeAttackWithTarget(): IAttackResult | null {
        return this._combatComponent?.performMeleeAttackWithTarget() || null;
    }
    
    performRangedAttack(): void {
        this._combatComponent?.performRangedAttack();
    }
    
    findNearestEnemy(): Node | null {
        return this._combatComponent?.findNearestEnemy() || null;
    }
    
    dealDamageToTarget(target: Node, damage: number): IAttackResult | null {
        return this._combatComponent?.dealDamageToTarget(target, damage) || null;
    }
    
    takeDamage(damage: number): void {
        this._combatComponent?.takeDamage(damage);
        // 通知渲染组件
        this.node.emit('character-damaged', damage);
    }
    
    activateInvincibility(duration: number): void {
        this._combatComponent?.activateInvincibility(duration);
    }

    // ==================== IAnimatable 接口实现 ====================
    get animationComponent(): Animation | null { 
        return this._animationComponent?.animationComponent || null; 
    }
    
    get currentDirection(): AnimationDirection { 
        return this._animationComponent?.currentDirection || AnimationDirection.FRONT; 
    }
    
    set currentDirection(value: AnimationDirection) { 
        if (this._animationComponent) {
            this._animationComponent.currentDirection = value;
        }
    }
    
    playCurrentAnimation(state: AnimationState): void {
        this._animationComponent?.playCurrentAnimation(state);
    }
    
    playAttackAnimation(onFinished?: () => void): void {
        this._animationComponent?.playAttackAnimation(onFinished);
    }
    
    playHurtAnimation(): void {
        this._animationComponent?.playHurtAnimation();
    }
    
    playHurtAnimationWithCallback(callback: (() => void) | null): void {
        this._animationComponent?.playHurtAnimationWithCallback(callback);
    }
    
    playDeathAnimation(): void {
        this._animationComponent?.playDeathAnimation();
    }
    
    updateDirectionTowards(targetPosition: any): void {
        this._animationComponent?.updateDirectionTowards(targetPosition);
    }

    /**
     * 根据移动向量更新朝向
     * @param direction 移动方向向量 {x, y}
     */
    updateDirectionFromMovement(direction: {x: number, y: number}): void {
        this._animationComponent?.updateDirectionFromMovement(direction);
    }

    // ==================== ILifecycle 接口实现 ====================
    get characterId(): string { 
        return this._lifecycleComponent?.characterId || ''; 
    }
    
    get isFromPool(): boolean { 
        return this._lifecycleComponent?.isFromPool || false; 
    }
    
    get poolName(): string { 
        return this._lifecycleComponent?.poolName || ''; 
    }
    
    setPoolingProperties(isFromPool: boolean, poolName: string, characterId: string): void {
        this._lifecycleComponent?.setPoolingProperties(isFromPool, poolName, characterId);
    }
    
    returnToPool(): void {
        this._lifecycleComponent?.returnToPool();
    }
    
    onReuseFromPool(): void {
        this._lifecycleComponent?.onReuseFromPool();
    }
    
    onRecycleToPool(): void {
        this._lifecycleComponent?.onRecycleToPool();
    }
    
    resetCharacterState(): void {
        this._lifecycleComponent?.resetCharacterState();
    }
    
    getIsFromPool(): boolean {
        return this._lifecycleComponent?.getIsFromPool() || false;
    }
    
    getPoolName(): string {
        return this._lifecycleComponent?.getPoolName() || '';
    }
    
    isAlive(): boolean {
        return this._lifecycleComponent?.isAlive() || false;
    }

    // ==================== IControllable 接口实现 ====================
    get controlMode(): ControlMode { 
        return this._controlComponent?.controlMode || ControlMode.MANUAL; 
    }
    
    set controlMode(value: ControlMode) { 
        if (this._controlComponent) {
            this._controlComponent.controlMode = value;
        }
    }
    
    get currentInputSignals(): IInputSignals { 
        return this._controlComponent?.currentInputSignals || { hasMovementInput: false, wantsToAttack: false }; 
    }
    
    setupInput(): void {
        this._controlComponent?.setupInput();
    }
    
    cleanupInput(): void {
        this._controlComponent?.cleanupInput();
    }
    
    transitionToState(state: CharacterState): void {
        this._controlComponent?.transitionToState(state);
    }
    
    getCurrentState(): CharacterState | null {
        return this._controlComponent?.getCurrentState() || null;
    }
    
    update(deltaTime: number): void {
        this._controlComponent?.update(deltaTime);
    }

    // ==================== IFactional 接口实现 ====================
    get aiFaction(): string { 
        return this._factionComponent?.aiFaction || 'red'; 
    }
    
    set aiFaction(value: string) { 
        if (this._factionComponent) {
            this._factionComponent.aiFaction = value;
        }
    }
    
    setFaction(faction: Faction): void {
        this._factionComponent?.setFaction(faction);
    }
    
    getFaction(): Faction {
        return this._factionComponent?.getFaction() || Faction.RED;
    }
    
    updateCharacterPhysicsGroup(faction: Faction): void {
        this._factionComponent?.updateCharacterPhysicsGroup(faction);
    }
    
    setupDefaultFaction(): void {
        this._factionComponent?.setupDefaultFaction();
    }

    // ==================== IConfigurable 接口实现 ====================
    get enemyData(): EnemyData | null { 
        return this._configComponent?.enemyData || null; 
    }
    
    get aiBehaviorType(): string { 
        return this._configComponent?.aiBehaviorType || 'melee'; 
    }
    
    set aiBehaviorType(value: string) { 
        if (this._configComponent) {
            this._configComponent.aiBehaviorType = value;
        }
    }
    
    setEnemyType(enemyType: string): void {
        this._configComponent?.setEnemyType(enemyType);
    }
    
    getEnemyConfigId(): string {
        return this._configComponent?.getEnemyConfigId() || '';
    }
    
    getEnemyData(): EnemyData | null {
        return this._configComponent?.getEnemyData() || null;
    }
    
    getCharacterType(): string {
        return this._configComponent?.getCharacterType() || '';
    }
    
    getCharacterDisplayName(): string {
        return this._configComponent?.getCharacterDisplayName() || '';
    }
    
    loadEnemyConfig(): void {
        this._configComponent?.loadEnemyConfig();
    }
    
    initializeAI(): void {
        this._configComponent?.initializeAI();
    }

    // ==================== IRenderable 接口实现 ====================
    get spriteComponent(): Sprite | null { 
        return this._renderComponent?.spriteComponent || null; 
    }
    
        get healthBarNode(): Node | null { 
        // 血条节点现在由 HealthBarComponent 管理
        const healthBarComponent = this.getComponent('HealthBarComponent') as any;
        return healthBarComponent?.healthBarNode || null;
    }
    
    get healthBarGraphics(): Graphics | null { 
        // 血条图形组件现在由 HealthBarComponent 管理
        const healthBarComponent = this.getComponent('HealthBarComponent') as any;
        return healthBarComponent?.healthBarGraphics || null;
    }
    
    createHealthBar(): void {
        this._renderComponent?.createHealthBar();
    }
    
    updateHealthBar(): void {
        this._renderComponent?.updateHealthBar();
    }
    
    showDamageText(damage: number): void {
        this._renderComponent?.showDamageText(damage);
    }
    
    playRedFlashEffect(): void {
        this._renderComponent?.playRedFlashEffect();
    }
    
    updateZDepthBasedOnY(): void {
        this._renderComponent?.updateZDepthBasedOnY();
    }
    
    updateHealthBarZDepth(characterZDepth: number): void {
        // 血条深度管理已转移到 HealthBarComponent
        const healthBarComponent = this.getComponent('HealthBarComponent') as any;
        if (healthBarComponent && typeof healthBarComponent.updateHealthBarZDepth === 'function') {
            healthBarComponent.updateHealthBarZDepth();
        }
    }
    
    createUIRangeDisplay(): void {
        this._renderComponent?.createUIRangeDisplay();
    }
    
    createColliderRangeDisplay(): void {
        this._renderComponent?.createColliderRangeDisplay();
    }

    // ==================== 私有方法 ====================
    
    /**
     * 初始化组件引用
     */
    private initializeComponentReferences(): void {
        this._movementComponent = this.getComponent(MovementComponent);
        this._combatComponent = this.getComponent(CombatComponent);
        this._animationComponent = this.getComponent(AnimationComponent);
        this._lifecycleComponent = this.getComponent(LifecycleComponent);
        this._controlComponent = this.getComponent(ControlComponent);
        this._factionComponent = this.getComponent(FactionComponent);
        this._configComponent = this.getComponent(ConfigComponent);
        this._renderComponent = this.getComponent(RenderComponent);

        console.log(`[ModularCharacter] 组件引用初始化完成`);
    }

    /**
     * 设置组件间通信
     */
    private setupComponentCommunication(): void {
        // 监听攻击伤害帧事件
        this.node.on('attack-damage-frame', this.onAttackDamageFrame, this);
        
        // 监听移动方向更新事件
        this.node.on('update-movement-direction', this.onUpdateMovementDirection, this);
        
        // 监听测试事件
        this.node.on('test-damage', this.onTestDamage, this);
        this.node.on('test-death', this.onTestDeath, this);

        console.log(`[ModularCharacter] 组件间通信设置完成`);
    }

    /**
     * 清理组件间通信
     */
    private cleanupComponentCommunication(): void {
        this.node.off('attack-damage-frame', this.onAttackDamageFrame, this);
        this.node.off('update-movement-direction', this.onUpdateMovementDirection, this);
        this.node.off('test-damage', this.onTestDamage, this);
        this.node.off('test-death', this.onTestDeath, this);
    }

    /**
     * 攻击伤害帧事件处理
     */
    private onAttackDamageFrame(): void {
        // 执行实际攻击逻辑
        const result = this.performSpecialAttackWithTarget();
        if (result && result.isDead) {
            this.node.emit('character-death');
        }
    }

    /**
     * 移动方向更新事件处理
     */
    private onUpdateMovementDirection(direction: {x: number, y: number}): void {
        if (!this._movementComponent || this.controlMode !== ControlMode.MANUAL) {
            return;
        }

        console.log(`[ModularCharacter] 接收到移动方向: (${direction.x}, ${direction.y}) (节点: ${this.node.name})`);
        
        // 转换为Vec2并设置移动方向
        const moveDir = new Vec2(direction.x, direction.y);
        this.moveDirection = moveDir;
        
        // 更新动画朝向
        if (moveDir.length() > 0) {
            this.updateDirectionFromMovement(direction);
            console.log(`[ModularCharacter] 更新动画朝向基于移动: (${direction.x}, ${direction.y})`);
        }
    }

    /**
     * 测试伤害事件处理
     */
    private onTestDamage(): void {
        const damage = Math.floor(Math.random() * 50) + 10;
        this.takeDamage(damage);
    }

    /**
     * 测试死亡事件处理
     */
    private onTestDeath(): void {
        // 造成致命伤害
        const characterStats = this.getComponent('CharacterStats') as any;
        if (characterStats) {
            this.takeDamage(characterStats.maxHealth);
        }
    }
}