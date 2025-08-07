// assets/scripts/systems/FlowDirection.ts

/**
 * 流场方向枚举 - 只有左右两个方向，无中性状态
 */
export enum FlowDirection {
    LEFT = 'left',   // 向左移动/压制
    RIGHT = 'right'  // 向右移动/压制
}

/**
 * 流场单位状态枚举
 */
export enum FlowFieldUnitState {
    MARCHING = 'marching',    // 行军状态：流场移动，简单索敌
    ENCOUNTER = 'encounter'   // 遭遇状态：战斗决策，复杂战术
}

/**
 * 流场单位配置接口
 */
export interface FlowFieldUnitConfig {
    /** 索敌范围 */
    detectionRange: number;
    /** 攻击范围 */
    attackRange: number;
    /** 战斗状态超时时间（秒）*/
    combatTimeout: number;
    /** 移动速度 */
    moveSpeed: number;
    /** 前进速度（行军状态）*/
    marchSpeed: number;
}

/**
 * 默认配置
 */
export const DEFAULT_FLOW_FIELD_CONFIG: FlowFieldUnitConfig = {
    detectionRange: 150,
    attackRange: 50,
    combatTimeout: 3.0,
    moveSpeed: 10,
    marchSpeed: 10
};