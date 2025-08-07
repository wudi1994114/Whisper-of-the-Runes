// assets/scripts/systems/DirectionFieldSystem.ts

import { Vec3 } from 'cc';
import { FlowDirection } from './FlowDirection';
import { OneDimensionalGrid } from './OneDimensionalGrid';
import { Faction } from '../configs/FactionConfig';
import { GridEntity, EntityType } from '../interfaces/IGrid';

/**
 * 简化方向场系统 - 全局单一方向
 * 每个阵营有一个固定的移动方向，不需要复杂的网格计算
 */
export class DirectionFieldSystem {
    // 简化为全局方向标志位
    private globalDirection: FlowDirection;
    
    // 阵营配置
    private ownerFaction: Faction;      // 使用此方向场的阵营
    private targetFaction: Faction;     // 要走向的目标阵营
    
    // 更新控制（保留以兼容现有接口）
    private readonly UPDATE_INTERVAL = 1.0;
    private lastUpdateTime = 0;
    
    // 统计信息
    private updateCount = 0;
    private lastAnalysisResult: string = '';
    
    /**
     * 构造函数
     * @param oneDGrid 关联的一维网格系统（保留以兼容现有接口）
     * @param ownerFaction 使用此方向场的阵营
     * @param targetFaction 要走向的目标阵营
     */
    public constructor(oneDGrid: OneDimensionalGrid, ownerFaction: Faction, targetFaction: Faction) {
        this.ownerFaction = ownerFaction;
        this.targetFaction = targetFaction;
        
        // 🎯 简化逻辑：根据阵营设置固定的全局方向
        this.globalDirection = this.calculateGlobalDirection(ownerFaction, targetFaction);
        
        console.log(`[DirectionFieldSystem] 初始化简化方向场系统: ${ownerFaction} -> ${targetFaction}`);
        console.log(`[DirectionFieldSystem] 全局方向: ${this.globalDirection}`);
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
     * 计算全局移动方向
     * @param ownerFaction 使用方向场的阵营
     * @param targetFaction 目标阵营
     */
    private calculateGlobalDirection(ownerFaction: Faction, targetFaction: Faction): FlowDirection {
        // 🎯 修复方向逻辑：
        // - 红色阵营向右移动（攻击蓝色）
        // - 蓝色阵营向左移动（攻击红色）
        // - 其他阵营根据目标阵营决定
        
        console.log(`[DirectionFieldSystem] 计算方向: ${ownerFaction} -> ${targetFaction}`);
        
        if (ownerFaction === Faction.RED && targetFaction === Faction.BLUE) {
            console.log(`[DirectionFieldSystem] 红色阵营向右攻击蓝色`);
            return FlowDirection.RIGHT;
        } else if (ownerFaction === Faction.BLUE && targetFaction === Faction.RED) {
            console.log(`[DirectionFieldSystem] 蓝色阵营向左攻击红色`);
            return FlowDirection.LEFT;
        } else if (ownerFaction === Faction.PLAYER) {
            // 玩家阵营根据目标决定
            const direction = targetFaction === Faction.RED ? FlowDirection.LEFT : FlowDirection.RIGHT;
            console.log(`[DirectionFieldSystem] 玩家阵营方向: ${direction}`);
            return direction;
        } else {
            // 默认向右
            console.log(`[DirectionFieldSystem] 默认方向: RIGHT`);
            return FlowDirection.RIGHT;
        }
    }
    
    /**
     * 更新方向场（简化版本）
     */
    public update(deltaTime: number): void {
        // 🎯 简化版本：方向是固定的，不需要复杂更新
        this.lastUpdateTime += deltaTime;
        
        if (this.lastUpdateTime >= this.UPDATE_INTERVAL) {
            this.updateCount++;
            this.lastAnalysisResult = `全局方向: ${this.globalDirection}`;
            this.lastUpdateTime = 0;
        }
    }
    
    /**
     * 获取指定列的方向建议（简化版本）
     * @param col 列号（保留参数以兼容现有接口）
     * @returns 全局方向
     */
    public getDirectionForColumn(col: number): FlowDirection {
        // 🎯 简化：所有列都返回相同的全局方向
        return this.globalDirection;
    }
    
    /**
     * 获取指定世界位置的方向建议（简化版本）
     * @param worldPos 世界坐标（保留参数以兼容现有接口）
     * @returns 全局方向
     */
    public getDirectionForPosition(worldPos: Vec3): FlowDirection {
        // 🎯 简化：所有位置都返回相同的全局方向
        return this.globalDirection;
    }
    
    /**
     * 获取整个方向场的快照（简化版本）
     */
    public getDirectionFieldSnapshot(): FlowDirection[] {
        // 🎯 简化版本：返回包含单一全局方向的数组（兼容现有接口）
        return new Array(30).fill(this.globalDirection);
    }
    
    /**
     * 获取方向场的文本可视化（简化版本）
     * @param startCol 起始列（保留参数以兼容现有接口）
     * @param endCol 结束列（保留参数以兼容现有接口）
     */
    public getVisualization(startCol: number = 0, endCol?: number): string {
        const actualEndCol = endCol || 29; // 默认显示30列
        const symbol = this.globalDirection === FlowDirection.LEFT ? ' ←' : ' →';
        
        let visualization = `[DirectionFieldSystem] 简化方向场可视化 (全局方向: ${this.globalDirection}):\n`;
        visualization += '列号: ';
        
        for (let col = startCol; col <= actualEndCol; col++) {
            visualization += col.toString().padStart(3);
        }
        
        visualization += '\n方向: ';
        
        for (let col = startCol; col <= actualEndCol; col++) {
            visualization += symbol + ' ';
        }
        
        return visualization;
    }
    
    /**
     * 获取调试信息
     */
    public getDebugInfo(): string {
        return `[DirectionFieldSystem] 简化方向场调试信息:
- 所属阵营: ${this.ownerFaction}
- 目标阵营: ${this.targetFaction}
- 全局方向: ${this.globalDirection}
- 更新次数: ${this.updateCount}
- 最后分析: ${this.lastAnalysisResult}`;
    }
    
    /**
     * 强制更新方向场（简化版本）
     */
    public forceUpdate(): void {
        this.updateCount++;
        this.lastAnalysisResult = `强制更新 - 全局方向: ${this.globalDirection}`;
        console.log(`[DirectionFieldSystem] 简化强制更新完成，方向: ${this.globalDirection}`);
    }
}