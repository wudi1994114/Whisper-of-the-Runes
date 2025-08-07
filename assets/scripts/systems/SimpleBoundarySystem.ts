// assets/scripts/systems/SimpleBoundarySystem.ts

import { _decorator, Component, Vec3 } from 'cc';

const { ccclass, property } = _decorator;

/**
 * 简单边界系统 - 纯软限制，不使用物理组件
 */
@ccclass('SimpleBoundarySystem')
export class SimpleBoundarySystem extends Component {
    
    @property({
        displayName: "战场宽度",
        tooltip: "战场的总宽度"
    })
    public worldWidth: number = 1920;
    
    @property({
        displayName: "战场高度", 
        tooltip: "战场的总高度"
    })
    public worldHeight: number = 1080;
    
    @property({
        displayName: "边界缓冲区",
        tooltip: "边界的缓冲区大小"
    })
    public boundaryBuffer: number = 10;
    
    protected onLoad(): void {
        console.log('[SimpleBoundarySystem] 初始化简单边界系统...');
        
        // 注册到单例管理器
        SimpleBoundaryManager.setInstance(this);
        
        console.log(`[SimpleBoundarySystem] 边界设置: ${this.worldWidth}x${this.worldHeight}, 缓冲区: ${this.boundaryBuffer}`);
    }
    
    /**
     * 检查位置是否在边界内
     */
    public isPositionInBounds(position: Vec3): boolean {
        const halfWidth = this.worldWidth / 2 - this.boundaryBuffer;
        const halfHeight = this.worldHeight / 2 - this.boundaryBuffer;
        
        return position.x >= -halfWidth && 
               position.x <= halfWidth && 
               position.y >= -halfHeight && 
               position.y <= halfHeight;
    }
    
    /**
     * 将位置限制在边界内
     */
    public clampPositionToBounds(position: Vec3): Vec3 {
        const halfWidth = this.worldWidth / 2 - this.boundaryBuffer;
        const halfHeight = this.worldHeight / 2 - this.boundaryBuffer;
        
        const clampedPosition = position.clone();
        clampedPosition.x = Math.max(-halfWidth, Math.min(halfWidth, position.x));
        clampedPosition.y = Math.max(-halfHeight, Math.min(halfHeight, position.y));
        
        return clampedPosition;
    }
    
    /**
     * 获取边界信息
     */
    public getBoundaryInfo(): { width: number, height: number, left: number, right: number, top: number, bottom: number } {
        const halfWidth = this.worldWidth / 2 - this.boundaryBuffer;
        const halfHeight = this.worldHeight / 2 - this.boundaryBuffer;
        
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
     * 更新边界设置
     */
    public updateBoundarySettings(width: number, height: number): void {
        this.worldWidth = width;
        this.worldHeight = height;
        console.log(`[SimpleBoundarySystem] 边界设置已更新: ${width}x${height}`);
    }
}

/**
 * 简单边界系统单例管理器
 */
class SimpleBoundaryManager {
    private static instance: SimpleBoundarySystem | null = null;
    
    public static setInstance(boundarySystem: SimpleBoundarySystem): void {
        this.instance = boundarySystem;
    }
    
    public static getInstance(): SimpleBoundarySystem | null {
        return this.instance;
    }
    
    public static isPositionInBounds(position: Vec3): boolean {
        return this.instance ? this.instance.isPositionInBounds(position) : true;
    }
    
    public static clampPositionToBounds(position: Vec3): Vec3 {
        return this.instance ? this.instance.clampPositionToBounds(position) : position;
    }
}

export { SimpleBoundaryManager };