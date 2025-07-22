import { _decorator, Component, Animation, Sprite, Vec2, Node, EventKeyboard, KeyCode, input, Input, find, Graphics, Color, Collider2D, RigidBody2D, Enum, UITransform, instantiate, Prefab, Label, tween, director, Vec3, ERigidBody2DType, BoxCollider2D } from 'cc';
import { dataManager } from '../core/DataManager';
import { EnemyData } from '../configs/EnemyConfig';
import { CharacterStats } from '../components/CharacterStats';
import { systemConfigManager } from '../core/SystemConfig';
import { poolManager } from '../core/PoolManager';
import { AnimationState, AnimationDirection } from './AnimationConfig';
import { animationManager } from './AnimationManager';
import { Faction, FactionUtils } from '../configs/FactionConfig';
import { TargetInfo } from '../core/MonsterAI';

import { PhysicsGroup } from '../configs/PhysicsConfig';
import { factionManager } from '../core/FactionManager';
import { TargetSelector } from '../core/TargetSelector';
import { GameEvents } from '../core/GameEvents';
import { eventManager } from '../core/EventManager';
import { FireballLauncher } from '../launcher/FireballLauncher';
import { GameManager } from '../core/GameManager';

const { ccclass, property } = _decorator;
class TempVarPool {
    // Vec2 临时变量池
    public static readonly tempVec2_1 = new Vec2();
    public static readonly tempVec2_2 = new Vec2();
    public static readonly tempVec2_3 = new Vec2();
    
    // Vec3 临时变量池
    public static readonly tempVec3_1 = new Vec3();
    public static readonly tempVec3_2 = new Vec3();
    public static readonly tempVec3_3 = new Vec3();
    
    /**
     * 重置所有临时变量为零向量（调试用）
     */
    public static resetAll(): void {
        this.tempVec2_1.set(0, 0);
        this.tempVec2_2.set(0, 0);
        this.tempVec2_3.set(0, 0);
        this.tempVec3_1.set(0, 0, 0);
        this.tempVec3_2.set(0, 0, 0);
        this.tempVec3_3.set(0, 0, 0);
    }
}

// ============= 对象池工厂管理器 =============

/**
 * 角色对象池配置
 */
interface CharacterPoolConfig {
    poolName: string;
    characterClass: string;
    enemyConfigId: string;
    initialSize?: number;
    maxSize?: number;
}

/**
 * 角色池化工厂管理器
 * 统一管理所有BaseCharacterDemo子类的对象池创建
 */
export class CharacterPoolFactory {
    private static instance: CharacterPoolFactory | null = null;
    private poolConfigs: Map<string, CharacterPoolConfig> = new Map();
    private activeCharacters: Set<BaseCharacterDemo> = new Set();
    
    private constructor() {}
    
    public static getInstance(): CharacterPoolFactory {
        if (!CharacterPoolFactory.instance) {
            CharacterPoolFactory.instance = new CharacterPoolFactory();
        }
        return CharacterPoolFactory.instance;
    }
    
    /**
     * 注册角色类型的对象池配置
     */
    public registerCharacterPool(config: CharacterPoolConfig): void {
        this.poolConfigs.set(config.characterClass, config);
        
        // 预热对象池
        if (config.initialSize && config.initialSize > 0) {
            this.preWarmPool(config);
        }
        
        console.log(`[PoolFactory] 注册角色池: ${config.characterClass} -> ${config.poolName}`);
    }
    
    /**
     * 预热对象池
     */
    private preWarmPool(config: CharacterPoolConfig): void {
        const preWarmCount = config.initialSize || 5;
        console.log(`[PoolFactory] 预热对象池 ${config.poolName}，数量: ${preWarmCount}`);
        
        for (let i = 0; i < preWarmCount; i++) {
            // 这里需要具体的预制体或节点创建逻辑
            // 暂时先注释，等具体实现
            // const node = this.createPoolNode(config);
            // poolManager.put(node);
        }
    }
    
    /**
     * 创建角色实例（强制从对象池）
     */
    public createCharacter(characterClass: string, options?: {
        characterId?: string;
        position?: Vec3;
        controlMode?: ControlMode;
        aiFaction?: string;
        aiBehaviorType?: string;
    }): BaseCharacterDemo | null {
        const config = this.poolConfigs.get(characterClass);
        if (!config) {
            console.error(`[PoolFactory] 未注册的角色类型: ${characterClass}`);
            return null;
        }
        
        // 从对象池获取节点
        const node = poolManager.get(config.poolName);
        if (!node) {
            console.error(`[PoolFactory] 对象池 ${config.poolName} 获取节点失败`);
            return null;
        }
        
        // 获取或添加BaseCharacterDemo组件
        let character = node.getComponent(BaseCharacterDemo);
        if (!character) {
            console.error(`[PoolFactory] 节点缺少BaseCharacterDemo组件`);
            poolManager.put(node); // 归还无效节点
            return null;
        }
        
        character.setEnemyType(characterClass);
        console.log(`[PoolFactory] ✅ 已设置敌人类型: ${characterClass}`);
        
        // 设置池化属性
        const characterId = options?.characterId || `${characterClass}_${Date.now()}`;
        character.setPoolingProperties(true, config.poolName, characterId);
        
        // 设置角色配置
        if (options?.controlMode !== undefined) {
            character.controlMode = options.controlMode;
        }
        if (options?.aiFaction) {
            character.aiFaction = options.aiFaction;
        }
        if (options?.aiBehaviorType) {
            character.aiBehaviorType = options.aiBehaviorType;
        }
        console.log(`[PoolFactory] 设置角色配置: ${characterClass}`, options);
        
        // 【修复】先执行重用回调，再设置位置（避免位置被重置）
        character.onReuseFromPool();
        
        // 设置位置（在重用回调之后，确保不被重置）
        if (options?.position) {
            node.setPosition(options.position);
            console.log(`[PoolFactory] ✅ 设置最终位置: (${options.position.x}, ${options.position.y})`);
        }
        
        // 加入活跃角色集合
        this.activeCharacters.add(character);
        
        console.log(`[PoolFactory] 创建角色成功: ${character.aiFaction}`);
        return character;
    }
    
    /**
     * 回收角色到对象池
     */
    public recycleCharacter(character: BaseCharacterDemo): void {
        if (!character || !character.getIsFromPool()) {
            console.warn(`[PoolFactory] 尝试回收非池化角色`);
            return;
        }
        
        // 从活跃集合移除
        this.activeCharacters.delete(character);
        
        // 执行回收回调
        character.onRecycleToPool();
        
        // 归还到对象池
        poolManager.put(character.node);
        
        console.log(`[PoolFactory] 角色已回收: ${character.characterId} -> ${character.getPoolName()}`);
    }
    
    /**
     * 回收所有活跃角色
     */
    public recycleAllCharacters(): void {
        const charactersToRecycle = Array.from(this.activeCharacters);
        charactersToRecycle.forEach(character => {
            this.recycleCharacter(character);
        });
        console.log(`[PoolFactory] 已回收所有角色，数量: ${charactersToRecycle.length}`);
    }
    
    /**
     * 获取活跃角色数量
     */
    public getActiveCharacterCount(): number {
        return this.activeCharacters.size;
    }
    
    /**
     * 获取指定类型的活跃角色
     */
    public getActiveCharactersByType(characterClass: string): BaseCharacterDemo[] {
        return Array.from(this.activeCharacters).filter(character => 
            character.getCharacterType && character.getCharacterType() === characterClass
        );
    }
}

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
    private animationFinished: boolean = false;
    
    enter(): void {
        console.log('[StateMachine] 进入 Attacking 状态');
        this.animationFinished = false;
        
        // 播放攻击动画，并传入一个回调，在动画完成时设置标志
        this.character.playAttackAnimation(() => {
            this.animationFinished = true;
        });
    }
    
    update(deltaTime: number): void {
        // 在update中检查动画是否完成
        if (this.animationFinished) {
            // 动画完成后，根据移动意图决定下一个状态
            if (this.character.hasMovementInput()) {
                this.character.transitionToState(CharacterState.WALKING);
            } else {
                this.character.transitionToState(CharacterState.IDLE);
            }
        }
        // 攻击状态下不处理移动
    }
    
    exit(): void {
        console.log('[StateMachine] 离开 Attacking 状态');
        this.animationFinished = false; // 重置标志
    }
    
    canTransitionTo(newState: CharacterState): boolean {
        // 攻击中可以被受伤或死亡打断
        return newState === CharacterState.HURT || newState === CharacterState.DEAD || newState === CharacterState.IDLE;
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
        const currentState = this.character.getCurrentState();
        
        if (this.character.hasMovementInput()) {
            if (currentState !== CharacterState.WALKING) {
                console.log('[StateMachine] 转换到行走状态');
                this.character.transitionToState(CharacterState.WALKING);
            }
        } else {
            if (currentState !== CharacterState.IDLE) {
                console.log('[StateMachine] 转换到待机状态');
                this.character.transitionToState(CharacterState.IDLE);
            }
        }
    }
}

// 死亡状态
export class DeadState extends State {
    private deathTimer: number = 0;
    private autoRecycleDelay: number = 2.0; // 死亡后2秒自动回收
    
    enter(): void {
        console.log('[StateMachine] 进入 Dead 状态');
        this.deathTimer = 0;
        this.character.playDeathAnimation();
        
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
        console.log('[StateMachine] 离开 Dead 状态');
        this.deathTimer = 0;
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
        
        // 【修复】检查是否已经在目标状态，避免重复转换
        const currentState = this.getCurrentState();
        if (currentState === newState) {
            // 静默跳过重复转换，避免日志污染
            return true;
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
 * 现在集成了智能攻击系统和完整的角色功能
 */
@ccclass('BaseCharacterDemo')
export class BaseCharacterDemo extends Component {

    @property({
        displayName: "移动速度",
        tooltip: "角色移动速度（像素/秒）"
    })
    protected moveSpeed: number =5;

    @property({
        displayName: "角色ID",
        tooltip: "用于对象池管理的角色标识"
    })
    public characterId: string = '';

    @property({
        type: Enum(ControlMode),
        displayName: "控制模式",
        tooltip: "MANUAL: 键盘手动控制, AI: 自动AI控制"
    })
    public controlMode: ControlMode = ControlMode.MANUAL;

    @property({
        displayName: "AI阵营",
        tooltip: "AI模式下的阵营 (red/blue/green/purple/player)"
    })
    public aiFaction: string = "red";

    public aiBehaviorType: string = "melee";

    // 【新增】意图系统
    public wantsToAttack: boolean = false;

    // 核心组件
    protected animationComponent: Animation | null = null;
    protected spriteComponent: Sprite | null = null;
    protected characterStats: CharacterStats | null = null;
    protected rigidBody: RigidBody2D | null = null;
    protected collider: Collider2D | null = null;
    
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
    
    // AI相关属性已整合到enemyData中
    protected currentTarget: Node | null = null;
    protected targetInfo: TargetInfo | null = null;
    protected lastTargetSearchTime: number = 0;
    protected targetSearchInterval: number = 1000; // 1秒搜索一次目标
    protected originalPosition: Vec3 = new Vec3(); // AI回归位置
    protected lastAIDebugTime: number = 0; // AI调试日志频率控制
    
    // 血条显示系统
    protected healthBarNode: Node | null = null;
    protected healthBarGraphics: Graphics | null = null;
    
    // 对象池相关
    protected isFromPool: boolean = false;
    protected poolName: string = '';

    // 智能攻击系统 (从UniversalCharacterDemo合并)
    private fireballLauncher: FireballLauncher | null = null;
    private isRangedAttacker: boolean = false;
    private hasRangedSkills: boolean = false;
    
    // 显式设置的敌人类型（用于正常模式下MonsterSpawner设置）
    private explicitEnemyType: string | null = null;

    /**
     * 设置敌人类型 - 供MonsterSpawner等外部调用
     * @param enemyType 敌人类型ID，如 'lich_normal', 'ent_elite' 等
     */
    public setEnemyType(enemyType: string): void {
        console.log(`[BaseCharacterDemo] 🔧 设置敌人类型: ${enemyType}`);
        this.explicitEnemyType = enemyType;
    }

    /**
     * 获取敌人配置ID - 支持多种模式 (从UniversalCharacterDemo合并)
     */
    protected getEnemyConfigId(): string {
        // 优先级1：显式设置的类型（正常模式下由MonsterSpawner设置）
        if (this.explicitEnemyType) {
            return this.explicitEnemyType;
        }
        
        // 优先级2：从GameManager获取（手动测试模式）
        if (!GameManager.instance) {
            console.warn('[BaseCharacterDemo] GameManager.instance 不存在，使用默认敌人类型');
            return 'ent_normal';
        }

        // 检查是否为手动测试模式
        if (GameManager.instance.manualTestMode) {
            const availableTypes = GameManager.instance.getAvailableEnemyTypes();
            const currentIndex = GameManager.instance.testEnemyType;
            
            if (currentIndex >= 0 && currentIndex < availableTypes.length) {
                const enemyType = availableTypes[currentIndex];
                console.log(`[BaseCharacterDemo] 🎮 手动测试模式，从 GameManager 获取敌人类型: ${enemyType} (索引: ${currentIndex})`);
                return enemyType;
            } else {
                console.warn(`[BaseCharacterDemo] GameManager 中的敌人类型索引 ${currentIndex} 无效，使用默认类型`);
                return 'ent_normal';
            }
        }
        
        // 优先级3：正常模式的处理
        if (GameManager.instance.normalMode) {
            // 【修复】检查是否正在初始化过程中，如果是则延迟警告
            const isInitializing = !this.node.activeInHierarchy || this.node.name.includes('Pool');
            
            if (isInitializing) {
                console.log(`[BaseCharacterDemo] 📝 正常模式初始化中，暂时使用默认类型 (节点: ${this.node.name})`);
            } else {
                console.log(`[BaseCharacterDemo] ⚠️ 正常模式但未设置敌人类型，使用默认类型 (建议通过 setEnemyType 设置)`);
            }
        }
        
        return 'ent_normal';
    }

    /**
     * 获取角色显示名称 - 基于敌人类型生成
     */
    protected getCharacterDisplayName(): string {
        const baseId = this.getEnemyConfigId();
        return `BaseCharacterDemo_${baseId}`;
    }

    /**
     * 执行特殊攻击逻辑 - 智能判断攻击方式 (从UniversalCharacterDemo合并)
     */
    protected performSpecialAttack(): void {
        if (!this.enemyData) {
            console.log(`[${this.getCharacterDisplayName()}] 无敌人配置数据，使用基础攻击`);
            this.performMeleeAttack();
            return;
        }

        // 检查是否为远程攻击敌人
        if (this.isRangedAttacker) {
            this.performRangedAttack();
        } else {
            console.log(`[${this.getCharacterDisplayName()}] 执行近战攻击`);
            this.performMeleeAttack();
        }
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
            const distance = Vec2.distance(this.node.position, this.currentTarget.position);
            const attackRange = this.enemyData?.attackRange || 60;
            
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
     * 执行远程攻击（火球发射）- 从UniversalCharacterDemo合并
     */
    protected performRangedAttack(): void {
        if (!this.fireballLauncher) {
            console.warn(`[${this.getCharacterDisplayName()}] 远程攻击敌人但火球发射器未初始化`);
            return;
        }

        // 在攻击动画的合适帧触发火球
        const fireballTriggerTime = this.calculateFireballTriggerTime();
        
        setTimeout(() => {
            console.log(`[${this.getCharacterDisplayName()}] 触发远程攻击 - 发射火球`);
            
            // 根据当前状态调整火球参数
            this.adjustFireballParamsBasedOnState();
            
            // 发射火球
            this.launchFireball();
        }, fireballTriggerTime);
    }

    /**
     * 计算火球触发时间（基于动画帧率和敌人配置）
     */
    private calculateFireballTriggerTime(): number {
        if (!this.enemyData) return 333; // 默认值

        // 基于动画速度和帧数计算合适的触发时间
        const frameRate = this.enemyData.animationSpeed || 12;
        const triggerFrame = 5; // 通常在第5帧触发
        return (triggerFrame / frameRate) * 1000; // 转换为毫秒
    }

    /**
     * 根据敌人状态动态调整火球参数
     */
    private adjustFireballParamsBasedOnState(): void {
        if (!this.enemyData || !this.characterStats) return;

        // 获取生命值百分比
        const healthPercent = this.characterStats.currentHealth / this.characterStats.maxHealth;
        
        // 基于怪物配置的基础伤害值计算
        let damage = this.enemyData.baseAttack;
        
        // 血量越低，火球伤害越高（狂暴效果）
        if (healthPercent < 0.3) {
            damage = Math.floor(this.enemyData.baseAttack * 1.8); // 高伤害
            console.log(`[${this.getCharacterDisplayName()}] 进入狂暴状态，火球威力大幅提升！`);
        } else if (healthPercent < 0.6) {
            damage = Math.floor(this.enemyData.baseAttack * 1.4); // 中等伤害
            console.log(`[${this.getCharacterDisplayName()}] 受伤状态，火球威力提升`);
        }
        
        // 更新火球发射器的伤害
        if (this.fireballLauncher) {
            this.fireballLauncher.damage = damage;
        }
    }

    /**
     * 发射火球 - 支持动态瞄准（AI模式瞄准当前目标，手动模式瞄准最近敌人）
     */
    private launchFireball(): void {
        if (!this.fireballLauncher) {
            console.warn(`[${this.getCharacterDisplayName()}] 火球发射器未初始化`);
            return;
        }

        // 检查是否在冷却中
        if (this.fireballLauncher.isOnCooldown()) {
            console.log(`[${this.getCharacterDisplayName()}] 火球发射器冷却中，无法发射`);
            return;
        }

        let targetToAim: any = null;

        // 根据控制模式选择目标
        if (this.controlMode === ControlMode.AI) {
            // AI模式：瞄准当前AI目标
            targetToAim = this.getAICurrentTarget?.() || this.currentTarget;
        } else if (this.controlMode === ControlMode.MANUAL) {
            // 手动模式：智能瞄准最近的敌人
            targetToAim = this.findNearestEnemy?.();
        }
        
        if (targetToAim && targetToAim.isValid) {
            // 直接朝目标位置发射火球（精确瞄准）
            const targetPos = targetToAim.position;
            const mode = this.controlMode === ControlMode.AI ? 'AI' : '手动';
            console.log(`[${this.getCharacterDisplayName()}] 🎯 ${mode}模式精确瞄准目标 ${targetToAim.name} 位置: (${targetPos.x.toFixed(1)}, ${targetPos.y.toFixed(1)})`);
            this.fireballLauncher.launchFireballToPosition(targetPos);
        } else {
            // 没有目标时按角度发射
            const targetAngle = this.calculateLaunchAngle();
            console.log(`[${this.getCharacterDisplayName()}] 📐 无目标，按朝向发射火球: ${targetAngle}°`);
            this.fireballLauncher.launchFireballAtAngle(targetAngle);
        }
        
        console.log(`[${this.getCharacterDisplayName()}] 🔥 火球发射完成！伤害: ${this.fireballLauncher.damage}`);
    }

    /**
     * 动态计算发射角度 - 优先瞄准当前目标，否则基于朝向（性能优化：避免创建临时对象）
     */
    private calculateLaunchAngle(): number {
        // 优先瞄准当前AI目标
        const currentTarget = this.getAICurrentTarget?.() || this.currentTarget;
        
        if (currentTarget && currentTarget.isValid) {
            // 【性能优化】直接使用 position 属性，避免创建临时变量
            const myPos = this.node.position;
            const targetPos = currentTarget.position;
            
            // 计算方向向量（直接计算，无需临时对象）
            const deltaX = targetPos.x - myPos.x;
            const deltaY = targetPos.y - myPos.y;
            
            // 计算角度（弧度转角度）
            const angleRadians = Math.atan2(deltaY, deltaX);
            const angleDegrees = angleRadians * 180 / Math.PI;
            
            return angleDegrees;
        }
        
        // 备用方案：没有目标时基于角色朝向计算角度
        let baseAngle = 0;
        
        // 根据当前朝向确定基础角度
        switch (this.currentDirection) {
            case AnimationDirection.FRONT:
                baseAngle = -90; // 向下
                break;
            case AnimationDirection.BACK:
                baseAngle = 90;  // 向上
                break;
            case AnimationDirection.LEFT:
                baseAngle = 180; // 向左
                break;
            case AnimationDirection.RIGHT:
                baseAngle = 0;   // 向右
                break;
            default:
                baseAngle = 0;
        }
        
        console.log(`[${this.getCharacterDisplayName()}] 📐 基于朝向发射，角度: ${baseAngle}°`);
        return baseAngle;
    }

    /**
     * 寻找最近的敌人（手动模式用）
     */
    protected findNearestEnemy(): Node | null {
        if (!this.enemyData) return null;

        const attackRange = this.enemyData.attackRange || 60;
        const selector = TargetSelector.getInstance();
        if (!selector) {
            console.warn(`[${this.getCharacterDisplayName()}] 全局TargetSelector未初始化，无法查找敌人`);
            return null;
        }

        // 获取当前角色的阵营
        let myFaction = this.getFaction();
        
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

        // 获取目标的阵营信息并检查是否应该攻击
        const targetCharacterStats = target.getComponent('CharacterStats');
        if (targetCharacterStats) {
            const myFaction = this.getFaction();
            const targetFaction = (targetCharacterStats as any).faction;
            
            // 检查阵营关系 - 只攻击敌对阵营
            if (!factionManager.doesAttack(myFaction, targetFaction)) {
                console.log(`%c[FACTION] ${this.getCharacterDisplayName()} (${myFaction}) 不会攻击同盟/中立目标 ${target.name} (${targetFaction})`, 'color: blue; font-weight: bold');
                return;
            }
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
     * 获取角色类型（公开版本的getEnemyConfigId）
     */
    public getCharacterType(): string {
        return this.getEnemyConfigId();
    }

    /**
     * 检查是否有移动输入
     */
    public hasMovementInput(): boolean {
        const hasInput = this.moveDirection.length() > 0;
        
        // 如果没有移动输入，立即停止物理运动
        if (!hasInput) {
            this.stopPhysicalMovement();
        }
        
        return hasInput;
    }

    /**
     * 立即停止物理运动
     */
    public stopPhysicalMovement(): void {
        if (this.rigidBody) {
            this.rigidBody.linearVelocity = new Vec2(0, 0);
        }
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
        
        // 【性能优化】复用静态临时变量进行动画效果
        const moveOffset = TempVarPool.tempVec2_1;
        const scaleTarget = TempVarPool.tempVec2_2;
        moveOffset.set(0, 50);
        scaleTarget.set(0.5, 0.5);
        
        // 动画效果：向上飘动并逐渐消失
        tween(damageNode)
            .parallel(
                tween().by(0.5, { position: moveOffset }),
                tween().delay(0.1).to(0.4, { scale: scaleTarget })
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
     * 初始化AI - 简化版本，直接使用enemyData（性能优化：使用定时器搜索目标）
     */
    public initializeAI(): void {
        if (this.controlMode !== ControlMode.AI || !this.enemyData) {
            console.warn(`[${this.getCharacterDisplayName()}] AI初始化条件不满足`);
            return;
        }
        
        // 保存初始位置用于AI回归
        this.originalPosition.set(this.node.position);

        console.log(`[${this.getCharacterDisplayName()}] AI配置已初始化 - 探测范围: ${this.enemyData.detectionRange || 200}, 攻击范围: ${this.enemyData.attackRange || 60}`);
        
        // 【性能优化】使用定时器进行目标搜索，避免在每帧update中执行
        const searchInterval = this.targetSearchInterval / 1000; // 转换为秒
        this.schedule(this.updateAITargetSearch, searchInterval);
        console.log(`[${this.getCharacterDisplayName()}] AI目标搜索定时器已启动，间隔: ${searchInterval}秒`);
        
        // 【修复】通知全局TargetSelector有新的AI角色加入
        this.scheduleOnce(() => {
            const selector = TargetSelector.getInstance();
            if (selector && typeof (selector as any).updateTargetCache === 'function') {
                (selector as any).updateTargetCache();
                console.log(`%c[AI] ${this.getCharacterDisplayName()} 已通知TargetSelector更新缓存`, 'color: cyan');
            } else {
                console.warn(`[${this.getCharacterDisplayName()}] 全局TargetSelector未初始化或未实现updateTargetCache，无法更新缓存`);
            }
        }, 0.1);
    }

    /**
     * AI目标搜索（性能优化：改为定时器调用，无需时间间隔检查）
     */
    private updateAITargetSearch(): void {
        if (!this.enemyData) return;
        
        // 【性能优化】移除时间间隔检查，因为现在使用 schedule 定时调用

        const selector = TargetSelector.getInstance();
        if (!selector) {
            console.warn(`[${this.getCharacterDisplayName()}] 全局TargetSelector未初始化`);
            return;
        }
        // 使用CharacterStats中的实际阵营
        const myFaction = this.aiFaction;
        
        // 搜索最佳目标
        const detectionRange = this.enemyData.detectionRange || 200;
        const bestTarget = selector.findBestTarget(
            this.node.position,
            FactionUtils.stringToFaction(myFaction),
            detectionRange
        );



        // 更新目标
        if (bestTarget && bestTarget.node !== this.currentTarget) {
            console.log(`%c[AI] ${this.getCharacterDisplayName()} (${myFaction}) 发现新目标: ${bestTarget.node.name} (${bestTarget.faction})`, 'color: cyan');
            this.currentTarget = bestTarget.node;
            this.targetInfo = bestTarget;
        } else if (this.currentTarget) {
            // 检查当前目标是否仍然有效
            const targetStats = this.currentTarget.getComponent(CharacterStats);
            const distance = Vec3.distance(this.node.position, this.currentTarget.position);
            const pursuitRange = this.enemyData.pursuitRange || 300;

            if (!targetStats || !targetStats.isAlive || distance > pursuitRange) {
                console.log(`%c[AI] ${this.getCharacterDisplayName()} 目标失效，清除目标`, 'color: orange');
                this.currentTarget = null;
                this.targetInfo = null;
            }
        }
    }



    /**
     * 设置AI移动方向（基于物理系统的移动）
     */
    private setAIMoveDirection(targetPosition: Vec3): void {
        // 【性能优化】复用静态临时变量，避免频繁创建对象
        const direction = TempVarPool.tempVec2_1;
        const targetVec2 = TempVarPool.tempVec2_2;
        const nodeVec2 = TempVarPool.tempVec2_3;
        
        // 设置临时变量值
        targetVec2.set(targetPosition.x, targetPosition.y);
        nodeVec2.set(this.node.position.x, this.node.position.y);
        
        // 计算方向向量
        Vec2.subtract(direction, targetVec2, nodeVec2);
        
        if (direction.length() < 10) {
            this.moveDirection.set(0, 0);
            return;
        }
        
        direction.normalize();
        this.moveDirection.set(direction.x, direction.y);
        
        // 更新角色朝向
        this.updateDirectionTowards(targetPosition);
    }

    private updateDirectionTowards(targetPosition: Vec3): void {
        // 【性能优化】复用静态临时变量，避免频繁创建对象
        const direction = TempVarPool.tempVec3_2;
        Vec3.subtract(direction, targetPosition, this.node.position);
    
        if (Math.abs(direction.x) > Math.abs(direction.y)) {
            this.currentDirection = direction.x > 0 ? AnimationDirection.RIGHT : AnimationDirection.LEFT;
        } else {
            this.currentDirection = direction.y > 0 ? AnimationDirection.BACK : AnimationDirection.FRONT;
        }
    }

    async onLoad() {
        await this.ensureManagers();
        // 等待数据管理器加载完成
        await this.waitForDataManager();
        
        // 加载角色配置
        this.loadEnemyConfig();
        
        const enemyType = this.getEnemyConfigId();
        console.log(`[BaseCharacterDemo] 使用敌人类型: ${enemyType}`);
        
        // 分析敌人类型并设置攻击系统
        this.analyzeEnemyAttackType();
        
        // 如果是远程攻击敌人，初始化火球发射器
        if (this.isRangedAttacker) {
            this.setupFireballLauncher();
        }
        
        // 控制模式完全从GameManager获取
        if (GameManager.instance) {
            if (GameManager.instance.manualTestMode) {
                // 手动测试模式：设置为手动控制
                this.controlMode = ControlMode.MANUAL;
                console.log('[BaseCharacterDemo] 手动测试模式：设置为手动控制（键盘操作）');
            } else if (GameManager.instance.normalMode) {
                // AI测试模式 + 正常模式：都设置为AI控制
                this.controlMode = ControlMode.AI;
                const mode = GameManager.instance.testMode ? 'AI测试模式' : '正常模式';
                console.log(`[BaseCharacterDemo] ${mode}：设置为AI控制`);
            } else {
                console.warn('[BaseCharacterDemo] 未知模式，使用默认控制模式');
            }
        } else {
            console.warn('[BaseCharacterDemo] GameManager不存在，使用默认控制模式');
        }
        
        // 设置组件
        this.setupComponents();
        
        // 设置默认阵营（如果还未设置）
        this.setupDefaultFaction();
        
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

        if (GameManager.instance) {
            console.log(`[BaseCharacterDemo] GameManager 可用敌人类型: ${GameManager.instance.getAvailableEnemyTypes().join(', ')}`);
        }
        
        // 输出攻击类型信息
        const attackType = this.isRangedAttacker ? '远程攻击' : '近战攻击';
        const skillInfo = this.hasRangedSkills ? ` (检测到远程技能: ${this.getRemoteSkillNames()})` : ' (无远程技能)';
        const controlModeStr = this.controlMode === ControlMode.MANUAL ? '手动控制' : 'AI控制';
        console.log(`🎯 [${this.getCharacterDisplayName()}] 攻击类型: ${attackType}${skillInfo}, 控制模式: ${controlModeStr}`);

        // 注册到目标选择器
        this.registerToTargetSelector();
        
        // 打印碰撞映射信息（调试用）
        this.printCollisionInfo();
        
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
        this.originalPosition.set(this.node.position);
        
        this.animationComponent = this.getComponent(Animation) || this.addComponent(Animation);
        this.rigidBody = this.getComponent(RigidBody2D) || this.addComponent(RigidBody2D);
        this.collider = this.getComponent(Collider2D) || this.addComponent(Collider2D);
        
        // 配置刚体组件
        this.setupRigidBody();
        
        // 配置碰撞体组件  
        this.setupCollider();
    }

    /**
     * 配置刚体组件
     */
    private setupRigidBody(): void {
        if (!this.rigidBody) return;
        
        // 设置为动态刚体，可以移动但受物理影响
        this.rigidBody.type = ERigidBody2DType.Dynamic;
        
        // 设置基础物理属性 - 移除阻尼以获得恒定速度
        this.rigidBody.linearDamping = 0; // 移除线性阻尼，保持恒定速度
        this.rigidBody.angularDamping = 10; // 角度阻尼，防止旋转
        this.rigidBody.gravityScale = 0; // 不受重力影响（2D俯视角游戏）
        this.rigidBody.allowSleep = false; // 不允许休眠，保持物理更新
        this.rigidBody.fixedRotation = true; // 固定旋转，角色不应该旋转
        
        // 启用碰撞监听
        this.rigidBody.enabledContactListener = true;
        this.rigidBody.bullet = false; // 角色不是高速物体，不需要连续碰撞检测
        
        // 根据当前阵营设置物理分组
        const currentFaction = this.getFaction();
        const physicsGroup = factionManager.getFactionPhysicsGroup(currentFaction);
        this.rigidBody.group = physicsGroup;
        
    }

    /**
     * 配置碰撞体组件
     */
    private setupCollider(): void {
        if (!this.collider || !this.enemyData) return;
        
        // 确保是BoxCollider2D类型
        if (!(this.collider instanceof BoxCollider2D)) {
            // 如果不是BoxCollider2D，移除当前碰撞体并添加新的
            this.node.removeComponent(this.collider);
            this.collider = this.addComponent(BoxCollider2D);
        }
        
        const boxCollider = this.collider as any; // BoxCollider2D类型
        
        // 根据敌人配置设置碰撞体尺寸
        const colliderSize = this.enemyData.colliderSize;
        if (colliderSize) {
            boxCollider.size.width = colliderSize.width;
            boxCollider.size.height = colliderSize.height;
        } else {
            // 默认碰撞体尺寸
            boxCollider.size.width = 50;
            boxCollider.size.height = 50;
        }
        
        // 设置为实体碰撞，不允许穿过
        boxCollider.sensor = false;
        
        // 根据当前阵营设置物理分组
        const currentFaction = this.getFaction();
        const physicsGroup = factionManager.getFactionPhysicsGroup(currentFaction);
        boxCollider.group = physicsGroup;
        
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
        // 检查是否在攻击状态中 (这个检查可以保留，作为快速否决)
        if (this.stateMachine?.isInState(CharacterState.ATTACKING)) {
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
        
        // 【核心修改】设置攻击意图，而不是直接转换状态
        this.wantsToAttack = true; 
        console.log(`[${this.getCharacterDisplayName()}] 产生攻击意图`);
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
            this.updateDirection(); // updateDirection内部也只更新朝向，不动状态机
        }

        // 【移除】所有 stateMachine.transitionTo 的逻辑
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
    public playAttackAnimation(onFinished?: () => void): void {
        if (!this.animationComponent || !this.enemyData) {
            console.warn(`[${this.getCharacterDisplayName()}] 动画组件或敌人数据未初始化`);
            if (onFinished) {
                onFinished();
            }
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
                // 调用传入的回调
                if (onFinished) {
                    onFinished();
                }
                // 不再需要默认的状态决策，AttackingState 会自己处理
            });
        } else {
            console.warn(`[${this.getCharacterDisplayName()}] 攻击动画播放失败: ${animationName}`);
            // 如果动画播放失败，也立即调用回调
            if (onFinished) {
                onFinished();
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
     * 获取当前状态（供外部查询）
     */
    public getCurrentState(): CharacterState | null {
        return this.stateMachine?.getCurrentState() || null;
    }

    /**
     * 更新函数 - 支持AI和手动模式
     */
    protected update(deltaTime: number): void {
        // 如果是AI模式，让AI更新意图
        if (this.controlMode === ControlMode.AI && this.characterStats?.isAlive) {
            this.updateAI(deltaTime);
        }

        // 让状态机根据最新的意图进行更新和决策
        this.stateMachine?.update(deltaTime);

        // 【重要】在每一帧的最后，重置一次性的意图，比如攻击意图
        this.wantsToAttack = false;
    }

    /**
     * AI主更新逻辑（性能优化：目标搜索已移至定时器）
     */
    private updateAI(deltaTime: number): void {
        if (!this.characterStats || !this.characterStats.isAlive || !this.enemyData) {
            return;
        }
        
        // 【性能优化】目标搜索逻辑已移动到独立的定时器中，不再在每帧执行

        // 2. 决策与意图更新
        if (this.currentTarget && this.currentTarget.isValid) {
            const distance = Vec3.distance(this.node.position, this.currentTarget.position);
            const attackRange = this.enemyData.attackRange || 60;

            if (distance <= attackRange) {
                // 在攻击范围内 -> 产生攻击意图
                this.moveDirection.set(0, 0);
                this.updateDirectionTowards(this.currentTarget.position);
                this.wantsToAttack = true; // 设置攻击意图
            } else {
                // 不在攻击范围 -> 产生移动意图
                this.setAIMoveDirection(this.currentTarget.position);
            }
        } else {
            // 没有目标 -> 产生回归或待机的移动意图
            const distanceFromHome = Vec3.distance(this.node.position, this.originalPosition);
            if (distanceFromHome > 10) { // 使用一个小的阈值判断是否 "在家"
                this.setAIMoveDirection(this.originalPosition);
            } else {
                this.moveDirection.set(0, 0);
            }
        }
    }

    /**
     * 处理角色移动 - 由状态机调用（使用物理系统速度控制）
     */
    public handleMovement(deltaTime: number): void {
        if (!this.rigidBody) {
            console.warn(`[${this.getCharacterDisplayName()}] 刚体组件未初始化，无法使用物理移动`);
            return;
        }
        
        // 检查是否有移动输入
        if (this.moveDirection.length() === 0) {
            // 没有移动输入时，立即停止
            this.rigidBody.linearVelocity = new Vec2(0, 0);
            return;
        }
        
        // 使用直接的移动速度（像素/秒）
        const speed = this.moveSpeed;
        
        // 确保移动方向已归一化（对角线移动速度一致）
        const normalizedDirection = TempVarPool.tempVec2_1;
        normalizedDirection.set(this.moveDirection.x, this.moveDirection.y);
        normalizedDirection.normalize();
        
        // 【物理移动】设置刚体的线性速度
        const velocity = TempVarPool.tempVec2_2;
        velocity.set(
            normalizedDirection.x * speed,
            normalizedDirection.y * speed
        );
        
        // 应用速度到刚体
        this.rigidBody.linearVelocity = velocity;
        
        // 注释：边界检查现在由物理系统和碰撞体处理
        // 如果需要硬性边界，可以在场景中添加不可见的墙壁碰撞体
    }

    /**
     * 统一创建接口 - 强制使用对象池
     * @param characterType 角色类型
     * @param options 创建选项
     * @returns BaseCharacterDemo实例
     */
    public static create(characterType: string, options?: {
        characterId?: string;
        position?: Vec3;
        controlMode?: ControlMode;
        aiFaction?: string;
        aiBehaviorType?: string;
    }): BaseCharacterDemo | null {
        return CharacterPoolFactory.getInstance().createCharacter(characterType, options);
    }

    /**
     * 设置对象池属性
     */
    public setPoolingProperties(isFromPool: boolean, poolName: string, characterId: string): void {
        this.isFromPool = isFromPool;
        this.poolName = poolName;
        this.characterId = characterId;
    }

    /**
     * 回收到对象池
     */
    public returnToPool(): void {
        if (this.isFromPool && this.poolName) {
            // 使用CharacterPoolFactory进行回收
            CharacterPoolFactory.getInstance().recycleCharacter(this);
        } else {
            console.warn(`[${this.getCharacterDisplayName()}] 非池化对象，无法回收到对象池`);
        }
    }

    /**
     * 从池中重用时的回调 - 整合了UniversalCharacterDemo的功能
     */
    public onReuseFromPool(): void {
        console.log(`[${this.getCharacterDisplayName()}] 从对象池重用 ID: ${this.characterId}, 敌人类型: ${this.explicitEnemyType}`);
        
        // 【关键修复】如果还没有设置敌人类型，记录警告但不影响执行
        if (!this.explicitEnemyType) {
            console.warn(`[BaseCharacterDemo] ⚠️ 重用时未发现预设敌人类型，将在后续初始化中确定`);
        }
        
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
        
        // 【性能优化】如果是AI模式，重新启动目标搜索定时器
        if (this.controlMode === ControlMode.AI) {
            const searchInterval = this.targetSearchInterval / 1000; // 转换为秒
            this.schedule(this.updateAITargetSearch, searchInterval);
            console.log(`[${this.getCharacterDisplayName()}] AI目标搜索定时器已重新启动，间隔: ${searchInterval}秒`);
        }
        
        console.log(`[BaseCharacterDemo] 重用完成，最终敌人类型: ${this.explicitEnemyType || '未设置'}`);
    }

    /**
     * 回收到池时的回调（性能优化：清理定时器）
     */
    public onRecycleToPool(): void {
        console.log(`[${this.getCharacterDisplayName()}] 回收到对象池 ID: ${this.characterId}`);
        
        // 【性能优化】清理AI目标搜索定时器
        this.unschedule(this.updateAITargetSearch);
        console.log(`[${this.getCharacterDisplayName()}] AI目标搜索定时器已清理`);
        
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
        this.node.setPosition(this.originalPosition);
        
        // 重置方向
        this.currentDirection = AnimationDirection.FRONT;
        
        // 重置输入状态
        this.keyStates = {};
        this.moveDirection.set(0, 0);
        
        // 重置攻击时间
        this.lastAttackTime = 0;
        
        // 重置物理状态 - 立即停止所有运动
        if (this.rigidBody) {
            this.rigidBody.linearVelocity = new Vec2(0, 0);
            this.rigidBody.angularVelocity = 0;
            // 唤醒刚体以确保物理更新
            this.rigidBody.wakeUp();
        }
        
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
            return 'no_state_machine';
        }
        
        return this.stateMachine.getCurrentStateName();
    }

    /**
     * 设置角色阵营
     * @param faction 阵营
     */
    public setFaction(faction: Faction): void {
        const oldFaction = this.getFaction();
        const newFactionString = FactionUtils.factionToString(faction);
        
        // 如果阵营发生变化，需要重新注册
        if (oldFaction !== faction) {
            // 先反注册旧阵营
            this.deregisterFromTargetSelector();
            
            // 设置新阵营
            this.aiFaction = newFactionString;
            
            // 重新注册新阵营
            this.registerToTargetSelector();
            
            console.log(`[${this.getCharacterDisplayName()}] 阵营已变更: ${oldFaction} → ${faction} (aiFaction: ${this.aiFaction})`);
        } else {
            console.log(`[${this.getCharacterDisplayName()}] 阵营未变化: ${faction}`);
        }
        
        this.updateCharacterPhysicsGroup(faction); // 设置物理分组
    }

    /**
     * 根据阵营更新物理分组
     * @param faction 阵营
     */
    private updateCharacterPhysicsGroup(faction: Faction): void {
        const collider = this.getComponent(Collider2D);
        if (!collider) {
            console.warn(`[${this.getCharacterDisplayName()}] 缺少Collider2D组件，无法设置物理分组`);
            return;
        }

        // 使用FactionManager获取对应的物理分组
        const group = factionManager.getFactionPhysicsGroup(faction);
        collider.group = group;
        
        console.log(`[${this.getCharacterDisplayName()}] 物理分组已更新为: ${faction} -> ${group}`);
        
        // 同时更新刚体的分组（如果存在）
        if (this.rigidBody) {
            this.rigidBody.group = group;
            console.log(`[${this.getCharacterDisplayName()}] 刚体分组也已更新为: ${group}`);
        }
    }

    /**
     * 获取角色阵营
     */
    public getFaction(): Faction {
        // 直接从aiFaction属性获取阵营信息
        return FactionUtils.stringToFaction(this.aiFaction);
    }
    
    /**
     * 向目标选择器注册当前角色
     */
    private registerToTargetSelector(): void {
        const selector = TargetSelector.getInstance();
        if (selector) {
            const faction = this.getFaction();
            selector.registerTarget(this.node, faction);
            console.log(`%c[BaseCharacterDemo] 📝 已注册到目标选择器: ${this.node.name} → ${faction}`, 'color: green');
        } else {
            console.warn(`%c[BaseCharacterDemo] ⚠️ 目标选择器未初始化，无法注册: ${this.node.name}`, 'color: orange');
        }
    }
    
    /**
     * 从目标选择器反注册当前角色
     */
    private deregisterFromTargetSelector(): void {
        const selector = TargetSelector.getInstance();
        if (selector) {
            const faction = this.getFaction();
            selector.deregisterTarget(this.node, faction);
            console.log(`%c[BaseCharacterDemo] 🗑️ 已从目标选择器反注册: ${this.node.name} ← ${faction}`, 'color: red');
        }
    }

    /**
     * 设置默认阵营
     * 对于手动控制的角色（通常是玩家），设置为玩家阵营
     * 对于AI控制的角色，通过其他方式设置阵营
     */
    private setupDefaultFaction(): void {
        if (!this.characterStats) {
            return;
        }

        // 【修复】AI模式下不设置默认阵营，等待MonsterSpawner或其他系统设置
        if (this.controlMode === ControlMode.AI) {
            console.log(`[${this.getCharacterDisplayName()}] AI模式，跳过默认阵营设置，等待外部系统设置阵营`);
            return;
        }

        // 对于手动控制的角色，设置为玩家阵营（只有在还是默认player阵营时才设置）
        if (this.controlMode === ControlMode.MANUAL) {
            if (this.aiFaction === "player") {
                this.setFaction(Faction.PLAYER);
                console.log(`[${this.getCharacterDisplayName()}] 手动模式，设置默认玩家阵营`);
            } else {
                console.log(`[${this.getCharacterDisplayName()}] 手动模式，但阵营已设置为: ${this.aiFaction}`);
            }
        }
    }

    // ============= 便利的池化创建方法 =============

    /**
     * 创建玩家角色（手动控制）
     */
    public static createPlayer(characterType: string, position?: Vec3): BaseCharacterDemo | null {
        return BaseCharacterDemo.create(characterType, {
            controlMode: ControlMode.MANUAL,
            position: position
        });
    }

    /**
     * 创建AI敌人
     */
    public static createAIEnemy(characterType: string, options: {
        position?: Vec3;
        faction: string;
        behaviorType?: string;
    }): BaseCharacterDemo | null {
        return BaseCharacterDemo.create(characterType, {
            controlMode: ControlMode.AI,
            position: options.position,
            aiFaction: options.faction,
            aiBehaviorType: options.behaviorType || 'melee'
        });
    }

    /**
     * 回收所有同类型角色
     */
    public static recycleAllByType(characterType: string): void {
        const factory = CharacterPoolFactory.getInstance();
        const characters = factory.getActiveCharactersByType(characterType);
        characters.forEach(character => {
            character.returnToPool();
        });
        console.log(`[BaseCharacterDemo] 已回收所有${characterType}类型角色，数量: ${characters.length}`);
    }

    /**
     * 获取所有活跃角色数量
     */
    public static getActiveCharacterCount(): number {
        return CharacterPoolFactory.getInstance().getActiveCharacterCount();
    }

    onDestroy() {
        // 【性能优化】清理AI目标搜索定时器
        this.unschedule(this.updateAITargetSearch);
        
        // 从目标选择器反注册
        this.deregisterFromTargetSelector();
        
        // 清理输入监听
        this.cleanupInput();
        
        // 停止动画
        if (this.animationComponent) {
            this.animationComponent.stop();
        }
        
        // 清理物理组件 - 立即停止所有运动
        if (this.rigidBody) {
            this.rigidBody.linearVelocity = new Vec2(0, 0);
            this.rigidBody.angularVelocity = 0;
        }
        
        console.log(`[${this.getCharacterDisplayName()}] 组件已清理（包括定时器和物理组件清理）`);
    }

    /**
     * 分析敌人攻击类型（近战/远程）- 基于怪物配置 (从UniversalCharacterDemo合并)
     */
    private analyzeEnemyAttackType(): void {
        if (!this.enemyData) {
            this.isRangedAttacker = false;
            this.hasRangedSkills = false;
            return;
        }

        // 多重判断条件确定是否为远程攻击者
        const enemyId = this.enemyData.id;
        let isRanged = false;

        // 1. 检查是否有projectileId（最直接的远程攻击标识）
        if (this.enemyData.projectileId) {
            isRanged = true;
            console.log(`[${this.getCharacterDisplayName()}] 检测到projectileId: ${this.enemyData.projectileId}，判定为远程攻击`);
        }

        // 2. 检查技能中是否有远程攻击技能
        if (!isRanged && this.enemyData.skills) {
            const hasRangedSkill = this.enemyData.skills.some(skill => 
                skill.id === 'fireball' || 
                skill.id === 'lightning' || 
                skill.id.includes('ranged') ||
                skill.id.includes('projectile')
            );
            if (hasRangedSkill) {
                isRanged = true;
                console.log(`[${this.getCharacterDisplayName()}] 检测到远程技能，判定为远程攻击`);
            }
        }

        // 3. 检查是否有projectileOffsets（火球发射位置偏移）
        if (!isRanged && (this.enemyData as any).projectileOffsets) {
            isRanged = true;
            console.log(`[${this.getCharacterDisplayName()}] 检测到projectileOffsets，判定为远程攻击`);
        }

        // 4. 备用方案：基于敌人ID判断（保持向后兼容）
        if (!isRanged && enemyId.indexOf('lich') !== -1) {
            isRanged = true;
            console.log(`[${this.getCharacterDisplayName()}] 基于敌人ID判断为远程攻击（向后兼容）`);
        }

        this.isRangedAttacker = isRanged;
        this.hasRangedSkills = isRanged;

        const attackType = this.isRangedAttacker ? '远程攻击' : '近战攻击';
        console.log(`[${this.getCharacterDisplayName()}] 攻击类型分析完成: ${attackType} (敌人ID: ${enemyId})`);
    }

    /**
     * 获取远程技能名称
     */
    private getRemoteSkillNames(): string {
        if (this.isRangedAttacker) {
            return 'fireball'; // 默认使用火球术
        }
        return '';
    }

    /**
     * 初始化火球发射器 - 完全基于怪物配置 (从UniversalCharacterDemo合并)
     */
    private setupFireballLauncher(): void {
        // 获取或创建FireballLauncher组件
        this.fireballLauncher = this.getComponent(FireballLauncher);
        
        if (this.fireballLauncher) {
            console.log(`[${this.getCharacterDisplayName()}] 使用预制体中已有的FireballLauncher组件`);
        } else {
            // 创建新的FireballLauncher组件
            this.fireballLauncher = this.addComponent(FireballLauncher);
            console.log(`[${this.getCharacterDisplayName()}] 创建了新的FireballLauncher组件`);
        }
        
        // 从敌人配置中读取参数
        this.configureFireballLauncherFromEnemyData();
        
        console.log(`🔥 [${this.getCharacterDisplayName()}] 火球发射器已初始化，完全依赖对象池`);
    }

    /**
     * 从敌人配置数据中配置火球发射器参数
     */
    private configureFireballLauncherFromEnemyData(): void {
        if (!this.fireballLauncher || !this.enemyData) {
            console.warn(`[${this.getCharacterDisplayName()}] 无法配置火球发射器：组件或敌人数据缺失`);
            return;
        }

        // 设置基础攻击间隔作为发射冷却时间
        this.fireballLauncher.launchCooldown = this.enemyData.attackInterval;
        
        // 查找火球技能配置
        const fireballSkill = this.enemyData.skills?.find(skill => skill.id === 'fireball');
        if (fireballSkill) {
            this.fireballLauncher.launchCooldown = Math.min(this.enemyData.attackInterval, fireballSkill.cooldown);
        }

        // 设置火球基础伤害（从怪物配置获取）
        this.fireballLauncher.damage = this.enemyData.baseAttack;

        // 设置发射者阵营信息（重要！）
        const currentFaction = this.getFaction();
        this.fireballLauncher.setFactionInfo(currentFaction, this.node);

        console.log(`[${this.getCharacterDisplayName()}] 火球发射器配置完成: 冷却=${this.fireballLauncher.launchCooldown}s, 伤害=${this.fireballLauncher.damage}, 阵营=${currentFaction}`);
    }

    /**
     * 确保核心管理器存在于场景中 (从UniversalCharacterDemo合并)
     */
    private async ensureManagers(): Promise<void> {
        let gameManagerNode = find('GameManager');
        if (!gameManagerNode) {
            console.log('[BaseCharacterDemo] 检测到 GameManager 不存在，正在自动创建...');
            gameManagerNode = new Node('GameManager');
            gameManagerNode.addComponent(GameManager);
            find('Canvas')?.addChild(gameManagerNode); // 假设有一个Canvas节点

            // 等待一帧以确保 GameManager 的 onLoad 和 start 方法被调用
            return new Promise(resolve => setTimeout(resolve, 100));
        } else {
            console.log('[BaseCharacterDemo] GameManager 已存在，跳过创建。');
        }
    }



    /**
     * 获取当前敌人类型 - 用于外部查询 (从UniversalCharacterDemo合并)
     */
    public getCurrentEnemyType(): string {
        return this.getEnemyConfigId();
    }

    /**
     * 检查当前敌人是否为远程攻击类型 (从UniversalCharacterDemo合并)
     */
    public isCurrentEnemyRanged(): boolean {
        return this.isRangedAttacker;
    }

    /**
     * 获取攻击类型描述 (从UniversalCharacterDemo合并)
     */
    public getAttackTypeDescription(): string {
        if (this.isRangedAttacker) {
            return `远程攻击 (${this.hasRangedSkills ? this.getRemoteSkillNames() : '基于敌人类型判断'})`;
        } else {
            return '近战攻击';
        }
    }

    /**
     * 获取角色的碰撞信息（调试用）
     */
    public getCollisionInfo(): string {
        const currentFaction = this.getFaction();
        const physicsGroup = factionManager.getFactionPhysicsGroup(currentFaction);
        const enemyGroups = factionManager.getEnemyPhysicsGroups(currentFaction);
        const friendlyGroups = factionManager.getFriendlyPhysicsGroups(currentFaction);
        
        let info = `=== ${this.getCharacterDisplayName()} 碰撞信息 ===\n`;
        info += `阵营: ${currentFaction}\n`;
        info += `物理分组: ${physicsGroup}\n`;
        info += `敌对分组: [${enemyGroups.join(', ')}]\n`;
        info += `友好分组: [${friendlyGroups.join(', ')}]\n`;
        
        return info;
    }

    /**
     * 打印碰撞信息到控制台（调试用）
     */
    public printCollisionInfo(): void {
        console.log(this.getCollisionInfo());
    }

    /**
     * 获取所有可用的敌人类型（用于调试）(从UniversalCharacterDemo合并)
     */
    public getAvailableEnemyTypes(): string[] {
        if (GameManager.instance) {
            return GameManager.instance.getAvailableEnemyTypes();
        }
        return [];
    }
}

// ============= 池化初始化管理器 =============

/**
 * 角色池化系统初始化管理器
 * 用于根据关卡需要动态注册和初始化角色对象池
 */
export class CharacterPoolInitializer {
    private static initializedPools: Set<string> = new Set();
    
    /**
     * 根据关卡数据初始化所需的角色对象池
     * @param levelData 关卡数据或者敌人类型数组
     */
    public static initializePoolsForLevel(levelData: any): void {
        const factory = CharacterPoolFactory.getInstance();
        let enemyTypes: string[] = [];
        
        // 从关卡数据中提取敌人类型
        if (Array.isArray(levelData)) {
            // 直接是敌人类型数组
            enemyTypes = levelData;
        } else if (levelData.monsterSpawners) {
            // 新格式的关卡数据
            levelData.monsterSpawners.forEach((spawner: any) => {
                                 spawner.enemies?.forEach((enemy: any) => {
                     if (enemy.type && enemyTypes.indexOf(enemy.type) === -1) {
                         enemyTypes.push(enemy.type);
                     }
                 });
            });
        } else if (levelData.enemies) {
            // 旧格式的关卡数据
                         levelData.enemies.forEach((enemy: any) => {
                 if (enemy.type && enemyTypes.indexOf(enemy.type) === -1) {
                     enemyTypes.push(enemy.type);
                 }
             });
        }
        
        console.log(`[PoolInitializer] 关卡需要敌人类型:`, enemyTypes);
        
        // 为每个敌人类型注册对象池
        enemyTypes.forEach(enemyType => {
            CharacterPoolInitializer.initializePoolForEnemyType(enemyType);
        });
    }
    
    /**
     * 为单个敌人类型初始化对象池
     * @param enemyType 敌人类型
     */
    public static initializePoolForEnemyType(enemyType: string): void {
        if (CharacterPoolInitializer.initializedPools.has(enemyType)) {
            console.log(`[PoolInitializer] 对象池 ${enemyType} 已存在，跳过初始化`);
            return;
        }
        
        const factory = CharacterPoolFactory.getInstance();
        const config = CharacterPoolInitializer.getPoolConfigForEnemyType(enemyType);
        
        try {
            factory.registerCharacterPool({
                poolName: enemyType,           // 【修复】去掉"Pool"后缀，与GameManager保持一致
                characterClass: enemyType,
                enemyConfigId: enemyType,
                initialSize: config.initialSize,
                maxSize: config.maxSize
            });
            
            CharacterPoolInitializer.initializedPools.add(enemyType);
            console.log(`[PoolInitializer] ✅ 对象池 ${enemyType} 初始化完成 (初始:${config.initialSize}, 最大:${config.maxSize})`);
        } catch (error) {
            console.error(`[PoolInitializer] ❌ 对象池 ${enemyType} 初始化失败:`, error);
        }
    }
    
    /**
     * 根据敌人类型获取对象池配置
     * @param enemyType 敌人类型
     * @returns 池配置
     */
    private static getPoolConfigForEnemyType(enemyType: string): { initialSize: number; maxSize: number } {
        // Boss类敌人
        if (enemyType.includes('boss')) {
            return { initialSize: 1, maxSize: 3 };
        }
        // 精英敌人
        else if (enemyType.includes('elite')) {
            return { initialSize: 2, maxSize: 8 };
        }
        // 史莱姆类（数量较多）
        else if (enemyType.startsWith('slime')) {
            return { initialSize: 5, maxSize: 30 };
        }
        // 常规敌人
        else if (enemyType.includes('normal')) {
            return { initialSize: 3, maxSize: 15 };
        }
        // 特殊类型
        else {
            return { initialSize: 3, maxSize: 15 };
        }
    }
    
    /**
     * 初始化所有预定义的角色对象池（测试模式用）
     */
    public static initializeAllPools(): void {
        const allEnemyTypes = [
            'ent_normal', 'ent_elite', 'ent_boss',
            'lich_normal', 'lich_elite', 'lich_boss',
            'skeleton_normal', 'skeleton_elite', 'skeleton_boss',
            'orc_normal', 'orc_elite', 'orc_boss',
            'goblin_normal', 'goblin_elite', 'goblin_boss',
            'slime_normal', 'slime_fire', 'slime_ice', 'slime_bomb',
            'slime_ghost', 'slime_lightning', 'slime_crystal', 'slime_devil', 'slime_lava',
            'golem_normal', 'golem_elite', 'golem_boss'
        ];
        
        console.log('[PoolInitializer] 测试模式：初始化所有角色对象池');
        CharacterPoolInitializer.initializePoolsForLevel(allEnemyTypes);
    }
    
    /**
     * 清理所有对象池
     */
    public static cleanup(): void {
        CharacterPoolFactory.getInstance().recycleAllCharacters();
        CharacterPoolInitializer.initializedPools.clear();
        console.log('[PoolInitializer] 对象池已清理');
    }
    
    /**
     * 检查是否已初始化指定类型的对象池
     */
    public static isPoolInitialized(enemyType: string): boolean {
        return CharacterPoolInitializer.initializedPools.has(enemyType);
    }
    
    /**
     * 获取已初始化的对象池数量
     */
    public static getInitializedPoolCount(): number {
        return CharacterPoolInitializer.initializedPools.size;
    }
}

