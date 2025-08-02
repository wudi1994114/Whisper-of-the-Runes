// assets/scripts/interfaces/ILifecycle.ts

/**
 * 生命周期管理接口
 * 负责处理角色的生命周期、对象池管理、状态重置等
 */
export interface ILifecycle {
    /**
     * 角色ID
     */
    readonly characterId: string;
    
    /**
     * 是否来自对象池
     */
    readonly isFromPool: boolean;
    
    /**
     * 对象池名称
     */
    readonly poolName: string;
    
    /**
     * 是否存活
     */
    isAlive(): boolean;
    
    /**
     * 设置对象池属性
     * @param isFromPool 是否来自对象池
     * @param poolName 对象池名称
     * @param characterId 角色ID
     */
    setPoolingProperties(isFromPool: boolean, poolName: string, characterId: string): void;
    
    /**
     * 返回到对象池
     */
    returnToPool(): void;
    
    /**
     * 从对象池重用时的回调
     */
    onReuseFromPool(): void;
    
    /**
     * 回收到对象池时的回调
     */
    onRecycleToPool(): void;
    
    /**
     * 重置角色状态
     */
    resetCharacterState(): void;
    
    /**
     * 获取是否来自对象池
     */
    getIsFromPool(): boolean;
    
    /**
     * 获取对象池名称
     */
    getPoolName(): string;
}