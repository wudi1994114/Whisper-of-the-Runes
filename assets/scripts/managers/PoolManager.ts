// assets/scripts/core/PoolManager.ts

import { _decorator, Node, Prefab, instantiate, NodePool, Component, Label, UITransform, Color, Vec2, Vec3 } from 'cc';
import { handleError, ErrorType, ErrorSeverity } from '../components/ErrorHandler';
import { systemConfigManager, DamageTextPoolConfig } from '../configs/SystemConfig';
import { animationManager } from './AnimationManager';
import { getAnimationConfigByPrefix, AnimationState, AnimationDirection } from '../configs/AnimationConfig';
import { CharacterStats } from '../components/CharacterStats';
import { HealthBarComponent } from '../components/HealthBarComponent';
// import { MonsterAnimationController } from '../controllers/MonsterAnimationController'; // 不再使用

// ECS 组件导入
import { LifecycleComponent } from '../components/LifecycleComponent';
import { ConfigComponent } from '../components/ConfigComponent';
import { FactionComponent } from '../components/FactionComponent';
import { MovementComponent } from '../components/MovementComponent';
import { CombatComponent } from '../components/CombatComponent';
import { AnimationComponent } from '../components/AnimationComponent';
import { RenderComponent } from '../components/RenderComponent';
import { ControlComponent } from '../components/ControlComponent';
import { AIIntentionComponent } from '../components/AIIntentionComponent';
import { ModularCharacter } from '../entities/ModularCharacter';

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
    
    // 伤害文字池系统
    private _damageTextPools: Map<number, Node[]> = new Map();
    private _damageTextPoolInitialized: boolean = false;
    
    // 基础对象池系统 - 用于管理Vec2, Vec3, Color等频繁创建的对象
    private _vec2Pool: Vec2[] = [];
    private _vec3Pool: Vec3[] = [];
    private _colorPool: Color[] = [];
    private readonly MAX_VEC2_POOL_SIZE = 100;
    private readonly MAX_VEC3_POOL_SIZE = 100;
    private readonly MAX_COLOR_POOL_SIZE = 50;

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
     * 从对象池获取敌人实例并初始化（专用于敌人角色）
     * @param poolName 对象池名称 (通常是敌人ID，如 'ent_normal', 'lich_elite')
     * @param enemyData 敌人数据配置（可选，如果提供则会自动设置CharacterStats和血条）
     * @returns 初始化完成的敌人节点
     */
    public getEnemyInstance(poolName: string, enemyData?: any): Node | null {
        const node = this.get(poolName);
        if (!node) {
            return null;
        }

        // 强制激活节点
        node.active = true;

        // 如果有敌人数据，进行基础初始化（不涉及组件配置）
        if (enemyData) {
            this.initializeEnemyInstance(node, enemyData);
        }

        console.log(`PoolManager: 获取敌人实例完成 - ${poolName} (${node.name}), 节点已激活: ${node.active}`);
        return node;
    }

    /**
     * 初始化敌人实例的统一方法
     */
    private initializeEnemyInstance(node: Node, enemyData: any): void {
        if (!enemyData) {
            console.warn('PoolManager: 缺少敌人数据，跳过初始化');
            return;
        }

        try {
            // 初始化CharacterStats组件
            const characterStats = node.getComponent('CharacterStats');
            if (characterStats && (characterStats as any).initWithEnemyData) {
                (characterStats as any).initWithEnemyData(enemyData);
                console.log(`PoolManager: CharacterStats已使用敌人数据初始化`);
            }

            // 初始化血条组件
            const healthBarComponent = node.getComponent('HealthBarComponent');
            if (healthBarComponent && (healthBarComponent as any).initializeWithEnemyData) {
                (healthBarComponent as any).initializeWithEnemyData(enemyData);
                console.log(`PoolManager: HealthBarComponent已初始化`);
            }

            console.log(`PoolManager: 敌人实例 ${enemyData.id} 初始化完成`);
        } catch (error) {
            console.error(`PoolManager: 初始化敌人实例失败`, error);
        }
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
            
            // 为角色类型的节点自动注入ECS组件
            if (this.isCharacterPool(name)) {
                this.injectECSComponents(node);
                console.log(`PoolManager: 为池节点注入ECS组件 - ${name}`);
            }
            
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
     * 判断是否为角色类型的对象池
     * @param poolName 池名称
     * @returns 是否为角色池
     */
    private isCharacterPool(poolName: string): boolean {
        // 根据池名称判断是否为角色类型
        // 通常角色池的命名包含敌人ID，如 'ent', 'goblin', 'lich' 等
        const characterPoolPatterns = [
            'ent', 'goblin', 'lich', 'orc', 'slime', 'golem', 'player'
        ];
        
        return characterPoolPatterns.some(pattern => poolName.toLowerCase().includes(pattern));
    }

    /**
     * 为节点注入基础架构组件（对象池创建时）
     * @param node 要注入组件的节点
     */
    private injectECSComponents(node: Node): void {
        try {
            // 检查是否已有基础组件，避免重复注入
            if (node.getComponent(ModularCharacter)) {
                console.log(`PoolManager: 节点已有基础组件，跳过注入`);
                return;
            }

            // 只注入基础架构组件（生命周期长，状态简单可重置）
            console.log(`PoolManager: 注入基础架构组件...`);
            const movement = node.addComponent(MovementComponent);       // 移动能力
            const combat = node.addComponent(CombatComponent);           // 战斗能力  
            const animation = node.addComponent(AnimationComponent);     // 动画能力
            const render = node.addComponent(RenderComponent);           // 渲染能力
            const characterStats = node.addComponent(CharacterStats);   // 角色属性
            const healthBar = node.addComponent(HealthBarComponent);     // 血条组件
            const character = node.addComponent(ModularCharacter);       // 主组合组件

            console.log(`PoolManager: 基础架构组件注入完成（7个）`);
        } catch (error) {
            console.error(`PoolManager: 基础组件注入失败`, error);
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

    // =================== 伤害文字池管理 ===================

    /**
     * 初始化伤害文字池系统
     */
    public initializeDamageTextPool(): void {
        if (this._damageTextPoolInitialized) {
            console.log('PoolManager: 伤害文字池已初始化，跳过');
            return;
        }

        const config = systemConfigManager.getDamageTextPoolConfig();
        console.log('PoolManager: 开始初始化伤害文字池系统', config);

        if (config.enableBatchLoading) {
            this.initializeDamageTextPoolBatched(config);
        } else {
            this.initializeDamageTextPoolFull(config);
        }

        this._damageTextPoolInitialized = true;
        console.log('PoolManager: 伤害文字池系统初始化完成');
    }

    /**
     * 分批初始化伤害文字池
     */
    private initializeDamageTextPoolBatched(config: DamageTextPoolConfig): void {
        console.log('PoolManager: 使用分批加载模式初始化伤害文字池');
        console.log(`- 伤害范围: ${config.minDamage}-${config.maxDamage}`);
        console.log(`- 预加载范围: ${config.preloadRangeStart}-${config.preloadRangeEnd}`);
        console.log(`- 每个数值节点数: ${config.nodesPerDamage}`);

        // 预加载常用范围
        this.createDamageNodesForRange(config.preloadRangeStart, config.preloadRangeEnd, config.nodesPerDamage);
        console.log(`PoolManager: 常用伤害值（${config.preloadRangeStart}-${config.preloadRangeEnd}）预加载完成`);
    }

    /**
     * 全量初始化伤害文字池
     */
    private initializeDamageTextPoolFull(config: DamageTextPoolConfig): void {
        console.log('PoolManager: 开始全量初始化伤害文字池');
        
        const totalNodes = (config.maxDamage - config.minDamage + 1) * config.nodesPerDamage;
        console.log(`PoolManager: 预计创建节点数: ${totalNodes}`);

        this.createDamageNodesForRange(config.minDamage, config.maxDamage, config.nodesPerDamage);
        
        console.log('PoolManager: 伤害文字池全量初始化完成');
        console.log(`- 总节点数: ${this._damageTextPools.size * config.nodesPerDamage}`);
    }

    /**
     * 为指定范围创建伤害节点
     */
    private createDamageNodesForRange(startDamage: number, endDamage: number, nodesPerDamage: number): void {
        const rangeSize = endDamage - startDamage + 1;
        console.log(`PoolManager: 创建伤害节点范围 ${startDamage}-${endDamage} (${rangeSize}个数值)`);
        
        for (let damage = startDamage; damage <= endDamage; damage++) {
            // 检查是否已存在该伤害值的池
            let nodesForThisDamage = this._damageTextPools.get(damage);
            
            if (!nodesForThisDamage) {
                // 不存在则创建新池
                nodesForThisDamage = [];
                this._damageTextPools.set(damage, nodesForThisDamage);
            }

            // 创建指定数量的节点并添加到池中
            for (let i = 0; i < nodesPerDamage; i++) {
                const damageNode = this.createDamageTextNode(damage);
                nodesForThisDamage.push(damageNode);
            }
        }
        
        const totalCreated = rangeSize * nodesPerDamage;
        console.log(`PoolManager: 范围创建完成，共 ${totalCreated} 个节点`);
    }

    /**
     * 创建伤害文字节点（池化节点，不设置父节点）
     */
    private createDamageTextNode(damage: number): Node {
        const damageNode = new Node(`DamageText_${damage}`);

        // 检查并添加 UITransform（避免重复添加）
        let transform = damageNode.getComponent(UITransform);
        if (!transform) {
            transform = damageNode.addComponent(UITransform);
        }
        transform.setContentSize(60, 30);

        // 检查并添加 Label 组件（避免重复添加）
        let label = damageNode.getComponent(Label);
        if (!label) {
            label = damageNode.addComponent(Label);
        }
        label.string = `-${damage}`;
        label.fontSize = 10;
        label.color = new Color(255, 100, 100, 255);

        // 重置位置和缩放（池化节点的标准状态）
        damageNode.setPosition(0, 0, 0);
        damageNode.setScale(1, 1, 1);
        damageNode.active = false; // 池化节点默认非激活

        return damageNode;
    }

    /**
     * 获取伤害文字节点
     */
    public getDamageTextNode(damage: number): Node | null {
        const config = systemConfigManager.getDamageTextPoolConfig();
        
        // 检查伤害值是否在有效范围内
        if (damage < config.minDamage || damage > config.maxDamage) {
            console.warn(`PoolManager: 伤害值 ${damage} 超出预设范围 ${config.minDamage}-${config.maxDamage}`);
            return null;
        }

        let nodesForDamage = this._damageTextPools.get(damage);

        // 如果该伤害值的节点还未创建（延迟加载）
        if (!nodesForDamage) {
            // 快速创建单个伤害值的节点池，不输出详细日志避免影响性能
            nodesForDamage = [];
            for (let i = 0; i < config.nodesPerDamage; i++) {
                const damageNode = this.createDamageTextNode(damage);
                nodesForDamage.push(damageNode);
            }
            this._damageTextPools.set(damage, nodesForDamage);
        }

        // 尝试找到一个非激活的节点
        for (const node of nodesForDamage) {
            if (!node.active) {
                return node;
            }
        }

        // 如果所有节点都在使用中，创建新节点并添加到池中，然后获取
        console.log(`PoolManager: 伤害值 ${damage} 的所有节点都在使用中，扩展池容量`);
        const newNode = this.createDamageTextNode(damage);
        newNode.active = false; // 确保新创建的节点是非激活状态
        nodesForDamage.push(newNode); // 添加到池中
        
        console.log(`PoolManager: 伤害值 ${damage} 的节点池已扩展，当前大小: ${nodesForDamage.length}`);
        
        // 从池中获取这个新节点（保证一致性）
        return newNode;
    }

    /**
     * 归还伤害文字节点
     */
    public returnDamageTextNode(node: Node): void {
        if (!node || !node.isValid) {
            console.warn('PoolManager: 尝试归还无效的伤害文字节点');
            return;
        }
        
        // 获取伤害值（从节点名称中提取）
        const damageValue = node.name.replace('DamageText_', '');
        
        node.active = false;
        
        // 从场景树中移除（重要！避免内存泄漏）
        if (node.parent) {
            node.removeFromParent();
        }
        
        // 重置位置和缩放
        node.setPosition(0, 0, 0);
        node.setScale(1, 1, 1);
        
        // 重置Label颜色和透明度
        const label = node.getComponent(Label);
        if (label) {
            label.color = new Color(255, 100, 100, 255); // 重置为默认颜色
        }
        
        console.log(`PoolManager: 伤害文字节点已回收 (伤害值: ${damageValue})`);
    }

    /**
     * 获取伤害文字池统计信息
     */
    public getDamageTextPoolStats(): { 
        totalPools: number; 
        totalNodes: number; 
        activeNodes: number; 
        config: DamageTextPoolConfig;
    } {
        const config = systemConfigManager.getDamageTextPoolConfig();
        let totalNodes = 0;
        let activeNodes = 0;

        this._damageTextPools.forEach(nodes => {
            totalNodes += nodes.length;
            activeNodes += nodes.filter(node => node.active).length;
        });

        return {
            totalPools: this._damageTextPools.size,
            totalNodes,
            activeNodes,
            config
        };
    }

    /**
     * 清理伤害文字池
     */
    public clearDamageTextPool(): void {
        this._damageTextPools.forEach(nodes => {
            nodes.forEach(node => {
                if (node && node.isValid) {
                    node.destroy();
                }
            });
        });
        this._damageTextPools.clear();
        this._damageTextPoolInitialized = false;
        console.log('PoolManager: 伤害文字池已清理');
    }

    /**
     * 检查并清理伤害文字池中的无效节点
     */
    public cleanupInvalidDamageTextNodes(): void {
        let cleanedCount = 0;
        let totalCount = 0;

        this._damageTextPools.forEach((nodes, damage) => {
            const validNodes = nodes.filter(node => {
                totalCount++;
                if (node && node.isValid) {
                    return true;
                } else {
                    cleanedCount++;
                    return false;
                }
            });

            // 如果有节点被清理，更新池
            if (validNodes.length !== nodes.length) {
                this._damageTextPools.set(damage, validNodes);
            }
        });

        console.log(`PoolManager: 伤害文字池清理完成，清理了 ${cleanedCount}/${totalCount} 个无效节点`);
    }

    /**
     * 预热伤害文字池（创建指定范围的节点）
     */
    public warmupDamageTextPool(startDamage: number, endDamage: number, nodesPerDamage?: number): void {
        const config = systemConfigManager.getDamageTextPoolConfig();
        const actualNodesPerDamage = nodesPerDamage || config.nodesPerDamage;

        console.log(`PoolManager: 开始预热伤害文字池，范围: ${startDamage}-${endDamage}`);
        this.createDamageNodesForRange(startDamage, endDamage, actualNodesPerDamage);
        console.log(`PoolManager: 伤害文字池预热完成`);
    }

    /**
     * 销毁对象池管理器
     */
    public destroy(): void {
        this.clear();
        this.clearDamageTextPool();
        this._pools.clear();
        this._configs.clear();
        this._stats.clear();
        this._prefabs.clear();
    }
    
    // ===================== 基础对象池系统方法 =====================
    
    /**
     * 获取Vec2对象（从池中或新建）
     * @param x 可选的x值
     * @param y 可选的y值
     * @returns Vec2对象
     */
    public getVec2(x: number = 0, y: number = 0): Vec2 {
        let vec2 = this._vec2Pool.pop();
        if (!vec2) {
            vec2 = new Vec2();
        }
        return vec2.set(x, y);
    }
    
    /**
     * 归还Vec2对象到池中
     * @param vec2 要归还的Vec2对象
     */
    public putVec2(vec2: Vec2): void {
        if (this._vec2Pool.length < this.MAX_VEC2_POOL_SIZE) {
            vec2.set(0, 0); // 重置为默认值
            this._vec2Pool.push(vec2);
        }
    }
    
    /**
     * 获取Vec3对象（从池中或新建）
     * @param x 可选的x值
     * @param y 可选的y值
     * @param z 可选的z值
     * @returns Vec3对象
     */
    public getVec3(x: number = 0, y: number = 0, z: number = 0): Vec3 {
        let vec3 = this._vec3Pool.pop();
        if (!vec3) {
            vec3 = new Vec3();
        }
        return vec3.set(x, y, z);
    }
    
    /**
     * 归还Vec3对象到池中
     * @param vec3 要归还的Vec3对象
     */
    public putVec3(vec3: Vec3): void {
        if (this._vec3Pool.length < this.MAX_VEC3_POOL_SIZE) {
            vec3.set(0, 0, 0); // 重置为默认值
            this._vec3Pool.push(vec3);
        }
    }
    
    /**
     * 获取Color对象（从池中或新建）
     * @param r 红色分量
     * @param g 绿色分量
     * @param b 蓝色分量
     * @param a 透明度分量
     * @returns Color对象
     */
    public getColor(r: number = 255, g: number = 255, b: number = 255, a: number = 255): Color {
        let color = this._colorPool.pop();
        if (!color) {
            color = new Color();
        }
        return color.set(r, g, b, a);
    }
    
    /**
     * 归还Color对象到池中
     * @param color 要归还的Color对象
     */
    public putColor(color: Color): void {
        if (this._colorPool.length < this.MAX_COLOR_POOL_SIZE) {
            color.set(255, 255, 255, 255); // 重置为默认值
            this._colorPool.push(color);
        }
    }
    
    /**
     * 预热基础对象池
     */
    public warmupBasicObjectPools(): void {
        console.log('🔥 [PoolManager] 预热基础对象池...');
        
        // 预创建Vec2对象
        for (let i = 0; i < 20; i++) {
            this._vec2Pool.push(new Vec2());
        }
        
        // 预创建Vec3对象
        for (let i = 0; i < 20; i++) {
            this._vec3Pool.push(new Vec3());
        }
        
        // 预创建Color对象
        for (let i = 0; i < 10; i++) {
            this._colorPool.push(new Color());
        }
        
        console.log(`✅ [PoolManager] 基础对象池预热完成: Vec2=${this._vec2Pool.length}, Vec3=${this._vec3Pool.length}, Color=${this._colorPool.length}`);
    }
    
    /**
     * 获取基础对象池状态
     */
    public getBasicObjectPoolStats(): { vec2: number, vec3: number, color: number } {
        return {
            vec2: this._vec2Pool.length,
            vec3: this._vec3Pool.length,
            color: this._colorPool.length
        };
    }
}

export const poolManager = PoolManager.instance; 