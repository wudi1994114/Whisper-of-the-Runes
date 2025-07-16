// assets/scripts/core/ResourceManager.ts

import { _decorator, resources, Prefab, SpriteFrame, AudioClip, JsonAsset, Asset } from 'cc';
import { handleError, ErrorType, ErrorSeverity, safeAsync } from './ErrorHandler';

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
 * 资源信息接口
 */
interface ResourceInfo {
    path: string;
    type: typeof Asset;
    state: LoadState;
    asset?: Asset;
    error?: Error;
    loadTime?: number;
}

/**
 * 预加载配置
 */
interface PreloadConfig {
    prefabs?: string[];      // 预制体路径列表
    textures?: string[];     // 纹理路径列表
    audio?: string[];        // 音频路径列表
    data?: string[];         // 数据文件路径列表
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

    public static get instance(): ResourceManager {
        if (!ResourceManager._instance) {
            ResourceManager._instance = new ResourceManager();
        }
        return ResourceManager._instance;
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

        const loadTasks: Promise<void>[] = [];

        // 预加载预制体
        if (this._preloadConfig.prefabs) {
            for (const path of this._preloadConfig.prefabs) {
                loadTasks.push(this.preloadSingle(path, Prefab));
            }
        }

        // 预加载纹理
        if (this._preloadConfig.textures) {
            for (const path of this._preloadConfig.textures) {
                loadTasks.push(this.preloadSingle(path, SpriteFrame));
            }
        }

        // 预加载音频
        if (this._preloadConfig.audio) {
            for (const path of this._preloadConfig.audio) {
                loadTasks.push(this.preloadSingle(path, AudioClip));
            }
        }

        // 预加载数据文件
        if (this._preloadConfig.data) {
            for (const path of this._preloadConfig.data) {
                loadTasks.push(this.preloadSingle(path, JsonAsset));
            }
        }

        // 等待所有预加载完成
        await Promise.all(loadTasks.map(task => task.catch(error => {
            console.warn('ResourceManager: 预加载任务失败', error);
            return null;
        })));

        const endTime = Date.now();
        const loadedCount = Array.from(this._resourceCache.values())
            .filter(info => info.state === LoadState.LOADED).length;
        const failedCount = Array.from(this._resourceCache.values())
            .filter(info => info.state === LoadState.FAILED).length;

        console.log(`ResourceManager: 预加载完成，耗时 ${endTime - startTime}ms`);
        console.log(`ResourceManager: 成功加载 ${loadedCount} 个资源，失败 ${failedCount} 个`);
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
     * 执行实际的资源加载
     */
    private async performLoad<T extends Asset>(
        path: string, 
        type: new() => T, 
        resourceInfo: ResourceInfo
    ): Promise<T | null> {
        const startTime = Date.now();

        return new Promise<T | null>((resolve) => {
            resources.load(path, type as any, (error: any, asset: T) => {
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
     * 释放资源
     */
    public releaseResource(path: string): void {
        const cached = this._resourceCache.get(path);
        if (cached && cached.asset) {
            // 释放资源引用
            cached.asset = undefined;
            cached.state = LoadState.IDLE;
            
            // 从 Cocos 资源系统中释放
            resources.release(path);
            
            console.log(`ResourceManager: 释放资源 ${path}`);
        }
    }

    /**
     * 释放所有缓存的资源
     */
    public releaseAllResources(): void {
        this._resourceCache.forEach((info, path) => {
            if (info.asset) {
                resources.release(path);
            }
        });
        
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
}

// 导出单例
export const resourceManager = ResourceManager.instance;