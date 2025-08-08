// assets/scripts/systems/OneDimensionalGrid.ts

import { Node, Vec3 } from 'cc';
import { Faction } from '../configs/FactionConfig';
import { 
    IGrid, 
    GridCoordinate, 
    GridEntity, 
    EntityType, 
    QueryOptions, 
    QueryResult 
} from '../interfaces/IGrid';

/**
 * 一维网格系统实现 - n*1 布局
 * 将整个游戏世界视为横向一维带状空间，简化空间查询
 */
export class OneDimensionalGrid implements IGrid {
    private static instance: OneDimensionalGrid | null = null;
    
    // 网格配置
    private readonly GRID_COLS: number;            // 网格列数 (n)
    private readonly WORLD_WIDTH: number;          // 世界宽度
    private readonly WORLD_HEIGHT: number;         // 世界高度（逻辑上视为单行）
    private readonly GRID_SIZE: number;            // 每个网格的像素大小
    
    // 一维网格存储 - 使用列索引作为key
    private grids: Map<number, Set<GridEntity>> = new Map();
    
    // 实体索引 - 快速查找实体所在列（使用节点名称作为key）
    private entityToColumn: Map<string, number> = new Map();
    
    // 性能优化
    private readonly UPDATE_INTERVAL = 0.1;        // 100ms更新间隔
    private lastUpdateTime = 0;
    private updateQueue: Set<string> = new Set();  // 待更新实体队列
    
    // 统计信息
    private queryCount = 0;
    private entityCount = 0;
    
    /**
     * 构造函数
     * @param cols 网格列数
     * @param worldWidth 世界宽度
     * @param worldHeight 世界高度
     */
    private constructor(cols: number, worldWidth: number = 1920, worldHeight: number = 1080) {
        this.GRID_COLS = cols;
        this.WORLD_WIDTH = worldWidth;
        this.WORLD_HEIGHT = worldHeight;
        this.GRID_SIZE = worldWidth / cols; // 根据列数计算网格大小
        
        console.log(`[OneDimensionalGrid] 初始化${cols}列一维网格系统:`);
        console.log(`- 网格大小: ${this.GRID_SIZE.toFixed(1)}px`);
        console.log(`- 世界大小: ${this.WORLD_WIDTH}x${this.WORLD_HEIGHT}`);
        console.log(`- 总高度视为单行: ${this.WORLD_HEIGHT}px`);
    }
    
    /**
     * 获取或创建单例实例
     */
    public static getInstance(cols: number = 30, worldWidth: number = 1920, worldHeight: number = 1080): OneDimensionalGrid {
        if (!OneDimensionalGrid.instance) {
            OneDimensionalGrid.instance = new OneDimensionalGrid(cols, worldWidth, worldHeight);
        }
        return OneDimensionalGrid.instance;
    }
    
    /**
     * 重置单例实例
     */
    public static resetInstance(): void {
        if (OneDimensionalGrid.instance) {
            OneDimensionalGrid.instance.cleanup();
            OneDimensionalGrid.instance = null;
        }
    }
    
    /**
     * 注册实体到网格系统
     */
    public registerEntity(node: Node, faction: Faction, entityType: EntityType): void {
        if (!node || !node.isValid) {
            console.warn('[OneDimensionalGrid] 尝试注册无效实体');
            return;
        }
        
        const worldPos = node.getWorldPosition();
        const col = this.worldToGridCol(worldPos);
        
        const entity: GridEntity = {
            node,
            faction,
            worldPosition: worldPos.clone(),
            gridPosition: { x: col, y: 0 }, // y始终为0
            entityType,
            lastUpdateTime: Date.now()
        };
        
        this.addEntityToColumn(entity, col);
        this.entityToColumn.set(node.name, col);
        this.entityCount++;
        
        console.log(`[OneDimensionalGrid] 注册实体: ${node.name} (${entityType}) -> 列[${col}]`);
    }
    
    /**
     * 从网格系统移除实体
     */
    public unregisterEntity(node: Node): void {
        const col = this.entityToColumn.get(node.name);
        if (col === undefined) {
            return;
        }
        
        this.removeEntityFromColumn(node, col);
        this.entityToColumn.delete(node.name);
        this.updateQueue.delete(node.name);
        this.entityCount--;
        
        console.log(`[OneDimensionalGrid] 移除实体: ${node.name}`);
    }
    
    /**
     * 更新实体位置
     */
    public updateEntityPosition(node: Node): void {
        if (!node || !node.isValid) {
            return;
        }
        
        // 添加到更新队列，批量处理提升性能
        this.updateQueue.add(node.name);
    }
    
    /**
     * 处理更新队列
     */
    public processUpdates(deltaTime: number): void {
        this.lastUpdateTime += deltaTime;
        
        if (this.lastUpdateTime >= this.UPDATE_INTERVAL && this.updateQueue.size > 0) {
            this.flushUpdateQueue();
            this.lastUpdateTime = 0;
        }
    }
    
    /**
     * 查找最近的实体
     */
    public findNearestEntity(searchPos: Vec3, queryOptions: QueryOptions = {}): QueryResult | null {
        this.queryCount++;
        
        const searchCol = this.worldToGridCol(searchPos);
        const maxSearchRadius = Math.ceil((queryOptions.maxDistance || 200) / this.GRID_SIZE);
        
        let nearestResult: QueryResult | null = null;
        let nearestDistanceSqr = (queryOptions.maxDistance || 200) ** 2;
        
        // 搜索范围内的列
        for (let dx = -maxSearchRadius; dx <= maxSearchRadius; dx++) {
            const col = searchCol + dx;
            
            if (!this.isValidColumn(col)) {
                continue;
            }
            
            const entities = this.getEntitiesInColumn(col);
            if (!entities) {
                continue;
            }
            
            for (const entity of entities) {
                if (!this.matchesQuery(entity, queryOptions)) {
                    continue;
                }
                
                const distanceSqr = this.getDistanceSquared(searchPos, entity.worldPosition);
                if (distanceSqr < nearestDistanceSqr) {
                    nearestDistanceSqr = distanceSqr;
                    nearestResult = {
                        entity,
                        distance: Math.sqrt(distanceSqr)
                    };
                }
            }
        }
        
        return nearestResult;
    }
    
    /**
     * 查找范围内的所有实体
     */
    public findEntitiesInRange(searchPos: Vec3, radius: number, queryOptions: QueryOptions = {}): QueryResult[] {
        this.queryCount++;
        
        const results: QueryResult[] = [];
        const searchCol = this.worldToGridCol(searchPos);
        const maxSearchRadius = Math.ceil(radius / this.GRID_SIZE);
        const radiusSqr = radius * radius;
        
        // 搜索范围内的列
        for (let dx = -maxSearchRadius; dx <= maxSearchRadius; dx++) {
            const col = searchCol + dx;
            
            if (!this.isValidColumn(col)) {
                continue;
            }
            
            const entities = this.getEntitiesInColumn(col);
            if (!entities) {
                continue;
            }
            
            for (const entity of entities) {
                if (!this.matchesQuery(entity, queryOptions)) {
                    continue;
                }
                
                const distanceSqr = this.getDistanceSquared(searchPos, entity.worldPosition);
                if (distanceSqr <= radiusSqr) {
                    results.push({
                        entity,
                        distance: Math.sqrt(distanceSqr)
                    });
                }
            }
        }
        
        // 按距离排序
        results.sort((a, b) => a.distance - b.distance);
        return results;
    }
    
    /**
     * 核心方法：查找左中右三列的所有实体
     * 这是一维流场AI的核心索敌方法
     */
    public findEntitiesInThreeColumnRange(centerCol: number, queryOptions: QueryOptions = {}): QueryResult[] {
        this.queryCount++;
        
        const results: QueryResult[] = [];
        
        // 检查左、中、右三列
        for (let dx = -1; dx <= 1; dx++) {
            const col = centerCol + dx;
            
            if (!this.isValidColumn(col)) {
                continue;
            }
            
            const entities = this.getEntitiesInColumn(col);
            if (!entities) {
                continue;
            }
            
            for (const entity of entities) {
                if (!this.matchesQuery(entity, queryOptions)) {
                    continue;
                }
                
                // 使用统一的列中心世界坐标换算，避免原点与半格偏移误差
                const colWorld = this.columnToWorld(col);
                const distance = this.getDistance(entity.worldPosition, colWorld);
                results.push({
                    entity,
                    distance
                });
            }
        }
        
        // 按距离排序
        results.sort((a, b) => a.distance - b.distance);
        return results;
    }
    
    /**
     * 预测投射物路径上的碰撞
     */
    public predictCollisionAlongPath(
        startPos: Vec3,
        direction: Vec3,
        maxDistance: number,
        queryOptions: QueryOptions = {}
    ): QueryResult | null {
        const step = this.GRID_SIZE * 0.5;
        const normalizedDir = direction.clone().normalize();
        const steps = Math.ceil(maxDistance / step);
        
        for (let i = 1; i <= steps; i++) {
            const checkPos = new Vec3(
                startPos.x + normalizedDir.x * step * i,
                startPos.y + normalizedDir.y * step * i,
                startPos.z
            );
            
            const result = this.findNearestEntity(checkPos, {
                ...queryOptions,
                maxDistance: this.GRID_SIZE
            });
            
            if (result) {
                return result;
            }
        }
        
        return null;
    }
    
    /**
     * 获取网格内的阵营分布统计
     */
    public getFactionDistribution(gridPos: GridCoordinate): Map<Faction, number> {
        const distribution = new Map<Faction, number>();
        const entities = this.getEntitiesInColumn(gridPos.x);
        
        if (entities) {
            for (const entity of entities) {
                const count = distribution.get(entity.faction) || 0;
                distribution.set(entity.faction, count + 1);
            }
        }
        
        return distribution;
    }
    
    /**
     * 清理无效实体
     */
    public cleanup(): void {
        let cleanedCount = 0;
        
        this.grids.forEach((entities, col) => {
            const toRemove: GridEntity[] = [];
            
            for (const entity of entities) {
                if (!entity.node || !entity.node.isValid) {
                    toRemove.push(entity);
                    cleanedCount++;
                }
            }
            
            for (const entity of toRemove) {
                entities.delete(entity);
                this.entityToColumn.delete(entity.node.name);
            }
            
            // 如果列为空，删除列
            if (entities.size === 0) {
                this.grids.delete(col);
            }
        });
        
        this.entityCount -= cleanedCount;
        
        if (cleanedCount > 0) {
            console.log(`[OneDimensionalGrid] 清理了 ${cleanedCount} 个无效实体`);
        }
    }
    
    /**
     * 获取调试信息
     */
    public getDebugInfo(): string {
        return `[OneDimensionalGrid] ${this.GRID_COLS}列一维网格统计信息:
- 活跃列数: ${this.grids.size}
- 实体总数: ${this.entityCount}
- 查询次数: ${this.queryCount}
- 待更新队列: ${this.updateQueue.size}
- 网格大小: ${this.GRID_SIZE.toFixed(1)}px
- 世界大小: ${this.WORLD_WIDTH}x${this.WORLD_HEIGHT}`;
    }
    
    /**
     * 世界坐标转网格列号
     */
    public worldToGrid(worldPos: Vec3): GridCoordinate {
        const col = this.worldToGridCol(worldPos);
        return { x: col, y: 0 }; // y始终为0
    }
    
    /**
     * 世界坐标转列号（核心方法）
     */
    public worldToGridCol(worldPos: Vec3): number {
        const gridX = Math.floor((worldPos.x + this.WORLD_WIDTH / 2) / this.GRID_SIZE);
        return Math.max(0, Math.min(this.GRID_COLS - 1, gridX));
    }
    
    /**
     * 网格坐标转世界坐标
     */
    public gridToWorld(gridPos: GridCoordinate): Vec3 {
        const worldX = (gridPos.x + 0.5) * this.GRID_SIZE - this.WORLD_WIDTH / 2;
        const worldY = 0; // 一维网格的y坐标始终为0
        
        return new Vec3(worldX, worldY, 0);
    }
    
    /**
     * 列号转世界坐标
     */
    public columnToWorld(col: number): Vec3 {
        const worldX = (col + 0.5) * this.GRID_SIZE - this.WORLD_WIDTH / 2;
        return new Vec3(worldX, 0, 0);
    }
    
    /**
     * 获取网格配置信息
     */
    public getGridConfig(): {
        gridSize: number;
        cols: number;
        rows: number;
        worldWidth: number;
        worldHeight: number;
    } {
        return {
            gridSize: this.GRID_SIZE,
            cols: this.GRID_COLS,
            rows: 1, // 一维网格行数固定为1
            worldWidth: this.WORLD_WIDTH,
            worldHeight: this.WORLD_HEIGHT
        };
    }
    
    /**
     * 获取所有敌人实体（用于方向场算法）
     */
    public getAllEnemies(excludeFactions: Faction[] = []): GridEntity[] {
        const enemies: GridEntity[] = [];
        
        this.grids.forEach((entities) => {
            for (const entity of entities) {
                if (entity.entityType === EntityType.CHARACTER && 
                    !excludeFactions.includes(entity.faction)) {
                    enemies.push(entity);
                }
            }
        });
        
        return enemies;
    }
    
    // =================== 私有方法 ===================
    
    /**
     * 检查列号是否有效
     */
    private isValidColumn(col: number): boolean {
        return col >= 0 && col < this.GRID_COLS;
    }
    
    /**
     * 获取列中的实体集合
     */
    private getEntitiesInColumn(col: number): Set<GridEntity> | undefined {
        return this.grids.get(col);
    }
    
    /**
     * 添加实体到列
     */
    private addEntityToColumn(entity: GridEntity, col: number): void {
        if (!this.grids.has(col)) {
            this.grids.set(col, new Set());
        }
        
        this.grids.get(col)!.add(entity);
    }
    
    /**
     * 从列移除实体
     */
    private removeEntityFromColumn(node: Node, col: number): void {
        const entities = this.getEntitiesInColumn(col);
        if (!entities) {
            return;
        }
        
        for (const entity of entities) {
            if (entity.node === node) {
                entities.delete(entity);
                break;
            }
        }
        
        // 如果列为空，删除列
        if (entities.size === 0) {
            this.grids.delete(col);
        }
    }
    
    /**
     * 处理更新队列
     */
    private flushUpdateQueue(): void {
        for (const nodeName of this.updateQueue) {
            const oldCol = this.entityToColumn.get(nodeName);
            if (oldCol === undefined) {
                this.updateQueue.delete(nodeName);
                continue;
            }
            
            // 查找对应的节点实体
            const entities = this.getEntitiesInColumn(oldCol);
            let targetEntity: GridEntity | null = null;
            
            if (entities) {
                for (const entity of entities) {
                    if (entity.node.name === nodeName) {
                        targetEntity = entity;
                        break;
                    }
                }
            }
            
            if (!targetEntity || !targetEntity.node || !targetEntity.node.isValid) {
                this.updateQueue.delete(nodeName);
                continue;
            }
            
            const newWorldPos = targetEntity.node.getWorldPosition();
            const newCol = this.worldToGridCol(newWorldPos);
            
            // 如果列位置发生变化，更新实体位置
            if (oldCol !== newCol) {
                // 从旧列移除
                this.removeEntityFromColumn(targetEntity.node, oldCol);
                
                // 更新实体信息
                targetEntity.worldPosition = newWorldPos.clone();
                targetEntity.gridPosition = { x: newCol, y: 0 };
                targetEntity.lastUpdateTime = Date.now();
                
                // 添加到新列
                this.addEntityToColumn(targetEntity, newCol);
                this.entityToColumn.set(nodeName, newCol);
            }
        }
        
        this.updateQueue.clear();
    }
    
    /**
     * 检查实体是否匹配查询条件
     */
    private matchesQuery(entity: GridEntity, options: QueryOptions): boolean {
        // 检查阵营筛选
        if (options.factions && options.factions.indexOf(entity.faction) === -1) {
            return false;
        }
        
        // 检查实体类型筛选
        if (options.entityTypes && options.entityTypes.indexOf(entity.entityType) === -1) {
            return false;
        }
        
        // 检查是否忽略该实体
        if (options.ignoreEntity && entity.node === options.ignoreEntity) {
            return false;
        }
        
        // 检查存活状态
        if (options.onlyAlive) {
            const characterStats = entity.node.getComponent('CharacterStats');
            if (characterStats && !(characterStats as any).isAlive) {
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * 计算距离的平方（避免开方运算）
     */
    private getDistanceSquared(pos1: Vec3, pos2: Vec3): number {
        const dx = pos1.x - pos2.x;
        const dy = pos1.y - pos2.y;
        return dx * dx + dy * dy;
    }
    
    /**
     * 计算距离
     */
    private getDistance(pos1: Vec3, pos2: Vec3): number {
        return Math.sqrt(this.getDistanceSquared(pos1, pos2));
    }
}