// assets/scripts/animation/MonsterAnimationController.ts

import { _decorator, Component, Node, Animation, AnimationClip, Sprite, SpriteFrame, Vec3 } from 'cc';
import { AnimationManager } from './AnimationManager';
import { AnimationState, AnimationDirection } from './AnimationConfig';
import { EnemyData } from '../configs/EnemyConfig';
import { eventManager } from '../core/EventManager';
import { GameEvents } from '../core/GameEvents';
import { levelManager } from '../core/LevelManager';

const { ccclass, property } = _decorator;

/**
 * 怪物动画控制器
 * 负责管理怪物的动画状态和播放
 */
@ccclass('MonsterAnimationController')
export class MonsterAnimationController extends Component {
    
    // 动画管理器
    private animationManager: AnimationManager | null = null;
    
    // 当前状态
    private currentState: AnimationState = AnimationState.IDLE;
    private currentDirection: AnimationDirection = AnimationDirection.FRONT;
    
    // 敌人数据
    private enemyData: EnemyData | null = null;
    
    // 组件引用
    private spriteComponent: Sprite | null = null;
    private animationComponent: Animation | null = null;
    
    // 状态标记
    private isControllerReady: boolean = false;
    
    // 动画结束回调
    private onAnimationFinished: (() => void) | null = null;
    
    protected onLoad() {
        this.setupComponents();
        this.setupEventListeners();
    }
    
    protected onDestroy() {
        this.cleanupEventListeners();
    }
    
    /**
     * 设置组件引用
     */
    private setupComponents() {
        // 获取或添加 Sprite 组件
        this.spriteComponent = this.getComponent(Sprite);
        if (!this.spriteComponent) {
            this.spriteComponent = this.addComponent(Sprite);
        }
        
        // 获取动画管理器实例
        this.animationManager = AnimationManager.instance;
    }
    
    /**
     * 设置事件监听器
     */
    private setupEventListeners() {
        eventManager.on(GameEvents.CHARACTER_DAMAGED, this.onCharacterDamaged.bind(this));
        eventManager.on(GameEvents.CHARACTER_DIED, this.onCharacterDied.bind(this));
        eventManager.on(GameEvents.CHARACTER_STATS_INITIALIZED, this.onCharacterStatsInitialized.bind(this));
    }
    
    /**
     * 清理事件监听器
     */
    private cleanupEventListeners() {
        eventManager.off(GameEvents.CHARACTER_DAMAGED, this.onCharacterDamaged.bind(this));
        eventManager.off(GameEvents.CHARACTER_DIED, this.onCharacterDied.bind(this));
        eventManager.off(GameEvents.CHARACTER_STATS_INITIALIZED, this.onCharacterStatsInitialized.bind(this));
    }
    
    /**
     * 角色受伤事件处理
     */
    private onCharacterDamaged(characterStats: any, damage: number) {
        // 检查是否是当前角色
        if (characterStats.node === this.node) {
            this.playHurtAnimation();
        }
    }
    
    /**
     * 角色死亡事件处理
     */
    private onCharacterDied(characterStats: any) {
        // 检查是否是当前角色
        if (characterStats.node === this.node) {
            this.playDieAnimation();
        }
    }
    
    /**
     * 角色属性初始化完成事件处理
     */
    private onCharacterStatsInitialized(characterStats: any) {
        // 检查是否是当前角色
        if (characterStats.node === this.node) {
            // 可以在这里进行一些初始化后的动画设置
            this.playIdleAnimation();
        }
    }
    
    /**
     * 使用敌人数据初始化
     * @param enemyData 敌人数据
     */
    public async initializeWithEnemyData(enemyData: EnemyData) {
        this.enemyData = enemyData;
        
        if (!this.animationManager) {
            console.error('MonsterAnimationController: AnimationManager not initialized');
            return;
        }
        
        try {
            // 优先从关卡缓存获取动画剪辑
            let animationClips: Map<string, AnimationClip> | null = null;
            
            if (levelManager.isLevelActive()) {
                const currentLevelId = levelManager.getCurrentLevelId();
                animationClips = this.animationManager.getLevelAnimationClips(currentLevelId, enemyData.id);
                
                if (animationClips) {
                    console.log(`MonsterAnimationController: Using cached animations for ${enemyData.name} from level ${currentLevelId}`);
                } else {
                    console.warn(`MonsterAnimationController: No cached animations found for ${enemyData.name} in level ${currentLevelId}, creating new ones`);
                }
            }
            
            // 如果关卡缓存中没有，则创建新的动画剪辑
            if (!animationClips) {
                console.log(`MonsterAnimationController: Creating new animation clips for ${enemyData.name}`);
                animationClips = await this.animationManager.createAllAnimationClips(enemyData);
            }
            
            // 设置动画组件
            this.animationComponent = this.animationManager.setupAnimationComponent(this.node, animationClips);
            
            // 设置节点缩放
            this.node.setScale(enemyData.nodeScale, enemyData.nodeScale, 1);
            
            // 设置为就绪状态
            this.isControllerReady = true;
            
            // 播放默认动画
            this.playIdleAnimation();
            
            console.log(`MonsterAnimationController initialized for: ${enemyData.name} (using ${animationClips ? 'cached' : 'new'} animations)`);
            
        } catch (error) {
            console.error('MonsterAnimationController: Failed to initialize with enemy data', error);
        }
    }
    
    /**
     * 播放待机动画
     */
    public playIdleAnimation() {
        if (!this.isControllerReady) return;
        
        this.currentState = AnimationState.IDLE;
        this.playCurrentAnimation();
    }
    
    /**
     * 播放移动动画
     */
    public playMoveAnimation() {
        if (!this.isControllerReady) return;
        
        this.currentState = AnimationState.WALK;
        this.playCurrentAnimation();
    }
    
    /**
     * 播放攻击动画
     */
    public playAttackAnimation() {
        if (!this.isControllerReady) return;
        
        this.currentState = AnimationState.ATTACK;
        this.playCurrentAnimation();
    }
    
    /**
     * 播放受伤动画
     */
    public playHurtAnimation() {
        if (!this.isControllerReady) return;
        
        this.currentState = AnimationState.HURT;
        this.playCurrentAnimation();
    }
    
    /**
     * 播放死亡动画
     */
    public playDieAnimation() {
        if (!this.isControllerReady) return;
        
        this.currentState = AnimationState.DEATH;
        this.playCurrentAnimation();
        
        // 死亡动画播放完成后发送事件
        this.onAnimationFinished = () => {
            eventManager.emit(GameEvents.MONSTER_DEATH_ANIMATION_FINISHED, this);
        };
        
        // 延迟发送死亡动画完成事件
        this.scheduleOnce(() => {
            if (this.onAnimationFinished) {
                this.onAnimationFinished();
                this.onAnimationFinished = null;
            }
        }, 1.0);
    }
    
    /**
     * 播放施法动画
     */
    public playCastAnimation() {
        if (!this.isControllerReady) return;
        
        this.currentState = AnimationState.CAST;
        this.playCurrentAnimation();
    }
    
    /**
     * 播放当前动画
     */
    private playCurrentAnimation() {
        if (!this.animationManager || !this.animationComponent) return;
        
        const success = this.animationManager.playAnimation(this.animationComponent, this.currentState, this.currentDirection);
        if (success) {
            console.log(`MonsterAnimationController: Playing animation ${this.currentState}_${this.currentDirection}`);
        }
    }
    
    /**
     * 设置方向
     * @param direction 动画方向
     */
    public setDirection(direction: AnimationDirection) {
        this.currentDirection = direction;
        
        // 如果当前有动画在播放，重新播放以更新方向
        if (this.isControllerReady) {
            this.playCurrentAnimation();
        }
    }
    
    /**
     * 根据目标位置设置方向
     * @param targetPosition 目标位置
     */
    public setDirectionToTarget(targetPosition: Vec3) {
        if (!this.isControllerReady) return;
        
        const currentPos = this.node.position;
        const deltaX = targetPosition.x - currentPos.x;
        const deltaY = targetPosition.y - currentPos.y;
        
        // 根据位置差异确定方向
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            // 水平方向为主
            this.currentDirection = deltaX > 0 ? AnimationDirection.RIGHT : AnimationDirection.LEFT;
        } else {
            // 垂直方向为主
            this.currentDirection = deltaY > 0 ? AnimationDirection.BACK : AnimationDirection.FRONT;
        }
        
        // 重新播放动画以更新方向
        this.playCurrentAnimation();
    }
    
    /**
     * 获取当前动画状态
     */
    public getCurrentState(): AnimationState {
        return this.currentState;
    }
    
    /**
     * 获取当前方向
     */
    public getCurrentDirection(): AnimationDirection {
        return this.currentDirection;
    }
    
    /**
     * 检查动画控制器是否已就绪
     */
    public isReady(): boolean {
        return this.isControllerReady;
    }
    
    /**
     * 获取敌人数据
     */
    public getEnemyData(): EnemyData | null {
        return this.enemyData;
    }
    
    /**
     * 停止所有动画
     */
    public stopAllAnimations() {
        this.unscheduleAllCallbacks();
        this.onAnimationFinished = null;
        
        if (this.animationComponent && this.animationManager) {
            this.animationManager.stopAnimation(this.animationComponent);
        }
    }
    
    /**
     * 重置到初始状态
     */
    public resetToIdle() {
        this.stopAllAnimations();
        this.currentState = AnimationState.IDLE;
        this.currentDirection = AnimationDirection.FRONT;
        
        if (this.isControllerReady) {
            this.playIdleAnimation();
        }
    }
} 