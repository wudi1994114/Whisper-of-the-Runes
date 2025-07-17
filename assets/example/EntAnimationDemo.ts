/**
 * 可控制角色动画演示 - 状态机版本
 * 
 * 🎮 控制说明：
 * - WSAD: 移动控制
 * - J: 攻击
 * - 攻击时无法移动
 * 
 * 🔧 从敌人配置读取小树精数据，使用状态机管理角色行为，动画直接在当前节点的Sprite组件上播放
 */

import { _decorator, Component, Animation, Node, Sprite, UITransform, Vec2, Vec3, input, Input, EventKeyboard, KeyCode } from 'cc';
import { dataManager } from '../scripts/core/DataManager';
import { EnemyData } from '../scripts/configs/EnemyConfig';
import { AnimationState, AnimationDirection } from '../scripts/animation/AnimationConfig';
import { animationManager } from '../scripts/animation/AnimationManager';

const { ccclass, property } = _decorator;

// 角色状态枚举
enum CharacterState {
    IDLE = 'idle',
    WALKING = 'walking', 
    ATTACKING = 'attacking'
}

// 状态机基类
abstract class State {
    protected character: EntAnimationDemo;
    
    constructor(character: EntAnimationDemo) {
        this.character = character;
    }
    
    abstract enter(): void;
    abstract update(deltaTime: number): void;
    abstract exit(): void;
    abstract canTransitionTo(newState: CharacterState): boolean;
}

// 待机状态
class IdleState extends State {
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
        return newState === CharacterState.WALKING || newState === CharacterState.ATTACKING;
    }
}

// 行走状态
class WalkingState extends State {
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
        return newState === CharacterState.IDLE || newState === CharacterState.ATTACKING;
    }
}

// 攻击状态
class AttackingState extends State {
    private attackDuration: number = 0;
    private maxAttackDuration: number = 0.6; // 攻击持续时间（秒）
    
    enter(): void {
        console.log('[StateMachine] 进入 Attacking 状态');
        this.attackDuration = 0;
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
        // 攻击状态可以转换到任何状态（通过动画完成回调触发）
        return true;
    }
}

// 状态机管理器
class StateMachine {
    private currentState: State | null = null;
    private states: Map<CharacterState, State> = new Map();
    private character: EntAnimationDemo;
    
    constructor(character: EntAnimationDemo) {
        this.character = character;
        this.initializeStates();
    }
    
    private initializeStates(): void {
        this.states.set(CharacterState.IDLE, new IdleState(this.character));
        this.states.set(CharacterState.WALKING, new WalkingState(this.character));
        this.states.set(CharacterState.ATTACKING, new AttackingState(this.character));
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
            console.log(`[StateMachine] 无法从当前状态转换到 ${newState}`);
            return false;
        }
        
        // 执行状态转换
        if (this.currentState) {
            this.currentState.exit();
        }
        
        this.currentState = targetState;
        this.currentState.enter();
        
        console.log(`[StateMachine] 状态转换到: ${newState}`);
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
    
    public isInState(state: CharacterState): boolean {
        return this.getCurrentState() === state;
    }
}

@ccclass('EntAnimationDemo')
export class EntAnimationDemo extends Component {



    @property({
        displayName: "移动速度",
        tooltip: "角色移动速度"
    })
    private moveSpeed: number = 200;

    // 核心组件
    private animationComponent: Animation | null = null;
    private spriteComponent: Sprite | null = null;
    
    // 敌人配置数据
    private enemyData: EnemyData | null = null;
    
    // 状态机
    private stateMachine: StateMachine | null = null;
    private currentDirection: AnimationDirection = AnimationDirection.FRONT;
    
    // 输入状态
    private keyStates: { [key: number]: boolean } = {};
    private moveDirection: Vec2 = new Vec2(0, 0);
    
    // 位置相关
    private originalSpritePosition: Vec3 = new Vec3();
    
    async onLoad() {
        console.log('[EntAnimationDemo] 开始初始化可控制角色演示（状态机版本）...');
        
        // 等待数据管理器加载完成
        await this.waitForDataManager();
        
        // 加载小树精配置
        this.loadEnemyConfig();
        
        // 设置组件
        this.setupComponents();
        
        // 设置输入系统
        this.setupInput();
        
        // 使用 AnimationManager 加载资源和创建动画
        await this.setupAnimationsWithManager();
        
        // 初始化状态机
        this.stateMachine = new StateMachine(this);
        this.stateMachine.start();

        console.log('[EntAnimationDemo] 初始化完成！');
        console.log('🎮 控制说明：WSAD移动，J键攻击（攻击时无法移动）');
    }

    /**
     * 使用 AnimationManager 设置动画
     */
    private async setupAnimationsWithManager(): Promise<void> {
        if (!this.enemyData) {
            console.error('[EntAnimationDemo] 无敌人配置数据，无法设置动画');
            return;
        }

        try {
            // 使用 AnimationManager 创建所有动画剪辑
            const animationClips = await animationManager.createAllAnimationClips(this.enemyData);
            
            if (animationClips.size === 0) {
                console.warn('[EntAnimationDemo] 没有创建任何动画剪辑');
                return;
            }

            // 使用 AnimationManager 设置动画组件
            this.animationComponent = animationManager.setupAnimationComponent(this.node, animationClips);
            
            console.log(`[EntAnimationDemo] 通过 AnimationManager 成功创建 ${animationClips.size} 个动画剪辑`);
        } catch (error) {
            console.error('[EntAnimationDemo] 动画设置失败:', error);
        }
    }

    /**
     * 等待数据管理器加载完成
     */
    private async waitForDataManager(): Promise<void> {
        return new Promise((resolve) => {
            const checkDataManager = () => {
                if (dataManager['_isLoaded']) {
                    resolve();
                } else {
                    setTimeout(checkDataManager, 100);
                }
            };
            checkDataManager();
        });
    }

    /**
     * 加载小树精敌人配置
     */
    private loadEnemyConfig(): void {
        this.enemyData = dataManager.getEnemyData('ent_normal');
        if (this.enemyData) {
            console.log('[EntAnimationDemo] 成功加载小树精配置:', this.enemyData.name);
            console.log(`[EntAnimationDemo] 动画前缀: ${this.enemyData.assetNamePrefix}, 移动速度: ${this.enemyData.moveSpeed}`);
        } else {
            console.error('[EntAnimationDemo] 无法加载小树精配置');
        }
    }

    private setupComponents() {
        // 获取或添加当前节点的Sprite组件
        this.spriteComponent = this.getComponent(Sprite) || this.addComponent(Sprite);
        
        // 保存节点的原始位置
        this.originalSpritePosition.set(this.node.position);
        console.log('[EntAnimationDemo] 已保存节点原始位置:', this.originalSpritePosition);
        
        this.animationComponent = this.getComponent(Animation) || this.addComponent(Animation);
        console.log('[EntAnimationDemo] Animation 组件已准备就绪');
        console.log('[EntAnimationDemo] Sprite组件已配置');
    }

    /**
     * 设置输入系统
     */
    private setupInput(): void {
        input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        input.on(Input.EventType.KEY_UP, this.onKeyUp, this);
        console.log('[EntAnimationDemo] 输入系统已设置');
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
        if (this.stateMachine?.isInState(CharacterState.ATTACKING)) {
            console.log('[EntAnimationDemo] 正在攻击中，无法重复攻击');
            return;
        }
        
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
        if (!this.animationComponent) {
            console.warn('[EntAnimationDemo] 动画组件未初始化');
            return;
        }

        // 使用 AnimationManager 播放动画
        const success = animationManager.playAnimation(this.animationComponent, state, this.currentDirection);
        
        if (success) {
            console.log(`[EntAnimationDemo] 播放动画: ${state}_${this.currentDirection}`);
        } else {
            console.warn(`[EntAnimationDemo] 动画播放失败: ${state}_${this.currentDirection}`);
        }
    }

    /**
     * 播放攻击动画并处理结束回调
     */
    public playAttackAnimation(): void {
        if (!this.animationComponent) {
            console.warn('[EntAnimationDemo] 动画组件未初始化');
            this.determineStateAfterAttack();
            return;
        }

        // 使用 AnimationManager 播放攻击动画
        const success = animationManager.playAnimation(this.animationComponent, AnimationState.ATTACK, this.currentDirection);
        
        if (success) {
            // 清除之前的监听器
            this.animationComponent.off(Animation.EventType.FINISHED);
            
            console.log(`[EntAnimationDemo] 播放攻击动画: ${AnimationState.ATTACK}_${this.currentDirection}`);
            
            // 设置攻击动画结束回调
            this.animationComponent.once(Animation.EventType.FINISHED, () => {
                console.log(`[EntAnimationDemo] 攻击动画结束: ${AnimationState.ATTACK}_${this.currentDirection}`);
                // 根据当前按键状态决定进入的状态
                this.determineStateAfterAttack();
            });
        } else {
            console.warn(`[EntAnimationDemo] 攻击动画播放失败: ${AnimationState.ATTACK}_${this.currentDirection}`);
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
                console.log('[EntAnimationDemo] 攻击结束，检测到移动输入，进入行走状态');
                this.stateMachine.transitionTo(CharacterState.WALKING);
            } else {
                // 没有移动输入，进入待机状态
                console.log('[EntAnimationDemo] 攻击结束，无移动输入，进入待机状态');
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
     * 更新函数 - 让状态机处理
     */
    protected update(deltaTime: number): void {
        if (this.stateMachine) {
            this.stateMachine.update(deltaTime);
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

    onDestroy() {
        // 清理输入监听
        input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        input.off(Input.EventType.KEY_UP, this.onKeyUp, this);
        
        // 停止动画
        if (this.animationComponent) {
            this.animationComponent.stop();
        }
        
        console.log('[EntAnimationDemo] 组件已清理');
    }
}