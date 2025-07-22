// assets/scripts/game/FireballController.ts

import { _decorator, Component, Node, Sprite, Animation, Collider2D, RigidBody2D, Vec3, Vec2, AnimationClip, SpriteAtlas, JsonAsset, IPhysics2DContact, resources, Prefab, js, UITransform, Contact2DType, SpriteFrame, animation } from 'cc';
import { dataManager } from '../core/DataManager';
import { Faction } from '../configs/FactionConfig';
import { GameEvents } from '../core/GameEvents';
import { eventManager } from '../core/EventManager';
import { CharacterStats } from '../components/CharacterStats';
import { poolManager } from '../core/PoolManager';
import { systemConfigManager } from '../core/SystemConfig';
import { PhysicsGroup } from '../configs/PhysicsConfig';
import { factionManager } from '../core/FactionManager';
import { resourceManager } from '../core/ResourceManager';

const { ccclass, property } = _decorator;

/**
 * 火球动画状态枚举
 */
export enum FireballState {
    SPAWN = 'spawn',        // 生成阶段
    FLYING = 'flying',      // 飞行阶段
    EXPLODING = 'exploding' // 爆炸阶段
}

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
    private spriteAtlas: SpriteAtlas | null = null;
    private currentState: FireballState = FireballState.SPAWN;
    private isInitialized: boolean = false;
    
    // 移动相关
    private moveDirection: Vec3 = new Vec3(1, 0, 0);
    private currentLifeTime: number = 0;
    private isDestroying: boolean = false;
    
    // 阵营相关
    private shooterFaction: Faction = Faction.PLAYER;  // 发射者阵营
    private shooterNode: Node | null = null;            // 发射者节点
    
    // 动画剪辑缓存
    private spawnClip: AnimationClip | null = null;
    private flyingClip: AnimationClip | null = null;
    private explodeClip: AnimationClip | null = null;
    
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
        if (this.currentLifeTime >= this.lifeTime && this.currentState !== FireballState.EXPLODING) {
            this.explode();
            return;
        }
        
        // 飞行状态下移动
        if (this.currentState === FireballState.FLYING) {
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
            uiTransform.setAnchorPoint(0.5, 0.6); // 设置锚点为(0.5, 0.6)
            console.log('FireballController: 已设置锚点为 (0.5, 0.6)');
        }
        
        // 获取碰撞体组件
        this.colliderComponent = this.getComponent(Collider2D);
        
        // 获取刚体组件
        this.rigidBody = this.getComponent(RigidBody2D);
        
        console.log('FireballController: 组件设置完成');
    }
    
    /**
     * 加载火球资源
     */
    private async loadResources(): Promise<void> {
        try {
            // 加载火球图集
            await this.loadFireAtlas();
            
            // 创建动画剪辑
            this.createAnimationClips();
            
            // 初始化完成，开始播放生成动画
            this.isInitialized = true;
            this.startSpawnAnimation();
            
        } catch (error) {
            console.error('FireballController: 资源加载失败', error);
        }
    }
    
    /**
     * 加载火球图集
     */
    private async loadFireAtlas(): Promise<void> {
        try {
            const atlas = await resourceManager.loadResource('skill/fire', SpriteAtlas);
            if (atlas) {
                this.spriteAtlas = atlas;
                console.log('FireballController: 火球图集加载成功');
            } else {
                throw new Error('Failed to load fire atlas');
            }
        } catch (error) {
            console.error('FireballController: 加载火球图集失败', error);
            throw error;
        }
    }
    
    /**
     * 创建所有动画剪辑
     */
    private createAnimationClips(): void {
        if (!this.spriteAtlas) {
            console.error('FireballController: 图集未加载，无法创建动画剪辑');
            return;
        }
        
        // 创建生成动画（第0帧，播放一次）
        this.spawnClip = this.createAnimationClip('fireball_spawn', [0], false);
        
        // 创建飞行动画（第1-3帧，循环播放）
        this.flyingClip = this.createAnimationClip('fireball_flying', [1, 2, 3], true);
        
        // 创建爆炸动画（第4-7帧，播放一次）
        this.explodeClip = this.createAnimationClip('fireball_explode', [4, 5, 6, 7], false);
        
        // 添加动画剪辑到组件
        if (this.animationComponent) {
            if (this.spawnClip) this.animationComponent.addClip(this.spawnClip);
            if (this.flyingClip) this.animationComponent.addClip(this.flyingClip);
            if (this.explodeClip) this.animationComponent.addClip(this.explodeClip);
        }
        
        console.log('FireballController: 动画剪辑创建完成');
    }
    
    /**
     * 创建单个动画剪辑
     * @param name 动画名称
     * @param frameIndices 帧索引数组
     * @param loop 是否循环
     */
    private createAnimationClip(name: string, frameIndices: number[], loop: boolean): AnimationClip {
        const clip = new AnimationClip();
        clip.name = name;
        clip.wrapMode = loop ? AnimationClip.WrapMode.Loop : AnimationClip.WrapMode.Normal;
        
        // 获取精灵帧
        const spriteFrames: SpriteFrame[] = [];
        for (const index of frameIndices) {
            const frameIndex = index < 10 ? `0${index}` : `${index}`;
            const frameName = `Fire_right${frameIndex}`;  
            const spriteFrame = this.spriteAtlas!.getSpriteFrame(frameName);
            if (spriteFrame) {
                spriteFrames.push(spriteFrame);
            } else {
                console.warn(`FireballController: 未找到帧 ${frameName}`);
            }
        }
        
        if (spriteFrames.length === 0) {
            console.error(`FireballController: 动画 ${name} 没有有效帧`);
            return clip;
        }
        
        // 计算动画时长
        const frameDuration = 1 / this.frameRate;
        clip.duration = spriteFrames.length * frameDuration;
        
        // 创建轨道
        const track = new animation.ObjectTrack();
        track.path = new animation.TrackPath()
            .toComponent(js.getClassName(Sprite))
            .toProperty('spriteFrame');
        
        // 安全获取通道
        const channels = track.channels();
        if (!channels) {
            console.error(`FireballController: 无法获取动画轨道通道 ${name}`);
            return clip;
        }
        
        // 从迭代器中获取第一个通道
        const channelIterator = channels[Symbol.iterator]();
        const channelResult = channelIterator.next();
        if (channelResult.done || !channelResult.value) {
            console.error(`FireballController: 动画轨道通道为空 ${name}`);
            return clip;
        }
        
        const channel = channelResult.value;
        if (channel && channel.curve) {
            // 创建关键帧
            const keyframes: [number, SpriteFrame][] = spriteFrames.map((frame, index) => [
                index * frameDuration,
                frame // 直接使用 spriteFrame 对象
            ]);
            
            try {
                channel.curve.assignSorted(keyframes);
                clip.addTrack(track);
                console.log(`FireballController: 成功创建动画 ${name}，包含 ${spriteFrames.length} 帧`);
            } catch (error) {
                console.error(`FireballController: 动画 ${name} 关键帧设置失败`, error);
            }
        } else {
            console.error(`FireballController: 动画轨道通道无效 ${name}`);
        }
        
        return clip;
    }
    
    /**
     * 设置碰撞检测
     */
    private setupCollisionDetection(): void {
        if (this.colliderComponent) {
            // 监听碰撞开始事件
            this.colliderComponent.on(Contact2DType.BEGIN_CONTACT, this.onCollisionEnter, this);
            console.log('FireballController: 碰撞检测设置完成');
        } else {
            console.warn('FireballController: 未找到碰撞体组件，无法检测碰撞');
        }
    }
    
    /**
     * 碰撞检测回调
     */
    private onCollisionEnter(selfCollider: Collider2D, otherCollider: Collider2D, contact: IPhysics2DContact | null): void {
        if (this.isDestroying) return;
        
        // 检查碰撞对象类型
        console.log(`FireballController: 检测到碰撞，对象: ${otherCollider.node.name}`);
        
        // 获取目标的阵营信息
        const targetCharacterStats = otherCollider.node.getComponent('CharacterStats');
        if (targetCharacterStats) {
            const targetFaction = (targetCharacterStats as any).faction;
            
            // 检查阵营关系 - 只有敌对阵营才造成伤害
            if (factionManager.doesAttack(this.shooterFaction, targetFaction)) {
                console.log(`FireballController: ${this.shooterFaction} 阵营的火球攻击 ${targetFaction} 阵营的目标 ${otherCollider.node.name}`);
                this.dealDamageToTarget(otherCollider.node, this.damage);
            } else {
                console.log(`FireballController: ${this.shooterFaction} 阵营的火球不会攻击 ${targetFaction} 阵营的目标 ${otherCollider.node.name}`);
            }
        } else {
            // 如果没有CharacterStats组件，可能是墙壁等障碍物，直接爆炸
            console.log(`FireballController: 撞击障碍物 ${otherCollider.node.name}`);
        }
        
        // 触发爆炸
        this.explode();
    }

    /**
     * 对目标造成伤害
     */
    private dealDamageToTarget(target: Node, damage: number): void {
        if (!target || !target.isValid) {
            console.warn(`FireballController: 无效的攻击目标`);
            return;
        }

        // 获取目标的BaseCharacterDemo组件来造成伤害
        const targetCharacterDemo = target.getComponent('BaseCharacterDemo');
        if (targetCharacterDemo && (targetCharacterDemo as any).takeDamage) {
            (targetCharacterDemo as any).takeDamage(damage);
            console.log(`%c[FIREBALL] 火球对 ${target.name} 造成 ${damage} 点伤害`, 'color: orange; font-weight: bold');
        } else {
            // 如果没有BaseCharacterDemo，尝试CharacterStats组件
            const targetStats = target.getComponent('CharacterStats');
            if (targetStats && (targetStats as any).takeDamage) {
                (targetStats as any).takeDamage(damage);
                console.log(`%c[FIREBALL] 火球对 ${target.name} 造成 ${damage} 点伤害 (直接命中CharacterStats)`, 'color: orange; font-weight: bold');
            } else {
                console.warn(`FireballController: 目标 ${target.name} 没有可攻击的组件`);
            }
        }
    }
    
    /**
     * 开始生成动画
     */
    private startSpawnAnimation(): void {
        if (!this.animationComponent || !this.spawnClip) return;
        
        this.currentState = FireballState.SPAWN;
        this.animationComponent.play('fireball_spawn');
        
        // 监听生成动画结束
        this.animationComponent.once(Animation.EventType.FINISHED, this.onSpawnAnimationFinished, this);
        
        console.log('FireballController: 开始播放生成动画');
    }
    
    /**
     * 生成动画结束回调
     */
    private onSpawnAnimationFinished(): void {
        console.log('FireballController: 生成动画结束，开始飞行动画');
        
        // 如果移动方向为默认值，使用设置的角度
        if (this.moveDirection.equals(new Vec3(1, 0, 0))) {
            this.setAngle(this.launchAngle);
        }
        
        this.startFlyingAnimation();
    }
    
    /**
     * 开始飞行动画
     */
    private startFlyingAnimation(): void {
        if (!this.animationComponent || !this.flyingClip) return;
        
        this.currentState = FireballState.FLYING;
        this.animationComponent.play('fireball_flying');
        
        console.log('FireballController: 开始播放飞行动画');
    }
    
    /**
     * 触发爆炸
     */
    public explode(): void {
        if (this.isDestroying || this.currentState === FireballState.EXPLODING) return;
        
        this.currentState = FireballState.EXPLODING;
        this.isDestroying = true;
        
        // 停止移动
        if (this.rigidBody) {
            this.rigidBody.linearVelocity = new Vec2(0, 0);
        }
        
        // 播放爆炸动画
        if (this.animationComponent && this.explodeClip) {
            this.animationComponent.play('fireball_explode');
            
            // 监听爆炸动画结束
            this.animationComponent.once(Animation.EventType.FINISHED, this.onExplodeAnimationFinished, this);
        } else {
            // 如果没有爆炸动画，直接销毁
            this.destroyFireball();
        }
        
        console.log('FireballController: 开始爆炸');
    }
    
    /**
     * 爆炸动画结束回调
     */
    private onExplodeAnimationFinished(): void {
        console.log('FireballController: 爆炸动画结束，销毁火球');
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
            
            console.log(`FireballController: 根据移动方向更新视觉角度 ${angleDegrees.toFixed(1)}°，运动方向已同步`);
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
        
        console.log(`FireballController: 运动方向已对齐至视觉方向 (${correctedDirection.x.toFixed(3)}, ${correctedDirection.y.toFixed(3)})`);
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
        
        console.log(`FireballController: 设置发射角度 ${angleDegrees}°, 方向 (${direction.x.toFixed(3)}, ${direction.y.toFixed(3)})，节点旋转 ${angleDegrees}°`);
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
        console.log('FireballController: 从对象池重用火球');
        
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
        if (this.animationComponent) {
            this.animationComponent.stop();
            this.animationComponent.off(Animation.EventType.FINISHED);
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
        this.currentState = FireballState.SPAWN;
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
        
        // 重置精灵帧
        if (this.spriteComponent && this.spriteAtlas) {
            const firstFrame = this.spriteAtlas.getSpriteFrame('Fire_right00');
            if (firstFrame) {
                this.spriteComponent.spriteFrame = firstFrame;
            }
        }
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