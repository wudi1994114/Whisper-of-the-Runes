// assets/scripts/game/FireballController.ts

import { _decorator, Component, Node, Sprite, Animation, AnimationClip, animation, SpriteFrame, SpriteAtlas, resources, Vec3, Vec2, Collider2D, Contact2DType, IPhysics2DContact, RigidBody2D, js, assetManager } from 'cc';
import { eventManager } from '../core/EventManager';
import { GameEvents } from '../core/GameEvents';

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
    
    // 动画剪辑缓存
    private spawnClip: AnimationClip | null = null;
    private flyingClip: AnimationClip | null = null;
    private explodeClip: AnimationClip | null = null;
    
    protected onLoad() {
        this.setupComponents();
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
    private loadFireAtlas(): Promise<void> {
        return new Promise((resolve, reject) => {
            // 获取 resources bundle，然后加载资源
            const bundle = assetManager.getBundle('resources');
            if (bundle) {
                // 直接从已加载的 resources bundle 中加载
                bundle.load('skill/fire', SpriteAtlas, (err, atlas) => {
                    if (err) {
                        console.error('FireballController: 加载火球图集失败', err);
                        reject(err);
                        return;
                    }
                    
                    this.spriteAtlas = atlas;
                    console.log('FireballController: 火球图集加载成功');
                    resolve();
                });
            } else {
                // 如果 resources bundle 未加载，先加载 bundle
                assetManager.loadBundle('resources', (err, bundle) => {
                    if (err) {
                        console.error('FireballController: 加载 resources bundle 失败', err);
                        reject(err);
                        return;
                    }
                    
                    bundle.load('skill/fire', SpriteAtlas, (err, atlas) => {
                        if (err) {
                            console.error('FireballController: 加载火球图集失败', err);
                            reject(err);
                            return;
                        }
                        
                        this.spriteAtlas = atlas;
                        console.log('FireballController: 火球图集加载成功');
                        resolve();
                    });
                });
            }
        });
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
        
        // 检查碰撞对象类型（可以根据需要添加标签过滤）
        console.log(`FireballController: 检测到碰撞，对象: ${otherCollider.node.name}`);
        
        // 触发爆炸
        this.explode();
        
        // 发送碰撞事件（可用于造成伤害等）
        eventManager.emit(GameEvents.CHARACTER_DAMAGED, otherCollider.node, this.damage);
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
     * 销毁火球
     */
    private destroyFireball(): void {
        // 发送火球销毁事件
        eventManager.emit('FIREBALL_DESTROYED', this.node);
        
        // 销毁节点
        this.node.destroy();
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
        
        console.log(`FireballController: 设置发射角度 ${angleDegrees}°, 方向 (${direction.x.toFixed(3)}, ${direction.y.toFixed(3)})`);
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