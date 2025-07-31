// assets/scripts/core/GridManager.ts

import { _decorator, Vec2, Vec3, Component, Node } from 'cc';
import { Faction } from '../configs/FactionConfig';

const { ccclass } = _decorator;

/**
 * 可拥挤角色接口 - 用于ORCA系统和网格管理
 */
export interface ICrowdableCharacter {
    node: Node;
    getFaction(): Faction;
    getRigidBody(): any;
    getMoveSpeed(): number;
    isAlive(): boolean;
}

/**
 * 网格统计信息
 */
interface GridStats {
    totalGrids: number;
    activeGrids: number;
    totalCharacters: number;
    averageCharactersPerGrid: number;
    maxCharactersInGrid: number;
    queryCount: number;
    lastUpdateTime: number;
}

/**
 * 网格管理器 - 基于空间分割的高性能角色管理系统
 * 将世界空间分割为网格，实现O(1)的位置查询和O(k)的邻居查询
 */
@ccclass('GridManager')
export class GridManager extends Component {
    private static _instance: GridManager;
    
    // 网格配置参数
    private readonly CELL_SIZE = 120;              // 网格大小(像素)，略大于拥挤半径
    private readonly MAX_CHARACTERS_PER_CELL = 50; // 每个网格最大角色数量
    private readonly AUTO_CLEANUP_INTERVAL = 5.0;  // 自动清理空网格间隔(秒)
    
    // 网格存储：key = "gridX,gridY", value = 角色数组
    private grid: Map<string, ICrowdableCharacter[]> = new Map();
    private characterToGrid: Map<ICrowdableCharacter, string> = new Map();
    
    // 性能统计
    private stats: GridStats = {
        totalGrids: 0,
        activeGrids: 0,
        totalCharacters: 0,
        averageCharactersPerGrid: 0,
        maxCharactersInGrid: 0,
        queryCount: 0,
        lastUpdateTime: 0
    };
    
    // 性能优化：对象池
    private tempGridKeys: string[] = [];
    private tempCharacterArrays: ICrowdableCharacter[][] = [];
    private lastCleanupTime = 0;
    
    public static getInstance(): GridManager {
        if (!this._instance) {
            // 在运行时动态创建实例
            const node = new Node('GridManager');
            this._instance = node.addComponent(GridManager);
        }
        return this._instance;
    }

    protected onLoad() {
        if (GridManager._instance && GridManager._instance !== this) {
            this.destroy();
            return;
        }
        GridManager._instance = this;
        
        console.log(`GridManager: 网格管理器已初始化 (cellSize: ${this.CELL_SIZE}px)`);
    }

    /**
     * 世界坐标转网格坐标
     */
    private worldToGrid(worldPos: Vec3): { x: number, y: number } {
        return {
            x: Math.floor(worldPos.x / this.CELL_SIZE),
            y: Math.floor(worldPos.y / this.CELL_SIZE)
        };
    }

    /**
     * 网格坐标转唯一键
     */
    private gridToKey(gridX: number, gridY: number): string {
        return `${gridX},${gridY}`;
    }

    /**
     * 键转网格坐标
     */
    private keyToGrid(key: string): { x: number, y: number } {
        const parts = key.split(',');
        return {
            x: parseInt(parts[0]),
            y: parseInt(parts[1])
        };
    }

    /**
     * 添加角色到网格系统
     */
    public addCharacter(character: ICrowdableCharacter): void {
        if (!character || !character.node || !character.node.isValid) {
            console.warn('GridManager: 尝试添加无效角色');
            return;
        }

        // 计算角色所在网格
        const gridPos = this.worldToGrid(character.node.position);
        const gridKey = this.gridToKey(gridPos.x, gridPos.y);

        // 检查是否已经在网格中
        if (this.characterToGrid.has(character)) {
            console.warn('GridManager: 角色已在网格系统中');
            return;
        }

        // 获取或创建网格
        let gridCharacters = this.grid.get(gridKey);
        if (!gridCharacters) {
            gridCharacters = [];
            this.grid.set(gridKey, gridCharacters);
        }

        // 检查网格容量
        if (gridCharacters.length >= this.MAX_CHARACTERS_PER_CELL) {
            console.warn(`GridManager: 网格 ${gridKey} 已达到最大容量 ${this.MAX_CHARACTERS_PER_CELL}`);
            return;
        }

        // 添加角色
        gridCharacters.push(character);
        this.characterToGrid.set(character, gridKey);
        
        this.updateStats();
    }

    /**
     * 从网格系统移除角色
     */
    public removeCharacter(character: ICrowdableCharacter): void {
        const gridKey = this.characterToGrid.get(character);
        if (!gridKey) {
            return; // 角色不在网格系统中
        }

        const gridCharacters = this.grid.get(gridKey);
        if (gridCharacters) {
            const index = gridCharacters.indexOf(character);
            if (index !== -1) {
                gridCharacters.splice(index, 1);
                
                // 如果网格为空，移除它
                if (gridCharacters.length === 0) {
                    this.grid.delete(gridKey);
                }
            }
        }

        this.characterToGrid.delete(character);
        this.updateStats();
    }

    /**
     * 更新角色位置（当角色移动时调用）
     */
    public updateCharacterPosition(character: ICrowdableCharacter, oldPos?: Vec3): void {
        if (!character || !character.node || !character.node.isValid) {
            this.removeCharacter(character);
            return;
        }

        const currentGridKey = this.characterToGrid.get(character);
        const newGridPos = this.worldToGrid(character.node.position);
        const newGridKey = this.gridToKey(newGridPos.x, newGridPos.y);

        // 如果角色还在同一个网格中，无需更新
        if (currentGridKey === newGridKey) {
            return;
        }

        // 从旧网格移除
        if (currentGridKey) {
            this.removeCharacter(character);
        }

        // 添加到新网格
        this.addCharacter(character);
    }

    /**
     * 获取指定位置附近的角色（3x3网格查询）
     */
    public getNearbyCharacters(worldPos: Vec3, radius: number, faction?: Faction): ICrowdableCharacter[] {
        this.stats.queryCount++;
        
        const centerGrid = this.worldToGrid(worldPos);
        const nearbyCharacters: ICrowdableCharacter[] = [];
        
        // 计算查询半径对应的网格范围
        const gridRadius = Math.ceil(radius / this.CELL_SIZE);
        
        // 查询中心网格及周围网格
        for (let dx = -gridRadius; dx <= gridRadius; dx++) {
            for (let dy = -gridRadius; dy <= gridRadius; dy++) {
                const gridX = centerGrid.x + dx;
                const gridY = centerGrid.y + dy;
                const gridKey = this.gridToKey(gridX, gridY);
                
                const gridCharacters = this.grid.get(gridKey);
                if (gridCharacters) {
                    for (const character of gridCharacters) {
                        // 检查角色是否有效
                        if (!character || !character.node || !character.node.isValid || !character.isAlive()) {
                            continue;
                        }
                        
                        // 阵营过滤
                        if (faction && character.getFaction() !== faction) {
                            continue;
                        }
                        
                        // 距离过滤
                        const distance = Vec3.distance(worldPos, character.node.position);
                        if (distance <= radius) {
                            nearbyCharacters.push(character);
                        }
                    }
                }
            }
        }
        
        return nearbyCharacters;
    }

    /**
     * 获取指定网格中的所有角色
     */
    public getGridCharacters(gridX: number, gridY: number): ICrowdableCharacter[] {
        const gridKey = this.gridToKey(gridX, gridY);
        return this.grid.get(gridKey) || [];
    }

    /**
     * 批量清理无效角色
     */
    public cleanupInvalidCharacters(): number {
        let removedCount = 0;
        const charactersToRemove: ICrowdableCharacter[] = [];
        
        // 收集所有无效角色
        this.characterToGrid.forEach((gridKey, character) => {
            if (!character || !character.node || !character.node.isValid || !character.isAlive()) {
                charactersToRemove.push(character);
            }
        });
        
        // 批量移除
        charactersToRemove.forEach(character => {
            this.removeCharacter(character);
            removedCount++;
        });
        
        this.updateStats();
        
        if (removedCount > 0) {
            console.log(`GridManager: 清理了 ${removedCount} 个无效角色`);
        }
        
        return removedCount;
    }

    /**
     * 自动清理空网格和无效角色
     */
    protected update(deltaTime: number): void {
        const currentTime = Date.now() / 1000;
        
        // 定期清理
        if (currentTime - this.lastCleanupTime > this.AUTO_CLEANUP_INTERVAL) {
            this.cleanupInvalidCharacters();
            this.lastCleanupTime = currentTime;
        }
        
        this.stats.lastUpdateTime = currentTime;
    }

    /**
     * 更新统计信息
     */
    private updateStats(): void {
        this.stats.totalGrids = this.grid.size;
        this.stats.activeGrids = 0;
        this.stats.totalCharacters = this.characterToGrid.size;
        this.stats.maxCharactersInGrid = 0;
        
        let totalInActiveGrids = 0;
        
        this.grid.forEach((characters, key) => {
            if (characters.length > 0) {
                this.stats.activeGrids++;
                totalInActiveGrids += characters.length;
                this.stats.maxCharactersInGrid = Math.max(this.stats.maxCharactersInGrid, characters.length);
            }
        });
        
        this.stats.averageCharactersPerGrid = this.stats.activeGrids > 0 ? totalInActiveGrids / this.stats.activeGrids : 0;
    }

    /**
     * 获取性能统计信息
     */
    public getStats(): GridStats {
        this.updateStats();
        return { ...this.stats };
    }

    /**
     * 获取网格可视化数据（用于调试显示）
     */
    public getGridVisualizationData(): Array<{key: string, x: number, y: number, count: number}> {
        const visualData: Array<{key: string, x: number, y: number, count: number}> = [];
        
        this.grid.forEach((characters, key) => {
            if (characters.length > 0) {
                const gridPos = this.keyToGrid(key);
                visualData.push({
                    key: key,
                    x: gridPos.x,
                    y: gridPos.y,
                    count: characters.length
                });
            }
        });
        
        return visualData;
    }

    /**
     * 重置网格系统
     */
    public reset(): void {
        this.grid.clear();
        this.characterToGrid.clear();
        this.stats.queryCount = 0;
        this.updateStats();
        console.log('GridManager: 网格系统已重置');
    }

    protected onDestroy() {
        if (GridManager._instance === this) {
            GridManager._instance = null as any;
        }
    }
}

// 全局实例导出
export const gridManager = GridManager.getInstance(); 