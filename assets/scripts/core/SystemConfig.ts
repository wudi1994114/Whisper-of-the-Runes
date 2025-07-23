// assets/scripts/core/SystemConfig.ts

import { _decorator } from 'cc';

const { ccclass } = _decorator;

/**
 * 伤害文字池配置
 */
export interface DamageTextPoolConfig {
    minDamage: number;           // 最小伤害值
    maxDamage: number;           // 最大伤害值
    nodesPerDamage: number;      // 每个伤害值的节点数
    batchSize: number;           // 批处理大小
    enableBatchLoading: boolean; // 是否启用分批加载
    preloadRangeStart: number;   // 预加载范围开始
    preloadRangeEnd: number;     // 预加载范围结束
}

/**
 * 血条配置
 * 支持固定像素值和按比例配置两种模式
 * 优先级：具体数值 > 比例配置
 */
export interface HealthBarConfig {
    // === 固定像素值配置（优先级最高） ===
    width?: number;              // 血条宽度（像素值，如果设置则优先使用）
    height?: number;             // 血条高度（像素值，如果设置则优先使用）
    offsetY?: number;            // Y轴偏移（像素值，如果设置则优先使用）
    
    // === 按比例配置（作为后备方案） ===
    widthRatio?: number;         // 血条宽度比例（基于角色宽度，默认0.3）
    heightRatio?: number;        // 血条高度比例（暂时保留，目前固定使用height值）
    offsetYRatio?: number;       // Y轴偏移比例（基于角色高度，默认0.4）
}

/**
 * 角色血条配置映射
 */
export interface CharacterHealthBarConfigs {
    lich: HealthBarConfig;       // 巫妖血条配置（也作为其他类型的默认配置）
    ent: HealthBarConfig;        // 树精血条配置
    default: HealthBarConfig;    // 系统默认配置（保留兼容性）
}

/**
 * 对象池系统配置
 */
export interface PoolSystemConfig {
    damageTextPool: DamageTextPoolConfig;
    healthBars: CharacterHealthBarConfigs;
    cleanupInterval: number;     // 清理间隔（毫秒）
    maxPoolSize: number;         // 默认池最大大小
    preloadCount: number;        // 默认预加载数量
}

/**
 * 系统级配置
 */
export interface SystemConfig {
    poolSystem: PoolSystemConfig;
    debug: {
        enablePoolStats: boolean;    // 是否启用池统计
        logLevel: 'verbose' | 'normal' | 'minimal';
    };
    performance: {
        enableFrameSkip: boolean;    // 是否启用帧跳过
        targetFPS: number;           // 目标帧率
    };
}

/**
 * 默认系统配置
 */
export const DEFAULT_SYSTEM_CONFIG: SystemConfig = {
    poolSystem: {
        damageTextPool: {
            minDamage: 1,
            maxDamage: 10000,
            nodesPerDamage: 3,
            batchSize: 1000,
            enableBatchLoading: true, // 使用分批加载，但扩大预加载范围
            preloadRangeStart: 1,
            preloadRangeEnd: 2000 // 预加载1-2000，覆盖大部分常用伤害值
        },
        healthBars: {
            // 配置说明：
            // - 优先级: 具体数值(width/height/offsetY) > 比例配置(widthRatio/offsetYRatio)
            // - 如果设置了具体数值，则忽略对应的比例配置
            // - 比例配置基于角色的实际UITransform尺寸计算
            
            lich: {
                // 巫妖血条配置 - 使用比例配置（动态适应角色大小）
                height: 2,              // 高度固定2像素
                widthRatio: 0.25,       // 宽度 = 角色宽度 × 25%
                offsetYRatio: 0.35      // Y偏移 = 角色高度 × 35%
                
                // 移除的固定配置: width: 32, offsetY: 32
                // 现在会根据角色实际尺寸动态计算
            },
            ent: {
                // 树精血条配置 - 混合配置模式
                height: 2,              // 高度固定2像素
                widthRatio: 0.3,        // 宽度 = 角色宽度 × 30%  
                offsetYRatio: 0.25      // Y偏移 = 角色高度 × 25%
                
                // 移除的固定配置: width: 40, offsetY: 40
                // 现在会根据角色实际尺寸动态计算
            },
            default: {
                // 默认血条配置 - 纯比例配置（用于未指定的敌人类型）
                height: 2,              // 高度固定2像素
                widthRatio: 0.3,        // 宽度 = 角色宽度 × 30%
                offsetYRatio: 0.4       // Y偏移 = 角色高度 × 40%
                
                // 示例计算（假设角色64×64像素）：
                // width = 64 × 0.3 = 19.2 ≈ 19像素
                // offsetY = 64 × 0.4 = 25.6 ≈ 26像素
            }
        },
        cleanupInterval: 30000,
        maxPoolSize: 50,
        preloadCount: 5
    },
    debug: {
        enablePoolStats: true,
        logLevel: 'normal'
    },
    performance: {
        enableFrameSkip: false,
        targetFPS: 60
    }
};

/**
 * 系统配置管理器
 */
@ccclass('SystemConfigManager')
export class SystemConfigManager {
    private static _instance: SystemConfigManager;
    private _config: SystemConfig;

    public static get instance(): SystemConfigManager {
        if (!this._instance) {
            this._instance = new SystemConfigManager();
        }
        return this._instance;
    }

    constructor() {
        this._config = { ...DEFAULT_SYSTEM_CONFIG };
    }

    /**
     * 获取完整配置
     */
    public getConfig(): SystemConfig {
        return this._config;
    }

    /**
     * 获取对象池系统配置
     */
    public getPoolSystemConfig(): PoolSystemConfig {
        return this._config.poolSystem;
    }

    /**
     * 获取伤害文字池配置
     */
    public getDamageTextPoolConfig(): DamageTextPoolConfig {
        return this._config.poolSystem.damageTextPool;
    }

    /**
     * 获取血条配置
     */
    public getHealthBarConfigs(): CharacterHealthBarConfigs {
        return this._config.poolSystem.healthBars;
    }

    /**
     * 根据角色类型获取血条配置
     */
    public getHealthBarConfigForCharacter(characterType: string): HealthBarConfig {
        const configs = this._config.poolSystem.healthBars;
        
        // 根据角色类型确定配置
        switch (characterType.toLowerCase()) {
            case 'ent':
                return configs.ent;
            case 'lich':
                return configs.lich;
            default:
                // 默认使用lich配置（其他所有类型）
                return configs.lich;
        }
    }

    /**
     * 从敌人数据获取血条配置（优先使用敌人配置，没有则使用默认配置）
     * @param enemyData 敌人数据
     * @returns 血条配置
     */
    public getHealthBarConfigFromEnemyData(enemyData: any): HealthBarConfig {
        // 如果敌人数据中有血条配置，直接使用（保持向后兼容）
        if (enemyData && enemyData.healthBar) {
            return {
                width: enemyData.healthBar.width,
                height: enemyData.healthBar.height,
                offsetY: enemyData.healthBar.offsetY
            };
        }

        // 没有配置则使用默认值
        const enemyId = enemyData?.id || 'default';
        
        // ent_normal 和 ent_elite 使用特殊配置
        if (enemyId === 'ent_normal' || enemyId === 'ent_elite') {
            return {
                width: 40,
                height: 2,
                offsetY: 40
            };
        }

        // 其他敌人使用通用默认配置
        return {
            width: 32,
            height: 2,
            offsetY: 32
        };
    }

    /**
     * 计算最终血条配置（支持比例配置）
     * 优先级：具体数值 > 比例配置
     * @param baseConfig 基础血条配置
     * @param characterWidth 角色宽度（用于宽度比例计算）
     * @param characterHeight 角色高度（用于Y偏移比例计算）
     * @param enemyData 敌人数据（可选，用于获取预制体配置尺寸）
     * @returns 最终血条配置
     */
    public calculateFinalHealthBarConfig(
        baseConfig: HealthBarConfig, 
        characterWidth: number = 64, 
        characterHeight: number = 64,
        enemyData?: any
    ): { width: number; height: number; offsetY: number } {
        
        // 优先使用敌人配置中的UI尺寸进行比例计算
        let effectiveWidth = characterWidth;
        let effectiveHeight = characterHeight;
        
        if (enemyData?.uiSize) {
            effectiveWidth = enemyData.uiSize.width;
            effectiveHeight = enemyData.uiSize.height;
            console.log(`[SystemConfig] 使用配置中的UI尺寸: ${effectiveWidth}x${effectiveHeight}px`);
        } else {
            console.log(`[SystemConfig] 使用节点实际尺寸: ${effectiveWidth}x${effectiveHeight}px`);
        }
        
        // 计算最终宽度：优先使用固定值，否则使用比例
        const finalWidth = baseConfig.width !== undefined 
            ? baseConfig.width 
            : Math.round(effectiveWidth * (baseConfig.widthRatio || 0.3));
        
        // 计算最终高度：优先使用固定值，否则使用默认值2
        const finalHeight = baseConfig.height !== undefined 
            ? baseConfig.height 
            : 2;
        
        // 计算最终Y偏移：优先使用固定值，否则使用比例
        const finalOffsetY = baseConfig.offsetY !== undefined 
            ? baseConfig.offsetY 
            : Math.round(effectiveHeight * (baseConfig.offsetYRatio || 0.4));
        
        return {
            width: finalWidth,
            height: finalHeight,
            offsetY: finalOffsetY
        };
    }

    /**
     * 更新配置
     */
    public updateConfig(newConfig: Partial<SystemConfig>): void {
        this._config = { ...this._config, ...newConfig };
        console.log('SystemConfigManager: 配置已更新', this._config);
    }

    /**
     * 重置为默认配置
     */
    public resetToDefault(): void {
        this._config = { ...DEFAULT_SYSTEM_CONFIG };
        console.log('SystemConfigManager: 配置已重置为默认值');
    }

    /**
     * 打印当前配置
     */
    public printConfig(): void {
        console.log('=== 系统配置 ===');
        console.log('对象池系统:', this._config.poolSystem);
        console.log('调试设置:', this._config.debug);
        console.log('性能设置:', this._config.performance);
        console.log('===============');
    }
}

export const systemConfigManager = SystemConfigManager.instance; 