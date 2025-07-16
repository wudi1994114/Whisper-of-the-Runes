// assets/scripts/game/NormalEnemy.ts

import { _decorator, Component, Node, Vec3, Sprite, KeyCode, tween, Vec2 } from 'cc';
import { CharacterStats } from '../components/CharacterStats';
import { MonsterAnimationController } from '../animation/MonsterAnimationController';
import { AnimationState, AnimationDirection } from '../animation/AnimationConfig';
import { dataManager } from '../core/DataManager';
import { eventManager } from '../core/EventManager';
import { EnemyData } from '../configs/EnemyConfig';
import { GameManager, GameMode } from '../core/GameManager';
import { GameEvents } from '../core/GameEvents';

// 状态枚举（按优先级排序）
enum AIState {
    DEATH = 0,     // 最高优先级
    HURT = 1,      // 高优先级
    ATTACK = 2,    // 中优先级
    CHASE = 3,     // 低优先级
    RETURN = 4,    // 低优先级
    PATROL = 5,    // 最低优先级
    IDLE = 6       // 最低优先级
}

const { ccclass, property } = _decorator;

/**
 * 普通敌人脚本
 * 用于测试动画系统和角色属性系统
 */
@ccclass('NormalEnemy')
export class NormalEnemy extends Component {
    
    @property({ displayName: "敌人ID", tooltip: "敌人的类型ID" })
    public enemyId: string = 'ent_normal';
    
    @property({ displayName: "自动初始化", tooltip: "是否在开始时自动初始化" })
    public autoInit: boolean = true;
    
    @property({ displayName: "移动速度", tooltip: "移动速度倍数" })
    public moveSpeed: number = 100;
    
    // 组件引用
    private characterStats: CharacterStats | null = null;
    private animationController: MonsterAnimationController | null = null;
    private spriteComponent: Sprite | null = null;
    
    // 状态管理
    private isInitialized: boolean = false;
    private isMoving: boolean = false;
    private currentTarget: Vec3 | null = null;
    
    // 移动相关
    private currentPosition: Vec3 = new Vec3();
    private targetPosition: Vec3 = new Vec3();
    

    
    // AI状态机相关
    private aiState: AIState = AIState.IDLE;
    private stateTimer: number = 0;
    private stateData: any = {}; // 状态相关数据
    private spawnPosition: Vec3 = new Vec3();
    private lastAttackTime: number = 0;
    private playerController: Component | null = null;
    private enemyConfig: EnemyData | null = null;
    
    protected onLoad() {
        // 按顺序获取和添加组件，避免重复挂载
        this.setupRequiredComponents();
        
        // 注册事件监听
        this.registerEventListeners();
        
        // 注册到 GameManager
        this.registerToGameManager();
        
        console.log(`NormalEnemy loaded: ${this.enemyId}`);
    }

    /**
     * 设置必需的组件
     */
    private setupRequiredComponents() {
        // 1. 首先确保有 Sprite 组件
        this.spriteComponent = this.getComponent(Sprite);
        if (!this.spriteComponent) {
            this.spriteComponent = this.addComponent(Sprite);
            console.log('NormalEnemy: Added Sprite component');
        }
        
        // 2. 确保有 CharacterStats 组件
        this.characterStats = this.getComponent(CharacterStats);
        if (!this.characterStats) {
            this.characterStats = this.addComponent(CharacterStats);
            console.log('NormalEnemy: Added CharacterStats component');
        }
        
        // 3. 确保有 MonsterAnimationController 组件（避免重复添加）
        this.animationController = this.getComponent(MonsterAnimationController);
        if (!this.animationController) {
            this.animationController = this.addComponent(MonsterAnimationController);
            console.log('NormalEnemy: Added MonsterAnimationController component');
        } else {
            console.log('NormalEnemy: MonsterAnimationController already exists');
        }
        
        // 验证所有组件都正确获取到
        if (!this.spriteComponent || !this.characterStats || !this.animationController) {
            console.error('NormalEnemy: Failed to setup required components');
        }
    }
    
    protected start() {
        if (this.autoInit) {
            this.initializeEnemy();
        }
    }
    
    protected onDestroy() {
        // 取消事件监听
        this.unregisterEventListeners();
    }

    /**
     * 注册到 GameManager
     */
    private registerToGameManager() {
        const gameManager = GameManager.instance;
        if (gameManager) {
            gameManager.registerEnemyController(this);
        } else {
            console.warn('NormalEnemy: GameManager not found during registration');
        }
    }
    
    /**
     * 初始化敌人
     */
    public async initializeEnemy() {
        if (this.isInitialized) {
            console.warn('NormalEnemy: Already initialized');
            return;
        }
        
        try {
            // 确保数据已加载
            if (!dataManager.isDataLoaded()) {
                console.log('NormalEnemy: Loading data...');
                await dataManager.loadAllData();
            }
            
            // 获取敌人数据
            const enemyData = dataManager.getEnemyData(this.enemyId);
            if (!enemyData) {
                console.error(`NormalEnemy: Enemy data not found for ${this.enemyId}`);
                return;
            }
            
            // 保存敌人配置
            this.enemyConfig = enemyData;
            
            // 设置出生位置
            this.spawnPosition = this.node.position.clone();
            
            // 初始化角色属性
            if (this.characterStats) {
                await this.characterStats.initWithEnemyData(enemyData);
            }
            
            this.isInitialized = true;
            console.log(`NormalEnemy initialized: ${enemyData.name}`);
            
        } catch (error) {
            console.error('NormalEnemy: Failed to initialize', error);
        }
    }
    

    
    /**
     * 注册事件监听器
     */
    private registerEventListeners() {
        eventManager.on(GameEvents.MONSTER_DEATH_ANIMATION_FINISHED, this.onDeathAnimationFinished.bind(this));
        eventManager.on(GameEvents.GAME_MODE_CHANGED, this.onGameModeChanged.bind(this));
    }
    
    /**
     * 取消事件监听器
     */
    private unregisterEventListeners() {
        eventManager.off(GameEvents.MONSTER_DEATH_ANIMATION_FINISHED, this.onDeathAnimationFinished.bind(this));
        eventManager.off(GameEvents.GAME_MODE_CHANGED, this.onGameModeChanged.bind(this));
    }

    /**
     * 游戏模式改变事件处理
     * @param newMode 新的游戏模式
     * @param oldMode 旧的游戏模式
     */
    private onGameModeChanged(newMode: GameMode, oldMode: GameMode) {
        console.log(`NormalEnemy: Game mode changed from ${GameMode[oldMode]} to ${GameMode[newMode]}`);
        
        if (newMode === GameMode.Testing) {
            console.log('NormalEnemy: Now accepting input commands and movement control');
        } else {
            console.log('NormalEnemy: Input control and movement disabled');
        }
    }

    /**
     * AI更新方法 - 由 GameManager 在 update 中调用
     * @param deltaTime 帧时间
     */
    public updateAI(deltaTime: number): void {
        if (!this.isInitialized || !this.enemyConfig) {
            return;
        }

        this.stateTimer += deltaTime;
        
        // 检查状态切换条件（按优先级）
        const newState = this.checkStateTransition();
        if (newState !== this.aiState) {
            this.changeState(newState);
        }
        
        // 执行当前状态逻辑
        this.executeCurrentState(deltaTime);
    }

    /**
     * 检查状态切换（按优先级顺序）
     */
    private checkStateTransition(): AIState {
        // 优先级0：死亡检查
        if (!this.characterStats?.isAlive) {
            return AIState.DEATH;
        }
        
        // 优先级1：受伤检查
        if (this.aiState === AIState.HURT && this.stateTimer < this.enemyConfig.hurtDuration) {
            return AIState.HURT; // 继续受伤状态
        }
        
        // 获取玩家位置和距离
        const playerPos = this.getPlayerPosition();
        if (!playerPos) return AIState.IDLE;
        
        const currentPos = this.node.position;
        const distanceToPlayer = Vec3.distance(currentPos, playerPos);
        const distanceToSpawn = Vec3.distance(currentPos, this.spawnPosition);
        
        // 优先级2：攻击检查
        if (distanceToPlayer <= this.enemyConfig.attackRange && this.canAttack()) {
            return AIState.ATTACK;
        }
        
        // 优先级3：追逐检查
        if (distanceToPlayer <= this.enemyConfig.detectionRange && 
            distanceToSpawn <= this.enemyConfig.returnDistance) {
            return AIState.CHASE;
        }
        
        // 优先级4：返回检查
        if (distanceToSpawn > this.enemyConfig.returnDistance || 
            distanceToPlayer > this.enemyConfig.pursuitRange) {
            return AIState.RETURN;
        }
        
        // 默认：待机状态
        return AIState.IDLE;
    }

    /**
     * 状态切换处理
     */
    private changeState(newState: AIState): void {
        this.exitState(this.aiState);
        this.previousState = this.aiState;
        this.aiState = newState;
        this.stateTimer = 0;
        this.enterState(newState);
    }

    /**
     * 进入状态处理
     */
    private enterState(state: AIState): void {
        switch (state) {
            case AIState.HURT:
                this.animationController?.playHurtAnimation();
                break;
            case AIState.DEATH:
                this.animationController?.playDieAnimation();
                break;
            case AIState.ATTACK:
                this.stateData.lastAttackTime = Date.now();
                break;
            case AIState.CHASE:
                this.animationController?.playMoveAnimation();
                break;
            case AIState.RETURN:
                this.animationController?.playMoveAnimation();
                break;
            case AIState.IDLE:
                this.animationController?.playIdleAnimation();
                break;
        }
    }

    /**
     * 退出状态处理
     */
    private exitState(state: AIState): void {
        // 状态退出时的清理逻辑
        switch (state) {
            case AIState.HURT:
                // 受伤结束后，会在下一帧的checkStateTransition中自动处理
                break;
            case AIState.ATTACK:
                // 攻击结束后可能继续追逐或返回待机
                break;
        }
    }

    /**
     * 执行当前状态逻辑
     */
    private executeCurrentState(deltaTime: number): void {
        switch (this.aiState) {
            case AIState.IDLE:
                this.executeIdleState(deltaTime);
                break;
            case AIState.CHASE:
                this.executeChaseState(deltaTime);
                break;
            case AIState.ATTACK:
                this.executeAttackState(deltaTime);
                break;
            case AIState.RETURN:
                this.executeReturnState(deltaTime);
                break;
            case AIState.HURT:
                this.executeHurtState(deltaTime);
                break;
            case AIState.DEATH:
                this.executeDeathState(deltaTime);
                break;
        }
    }

    /**
     * 执行待机状态
     */
    private executeIdleState(deltaTime: number): void {
        // 待机状态不需要特殊处理
    }

    /**
     * 执行追逐状态
     */
    private executeChaseState(deltaTime: number): void {
        const playerPos = this.getPlayerPosition();
        if (!playerPos) return;

        this.chasePlayer(playerPos, deltaTime);
    }

    /**
     * 执行攻击状态
     */
    private executeAttackState(deltaTime: number): void {
        const currentTime = Date.now() / 1000;
        
        // 检查攻击冷却
        if (currentTime - this.lastAttackTime >= this.enemyConfig.attackInterval) {
            this.lastAttackTime = currentTime;
            
            // 播放攻击动画
            if (this.animationController) {
                this.animationController.playAttackAnimation();
            }
            
            // 造成伤害
            this.dealDamageToPlayer();
            
            console.log('Monster: Attacked player!');
        }
    }

    /**
     * 执行返回状态
     */
    private executeReturnState(deltaTime: number): void {
        this.returnToSpawn(deltaTime);
    }

    /**
     * 执行受伤状态
     */
    private executeHurtState(deltaTime: number): void {
        // 受伤状态期间不移动，只播放受伤动画
    }

    /**
     * 执行死亡状态
     */
    private executeDeathState(deltaTime: number): void {
        // 死亡状态期间不移动，只播放死亡动画
    }

    /**
     * 追逐玩家
     */
    private chasePlayer(playerPos: Vec3, deltaTime: number): void {
        const currentPos = this.node.position;
        const direction = new Vec3();
        Vec3.subtract(direction, playerPos, currentPos);
        direction.normalize();
        
        // 转换为2D方向
        const direction2D = new Vec2(direction.x, direction.y);
        
        // 使用追逐速度移动
        const chaseSpeed = this.enemyConfig.moveSpeed * this.enemyConfig.chaseSpeedMultiplier;
        const moveDistance = chaseSpeed * deltaTime;
        
        // 更新位置
        this.currentPosition = this.node.position;
        this.targetPosition.set(
            this.currentPosition.x + direction2D.x * moveDistance,
            this.currentPosition.y + direction2D.y * moveDistance,
            this.currentPosition.z
        );

        // 简单的边界检查
        this.targetPosition.x = Math.max(-960, Math.min(960, this.targetPosition.x));
        this.targetPosition.y = Math.max(-540, Math.min(540, this.targetPosition.y));

        // 应用位置
        this.node.position = this.targetPosition;
        
        // 设置朝向
        this.setFacingDirection(direction2D);
    }

    /**
     * 返回出生点
     */
    private returnToSpawn(deltaTime: number): void {
        const currentPos = this.node.position;
        const direction = new Vec3();
        Vec3.subtract(direction, this.spawnPosition, currentPos);
        direction.normalize();
        
        // 转换为2D方向
        const direction2D = new Vec2(direction.x, direction.y);
        
        // 使用正常速度返回
        const moveDistance = this.enemyConfig.moveSpeed * deltaTime;
        
        // 更新位置
        this.currentPosition = this.node.position;
        this.targetPosition.set(
            this.currentPosition.x + direction2D.x * moveDistance,
            this.currentPosition.y + direction2D.y * moveDistance,
            this.currentPosition.z
        );

        // 应用位置
        this.node.position = this.targetPosition;
        this.setFacingDirection(direction2D);
    }

    /**
     * 设置朝向
     */
    private setFacingDirection(direction: Vec2): void {
        if (!this.animationController) return;
        
        if (Math.abs(direction.x) > Math.abs(direction.y)) {
            // 水平方向为主
            this.animationController.setDirection(
                direction.x > 0 ? AnimationDirection.RIGHT : AnimationDirection.LEFT
            );
        } else {
            // 垂直方向为主
            this.animationController.setDirection(
                direction.y > 0 ? AnimationDirection.BACK : AnimationDirection.FRONT
            );
        }
    }

    /**
     * 获取玩家位置
     */
    private getPlayerPosition(): Vec3 | null {
        if (!this.playerController) {
            // 尝试获取玩家控制器
            const gameManager = GameManager.instance;
            if (gameManager) {
                this.playerController = (gameManager as any).playerController;
            }
        }
        
        if (this.playerController) {
            const getPositionMethod = (this.playerController as any).getPosition;
            if (getPositionMethod && typeof getPositionMethod === 'function') {
                return getPositionMethod.call(this.playerController);
            }
        }
        
        return null;
    }

    /**
     * 检查是否可以攻击
     */
    private canAttack(): boolean {
        const currentTime = Date.now() / 1000;
        return currentTime - this.lastAttackTime >= this.enemyConfig.attackInterval;
    }

    /**
     * 对玩家造成伤害
     */
    private dealDamageToPlayer(): void {
        if (!this.playerController) return;
        
        const getStatsMethod = (this.playerController as any).getCharacterStats;
        if (getStatsMethod && typeof getStatsMethod === 'function') {
            const playerStats = getStatsMethod.call(this.playerController);
            if (playerStats && this.characterStats) {
                const damage = this.characterStats.baseAttack;
                playerStats.takeDamage(damage);
                console.log(`Monster dealt ${damage} damage to player`);
            }
        }
    }

    /**
     * 受伤处理 - 会打断当前状态
     */
    public takeDamage(damage: number): void {
        if (this.characterStats) {
            const died = this.characterStats.takeDamage(damage);
            if (!died) {
                // 强制切换到受伤状态
                this.changeState(AIState.HURT);
            }
        }
    }

    /**
     * 设置出生位置
     */
    public setSpawnPosition(position: Vec3): void {
        this.spawnPosition = position.clone();
    }

    /**
     * 获取AI状态（用于调试）
     */
    public getAIState(): AIState {
        return this.aiState;
    }

    /**
     * 移动方法 - 由 GameManager 在 update 中调用
     * @param direction 移动方向
     * @param deltaTime 帧时间
     */
    public move(direction: Vec2, deltaTime: number): void {
        if (!this.isInitialized || !this.characterStats || !this.characterStats.isAlive) {
            return;
        }

        if (direction.length() === 0) {
            // 停止移动，播放待机动画
            if (this.animationController) {
                this.animationController.playIdleAnimation();
            }
            return;
        }

        // 播放移动动画
        if (this.animationController) {
            this.animationController.playMoveAnimation();
            
            // 根据移动方向设置动画方向
            if (Math.abs(direction.x) > Math.abs(direction.y)) {
                // 水平方向为主
                this.animationController.setDirection(direction.x > 0 ? AnimationDirection.RIGHT : AnimationDirection.LEFT);
            } else {
                // 垂直方向为主
                this.animationController.setDirection(direction.y > 0 ? AnimationDirection.BACK : AnimationDirection.FRONT);
            }
        }

        // 计算移动距离
        const moveDistance = this.moveSpeed * deltaTime * this.characterStats.speed;
        
        // 更新位置
        this.currentPosition = this.node.position;
        this.targetPosition.set(
            this.currentPosition.x + direction.x * moveDistance,
            this.currentPosition.y + direction.y * moveDistance,
            this.currentPosition.z
        );

        // 简单的边界检查
        this.targetPosition.x = Math.max(-960, Math.min(960, this.targetPosition.x));
        this.targetPosition.y = Math.max(-540, Math.min(540, this.targetPosition.y));

        // 应用位置
        this.node.position = this.targetPosition;
    }

    /**
     * 停止移动
     */
    public stopMovement(): void {
        if (this.animationController) {
            this.animationController.playIdleAnimation();
        }
        console.log('NormalEnemy: Movement stopped');
    }

    /**
     * 处理来自 GameManager 的输入
     * 这个方法会被 GameManager 在 Testing 模式下调用
     */
    public handleInput(keyCode: KeyCode): void {
        if (!this.isInitialized || !this.animationController) {
            return;
        }
        
        // 保留基本的测试功能
        switch (keyCode) {
            case KeyCode.KEY_I:
                this.showStatusInfo();
                break;
        }
    }
    

    

    
    /**
     * 显示状态信息
     */
    private showStatusInfo() {
        console.log('=== Current Status ===');
        console.log(this.getStatusInfo());
        console.log('======================');
    }
    

    

    
    /**
     * 死亡动画完成事件
     */
    private onDeathAnimationFinished(controller: MonsterAnimationController) {
        if (controller === this.animationController) {
            console.log('NormalEnemy: Death animation finished');
            // 这里可以添加死亡后的处理逻辑，比如销毁节点、掉落物品等
        }
    }
    
    /**
     * 获取当前状态信息
     */
    public getStatusInfo(): string {
        if (!this.isInitialized) {
            return 'Not initialized';
        }
        
        const health = this.characterStats ? `${this.characterStats.currentHealth}/${this.characterStats.maxHealth}` : 'N/A';
        const animInfo = this.characterStats ? this.characterStats.getCurrentAnimationInfo() : { state: 'N/A', direction: 'N/A' };
        const enemyData = this.characterStats ? this.characterStats.enemyData : null;
        
        return `Enemy: ${enemyData?.name || 'Unknown'}, Health: ${health}, Animation: ${animInfo.state}_${animInfo.direction}, Moving: ${this.isMoving}`;
    }
    
    /**
     * 设置敌人ID并重新初始化
     * @param newEnemyId 新的敌人ID
     */
    public async setEnemyId(newEnemyId: string) {
        this.enemyId = newEnemyId;
        this.isInitialized = false;
        await this.initializeEnemy();
    }

    /**
     * 公共方法：获取移动速度
     */
    public getMoveSpeed(): number {
        return this.moveSpeed;
    }

    /**
     * 公共方法：设置移动速度
     */
    public setMoveSpeed(speed: number): void {
        this.moveSpeed = speed;
    }

    /**
     * 公共方法：检查是否可以移动
     */
    public canMove(): boolean {
        return this.isInitialized && this.characterStats && this.characterStats.isAlive;
    }

    /**
     * 公共方法：获取当前位置
     */
    public getPosition(): Vec3 {
        return this.node.position;
    }

    /**
     * 公共方法：设置位置
     */
    public setPosition(position: Vec3): void {
        this.node.position = position;
    }
}