// assets/scripts/core/PoolManager.ts

import { _decorator, Node, Prefab, instantiate, NodePool, Component } from 'cc';
import { handleError, ErrorType, ErrorSeverity } from './ErrorHandler';

const { ccclass } = _decorator;

/**
 * 对象池配置接口
 */
interface PoolConfig {
    maxSize?: number;        // 池的最大大小
    preloadCount?: number;   // 预加载数量
    clearInterval?: number;  // 清理间隔（毫秒）
}

/**
 * 对象池统计信息
 */
interface PoolStats {
    name: string;
    size: number;
    maxSize: number;
    getCount: number;
    putCount: number;
    createCount: number;
}

// 在同文件下定义一个辅助组件
@ccclass('PoolObject')
class PoolObject extends Component {
    public poolName: string = '';
    public onReuse?: () => void;    // 重用时的回调
    public onRecycle?: () => void;  // 回收时的回调
}

/**
 * 增强的对象池管理器
 */
class PoolManager {
    private static _instance: PoolManager;
    private _pools: Map<string, NodePool> = new Map();
    private _configs: Map<string, PoolConfig> = new Map();
    private _stats: Map<string, PoolStats> = new Map();
    private _prefabs: Map<string, Prefab> = new Map();
    private _lastCleanTime: number = 0;
    private _cleanInterval: number = 30000; // 30秒清理一次

    public static get instance(): PoolManager {
        if (!this._instance) {
            this._instance = new PoolManager();
        }
        return this._instance;
    }

    /**
     * 注册预制体到对象池
     * @param name 池名称
     * @param prefab 预制体
     * @param config 池配置
     */
    public registerPrefab(name: string, prefab: Prefab, config: PoolConfig = {}): void {
        try {
            this._prefabs.set(name, prefab);
            this._configs.set(name, {
                maxSize: config.maxSize || 50,
                preloadCount: config.preloadCount || 0,
                clearInterval: config.clearInterval || this._cleanInterval,
                ...config
            });

            // 创建对象池
            if (!this._pools.has(name)) {
                this._pools.set(name, new NodePool());
                this._stats.set(name, {
                    name,
                    size: 0,
                    maxSize: config.maxSize || 50,
                    getCount: 0,
                    putCount: 0,
                    createCount: 0
                });
            }

            // 预加载
            if (config.preloadCount && config.preloadCount > 0) {
                this.preload(name, config.preloadCount);
            }

            console.log(`PoolManager: 注册预制体 ${name}，配置:`, config);
        } catch (error) {
            handleError(
                ErrorType.RESOURCE_LOADING,
                ErrorSeverity.MEDIUM,
                `PoolManager: 注册预制体失败 ${name}`,
                { name, config },
                error as Error
            );
        }
    }

    /**
     * 预加载对象到池中
     * @param name 池名称
     * @param count 预加载数量
     */
    public preload(name: string, count: number): void {
        const prefab = this._prefabs.get(name);
        const pool = this._pools.get(name);
        const stats = this._stats.get(name);

        if (!prefab || !pool || !stats) {
            handleError(
                ErrorType.RESOURCE_LOADING,
                ErrorSeverity.MEDIUM,
                `PoolManager: 预加载失败，未找到预制体 ${name}`
            );
            return;
        }

        for (let i = 0; i < count; i++) {
            const node = this.createNode(name, prefab);
            if (node) {
                pool.put(node);
                stats.size++;
                stats.createCount++;
            }
        }

        console.log(`PoolManager: 预加载 ${name} 完成，数量: ${count}`);
    }

    /**
     * 从对象池获取节点
     * @param name 池名称
     * @returns 节点实例
     */
    public get(name: string): Node | null {
        const pool = this._pools.get(name);
        const prefab = this._prefabs.get(name);
        const stats = this._stats.get(name);

        if (!pool || !prefab || !stats) {
            handleError(
                ErrorType.RESOURCE_LOADING,
                ErrorSeverity.MEDIUM,
                `PoolManager: 获取节点失败，未找到池 ${name}`
            );
            return null;
        }

        let node = pool.get();
        
        if (!node) {
            // 池中没有可用节点，创建新的
            node = this.createNode(name, prefab);
            if (node) {
                stats.createCount++;
            }
        } else {
            stats.size--;
        }

        if (node) {
            stats.getCount++;
            
            // 调用重用回调
            const poolObject = node.getComponent(PoolObject);
            if (poolObject && poolObject.onReuse) {
                poolObject.onReuse();
            }
        }

        return node;
    }

    /**
     * 将节点放回对象池
     * @param node 要回收的节点
     */
    public put(node: Node): void {
        if (!node || !node.isValid) {
            return;
        }

        const poolObject = node.getComponent(PoolObject);
        if (!poolObject || !poolObject.poolName) {
            // 不是池对象，直接销毁
            node.destroy();
            return;
        }

        const pool = this._pools.get(poolObject.poolName);
        const config = this._configs.get(poolObject.poolName);
        const stats = this._stats.get(poolObject.poolName);

        if (!pool || !config || !stats) {
            node.destroy();
            return;
        }

        // 检查池是否已满
        if (stats.size >= config.maxSize!) {
            node.destroy();
            return;
        }

        // 调用回收回调
        if (poolObject.onRecycle) {
            poolObject.onRecycle();
        }

        // 重置节点状态
        node.setPosition(0, 0, 0);
        node.setRotation(0, 0, 0, 1);
        node.setScale(1, 1, 1);
        node.active = false;

        pool.put(node);
        stats.size++;
        stats.putCount++;
    }

    /**
     * 创建新节点
     * @param name 池名称
     * @param prefab 预制体
     * @returns 新节点
     */
    private createNode(name: string, prefab: Prefab): Node | null {
        try {
            const node = instantiate(prefab);
            const poolObject = node.addComponent(PoolObject);
            poolObject.poolName = name;
            return node;
        } catch (error) {
            handleError(
                ErrorType.RESOURCE_LOADING,
                ErrorSeverity.MEDIUM,
                `PoolManager: 创建节点失败 ${name}`,
                { name },
                error as Error
            );
            return null;
        }
    }

    /**
     * 清理对象池
     * @param name 池名称，不传则清理所有池
     */
    public clear(name?: string): void {
        if (name) {
            const pool = this._pools.get(name);
            const stats = this._stats.get(name);
            if (pool && stats) {
                pool.clear();
                stats.size = 0;
                console.log(`PoolManager: 清理池 ${name}`);
            }
        } else {
            this._pools.forEach((pool, poolName) => {
                pool.clear();
                const stats = this._stats.get(poolName);
                if (stats) {
                    stats.size = 0;
                }
            });
            console.log('PoolManager: 清理所有对象池');
        }
    }

    /**
     * 定期清理（在游戏主循环中调用）
     */
    public update(): void {
        const currentTime = Date.now();
        if (currentTime - this._lastCleanTime > this._cleanInterval) {
            this.performMaintenance();
            this._lastCleanTime = currentTime;
        }
    }

    /**
     * 执行维护操作
     */
    private performMaintenance(): void {
        // 清理过大的池
        this._pools.forEach((pool, name) => {
            const config = this._configs.get(name);
            const stats = this._stats.get(name);
            
            if (config && stats && stats.size > config.maxSize! * 1.5) {
                // 如果池大小超过最大值的1.5倍，清理一半
                const clearCount = Math.floor(stats.size * 0.5);
                for (let i = 0; i < clearCount; i++) {
                    const node = pool.get();
                    if (node) {
                        node.destroy();
                        stats.size--;
                    }
                }
                console.log(`PoolManager: 维护清理池 ${name}，清理数量: ${clearCount}`);
            }
        });
    }

    /**
     * 获取池统计信息
     * @param name 池名称
     * @returns 统计信息
     */
    public getStats(name?: string): PoolStats | PoolStats[] {
        if (name) {
            return this._stats.get(name) || {
                name,
                size: 0,
                maxSize: 0,
                getCount: 0,
                putCount: 0,
                createCount: 0
            };
        } else {
            return Array.from(this._stats.values());
        }
    }

    /**
     * 打印所有池的统计信息
     */
    public printStats(): void {
        console.log('=== 对象池统计信息 ===');
        this._stats.forEach(stats => {
            console.log(`${stats.name}: 大小=${stats.size}/${stats.maxSize}, 获取=${stats.getCount}, 回收=${stats.putCount}, 创建=${stats.createCount}`);
        });
        console.log('=====================');
    }

    /**
     * 销毁对象池管理器
     */
    public destroy(): void {
        this.clear();
        this._pools.clear();
        this._configs.clear();
        this._stats.clear();
        this._prefabs.clear();
    }
}

export const poolManager = PoolManager.instance; 