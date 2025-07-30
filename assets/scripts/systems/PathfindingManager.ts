import { _decorator, Component, Node, Vec3, Vec2, PhysicsSystem2D, ERaycast2DType } from 'cc';

const { ccclass, property } = _decorator;

/**
 * 网格节点
 */
class GridNode {
    public x: number;
    public y: number;
    public worldX: number;
    public worldY: number;
    public walkable: boolean = true;
    public gCost: number = 0;
    public hCost: number = 0;
    public parent: GridNode | null = null;

    constructor(x: number, y: number, worldX: number, worldY: number, walkable: boolean = true) {
        this.x = x;
        this.y = y;
        this.worldX = worldX;
        this.worldY = worldY;
        this.walkable = walkable;
    }

    public get fCost(): number {
        return this.gCost + this.hCost;
    }

    public equals(other: GridNode): boolean {
        return this.x === other.x && this.y === other.y;
    }

    public reset(): void {
        this.gCost = 0;
        this.hCost = 0;
        this.parent = null;
    }
}

/**
 * 路径信息
 */
export interface PathInfo {
    nodes: Vec3[];
    distance: number;
    smoothed: boolean;
    timestamp: number;
}

/**
 * 寻路请求
 */
interface PathfindingRequest {
    id: string;
    start: Vec3;
    end: Vec3;
    callback: (path: PathInfo | null) => void;
    priority: number;
    timestamp: number;
}

/**
 * A*寻路管理器
 * 特性：
 * 1. 动态网格生成 - 基于场景障碍物自动生成可行走网格
 * 2. A*算法实现 - 经典A*算法，支持对角线移动
 * 3. 路径优化 - 路径平滑、拐点减少、直线优化
 * 4. 性能优化 - 路径缓存、分帧计算、异步处理
 * 5. 动态障碍物 - 支持运行时添加/移除障碍物
 */
@ccclass('PathfindingManager')
export class PathfindingManager extends Component {
    
    // 单例实例
    private static _instance: PathfindingManager | null = null;
    
    @property({
        displayName: "网格大小",
        tooltip: "每个网格单元的大小（像素）"
    })
    public gridSize: number = 32;
    
    @property({
        displayName: "地图宽度",
        tooltip: "地图的像素宽度"
    })
    public mapWidth: number = 2048;
    
    @property({
        displayName: "地图高度", 
        tooltip: "地图的像素高度"
    })
    public mapHeight: number = 2048;
    
    @property({
        displayName: "允许对角线移动",
        tooltip: "是否允许对角线方向移动"
    })
    public allowDiagonal: boolean = true;
    
    @property({
        displayName: "路径缓存时间",
        tooltip: "路径缓存的有效时间（秒）"
    })
    // 【性能优化】增加路径缓存时间从5秒到10秒，减少路径重新计算
    public pathCacheTime: number = 10.0;
    
    @property({
        displayName: "最大计算时间",
        tooltip: "每帧最大计算时间（毫秒）"
    })
    public maxCalculationTimePerFrame: number = 5;
    
    @property({
        displayName: "启用路径平滑",
        tooltip: "是否启用路径平滑优化"
    })
    public enablePathSmoothing: boolean = true;
    
    // 网格数据
    private grid: GridNode[][] = [];
    private gridWidth: number = 0;
    private gridHeight: number = 0;
    
    // 路径缓存
    private pathCache: Map<string, PathInfo> = new Map();
    
    // 异步寻路队列
    private requestQueue: PathfindingRequest[] = [];
    private isProcessing: boolean = false;
    
    // 性能统计
    private performanceStats = {
        totalRequests: 0,
        cacheHits: 0,
        averageCalculationTime: 0,
        lastUpdateTime: 0
    };
    
    protected onLoad(): void {
        PathfindingManager._instance = this;
        console.log(`%c[PathfindingManager] 🗺️ A*寻路管理器已初始化`, 'color: green; font-weight: bold');
        
        // 初始化网格
        this.initializeGrid();
        
        // 开始异步处理队列
        this.schedule(this.processRequestQueue, 0.016); // 60fps
        this.schedule(this.cleanupCache, 1.0); // 每秒清理缓存
    }
    
    protected onDestroy(): void {
        if (PathfindingManager._instance === this) {
            PathfindingManager._instance = null;
        }
        this.grid = [];
        this.pathCache.clear();
        this.requestQueue = [];
        console.log(`%c[PathfindingManager] 🗑️ A*寻路管理器已销毁`, 'color: orange');
    }
    
    /**
     * 获取单例实例
     */
    public static getInstance(): PathfindingManager | null {
        return PathfindingManager._instance;
    }
    
    /**
     * 初始化网格
     */
    private initializeGrid(): void {
        this.gridWidth = Math.ceil(this.mapWidth / this.gridSize);
        this.gridHeight = Math.ceil(this.mapHeight / this.gridSize);
        
        console.log(`%c[PathfindingManager] 🏗️ 初始化网格: ${this.gridWidth}x${this.gridHeight} (${this.gridWidth * this.gridHeight} 个节点)`, 'color: blue');
        
        // 创建网格
        this.grid = [];
        for (let x = 0; x < this.gridWidth; x++) {
            this.grid[x] = [];
            for (let y = 0; y < this.gridHeight; y++) {
                const worldX = x * this.gridSize - this.mapWidth / 2;
                const worldY = y * this.gridSize - this.mapHeight / 2;
                const walkable = this.isPositionWalkable(worldX, worldY);
                
                this.grid[x][y] = new GridNode(x, y, worldX, worldY, walkable);
            }
        }
        
        console.log(`%c[PathfindingManager] ✅ 网格初始化完成`, 'color: green');
    }
    
    /**
     * 检查位置是否可行走（使用射线检测）
     */
    private isPositionWalkable(worldX: number, worldY: number): boolean {
        const checkRadius = this.gridSize * 0.3; // 检测半径
        const checkPoints = [
            new Vec2(worldX, worldY), // 中心点
            new Vec2(worldX - checkRadius, worldY - checkRadius), // 左下
            new Vec2(worldX + checkRadius, worldY - checkRadius), // 右下
            new Vec2(worldX - checkRadius, worldY + checkRadius), // 左上
            new Vec2(worldX + checkRadius, worldY + checkRadius), // 右上
        ];
        
        // 检查所有点是否都没有障碍物
        for (const point of checkPoints) {
            if (this.hasObstacleAtPoint(point)) {
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * 检查指定点是否有障碍物
     */
    private hasObstacleAtPoint(point: Vec2): boolean {
        // 进行小范围射线检测
        const results = PhysicsSystem2D.instance.raycast(
            point, 
            new Vec2(point.x + 1, point.y + 1), 
            ERaycast2DType.All
        );
        
        for (const result of results) {
            const hitNode = result.collider.node;
            if (this.isStaticObstacle(hitNode)) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * 判断节点是否为静态障碍物
     */
    private isStaticObstacle(node: Node): boolean {
        const nodeName = node.name.toLowerCase();
        
        // 静态障碍物命名模式
        if (nodeName.includes('wall') || 
            nodeName.includes('obstacle') || 
            nodeName.includes('barrier') ||
            nodeName.includes('building') ||
            nodeName.includes('rock') ||
            nodeName.includes('tree') ||
            nodeName.includes('static')) {
            return true;
        }
        
        // 检查是否有静态刚体
        const rigidBody = node.getComponent('RigidBody2D') as any;
        if (rigidBody && rigidBody.type === 0) { // Static类型
            return true;
        }
        
        return false;
    }
    
    /**
     * 请求寻路（异步）
     */
    public requestPath(start: Vec3, end: Vec3, callback: (path: PathInfo | null) => void, priority: number = 0): string {
        const requestId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // 检查缓存
        const cacheKey = this.getCacheKey(start, end);
        const cachedPath = this.pathCache.get(cacheKey);
        
        if (cachedPath && Date.now() / 1000 - cachedPath.timestamp < this.pathCacheTime) {
            this.performanceStats.cacheHits++;
            console.log(`%c[PathfindingManager] 💾 缓存命中: ${cacheKey}`, 'color: cyan');
            callback(cachedPath);
            return requestId;
        }
        
        // 添加到队列
        this.requestQueue.push({
            id: requestId,
            start: start.clone(),
            end: end.clone(),
            callback: callback,
            priority: priority,
            timestamp: Date.now()
        });
        
        // 按优先级排序
        this.requestQueue.sort((a, b) => b.priority - a.priority);
        
        this.performanceStats.totalRequests++;
        console.log(`%c[PathfindingManager] 📋 寻路请求已加入队列: ${requestId} (优先级: ${priority})`, 'color: blue');
        
        return requestId;
    }
    
    /**
     * 同步寻路（立即计算）
     */
    public findPathSync(start: Vec3, end: Vec3): PathInfo | null {
        const startTime = Date.now();
        
        // 检查缓存
        const cacheKey = this.getCacheKey(start, end);
        const cachedPath = this.pathCache.get(cacheKey);
        
        if (cachedPath && Date.now() / 1000 - cachedPath.timestamp < this.pathCacheTime) {
            this.performanceStats.cacheHits++;
            return cachedPath;
        }
        
        // 计算路径
        const path = this.calculatePath(start, end);
        const calculationTime = Date.now() - startTime;
        
        // 更新性能统计
        this.updatePerformanceStats(calculationTime);
        
        if (path) {
            // 缓存路径
            this.pathCache.set(cacheKey, path);
            console.log(`%c[PathfindingManager] 🎯 路径计算完成: ${path.nodes.length} 个节点, 耗时 ${calculationTime}ms`, 'color: green');
        } else {
            console.warn(`%c[PathfindingManager] ❌ 路径计算失败`, 'color: red');
        }
        
        return path;
    }
    
    /**
     * 处理异步请求队列
     */
    private processRequestQueue(): void {
        if (this.isProcessing || this.requestQueue.length === 0) {
            return;
        }
        
        this.isProcessing = true;
        const startTime = Date.now();
        
        while (this.requestQueue.length > 0 && Date.now() - startTime < this.maxCalculationTimePerFrame) {
            const request = this.requestQueue.shift()!;
            
            // 检查请求是否过期（超过10秒）
            if (Date.now() - request.timestamp > 10000) {
                console.warn(`%c[PathfindingManager] ⏰ 请求过期: ${request.id}`, 'color: orange');
                request.callback(null);
                continue;
            }
            
            const path = this.calculatePath(request.start, request.end);
            
            if (path) {
                // 缓存路径
                const cacheKey = this.getCacheKey(request.start, request.end);
                this.pathCache.set(cacheKey, path);
            }
            
            request.callback(path);
        }
        
        this.isProcessing = false;
    }
    
    /**
     * 计算路径（A*算法）
     */
    private calculatePath(start: Vec3, end: Vec3): PathInfo | null {
        const startNode = this.getNodeFromWorldPosition(start);
        const endNode = this.getNodeFromWorldPosition(end);
        
        if (!startNode || !endNode) {
            console.warn(`%c[PathfindingManager] ⚠️ 起点或终点超出网格范围`, 'color: orange');
            return null;
        }
        
        if (!startNode.walkable || !endNode.walkable) {
            console.warn(`%c[PathfindingManager] 🚫 起点或终点不可行走`, 'color: orange');
            return null;
        }
        
        // 重置所有节点
        this.resetGrid();
        
        const openSet: GridNode[] = [];
        const closedSet: Set<GridNode> = new Set();
        
        openSet.push(startNode);
        
        while (openSet.length > 0) {
            // 找到F值最小的节点
            let currentNode = openSet[0];
            for (let i = 1; i < openSet.length; i++) {
                if (openSet[i].fCost < currentNode.fCost || 
                   (openSet[i].fCost === currentNode.fCost && openSet[i].hCost < currentNode.hCost)) {
                    currentNode = openSet[i];
                }
            }
            
            // 移除当前节点
            const index = openSet.indexOf(currentNode);
            openSet.splice(index, 1);
            closedSet.add(currentNode);
            
            // 检查是否到达目标
            if (currentNode.equals(endNode)) {
                return this.constructPath(startNode, endNode);
            }
            
            // 检查邻居
            const neighbors = this.getNeighbors(currentNode);
            for (const neighbor of neighbors) {
                if (!neighbor.walkable || closedSet.has(neighbor)) {
                    continue;
                }
                
                const newCostToNeighbor = currentNode.gCost + this.getDistance(currentNode, neighbor);
                
                if (newCostToNeighbor < neighbor.gCost || openSet.indexOf(neighbor) === -1) {
                    neighbor.gCost = newCostToNeighbor;
                    neighbor.hCost = this.getDistance(neighbor, endNode);
                    neighbor.parent = currentNode;
                    
                    if (openSet.indexOf(neighbor) === -1) {
                        openSet.push(neighbor);
                    }
                }
            }
        }
        
        // 未找到路径
        return null;
    }
    
    /**
     * 构建路径
     */
    private constructPath(startNode: GridNode, endNode: GridNode): PathInfo {
        const path: Vec3[] = [];
        let currentNode: GridNode | null = endNode;
        let totalDistance = 0;
        
        // 回溯构建路径
        while (currentNode !== null) {
            path.unshift(new Vec3(currentNode.worldX, currentNode.worldY, 0));
            
            if (currentNode.parent) {
                totalDistance += this.getDistance(currentNode, currentNode.parent);
            }
            
            currentNode = currentNode.parent;
        }
        
        // 路径优化
        let smoothed = false;
        if (this.enablePathSmoothing && path.length > 2) {
            this.smoothPath(path);
            smoothed = true;
        }
        
        return {
            nodes: path,
            distance: totalDistance,
            smoothed: smoothed,
            timestamp: Date.now() / 1000
        };
    }
    
    /**
     * 路径平滑优化
     */
    private smoothPath(path: Vec3[]): void {
        if (path.length <= 2) return;
        
        let i = 0;
        while (i < path.length - 2) {
            const start = path[i];
            const end = path[i + 2];
            
            // 检查是否可以直接连接
            if (this.hasDirectPath(start, end)) {
                // 移除中间节点
                path.splice(i + 1, 1);
            } else {
                i++;
            }
        }
    }
    
    /**
     * 检查两点之间是否有直接路径
     */
    private hasDirectPath(start: Vec3, end: Vec3): boolean {
        const distance = Vec3.distance(start, end);
        const steps = Math.ceil(distance / (this.gridSize * 0.5));
        
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const checkPoint = new Vec3(
                start.x + (end.x - start.x) * t,
                start.y + (end.y - start.y) * t,
                0
            );
            
            const node = this.getNodeFromWorldPosition(checkPoint);
            if (!node || !node.walkable) {
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * 获取邻居节点
     */
    private getNeighbors(node: GridNode): GridNode[] {
        const neighbors: GridNode[] = [];
        
        // 8方向邻居
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (dx === 0 && dy === 0) continue;
                
                // 如果不允许对角线移动，跳过对角线方向
                if (!this.allowDiagonal && dx !== 0 && dy !== 0) continue;
                
                const checkX = node.x + dx;
                const checkY = node.y + dy;
                
                if (checkX >= 0 && checkX < this.gridWidth && checkY >= 0 && checkY < this.gridHeight) {
                    neighbors.push(this.grid[checkX][checkY]);
                }
            }
        }
        
        return neighbors;
    }
    
    /**
     * 计算两个节点之间的距离
     */
    private getDistance(nodeA: GridNode, nodeB: GridNode): number {
        const dstX = Math.abs(nodeA.x - nodeB.x);
        const dstY = Math.abs(nodeA.y - nodeB.y);
        
        if (dstX > dstY) {
            return 14 * dstY + 10 * (dstX - dstY); // 对角线 + 直线
        } else {
            return 14 * dstX + 10 * (dstY - dstX); // 对角线 + 直线
        }
    }
    
    /**
     * 从世界坐标获取网格节点
     */
    private getNodeFromWorldPosition(worldPos: Vec3): GridNode | null {
        const x = Math.floor((worldPos.x + this.mapWidth / 2) / this.gridSize);
        const y = Math.floor((worldPos.y + this.mapHeight / 2) / this.gridSize);
        
        if (x >= 0 && x < this.gridWidth && y >= 0 && y < this.gridHeight) {
            return this.grid[x][y];
        }
        
        return null;
    }
    
    /**
     * 重置网格状态
     */
    private resetGrid(): void {
        for (let x = 0; x < this.gridWidth; x++) {
            for (let y = 0; y < this.gridHeight; y++) {
                this.grid[x][y].reset();
            }
        }
    }
    
    /**
     * 生成缓存键
     */
    private getCacheKey(start: Vec3, end: Vec3): string {
        return `${start.x.toFixed(1)},${start.y.toFixed(1)}-${end.x.toFixed(1)},${end.y.toFixed(1)}`;
    }
    
    /**
     * 清理过期缓存
     */
    private cleanupCache(): void {
        const currentTime = Date.now() / 1000;
        const expiredKeys: string[] = [];
        
        for (const [key, pathInfo] of this.pathCache) {
            if (currentTime - pathInfo.timestamp > this.pathCacheTime) {
                expiredKeys.push(key);
            }
        }
        
        for (const key of expiredKeys) {
            this.pathCache.delete(key);
        }
        
        if (expiredKeys.length > 0) {
            console.log(`%c[PathfindingManager] 🧹 清理过期路径缓存: ${expiredKeys.length} 个`, 'color: gray');
        }
    }
    
    /**
     * 更新性能统计
     */
    private updatePerformanceStats(calculationTime: number): void {
        const alpha = 0.1; // 平滑因子
        this.performanceStats.averageCalculationTime = 
            this.performanceStats.averageCalculationTime * (1 - alpha) + calculationTime * alpha;
        this.performanceStats.lastUpdateTime = Date.now() / 1000;
    }
    
    /**
     * 动态更新障碍物
     */
    public updateObstacle(worldPos: Vec3, isWalkable: boolean): void {
        const node = this.getNodeFromWorldPosition(worldPos);
        if (node) {
            node.walkable = isWalkable;
            
            // 清理相关缓存
            this.clearCacheAroundPosition(worldPos);
            
            console.log(`%c[PathfindingManager] 🔄 更新障碍物: (${worldPos.x}, ${worldPos.y}) -> ${isWalkable ? '可行走' : '不可行走'}`, 'color: yellow');
        }
    }
    
    /**
     * 清理指定位置周围的缓存
     */
    private clearCacheAroundPosition(worldPos: Vec3): void {
        const radius = this.gridSize * 3; // 清理半径
        const expiredKeys: string[] = [];
        
        for (const [key, pathInfo] of this.pathCache) {
            // 检查路径是否经过该区域
            for (const pathNode of pathInfo.nodes) {
                if (Vec3.distance(pathNode, worldPos) < radius) {
                    expiredKeys.push(key);
                    break;
                }
            }
        }
        
        for (const key of expiredKeys) {
            this.pathCache.delete(key);
        }
        
        if (expiredKeys.length > 0) {
            console.log(`%c[PathfindingManager] 🗑️ 清理受影响的路径缓存: ${expiredKeys.length} 个`, 'color: orange');
        }
    }
    
    /**
     * 获取性能统计
     */
    public getPerformanceStats() {
        return {
            ...this.performanceStats,
            cacheSize: this.pathCache.size,
            queueSize: this.requestQueue.length,
            gridSize: this.gridWidth * this.gridHeight,
            cacheHitRate: this.performanceStats.totalRequests > 0 ? 
                (this.performanceStats.cacheHits / this.performanceStats.totalRequests * 100).toFixed(1) + '%' : '0%'
        };
    }
    
    /**
     * 打印调试信息
     */
    public printDebugInfo(): void {
        const stats = this.getPerformanceStats();
        console.log(`%c[PathfindingManager] 📊 A*寻路系统状态:`, 'color: green; font-weight: bold');
        console.log(`%c[PathfindingManager] 🗺️ 网格大小: ${this.gridWidth}x${this.gridHeight} (${stats.gridSize} 个节点)`, 'color: blue');
        console.log(`%c[PathfindingManager] 📋 请求统计: 总计=${stats.totalRequests}, 缓存命中=${stats.cacheHits}, 命中率=${stats.cacheHitRate}`, 'color: cyan');
        console.log(`%c[PathfindingManager] ⏱️ 性能: 平均计算时间=${stats.averageCalculationTime.toFixed(2)}ms, 队列长度=${stats.queueSize}`, 'color: purple');
        console.log(`%c[PathfindingManager] 💾 缓存: ${stats.cacheSize} 个路径`, 'color: orange');
    }
}

// 导出单例访问器
export const pathfindingManager = {
    getInstance: (): PathfindingManager | null => PathfindingManager.getInstance()
}; 