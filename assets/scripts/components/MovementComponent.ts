// assets/scripts/components/MovementComponent.ts

import { Component, Vec2, Vec3, RigidBody2D } from 'cc';
import { IMovable } from '../interfaces/IMovable';
import { TempVarPool } from '../utils/TempVarPool';

/**
 * 移动组件 - 负责角色的移动、位置、物理相关功能
 * 实现 IMovable 接口，专注于移动功能的单一职责
 */
export class MovementComponent extends Component implements IMovable {
    // 移动相关属性
    private _moveSpeed: number = 150;
    private _moveDirection: Vec2 = new Vec2(0, 0);
    private _rigidBody: RigidBody2D | null = null;
    
    // IMovable 接口属性
    get moveSpeed(): number { return this._moveSpeed; }
    set moveSpeed(value: number) { this._moveSpeed = value; }
    
    get moveDirection(): Vec2 { return this._moveDirection; }
    set moveDirection(value: Vec2) { this._moveDirection.set(value); }
    
    get rigidBody(): RigidBody2D | null { return this._rigidBody; }

    protected onLoad(): void {
        // 获取或添加刚体组件
        this._rigidBody = this.getComponent(RigidBody2D) || this.addComponent(RigidBody2D);
        this.setupRigidBody();
    }

    /**
     * 处理移动逻辑 - 使用物理系统
     * @param deltaTime 时间增量
     */
    handleMovement(deltaTime: number): void {
        if (!this._rigidBody) {
            console.warn(`[MovementComponent] 刚体组件未初始化，无法移动`);
            return;
        }

        // 检查是否有移动输入
        if (this._moveDirection.length() === 0) {
            this.stopPhysicalMovement();
            return;
        }

        // 归一化移动方向
        const normalizedDirection = TempVarPool.tempVec2_1;
        normalizedDirection.set(this._moveDirection.x, this._moveDirection.y);
        normalizedDirection.normalize();

        // 计算速度向量
        const velocity = TempVarPool.tempVec2_2;
        velocity.set(
            normalizedDirection.x * this._moveSpeed,
            normalizedDirection.y * this._moveSpeed
        );

        // 应用速度到刚体
        this._rigidBody.linearVelocity = velocity;
    }

    /**
     * 停止移动
     */
    stopMovement(): void {
        this.stopPhysicalMovement();
        this._moveDirection.set(0, 0);
    }

    /**
     * 立即停止物理运动
     */
    stopPhysicalMovement(): void {
        if (this._rigidBody) {
            this._rigidBody.linearVelocity = TempVarPool.tempVec2_3.set(0, 0);
        }
    }

    /**
     * 设置节点位置
     * @param x X坐标
     * @param y Y坐标  
     * @param z Z坐标（可选）
     */
    setNodePosition(x: number, y: number, z?: number): void {
        if (z !== undefined) {
            this.node.setPosition(x, y, z);
        } else {
            // 自动计算Z深度（基于Y轴位置）
            const newZDepth = -y * 0.1;
            this.node.setPosition(x, y, newZDepth);
        }
    }

    /**
     * 检查是否有移动输入
     */
    hasMovementInput(): boolean {
        return this._moveDirection.lengthSqr() > 0.01;
    }

    /**
     * 获取移动速度
     */
    getMoveSpeed(): number {
        return this._moveSpeed;
    }

    /**
     * 获取刚体组件
     */
    getRigidBody(): RigidBody2D | null {
        return this._rigidBody;
    }

    /**
     * 配置刚体组件
     */
    private setupRigidBody(): void {
        if (!this._rigidBody) return;

        // 设置物理属性
        this._rigidBody.linearDamping = 0; // 无线性阻尼，保持恒定速度
        this._rigidBody.angularDamping = 10; // 角度阻尼，防止旋转
        this._rigidBody.gravityScale = 0; // 不受重力影响
        this._rigidBody.allowSleep = false; // 不允许休眠
        this._rigidBody.fixedRotation = true; // 固定旋转
        this._rigidBody.enabledContactListener = true; // 启用碰撞监听
    }

    /**
     * 重置移动状态
     */
    resetMovementState(): void {
        this._moveDirection.set(0, 0);
        this.stopPhysicalMovement();
    }
}