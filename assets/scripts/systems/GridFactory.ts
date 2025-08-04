// assets/scripts/systems/GridFactory.ts

import { IGrid } from '../interfaces/IGrid';
import { GridSystem } from './GridSystem';
import { NbyThreeGrid } from './NbyThreeGrid';

/**
 * 网格类型枚举
 */
export enum GridType {
    STANDARD = 'standard',      // 标准固定网格
    N_BY_THREE = 'nByThree'     // n*3形式网格
}

/**
 * 网格配置接口
 */
export interface GridConfig {
    type: GridType;
    cols?: number;              // 列数（对于n*3网格）
    worldWidth?: number;        // 世界宽度
    worldHeight?: number;       // 世界高度
}

/**
 * 网格系统工厂
 * 统一创建和管理不同类型的网格系统
 */
export class GridFactory {
    private static activeGrid: IGrid | null = null;
    private static currentConfig: GridConfig | null = null;

    /**
     * 创建网格系统
     * @param config 网格配置
     * @returns 网格系统实例
     */
    public static createGrid(config: GridConfig): IGrid {
        // 如果已有活跃网格且配置相同，直接返回
        if (GridFactory.activeGrid && GridFactory.isSameConfig(config)) {
            return GridFactory.activeGrid;
        }

        // 清理旧的网格系统
        if (GridFactory.activeGrid) {
            GridFactory.activeGrid.cleanup();
        }

        let grid: IGrid;

        switch (config.type) {
            case GridType.STANDARD:
                grid = GridSystem.getInstance();
                console.log('[GridFactory] 创建标准网格系统');
                break;

            case GridType.N_BY_THREE:
                // 重置n*3网格实例以创建新配置
                NbyThreeGrid.resetInstance();
                grid = NbyThreeGrid.getInstance(
                    config.cols || 30,
                    config.worldWidth || 1920,
                    config.worldHeight || 1080
                );
                console.log(`[GridFactory] 创建${config.cols || 30}x3网格系统`);
                break;

            default:
                throw new Error(`不支持的网格类型: ${config.type}`);
        }

        GridFactory.activeGrid = grid;
        GridFactory.currentConfig = { ...config };

        return grid;
    }

    /**
     * 获取当前网格配置
     */
    public static getCurrentConfig(): GridConfig | null {
        return GridFactory.currentConfig ? { ...GridFactory.currentConfig } : null;
    }

    /**
     * 销毁当前网格系统
     */
    public static destroyGrid(): void {
        if (GridFactory.activeGrid) {
            GridFactory.activeGrid.cleanup();
            GridFactory.activeGrid = null;
            GridFactory.currentConfig = null;
            console.log('[GridFactory] 已销毁网格系统');
        }
    }

    /**
     * 创建预设网格配置
     */
    public static createPresetConfigs() {
        return {
            // 标准网格（适合复杂战斗场景）
            standard: (): GridConfig => ({
                type: GridType.STANDARD
            }),

            // 小型横向网格（适合横版游戏）
            smallHorizontal: (): GridConfig => ({
                type: GridType.N_BY_THREE,
                cols: 20,
                worldWidth: 1920,
                worldHeight: 1080
            }),

            // 中型横向网格（适合中等规模战斗）
            mediumHorizontal: (): GridConfig => ({
                type: GridType.N_BY_THREE,
                cols: 30,
                worldWidth: 1920,
                worldHeight: 1080
            }),

            // 大型横向网格（适合大规模战斗）
            largeHorizontal: (): GridConfig => ({
                type: GridType.N_BY_THREE,
                cols: 50,
                worldWidth: 1920,
                worldHeight: 1080
            }),

            // 超宽横向网格（适合无限横版游戏）
            ultraWideHorizontal: (): GridConfig => ({
                type: GridType.N_BY_THREE,
                cols: 100,
                worldWidth: 3840,
                worldHeight: 1080
            })
        };
    }

    // =================== 私有方法 ===================

    /**
     * 检查配置是否相同
     */
    private static isSameConfig(config: GridConfig): boolean {
        if (!GridFactory.currentConfig) {
            return false;
        }

        return GridFactory.currentConfig.type === config.type &&
            GridFactory.currentConfig.cols === config.cols &&
            GridFactory.currentConfig.worldWidth === config.worldWidth &&
            GridFactory.currentConfig.worldHeight === config.worldHeight;
    }
}

// 导出预设配置助手
export const GridPresets = GridFactory.createPresetConfigs();