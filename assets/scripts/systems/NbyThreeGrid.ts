// assets/scripts/systems/NbyThreeGrid.ts

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
 * n*3网格系统实现
 * 创建一个列数可配置、行数固定为3的网格系统
 */
export class NbyThreeGrid implements IGrid {
    private static instance: NbyThreeGrid | null = null;
    
    // 网格配置
    private readonly GRID_SIZE: number;            // 每个网格的像素大小
    private readonly WORLD_WIDTH: number;          // 世界宽度
    private readonly WORLD_HEIGHT: number;         // 世界高度
    private readonly GRID_COLS: number;            // 网格列数 (n)
    private readonly GRID_ROWS = 3;                // 网格行数 (固定为3)
    
    // 网格存储 - 使用Map优化内存使用
    private grids: Map<string, Set<GridEntity>> = new Map();
    
    // 实体索引 - 快速查找实体所在网格（使用节点名称作为key）
    private entityToGrid: Map<string, GridCoordinate> = new Map();
    
    // 性能优化
    private readonly UPDATE_INTERVAL = 0.1;        // 100ms更新间隔
    private lastUpdateTime = 0;
    private updateQueue: Set<string> = new Set();    // 待更新实体队列（使用节点名称）
    
    // 统计信息
    private queryCount = 0;
    private entityCount = 0;
    
    /**
     * 构造函数
     * @param cols 网格列数
     * @param worldWidth 世界宽度
     * @param worldHeight 世界高度，默认按3行分配
     */
    private constructor(cols: number, worldWidth: number = 1920, worldHeight: number = 1080) {
        this.GRID_COLS = cols;
        this.WORLD_WIDTH = worldWidth;
        this.WORLD_HEIGHT = worldHeight;
        this.GRID_SIZE = worldWidth / cols; // 根据列数计算网格大小
        
        console.log(`[NbyThreeGrid] 初始化${cols}x3网格系统:`);
        console.log(`- 网格大小: ${this.GRID_SIZE.toFixed(1)}px`);
        console.log(`- 世界大小: ${this.WORLD_WIDTH}x${this.WORLD_HEIGHT}`);
        console.log(`- 每行高度: ${(this.WORLD_HEIGHT / this.GRID_ROWS).toFixed(1)}px`);
    }
    
    /**
     * 获取或创建单例实例
     * @param cols 网格列数
     * @param worldWidth 世界宽度
     * @param worldHeight 世界高度
     */
    public static getInstance(cols: number = 30, worldWidth: number = 1920, worldHeight: number = 1080): NbyThreeGrid {
        if (!NbyThreeGrid.instance) {
            NbyThreeGrid.instance = new NbyThreeGrid(cols, worldWidth, worldHeight);
        }
        return NbyThreeGrid.instance;
    }
    
    /**
     * 重置单例实例（用于创建新的网格配置）
     */
    public static resetInstance(): void {
        if (NbyThreeGrid.instance) {
            NbyThreeGrid.instance.cleanup();
            NbyThreeGrid.instance = null;
        }
    }
    
    /**
     * 注册实体到网格系统
     */
    public registerEntity(node: Node, faction: Faction, entityType: EntityType): void {
        if (!node || !node.isValid) {
            console.warn('[NbyThreeGrid] 尝试注册无效实体');
            return;
        }
        
        const worldPos = node.getWorldPosition();
        const gridPos = this.worldToGrid(worldPos);
        
        const entity: GridEntity = {
            node,
            faction,
            worldPosition: worldPos.clone(),
            gridPosition: gridPos,
            entityType,
            lastUpdateTime: Date.now()
        };
        
        this.addEntityToGrid(entity, gridPos);
        this.entityToGrid.set(node.name, gridPos);
        this.entityCount++;
        
        console.log(`[NbyThreeGrid] 注册实体: ${node.name} (${entityType}) -> 网格[${gridPos.x}, ${gridPos.y}]`);
    }
    
    /**
     * 从网格系统移除实体
     */
    public unregisterEntity(node: Node): void {
        const gridPos = this.entityToGrid.get(node.name);
        if (!gridPos) {
            return;
        }
        
        this.removeEntityFromGrid(node, gridPos);
        this.entityToGrid.delete(node.name);
        this.updateQueue.delete(node.name);
        this.entityCount--;
        
        console.log(`[NbyThreeGrid] 移除实体: ${node.name}`);
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
     * 处理更新队列 - 定时调用
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
        
        const searchGridPos = this.worldToGrid(searchPos);
        const maxSearchRadius = Math.ceil((queryOptions.maxDistance || 200) / this.GRID_SIZE);
        
        let nearestResult: QueryResult | null = null;
        let nearestDistanceSqr = (queryOptions.maxDistance || 200) ** 2;
        
        // 在n*3网格中搜索范围内的网格
        for (let dy = -1; dy <= 1; dy++) { // 由于只有3行，最多搜索上下1行
            for (let dx = -maxSearchRadius; dx <= maxSearchRadius; dx++) {
                const gridPos = {
                    x: searchGridPos.x + dx,
                    y: searchGridPos.y + dy
                };
                
                if (!this.isValidGridPosition(gridPos)) {
                    continue;
                }
                
                const entities = this.getEntitiesInGrid(gridPos);
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
        }
        
        return nearestResult;
    }
    
    /**
     * 查找范围内的所有实体
     */
    public findEntitiesInRange(searchPos: Vec3, radius: number, queryOptions: QueryOptions = {}): QueryResult[] {
        this.queryCount++;
        
        const results: QueryResult[] = [];
        const searchGridPos = this.worldToGrid(searchPos);
        const maxSearchRadius = Math.ceil(radius / this.GRID_SIZE);
        const radiusSqr = radius * radius;
        
        // 在n*3网格中搜索范围内的网格
        for (let dy = -1; dy <= 1; dy++) { // 由于只有3行，最多搜索上下1行
            for (let dx = -maxSearchRadius; dx <= maxSearchRadius; dx++) {
                const gridPos = {
                    x: searchGridPos.x + dx,
                    y: searchGridPos.y + dy
                };
                
                if (!this.isValidGridPosition(gridPos)) {
                    continue;
                }
                
                const entities = this.getEntitiesInGrid(gridPos);
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
        const step = this.GRID_SIZE * 0.5; // 步长为半个网格
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
        const entities = this.getEntitiesInGrid(gridPos);
        
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
        
        this.grids.forEach((entities, gridKey) => {
            const toRemove: GridEntity[] = [];
            
            for (const entity of entities) {
                if (!entity.node || !entity.node.isValid) {
                    toRemove.push(entity);
                    cleanedCount++;
                }
            }
            
            for (const entity of toRemove) {
                entities.delete(entity);
                this.entityToGrid.delete(entity.node.name);
            }
            
            // 如果网格为空，删除网格
            if (entities.size === 0) {
                this.grids.delete(gridKey);
            }
        });
        
        this.entityCount -= cleanedCount;
        
        if (cleanedCount > 0) {
            console.log(`[NbyThreeGrid] 清理了 ${cleanedCount} 个无效实体`);
        }
    }
    
    /**
     * 获取调试信息
     */
    public getDebugInfo(): string {
        return `[NbyThreeGrid] ${this.GRID_COLS}x3网格统计信息:
- 网格数量: ${this.grids.size}
- 实体总数: ${this.entityCount}
- 查询次数: ${this.queryCount}
- 待更新队列: ${this.updateQueue.size}
- 网格大小: ${this.GRID_SIZE.toFixed(1)}px
- 世界大小: ${this.WORLD_WIDTH}x${this.WORLD_HEIGHT}
- 每行高度: ${(this.WORLD_HEIGHT / this.GRID_ROWS).toFixed(1)}px`;
    }
    
    /**
     * 世界坐标转网格坐标
     */
    public worldToGrid(worldPos: Vec3): GridCoordinate {
        // 将世界坐标系转换为网格坐标系
        const gridX = Math.floor((worldPos.x + this.WORLD_WIDTH / 2) / this.GRID_SIZE);
        const gridY = Math.floor((worldPos.y + this.WORLD_HEIGHT / 2) / (this.WORLD_HEIGHT / this.GRID_ROWS));
        
        return {
            x: Math.max(0, Math.min(this.GRID_COLS - 1, gridX)),
            y: Math.max(0, Math.min(this.GRID_ROWS - 1, gridY))
        };
    }
    
    /**
     * 网格坐标转世界坐标（返回网格中心点）
     */
    public gridToWorld(gridPos: GridCoordinate): Vec3 {
        const worldX = (gridPos.x + 0.5) * this.GRID_SIZE - this.WORLD_WIDTH / 2;
        const worldY = (gridPos.y + 0.5) * (this.WORLD_HEIGHT / this.GRID_ROWS) - this.WORLD_HEIGHT / 2;
        
        return new Vec3(worldX, worldY, 0);
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
            rows: this.GRID_ROWS,
            worldWidth: this.WORLD_WIDTH,
            worldHeight: this.WORLD_HEIGHT
        };
    }
    
    // =================== 私有方法 ===================
    
    /**
     * 生成网格键
     */
    private getGridKey(gridPos: GridCoordinate): string {
        return `${gridPos.x},${gridPos.y}`;
    }
    
    /**
     * 检查网格位置是否有效
     */
    private isValidGridPosition(gridPos: GridCoordinate): boolean {
        return gridPos.x >= 0 && gridPos.x < this.GRID_COLS &&
               gridPos.y >= 0 && gridPos.y < this.GRID_ROWS;
    }
    
    /**
     * 获取网格中的实体集合
     */
    private getEntitiesInGrid(gridPos: GridCoordinate): Set<GridEntity> | undefined {
        return this.grids.get(this.getGridKey(gridPos));
    }
    
    /**
     * 添加实体到网格
     */
    private addEntityToGrid(entity: GridEntity, gridPos: GridCoordinate): void {
        const gridKey = this.getGridKey(gridPos);
        
        if (!this.grids.has(gridKey)) {
            this.grids.set(gridKey, new Set());
        }
        
        this.grids.get(gridKey)!.add(entity);
    }
    
    /**
     * 从网格移除实体
     */
    private removeEntityFromGrid(node: Node, gridPos: GridCoordinate): void {
        const entities = this.getEntitiesInGrid(gridPos);
        if (!entities) {
            return;
        }
        
        for (const entity of entities) {
            if (entity.node === node) {
                entities.delete(entity);
                break;
            }
        }
        
        // 如果网格为空，删除网格
        if (entities.size === 0) {
            this.grids.delete(this.getGridKey(gridPos));
        }
    }
    
    /**
     * 处理更新队列
     */
    private flushUpdateQueue(): void {
        for (const nodeName of this.updateQueue) {
            const oldGridPos = this.entityToGrid.get(nodeName);
            if (!oldGridPos) {
                this.updateQueue.delete(nodeName);
                continue;
            }
            
            // 查找对应的节点实体
            const entities = this.getEntitiesInGrid(oldGridPos);
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
            const newGridPos = this.worldToGrid(newWorldPos);
            
            // 如果网格位置发生变化，更新实体位置
            if (oldGridPos.x !== newGridPos.x || oldGridPos.y !== newGridPos.y) {
                // 从旧网格移除
                this.removeEntityFromGrid(targetEntity.node, oldGridPos);
                
                // 更新实体信息
                targetEntity.worldPosition = newWorldPos.clone();
                targetEntity.gridPosition = newGridPos;
                targetEntity.lastUpdateTime = Date.now();
                
                // 添加到新网格
                this.addEntityToGrid(targetEntity, newGridPos);
                this.entityToGrid.set(nodeName, newGridPos);
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
}