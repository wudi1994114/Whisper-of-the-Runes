// assets/scripts/interfaces/IGrid.ts

import { Node, Vec3 } from 'cc';
import { Faction } from '../configs/FactionConfig';

/**
 * 网格坐标接口
 */
export interface GridCoordinate {
    x: number;
    y: number;
}

/**
 * 实体类型枚举
 */
export enum EntityType {
    CHARACTER = 'character',
    PROJECTILE = 'projectile',
    OBSTACLE = 'obstacle',
    ITEM = 'item',
    EFFECT = 'effect'
}

/**
 * 网格实体信息接口
 */
export interface GridEntity {
    node: Node;
    faction: Faction;
    worldPosition: Vec3;
    gridPosition: GridCoordinate;
    entityType: EntityType;
    lastUpdateTime: number;
}

/**
 * 查询选项接口
 */
export interface QueryOptions {
    factions?: Faction[];           // 筛选阵营
    entityTypes?: EntityType[];     // 筛选实体类型
    maxDistance?: number;           // 最大距离
    ignoreEntity?: Node;            // 忽略的实体
    onlyAlive?: boolean;           // 只查找存活的实体
}

/**
 * 查询结果接口
 */
export interface QueryResult {
    entity: GridEntity;
    distance: number;
}

/**
 * 网格系统接口
 * 定义网格系统的核心功能，支持不同的网格实现
 */
export interface IGrid {
    /**
     * 注册实体到网格系统
     * @param node 节点
     * @param faction 阵营
     * @param entityType 实体类型
     */
    registerEntity(node: Node, faction: Faction, entityType: EntityType): void;

    /**
     * 从网格系统移除实体
     * @param node 节点
     */
    unregisterEntity(node: Node): void;

    /**
     * 更新实体位置
     * @param node 节点
     */
    updateEntityPosition(node: Node): void;

    /**
     * 处理更新队列
     * @param deltaTime 时间间隔
     */
    processUpdates(deltaTime: number): void;

    /**
     * 查找最近的实体
     * @param searchPos 搜索位置
     * @param queryOptions 查询选项
     */
    findNearestEntity(searchPos: Vec3, queryOptions?: QueryOptions): QueryResult | null;

    /**
     * 查找范围内的所有实体
     * @param searchPos 搜索位置
     * @param radius 搜索半径
     * @param queryOptions 查询选项
     */
    findEntitiesInRange(searchPos: Vec3, radius: number, queryOptions?: QueryOptions): QueryResult[];

    /**
     * 预测投射物路径上的碰撞
     * @param startPos 起始位置
     * @param direction 方向
     * @param maxDistance 最大距离
     * @param queryOptions 查询选项
     */
    predictCollisionAlongPath(startPos: Vec3, direction: Vec3, maxDistance: number, queryOptions?: QueryOptions): QueryResult | null;

    /**
     * 获取网格内的阵营分布统计
     * @param gridPos 网格位置
     */
    getFactionDistribution(gridPos: GridCoordinate): Map<Faction, number>;

    /**
     * 清理无效实体
     */
    cleanup(): void;

    /**
     * 获取调试信息
     */
    getDebugInfo(): string;

    /**
     * 世界坐标转网格坐标
     * @param worldPos 世界坐标
     */
    worldToGrid(worldPos: Vec3): GridCoordinate;

    /**
     * 网格坐标转世界坐标
     * @param gridPos 网格坐标
     */
    gridToWorld(gridPos: GridCoordinate): Vec3;

    /**
     * 获取网格配置信息
     */
    getGridConfig(): {
        gridSize: number;
        cols: number;
        rows: number;
        worldWidth: number;
        worldHeight: number;
    };
}