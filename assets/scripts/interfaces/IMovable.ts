// assets/scripts/interfaces/IMovable.ts

import { Vec2, Vec3, RigidBody2D } from 'cc';

/**
 * 可移动对象接口
 * 负责处理角色的移动相关功能
 */
export interface IMovable {
    /**
     * 移动速度（像素/秒）
     */
    readonly moveSpeed: number;
    
    /**
     * 当前移动方向
     */
    readonly moveDirection: Vec2;
    
    /**
     * 刚体组件引用
     */
    readonly rigidBody: RigidBody2D | null;
    
    /**
     * 处理角色移动
     * @param deltaTime 帧时间间隔
     */
    handleMovement(deltaTime: number): void;
    
    /**
     * 停止移动
     */
    stopMovement(): void;
    
    /**
     * 停止物理移动
     */
    stopPhysicalMovement(): void;
    
    /**
     * 设置节点位置
     * @param x X坐标
     * @param y Y坐标 
     * @param z Z坐标（可选）
     */
    setNodePosition(x: number, y: number, z?: number): void;
    
    /**
     * 检查是否有移动输入
     */
    hasMovementInput(): boolean;
    
    /**
     * 获取移动速度
     */
    getMoveSpeed(): number;
    
    /**
     * 获取刚体组件
     */
    getRigidBody(): RigidBody2D | null;
}