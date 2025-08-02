import { CharacterState } from './CharacterEnums';
import { AnimationState } from '../configs/AnimationConfig';

// 前向声明，避免循环依赖
export interface ICharacterController {
    playCurrentAnimation(state: AnimationState): void;
    playAttackAnimation(callback?: () => void): void;
    playHurtAnimationWithCallback(callback: (() => void) | null): void;
    playDeathAnimation(): void;
    wantsToAttack: boolean;
    hasMovementInput(): boolean;
    transitionToState(state: CharacterState): void;
    handleMovement(deltaTime: number): void;
    stopPhysicalMovement(): void;
    stopMovement(): void; // 【新增】统一的停止移动接口
    getCurrentState(): CharacterState | null;
    disableCollision(): void;
    getIsFromPool(): boolean;
    returnToPool(): void;
}

/**
 * 状态机基类
 */
export abstract class State {
    protected character: ICharacterController;
    
    constructor(character: ICharacterController) {
        this.character = character;
    }
    
    abstract enter(): void;
    abstract update(deltaTime: number): void;
    abstract exit(): void;
    abstract canTransitionTo(newState: CharacterState): boolean;
}

/**
 * 待机状态
 */
export class IdleState extends State {
    enter(): void {
        // 移除状态转换日志
        this.character.playCurrentAnimation(AnimationState.IDLE);
    }
    
    update(deltaTime: number): void {
        // 检查是否需要转换状态
        if (this.character.wantsToAttack) {
            this.character.transitionToState(CharacterState.ATTACKING);
            return; // 转换后立即返回，避免执行旧状态逻辑
        }
        
        if (this.character.hasMovementInput()) {
            this.character.transitionToState(CharacterState.WALKING);
            return;
        }
        
        // 如果没有发生状态转换，则执行当前状态的逻辑（Idle可以为空）
    }
    
    exit(): void {
        // 移除状态转换日志
    }
    
    canTransitionTo(newState: CharacterState): boolean {
        return newState === CharacterState.WALKING || newState === CharacterState.ATTACKING || 
               newState === CharacterState.HURT || newState === CharacterState.DEAD;
    }
}

/**
 * 行走状态
 */
export class WalkingState extends State {
    private lastDirection: string | null = null;
    
    enter(): void {
        // 进入时先播放一次动画
        this.character.playCurrentAnimation(AnimationState.WALK);
        // 记录当前方向
        this.lastDirection = (this.character as any).currentDirection;
    }
    
    update(deltaTime: number): void {
        // 检查是否需要转换状态
        if (this.character.wantsToAttack) {
            this.character.transitionToState(CharacterState.ATTACKING);
            return;
        }
        
        if (!this.character.hasMovementInput()) {
            this.character.transitionToState(CharacterState.IDLE);
            return;
        }

        // 如果没有发生状态转换，则执行当前状态的逻辑
        this.character.handleMovement(deltaTime);
        
        const currentDirection = (this.character as any).currentDirection;
        if (this.lastDirection !== currentDirection) {
            this.character.playCurrentAnimation(AnimationState.WALK);
            this.lastDirection = currentDirection;
        }
    }
    
    exit(): void {
        // 移除状态转换日志
        this.character.stopPhysicalMovement();
        // 重置方向记录
        this.lastDirection = null;
    }
    
    canTransitionTo(newState: CharacterState): boolean {
        return newState === CharacterState.IDLE || newState === CharacterState.ATTACKING || 
               newState === CharacterState.HURT || newState === CharacterState.DEAD;
    }
}

/**
 * 攻击状态
 */
export class AttackingState extends State {
    private animationFinished: boolean = false;
    
    enter(): void {
        this.animationFinished = false;
        
        // 【优化后】通过接口停止移动，不再直接访问具体组件
        this.character.stopMovement();
        
        // 【修改】不再在这里设置攻击状态，而是由onAttackDamageFrame精确控制
        
        // 播放攻击动画，并传入一个回调，在动画完成时设置标志
        this.character.playAttackAnimation(() => {
            this.animationFinished = true;
        });
    }
    
    update(deltaTime: number): void {
        // 【优化后】持续确保停止移动，使用统一接口
        this.character.stopMovement();
        
        // 在update中检查动画是否完成
        if (this.animationFinished) {
            // 【修复后 - 推荐代码】
            // 动画完成后，根据移动意图直接决定下一个状态
            if (this.character.hasMovementInput()) {
                this.character.transitionToState(CharacterState.WALKING);
            } else {
                this.character.transitionToState(CharacterState.IDLE);
            }
        }
    }
    
    exit(): void {
        this.animationFinished = false; // 重置标志
        
        console.log('[AttackingState] 攻击动画完成');
    }
    
    canTransitionTo(newState: CharacterState): boolean {
        // 攻击中只允许被死亡打断，或者动画完成后转换到IDLE/WALKING
        return newState === CharacterState.DEAD || 
               ( (newState === CharacterState.IDLE || newState === CharacterState.WALKING) && this.animationFinished );
    }


}

/**
 * 受伤状态
 */
export class HurtState extends State {
    private animationFinished: boolean = false;
    
    enter(): void {
        // 移除状态转换日志
        this.animationFinished = false;
        
        // 播放受伤动画，并注册完成回调
        this.character.playHurtAnimationWithCallback(() => {
            this.animationFinished = true;
            this.handleAnimationFinished();
        });
    }
    
    update(deltaTime: number): void {
        // 受伤状态不需要在update中处理，完全依赖动画完成事件
    }
    
    exit(): void {
        // 移除状态转换日志
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
        const currentState = this.character.getCurrentState();
        
        if (this.character.hasMovementInput()) {
            if (currentState !== CharacterState.WALKING) {
                this.character.transitionToState(CharacterState.WALKING);
            }
        } else {
            if (currentState !== CharacterState.IDLE) {
                this.character.transitionToState(CharacterState.IDLE);
            }
        }
    }
}

/**
 * 死亡状态
 */
export class DeadState extends State {
    private deathTimer: number = 0;
    private autoRecycleDelay: number = 2.0; // 死亡后2秒自动回收
    
    enter(): void {
        console.log('[StateMachine] 进入 Dead 状态');
        this.deathTimer = 0;
        this.character.playDeathAnimation();
        
        // 立即取消碰撞检测
        this.character.disableCollision();
        
        // 如果是池化对象，准备自动回收
        if (this.character.getIsFromPool()) {
            console.log(`[StateMachine] 池化角色死亡，${this.autoRecycleDelay}秒后自动回收`);
        }
    }
    
    update(deltaTime: number): void {
        // 死亡状态计时器
        this.deathTimer += deltaTime;
        
        // 检查是否需要自动回收
        if (this.character.getIsFromPool() && this.deathTimer >= this.autoRecycleDelay) {
            console.log(`[StateMachine] 角色死亡超时，执行自动回收`);
            this.character.returnToPool();
        }
    }
    
    exit(): void {
        // 移除状态转换日志
        this.deathTimer = 0;
    }
    
    canTransitionTo(newState: CharacterState): boolean {
        // 死亡状态不可转换到其他状态
        return false;
    }
}

/**
 * 状态机管理器
 */
export class StateMachine {
    private currentState: State | null = null;
    private states: Map<CharacterState, State> = new Map();
    private character: ICharacterController;
    
    constructor(character: ICharacterController) {
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
        
        // 【修复】检查是否已经在目标状态，避免重复转换
        const currentState = this.getCurrentState();
        if (currentState === newState) {
            // 静默跳过重复转换，避免日志污染
            return true;
        }
        
        // 检查是否可以转换
        if (this.currentState && !this.currentState.canTransitionTo(newState)) {
            const currentStateName = this.getCurrentStateName();
            // 移除状态转换失败日志，减少噪音
            return false;
        }
        
        // 执行状态转换
        if (this.currentState) {
            this.currentState.exit();
        }
        
        this.currentState = targetState;
        this.currentState.enter();
        
        // 移除状态转换成功日志
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