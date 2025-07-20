// assets/scripts/launcher/FireballLauncher.ts

import { _decorator, Component, Node, Prefab, Vec3, instantiate, input, Input, EventMouse, view, UITransform, Sprite, Animation, AnimationClip, animation, SpriteFrame, SpriteAtlas, Vec2, Collider2D, Contact2DType, IPhysics2DContact, RigidBody2D, js } from 'cc';
import { eventManager } from '../core/EventManager';
import { GameEvents } from '../core/GameEvents';
import { IProjectileController } from './ProjectileLauncher';
import { poolManager } from '../core/PoolManager';
import { FireballController } from '../game/FireballController';
import { resourceManager } from '../core/ResourceManager';
import { dataManager } from '../core/DataManager';
import { AnimationDirection } from '../animation/AnimationConfig';

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
 * 火球发射器和控制器
 * 既负责发射火球，也控制单个火球的行为
 */
@ccclass('FireballLauncher')
export class FireballLauncher extends Component implements IProjectileController {

    
    @property({ tooltip: "发射冷却时间（秒）" })
    public launchCooldown: number = 0.5;
    
    @property({ tooltip: "默认发射角度（度），0=水平向右，90=向上，-90=向下" })
    public defaultAngle: number = 0;

    // === 火球行为配置 ===
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
    
    // === 发射器状态 ===
    private lastLaunchTime: number = 0;
    private isLauncher: boolean = true; // 标识当前实例是否为发射器
    
    // === 火球控制器状态 ===
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
        // 如果这是发射器实例，不需要初始化火球功能
        if (this.isLauncher) {
            return;
        }
        
        // 火球控制器初始化
        this.setupComponents();
        this.loadResources();
    }
    
    protected start() {
        if (this.isLauncher) {
            
            console.log('FireballLauncher: 发射器初始化完成');
        } else {
            // 火球控制器初始化
            this.setupCollisionDetection();
        }
    }
    
    protected update(deltaTime: number): void {
        if (!this.isLauncher && !this.isDestroying && this.isInitialized) {
            // 火球控制器更新逻辑
            this.updateFireballLogic(deltaTime);
        }
    }
    
    /**
     * 发射火球（统一方法）
     * @param direction 发射方向（归一化向量）
     * @param customDamage 自定义伤害值（可选）
     */
    public launchFireball(direction: Vec3, customDamage?: number): void {
        if (!this.canLaunch()) {
            console.log('FireballLauncher: 冷却中，无法发射');
            return;
        }

        const fireball = this.createFireball();
        if (!fireball) {
            console.error('FireballLauncher: 创建火球失败');
            return;
        }

        // 设置火球位置为发射器位置
        fireball.node.position = this.node.position;

        // 应用自定义参数
        if (customDamage !== undefined) {
            fireball.damage = customDamage;
        }

        // 设置火球方向
        fireball.setMoveDirection(direction);

        // 更新最后发射时间
        this.lastLaunchTime = Date.now() / 1000;

        console.log(`FireballLauncher: 发射火球，方向 (${direction.x.toFixed(2)}, ${direction.y.toFixed(2)})，伤害 ${fireball.damage}，速度 ${fireball.moveSpeed}`);
    }

    // =================== 便利方法 ===================

    /**
     * 按角度发射火球（便利方法）
     * @param angleDegrees 发射角度（度）
     * @param customDamage 自定义伤害值（可选）
     */
    public launchFireballAtAngle(angleDegrees: number, customDamage?: number): void {
        // 将角度转换为方向向量
        const angleRadians = angleDegrees * Math.PI / 180;
        const direction = new Vec3(
            Math.cos(angleRadians),
            Math.sin(angleRadians),
            0
        );
        
        this.launchFireball(direction, customDamage);
    }

    /**
     * 向目标位置发射火球（便利方法）
     * @param targetPos 目标位置
     * @param customDamage 自定义伤害值（可选）
     */
    public launchFireballToPosition(targetPos: Vec3, customDamage?: number): void {
        // 计算方向向量
        const currentPos = this.node.position;
        const direction = new Vec3();
        Vec3.subtract(direction, targetPos, currentPos);
        direction.normalize();
        
        this.launchFireball(direction, customDamage);
    }

    /**
     * 按默认角度发射火球（便利方法）
     * @param customDamage 自定义伤害值（可选）
     */
    public launchFireballDefault(customDamage?: number): void {
        this.launchFireballAtAngle(this.defaultAngle, customDamage);
    }
    
    /**
     * 检查是否可以发射
     */
    private canLaunch(): boolean {
        // 检查冷却时间
        const currentTime = Date.now() / 1000;
        return (currentTime - this.lastLaunchTime) >= this.launchCooldown;
    }
    
    /**
     * 创建火球实例 - 完全依赖对象池
     */
    private createFireball(): FireballController | null {
        // 从对象池创建火球
        const poolFireball = FireballController.createFromPool('fireball');
        if (poolFireball) {
            console.log('FireballLauncher: 从对象池创建火球成功');
            
            // 确保火球节点的锚点
            const uiTransform = poolFireball.node.getComponent(UITransform);
            if (uiTransform) {
                uiTransform.setAnchorPoint(0.5, 0.6);
            }
            
            // 添加到场景
            this.node.parent?.addChild(poolFireball.node);
            
            // 配置火球属性（不覆盖 moveSpeed，让火球使用配置文件中的速度）
            poolFireball.damage = this.damage;
            poolFireball.lifeTime = this.lifeTime;
            poolFireball.frameRate = this.frameRate;
            poolFireball.launchAngle = this.launchAngle;
            
            return poolFireball;
        }
        
        // 对象池不可用
        console.error('FireballLauncher: 对象池不可用，无法创建火球');
        console.error('FireballLauncher: 请确保火球预制体已正确注册到对象池');
        console.error('FireballLauncher: 检查 GameManager 中的预制体挂载和 DataManager 中的技能配置');
        return null;
    }
    
    /**
     * 获取剩余冷却时间
     */
    public getRemainingCooldown(): number {
        const currentTime = Date.now() / 1000;
        const timeSinceLastLaunch = currentTime - this.lastLaunchTime;
        return Math.max(0, this.launchCooldown - timeSinceLastLaunch);
    }
    
    /**
     * 是否在冷却中
     */
    public isOnCooldown(): boolean {
        return this.getRemainingCooldown() > 0;
    }
    
    // =================== 火球控制器方法 ===================
    
    /**
     * 火球逻辑更新
     */
    private updateFireballLogic(deltaTime: number): void {
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
        
        console.log('FireballLauncher: 火球组件设置完成');
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
            console.error('FireballLauncher: 火球资源加载失败', error);
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
                console.log('FireballLauncher: 火球图集加载成功');
            } else {
                throw new Error('Failed to load fire atlas');
            }
        } catch (error) {
            console.error('FireballLauncher: 加载火球图集失败', error);
            throw error;
        }
    }
    
    /**
     * 创建所有动画剪辑
     */
    private createAnimationClips(): void {
        if (!this.spriteAtlas) {
            console.error('FireballLauncher: 图集未加载，无法创建动画剪辑');
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
        
        console.log('FireballLauncher: 动画剪辑创建完成');
    }
    
    /**
     * 创建单个动画剪辑
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
                console.warn(`FireballLauncher: 未找到帧 ${frameName}`);
            }
        }
        
        if (spriteFrames.length === 0) {
            console.error(`FireballLauncher: 动画 ${name} 没有有效帧`);
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
            console.error(`FireballLauncher: 无法获取动画轨道通道 ${name}`);
            return clip;
        }
        
        // 从迭代器中获取第一个通道
        const channelIterator = channels[Symbol.iterator]();
        const channelResult = channelIterator.next();
        if (channelResult.done || !channelResult.value) {
            console.error(`FireballLauncher: 动画轨道通道为空 ${name}`);
            return clip;
        }
        
        const channel = channelResult.value;
        if (channel && channel.curve) {
            // 创建关键帧
            const keyframes: [number, SpriteFrame][] = spriteFrames.map((frame, index) => [
                index * frameDuration,
                frame
            ]);
            
            try {
                channel.curve.assignSorted(keyframes);
                clip.addTrack(track);
                console.log(`FireballLauncher: 成功创建动画 ${name}，包含 ${spriteFrames.length} 帧`);
            } catch (error) {
                console.error(`FireballLauncher: 动画 ${name} 关键帧设置失败`, error);
            }
        } else {
            console.error(`FireballLauncher: 动画轨道通道无效 ${name}`);
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
            console.log('FireballLauncher: 碰撞检测设置完成');
        } else {
            console.warn('FireballLauncher: 未找到碰撞体组件，无法检测碰撞');
        }
    }
    
    /**
     * 碰撞检测回调
     */
    private onCollisionEnter(selfCollider: Collider2D, otherCollider: Collider2D, contact: IPhysics2DContact | null): void {
        if (this.isDestroying) return;
        
        // 检查碰撞对象类型
        console.log(`FireballLauncher: 检测到碰撞，对象: ${otherCollider.node.name}`);
        
        // 【修复】直接对目标造成伤害，而不是发送事件
        this.dealDamageToTarget(otherCollider.node, this.damage);
        
        // 触发爆炸
        this.explode();
    }

    /**
     * 对目标造成伤害
     */
    private dealDamageToTarget(target: Node, damage: number): void {
        if (!target || !target.isValid) {
            console.warn(`FireballLauncher: 无效的攻击目标`);
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
                console.warn(`FireballLauncher: 目标 ${target.name} 没有可攻击的组件`);
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
        
        console.log('FireballLauncher: 开始播放生成动画');
    }
    
    /**
     * 生成动画结束回调
     */
    private onSpawnAnimationFinished(): void {
        console.log('FireballLauncher: 生成动画结束，开始飞行动画');
        
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
        
        console.log('FireballLauncher: 开始播放飞行动画');
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
        
        console.log('FireballLauncher: 开始爆炸');
    }
    
    /**
     * 爆炸动画结束回调
     */
    private onExplodeAnimationFinished(): void {
        console.log('FireballLauncher: 爆炸动画结束，销毁火球');
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
    
    // =================== IProjectileController 接口实现 ===================
    
    /**
     * 设置火球移动方向
     */
    public setMoveDirection(direction: Vec3): void {
        this.moveDirection = direction.clone();
        this.moveDirection.normalize();
        
        // 如果这是火球控制器实例，根据移动方向自动计算并设置视觉角度
        if (!this.isLauncher) {
            this.updateVisualAngleFromDirection();
        }
    }
    
    /**
     * 根据移动方向更新视觉角度（仅用于火球控制器）
     */
    private updateVisualAngleFromDirection(): void {
        if (this.moveDirection.length() > 0) {
            // 计算角度（弧度转度），不翻转Y轴，直接使用世界坐标
            const angleRadians = Math.atan2(this.moveDirection.y, this.moveDirection.x);
            const angleDegrees = angleRadians * 180 / Math.PI;
            
            // 更新角度属性
            this.launchAngle = angleDegrees;
            
            // 设置节点的视觉旋转角度
            this.node.angle = angleDegrees;
            
            // 强制让运动方向与动画方向保持一致：从视觉角度重新计算运动方向
            this.alignMovementWithVisualDirection(angleDegrees);
            
            console.log(`FireballLauncher: 根据移动方向更新视觉角度 ${angleDegrees.toFixed(1)}°，运动方向已同步`);
        }
    }

    /**
     * 让运动方向与视觉动画方向保持一致（仅用于火球控制器）
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
        
        console.log(`FireballLauncher: 运动方向已对齐至视觉方向 (${correctedDirection.x.toFixed(3)}, ${correctedDirection.y.toFixed(3)})`);
    }
    
    /**
     * 设置火球发射角度
     */
    public setAngle(angleDegrees: number): void {
        this.launchAngle = angleDegrees;
        
        // 将角度转换为弧度
        const angleRadians = angleDegrees * Math.PI / 180;
        
        // 计算方向向量
        const direction = new Vec3(
            Math.cos(angleRadians),
            Math.sin(angleRadians),
            0
        );
        
        this.setMoveDirection(direction);
        
        // 如果这是火球控制器实例（而非发射器），设置节点的视觉旋转角度
        if (!this.isLauncher) {
            this.node.angle = angleDegrees;
        }
        
        console.log(`FireballLauncher: 设置发射角度 ${angleDegrees}°, 方向 (${direction.x.toFixed(3)}, ${direction.y.toFixed(3)})${!this.isLauncher ? '，节点旋转 ' + angleDegrees + '°' : ''}`);
    }
    
    /**
     * 设置火球目标位置
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
        // 清理火球事件监听
        if (this.colliderComponent) {
            this.colliderComponent.off(Contact2DType.BEGIN_CONTACT, this.onCollisionEnter, this);
        }
        
        if (this.animationComponent) {
            this.animationComponent.off(Animation.EventType.FINISHED);
        }
        
        console.log('FireballLauncher: 火球控制器组件已销毁');
    }

    /**
     * 带位置偏移的方向发射火球
     * @param direction 发射方向
     * @param angleDegrees 发射角度（用于确定朝向）
     * @param customDamage 自定义伤害值（可选）
     */
    private launchFireballWithDirectionOffset(direction: Vec3, angleDegrees: number, customDamage?: number): void {
        // 计算带偏移的发射位置
        const adjustedPosition = this.calculateLaunchPositionByAngle(angleDegrees);
        
        // 临时保存发射器原始位置
        const originalPosition = this.node.position.clone();
        
        // 设置发射器到目标位置
        this.node.position = adjustedPosition;
        
        // 发射火球
        this.launchFireball(direction, customDamage);
        
        // 恢复发射器原始位置
        this.node.position = originalPosition;
    }

    /**
     * 根据发射角度计算发射位置
     * @param angleDegrees 发射角度
     * @returns 计算后的发射位置
     */
    private calculateLaunchPositionByAngle(angleDegrees: number): Vec3 {
        // 根据角度确定朝向
        const direction = this.getDirectionFromAngle(angleDegrees);
        
        // 获取projectileOffsets配置
        const projectileOffsets = this.getProjectileOffsets();
        
        if (!projectileOffsets) {
            return this.node.position.clone();
        }
        
        // 根据朝向获取偏移量
        const offset = projectileOffsets[direction];
        if (!offset) {
            return this.node.position.clone();
        }
        
        // 计算最终位置
        const launcherPos = this.node.position;
        const adjustedPosition = new Vec3(
            launcherPos.x + offset.x,
            launcherPos.y + offset.y,
            launcherPos.z
        );
        
        console.log(`FireballLauncher: 角度 ${angleDegrees.toFixed(1)}° → 朝向 ${direction} → 偏移 (${offset.x}, ${offset.y})`);
        return adjustedPosition;
    }

    /**
     * 根据角度确定朝向
     * @param angleDegrees 角度（度）
     * @returns 朝向枚举值
     */
    private getDirectionFromAngle(angleDegrees: number): AnimationDirection {
        // 将角度规范化到 [0, 360) 范围
        let normalizedAngle = angleDegrees % 360;
        if (normalizedAngle < 0) {
            normalizedAngle += 360;
        }
        
        // 根据角度范围确定朝向
        // 0° = 右，90° = 上，180° = 左，270° = 下
        if (normalizedAngle >= 315 || normalizedAngle < 45) {
            return AnimationDirection.RIGHT;
        } else if (normalizedAngle >= 45 && normalizedAngle < 135) {
            return AnimationDirection.BACK;   // 向上
        } else if (normalizedAngle >= 135 && normalizedAngle < 225) {
            return AnimationDirection.LEFT;
        } else {
            return AnimationDirection.FRONT;  // 向下
        }
    }

    /**
     * 获取projectileOffsets配置
     * @returns projectileOffsets配置或null
     */
    private getProjectileOffsets(): any {
        try {
            // 从DataManager获取巫妖精英的数据（默认使用这个配置）
            const enemyData = dataManager.getEnemyData('lich_elite');
            if (enemyData && enemyData.projectileOffsets) {
                return enemyData.projectileOffsets;
            }
            
            console.warn('FireballLauncher: 未找到projectileOffsets配置，使用默认位置');
            return null;
        } catch (error) {
            console.error('FireballLauncher: 获取projectileOffsets配置失败', error);
            return null;
        }
    }
} 