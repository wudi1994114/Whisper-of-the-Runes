// assets/scripts/components/ControlComponent.ts

import { _decorator, Component, input, Input, EventKeyboard, KeyCode, Vec3 } from 'cc';
import { IControllable, IInputSignals } from '../interfaces/IControllable';
import { ControlMode, CharacterState } from '../state-machine/CharacterEnums';
import { StateMachine, ICharacterController } from '../state-machine/CharacterStateMachine';
import { AIIntentionComponent } from './AIIntentionComponent';
import { AnimationComponent } from './AnimationComponent';
import { MovementComponent } from './MovementComponent';
import { CombatComponent } from './CombatComponent';
import { LifecycleComponent } from './LifecycleComponent';
import { eventManager } from '../managers/EventManager';
import { GameEvents } from './GameEvents';

const { ccclass } = _decorator;

/**
 * 控制组件 - 负责输入处理、状态机、控制模式
 * 实现 IControllable 接口，专注于控制逻辑的单一职责
 */
@ccclass('ControlComponent')
export class ControlComponent extends Component implements IControllable {
    // 控制相关属性
    private _controlMode: ControlMode = ControlMode.MANUAL;
    private _currentInputSignals: IInputSignals = {
        hasMovementInput: false,
        wantsToAttack: false
    };
    private _stateMachine: StateMachine | null = null;
    private _aiIntentionComponent: AIIntentionComponent | null = null;

    // IControllable 接口属性
    get controlMode(): ControlMode { return this._controlMode; }
    set controlMode(value: ControlMode) {
        if (this._controlMode !== value) {
            const oldMode = this._controlMode;
            this._controlMode = value;
            this.onControlModeChanged(oldMode, value);
        }
    }

    get currentInputSignals(): IInputSignals { return this._currentInputSignals; }
    get stateMachine(): StateMachine | null { return this._stateMachine; }

    protected onLoad(): void {
        console.log(`[ControlComponent] onLoad执行，获取组件引用...`);

        // 获取AI意向组件
        this._aiIntentionComponent = this.getComponent(AIIntentionComponent);

        // 监听生命周期事件
        this.node.on('reuse-from-pool', this.onReuse, this);
        this.node.on('on-recycle-to-pool', this.onRecycle, this);
        this.node.on('reset-character-state', this.onResetState, this);

        console.log(`[ControlComponent] onLoad完成，等待start阶段初始化状态机...`);
    }

    protected start(): void {
        console.log(`[ControlComponent] start执行，等待动画组件准备就绪...`);

        // 【修复】确保输入系统被正确设置
        this.setupInput();

        // 监听动画准备就绪事件
        this.node.on('animation-ready', this.onAnimationReady, this);

        // 尝试直接初始化状态机（如果动画已经准备好）
        this.tryInitializeStateMachine();
    }

    /**
     * 尝试初始化状态机
     */
    private tryInitializeStateMachine(): void {
        const animationComponent = this.getComponent(AnimationComponent);

        // 检查动画组件和clips是否都已准备好
        if (animationComponent &&
            animationComponent.animationComponent &&
            animationComponent.animationComponent.clips &&
            animationComponent.animationComponent.clips.length > 0) {

            console.log(`[ControlComponent] 动画组件和clips都已准备好，初始化状态机...`);
            this.initializeStateMachine();
            console.log(`[ControlComponent] ✅ 状态机初始化完成`);
        } else {
            const clipsCount = animationComponent?.animationComponent?.clips?.length || 0;
            console.log(`[ControlComponent] 动画组件未完全准备好 (clips数量: ${clipsCount})，等待animation-ready事件...`);
        }
    }

    /**
     * 响应动画准备就绪事件
     */
    private onAnimationReady(): void {
        console.log(`[ControlComponent] 收到animation-ready事件，初始化状态机...`);
        this.node.off('animation-ready', this.onAnimationReady, this);
        this.initializeStateMachine();
        console.log(`[ControlComponent] ✅ 状态机初始化完成`);
    }

    protected onDestroy(): void {
        // 清理输入监听器
        this.cleanupInput();

        // 清理节点事件监听
        this.node.off('reuse-from-pool', this.onReuse, this);
        this.node.off('on-recycle-to-pool', this.onRecycle, this);
        this.node.off('reset-character-state', this.onResetState, this);
        this.node.off('animation-ready', this.onAnimationReady, this);
    }

    /**
     * 设置输入系统 - 通过EventManager接收InputManager的事件
     */
    setupInput(): void {
        // 清理之前的输入监听
        this.cleanupInput();

        // 只有手动模式才监听键盘输入
        if (this._controlMode === ControlMode.MANUAL) {
            // 监听InputManager发送的按键事件
            eventManager.on(GameEvents.KEY_PRESSED, this.onKeyPressed, this);
            eventManager.on(GameEvents.KEY_RELEASED, this.onKeyReleased, this);
            // 监听移动方向变化事件
            eventManager.on(GameEvents.MOVE_DIRECTION_CHANGED, this.onMoveDirectionChanged, this);
            console.log(`[ControlComponent] 手动控制输入系统已设置 (通过EventManager)`);
        } else {
            console.log(`[ControlComponent] AI模式，跳过输入系统设置`);
        }
    }

    /**
     * 清理输入监听 - 清理EventManager的事件监听
     */
    cleanupInput(): void {
        eventManager.off(GameEvents.KEY_PRESSED, this.onKeyPressed, this);
        eventManager.off(GameEvents.KEY_RELEASED, this.onKeyReleased, this);
        eventManager.off(GameEvents.MOVE_DIRECTION_CHANGED, this.onMoveDirectionChanged, this);
    }

    /**
     * 状态机转换
     * @param state 目标状态
     */
    transitionToState(state: CharacterState): void {
        this._stateMachine?.transitionTo(state);
    }

    /**
     * 获取当前状态
     */
    getCurrentState(): CharacterState | null {
        return this._stateMachine?.getCurrentState() || null;
    }

    /**
     * 更新控制逻辑
     * @param deltaTime 时间增量
     */
    update(deltaTime: number): void {
        // 根据控制模式更新输入信号
        if (this._controlMode === ControlMode.MANUAL) {
            this.updateManualInputSignals();
        } else if (this._controlMode === ControlMode.AI) {
            this.updateAIInputSignals();
        }

        // 更新状态机
        this._stateMachine?.update(deltaTime);

        // 重置一次性信号
        this._currentInputSignals.wantsToAttack = false;
    }

    /**
     * 设置AI输入信号
     * @param signals AI输入信号
     */
    setAIInputSignals(signals: Partial<IInputSignals>): void {
        if (this._controlMode === ControlMode.AI) {
            Object.assign(this._currentInputSignals, signals);
        }
    }

    /**
     * 初始化状态机
     */
    private initializeStateMachine(): void {
        if (!this._stateMachine) {
            // 创建状态机适配器，实现ICharacterController接口
            const controller = this.createCharacterController();
            this._stateMachine = new StateMachine(controller);
            this._stateMachine.start();
            console.log(`[ControlComponent] 状态机初始化完成 (节点: ${this.node.name})`);
        }
    }

    /**
     * 创建角色控制器适配器
     */
    private createCharacterController(): ICharacterController {
        const self = this;

        return {
            // 动画相关方法 - 委托给AnimationComponent
            playCurrentAnimation(state: any): void {
                const animationComponent = self.node.getComponent(AnimationComponent);
                if (animationComponent) {
                    console.log(`[ControlComponent] 调用动画播放: ${state} (节点: ${self.node.name})`);
                    animationComponent.playCurrentAnimation(state);
                } else {
                    console.warn(`[ControlComponent] AnimationComponent未找到 (节点: ${self.node.name})`);
                }
            },

            playAttackAnimation(callback?: () => void): void {
                const animationComponent = self.node.getComponent(AnimationComponent);
                if (animationComponent) {
                    console.log(`[ControlComponent] 调用攻击动画播放 (节点: ${self.node.name})`);
                    animationComponent.playAttackAnimation(callback);
                } else {
                    console.warn(`[ControlComponent] AnimationComponent未找到，攻击动画播放失败 (节点: ${self.node.name})`);
                    if (callback) callback(); // 如果没有动画组件，直接执行回调
                }
            },

            playHurtAnimationWithCallback(callback: (() => void) | null): void {
                const animationComponent = self.node.getComponent(AnimationComponent);
                if (animationComponent) {
                    console.log(`[ControlComponent] 调用受伤动画播放 (节点: ${self.node.name})`);
                    animationComponent.playHurtAnimationWithCallback(callback);
                } else {
                    console.warn(`[ControlComponent] AnimationComponent未找到，受伤动画播放失败 (节点: ${self.node.name})`);
                    if (callback) callback();
                }
            },

            playDeathAnimation(): void {
                const animationComponent = self.node.getComponent(AnimationComponent);
                if (animationComponent) {
                    console.log(`[ControlComponent] 调用死亡动画播放 (节点: ${self.node.name})`);
                    animationComponent.playDeathAnimation();
                } else {
                    console.warn(`[ControlComponent] AnimationComponent未找到，死亡动画播放失败 (节点: ${self.node.name})`);
                }
            },

            // 输入相关属性
            get wantsToAttack(): boolean {
                return self._currentInputSignals.wantsToAttack;
            },

            hasMovementInput(): boolean {
                return self._currentInputSignals.hasMovementInput;
            },

            // 状态机控制
            transitionToState(state: CharacterState): void {
                if (self._stateMachine) {
                    self._stateMachine.transitionTo(state);
                }
            },

            getCurrentState(): CharacterState | null {
                return self._stateMachine ? self._stateMachine.getCurrentState() : null;
            },

            // 移动相关方法 - 委托给MovementComponent
            handleMovement(deltaTime: number): void {
                const movementComponent = self.node.getComponent(MovementComponent);
                if (movementComponent && typeof movementComponent.handleMovement === 'function') {
                    movementComponent.handleMovement(deltaTime);
                } else {
                    console.warn(`[ControlComponent] MovementComponent未找到或handleMovement方法不存在 (节点: ${self.node.name})`);
                }
            },

            stopPhysicalMovement(): void {
                const movementComponent = self.node.getComponent(MovementComponent);
                if (movementComponent && typeof movementComponent.stopPhysicalMovement === 'function') {
                    movementComponent.stopPhysicalMovement();
                } else {
                    console.warn(`[ControlComponent] MovementComponent未找到或stopPhysicalMovement方法不存在 (节点: ${self.node.name})`);
                }
            },

            stopMovement(): void {
                const movementComponent = self.node.getComponent(MovementComponent);
                if (movementComponent && typeof movementComponent.stopMovement === 'function') {
                    movementComponent.stopMovement();
                } else {
                    console.warn(`[ControlComponent] MovementComponent未找到或stopMovement方法不存在 (节点: ${self.node.name})`);
                }
            },

            // 碰撞和生命周期
            disableCollision(): void {
                const combatComponent = self.node.getComponent(CombatComponent);
                if (combatComponent && typeof combatComponent.disableCollision === 'function') {
                    combatComponent.disableCollision();
                } else {
                    console.warn(`[ControlComponent] CombatComponent未找到或disableCollision方法不存在 (节点: ${self.node.name})`);
                }
            },

            getIsFromPool(): boolean {
                const lifecycleComponent = self.node.getComponent(LifecycleComponent);
                return lifecycleComponent ? lifecycleComponent.isFromPool : false;
            },

            returnToPool(): void {
                const lifecycleComponent = self.node.getComponent(LifecycleComponent);
                if (lifecycleComponent && typeof lifecycleComponent.returnToPool === 'function') {
                    lifecycleComponent.returnToPool();
                } else {
                    console.warn(`[ControlComponent] LifecycleComponent未找到或returnToPool方法不存在 (节点: ${self.node.name})`);
                }
            }
        };
    }

    /**
     * 控制模式变化回调
     */
    private onControlModeChanged(oldMode: ControlMode, newMode: ControlMode): void {
        console.log(`[ControlComponent] 控制模式变化: ${oldMode} -> ${newMode}`);

        // 重新设置输入系统
        this.setupInput();

        // 重置输入状态
        this._currentInputSignals = {
            hasMovementInput: false,
            wantsToAttack: false
        };
    }

    /**
     * 按键按下处理 - 处理来自InputManager的事件
     */
    private onKeyPressed = (keyCode: KeyCode): void => {
        if (this._controlMode !== ControlMode.MANUAL) return;

        console.log(`[ControlComponent] 接收到按键事件: ${keyCode} (节点: ${this.node.name})`);

        // J键攻击
        if (keyCode === KeyCode.KEY_J) {
            this.tryAttack();
        }

        // H键受伤测试
        if (keyCode === KeyCode.KEY_H) {
            this.node.emit('test-damage');
        }

        // K键死亡测试
        if (keyCode === KeyCode.KEY_K) {
            this.node.emit('test-death');
        }
    }

    /**
     * 按键松开处理 - 处理来自InputManager的事件
     */
    private onKeyReleased = (keyCode: KeyCode): void => {
        if (this._controlMode !== ControlMode.MANUAL) return;

        console.log(`[ControlComponent] 接收到按键松开事件: ${keyCode} (节点: ${this.node.name})`);

        // 按键松开时可以处理一些特殊逻辑
        // 目前主要用于调试
    }

    /**
     * 尝试攻击
     */
    private tryAttack(): void {
        // 检查是否可以攻击（冷却时间等）
        const combatComponent = this.getComponent('CombatComponent') as any;
        if (combatComponent && !combatComponent.canAttack()) {
            return;
        }

        // 设置攻击意图
        this._currentInputSignals.wantsToAttack = true;
        console.log(`[ControlComponent] 设置攻击意图`);
    }

    /**
     * 处理移动方向变化 - 来自InputManager的移动事件
     */
    private onMoveDirectionChanged = (direction: Vec3): void => {
        if (this._controlMode !== ControlMode.MANUAL) return;

        const hasInput = direction.length() > 0;
        this._currentInputSignals.hasMovementInput = hasInput;

        console.log(`[ControlComponent] 移动方向变化: (${direction.x}, ${direction.y}) 有输入: ${hasInput} (节点: ${this.node.name})`);

        // 通知移动组件更新移动方向
        this.node.emit('update-movement-direction', direction);
    }

    /**
     * 更新手动模式输入信号
     */
    private updateManualInputSignals(): void {
        // 手动模式的输入信号已在按键事件中更新
    }

    /**
     * 更新AI模式输入信号
     */
    private updateAIInputSignals(): void {
        if (!this._aiIntentionComponent) {
            return;
        }

        // 从AI意向组件获取输入信号
        const wantsToAttack = this._aiIntentionComponent.wantsToAttack();
        const wantsToMove = this._aiIntentionComponent.wantsToMove();

        // 更新输入信号
        this._currentInputSignals.wantsToAttack = wantsToAttack;
        this._currentInputSignals.hasMovementInput = wantsToMove;

        // 如果有移动意向，更新移动组件的目标
        if (wantsToMove) {
            const targetPosition = this._aiIntentionComponent.getMovementTarget();
            if (targetPosition) {
                this.updateMovementTarget(targetPosition);
            }
        }
    }

    /**
     * 更新移动目标
     */
    private updateMovementTarget(targetPosition: Vec3): void {
        // 通知移动组件设置目标位置
        const movementComponent = this.node.getComponent(MovementComponent);
        if (movementComponent && typeof movementComponent.setTargetPosition === 'function') {
            movementComponent.setTargetPosition(targetPosition);
        }

        // 计算移动方向并通知移动组件
        const myPosition = this.node.getWorldPosition();
        const direction = new Vec3();
        Vec3.subtract(direction, targetPosition, myPosition);
        direction.normalize();

        // 转换为键盘输入格式的方向信号
        const keyStates: { [key: number]: boolean } = {};
        if (Math.abs(direction.x) > Math.abs(direction.y)) {
            // 水平移动优先
            if (direction.x > 0.1) {
                keyStates[68] = true; // D key
            } else if (direction.x < -0.1) {
                keyStates[65] = true; // A key
            }
        } else {
            // 垂直移动
            if (direction.y > 0.1) {
                keyStates[87] = true; // W key
            } else if (direction.y < -0.1) {
                keyStates[83] = true; // S key
            }
        }

        // 发送移动方向事件
        this.node.emit('update-movement-direction', keyStates);
    }

    /**
     * 重用回调
     */
    private onReuse(): void {
        // 重新设置输入系统
        this.setupInput();

        // 重启状态机
        if (this._stateMachine) {
            this._stateMachine.start();
        }
    }

    /**
     * 回收回调
     */
    private onRecycle(): void {
        // 停止状态机
        if (this._stateMachine) {
            this._stateMachine.reset();
        }

        // 清理输入
        this.cleanupInput();
    }

    /**
     * 重置状态回调
     */
    private onResetState(): void {
        // 重置输入状态
        this._currentInputSignals = {
            hasMovementInput: false,
            wantsToAttack: false
        };
    }
}