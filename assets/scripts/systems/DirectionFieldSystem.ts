// assets/scripts/systems/DirectionFieldSystem.ts

import { Vec3 } from 'cc';
import { FlowDirection } from './FlowDirection';
import { OneDimensionalGrid } from './OneDimensionalGrid';
import { Faction } from '../configs/FactionConfig';
import { GridEntity, EntityType } from '../interfaces/IGrid';

/**
 * 方向场系统 - 实现用户指定的核心算法
 * 为每一列提供LEFT或RIGHT的方向建议，用于智能移动决策
 */
export class DirectionFieldSystem {
    // 方向场数据 - 核心的一维数组
    private directionField: FlowDirection[] = [];
    
    // 关联的一维网格系统
    private oneDGrid: OneDimensionalGrid;
    
    // 阵营配置
    private ownerFaction: Faction;      // 使用此方向场的阵营
    private targetFaction: Faction;     // 要走向的目标阵营
    
    // 更新控制
    private readonly UPDATE_INTERVAL = 1.0;  // 1秒更新一次，性能开销极低
    private lastUpdateTime = 0;
    
    // 统计信息
    private updateCount = 0;
    private lastAnalysisResult: string = '';
    
    /**
     * 构造函数
     * @param oneDGrid 关联的一维网格系统
     * @param ownerFaction 使用此方向场的阵营
     * @param targetFaction 要走向的目标阵营
     */
    public constructor(oneDGrid: OneDimensionalGrid, ownerFaction: Faction, targetFaction: Faction) {
        this.oneDGrid = oneDGrid;
        this.ownerFaction = ownerFaction;
        this.targetFaction = targetFaction;
        const gridConfig = oneDGrid.getGridConfig();
        
        // 初始化方向场数组
        this.directionField = new Array(gridConfig.cols).fill(FlowDirection.RIGHT);
        
        console.log(`[DirectionFieldSystem] 初始化方向场系统: ${ownerFaction} -> ${targetFaction}，列数: ${gridConfig.cols}`);
        console.log(`[DirectionFieldSystem] 更新间隔: ${this.UPDATE_INTERVAL}秒`);
    }
    
    /**
     * 获取阵营信息
     */
    public getOwnerFaction(): Faction {
        return this.ownerFaction;
    }
    
    public getTargetFaction(): Faction {
        return this.targetFaction;
    }
    
    /**
     * 系统更新 - 在游戏主循环中调用
     */
    public update(deltaTime: number): void {
        this.lastUpdateTime += deltaTime;
        
        if (this.lastUpdateTime >= this.UPDATE_INTERVAL) {
            this.updateDirectionField();
            this.lastUpdateTime = 0;
        }
    }
    
    /**
     * 核心算法：更新方向场 - 用户指定的精确实现
     * 
     * 算法逻辑：
     * 1. 遍历战场中的每一"列"
     * 2. 对每一个目标阵营的敌人，判断其相对当前列的位置
     * 3. 根据左右敌人数量，决定这一列的移动方向
     */
    public updateDirectionField(): void {
        // 🎯 关键修改：只获取targetFaction的敌人，这样red方向场会寻找blue，blue方向场会寻找red
        const targetEnemies = this.oneDGrid.getAllEnemies([]).filter(entity => entity.faction === this.targetFaction);
        const gridConfig = this.oneDGrid.getGridConfig();
        
        console.log(`[DirectionFieldSystem ${this.ownerFaction}] 开始更新方向场，目标阵营 ${this.targetFaction} 敌人数量: ${targetEnemies.length}`);
        
        // 遍历战场中的每一"列" (用户指定的算法第一步)
        for (let x = 0; x < gridConfig.cols; x++) {
            let enemiesOnLeft = 0;
            let enemiesOnRight = 0;
            
            // 对每一个目标阵营的敌人，判断其相对当前列的位置 (用户指定的算法第二步)
            for (const enemy of targetEnemies) {
                const enemyCol = this.oneDGrid.worldToGridCol(enemy.worldPosition);
                
                if (enemyCol < x) {
                    enemiesOnLeft++;
                } else if (enemyCol > x) {
                    enemiesOnRight++;
                }
                // 注意：enemyCol === x 的情况不计入左右，这样可以避免自己影响自己
            }
            
            // 根据左右敌人数量，决定这一列的移动方向 (用户指定的算法第三步)
            if (enemiesOnRight > enemiesOnLeft) {
                this.directionField[x] = FlowDirection.RIGHT; // 右边敌人多，向右压制
            } else {
                this.directionField[x] = FlowDirection.LEFT;  // 左边敌人多，向左压制（包括势均力敌的情况）
            }
        }
        
        this.updateCount++;
        this.logAnalysisResult(allEnemies, gridConfig.cols);
        
        console.log(`[DirectionFieldSystem] 方向场更新完成，第${this.updateCount}次更新`);
    }
    
    /**
     * 获取指定列的方向建议
     * @param col 列号
     * @returns 方向建议
     */
    public getDirectionForColumn(col: number): FlowDirection {
        const gridConfig = this.oneDGrid.getGridConfig();
        
        // 边界检查
        if (col < 0 || col >= gridConfig.cols) {
            console.warn(`[DirectionFieldSystem] 列号${col}超出范围[0, ${gridConfig.cols-1}]，返回默认方向RIGHT`);
            return FlowDirection.RIGHT;
        }
        
        return this.directionField[col];
    }
    
    /**
     * 获取指定世界位置的方向建议
     * @param worldPos 世界坐标
     * @returns 方向建议
     */
    public getDirectionForPosition(worldPos: Vec3): FlowDirection {
        const col = this.oneDGrid.worldToGridCol(worldPos);
        return this.getDirectionForColumn(col);
    }
    
    /**
     * 获取整个方向场的快照（用于调试和可视化）
     */
    public getDirectionFieldSnapshot(): FlowDirection[] {
        return [...this.directionField]; // 返回副本，避免外部修改
    }
    
    /**
     * 分析特定区域的敌人分布
     * @param centerCol 中心列
     * @param radius 分析半径（列数）
     */
    public analyzeEnemyDistribution(centerCol: number, radius: number = 5): {
        leftCount: number;
        rightCount: number;
        centerCount: number;
        recommendation: FlowDirection;
    } {
        const targetEnemies = this.oneDGrid.getAllEnemies([]).filter(entity => entity.faction === this.targetFaction);
        
        let leftCount = 0;
        let rightCount = 0;
        let centerCount = 0;
        
        for (const enemy of targetEnemies) {
            const enemyCol = this.oneDGrid.worldToGridCol(enemy.worldPosition);
            
            if (Math.abs(enemyCol - centerCol) <= radius) {
                if (enemyCol < centerCol) {
                    leftCount++;
                } else if (enemyCol > centerCol) {
                    rightCount++;
                } else {
                    centerCount++;
                }
            }
        }
        
        const recommendation = rightCount > leftCount ? FlowDirection.RIGHT : FlowDirection.LEFT;
        
        return {
            leftCount,
            rightCount,
            centerCount,
            recommendation
        };
    }
    
    /**
     * 检测是否有渗透者（后方出现敌人）
     * 这是方向场算法的内在逻辑体现
     */
    public detectPenetrators(): {
        hasPenetrators: boolean;
        penetratorColumns: number[];
        affectedColumns: number[];
    } {
        const targetEnemies = this.oneDGrid.getAllEnemies([]).filter(entity => entity.faction === this.targetFaction);
        const gridConfig = this.oneDGrid.getGridConfig();
        
        // 假设玩家主要在右侧，检测左侧（后方）是否有敌人
        const rearThreshold = Math.floor(gridConfig.cols * 0.3); // 前30%区域视为后方
        
        const penetratorColumns: number[] = [];
        const affectedColumns: number[] = [];
        
        for (const enemy of targetEnemies) {
            const enemyCol = this.oneDGrid.worldToGridCol(enemy.worldPosition);
            
            if (enemyCol < rearThreshold) {
                penetratorColumns.push(enemyCol);
                
                // 分析受影响的列：后方单位应该转向LEFT迎敌
                for (let col = enemyCol; col < rearThreshold + 5; col++) {
                    if (col >= 0 && col < gridConfig.cols && !affectedColumns.includes(col)) {
                        affectedColumns.push(col);
                    }
                }
            }
        }
        
        return {
            hasPenetrators: penetratorColumns.length > 0,
            penetratorColumns,
            affectedColumns
        };
    }
    
    /**
     * 强制更新方向场（用于测试或特殊情况）
     */
    public forceUpdate(): void {
        this.updateDirectionField();
        console.log(`[DirectionFieldSystem] 强制更新方向场完成`);
    }
    
    /**
     * 获取调试信息
     */
    public getDebugInfo(): string {
        const gridConfig = this.oneDGrid.getGridConfig();
        const leftCount = this.directionField.filter(dir => dir === FlowDirection.LEFT).length;
        const rightCount = this.directionField.filter(dir => dir === FlowDirection.RIGHT).length;
        
        return `[DirectionFieldSystem] 方向场统计信息:
- 总列数: ${gridConfig.cols}
- LEFT方向列数: ${leftCount}
- RIGHT方向列数: ${rightCount}
- 更新次数: ${this.updateCount}
- 更新间隔: ${this.UPDATE_INTERVAL}秒
- 最后分析: ${this.lastAnalysisResult}`;
    }
    
    /**
     * 获取方向场的文本可视化
     * @param startCol 起始列（可选，用于显示部分区域）
     * @param endCol 结束列（可选，用于显示部分区域）
     */
    public getVisualization(startCol: number = 0, endCol?: number): string {
        const gridConfig = this.oneDGrid.getGridConfig();
        const actualEndCol = endCol || gridConfig.cols - 1;
        
        let visualization = '[DirectionFieldSystem] 方向场可视化:\n';
        visualization += '列号: ';
        
        for (let col = startCol; col <= actualEndCol && col < gridConfig.cols; col++) {
            visualization += col.toString().padStart(3);
        }
        
        visualization += '\n方向: ';
        
        for (let col = startCol; col <= actualEndCol && col < gridConfig.cols; col++) {
            const symbol = this.directionField[col] === FlowDirection.LEFT ? ' ←' : ' →';
            visualization += symbol + ' ';
        }
        
        return visualization;
    }
    
    // =================== 私有方法 ===================
    
    /**
     * 记录分析结果
     */
    private logAnalysisResult(allEnemies: GridEntity[], totalCols: number): void {
        if (allEnemies.length === 0) {
            this.lastAnalysisResult = '无敌人，所有列保持当前方向';
            return;
        }
        
        const leftCols = this.directionField.filter(dir => dir === FlowDirection.LEFT).length;
        const rightCols = this.directionField.filter(dir => dir === FlowDirection.RIGHT).length;
        
        this.lastAnalysisResult = `分析${allEnemies.length}个敌人，${leftCols}列向左，${rightCols}列向右`;
        
        // 详细日志（开发模式下）
        if (console.log) {
            console.log(`[DirectionFieldSystem] ${this.lastAnalysisResult}`);
            
            // 显示部分方向场状态
            if (totalCols <= 20) {
                console.log(this.getVisualization());
            } else {
                console.log(this.getVisualization(0, 9)); // 只显示前10列
            }
        }
    }
}