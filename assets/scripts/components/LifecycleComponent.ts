// assets/scripts/components/LifecycleComponent.ts

import { Component } from 'cc';
import { ILifecycle } from '../interfaces/ILifecycle';

/**
 * 生命周期组件 - 负责对象池管理、状态重置、生命周期回调
 * 实现 ILifecycle 接口，专注于生命周期管理的单一职责
 */
export class LifecycleComponent extends Component implements ILifecycle {
    // 对象池相关属性
    private _isFromPool: boolean = false;
    private _poolName: string = '';
    private _characterId: string = '';

    // ILifecycle 接口属性
    get characterId(): string { return this._characterId; }
    get isFromPool(): boolean { return this._isFromPool; }
    get poolName(): string { return this._poolName; }

    /**
     * 设置对象池属性
     * @param isFromPool 是否来自对象池
     * @param poolName 对象池名称
     * @param characterId 角色ID
     */
    setPoolingProperties(isFromPool: boolean, poolName: string, characterId: string): void {
        this._isFromPool = isFromPool;
        this._poolName = poolName;
        this._characterId = characterId;
        
        console.log(`[LifecycleComponent] 设置对象池属性: isFromPool=${isFromPool}, poolName=${poolName}, characterId=${characterId}`);
    }

    /**
     * 回收到对象池
     */
    returnToPool(): void {
        if (!this._isFromPool || !this._poolName) {
            console.warn(`[LifecycleComponent] 非池化对象，无法回收到对象池`);
            return;
        }

        // 触发回收事件，让其他组件进行清理
        this.node.emit('before-recycle-to-pool');

        // 这里需要通过服务定位器或依赖注入获取对象池管理器
        // 暂时用事件通知的方式
        this.node.emit('recycle-to-pool', {
            poolName: this._poolName,
            characterId: this._characterId
        });

        console.log(`[LifecycleComponent] 回收到对象池: ${this._poolName}, ID: ${this._characterId}`);
    }

    /**
     * 从池中重用时的回调
     */
    onReuseFromPool(): void {
        console.log(`[LifecycleComponent] 从对象池重用: ${this._poolName}, ID: ${this._characterId}`);
        
        // 激活节点
        this.node.active = true;
        
        // 触发重用事件，让其他组件进行初始化
        this.node.emit('reuse-from-pool');
    }

    /**
     * 回收到池时的回调
     */
    onRecycleToPool(): void {
        console.log(`[LifecycleComponent] 回收到对象池开始: ${this._poolName}, ID: ${this._characterId}`);
        
        // 触发回收事件，让其他组件进行清理
        this.node.emit('on-recycle-to-pool');
        
        // 最后停用节点
        this.scheduleOnce(() => {
            this.node.active = false;
        }, 0.1);
    }

    /**
     * 重置角色状态
     */
    resetCharacterState(): void {
        console.log(`[LifecycleComponent] 重置角色状态: ${this._characterId}`);
        
        // 触发重置事件，让各个组件重置自己的状态
        this.node.emit('reset-character-state');
    }

    /**
     * 检查是否来自对象池
     */
    getIsFromPool(): boolean {
        return this._isFromPool;
    }

    /**
     * 获取对象池名称
     */
    getPoolName(): string {
        return this._poolName;
    }

    /**
     * 检查角色是否存活
     */
    isAlive(): boolean {
        // 委托给CharacterStats组件
        const characterStats = this.getComponent('CharacterStats') as any;
        return characterStats ? characterStats.isAlive : true;
    }

    protected onLoad(): void {
        // 监听组件清理事件
        this.node.on('before-recycle-to-pool', this.onBeforeRecycleToPool, this);
        this.node.on('reuse-from-pool', this.onReuseFromPoolInternal, this);
        this.node.on('reset-character-state', this.onResetCharacterStateInternal, this);
    }

    protected onDestroy(): void {
        // 清理事件监听
        this.node.off('before-recycle-to-pool', this.onBeforeRecycleToPool, this);
        this.node.off('reuse-from-pool', this.onReuseFromPoolInternal, this);
        this.node.off('reset-character-state', this.onResetCharacterStateInternal, this);
    }

    /**
     * 回收前的准备工作
     */
    private onBeforeRecycleToPool(): void {
        // 清理定时器和调度
        this.unscheduleAllCallbacks();
    }

    /**
     * 内部重用处理
     */
    private onReuseFromPoolInternal(): void {
        // 重置内部状态
        // 其他组件会通过事件系统进行自己的重置
    }

    /**
     * 内部状态重置处理
     */
    private onResetCharacterStateInternal(): void {
        // 重置内部状态
        // 子类可以重写这个方法进行特定的重置
    }
}