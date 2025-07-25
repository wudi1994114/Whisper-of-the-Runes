// assets/scripts/game/FireballController.ts

import { _decorator, Component, Node, Sprite, Animation, Collider2D, RigidBody2D, Vec3, Vec2, AnimationClip, SpriteAtlas, JsonAsset, IPhysics2DContact, resources, Prefab, js, UITransform, Contact2DType, SpriteFrame, animation, PhysicsSystem2D } from 'cc';
import { dataManager } from '../managers/DataManager';
import { Faction } from '../configs/FactionConfig';
import { eventManager } from '../managers/EventManager';
import { poolManager } from '../managers/PoolManager';
import { PhysicsGroup } from '../configs/PhysicsConfig';
import { factionManager } from '../managers/FactionManager';
import { resourceManager } from '../managers/ResourceManager';
import { animationManager } from '../managers/AnimationManager';
import { ProjectileAnimationState } from '../configs/AnimationConfig';

const { ccclass, property } = _decorator;

/**
 * 火球控制器
 * 负责管理火球的三阶段动画：生成、飞行、爆炸
 * 支持对象池管理
 */
@ccclass('FireballController')
export class FireballController extends Component {
    
    @property({ tooltip: "火球移动速度（像素/秒）" })
    public moveSpeed: number = 1;
    
    @property({ tooltip: "火球伤害值" })
    public damage: number = 50;
    
    @property({ tooltip: "火球生命时间（秒）" })
    public lifeTime: number = 5;
    
    @property({ tooltip: "动画帧率" })
    public frameRate: number = 12;
    
    @property({ tooltip: "发射角度（度），0=水平向右，90=向上，-90=向下，180=向左" })
    public launchAngle: number = 0;
    
    // 组件引用
    private spriteComponent: Sprite | null = null;
    private animationComponent: Animation | null = null;
    private colliderComponent: Collider2D | null = null;
    private rigidBody: RigidBody2D | null = null;
    
    // 动画相关
    private currentState: ProjectileAnimationState = ProjectileAnimationState.SPAWN;
    private isInitialized: boolean = false;
    
    // 移动相关
    private moveDirection: Vec3 = new Vec3(1, 0, 0);
    private currentLifeTime: number = 0;
    private isDestroying: boolean = false;
    
    // 阵营相关
    private shooterFaction: Faction = Faction.PLAYER;  // 发射者阵营
    private shooterNode: Node | null = null;            // 发射者节点
    
    // 对象池相关
    private isFromPool: boolean = false;
    private poolName: string = 'fireball';
    
    protected onLoad() {
        this.setupComponents();
        this.loadConfigFromDataManager();
        this.loadResources();
    }
    
    protected start() {
        this.setupCollisionDetection();
    }
    
    protected update(deltaTime: number): void {
        if (!this.isInitialized || this.isDestroying) return;
        
        // 更新生命时间
        this.currentLifeTime += deltaTime;
        if (this.currentLifeTime >= this.lifeTime && this.currentState !== ProjectileAnimationState.EXPLODING) {
            this.explode();
            return;
        }
        
        // 飞行状态下移动
        if (this.currentState === ProjectileAnimationState.FLYING) {
            this.updateMovement(deltaTime);
        }
    }
    
    /**
     * 设置组件引用
     */
    private setupComponents(): void {
        // 获取Sprite组件
        this.spriteComponent = this.getComponent(Sprite);
        if (!this.spriteComponent) {
            this.spriteComponent = this.addComponent(Sprite);
        }
        
        // 获取Animation组件
        this.animationComponent = this.getComponent(Animation);
        if (!this.animationComponent) {
            this.animationComponent = this.addComponent(Animation);
        }
        
        // 设置火球节点的锚点，防止旋转时位置偏移
        const uiTransform = this.getComponent(UITransform);
        if (uiTransform) {
            uiTransform.setAnchorPoint(0.5, 0.5); 
        }
        
        // 获取碰撞体组件
        this.colliderComponent = this.getComponent(Collider2D);
        
        // 获取刚体组件
        this.rigidBody = this.getComponent(RigidBody2D);
        
        // 【关键修复】确保刚体启用碰撞监听
        if (this.rigidBody) {
            this.rigidBody.enabledContactListener = true;
        } else {
            console.warn('FireballController: ⚠️ 缺少RigidBody2D组件，碰撞检测将不工作');
        }
    }
    
    /**
     * 加载火球资源（使用AnimationManager）
     */
    private async loadResources(): Promise<void> {
        try {
            // 使用AnimationManager创建投射物动画剪辑
            const animationClips = await animationManager.createProjectileAnimationClips('fireball');
            
            if (animationClips.size === 0) {
                console.warn('FireballController: 没有创建任何火球动画剪辑');
                return;
            }

            // 设置动画组件
            this.animationComponent = animationManager.setupAnimationComponent(this.node, animationClips);
            
            // 初始化完成，开始播放生成动画
            this.isInitialized = true;
            this.startSpawnAnimation();
            
        } catch (error) {
            console.error('FireballController: 资源加载失败', error);
        }
    }
    
    /**
     * 设置碰撞检测
     */
    private setupCollisionDetection(): void {
        if (this.colliderComponent) {
            // 监听碰撞开始事件
            this.colliderComponent.on(Contact2DType.BEGIN_CONTACT, this.onCollisionEnter, this);
        } else {
            console.warn('FireballController: 未找到碰撞体组件，无法检测碰撞');
        }
    }
    
    /**
     * 碰撞检测回调
     */
    private onCollisionEnter(selfCollider: Collider2D, otherCollider: Collider2D, contact: IPhysics2DContact | null): void {
        if (this.isDestroying) return;
        
        const targetCharacterDemo = otherCollider.node.getComponent('BaseCharacterDemo');
        if (targetCharacterDemo) {
            const targetFaction = (targetCharacterDemo as any).getFaction();
            const shouldAttack = factionManager.doesAttack(this.shooterFaction, targetFaction);
            
            // 检查阵营关系 - 只有敌对阵营才造成伤害
            if (shouldAttack) {
                this.dealDamageToTarget(otherCollider.node, this.damage);
            }
        } else {
            // 如果没有BaseCharacterDemo组件，可能是墙壁等障碍物，直接爆炸
            console.log(`FireballController: 撞击障碍物 ${otherCollider.node.name}（无BaseCharacterDemo组件）`);
        }
        this.explode();
    }

    /**
     * 对目标造成伤害
     */
    private dealDamageToTarget(target: Node, damage: number): void {
        if (!target || !target.isValid) {
            console.warn(`❌ [DAMAGE] FireballController: 无效的攻击目标`);
            return;
        }

        // 获取目标的BaseCharacterDemo组件来造成伤害
        const targetCharacterDemo = target.getComponent('BaseCharacterDemo');
        
        if (targetCharacterDemo && (targetCharacterDemo as any).takeDamage) {
            try {
                (targetCharacterDemo as any).takeDamage(damage);
            } catch (error) {
                console.error(`❌ [DAMAGE] BaseCharacterDemo.takeDamage调用失败:`, error);
            }
        } else {
            // 如果没有BaseCharacterDemo，尝试CharacterStats组件
            const targetStats = target.getComponent('CharacterStats');
            
            if (targetStats && (targetStats as any).takeDamage) {
                try {
                    (targetStats as any).takeDamage(damage);
                } catch (error) {
                    console.error(`❌ [DAMAGE] CharacterStats.takeDamage调用失败:`, error);
                }
            } else {
                    console.warn(`❌ [DAMAGE] FireballController: 目标 ${target.name} 没有可攻击的组件`);
            }
        }
    }
    
    /**
     * 开始生成动画（使用AnimationManager）
     */
    private startSpawnAnimation(): void {
        if (!this.animationComponent) return;
        
        this.currentState = ProjectileAnimationState.SPAWN;
        
        // 使用AnimationManager播放生成动画
        const success = animationManager.playProjectileAnimation(
            this.animationComponent, 
            'fireball', 
            ProjectileAnimationState.SPAWN
        );
        
        if (success) {
            // 监听生成动画结束
            this.animationComponent.once(Animation.EventType.FINISHED, this.onSpawnAnimationFinished, this);
        } else {
            console.warn('FireballController: 生成动画播放失败');
        }
    }
    
    /**
     * 生成动画结束回调
     */
    private onSpawnAnimationFinished(): void {
        // 移除动画转换日志
        
        // 如果移动方向为默认值，使用设置的角度
        if (this.moveDirection.equals(new Vec3(1, 0, 0))) {
            this.setAngle(this.launchAngle);
        }
        
        this.startFlyingAnimation();
    }
    
    /**
     * 开始飞行动画（使用AnimationManager）
     */
    private startFlyingAnimation(): void {
        if (!this.animationComponent) return;
        
        this.currentState = ProjectileAnimationState.FLYING;
        
        // 使用AnimationManager播放飞行动画
        const success = animationManager.playProjectileAnimation(
            this.animationComponent, 
            'fireball', 
            ProjectileAnimationState.FLYING
        );
        
        if (!success) {
            console.warn('FireballController: 飞行动画播放失败');
        }
    }
    
    /**
     * 触发爆炸
     */
    public explode(): void {
        if (this.isDestroying || this.currentState === ProjectileAnimationState.EXPLODING) return;
        
        this.currentState = ProjectileAnimationState.EXPLODING;
        this.isDestroying = true;
        
        // 停止移动
        if (this.rigidBody) {
            this.rigidBody.linearVelocity = new Vec2(0, 0);
        }
        
        // 播放爆炸动画（使用AnimationManager）
        if (this.animationComponent) {
            const success = animationManager.playProjectileAnimation(
                this.animationComponent, 
                'fireball', 
                ProjectileAnimationState.EXPLODING
            );
            
            if (success) {
                // 监听爆炸动画结束
                this.animationComponent.once(Animation.EventType.FINISHED, this.onExplodeAnimationFinished, this);
            } else {
                console.warn('FireballController: 爆炸动画播放失败');
                this.destroyFireball();
            }
        } else {
            // 如果没有动画组件，直接销毁
            this.destroyFireball();
        }
        
        // 移除爆炸日志
    }
    
    /**
     * 爆炸动画结束回调
     */
    private onExplodeAnimationFinished(): void {
        // 移除爆炸动画结束日志
        this.destroyFireball();
    }
    
    /**
     * 销毁火球 - 修改为支持对象池
     */
    private destroyFireball(): void {
        // 发送火球销毁事件
        eventManager.emit('FIREBALL_DESTROYED', this.node);
        
        // 尝试回收到对象池，失败则直接销毁
        this.returnToPool();
    }

    /**
     * 回收火球到对象池，如果失败则直接销毁
     */
    public returnToPool(): void {
        try {
            // 清理状态
            this.onRecycleToPool();
            
            // 尝试回收到对象池
            poolManager.put(this.node);
            console.log('FireballController: 火球已回收到对象池');
        } catch (error) {
            // 对象池回收失败，直接销毁节点
            console.warn('FireballController: 对象池回收失败，直接销毁节点', error);
            this.node.destroy();
        }
    }

    /**
     * 更新移动
     */
    private updateMovement(deltaTime: number): void {
        if (!this.rigidBody || !this.moveDirection || this.moveDirection.length() === 0) return;
        
        // 计算速度向量
        const velocity = new Vec2(this.moveDirection.x, this.moveDirection.y).multiplyScalar(this.moveSpeed);
        
        // 设置刚体的线性速度
        this.rigidBody.linearVelocity = velocity;
    }

    /**
     * 设置火球移动方向
     * @param direction 移动方向（已归一化）
     */
    public setMoveDirection(direction: Vec3): void {
        this.moveDirection = direction.clone();
        this.moveDirection.normalize();
        
        // 根据移动方向自动计算并设置视觉角度
        this.updateVisualAngleFromDirection();
    }
    
    /**
     * 根据移动方向更新视觉角度
     */
    private updateVisualAngleFromDirection(): void {
        if (this.moveDirection.length() > 0) {
            // 计算角度（弧度转度），Y轴翻转以修正上下镜像问题
            const angleRadians = Math.atan2(-this.moveDirection.y, this.moveDirection.x);
            const angleDegrees = -angleRadians * 180 / Math.PI;
            
            // 更新角度属性
            this.launchAngle = angleDegrees;
            
            // 设置节点的视觉旋转角度
            this.node.angle = angleDegrees;
            
            // 强制让运动方向与动画方向保持一致：从视觉角度重新计算运动方向
            this.alignMovementWithVisualDirection(angleDegrees);
            
            // 移除频繁的角度更新日志
        }
    }

    /**
     * 让运动方向与视觉动画方向保持一致
     * @param visualAngleDegrees 视觉角度（度）
     */
    private alignMovementWithVisualDirection(visualAngleDegrees: number): void {
        // 从视觉角度重新计算运动方向（不翻转Y轴）
        const angleRadians = visualAngleDegrees * Math.PI / 180;
        const correctedDirection = new Vec3(
            Math.cos(angleRadians),
            Math.sin(angleRadians),
            0
        );
        correctedDirection.normalize();
        
        // 直接更新运动方向，绕过 setMoveDirection 避免循环调用
        this.moveDirection = correctedDirection;
        
        // 移除频繁的运动方向日志
    }

    /**
     * 设置火球发射角度
     * @param angleDegrees 角度（度），0=水平向右，90=向上，-90=向下，180=向左
     */
    public setAngle(angleDegrees: number): void {
        this.launchAngle = angleDegrees;
        
        // 将角度转换为弧度
        const angleRadians = angleDegrees * Math.PI / 180;
        
        // 计算方向向量（cos为x分量，sin为y分量）
        const direction = new Vec3(
            Math.cos(angleRadians),
            Math.sin(angleRadians),
            0
        );
        
        this.setMoveDirection(direction);
        
        // 设置火球节点的视觉旋转角度，让动画朝向与发射方向一致
        // 注意：如果火球朝向与期望相反，可能需要加上180度或调整角度
        this.node.angle = angleDegrees;
        
        // 移除频繁的发射角度日志
    }

    /**
     * 设置火球目标位置（自动计算方向）
     * @param targetPos 目标位置
     */
    public setTarget(targetPos: Vec3): void {
        const currentPos = this.node.position;
        const direction = new Vec3();
        Vec3.subtract(direction, targetPos, currentPos);
        direction.normalize();
        this.setMoveDirection(direction);
        
        // 同时更新角度属性
        this.launchAngle = Math.atan2(direction.y, direction.x) * 180 / Math.PI;
    }

    /**
     * 运行时设置火球属性
     * @param damage 伤害值
     * @param lifeTime 生命时间
     * @param shooterFaction 发射者阵营
     * @param shooterNode 发射者节点
     */
    public setFireballParams(damage?: number, lifeTime?: number, shooterFaction?: Faction, shooterNode?: Node): void {
        if (damage !== undefined) {
            this.damage = damage;
        }
        if (lifeTime !== undefined) {
            this.lifeTime = lifeTime;
        }
        if (shooterFaction !== undefined) {
            this.shooterFaction = shooterFaction;
            this.updateProjectilePhysicsGroup(); // 更新物理分组
        }
        if (shooterNode !== undefined) {
            this.shooterNode = shooterNode;
        }
        
        console.log(`Fireball params set: damage=${this.damage}, faction=${this.shooterFaction}`);
    }

    /**
     * 根据发射者阵营更新投射物的物理分组
     */
    private updateProjectilePhysicsGroup(): void {
        const collider = this.getComponent(Collider2D);
        if (!collider) {
            console.warn(`FireballController: 缺少Collider2D组件，无法设置物理分组`);
            return;
        }
        
        let group: number;
        switch (this.shooterFaction) {
            case Faction.PLAYER:
                group = PhysicsGroup.PLAYER_PROJECTILE;
                break;
            case Faction.RED:
                group = PhysicsGroup.RED_PROJECTILE;
                break;
            case Faction.BLUE:
                group = PhysicsGroup.BLUE_PROJECTILE;
                break;
            case Faction.GREEN:
                group = PhysicsGroup.GREEN_PROJECTILE;
                break;
            case Faction.PURPLE:
                group = PhysicsGroup.PURPLE_PROJECTILE;
                break;
            default:
                group = PhysicsGroup.DEFAULT;
                break;
        }

        collider.group = group;
        const groupName = Object.keys(PhysicsGroup).find(key => (PhysicsGroup as any)[key] === group) || 'UNKNOWN';
        console.log(`FireballController: 物理分组已更新为 ${groupName} (${group})`);
    }

    // =================== 对象池管理方法 ===================

    /**
     * 设置对象池属性
     * @param isFromPool 是否来自对象池
     * @param poolName 对象池名称
     */
    public setPoolingProperties(isFromPool: boolean, poolName: string = 'fireball'): void {
        this.isFromPool = isFromPool;
        this.poolName = poolName;
    }

    /**
     * 从对象池重用火球时的重置方法
     */
    public onReuseFromPool(): void {    
        
        // 重新设置组件引用（关键修复）
        this.setupComponents();
        
        // 从DataManager加载默认配置
        this.loadConfigFromDataManager();
        
        // 重置所有状态
        this.resetFireballState();
        
        // 重新设置碰撞检测
        this.setupCollisionDetection();
        
        // 设置投射物物理分组
        this.updateProjectilePhysicsGroup();
        
        // 激活节点
        this.node.active = true;
        
        // 如果资源已加载完成，直接开始生成动画
        if (this.isInitialized) {
            this.startSpawnAnimation();
        }
    }

    /**
     * 回收到对象池时的清理方法
     */
    public onRecycleToPool(): void {
        console.log('FireballController: 回收火球到对象池');
        
        // 停止所有动画
        if (this.animationComponent && this.animationComponent.isValid) {
            try {
                this.animationComponent.stop();
                this.animationComponent.off(Animation.EventType.FINISHED);
            } catch (error) {
                console.warn('FireballController: 动画组件停止失败:', error);
            }
        }
        
        // 停止移动
        if (this.rigidBody) {
            this.rigidBody.linearVelocity = new Vec2(0, 0);
        }
        
        // 清理碰撞监听
        if (this.colliderComponent) {
            this.colliderComponent.off(Contact2DType.BEGIN_CONTACT, this.onCollisionEnter, this);
        }
        
        // 重置状态
        this.resetFireballState();
    }
    
    /**
     * 从DataManager加载火球配置
     */
    private loadConfigFromDataManager(): void {
        try {
            const fireballConfig = dataManager.getProjectileData('fireball');
            if (fireballConfig) {
                // 应用配置中的属性
                this.damage = fireballConfig.damage || this.damage;
                this.moveSpeed = fireballConfig.moveSpeed || this.moveSpeed;
                this.lifeTime = fireballConfig.lifeTime || this.lifeTime;
                this.frameRate = fireballConfig.frameRate || this.frameRate;
                
                console.log('FireballController: 已从DataManager加载配置', {
                    damage: this.damage,
                    moveSpeed: this.moveSpeed,
                    lifeTime: this.lifeTime,
                    frameRate: this.frameRate
                });
            }
        } catch (error) {
            console.warn('FireballController: 从DataManager加载配置失败，使用默认值', error);
        }
    }

    /**
     * 重置火球状态
     */
    private resetFireballState(): void {
        // 重置状态变量
        this.currentState = ProjectileAnimationState.SPAWN;
        this.isDestroying = false;
        this.currentLifeTime = 0;
        this.moveDirection = new Vec3(1, 0, 0);
        this.launchAngle = 0;
        
        // 重置节点状态
        this.node.setPosition(0, 0, 0);
        this.node.setRotation(0, 0, 0, 1);
        this.node.angle = 0;  // 重置角度
        this.node.setScale(1, 1, 1);
        this.node.active = false;
        
        // 精灵帧重置现在由AnimationManager处理
    }
    
    /**
     * 静态方法：从对象池创建火球
     * @param poolName 对象池名称
     * @returns 火球控制器实例
     */
    public static createFromPool(poolName: string = 'fireball'): FireballController | null {
        // 检查对象池状态
        const poolStats = poolManager.getStats(poolName) as any;
        console.log(`FireballController: 尝试从对象池 ${poolName} 获取火球，当前池状态:`, poolStats);
        
        const fireballNode = poolManager.get(poolName);
        if (!fireballNode) {
            console.error(`FireballController: 无法从对象池 ${poolName} 获取火球节点`);
            
            // 输出详细的池状态信息
            if (poolStats) {
                console.error(`对象池详情 - 大小: ${poolStats.size}, 最大: ${poolStats.maxSize}, 获取次数: ${poolStats.getCount}, 创建次数: ${poolStats.createCount}`);
            } else {
                console.error(`对象池 ${poolName} 不存在或未初始化`);
            }
            return null;
        }
        
        const fireballController = fireballNode.getComponent(FireballController);
        if (!fireballController) {
            console.error('FireballController: 火球节点缺少 FireballController 组件');
            poolManager.put(fireballNode);
            return null;
        }
        
        // 设置对象池属性
        fireballController.setPoolingProperties(true, poolName);
        
        // 调用重用回调
        fireballController.onReuseFromPool();
        
        return fireballController;
    }
    
    /**
     * 静态方法：注册火球预制体到对象池
     * @param fireballPrefab 火球预制体
     * @param poolName 对象池名称
     * @param config 对象池配置
     */
    public static registerToPool(
        fireballPrefab: any, 
        poolName: string = 'fireball',
        config: { maxSize?: number; preloadCount?: number } = {}
    ): void {
        poolManager.registerPrefab(poolName, fireballPrefab, {
            maxSize: config.maxSize || 30,
            preloadCount: config.preloadCount || 5
        });
        
        console.log(`FireballController: 已注册火球预制体到对象池 ${poolName}`);
    }
    
    protected onDestroy(): void {
        // 清理事件监听
        if (this.colliderComponent) {
            this.colliderComponent.off(Contact2DType.BEGIN_CONTACT, this.onCollisionEnter, this);
        }
        
        if (this.animationComponent) {
            this.animationComponent.off(Animation.EventType.FINISHED);
        }
        
        console.log('FireballController: 组件已销毁');
    }
} 