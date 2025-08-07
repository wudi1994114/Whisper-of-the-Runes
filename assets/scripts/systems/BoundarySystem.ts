// assets/scripts/systems/BoundarySystem.ts

import { _decorator, Component, Node, Vec3, RigidBody2D, Collider2D, BoxCollider2D, PhysicsSystem2D, view, Camera, director, Sprite, UITransform, Color } from 'cc';
import { PhysicsGroup } from '../configs/PhysicsConfig';

const { ccclass, property } = _decorator;

/**
 * 边界系统 - 管理战场边界，防止单位超出范围
 */
@ccclass('BoundarySystem')
export class BoundarySystem extends Component {

    @property({
        displayName: "使用摄像机边界",
        tooltip: "是否基于摄像机可视区域自动设置边界"
    })
    public useCameraBounds: boolean = true;

    @property({
        displayName: "战场宽度",
        tooltip: "手动设置的战场宽度（当不使用摄像机边界时）"
    })
    public worldWidth: number = 1920;

    @property({
        displayName: "战场高度",
        tooltip: "手动设置的战场高度（当不使用摄像机边界时）"
    })
    public worldHeight: number = 1080;

    @property({
        displayName: "边界厚度",
        tooltip: "边界墙的厚度"
    })
    public boundaryThickness: number = 50;

    @property({
        displayName: "显示边界",
        tooltip: "是否显示边界墙（调试用）"
    })
    public showBoundaries: boolean = true;

    // 边界节点
    private boundaryNodes: Node[] = [];

    protected onLoad(): void {
        console.log('[BoundarySystem] 初始化边界系统...');

        // 注册到单例管理器
        BoundaryManager.setInstance(this);

        // 获取实际的边界尺寸
        this.updateBoundaryDimensions();

        this.createBoundaryWalls();
    }

    protected onDestroy(): void {
        this.destroyBoundaryWalls();
    }

    /**
     * 创建边界墙
     */
    private createBoundaryWalls(): void {
        // 清理现有边界
        this.destroyBoundaryWalls();

        const halfWidth = this.worldWidth / 2;
        const halfHeight = this.worldHeight / 2;
        const halfThickness = this.boundaryThickness / 2;

        console.log(`[BoundarySystem] 创建边界墙 - 世界尺寸: ${this.worldWidth}x${this.worldHeight}, 边界厚度: ${this.boundaryThickness}`);
        console.log(`[BoundarySystem] 边界范围: 左右±${halfWidth}, 上下±${halfHeight}`);

        // 创建四面边界墙
        const boundaries = [
            // 左边界
            {
                name: 'LeftBoundary',
                position: new Vec3(-halfWidth - halfThickness, 0, 0),
                size: { width: this.boundaryThickness, height: this.worldHeight + this.boundaryThickness * 2 }
            },
            // 右边界
            {
                name: 'RightBoundary',
                position: new Vec3(halfWidth + halfThickness, 0, 0),
                size: { width: this.boundaryThickness, height: this.worldHeight + this.boundaryThickness * 2 }
            },
            // 上边界
            {
                name: 'TopBoundary',
                position: new Vec3(0, halfHeight + halfThickness, 0),
                size: { width: this.worldWidth + this.boundaryThickness * 2, height: this.boundaryThickness }
            },
            // 下边界
            {
                name: 'BottomBoundary',
                position: new Vec3(0, -halfHeight - halfThickness, 0),
                size: { width: this.worldWidth + this.boundaryThickness * 2, height: this.boundaryThickness }
            }
        ];

        boundaries.forEach(boundary => {
            const boundaryNode = this.createBoundaryWall(boundary.name, boundary.position, boundary.size);
            this.boundaryNodes.push(boundaryNode);
        });

        console.log(`[BoundarySystem] 创建了${this.boundaryNodes.length}个边界墙，位置基于Canvas坐标系`);
    }

    /**
     * 创建单个边界墙
     */
    private createBoundaryWall(name: string, position: Vec3, size: { width: number, height: number }): Node {
        const boundaryNode = new Node(name);
        boundaryNode.setParent(this.node);

        // 设置位置（在Canvas坐标系中）
        boundaryNode.setPosition(position);

        console.log(`[BoundarySystem] 创建边界墙节点: ${name}, 世界位置: (${position.x}, ${position.y}), 大小: ${size.width}x${size.height}, 父节点: ${this.node.name}`);

        // 添加刚体组件（静态）
        const rigidBody = boundaryNode.addComponent(RigidBody2D);

        // 设置为静态刚体 (Static = 0, Kinematic = 1, Dynamic = 2)
        rigidBody.type = 0;
        rigidBody.enabledContactListener = true;
        rigidBody.gravityScale = 0;
        rigidBody.allowSleep = false;

        // 添加碰撞体
        const collider = boundaryNode.addComponent(BoxCollider2D);
        collider.size.set(size.width, size.height);
        collider.sensor = false; // 实体碰撞

        // 设置物理分组（边界墙）
        rigidBody.group = PhysicsGroup.WORLD_OBSTACLE;

        // 如果启用边界显示，添加可视化
        if (this.showBoundaries) {
            this.addBoundaryVisualization(boundaryNode, size);
        }

        console.log(`[BoundarySystem] 创建边界墙: ${name}, 位置: (${position.x}, ${position.y}), 大小: ${size.width}x${size.height}`);

        return boundaryNode;
    }

    /**
     * 销毁所有边界墙
     */
    private destroyBoundaryWalls(): void {
        this.boundaryNodes.forEach(node => {
            if (node && node.isValid) {
                node.destroy();
            }
        });
        this.boundaryNodes = [];
    }

    /**
     * 检查位置是否在边界内
     */
    public isPositionInBounds(position: Vec3): boolean {
        const halfWidth = this.worldWidth / 2;
        const halfHeight = this.worldHeight / 2;

        return position.x >= -halfWidth &&
            position.x <= halfWidth &&
            position.y >= -halfHeight &&
            position.y <= halfHeight;
    }

    /**
     * 将位置限制在边界内
     */
    public clampPositionToBounds(position: Vec3): Vec3 {
        const halfWidth = this.worldWidth / 2;
        const halfHeight = this.worldHeight / 2;

        const clampedPosition = position.clone();
        clampedPosition.x = Math.max(-halfWidth, Math.min(halfWidth, position.x));
        clampedPosition.y = Math.max(-halfHeight, Math.min(halfHeight, position.y));

        return clampedPosition;
    }

    /**
     * 获取边界信息
     */
    public getBoundaryInfo(): { width: number, height: number, left: number, right: number, top: number, bottom: number } {
        const halfWidth = this.worldWidth / 2;
        const halfHeight = this.worldHeight / 2;

        return {
            width: this.worldWidth,
            height: this.worldHeight,
            left: -halfWidth,
            right: halfWidth,
            top: halfHeight,
            bottom: -halfHeight
        };
    }

    /**
     * 更新边界尺寸（基于Canvas和摄像机）
     */
    private updateBoundaryDimensions(): void {
        if (this.useCameraBounds) {
            // 获取Canvas节点
            const canvas = director.getScene()?.getChildByName('Canvas');
            const camera = director.getScene()?.getComponentInChildren(Camera);

            if (canvas && camera) {
                // 获取Canvas的UITransform
                const canvasTransform = canvas.getComponent(UITransform);
                if (canvasTransform) {
                    // 使用Canvas的实际尺寸
                    this.worldWidth = canvasTransform.width;
                    this.worldHeight = canvasTransform.height;

                    console.log(`[BoundarySystem] 基于Canvas设置边界: ${this.worldWidth}x${this.worldHeight}`);
                    console.log(`[BoundarySystem] Canvas节点: ${canvas.name}, 摄像机orthoHeight: ${camera.orthoHeight}`);
                } else {
                    // 回退到摄像机计算
                    const visibleSize = view.getVisibleSize();
                    const orthoHeight = camera.orthoHeight * 2;
                    const orthoWidth = orthoHeight * (visibleSize.width / visibleSize.height);

                    this.worldWidth = orthoWidth;
                    this.worldHeight = orthoHeight;

                    console.log(`[BoundarySystem] Canvas UITransform未找到，使用摄像机计算: ${orthoWidth.toFixed(1)}x${orthoHeight.toFixed(1)}`);
                }
            } else {
                // 如果没有找到Canvas或摄像机，使用屏幕尺寸
                const visibleSize = view.getVisibleSize();
                this.worldWidth = visibleSize.width;
                this.worldHeight = visibleSize.height;

                console.log(`[BoundarySystem] Canvas或摄像机未找到，使用屏幕尺寸: ${visibleSize.width}x${visibleSize.height}`);
            }
        } else {
            console.log(`[BoundarySystem] 使用手动设置的边界: ${this.worldWidth}x${this.worldHeight}`);
        }
    }

    /**
     * 更新边界设置
     */
    public updateBoundarySettings(width: number, height: number): void {
        this.worldWidth = width;
        this.worldHeight = height;
        this.useCameraBounds = false; // 手动设置时禁用摄像机边界
        this.createBoundaryWalls();
        console.log(`[BoundarySystem] 边界设置已更新: ${width}x${height}`);
    }

    /**
     * 刷新边界（重新计算摄像机边界）
     */
    public refreshBoundaries(): void {
        this.updateBoundaryDimensions();
        this.createBoundaryWalls();
    }

    /**
     * 为边界墙添加可视化
     */
    private addBoundaryVisualization(boundaryNode: Node, size: { width: number, height: number }): void {
        // 添加UITransform组件
        const uiTransform = boundaryNode.addComponent(UITransform);
        uiTransform.setContentSize(size.width, size.height);

        // 添加Sprite组件用于显示
        const sprite = boundaryNode.addComponent(Sprite);
        sprite.color = new Color(255, 0, 0, 100); // 半透明红色

        console.log(`[BoundarySystem] 添加边界可视化: ${boundaryNode.name}`);
    }
}

/**
 * 边界系统单例管理器
 */
class BoundaryManager {
    private static instance: BoundarySystem | null = null;

    public static setInstance(boundarySystem: BoundarySystem): void {
        this.instance = boundarySystem;
    }

    public static getInstance(): BoundarySystem | null {
        return this.instance;
    }

    public static isPositionInBounds(position: Vec3): boolean {
        return this.instance ? this.instance.isPositionInBounds(position) : true;
    }

    public static clampPositionToBounds(position: Vec3): Vec3 {
        return this.instance ? this.instance.clampPositionToBounds(position) : position;
    }
}

export { BoundaryManager };