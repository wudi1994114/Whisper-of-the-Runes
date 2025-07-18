/**
 * 通用投射物发射器
 * 只负责发射逻辑，预制体由使用者管理
 */

import { _decorator, Component, Node, Vec3, instantiate, input, Input, EventMouse, view, UITransform, Prefab, Enum } from 'cc';
import { resourceManager } from '../core/ResourceManager';
import { poolManager } from '../core/PoolManager';

const { ccclass, property } = _decorator;

/**
 * 投射物接口
 * 所有投射物控制器都应该实现这个接口
 */
export interface IProjectileController {
    /**
     * 节点引用（Component的node属性）
     */
    node: Node;
    
    /**
     * 设置投射物发射角度
     */
    setAngle(angleDegrees: number): void;
    
    /**
     * 设置投射物移动方向
     */
    setMoveDirection(direction: Vec3): void;
    
    /**
     * 设置投射物目标位置
     */
    setTarget(targetPos: Vec3): void;
    
    /**
     * 手动触发爆炸/销毁
     */
    explode?(): void;
}

/**
 * 发射配置接口
 */
export interface LaunchConfig {
    /** 投射物类型 */
    projectileType?: ProjectileType;
    /** 发射位置偏移 */
    positionOffset?: Vec3;
    /** 发射角度 */
    angle?: number;
    /** 发射方向 */
    direction?: Vec3;
    /** 目标位置 */
    targetPosition?: Vec3;
    /** 额外参数 */
    extraData?: any;
}

/**
 * 投射物类型枚举
 */
export enum ProjectileType {
    FIREBALL = 'fireball',
    THUNDER = 'thunder',
    ICEBALL = 'iceball',
    ARROW = 'arrow'
}

@ccclass('ProjectileLauncher')
export class ProjectileLauncher extends Component {
    
    @property({ type: Prefab, tooltip: "火球预制体" })
    public fireballPrefab: Prefab | null = null;
    
    @property({ type: Prefab, tooltip: "雷球预制体" })
    public thunderPrefab: Prefab | null = null;
    
    @property({ type: Prefab, tooltip: "冰球预制体" })
    public iceballPrefab: Prefab | null = null;
    
    @property({ type: Prefab, tooltip: "箭矢预制体" })
    public arrowPrefab: Prefab | null = null;
    
    @property({ tooltip: "发射冷却时间（秒）" })
    public launchCooldown: number = 0.5;
    
    @property({ tooltip: "是否启用鼠标点击发射" })
    public enableMouseLaunch: boolean = false;
    
    @property({ tooltip: "默认发射角度（度），0=水平向右，90=向上，-90=向下" })
    public defaultAngle: number = 0;
    
    @property({ 
        type: Enum(ProjectileType),
        tooltip: "默认投射物类型" 
    })
    public defaultProjectileType: ProjectileType = ProjectileType.FIREBALL;
    
    // 发射相关
    private lastLaunchTime: number = 0;
    
    // 鼠标发射回调
    private mouselaunchCallback: ((config: LaunchConfig) => void) | null = null;
    
    protected start() {
        // 注册鼠标点击事件
        if (this.enableMouseLaunch) {
            input.on(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
        }
        
        // 注册所有挂载的预制体到对象池
        this.registerAllPrefabsToPool();
        
        console.log('ProjectileLauncher: 通用投射物发射器初始化完成');
    }
    
    protected onDestroy() {
        // 清理鼠标事件
        input.off(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
        console.log('ProjectileLauncher: 组件已销毁');
    }
    
    /**
     * 设置鼠标发射回调
     */
    public setMouseLaunchCallback(callback: (config: LaunchConfig) => void): void {
        this.mouselaunchCallback = callback;
    }
    
    /**
     * 鼠标点击事件处理
     */
    private onMouseDown = (event: EventMouse): void => {
        if (!this.mouselaunchCallback) {
            console.warn('ProjectileLauncher: 鼠标发射回调未设置');
            return;
        }
        
        // 获取鼠标在屏幕上的位置
        const mouseX = event.getLocationX();
        const mouseY = event.getLocationY();
        
        // 获取屏幕尺寸
        const visibleSize = view.getVisibleSize();
        
        // 将屏幕坐标转换为相对于屏幕中心的坐标
        const centerX = visibleSize.width / 2;
        const centerY = visibleSize.height / 2;
        
        // 计算相对于中心的偏移量
        const offsetX = mouseX - centerX;
        const offsetY = centerY - mouseY; // Y轴需要翻转
        
        // 创建方向向量并归一化
        const direction = new Vec3(offsetX, offsetY, 0);
        direction.normalize();
        
        // 计算角度
        const angle = Math.atan2(offsetY, offsetX) * 180 / Math.PI;
        
        console.log(`ProjectileLauncher: 鼠标发射，角度 ${angle.toFixed(2)}°`);
        
        // 调用发射回调
        this.mouselaunchCallback({
            projectileType: this.defaultProjectileType,
            direction: direction,
            angle: angle
        });
    }
    
    /**
     * 按指定角度发射投射物（通用方法）
     * @param projectileType 投射物类型
     * @param angleDegrees 发射角度
     * @param config 额外配置
     */
    public launchProjectileAtAngle<T extends IProjectileController>(
        projectileType: ProjectileType, 
        angleDegrees: number, 
        config: LaunchConfig = {}
    ): T | null {
        if (!this.canLaunch()) {
            console.log('ProjectileLauncher: 冷却中，无法发射');
            return null;
        }
        
        const projectileController = this.createProjectile<T>(projectileType);
        if (!projectileController) {
            console.error('ProjectileLauncher: 创建投射物失败');
            return null;
        }
        
        // 设置投射物位置（应用偏移）
        const launchPos = this.node.position.clone();
        if (config.positionOffset) {
            launchPos.add(config.positionOffset);
        }
        projectileController.node.position = launchPos;
        
        // 设置投射物角度
        projectileController.setAngle(angleDegrees);
        
        // 更新最后发射时间
        this.lastLaunchTime = Date.now() / 1000;
        
        console.log(`ProjectileLauncher: 发射${projectileType}，角度 ${angleDegrees}°`);
        return projectileController;
    }
    
    /**
     * 根据类型获取预制体
     */
    private getProjectilePrefab(projectileType: ProjectileType): Prefab | null {
        switch (projectileType) {
            case ProjectileType.FIREBALL:
                return this.fireballPrefab;
            case ProjectileType.THUNDER:
                return this.thunderPrefab;
            case ProjectileType.ICEBALL:
                return this.iceballPrefab;
            case ProjectileType.ARROW:
                return this.arrowPrefab;
            default:
                console.error(`ProjectileLauncher: 未知的投射物类型 ${projectileType}`);
                return null;
        }
    }

    /**
     * 按方向发射投射物
     */
    public launchProjectileInDirection<T extends IProjectileController>(
        projectileType: ProjectileType, 
        direction: Vec3, 
        config: LaunchConfig = {}
    ): T | null {
        if (!this.canLaunch()) {
            console.log('ProjectileLauncher: 冷却中，无法发射');
            return null;
        }
        
        const projectileController = this.createProjectile<T>(projectileType);
        if (!projectileController) {
            console.error('ProjectileLauncher: 创建投射物失败');
            return null;
        }
        
        // 设置投射物位置
        const launchPos = this.node.position.clone();
        if (config.positionOffset) {
            launchPos.add(config.positionOffset);
        }
        projectileController.node.position = launchPos;
        
        // 设置投射物方向
        projectileController.setMoveDirection(direction);
        
        // 更新最后发射时间
        this.lastLaunchTime = Date.now() / 1000;
        
        console.log(`ProjectileLauncher: 发射${projectileType}，方向 (${direction.x.toFixed(2)}, ${direction.y.toFixed(2)})`);
        return projectileController;
    }
    
    /**
     * 向目标位置发射投射物
     */
    public launchProjectileToPosition<T extends IProjectileController>(
        projectileType: ProjectileType, 
        targetPos: Vec3, 
        config: LaunchConfig = {}
    ): T | null {
        if (!this.canLaunch()) {
            console.log('ProjectileLauncher: 冷却中，无法发射');
            return null;
        }
        
        const projectileController = this.createProjectile<T>(projectileType);
        if (!projectileController) {
            console.error('ProjectileLauncher: 创建投射物失败');
            return null;
        }
        
        // 设置投射物位置
        const launchPos = this.node.position.clone();
        if (config.positionOffset) {
            launchPos.add(config.positionOffset);
        }
        projectileController.node.position = launchPos;
        
        // 设置投射物目标
        projectileController.setTarget(targetPos);
        
        // 更新最后发射时间
        this.lastLaunchTime = Date.now() / 1000;
        
        console.log(`ProjectileLauncher: 发射${projectileType}到位置 (${targetPos.x.toFixed(2)}, ${targetPos.y.toFixed(2)})`);
        return projectileController;
    }
    
    /**
     * 按默认类型和角度发射投射物
     */
    public launchProjectile<T extends IProjectileController>(
        config: LaunchConfig = {}
    ): T | null {
        const projectileType = config.projectileType ?? this.defaultProjectileType;
        const angle = config.angle ?? this.defaultAngle;
        return this.launchProjectileAtAngle<T>(projectileType, angle, config);
    }
    
    /**
     * 检查是否可以发射
     */
    public canLaunch(): boolean {
        const currentTime = Date.now() / 1000;
        return (currentTime - this.lastLaunchTime) >= this.launchCooldown;
    }
    
    /**
     * 检查是否在冷却中
     */
    public isOnCooldown(): boolean {
        return !this.canLaunch();
    }
    
    /**
     * 注册所有挂载的预制体到对象池
     */
    private registerAllPrefabsToPool(): void {
        const prefabMappings = [
            {
                name: 'fireball',
                prefab: this.fireballPrefab,
                poolConfig: { poolName: 'fireball', maxSize: 30, preloadCount: 5 }
            },
            {
                name: 'thunder',
                prefab: this.thunderPrefab,
                poolConfig: { poolName: 'thunder', maxSize: 20, preloadCount: 3 }
            },
            {
                name: 'iceball',
                prefab: this.iceballPrefab,
                poolConfig: { poolName: 'iceball', maxSize: 25, preloadCount: 4 }
            },
            {
                name: 'arrow',
                prefab: this.arrowPrefab,
                poolConfig: { poolName: 'arrow', maxSize: 50, preloadCount: 10 }
            }
        ].filter(mapping => mapping.prefab !== null); // 只注册已挂载的预制体

        if (prefabMappings.length > 0) {
            const result = resourceManager.registerMountedPrefabsToPool(prefabMappings);
            console.log(`ProjectileLauncher: 预制体对象池注册完成 - 成功: ${result.success}, 失败: ${result.failed}`);
        } else {
            console.warn('ProjectileLauncher: 未挂载任何预制体，无法注册到对象池');
        }
    }

    /**
     * 创建投射物实例 - 支持对象池
     */
    private createProjectile<T extends IProjectileController>(projectileType: ProjectileType): T | null {
        // 首先尝试从对象池获取
        const poolName = this.getPoolNameForType(projectileType);
        if (poolName) {
            const pooledNode = poolManager.get(poolName);
            if (pooledNode) {
                console.log(`ProjectileLauncher: 从对象池 ${poolName} 获取投射物成功`);
                
                // 确保投射物节点的锚点
                const uiTransform = pooledNode.getComponent(UITransform);
                if (uiTransform) {
                    uiTransform.setAnchorPoint(0.5, 0.6);
                }
                
                // 添加到场景
                this.node.parent?.addChild(pooledNode);
                
                // 获取投射物控制器组件
                const controller = this.getControllerFromNode<T>(pooledNode);
                if (controller) {
                    return controller;
                } else {
                    // 如果无法获取控制器，回收节点
                    poolManager.put(pooledNode);
                }
            }
        }

        // 对象池不可用，使用直接实例化
        console.log(`ProjectileLauncher: 对象池 ${poolName} 不可用，使用直接实例化`);
        const projectilePrefab = this.getProjectilePrefab(projectileType);
        return this.createProjectileFromPrefab<T>(projectilePrefab);
    }

    /**
     * 根据投射物类型获取对象池名称
     */
    private getPoolNameForType(projectileType: ProjectileType): string | null {
        switch (projectileType) {
            case ProjectileType.FIREBALL:
                return 'fireball';
            case ProjectileType.THUNDER:
                return 'thunder';
            case ProjectileType.ICEBALL:
                return 'iceball';
            case ProjectileType.ARROW:
                return 'arrow';
            default:
                return null;
        }
    }

    /**
     * 从预制体创建投射物实例
     */
    private createProjectileFromPrefab<T extends IProjectileController>(projectilePrefab: any): T | null {
        if (!projectilePrefab) {
            console.error('ProjectileLauncher: 投射物预制体未提供');
            return null;
        }
        
        // 实例化投射物预制体
        const projectileNode = instantiate(projectilePrefab);
        
        // 确保投射物节点的锚点
        const uiTransform = projectileNode.getComponent(UITransform);
        if (uiTransform) {
            uiTransform.setAnchorPoint(0.5, 0.6);
        }
        
        // 添加到场景
        this.node.parent?.addChild(projectileNode);
        
        // 获取投射物控制器组件
        return this.getControllerFromNode<T>(projectileNode);
    }

    /**
     * 从节点获取控制器组件
     */
    private getControllerFromNode<T extends IProjectileController>(projectileNode: Node): T | null {
        // 获取投射物控制器组件
        const projectileController = projectileNode.getComponent('FireballLauncher') as unknown as T ||
                                   projectileNode.getComponent('ThunderController') as unknown as T ||
                                   projectileNode.getComponent('IceBallController') as unknown as T ||
                                   projectileNode.getComponent('ArrowController') as unknown as T;
        
        if (!projectileController) {
            console.error('ProjectileLauncher: 投射物预制体缺少控制器组件');
            projectileNode.destroy();
            return null;
        }
        
        return projectileController;
    }
} 