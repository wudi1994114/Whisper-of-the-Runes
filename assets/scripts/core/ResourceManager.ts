// assets/scripts/core/ResourceManager.ts

import { _decorator, assetManager, Prefab, SpriteFrame, AudioClip, JsonAsset, Asset } from 'cc';
import { handleError, ErrorType, ErrorSeverity, safeAsync } from './ErrorHandler';
import { poolManager } from './PoolManager';

const { ccclass } = _decorator;

/**
 * 资源加载状态
 */
export enum LoadState {
    IDLE = 'IDLE',
    LOADING = 'LOADING',
    LOADED = 'LOADED',
    FAILED = 'FAILED'
}

/**
 * 资源信息
 */
interface ResourceInfo {
    path: string;
    type: typeof Asset;
    state: LoadState;
    asset?: Asset;
    error?: any;
    loadTime?: number;
}

/**
 * 预制体配置
 */
export interface PrefabConfig {
    name: string;                    // 预制体名称
    resourcePath?: string;           // resources目录下的路径
    mountedPrefab?: Prefab;         // 挂载的预制体备用方案
    poolConfig?: {
        poolName?: string;           // 对象池名称
        maxSize?: number;            // 对象池最大大小
        preloadCount?: number;       // 预加载数量
    };
    loadStrategy?: 'pool' | 'direct' | 'hybrid';  // 加载策略
    priority?: number;               // 加载优先级
}

/**
 * 预制体初始化结果
 */
export interface PrefabInitResult {
    name: string;
    success: boolean;
    strategy: 'pool' | 'mounted' | 'failed';
    error?: string;
    poolName?: string;
}

/**
 * 预制体批次配置
 */
export interface PrefabBatchConfig {
    category: string;                // 分类名称
    prefabs: PrefabConfig[];        // 预制体配置列表
    loadConcurrency?: number;        // 并发加载数量
    retryCount?: number;             // 重试次数
    onProgress?: (loaded: number, total: number) => void;  // 进度回调
    onItemComplete?: (result: PrefabInitResult) => void;   // 单项完成回调
}

/**
 * 预加载配置
 */
interface PreloadConfig {
    prefabs?: string[];              // 预制体路径列表（旧格式，保持兼容）
    textures?: string[];             // 纹理路径列表
    audio?: string[];                // 音频路径列表
    data?: string[];                 // 数据文件路径列表
    prefabBatches?: PrefabBatchConfig[];  // 预制体批次配置（新格式）
}

/**
 * 资源管理器
 * 提供统一的资源加载、缓存和管理功能
 */
@ccclass('ResourceManager')
export class ResourceManager {
    private static _instance: ResourceManager;
    private _resourceCache: Map<string, ResourceInfo> = new Map();
    private _loadingPromises: Map<string, Promise<Asset | null>> = new Map();
    private _preloadConfig: PreloadConfig = {};
    private _resourcesBundle: any = null;
    
    // 预制体初始化相关
    private _prefabConfigs: Map<string, PrefabConfig> = new Map();
    private _prefabInitResults: Map<string, PrefabInitResult> = new Map();
    private _prefabInitInProgress: Map<string, Promise<PrefabInitResult>> = new Map();

    public static get instance(): ResourceManager {
        if (!ResourceManager._instance) {
            ResourceManager._instance = new ResourceManager();
        }
        return ResourceManager._instance;
    }

    /**
     * 初始化资源管理器，确保 resources bundle 已加载
     */
    private async ensureResourcesBundle(): Promise<any> {
        if (this._resourcesBundle) {
            return this._resourcesBundle;
        }

        return new Promise((resolve, reject) => {
            // 检查是否已经加载了 resources bundle
            const existingBundle = assetManager.getBundle('resources');
            if (existingBundle) {
                this._resourcesBundle = existingBundle;
                resolve(existingBundle);
                return;
            }

            // 加载 resources bundle
            assetManager.loadBundle('resources', (err, bundle) => {
                if (err) {
                    console.error('ResourceManager: 加载 resources bundle 失败', err);
                    reject(err);
                    return;
                }
                this._resourcesBundle = bundle;
                resolve(bundle);
            });
        });
    }

    /**
     * 设置预加载配置
     */
    public setPreloadConfig(config: PreloadConfig): void {
        this._preloadConfig = { ...config };
        console.log('ResourceManager: 预加载配置已设置', config);
    }

    /**
     * 执行预加载
     */
    public async preloadResources(): Promise<void> {
        console.log('ResourceManager: 开始预加载资源...');
        const startTime = Date.now();

        // 确保 resources bundle 已加载
        await this.ensureResourcesBundle();

        const loadTasks: Promise<void>[] = [];

        // 处理旧格式的预制体配置（保持兼容性）
        if (this._preloadConfig.prefabs) {
            for (const path of this._preloadConfig.prefabs) {
                loadTasks.push(this.preloadSingle(path, Prefab));
            }
        }

        // 处理其他资源类型...
        if (this._preloadConfig.textures) {
            for (const path of this._preloadConfig.textures) {
                loadTasks.push(this.preloadSingle(path, SpriteFrame));
            }
        }

        if (this._preloadConfig.audio) {
            for (const path of this._preloadConfig.audio) {
                loadTasks.push(this.preloadSingle(path, AudioClip));
            }
        }

        if (this._preloadConfig.data) {
            for (const path of this._preloadConfig.data) {
                loadTasks.push(this.preloadSingle(path, JsonAsset));
            }
        }

        // 等待基础资源加载完成
        await Promise.all(loadTasks.map(task => task.catch(error => {
            console.warn('ResourceManager: 预加载任务失败', error);
            return null;
        })));

        // 处理新格式的预制体批次配置
        if (this._preloadConfig.prefabBatches) {
            for (const batchConfig of this._preloadConfig.prefabBatches) {
                try {
                    await this.initializePrefabBatch(batchConfig);
                } catch (error) {
                    console.error(`ResourceManager: 预制体批次 ${batchConfig.category} 初始化失败`, error);
                }
            }
        }

        const endTime = Date.now();
        const loadedCount = Array.from(this._resourceCache.values())
            .filter(info => info.state === LoadState.LOADED).length;
        const failedCount = Array.from(this._resourceCache.values())
            .filter(info => info.state === LoadState.FAILED).length;
        const prefabCount = this._prefabInitResults.size;
        const successfulPrefabs = Array.from(this._prefabInitResults.values())
            .filter(result => result.success).length;

        console.log(`ResourceManager: 预加载完成，耗时 ${endTime - startTime}ms`);
        console.log(`ResourceManager: 成功加载 ${loadedCount} 个基础资源，失败 ${failedCount} 个`);
        console.log(`ResourceManager: 成功初始化 ${successfulPrefabs}/${prefabCount} 个预制体`);
    }

    /**
     * 预加载单个资源
     */
    private async preloadSingle(path: string, type: typeof Asset): Promise<void> {
        const result = await safeAsync(
            () => this.loadResource(path, type),
            ErrorType.RESOURCE_LOADING,
            `预加载资源失败: ${path}`
        );

        if (!result) {
            console.warn(`ResourceManager: 预加载失败 ${path}`);
        }
    }

    /**
     * 加载资源（带缓存）
     */
    public async loadResource<T extends Asset>(path: string, type: new() => T): Promise<T | null> {
        // 检查缓存
        const cached = this._resourceCache.get(path);
        if (cached) {
            if (cached.state === LoadState.LOADED && cached.asset) {
                return cached.asset as T;
            }
            if (cached.state === LoadState.FAILED) {
                console.warn(`ResourceManager: 资源加载曾经失败 ${path}`);
                return null;
            }
        }

        // 检查是否正在加载
        const existingPromise = this._loadingPromises.get(path);
        if (existingPromise) {
            return (await existingPromise) as T | null;
        }

        // 创建资源信息
        const resourceInfo: ResourceInfo = {
            path,
            type: type as unknown as typeof Asset,
            state: LoadState.LOADING
        };
        this._resourceCache.set(path, resourceInfo);

        // 创建加载 Promise
        const loadPromise = this.performLoad<T>(path, type, resourceInfo);
        this._loadingPromises.set(path, loadPromise);

        try {
            const result = await loadPromise;
            return result;
        } finally {
            this._loadingPromises.delete(path);
        }
    }

    /**
     * 执行实际的资源加载 - 使用 assetManager
     */
    private async performLoad<T extends Asset>(
        path: string, 
        type: new() => T, 
        resourceInfo: ResourceInfo
    ): Promise<T | null> {
        const startTime = Date.now();

        try {
            // 确保 resources bundle 已加载
            const bundle = await this.ensureResourcesBundle();

            return new Promise<T | null>((resolve) => {
                bundle.load(path, type as any, (error: any, asset: T) => {
                    const loadTime = Date.now() - startTime;
                    resourceInfo.loadTime = loadTime;

                    if (error) {
                        resourceInfo.state = LoadState.FAILED;
                        resourceInfo.error = error;
                        
                        handleError(
                            ErrorType.RESOURCE_LOADING,
                            ErrorSeverity.MEDIUM,
                            `资源加载失败: ${path}`,
                            { path, type: type.name, loadTime },
                            error
                        );
                        
                        resolve(null);
                    } else {
                        resourceInfo.state = LoadState.LOADED;
                        resourceInfo.asset = asset;
                        
                        console.log(`ResourceManager: 加载成功 ${path} (${loadTime}ms)`);
                        resolve(asset);
                    }
                });
            });
        } catch (bundleError) {
            const loadTime = Date.now() - startTime;
            resourceInfo.state = LoadState.FAILED;
            resourceInfo.error = bundleError as Error;
            resourceInfo.loadTime = loadTime;
            
            handleError(
                ErrorType.RESOURCE_LOADING,
                ErrorSeverity.MEDIUM,
                `Bundle 加载失败: ${path}`,
                { path, type: type.name, loadTime },
                bundleError as Error
            );
            
            return null;
        }
    }

    /**
     * 批量加载资源
     */
    public async loadResources<T extends Asset>(
        paths: string[], 
        type: new() => T
    ): Promise<(T | null)[]> {
        const loadTasks = paths.map(path => this.loadResource(path, type));
        return Promise.all(loadTasks);
    }

    /**
     * 获取已缓存的资源
     */
    public getCachedResource<T extends Asset>(path: string): T | null {
        const cached = this._resourceCache.get(path);
        if (cached && cached.state === LoadState.LOADED && cached.asset) {
            return cached.asset as T;
        }
        return null;
    }

    /**
     * 检查资源是否已加载
     */
    public isResourceLoaded(path: string): boolean {
        const cached = this._resourceCache.get(path);
        return cached ? cached.state === LoadState.LOADED : false;
    }

    /**
     * 获取资源加载状态
     */
    public getResourceState(path: string): LoadState {
        const cached = this._resourceCache.get(path);
        return cached ? cached.state : LoadState.IDLE;
    }

    /**
     * 释放资源 - 使用 bundle.release
     */
    public releaseResource(path: string): void {
        const cached = this._resourceCache.get(path);
        if (cached && cached.asset) {
            // 释放资源引用
            cached.asset = undefined;
            cached.state = LoadState.IDLE;
            
            // 从 bundle 中释放资源
            if (this._resourcesBundle) {
                this._resourcesBundle.release(path);
            }
            
            console.log(`ResourceManager: 释放资源 ${path}`);
        }
    }

    /**
     * 释放所有缓存的资源
     */
    public releaseAllResources(): void {
        if (this._resourcesBundle) {
            this._resourceCache.forEach((info, path) => {
                if (info.asset) {
                    this._resourcesBundle.release(path);
                }
            });
        }
        
        this._resourceCache.clear();
        this._loadingPromises.clear();
        
        console.log('ResourceManager: 释放所有缓存资源');
    }

    /**
     * 获取资源统计信息
     */
    public getStats(): {
        total: number;
        loaded: number;
        loading: number;
        failed: number;
        avgLoadTime: number;
    } {
        const resources = Array.from(this._resourceCache.values());
        const loaded = resources.filter(r => r.state === LoadState.LOADED);
        const loading = resources.filter(r => r.state === LoadState.LOADING);
        const failed = resources.filter(r => r.state === LoadState.FAILED);
        
        const totalLoadTime = loaded.reduce((sum, r) => sum + (r.loadTime || 0), 0);
        const avgLoadTime = loaded.length > 0 ? totalLoadTime / loaded.length : 0;

        return {
            total: resources.length,
            loaded: loaded.length,
            loading: loading.length,
            failed: failed.length,
            avgLoadTime: Math.round(avgLoadTime)
        };
    }

    /**
     * 打印资源统计信息
     */
    public printStats(): void {
        const stats = this.getStats();
        console.log('=== 资源管理器统计 ===');
        console.log(`总资源数: ${stats.total}`);
        console.log(`已加载: ${stats.loaded}`);
        console.log(`加载中: ${stats.loading}`);
        console.log(`加载失败: ${stats.failed}`);
        console.log(`平均加载时间: ${stats.avgLoadTime}ms`);
        console.log('=====================');
    }

    /**
     * 清理失败的资源记录
     */
    public clearFailedResources(): void {
        const failedPaths: string[] = [];
        this._resourceCache.forEach((info, path) => {
            if (info.state === LoadState.FAILED) {
                failedPaths.push(path);
            }
        });

        failedPaths.forEach(path => {
            this._resourceCache.delete(path);
        });

        console.log(`ResourceManager: 清理了 ${failedPaths.length} 个失败的资源记录`);
    }

    // =================== 预制体初始化方法 ===================

    /**
     * 注册预制体配置
     * @param config 预制体配置
     */
    public registerPrefabConfig(config: PrefabConfig): void {
        this._prefabConfigs.set(config.name, config);
        console.log(`ResourceManager: 已注册预制体配置 ${config.name}`);
    }

    /**
     * 批量注册预制体配置
     * @param configs 预制体配置数组
     */
    public registerPrefabConfigs(configs: PrefabConfig[]): void {
        configs.forEach(config => this.registerPrefabConfig(config));
        console.log(`ResourceManager: 批量注册了 ${configs.length} 个预制体配置`);
    }

    /**
     * 初始化单个预制体
     * @param name 预制体名称
     * @param config 预制体配置（可选，如果已注册则使用注册的配置）
     * @returns 初始化结果
     */
    public async initializePrefab(name: string, config?: PrefabConfig): Promise<PrefabInitResult> {
        // 检查是否正在初始化
        const inProgress = this._prefabInitInProgress.get(name);
        if (inProgress) {
            return await inProgress;
        }

        // 检查是否已经初始化过
        const existingResult = this._prefabInitResults.get(name);
        if (existingResult && existingResult.success) {
            console.log(`ResourceManager: 预制体 ${name} 已经初始化过了`);
            return existingResult;
        }

        // 获取配置
        const finalConfig = config || this._prefabConfigs.get(name);
        if (!finalConfig) {
            const errorResult: PrefabInitResult = {
                name,
                success: false,
                strategy: 'failed',
                error: '未找到预制体配置'
            };
            this._prefabInitResults.set(name, errorResult);
            return errorResult;
        }

        // 开始初始化
        const initPromise = this.performPrefabInitialization(finalConfig);
        this._prefabInitInProgress.set(name, initPromise);

        try {
            const result = await initPromise;
            this._prefabInitResults.set(name, result);
            return result;
        } finally {
            this._prefabInitInProgress.delete(name);
        }
    }

    /**
     * 执行预制体初始化的具体逻辑
     * @param config 预制体配置
     * @returns 初始化结果
     */
    private async performPrefabInitialization(config: PrefabConfig): Promise<PrefabInitResult> {
        const { name, resourcePath, mountedPrefab, poolConfig, loadStrategy = 'hybrid' } = config;

        console.log(`ResourceManager: 开始初始化预制体 ${name}，策略: ${loadStrategy}`);

        // 策略1: 尝试从resources加载到对象池
        if ((loadStrategy === 'pool' || loadStrategy === 'hybrid') && resourcePath) {
            try {
                const prefab = await this.loadResource<Prefab>(resourcePath, Prefab);
                if (prefab) {
                    const poolName = poolConfig?.poolName || name;
                    
                    // 注册到对象池
                    poolManager.registerPrefab(poolName, prefab, {
                        maxSize: poolConfig?.maxSize || 30,
                        preloadCount: poolConfig?.preloadCount || 5
                    });

                    console.log(`ResourceManager: 预制体 ${name} 成功初始化到对象池 ${poolName}`);
                    return {
                        name,
                        success: true,
                        strategy: 'pool',
                        poolName
                    };
                }
            } catch (error) {
                console.warn(`ResourceManager: 预制体 ${name} 从resources加载失败`, error);
                
                // 如果是pool策略且失败了，直接返回失败
                if (loadStrategy === 'pool') {
                    return {
                        name,
                        success: false,
                        strategy: 'failed',
                        error: `Resources加载失败: ${error}`
                    };
                }
            }
        }

        // 策略2: 尝试使用挂载的预制体
        if ((loadStrategy === 'direct' || loadStrategy === 'hybrid') && mountedPrefab) {
            try {
                const poolName = poolConfig?.poolName || name;
                
                // 注册到对象池
                poolManager.registerPrefab(poolName, mountedPrefab, {
                    maxSize: poolConfig?.maxSize || 30,
                    preloadCount: poolConfig?.preloadCount || 5
                });

                console.log(`ResourceManager: 预制体 ${name} 使用挂载预制体初始化成功`);
                return {
                    name,
                    success: true,
                    strategy: 'mounted',
                    poolName
                };
            } catch (error) {
                console.error(`ResourceManager: 预制体 ${name} 挂载预制体初始化失败`, error);
            }
        }

        // 所有策略都失败
        console.error(`ResourceManager: 预制体 ${name} 初始化失败，所有策略都不可用`);
        return {
            name,
            success: false,
            strategy: 'failed',
            error: '所有初始化策略都失败'
        };
    }

    /**
     * 批量初始化预制体
     * @param batchConfig 批次配置
     * @returns 所有初始化结果
     */
    public async initializePrefabBatch(batchConfig: PrefabBatchConfig): Promise<PrefabInitResult[]> {
        const {
            category,
            prefabs,
            loadConcurrency = 3,
            retryCount = 2,
            onProgress,
            onItemComplete
        } = batchConfig;

        console.log(`ResourceManager: 开始批量初始化预制体分类 ${category}，共 ${prefabs.length} 个`);

        const results: PrefabInitResult[] = [];
        let completedCount = 0;

        // 按优先级排序
        const sortedPrefabs = [...prefabs].sort((a, b) => (b.priority || 0) - (a.priority || 0));

        // 分批处理
        for (let i = 0; i < sortedPrefabs.length; i += loadConcurrency) {
            const batch = sortedPrefabs.slice(i, i + loadConcurrency);
            
            // 并行处理当前批次
            const batchPromises = batch.map(async (config) => {
                let result: PrefabInitResult | null = null;
                let attempt = 0;

                // 重试逻辑
                while (attempt <= retryCount && (!result || !result.success)) {
                    if (attempt > 0) {
                        console.log(`ResourceManager: 重试初始化预制体 ${config.name}，第 ${attempt} 次`);
                        await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // 指数退避
                    }

                    try {
                        result = await this.initializePrefab(config.name, config);
                    } catch (error) {
                        console.error(`ResourceManager: 预制体 ${config.name} 初始化异常`, error);
                        result = {
                            name: config.name,
                            success: false,
                            strategy: 'failed',
                            error: `初始化异常: ${error}`
                        };
                    }

                    attempt++;
                }

                // 更新进度
                completedCount++;
                if (onProgress) {
                    onProgress(completedCount, prefabs.length);
                }

                if (onItemComplete && result) {
                    onItemComplete(result);
                }

                return result!;
            });

            // 等待当前批次完成
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);
        }

        // 统计结果
        const successCount = results.filter(r => r.success).length;
        const failureCount = results.length - successCount;

        console.log(`ResourceManager: 预制体分类 ${category} 初始化完成`);
        console.log(`  - 成功: ${successCount} 个`);
        console.log(`  - 失败: ${failureCount} 个`);

        return results;
    }

    /**
     * 获取预制体初始化结果
     * @param name 预制体名称
     * @returns 初始化结果，如果未初始化则返回null
     */
    public getPrefabInitResult(name: string): PrefabInitResult | null {
        return this._prefabInitResults.get(name) || null;
    }

    /**
     * 获取所有预制体初始化结果
     * @returns 所有初始化结果的映射
     */
    public getAllPrefabInitResults(): Map<string, PrefabInitResult> {
        return new Map(this._prefabInitResults);
    }

    /**
     * 检查预制体是否已成功初始化
     * @param name 预制体名称
     * @returns 是否已成功初始化
     */
    public isPrefabInitialized(name: string): boolean {
        const result = this._prefabInitResults.get(name);
        return result ? result.success : false;
    }

    /**
     * 打印预制体初始化统计信息
     */
    public printPrefabStats(): void {
        const results = Array.from(this._prefabInitResults.values());
        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);
        const poolStrategy = successful.filter(r => r.strategy === 'pool');
        const mountedStrategy = successful.filter(r => r.strategy === 'mounted');

        console.log('=== 预制体初始化统计 ===');
        console.log(`总预制体数: ${results.length}`);
        console.log(`成功初始化: ${successful.length}`);
        console.log(`初始化失败: ${failed.length}`);
        console.log(`对象池策略: ${poolStrategy.length}`);
        console.log(`挂载策略: ${mountedStrategy.length}`);
        
        if (failed.length > 0) {
            console.log('失败的预制体:');
            failed.forEach(result => {
                console.log(`  - ${result.name}: ${result.error}`);
            });
        }
        
        console.log('========================');
    }

    // =================== 组件预制体注册方法 ===================

    /**
     * 让组件直接注册挂载的预制体到对象池
     * @param name 预制体名称
     * @param mountedPrefab 挂载的预制体
     * @param poolConfig 对象池配置
     * @returns 是否注册成功
     */
    public registerMountedPrefabToPool(
        name: string, 
        mountedPrefab: any, 
        poolConfig: { 
            poolName?: string; 
            maxSize?: number; 
            preloadCount?: number 
        } = {}
    ): boolean {
        if (!mountedPrefab) {
            console.warn(`ResourceManager: 预制体 ${name} 为空，无法注册到对象池`);
            return false;
        }

        try {
            const finalPoolName = poolConfig.poolName || name;
            
            // 注册到对象池
            poolManager.registerPrefab(finalPoolName, mountedPrefab, {
                maxSize: poolConfig.maxSize || 30,
                preloadCount: poolConfig.preloadCount || 5
            });

            // 记录注册结果
            const result: PrefabInitResult = {
                name,
                success: true,
                strategy: 'mounted',
                poolName: finalPoolName
            };
            this._prefabInitResults.set(name, result);

            console.log(`ResourceManager: 挂载预制体 ${name} 已注册到对象池 ${finalPoolName}`);
            return true;
            
        } catch (error) {
            console.error(`ResourceManager: 注册挂载预制体 ${name} 到对象池失败`, error);
            
            // 记录失败结果
            const result: PrefabInitResult = {
                name,
                success: false,
                strategy: 'failed',
                error: `对象池注册失败: ${error}`
            };
            this._prefabInitResults.set(name, result);
            
            return false;
        }
    }

    /**
     * 批量注册挂载的预制体
     * @param prefabMappings 预制体映射表
     * @returns 注册结果统计
     */
    public registerMountedPrefabsToPool(
        prefabMappings: Array<{
            name: string;
            prefab: any;
            poolConfig?: { poolName?: string; maxSize?: number; preloadCount?: number };
        }>
    ): { success: number; failed: number } {
        let successCount = 0;
        let failedCount = 0;

        console.log(`ResourceManager: 开始批量注册 ${prefabMappings.length} 个挂载预制体...`);

        prefabMappings.forEach(mapping => {
            const success = this.registerMountedPrefabToPool(
                mapping.name, 
                mapping.prefab, 
                mapping.poolConfig || {}
            );
            
            if (success) {
                successCount++;
            } else {
                failedCount++;
            }
        });

        console.log(`ResourceManager: 批量注册完成 - 成功: ${successCount}, 失败: ${failedCount}`);
        return { success: successCount, failed: failedCount };
    }
}

// 导出单例
export const resourceManager = ResourceManager.instance;