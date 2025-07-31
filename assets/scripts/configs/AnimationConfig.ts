// assets/scripts/animation/AnimationConfig.ts

import { SpriteFrame } from 'cc';

/**
 * 动画帧数据接口
 */
export interface AnimationFrameData {
    name: string;           // 帧名称
    spriteFrame: SpriteFrame;  // 精灵帧
    duration: number;       // 持续时间
}

/**
 * 动画剪辑数据接口
 */
export interface AnimationClipData {
    name: string;           // 动画名称
    frames: AnimationFrameData[];  // 动画帧数组
    loop: boolean;          // 是否循环
    speed: number;          // 播放速度
}

/**
 * 动画状态枚举
 */
export enum AnimationState {
    IDLE = 'Idle',          // 待机
    WALK = 'Walk',          // 移动（对应图集中的Walk）
    ATTACK = 'Attack',      // 攻击
    HURT = 'Hurt',          // 受伤
    DEATH = 'Death',        // 死亡（对应图集中的Death）
    CAST = 'Cast',          // 施法
    DEFEND = 'Defend'       // 防御
}

/**
 * 投射物动画状态枚举
 */
export enum ProjectileAnimationState {
    SPAWN = 'spawn',        // 生成
    FLYING = 'flying',      // 飞行
    EXPLODING = 'exploding' // 爆炸
}

/**
 * 动画方向枚举
 */
export enum AnimationDirection {
    FRONT = 'front',        // 正面
    BACK = 'back',          // 背面
    LEFT = 'left',          // 左侧
    RIGHT = 'right',        // 右侧
    FRONT_LEFT = 'front_left',   // 前左
    FRONT_RIGHT = 'front_right', // 前右
    BACK_LEFT = 'back_left',     // 后左
    BACK_RIGHT = 'back_right'    // 后右
}

/**
 * 动画配置接口
 * 定义单个动画的配置信息
 */
export interface AnimationConfig {
    framePrefix: string;    // 帧名前缀
    frameCount: number;     // 帧数量
    frameRate: number;      // 帧率
    loop: boolean;          // 是否循环
}

/**
 * 敌人动画配置接口
 * 定义敌人的完整动画配置映射
 */
export interface EnemyAnimationConfig {
    plistUrl: string;       // 图集路径
    assetNamePrefix: string; // 资源名前缀
    animations: {
        [key in AnimationState]?: {
            [key in AnimationDirection]?: AnimationConfig
        }
    };
}

/**
 * 动画配置数据库
 * 根据实际图集资源创建的配置映射
 */
export const animationConfigDatabase: Record<string, EnemyAnimationConfig> = {
    // Ent1 动画配置 - 基于实际图集分析
    'Ent1': {
        plistUrl: 'monster/ent',
        assetNamePrefix: 'Ent1',
        animations: {
            [AnimationState.IDLE]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Ent1_Idle_front', frameCount: 4, frameRate: 8, loop: true },
                [AnimationDirection.BACK]: { framePrefix: 'Ent1_Idle_back', frameCount: 4, frameRate: 8, loop: true },
                [AnimationDirection.LEFT]: { framePrefix: 'Ent1_Idle_left', frameCount: 4, frameRate: 8, loop: true },
                [AnimationDirection.RIGHT]: { framePrefix: 'Ent1_Idle_right', frameCount: 4, frameRate: 8, loop: true }
            },
            [AnimationState.WALK]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Ent1_Walk_front', frameCount: 6, frameRate: 10, loop: true },
                [AnimationDirection.BACK]: { framePrefix: 'Ent1_Walk_back', frameCount: 6, frameRate: 10, loop: true },
                [AnimationDirection.LEFT]: { framePrefix: 'Ent1_Walk_left', frameCount: 6, frameRate: 10, loop: true },
                [AnimationDirection.RIGHT]: { framePrefix: 'Ent1_Walk_right', frameCount: 6, frameRate: 10, loop: true }
            },
            [AnimationState.ATTACK]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Ent1_Attack_front', frameCount: 7, frameRate: 12, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Ent1_Attack_back', frameCount: 7, frameRate: 12, loop: false },
                [AnimationDirection.LEFT]: { framePrefix: 'Ent1_Attack_left', frameCount: 7, frameRate: 12, loop: false },
                [AnimationDirection.RIGHT]: { framePrefix: 'Ent1_Attack_right', frameCount: 7, frameRate: 12, loop: false }
            },
            [AnimationState.HURT]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Ent1_Hurt_front', frameCount: 4, frameRate: 15, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Ent1_Hurt_back', frameCount: 4, frameRate: 15, loop: false },
                [AnimationDirection.LEFT]: { framePrefix: 'Ent1_Hurt_left', frameCount: 4, frameRate: 15, loop: false },
                [AnimationDirection.RIGHT]: { framePrefix: 'Ent1_Hurt_right', frameCount: 4, frameRate: 15, loop: false }
            },
            [AnimationState.DEATH]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Ent1_Death_front', frameCount: 6, frameRate: 8, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Ent1_Death_back', frameCount: 6, frameRate: 8, loop: false },
                [AnimationDirection.LEFT]: { framePrefix: 'Ent1_Death_left', frameCount: 6, frameRate: 8, loop: false },
                [AnimationDirection.RIGHT]: { framePrefix: 'Ent1_Death_right', frameCount: 6, frameRate: 8, loop: false }
            }
        }
    },

    // Ent2 (精英树人) 动画配置 - 复用Ent1
    'Ent2': {
        plistUrl: 'monster/ent',
        assetNamePrefix: 'Ent2',
        animations: {
            [AnimationState.IDLE]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Ent2_Idle_front', frameCount: 4, frameRate: 8, loop: true },
                [AnimationDirection.BACK]: { framePrefix: 'Ent2_Idle_back', frameCount: 4, frameRate: 8, loop: true },
                [AnimationDirection.LEFT]: { framePrefix: 'Ent2_Idle_left', frameCount: 4, frameRate: 8, loop: true },
                [AnimationDirection.RIGHT]: { framePrefix: 'Ent2_Idle_right', frameCount: 4, frameRate: 8, loop: true }
            },
            [AnimationState.WALK]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Ent2_Walk_front', frameCount: 6, frameRate: 10, loop: true },
                [AnimationDirection.BACK]: { framePrefix: 'Ent2_Walk_back', frameCount: 6, frameRate: 10, loop: true },
                [AnimationDirection.LEFT]: { framePrefix: 'Ent2_Walk_left', frameCount: 6, frameRate: 10, loop: true },
                [AnimationDirection.RIGHT]: { framePrefix: 'Ent2_Walk_right', frameCount: 6, frameRate: 10, loop: true }
            },
            [AnimationState.ATTACK]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Ent2_Attack_front', frameCount: 7, frameRate: 12, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Ent2_Attack_back', frameCount: 7, frameRate: 12, loop: false },
                [AnimationDirection.LEFT]: { framePrefix: 'Ent2_Attack_left', frameCount: 7, frameRate: 12, loop: false },
                [AnimationDirection.RIGHT]: { framePrefix: 'Ent2_Attack_right', frameCount: 7, frameRate: 12, loop: false }
            },
            [AnimationState.HURT]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Ent2_Hurt_front', frameCount: 4, frameRate: 15, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Ent2_Hurt_back', frameCount: 4, frameRate: 15, loop: false },
                [AnimationDirection.LEFT]: { framePrefix: 'Ent2_Hurt_left', frameCount: 4, frameRate: 15, loop: false },
                [AnimationDirection.RIGHT]: { framePrefix: 'Ent2_Hurt_right', frameCount: 4, frameRate: 15, loop: false }
            },
            [AnimationState.DEATH]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Ent2_Death_front', frameCount: 6, frameRate: 8, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Ent2_Death_back', frameCount: 6, frameRate: 8, loop: false },
                [AnimationDirection.LEFT]: { framePrefix: 'Ent2_Death_left', frameCount: 6, frameRate: 8, loop: false },
                [AnimationDirection.RIGHT]: { framePrefix: 'Ent2_Death_right', frameCount: 6, frameRate: 8, loop: false }
            }
        }
    },

    // Ent3 (Boss树人) 动画配置 - 复用Ent1
    'Ent3': {
        plistUrl: 'monster/ent',
        assetNamePrefix: 'Ent3',
        animations: {
            [AnimationState.IDLE]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Ent3_Idle_front', frameCount: 4, frameRate: 8, loop: true },
                [AnimationDirection.BACK]: { framePrefix: 'Ent3_Idle_back', frameCount: 4, frameRate: 8, loop: true },
                [AnimationDirection.LEFT]: { framePrefix: 'Ent3_Idle_left', frameCount: 4, frameRate: 8, loop: true },
                [AnimationDirection.RIGHT]: { framePrefix: 'Ent3_Idle_right', frameCount: 4, frameRate: 8, loop: true }
            },
            [AnimationState.WALK]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Ent3_Walk_front', frameCount: 6, frameRate: 10, loop: true },
                [AnimationDirection.BACK]: { framePrefix: 'Ent3_Walk_back', frameCount: 6, frameRate: 10, loop: true },
                [AnimationDirection.LEFT]: { framePrefix: 'Ent3_Walk_left', frameCount: 6, frameRate: 10, loop: true },
                [AnimationDirection.RIGHT]: { framePrefix: 'Ent3_Walk_right', frameCount: 6, frameRate: 10, loop: true }
            },
            [AnimationState.ATTACK]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Ent3_Attack_front', frameCount: 7, frameRate: 12, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Ent3_Attack_back', frameCount: 7, frameRate: 12, loop: false },
                [AnimationDirection.LEFT]: { framePrefix: 'Ent3_Attack_left', frameCount: 7, frameRate: 12, loop: false },
                [AnimationDirection.RIGHT]: { framePrefix: 'Ent3_Attack_right', frameCount: 7, frameRate: 12, loop: false }
            },
            [AnimationState.HURT]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Ent3_Hurt_front', frameCount: 4, frameRate: 15, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Ent3_Hurt_back', frameCount: 4, frameRate: 15, loop: false },
                [AnimationDirection.LEFT]: { framePrefix: 'Ent3_Hurt_left', frameCount: 4, frameRate: 15, loop: false },
                [AnimationDirection.RIGHT]: { framePrefix: 'Ent3_Hurt_right', frameCount: 4, frameRate: 15, loop: false }
            },
            [AnimationState.DEATH]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Ent3_Death_front', frameCount: 6, frameRate: 8, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Ent3_Death_back', frameCount: 6, frameRate: 8, loop: false },
                [AnimationDirection.LEFT]: { framePrefix: 'Ent3_Death_left', frameCount: 6, frameRate: 8, loop: false },
                [AnimationDirection.RIGHT]: { framePrefix: 'Ent3_Death_right', frameCount: 6, frameRate: 8, loop: false }
            }
        }
    },

    // Lich1 动画配置 - 基于实际图集分析
    'Lich1': {
        plistUrl: 'monster/lich',
        assetNamePrefix: 'Lich1',
        animations: {
            [AnimationState.IDLE]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Lich1_Idle_front', frameCount: 4, frameRate: 6, loop: true },
                [AnimationDirection.BACK]: { framePrefix: 'Lich1_Idle_back', frameCount: 4, frameRate: 6, loop: true },
                [AnimationDirection.LEFT]: { framePrefix: 'Lich1_Idle_left', frameCount: 4, frameRate: 6, loop: true },
                [AnimationDirection.RIGHT]: { framePrefix: 'Lich1_Idle_right', frameCount: 4, frameRate: 6, loop: true }
            },
            [AnimationState.WALK]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Lich1_Walk_front', frameCount: 6, frameRate: 8, loop: true },
                [AnimationDirection.BACK]: { framePrefix: 'Lich1_Walk_back', frameCount: 6, frameRate: 8, loop: true },
                [AnimationDirection.LEFT]: { framePrefix: 'Lich1_Walk_left', frameCount: 6, frameRate: 8, loop: true },
                [AnimationDirection.RIGHT]: { framePrefix: 'Lich1_Walk_right', frameCount: 6, frameRate: 8, loop: true }
            },
            [AnimationState.ATTACK]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Lich1_Attack_front', frameCount: 8, frameRate: 12, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Lich1_Attack_back', frameCount: 8, frameRate: 12, loop: false },
                [AnimationDirection.LEFT]: { framePrefix: 'Lich1_Attack_left', frameCount: 8, frameRate: 12, loop: false },
                [AnimationDirection.RIGHT]: { framePrefix: 'Lich1_Attack_right', frameCount: 8, frameRate: 12, loop: false }
            },
            [AnimationState.HURT]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Lich1_Hurt_front', frameCount: 4, frameRate: 15, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Lich1_Hurt_back', frameCount: 4, frameRate: 15, loop: false },
                [AnimationDirection.LEFT]: { framePrefix: 'Lich1_Hurt_left', frameCount: 4, frameRate: 15, loop: false },
                [AnimationDirection.RIGHT]: { framePrefix: 'Lich1_Hurt_right', frameCount: 4, frameRate: 15, loop: false }
            },
            [AnimationState.DEATH]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Lich1_Death_front', frameCount: 10, frameRate: 8, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Lich1_Death_back', frameCount: 10, frameRate: 8, loop: false },
                [AnimationDirection.LEFT]: { framePrefix: 'Lich1_Death_left', frameCount: 10, frameRate: 8, loop: false },
                [AnimationDirection.RIGHT]: { framePrefix: 'Lich1_Death_right', frameCount: 10, frameRate: 8, loop: false }
            }
        }
    },

    // Lich2 (精英巫妖) 动画配置 - 复用Lich1
    'Lich2': {
        plistUrl: 'monster/lich',
        assetNamePrefix: 'Lich2',
        animations: {
            // 完全复用 Lich1 的动画，但使用 Lich2 前缀
            [AnimationState.IDLE]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Lich2_Idle_front', frameCount: 4, frameRate: 6, loop: true },
                [AnimationDirection.BACK]: { framePrefix: 'Lich2_Idle_back', frameCount: 4, frameRate: 6, loop: true },
                [AnimationDirection.LEFT]: { framePrefix: 'Lich2_Idle_left', frameCount: 4, frameRate: 6, loop: true },
                [AnimationDirection.RIGHT]: { framePrefix: 'Lich2_Idle_right', frameCount: 4, frameRate: 6, loop: true }
            },
            [AnimationState.WALK]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Lich2_Walk_front', frameCount: 6, frameRate: 8, loop: true },
                [AnimationDirection.BACK]: { framePrefix: 'Lich2_Walk_back', frameCount: 6, frameRate: 8, loop: true },
                [AnimationDirection.LEFT]: { framePrefix: 'Lich2_Walk_left', frameCount: 6, frameRate: 8, loop: true },
                [AnimationDirection.RIGHT]: { framePrefix: 'Lich2_Walk_right', frameCount: 6, frameRate: 8, loop: true }
            },
            [AnimationState.ATTACK]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Lich2_Attack_front', frameCount: 8, frameRate: 12, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Lich2_Attack_back', frameCount: 8, frameRate: 12, loop: false },
                [AnimationDirection.LEFT]: { framePrefix: 'Lich2_Attack_left', frameCount: 8, frameRate: 12, loop: false },
                [AnimationDirection.RIGHT]: { framePrefix: 'Lich2_Attack_right', frameCount: 8, frameRate: 12, loop: false }
            },
            [AnimationState.HURT]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Lich2_Hurt_front', frameCount: 4, frameRate: 15, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Lich2_Hurt_back', frameCount: 4, frameRate: 15, loop: false },
                [AnimationDirection.LEFT]: { framePrefix: 'Lich2_Hurt_left', frameCount: 4, frameRate: 15, loop: false },
                [AnimationDirection.RIGHT]: { framePrefix: 'Lich2_Hurt_right', frameCount: 4, frameRate: 15, loop: false }
            },
            [AnimationState.DEATH]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Lich2_Death_front', frameCount: 10, frameRate: 8, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Lich2_Death_back', frameCount: 10, frameRate: 8, loop: false },
                [AnimationDirection.LEFT]: { framePrefix: 'Lich2_Death_left', frameCount: 10, frameRate: 8, loop: false },
                [AnimationDirection.RIGHT]: { framePrefix: 'Lich2_Death_right', frameCount: 10, frameRate: 8, loop: false }
            }
        }
    },

    // Lich3 (Boss巫妖) 动画配置 - 复用Lich1
    'Lich3': {
        plistUrl: 'monster/lich',
        assetNamePrefix: 'Lich3',
        animations: {
            // 完全复用 Lich1 的动画，但使用 Lich3 前缀
            [AnimationState.IDLE]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Lich3_Idle_front', frameCount: 4, frameRate: 6, loop: true },
                [AnimationDirection.BACK]: { framePrefix: 'Lich3_Idle_back', frameCount: 4, frameRate: 6, loop: true },
                [AnimationDirection.LEFT]: { framePrefix: 'Lich3_Idle_left', frameCount: 4, frameRate: 6, loop: true },
                [AnimationDirection.RIGHT]: { framePrefix: 'Lich3_Idle_right', frameCount: 4, frameRate: 6, loop: true }
            },
            [AnimationState.WALK]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Lich3_Walk_front', frameCount: 6, frameRate: 8, loop: true },
                [AnimationDirection.BACK]: { framePrefix: 'Lich3_Walk_back', frameCount: 6, frameRate: 8, loop: true },
                [AnimationDirection.LEFT]: { framePrefix: 'Lich3_Walk_left', frameCount: 6, frameRate: 8, loop: true },
                [AnimationDirection.RIGHT]: { framePrefix: 'Lich3_Walk_right', frameCount: 6, frameRate: 8, loop: true }
            },
            [AnimationState.ATTACK]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Lich3_Attack_front', frameCount: 8, frameRate: 12, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Lich3_Attack_back', frameCount: 8, frameRate: 12, loop: false },
                [AnimationDirection.LEFT]: { framePrefix: 'Lich3_Attack_left', frameCount: 8, frameRate: 12, loop: false },
                [AnimationDirection.RIGHT]: { framePrefix: 'Lich3_Attack_right', frameCount: 8, frameRate: 12, loop: false }
            },
            [AnimationState.HURT]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Lich3_Hurt_front', frameCount: 4, frameRate: 15, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Lich3_Hurt_back', frameCount: 4, frameRate: 15, loop: false },
                [AnimationDirection.LEFT]: { framePrefix: 'Lich3_Hurt_left', frameCount: 4, frameRate: 15, loop: false },
                [AnimationDirection.RIGHT]: { framePrefix: 'Lich3_Hurt_right', frameCount: 4, frameRate: 15, loop: false }
            },
            [AnimationState.DEATH]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Lich3_Death_front', frameCount: 10, frameRate: 8, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Lich3_Death_back', frameCount: 10, frameRate: 8, loop: false },
                [AnimationDirection.LEFT]: { framePrefix: 'Lich3_Death_left', frameCount: 10, frameRate: 8, loop: false },
                [AnimationDirection.RIGHT]: { framePrefix: 'Lich3_Death_right', frameCount: 10, frameRate: 8, loop: false }
            }
        }
    },

    // Goblin1 (哥布林) 动画配置
    'Goblin1': {
        plistUrl: 'monster/goblin',
        assetNamePrefix: 'Goblin1',
        animations: {
            [AnimationState.IDLE]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Goblin1_Idle_front', frameCount: 4, frameRate: 8, loop: true },
                [AnimationDirection.BACK]: { framePrefix: 'Goblin1_Idle_back', frameCount: 4, frameRate: 8, loop: true },
                [AnimationDirection.LEFT]: { framePrefix: 'Goblin1_Idle_left', frameCount: 4, frameRate: 8, loop: true },
                [AnimationDirection.RIGHT]: { framePrefix: 'Goblin1_Idle_right', frameCount: 4, frameRate: 8, loop: true }
            },
            [AnimationState.WALK]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Goblin1_Run_front', frameCount: 6, frameRate: 10, loop: true },
                [AnimationDirection.BACK]: { framePrefix: 'Goblin1_Run_back', frameCount: 6, frameRate: 10, loop: true },
                [AnimationDirection.LEFT]: { framePrefix: 'Goblin1_Run_left', frameCount: 6, frameRate: 10, loop: true },
                [AnimationDirection.RIGHT]: { framePrefix: 'Goblin1_Run_right', frameCount: 6, frameRate: 10, loop: true }
            },
            [AnimationState.ATTACK]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Goblin1_Attack_front', frameCount: 6, frameRate: 12, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Goblin1_Attack_back', frameCount: 6, frameRate: 12, loop: false },
                [AnimationDirection.LEFT]: { framePrefix: 'Goblin1_Attack_left', frameCount: 6, frameRate: 12, loop: false },
                [AnimationDirection.RIGHT]: { framePrefix: 'Goblin1_Attack_right', frameCount: 6, frameRate: 12, loop: false }
            },
            [AnimationState.HURT]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Goblin1_Hurt_front', frameCount: 3, frameRate: 15, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Goblin1_Hurt_back', frameCount: 3, frameRate: 15, loop: false },
                [AnimationDirection.LEFT]: { framePrefix: 'Goblin1_Hurt_left', frameCount: 3, frameRate: 15, loop: false },
                [AnimationDirection.RIGHT]: { framePrefix: 'Goblin1_Hurt_right', frameCount: 3, frameRate: 15, loop: false }
            },
            [AnimationState.DEATH]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Goblin1_Death_front', frameCount: 4, frameRate: 8, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Goblin1_Death_back', frameCount: 4, frameRate: 8, loop: false },
                [AnimationDirection.LEFT]: { framePrefix: 'Goblin1_Death_left', frameCount: 4, frameRate: 8, loop: false },
                [AnimationDirection.RIGHT]: { framePrefix: 'Goblin1_Death_right', frameCount: 4, frameRate: 8, loop: false }
            }
        }
    },

    // Goblin2 (精英哥布林) 动画配置 - 复用Goblin1
    'Goblin2': {
        plistUrl: 'monster/goblin',
        assetNamePrefix: 'Goblin2',
        animations: {
            [AnimationState.IDLE]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Goblin2_Idle_front', frameCount: 4, frameRate: 8, loop: true },
                [AnimationDirection.BACK]: { framePrefix: 'Goblin2_Idle_back', frameCount: 4, frameRate: 8, loop: true },
                [AnimationDirection.LEFT]: { framePrefix: 'Goblin2_Idle_left', frameCount: 4, frameRate: 8, loop: true },
                [AnimationDirection.RIGHT]: { framePrefix: 'Goblin2_Idle_right', frameCount: 4, frameRate: 8, loop: true }
            },
            [AnimationState.WALK]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Goblin2_Run_front', frameCount: 6, frameRate: 10, loop: true },
                [AnimationDirection.BACK]: { framePrefix: 'Goblin2_Run_back', frameCount: 6, frameRate: 10, loop: true },
                [AnimationDirection.LEFT]: { framePrefix: 'Goblin2_Run_left', frameCount: 6, frameRate: 10, loop: true },
                [AnimationDirection.RIGHT]: { framePrefix: 'Goblin2_Run_right', frameCount: 6, frameRate: 10, loop: true }
            },
            [AnimationState.ATTACK]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Goblin2_Attack_front', frameCount: 6, frameRate: 12, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Goblin2_Attack_back', frameCount: 6, frameRate: 12, loop: false },
                [AnimationDirection.LEFT]: { framePrefix: 'Goblin2_Attack_left', frameCount: 6, frameRate: 12, loop: false },
                [AnimationDirection.RIGHT]: { framePrefix: 'Goblin2_Attack_right', frameCount: 6, frameRate: 12, loop: false }
            },
            [AnimationState.HURT]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Goblin2_Hurt_front', frameCount: 3, frameRate: 15, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Goblin2_Hurt_back', frameCount: 3, frameRate: 15, loop: false },
                [AnimationDirection.LEFT]: { framePrefix: 'Goblin2_Hurt_left', frameCount: 3, frameRate: 15, loop: false },
                [AnimationDirection.RIGHT]: { framePrefix: 'Goblin2_Hurt_right', frameCount: 3, frameRate: 15, loop: false }
            },
            [AnimationState.DEATH]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Goblin2_Death_front', frameCount: 4, frameRate: 8, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Goblin2_Death_back', frameCount: 4, frameRate: 8, loop: false },
                [AnimationDirection.LEFT]: { framePrefix: 'Goblin2_Death_left', frameCount: 4, frameRate: 8, loop: false },
                [AnimationDirection.RIGHT]: { framePrefix: 'Goblin2_Death_right', frameCount: 4, frameRate: 8, loop: false }
            }
        }
    },

    // Goblin3 (哥布林王) 动画配置 - 复用Goblin1
    'Goblin3': {
        plistUrl: 'monster/goblin',
        assetNamePrefix: 'Goblin3',
        animations: {
            [AnimationState.IDLE]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Goblin3_Idle_front', frameCount: 4, frameRate: 8, loop: true },
                [AnimationDirection.BACK]: { framePrefix: 'Goblin3_Idle_back', frameCount: 4, frameRate: 8, loop: true },
                [AnimationDirection.LEFT]: { framePrefix: 'Goblin3_Idle_left', frameCount: 4, frameRate: 8, loop: true },
                [AnimationDirection.RIGHT]: { framePrefix: 'Goblin3_Idle_right', frameCount: 4, frameRate: 8, loop: true }
            },
            [AnimationState.WALK]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Goblin3_Run_front', frameCount: 6, frameRate: 10, loop: true },
                [AnimationDirection.BACK]: { framePrefix: 'Goblin3_Run_back', frameCount: 6, frameRate: 10, loop: true },
                [AnimationDirection.LEFT]: { framePrefix: 'Goblin3_Run_left', frameCount: 6, frameRate: 10, loop: true },
                [AnimationDirection.RIGHT]: { framePrefix: 'Goblin3_Run_right', frameCount: 6, frameRate: 10, loop: true }
            },
            [AnimationState.ATTACK]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Goblin3_Attack_front', frameCount: 6, frameRate: 12, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Goblin3_Attack_back', frameCount: 6, frameRate: 12, loop: false },
                [AnimationDirection.LEFT]: { framePrefix: 'Goblin3_Attack_left', frameCount: 6, frameRate: 12, loop: false },
                [AnimationDirection.RIGHT]: { framePrefix: 'Goblin3_Attack_right', frameCount: 6, frameRate: 12, loop: false }
            },
            [AnimationState.HURT]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Goblin3_Hurt_front', frameCount: 3, frameRate: 15, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Goblin3_Hurt_back', frameCount: 3, frameRate: 15, loop: false },
                [AnimationDirection.LEFT]: { framePrefix: 'Goblin3_Hurt_left', frameCount: 3, frameRate: 15, loop: false },
                [AnimationDirection.RIGHT]: { framePrefix: 'Goblin3_Hurt_right', frameCount: 3, frameRate: 15, loop: false }
            },
            [AnimationState.DEATH]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Goblin3_Death_front', frameCount: 4, frameRate: 8, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Goblin3_Death_back', frameCount: 4, frameRate: 8, loop: false },
                [AnimationDirection.LEFT]: { framePrefix: 'Goblin3_Death_left', frameCount: 4, frameRate: 8, loop: false },
                [AnimationDirection.RIGHT]: { framePrefix: 'Goblin3_Death_right', frameCount: 4, frameRate: 8, loop: false }
            }
        }
    },

    // Orc1 (兽人) 动画配置 - 基于实际图集分析 (已适配首字母大写)
    'Orc1': {
        plistUrl: 'monster/orc',
        assetNamePrefix: 'Orc1',
        animations: {
            [AnimationState.IDLE]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Orc1_front_idle', frameCount: 4, frameRate: 8, loop: true },
                [AnimationDirection.BACK]: { framePrefix: 'Orc1_back_idle', frameCount: 4, frameRate: 8, loop: true },
                [AnimationDirection.LEFT]: { framePrefix: 'Orc1_left_idle', frameCount: 4, frameRate: 8, loop: true },
                [AnimationDirection.RIGHT]: { framePrefix: 'Orc1_right_idle', frameCount: 4, frameRate: 8, loop: true }
            },
            [AnimationState.WALK]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Orc1_front_walk', frameCount: 6, frameRate: 10, loop: true },
                [AnimationDirection.BACK]: { framePrefix: 'Orc1_back_walk', frameCount: 6, frameRate: 10, loop: true },
                [AnimationDirection.LEFT]: { framePrefix: 'Orc1_left_walk', frameCount: 6, frameRate: 10, loop: true },
                [AnimationDirection.RIGHT]: { framePrefix: 'Orc1_right_walk', frameCount: 6, frameRate: 10, loop: true }
            },
            [AnimationState.ATTACK]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Orc1_front_attack', frameCount: 8, frameRate: 12, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Orc1_back_attack', frameCount: 8, frameRate: 12, loop: false },
                [AnimationDirection.LEFT]: { framePrefix: 'Orc1_left_attack', frameCount: 8, frameRate: 12, loop: false },
                [AnimationDirection.RIGHT]: { framePrefix: 'Orc1_right_attack', frameCount: 8, frameRate: 12, loop: false }
            },
            [AnimationState.HURT]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Orc1_front_hurt', frameCount: 6, frameRate: 15, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Orc1_back_hurt', frameCount: 6, frameRate: 15, loop: false },
                [AnimationDirection.LEFT]: { framePrefix: 'Orc1_left_hurt', frameCount: 6, frameRate: 15, loop: false },
                [AnimationDirection.RIGHT]: { framePrefix: 'Orc1_right_hurt', frameCount: 6, frameRate: 15, loop: false }
            },
            [AnimationState.DEATH]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Orc1_front_death', frameCount: 8, frameRate: 8, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Orc1_back_death', frameCount: 8, frameRate: 8, loop: false },
                [AnimationDirection.LEFT]: { framePrefix: 'Orc1_left_death', frameCount: 8, frameRate: 8, loop: false },
                [AnimationDirection.RIGHT]: { framePrefix: 'Orc1_right_death', frameCount: 8, frameRate: 8, loop: false }
            }
        }
    },

    // Orc2 (兽人) 动画配置 - 基于实际图集分析 (已适配首字母大写)
    'Orc2': {
        plistUrl: 'monster/orc',
        assetNamePrefix: 'Orc2',
        animations: {
            [AnimationState.IDLE]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Orc2_front_idle', frameCount: 4, frameRate: 8, loop: true },
                [AnimationDirection.BACK]: { framePrefix: 'Orc2_back_idle', frameCount: 4, frameRate: 8, loop: true },
                [AnimationDirection.LEFT]: { framePrefix: 'Orc2_left_idle', frameCount: 4, frameRate: 8, loop: true },
                [AnimationDirection.RIGHT]: { framePrefix: 'Orc2_right_idle', frameCount: 4, frameRate: 8, loop: true }
            },
            [AnimationState.WALK]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Orc2_front_walk', frameCount: 6, frameRate: 10, loop: true },
                [AnimationDirection.BACK]: { framePrefix: 'Orc2_back_walk', frameCount: 6, frameRate: 10, loop: true },
                [AnimationDirection.LEFT]: { framePrefix: 'Orc2_left_walk', frameCount: 6, frameRate: 10, loop: true },
                [AnimationDirection.RIGHT]: { framePrefix: 'Orc2_right_walk', frameCount: 6, frameRate: 10, loop: true }
            },
            [AnimationState.ATTACK]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Orc2_front_attack', frameCount: 8, frameRate: 12, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Orc2_back_attack', frameCount: 8, frameRate: 12, loop: false },
                [AnimationDirection.LEFT]: { framePrefix: 'Orc2_left_attack', frameCount: 8, frameRate: 12, loop: false },
                [AnimationDirection.RIGHT]: { framePrefix: 'Orc2_right_attack', frameCount: 8, frameRate: 12, loop: false }
            },
            [AnimationState.HURT]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Orc2_front_hurt', frameCount: 6, frameRate: 15, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Orc2_back_hurt', frameCount: 6, frameRate: 15, loop: false },
                [AnimationDirection.LEFT]: { framePrefix: 'Orc2_left_hurt', frameCount: 6, frameRate: 15, loop: false },
                [AnimationDirection.RIGHT]: { framePrefix: 'Orc2_right_hurt', frameCount: 6, frameRate: 15, loop: false }
            },
            [AnimationState.DEATH]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Orc2_front_death', frameCount: 8, frameRate: 8, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Orc2_back_death', frameCount: 8, frameRate: 8, loop: false },
                [AnimationDirection.LEFT]: { framePrefix: 'Orc2_left_death', frameCount: 8, frameRate: 8, loop: false },
                [AnimationDirection.RIGHT]: { framePrefix: 'Orc2_right_death', frameCount: 8, frameRate: 8, loop: false }
            }
        }
    },

    // Orc3 (兽人) 动画配置 - 基于实际图集分析 (已适配首字母大写)
    'Orc3': {
        plistUrl: 'monster/orc',
        assetNamePrefix: 'Orc3',
        animations: {
            [AnimationState.IDLE]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Orc3_front_idle', frameCount: 4, frameRate: 8, loop: true },
                [AnimationDirection.BACK]: { framePrefix: 'Orc3_back_idle', frameCount: 4, frameRate: 8, loop: true },
                [AnimationDirection.LEFT]: { framePrefix: 'Orc3_left_idle', frameCount: 4, frameRate: 8, loop: true },
                [AnimationDirection.RIGHT]: { framePrefix: 'Orc3_right_idle', frameCount: 4, frameRate: 8, loop: true }
            },
            [AnimationState.WALK]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Orc3_front_walk', frameCount: 6, frameRate: 10, loop: true },
                [AnimationDirection.BACK]: { framePrefix: 'Orc3_back_walk', frameCount: 6, frameRate: 10, loop: true },
                [AnimationDirection.LEFT]: { framePrefix: 'Orc3_left_walk', frameCount: 6, frameRate: 10, loop: true },
                [AnimationDirection.RIGHT]: { framePrefix: 'Orc3_right_walk', frameCount: 6, frameRate: 10, loop: true }
            },
            [AnimationState.ATTACK]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Orc3_front_attack', frameCount: 8, frameRate: 12, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Orc3_back_attack', frameCount: 8, frameRate: 12, loop: false },
                [AnimationDirection.LEFT]: { framePrefix: 'Orc3_left_attack', frameCount: 8, frameRate: 12, loop: false },
                [AnimationDirection.RIGHT]: { framePrefix: 'Orc3_right_attack', frameCount: 8, frameRate: 12, loop: false }
            },
            [AnimationState.HURT]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Orc3_front_hurt', frameCount: 6, frameRate: 15, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Orc3_back_hurt', frameCount: 6, frameRate: 15, loop: false },
                [AnimationDirection.LEFT]: { framePrefix: 'Orc3_left_hurt', frameCount: 6, frameRate: 15, loop: false },
                [AnimationDirection.RIGHT]: { framePrefix: 'Orc3_right_hurt', frameCount: 6, frameRate: 15, loop: false }
            },
            [AnimationState.DEATH]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Orc3_front_death', frameCount: 8, frameRate: 8, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Orc3_back_death', frameCount: 8, frameRate: 8, loop: false },
                [AnimationDirection.LEFT]: { framePrefix: 'Orc3_left_death', frameCount: 8, frameRate: 8, loop: false },
                [AnimationDirection.RIGHT]: { framePrefix: 'Orc3_right_death', frameCount: 8, frameRate: 8, loop: false }
            }
        }
    },

    // Golem1 (石巨人) 动画配置
    'Golem1': {
        plistUrl: 'monster/golem',
        assetNamePrefix: 'Golem1',
        animations: {
            [AnimationState.IDLE]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Golem1_Idle_front', frameCount: 4, frameRate: 8, loop: true },
                [AnimationDirection.BACK]: { framePrefix: 'Golem1_Idle_back', frameCount: 4, frameRate: 8, loop: true },
                [AnimationDirection.LEFT]: { framePrefix: 'Golem1_Idle_left', frameCount: 4, frameRate: 8, loop: true },
                [AnimationDirection.RIGHT]: { framePrefix: 'Golem1_Idle_right', frameCount: 4, frameRate: 8, loop: true }
            },
            [AnimationState.WALK]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Golem1_Run_front', frameCount: 8, frameRate: 10, loop: true },
                [AnimationDirection.BACK]: { framePrefix: 'Golem1_Run_back', frameCount: 8, frameRate: 10, loop: true },
                [AnimationDirection.LEFT]: { framePrefix: 'Golem1_Run_left', frameCount: 8, frameRate: 10, loop: true },
                [AnimationDirection.RIGHT]: { framePrefix: 'Golem1_Run_right', frameCount: 8, frameRate: 10, loop: true }
            },
            [AnimationState.ATTACK]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Golem1_Attack_front', frameCount: 6, frameRate: 12, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Golem1_Attack_back', frameCount: 6, frameRate: 12, loop: false },
                [AnimationDirection.LEFT]: { framePrefix: 'Golem1_Attack_left', frameCount: 6, frameRate: 12, loop: false },
                [AnimationDirection.RIGHT]: { framePrefix: 'Golem1_Attack_right', frameCount: 6, frameRate: 12, loop: false }
            },
            [AnimationState.HURT]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Golem1_Hurt_front', frameCount: 3, frameRate: 15, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Golem1_Hurt_back', frameCount: 3, frameRate: 15, loop: false },
                [AnimationDirection.LEFT]: { framePrefix: 'Golem1_Hurt_left', frameCount: 3, frameRate: 15, loop: false },
                [AnimationDirection.RIGHT]: { framePrefix: 'Golem1_Hurt_right', frameCount: 3, frameRate: 15, loop: false }
            },
            [AnimationState.DEATH]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Golem1_Death_front', frameCount: 6, frameRate: 8, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Golem1_Death_back', frameCount: 6, frameRate: 8, loop: false },
                [AnimationDirection.LEFT]: { framePrefix: 'Golem1_Death_left', frameCount: 6, frameRate: 8, loop: false },
                [AnimationDirection.RIGHT]: { framePrefix: 'Golem1_Death_right', frameCount: 6, frameRate: 8, loop: false }
            }
        }
    },

    // Golem2 (精英石巨人) 动画配置
    'Golem2': {
        plistUrl: 'monster/golem',
        assetNamePrefix: 'Golem2',
        animations: {
            [AnimationState.IDLE]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Golem2_Idle_front', frameCount: 4, frameRate: 8, loop: true },
                [AnimationDirection.BACK]: { framePrefix: 'Golem2_Idle_back', frameCount: 4, frameRate: 8, loop: true },
                [AnimationDirection.LEFT]: { framePrefix: 'Golem2_Idle_left', frameCount: 4, frameRate: 8, loop: true },
                [AnimationDirection.RIGHT]: { framePrefix: 'Golem2_Idle_right', frameCount: 4, frameRate: 8, loop: true }
            },
            [AnimationState.WALK]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Golem2_Run_front', frameCount: 8, frameRate: 10, loop: true },
                [AnimationDirection.BACK]: { framePrefix: 'Golem2_Run_back', frameCount: 8, frameRate: 10, loop: true },
                [AnimationDirection.LEFT]: { framePrefix: 'Golem2_Run_left', frameCount: 8, frameRate: 10, loop: true },
                [AnimationDirection.RIGHT]: { framePrefix: 'Golem2_Run_right', frameCount: 8, frameRate: 10, loop: true }
            },
            [AnimationState.ATTACK]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Golem2_Attack_front', frameCount: 6, frameRate: 12, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Golem2_Attack_back', frameCount: 6, frameRate: 12, loop: false },
                [AnimationDirection.LEFT]: { framePrefix: 'Golem2_Attack_left', frameCount: 6, frameRate: 12, loop: false },
                [AnimationDirection.RIGHT]: { framePrefix: 'Golem2_Attack_right', frameCount: 6, frameRate: 12, loop: false }
            },
            [AnimationState.HURT]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Golem2_Hurt_front', frameCount: 3, frameRate: 15, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Golem2_Hurt_back', frameCount: 3, frameRate: 15, loop: false },
                [AnimationDirection.LEFT]: { framePrefix: 'Golem2_Hurt_left', frameCount: 3, frameRate: 15, loop: false },
                [AnimationDirection.RIGHT]: { framePrefix: 'Golem2_Hurt_right', frameCount: 3, frameRate: 15, loop: false }
            },
            [AnimationState.DEATH]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Golem2_Death_front', frameCount: 6, frameRate: 8, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Golem2_Death_back', frameCount: 6, frameRate: 8, loop: false },
                [AnimationDirection.LEFT]: { framePrefix: 'Golem2_Death_left', frameCount: 6, frameRate: 8, loop: false },
                [AnimationDirection.RIGHT]: { framePrefix: 'Golem2_Death_right', frameCount: 6, frameRate: 8, loop: false }
            }
        }
    },

    // Golem3 (Boss石巨人) 动画配置
    'Golem3': {
        plistUrl: 'monster/golem',
        assetNamePrefix: 'Golem3',
        animations: {
            [AnimationState.IDLE]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Golem3_Idle_front', frameCount: 4, frameRate: 8, loop: true },
                [AnimationDirection.BACK]: { framePrefix: 'Golem3_Idle_back', frameCount: 4, frameRate: 8, loop: true },
                [AnimationDirection.LEFT]: { framePrefix: 'Golem3_Idle_left', frameCount: 4, frameRate: 8, loop: true },
                [AnimationDirection.RIGHT]: { framePrefix: 'Golem3_Idle_right', frameCount: 4, frameRate: 8, loop: true }
            },
            [AnimationState.WALK]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Golem3_Run_front', frameCount: 8, frameRate: 10, loop: true },
                [AnimationDirection.BACK]: { framePrefix: 'Golem3_Run_back', frameCount: 8, frameRate: 10, loop: true },
                [AnimationDirection.LEFT]: { framePrefix: 'Golem3_Run_left', frameCount: 8, frameRate: 10, loop: true },
                [AnimationDirection.RIGHT]: { framePrefix: 'Golem3_Run_right', frameCount: 8, frameRate: 10, loop: true }
            },
            [AnimationState.ATTACK]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Golem3_Attack_front', frameCount: 6, frameRate: 12, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Golem3_Attack_back', frameCount: 6, frameRate: 12, loop: false },
                [AnimationDirection.LEFT]: { framePrefix: 'Golem3_Attack_left', frameCount: 6, frameRate: 12, loop: false },
                [AnimationDirection.RIGHT]: { framePrefix: 'Golem3_Attack_right', frameCount: 6, frameRate: 12, loop: false }
            },
            [AnimationState.HURT]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Golem3_Hurt_front', frameCount: 3, frameRate: 15, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Golem3_Hurt_back', frameCount: 3, frameRate: 15, loop: false },
                [AnimationDirection.LEFT]: { framePrefix: 'Golem3_Hurt_left', frameCount: 3, frameRate: 15, loop: false },
                [AnimationDirection.RIGHT]: { framePrefix: 'Golem3_Hurt_right', frameCount: 3, frameRate: 15, loop: false }
            },
            [AnimationState.DEATH]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Golem3_Death_front', frameCount: 6, frameRate: 8, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Golem3_Death_back', frameCount: 6, frameRate: 8, loop: false },
                [AnimationDirection.LEFT]: { framePrefix: 'Golem3_Death_left', frameCount: 6, frameRate: 8, loop: false },
                [AnimationDirection.RIGHT]: { framePrefix: 'Golem3_Death_right', frameCount: 6, frameRate: 8, loop: false }
            }
        }
    },

    // --- Slime Configurations (9 types across 3 atlases) ---

    // Slime1: Bomb史莱姆 (from monster/slime1.plist)
    'Slime1': {
        plistUrl: 'monster/slime1',
        assetNamePrefix: 'Slime1',
        animations: {
            [AnimationState.IDLE]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Bomb_Idle_front', frameCount: 6, frameRate: 8, loop: true },
                [AnimationDirection.BACK]: { framePrefix: 'Bomb_Idle_back', frameCount: 6, frameRate: 8, loop: true }
            },
            [AnimationState.WALK]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Bomb_Run_front', frameCount: 8, frameRate: 10, loop: true },
                [AnimationDirection.BACK]: { framePrefix: 'Bomb_Run_back', frameCount: 8, frameRate: 10, loop: true }
            },
            [AnimationState.ATTACK]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Bomb_Attack_front', frameCount: 8, frameRate: 12, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Bomb_Attack_back', frameCount: 8, frameRate: 12, loop: false }
            },
            [AnimationState.HURT]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Bomb_Hurt_front', frameCount: 4, frameRate: 15, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Bomb_Hurt_back', frameCount: 4, frameRate: 15, loop: false }
            },
            [AnimationState.DEATH]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Bomb_Death_front', frameCount: 6, frameRate: 8, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Bomb_Death_back', frameCount: 6, frameRate: 8, loop: false }
            }
        }
    },

    // Slime2: Fire史莱姆 (from monster/slime1.plist)
    'Slime2': {
        plistUrl: 'monster/slime1',
        assetNamePrefix: 'Slime2',
        animations: {
            [AnimationState.IDLE]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Fire_Idle_front', frameCount: 6, frameRate: 8, loop: true },
                [AnimationDirection.BACK]: { framePrefix: 'Fire_Idle_back', frameCount: 6, frameRate: 8, loop: true }
            },
            [AnimationState.WALK]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Fire_Run_front', frameCount: 8, frameRate: 10, loop: true },
                [AnimationDirection.BACK]: { framePrefix: 'Fire_Run_back', frameCount: 8, frameRate: 10, loop: true }
            },
            [AnimationState.ATTACK]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Fire_Attack_front', frameCount: 8, frameRate: 12, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Fire_Attack_back', frameCount: 8, frameRate: 12, loop: false }
            },
            [AnimationState.HURT]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Fire_Hurt_front', frameCount: 4, frameRate: 15, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Fire_Hurt_back', frameCount: 4, frameRate: 15, loop: false }
            },
            [AnimationState.DEATH]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Fire_Death_front', frameCount: 6, frameRate: 8, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Fire_Death_back', frameCount: 6, frameRate: 8, loop: false }
            }
        }
    },

    // Slime3: Crystal史莱姆 (from monster/slime1.plist)
    'Slime3': {
        plistUrl: 'monster/slime1',
        assetNamePrefix: 'Slime3',
        animations: {
            [AnimationState.IDLE]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Crystal_Idle_front', frameCount: 6, frameRate: 8, loop: true },
                [AnimationDirection.BACK]: { framePrefix: 'Crystal_Idle_back', frameCount: 6, frameRate: 8, loop: true }
            },
            [AnimationState.WALK]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Crystal_Run_front', frameCount: 8, frameRate: 10, loop: true },
                [AnimationDirection.BACK]: { framePrefix: 'Crystal_Run_back', frameCount: 8, frameRate: 10, loop: true }
            },
            [AnimationState.ATTACK]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Crystal_Attack_front', frameCount: 8, frameRate: 12, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Crystal_Attack_back', frameCount: 8, frameRate: 12, loop: false }
            },
            [AnimationState.HURT]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Crystal_Hurt_front', frameCount: 4, frameRate: 15, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Crystal_Hurt_back', frameCount: 4, frameRate: 15, loop: false }
            },
            [AnimationState.DEATH]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Crystal_Death_front', frameCount: 6, frameRate: 8, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Crystal_Death_back', frameCount: 6, frameRate: 8, loop: false }
            }
        }
    },

    // Slime4: Ghost史莱姆 (from monster/slime2.plist)
    'Slime4': {
        plistUrl: 'monster/slime2',
        assetNamePrefix: 'Slime4',
        animations: {
            [AnimationState.IDLE]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Ghost_Idle_front', frameCount: 6, frameRate: 8, loop: true },
                [AnimationDirection.BACK]: { framePrefix: 'Ghost_Idle_back', frameCount: 6, frameRate: 8, loop: true }
            },
            [AnimationState.WALK]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Ghost_Run_front', frameCount: 8, frameRate: 10, loop: true },
                [AnimationDirection.BACK]: { framePrefix: 'Ghost_Run_back', frameCount: 8, frameRate: 10, loop: true }
            },
            [AnimationState.ATTACK]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Ghost_Attack_front', frameCount: 8, frameRate: 12, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Ghost_Attack_back', frameCount: 8, frameRate: 12, loop: false }
            },
            [AnimationState.HURT]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Ghost_Hurt_front', frameCount: 4, frameRate: 15, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Ghost_Hurt_back', frameCount: 4, frameRate: 15, loop: false }
            },
            [AnimationState.DEATH]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Ghost_Death_front', frameCount: 6, frameRate: 8, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Ghost_Death_back', frameCount: 6, frameRate: 8, loop: false }
            }
        }
    },

    // Slime5: Lava史莱姆 (from monster/slime2.plist)
    'Slime5': {
        plistUrl: 'monster/slime2',
        assetNamePrefix: 'Slime5',
        animations: {
            [AnimationState.IDLE]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Lava_Idle_front', frameCount: 6, frameRate: 8, loop: true },
                [AnimationDirection.BACK]: { framePrefix: 'Lava_Idle_back', frameCount: 6, frameRate: 8, loop: true }
            },
            [AnimationState.WALK]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Lava_Run_front', frameCount: 8, frameRate: 10, loop: true },
                [AnimationDirection.BACK]: { framePrefix: 'Lava_Run_back', frameCount: 8, frameRate: 10, loop: true }
            },
            [AnimationState.ATTACK]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Lava_Attack_front', frameCount: 8, frameRate: 12, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Lava_Attack_back', frameCount: 8, frameRate: 12, loop: false }
            },
            [AnimationState.HURT]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Lava_Hurt_front', frameCount: 4, frameRate: 15, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Lava_Hurt_back', frameCount: 4, frameRate: 15, loop: false }
            },
            [AnimationState.DEATH]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Lava_Death_front', frameCount: 6, frameRate: 8, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Lava_Death_back', frameCount: 6, frameRate: 8, loop: false }
            }
        }
    },

    // Slime6: Normal史莱姆 (from monster/slime2.plist)
    'Slime6': {
        plistUrl: 'monster/slime2',
        assetNamePrefix: 'Slime6',
        animations: {
            [AnimationState.IDLE]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Normal_Idle_front', frameCount: 6, frameRate: 8, loop: true },
                [AnimationDirection.BACK]: { framePrefix: 'Normal_Idle_back', frameCount: 6, frameRate: 8, loop: true }
            },
            [AnimationState.WALK]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Normal_Run_front', frameCount: 8, frameRate: 10, loop: true },
                [AnimationDirection.BACK]: { framePrefix: 'Normal_Run_back', frameCount: 8, frameRate: 10, loop: true }
            },
            [AnimationState.ATTACK]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Normal_Attack_front', frameCount: 8, frameRate: 12, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Normal_Attack_back', frameCount: 8, frameRate: 12, loop: false }
            },
            [AnimationState.HURT]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Normal_Hurt_front', frameCount: 4, frameRate: 15, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Normal_Hurt_back', frameCount: 4, frameRate: 15, loop: false }
            },
            [AnimationState.DEATH]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Normal_Death_front', frameCount: 6, frameRate: 8, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Normal_Death_back', frameCount: 6, frameRate: 8, loop: false }
            }
        }
    },

    // Slime7: Devil史莱姆 (from monster/slime3.plist)
    'Slime7': {
        plistUrl: 'monster/slime3',
        assetNamePrefix: 'Slime7',
        animations: {
            [AnimationState.IDLE]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Devil_Idle_front', frameCount: 6, frameRate: 8, loop: true },
                [AnimationDirection.BACK]: { framePrefix: 'Devil_Idle_back', frameCount: 6, frameRate: 8, loop: true }
            },
            [AnimationState.WALK]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Devil_Run_front', frameCount: 8, frameRate: 10, loop: true },
                [AnimationDirection.BACK]: { framePrefix: 'Devil_Run_back', frameCount: 8, frameRate: 10, loop: true }
            },
            [AnimationState.ATTACK]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Devil_Attack_front', frameCount: 8, frameRate: 12, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Devil_Attack_back', frameCount: 8, frameRate: 12, loop: false }
            },
            [AnimationState.HURT]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Devil_Hurt_front', frameCount: 4, frameRate: 15, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Devil_Hurt_back', frameCount: 4, frameRate: 15, loop: false }
            },
            [AnimationState.DEATH]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Devil_Death_front', frameCount: 6, frameRate: 8, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Devil_Death_back', frameCount: 6, frameRate: 8, loop: false }
            }
        }
    },

    // Slime8: Ice史莱姆 (from monster/slime3.plist)
    'Slime8': {
        plistUrl: 'monster/slime3',
        assetNamePrefix: 'Slime8',
        animations: {
            [AnimationState.IDLE]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Ice_Idle_front', frameCount: 6, frameRate: 8, loop: true },
                [AnimationDirection.BACK]: { framePrefix: 'Ice_Idle_back', frameCount: 6, frameRate: 8, loop: true }
            },
            [AnimationState.WALK]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Ice_Run_front', frameCount: 8, frameRate: 10, loop: true },
                [AnimationDirection.BACK]: { framePrefix: 'Ice_Run_back', frameCount: 8, frameRate: 10, loop: true }
            },
            [AnimationState.ATTACK]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Ice_Attack_front', frameCount: 8, frameRate: 12, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Ice_Attack_back', frameCount: 8, frameRate: 12, loop: false }
            },
            [AnimationState.HURT]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Ice_Hurt_front', frameCount: 4, frameRate: 15, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Ice_Hurt_back', frameCount: 4, frameRate: 15, loop: false }
            },
            [AnimationState.DEATH]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Ice_Death_front', frameCount: 6, frameRate: 8, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Ice_Death_back', frameCount: 6, frameRate: 8, loop: false }
            }
        }
    },

    // Slime9: Lightning史莱姆 (from monster/slime3.plist)
    'Slime9': {
        plistUrl: 'monster/slime3',
        assetNamePrefix: 'Slime9',
        animations: {
            [AnimationState.IDLE]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Lightning_Idle_front', frameCount: 6, frameRate: 8, loop: true },
                [AnimationDirection.BACK]: { framePrefix: 'Lightning_Idle_back', frameCount: 6, frameRate: 8, loop: true }
            },
            [AnimationState.WALK]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Lightning_Run_front', frameCount: 8, frameRate: 10, loop: true },
                [AnimationDirection.BACK]: { framePrefix: 'Lightning_Run_back', frameCount: 8, frameRate: 10, loop: true }
            },
            [AnimationState.ATTACK]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Lightning_Attack_front', frameCount: 8, frameRate: 12, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Lightning_Attack_back', frameCount: 8, frameRate: 12, loop: false }
            },
            [AnimationState.HURT]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Lightning_Hurt_front', frameCount: 4, frameRate: 15, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Lightning_Hurt_back', frameCount: 4, frameRate: 15, loop: false }
            },
            [AnimationState.DEATH]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Lightning_Death_front', frameCount: 6, frameRate: 8, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Lightning_Death_back', frameCount: 6, frameRate: 8, loop: false }
            }
        }
    },

    // Skeleton1 (骷髅) 动画配置 - 复用Orc作为占位符 (已适配首字母大写)
    'Skeleton1': {
        plistUrl: 'monster/orc',
        assetNamePrefix: 'Orc1', // 复用Orc的图集和前缀
        animations: {
            [AnimationState.IDLE]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Orc1_front_idle', frameCount: 4, frameRate: 8, loop: true },
                [AnimationDirection.BACK]: { framePrefix: 'Orc1_back_idle', frameCount: 4, frameRate: 8, loop: true },
                [AnimationDirection.LEFT]: { framePrefix: 'Orc1_left_idle', frameCount: 4, frameRate: 8, loop: true },
                [AnimationDirection.RIGHT]: { framePrefix: 'Orc1_right_idle', frameCount: 4, frameRate: 8, loop: true }
            },
            [AnimationState.WALK]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Orc1_front_walk', frameCount: 6, frameRate: 10, loop: true },
                [AnimationDirection.BACK]: { framePrefix: 'Orc1_back_walk', frameCount: 6, frameRate: 10, loop: true },
                [AnimationDirection.LEFT]: { framePrefix: 'Orc1_left_walk', frameCount: 6, frameRate: 10, loop: true },
                [AnimationDirection.RIGHT]: { framePrefix: 'Orc1_right_walk', frameCount: 6, frameRate: 10, loop: true }
            },
            [AnimationState.ATTACK]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Orc1_front_attack', frameCount: 8, frameRate: 12, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Orc1_back_attack', frameCount: 8, frameRate: 12, loop: false },
                [AnimationDirection.LEFT]: { framePrefix: 'Orc1_left_attack', frameCount: 8, frameRate: 12, loop: false },
                [AnimationDirection.RIGHT]: { framePrefix: 'Orc1_right_attack', frameCount: 8, frameRate: 12, loop: false }
            },
            [AnimationState.HURT]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Orc1_front_hurt', frameCount: 6, frameRate: 15, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Orc1_back_hurt', frameCount: 6, frameRate: 15, loop: false },
                [AnimationDirection.LEFT]: { framePrefix: 'Orc1_left_hurt', frameCount: 6, frameRate: 15, loop: false },
                [AnimationDirection.RIGHT]: { framePrefix: 'Orc1_right_hurt', frameCount: 6, frameRate: 15, loop: false }
            },
            [AnimationState.DEATH]: {
                [AnimationDirection.FRONT]: { framePrefix: 'Orc1_front_death', frameCount: 8, frameRate: 8, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Orc1_back_death', frameCount: 8, frameRate: 8, loop: false },
                [AnimationDirection.LEFT]: { framePrefix: 'Orc1_left_death', frameCount: 8, frameRate: 8, loop: false },
                [AnimationDirection.RIGHT]: { framePrefix: 'Orc1_right_death', frameCount: 8, frameRate: 8, loop: false }
            }
        }
    },

    // Normal史莱姆 (from monster/slime2.plist) - 匹配enemies.json中的assetNamePrefix: "normal"
    'normal': {
        plistUrl: 'monster/slime2',
        assetNamePrefix: 'normal',
        animations: {
            [AnimationState.IDLE]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Normal_Idle_front', frameCount: 6, frameRate: 8, loop: true },
                [AnimationDirection.BACK]: { framePrefix: 'Normal_Idle_back', frameCount: 6, frameRate: 8, loop: true },
                [AnimationDirection.LEFT]: { framePrefix: 'Normal_Idle_left', frameCount: 6, frameRate: 8, loop: true },
                [AnimationDirection.RIGHT]: { framePrefix: 'Normal_Idle_right', frameCount: 6, frameRate: 8, loop: true }
            },
            [AnimationState.WALK]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Normal_Run_front', frameCount: 8, frameRate: 10, loop: true },
                [AnimationDirection.BACK]: { framePrefix: 'Normal_Run_back', frameCount: 8, frameRate: 10, loop: true },
                [AnimationDirection.LEFT]: { framePrefix: 'Normal_Run_left', frameCount: 8, frameRate: 10, loop: true },
                [AnimationDirection.RIGHT]: { framePrefix: 'Normal_Run_right', frameCount: 8, frameRate: 10, loop: true }
            },
            [AnimationState.ATTACK]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Normal_Attack_front', frameCount: 8, frameRate: 12, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Normal_Attack_back', frameCount: 8, frameRate: 12, loop: false },
                [AnimationDirection.LEFT]: { framePrefix: 'Normal_Attack_left', frameCount: 8, frameRate: 12, loop: false },
                [AnimationDirection.RIGHT]: { framePrefix: 'Normal_Attack_right', frameCount: 8, frameRate: 12, loop: false }
            },
            [AnimationState.HURT]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Normal_Hurt_front', frameCount: 4, frameRate: 15, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Normal_Hurt_back', frameCount: 4, frameRate: 15, loop: false },
                [AnimationDirection.LEFT]: { framePrefix: 'Normal_Hurt_left', frameCount: 4, frameRate: 15, loop: false },
                [AnimationDirection.RIGHT]: { framePrefix: 'Normal_Hurt_right', frameCount: 4, frameRate: 15, loop: false }
            },
            [AnimationState.DEATH]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Normal_Death_front', frameCount: 6, frameRate: 8, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Normal_Death_back', frameCount: 6, frameRate: 8, loop: false },
                [AnimationDirection.LEFT]: { framePrefix: 'Normal_Death_left', frameCount: 6, frameRate: 8, loop: false },
                [AnimationDirection.RIGHT]: { framePrefix: 'Normal_Death_right', frameCount: 6, frameRate: 8, loop: false }
            }
        }
    },

    // Bomb史莱姆 (from monster/slime1.plist) - 匹配enemies.json中的assetNamePrefix: "bomb"
    'bomb': {
        plistUrl: 'monster/slime1',
        assetNamePrefix: 'bomb',
        animations: {
            [AnimationState.IDLE]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Bomb_Idle_front', frameCount: 6, frameRate: 8, loop: true },
                [AnimationDirection.BACK]: { framePrefix: 'Bomb_Idle_back', frameCount: 6, frameRate: 8, loop: true },
                [AnimationDirection.LEFT]: { framePrefix: 'Bomb_Idle_left', frameCount: 6, frameRate: 8, loop: true },
                [AnimationDirection.RIGHT]: { framePrefix: 'Bomb_Idle_right', frameCount: 6, frameRate: 8, loop: true }
            },
            [AnimationState.WALK]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Bomb_Run_front', frameCount: 8, frameRate: 10, loop: true },
                [AnimationDirection.BACK]: { framePrefix: 'Bomb_Run_back', frameCount: 8, frameRate: 10, loop: true },
                [AnimationDirection.LEFT]: { framePrefix: 'Bomb_Run_left', frameCount: 8, frameRate: 10, loop: true },
                [AnimationDirection.RIGHT]: { framePrefix: 'Bomb_Run_right', frameCount: 8, frameRate: 10, loop: true }
            },
            [AnimationState.ATTACK]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Bomb_Attack_front', frameCount: 8, frameRate: 12, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Bomb_Attack_back', frameCount: 8, frameRate: 12, loop: false },
                [AnimationDirection.LEFT]: { framePrefix: 'Bomb_Attack_left', frameCount: 8, frameRate: 12, loop: false },
                [AnimationDirection.RIGHT]: { framePrefix: 'Bomb_Attack_right', frameCount: 8, frameRate: 12, loop: false }
            },
            [AnimationState.HURT]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Bomb_Hurt_front', frameCount: 4, frameRate: 15, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Bomb_Hurt_back', frameCount: 4, frameRate: 15, loop: false },
                [AnimationDirection.LEFT]: { framePrefix: 'Bomb_Hurt_left', frameCount: 4, frameRate: 15, loop: false },
                [AnimationDirection.RIGHT]: { framePrefix: 'Bomb_Hurt_right', frameCount: 4, frameRate: 15, loop: false }
            },
            [AnimationState.DEATH]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Bomb_Death_front', frameCount: 6, frameRate: 8, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Bomb_Death_back', frameCount: 6, frameRate: 8, loop: false },
                [AnimationDirection.LEFT]: { framePrefix: 'Bomb_Death_left', frameCount: 6, frameRate: 8, loop: false },
                [AnimationDirection.RIGHT]: { framePrefix: 'Bomb_Death_right', frameCount: 6, frameRate: 8, loop: false }
            }
        }
    },

    // Ice史莱姆 (from monster/slime3.plist) - 匹配enemies.json中的assetNamePrefix: "ice"
    'ice': {
        plistUrl: 'monster/slime3',
        assetNamePrefix: 'ice',
        animations: {
            [AnimationState.IDLE]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Ice_Idle_front', frameCount: 6, frameRate: 8, loop: true },
                [AnimationDirection.BACK]: { framePrefix: 'Ice_Idle_back', frameCount: 6, frameRate: 8, loop: true },
                [AnimationDirection.LEFT]: { framePrefix: 'Ice_Idle_left', frameCount: 6, frameRate: 8, loop: true },
                [AnimationDirection.RIGHT]: { framePrefix: 'Ice_Idle_right', frameCount: 6, frameRate: 8, loop: true }
            },
            [AnimationState.WALK]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Ice_Run_front', frameCount: 8, frameRate: 10, loop: true },
                [AnimationDirection.BACK]: { framePrefix: 'Ice_Run_back', frameCount: 8, frameRate: 10, loop: true },
                [AnimationDirection.LEFT]: { framePrefix: 'Ice_Run_left', frameCount: 8, frameRate: 10, loop: true },
                [AnimationDirection.RIGHT]: { framePrefix: 'Ice_Run_right', frameCount: 8, frameRate: 10, loop: true }
            },
            [AnimationState.ATTACK]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Ice_Attack_front', frameCount: 8, frameRate: 12, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Ice_Attack_back', frameCount: 8, frameRate: 12, loop: false },
                [AnimationDirection.LEFT]: { framePrefix: 'Ice_Attack_left', frameCount: 8, frameRate: 12, loop: false },
                [AnimationDirection.RIGHT]: { framePrefix: 'Ice_Attack_right', frameCount: 8, frameRate: 12, loop: false }
            },
            [AnimationState.HURT]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Ice_Hurt_front', frameCount: 4, frameRate: 15, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Ice_Hurt_back', frameCount: 4, frameRate: 15, loop: false },
                [AnimationDirection.LEFT]: { framePrefix: 'Ice_Hurt_left', frameCount: 4, frameRate: 15, loop: false },
                [AnimationDirection.RIGHT]: { framePrefix: 'Ice_Hurt_right', frameCount: 4, frameRate: 15, loop: false }
            },
            [AnimationState.DEATH]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Ice_Death_front', frameCount: 6, frameRate: 8, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Ice_Death_back', frameCount: 6, frameRate: 8, loop: false },
                [AnimationDirection.LEFT]: { framePrefix: 'Ice_Death_left', frameCount: 6, frameRate: 8, loop: false },
                [AnimationDirection.RIGHT]: { framePrefix: 'Ice_Death_right', frameCount: 6, frameRate: 8, loop: false }
            }
        }
    },

    // Fire史莱姆 (from monster/slime1.plist) - 匹配enemies.json中的assetNamePrefix: "fire"
    'fire': {
        plistUrl: 'monster/slime1',
        assetNamePrefix: 'fire',
        animations: {
            [AnimationState.IDLE]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Fire_Idle_front', frameCount: 6, frameRate: 8, loop: true },
                [AnimationDirection.BACK]: { framePrefix: 'Fire_Idle_back', frameCount: 6, frameRate: 8, loop: true },
                [AnimationDirection.LEFT]: { framePrefix: 'Fire_Idle_left', frameCount: 6, frameRate: 8, loop: true },
                [AnimationDirection.RIGHT]: { framePrefix: 'Fire_Idle_right', frameCount: 6, frameRate: 8, loop: true }
            },
            [AnimationState.WALK]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Fire_Run_front', frameCount: 8, frameRate: 10, loop: true },
                [AnimationDirection.BACK]: { framePrefix: 'Fire_Run_back', frameCount: 8, frameRate: 10, loop: true },
                [AnimationDirection.LEFT]: { framePrefix: 'Fire_Run_left', frameCount: 8, frameRate: 10, loop: true },
                [AnimationDirection.RIGHT]: { framePrefix: 'Fire_Run_right', frameCount: 8, frameRate: 10, loop: true }
            },
            [AnimationState.ATTACK]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Fire_Attack_front', frameCount: 8, frameRate: 12, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Fire_Attack_back', frameCount: 8, frameRate: 12, loop: false },
                [AnimationDirection.LEFT]: { framePrefix: 'Fire_Attack_left', frameCount: 8, frameRate: 12, loop: false },
                [AnimationDirection.RIGHT]: { framePrefix: 'Fire_Attack_right', frameCount: 8, frameRate: 12, loop: false }
            },
            [AnimationState.HURT]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Fire_Hurt_front', frameCount: 4, frameRate: 15, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Fire_Hurt_back', frameCount: 4, frameRate: 15, loop: false },
                [AnimationDirection.LEFT]: { framePrefix: 'Fire_Hurt_left', frameCount: 4, frameRate: 15, loop: false },
                [AnimationDirection.RIGHT]: { framePrefix: 'Fire_Hurt_right', frameCount: 4, frameRate: 15, loop: false }
            },
            [AnimationState.DEATH]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Fire_Death_front', frameCount: 6, frameRate: 8, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Fire_Death_back', frameCount: 6, frameRate: 8, loop: false },
                [AnimationDirection.LEFT]: { framePrefix: 'Fire_Death_left', frameCount: 6, frameRate: 8, loop: false },
                [AnimationDirection.RIGHT]: { framePrefix: 'Fire_Death_right', frameCount: 6, frameRate: 8, loop: false }
            }
        }
    },

    // Ghost史莱姆 (from monster/slime2.plist) - 匹配enemies.json中的assetNamePrefix: "ghost"
    'ghost': {
        plistUrl: 'monster/slime2',
        assetNamePrefix: 'ghost',
        animations: {
            [AnimationState.IDLE]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Ghost_Idle_front', frameCount: 6, frameRate: 8, loop: true },
                [AnimationDirection.BACK]: { framePrefix: 'Ghost_Idle_back', frameCount: 6, frameRate: 8, loop: true },
                [AnimationDirection.LEFT]: { framePrefix: 'Ghost_Idle_left', frameCount: 6, frameRate: 8, loop: true },
                [AnimationDirection.RIGHT]: { framePrefix: 'Ghost_Idle_right', frameCount: 6, frameRate: 8, loop: true }
            },
            [AnimationState.WALK]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Ghost_Run_front', frameCount: 8, frameRate: 10, loop: true },
                [AnimationDirection.BACK]: { framePrefix: 'Ghost_Run_back', frameCount: 8, frameRate: 10, loop: true },
                [AnimationDirection.LEFT]: { framePrefix: 'Ghost_Run_left', frameCount: 8, frameRate: 10, loop: true },
                [AnimationDirection.RIGHT]: { framePrefix: 'Ghost_Run_right', frameCount: 8, frameRate: 10, loop: true }
            },
            [AnimationState.ATTACK]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Ghost_Attack_front', frameCount: 8, frameRate: 12, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Ghost_Attack_back', frameCount: 8, frameRate: 12, loop: false },
                [AnimationDirection.LEFT]: { framePrefix: 'Ghost_Attack_left', frameCount: 8, frameRate: 12, loop: false },
                [AnimationDirection.RIGHT]: { framePrefix: 'Ghost_Attack_right', frameCount: 8, frameRate: 12, loop: false }
            },
            [AnimationState.HURT]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Ghost_Hurt_front', frameCount: 4, frameRate: 15, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Ghost_Hurt_back', frameCount: 4, frameRate: 15, loop: false },
                [AnimationDirection.LEFT]: { framePrefix: 'Ghost_Hurt_left', frameCount: 4, frameRate: 15, loop: false },
                [AnimationDirection.RIGHT]: { framePrefix: 'Ghost_Hurt_right', frameCount: 4, frameRate: 15, loop: false }
            },
            [AnimationState.DEATH]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Ghost_Death_front', frameCount: 6, frameRate: 8, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Ghost_Death_back', frameCount: 6, frameRate: 8, loop: false },
                [AnimationDirection.LEFT]: { framePrefix: 'Ghost_Death_left', frameCount: 6, frameRate: 8, loop: false },
                [AnimationDirection.RIGHT]: { framePrefix: 'Ghost_Death_right', frameCount: 6, frameRate: 8, loop: false }
            }
        }
    },

    // Lightning史莱姆 (from monster/slime3.plist) - 匹配enemies.json中的assetNamePrefix: "lightning"
    'lightning': {
        plistUrl: 'monster/slime3',
        assetNamePrefix: 'lightning',
        animations: {
            [AnimationState.IDLE]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Lightning_Idle_front', frameCount: 6, frameRate: 8, loop: true },
                [AnimationDirection.BACK]: { framePrefix: 'Lightning_Idle_back', frameCount: 6, frameRate: 8, loop: true },
                [AnimationDirection.LEFT]: { framePrefix: 'Lightning_Idle_left', frameCount: 6, frameRate: 8, loop: true },
                [AnimationDirection.RIGHT]: { framePrefix: 'Lightning_Idle_right', frameCount: 6, frameRate: 8, loop: true }
            },
            [AnimationState.WALK]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Lightning_Run_front', frameCount: 8, frameRate: 10, loop: true },
                [AnimationDirection.BACK]: { framePrefix: 'Lightning_Run_back', frameCount: 8, frameRate: 10, loop: true },
                [AnimationDirection.LEFT]: { framePrefix: 'Lightning_Run_left', frameCount: 8, frameRate: 10, loop: true },
                [AnimationDirection.RIGHT]: { framePrefix: 'Lightning_Run_right', frameCount: 8, frameRate: 10, loop: true }
            },
            [AnimationState.ATTACK]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Lightning_Attack_front', frameCount: 8, frameRate: 12, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Lightning_Attack_back', frameCount: 8, frameRate: 12, loop: false },
                [AnimationDirection.LEFT]: { framePrefix: 'Lightning_Attack_left', frameCount: 8, frameRate: 12, loop: false },
                [AnimationDirection.RIGHT]: { framePrefix: 'Lightning_Attack_right', frameCount: 8, frameRate: 12, loop: false }
            },
            [AnimationState.HURT]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Lightning_Hurt_front', frameCount: 4, frameRate: 15, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Lightning_Hurt_back', frameCount: 4, frameRate: 15, loop: false },
                [AnimationDirection.LEFT]: { framePrefix: 'Lightning_Hurt_left', frameCount: 4, frameRate: 15, loop: false },
                [AnimationDirection.RIGHT]: { framePrefix: 'Lightning_Hurt_right', frameCount: 4, frameRate: 15, loop: false }
            },
            [AnimationState.DEATH]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Lightning_Death_front', frameCount: 6, frameRate: 8, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Lightning_Death_back', frameCount: 6, frameRate: 8, loop: false },
                [AnimationDirection.LEFT]: { framePrefix: 'Lightning_Death_left', frameCount: 6, frameRate: 8, loop: false },
                [AnimationDirection.RIGHT]: { framePrefix: 'Lightning_Death_right', frameCount: 6, frameRate: 8, loop: false }
            }
        }
    },

    // Crystal史莱姆 (from monster/slime1.plist) - 匹配enemies.json中的assetNamePrefix: "crystal"
    'crystal': {
        plistUrl: 'monster/slime1',
        assetNamePrefix: 'crystal',
        animations: {
            [AnimationState.IDLE]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Crystal_Idle_front', frameCount: 6, frameRate: 8, loop: true },
                [AnimationDirection.BACK]: { framePrefix: 'Crystal_Idle_back', frameCount: 6, frameRate: 8, loop: true },
                [AnimationDirection.LEFT]: { framePrefix: 'Crystal_Idle_left', frameCount: 6, frameRate: 8, loop: true },
                [AnimationDirection.RIGHT]: { framePrefix: 'Crystal_Idle_right', frameCount: 6, frameRate: 8, loop: true }
            },
            [AnimationState.WALK]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Crystal_Run_front', frameCount: 8, frameRate: 10, loop: true },
                [AnimationDirection.BACK]: { framePrefix: 'Crystal_Run_back', frameCount: 8, frameRate: 10, loop: true },
                [AnimationDirection.LEFT]: { framePrefix: 'Crystal_Run_left', frameCount: 8, frameRate: 10, loop: true },
                [AnimationDirection.RIGHT]: { framePrefix: 'Crystal_Run_right', frameCount: 8, frameRate: 10, loop: true }
            },
            [AnimationState.ATTACK]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Crystal_Attack_front', frameCount: 8, frameRate: 12, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Crystal_Attack_back', frameCount: 8, frameRate: 12, loop: false },
                [AnimationDirection.LEFT]: { framePrefix: 'Crystal_Attack_left', frameCount: 8, frameRate: 12, loop: false },
                [AnimationDirection.RIGHT]: { framePrefix: 'Crystal_Attack_right', frameCount: 8, frameRate: 12, loop: false }
            },
            [AnimationState.HURT]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Crystal_Hurt_front', frameCount: 4, frameRate: 15, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Crystal_Hurt_back', frameCount: 4, frameRate: 15, loop: false },
                [AnimationDirection.LEFT]: { framePrefix: 'Crystal_Hurt_left', frameCount: 4, frameRate: 15, loop: false },
                [AnimationDirection.RIGHT]: { framePrefix: 'Crystal_Hurt_right', frameCount: 4, frameRate: 15, loop: false }
            },
            [AnimationState.DEATH]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Crystal_Death_front', frameCount: 6, frameRate: 8, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Crystal_Death_back', frameCount: 6, frameRate: 8, loop: false },
                [AnimationDirection.LEFT]: { framePrefix: 'Crystal_Death_left', frameCount: 6, frameRate: 8, loop: false },
                [AnimationDirection.RIGHT]: { framePrefix: 'Crystal_Death_right', frameCount: 6, frameRate: 8, loop: false }
            }
        }
    },

    // Devil史莱姆 (from monster/slime3.plist) - 匹配enemies.json中的assetNamePrefix: "devil"
    'devil': {
        plistUrl: 'monster/slime3',
        assetNamePrefix: 'devil',
        animations: {
            [AnimationState.IDLE]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Devil_Idle_front', frameCount: 6, frameRate: 8, loop: true },
                [AnimationDirection.BACK]: { framePrefix: 'Devil_Idle_back', frameCount: 6, frameRate: 8, loop: true },
                [AnimationDirection.LEFT]: { framePrefix: 'Devil_Idle_left', frameCount: 6, frameRate: 8, loop: true },
                [AnimationDirection.RIGHT]: { framePrefix: 'Devil_Idle_right', frameCount: 6, frameRate: 8, loop: true }
            },
            [AnimationState.WALK]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Devil_Run_front', frameCount: 8, frameRate: 10, loop: true },
                [AnimationDirection.BACK]: { framePrefix: 'Devil_Run_back', frameCount: 8, frameRate: 10, loop: true },
                [AnimationDirection.LEFT]: { framePrefix: 'Devil_Run_left', frameCount: 8, frameRate: 10, loop: true },
                [AnimationDirection.RIGHT]: { framePrefix: 'Devil_Run_right', frameCount: 8, frameRate: 10, loop: true }
            },
            [AnimationState.ATTACK]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Devil_Attack_front', frameCount: 8, frameRate: 12, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Devil_Attack_back', frameCount: 8, frameRate: 12, loop: false },
                [AnimationDirection.LEFT]: { framePrefix: 'Devil_Attack_left', frameCount: 8, frameRate: 12, loop: false },
                [AnimationDirection.RIGHT]: { framePrefix: 'Devil_Attack_right', frameCount: 8, frameRate: 12, loop: false }
            },
            [AnimationState.HURT]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Devil_Hurt_front', frameCount: 4, frameRate: 15, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Devil_Hurt_back', frameCount: 4, frameRate: 15, loop: false },
                [AnimationDirection.LEFT]: { framePrefix: 'Devil_Hurt_left', frameCount: 4, frameRate: 15, loop: false },
                [AnimationDirection.RIGHT]: { framePrefix: 'Devil_Hurt_right', frameCount: 4, frameRate: 15, loop: false }
            },
            [AnimationState.DEATH]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Devil_Death_front', frameCount: 6, frameRate: 8, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Devil_Death_back', frameCount: 6, frameRate: 8, loop: false },
                [AnimationDirection.LEFT]: { framePrefix: 'Devil_Death_left', frameCount: 6, frameRate: 8, loop: false },
                [AnimationDirection.RIGHT]: { framePrefix: 'Devil_Death_right', frameCount: 6, frameRate: 8, loop: false }
            }
        }
    },

    // Lava史莱姆 (from monster/slime2.plist) - 匹配enemies.json中的assetNamePrefix: "lava"
    'lava': {
        plistUrl: 'monster/slime2',
        assetNamePrefix: 'lava',
        animations: {
            [AnimationState.IDLE]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Lava_Idle_front', frameCount: 6, frameRate: 8, loop: true },
                [AnimationDirection.BACK]: { framePrefix: 'Lava_Idle_back', frameCount: 6, frameRate: 8, loop: true },
                [AnimationDirection.LEFT]: { framePrefix: 'Lava_Idle_left', frameCount: 6, frameRate: 8, loop: true },
                [AnimationDirection.RIGHT]: { framePrefix: 'Lava_Idle_right', frameCount: 6, frameRate: 8, loop: true }
            },
            [AnimationState.WALK]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Lava_Run_front', frameCount: 8, frameRate: 10, loop: true },
                [AnimationDirection.BACK]: { framePrefix: 'Lava_Run_back', frameCount: 8, frameRate: 10, loop: true },
                [AnimationDirection.LEFT]: { framePrefix: 'Lava_Run_left', frameCount: 8, frameRate: 10, loop: true },
                [AnimationDirection.RIGHT]: { framePrefix: 'Lava_Run_right', frameCount: 8, frameRate: 10, loop: true }
            },
            [AnimationState.ATTACK]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Lava_Attack_front', frameCount: 8, frameRate: 12, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Lava_Attack_back', frameCount: 8, frameRate: 12, loop: false },
                [AnimationDirection.LEFT]: { framePrefix: 'Lava_Attack_left', frameCount: 8, frameRate: 12, loop: false },
                [AnimationDirection.RIGHT]: { framePrefix: 'Lava_Attack_right', frameCount: 8, frameRate: 12, loop: false }
            },
            [AnimationState.HURT]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Lava_Hurt_front', frameCount: 4, frameRate: 15, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Lava_Hurt_back', frameCount: 4, frameRate: 15, loop: false },
                [AnimationDirection.LEFT]: { framePrefix: 'Lava_Hurt_left', frameCount: 4, frameRate: 15, loop: false },
                [AnimationDirection.RIGHT]: { framePrefix: 'Lava_Hurt_right', frameCount: 4, frameRate: 15, loop: false }
            },
            [AnimationState.DEATH]: { 
                [AnimationDirection.FRONT]: { framePrefix: 'Lava_Death_front', frameCount: 6, frameRate: 8, loop: false },
                [AnimationDirection.BACK]: { framePrefix: 'Lava_Death_back', frameCount: 6, frameRate: 8, loop: false },
                [AnimationDirection.LEFT]: { framePrefix: 'Lava_Death_left', frameCount: 6, frameRate: 8, loop: false },
                [AnimationDirection.RIGHT]: { framePrefix: 'Lava_Death_right', frameCount: 6, frameRate: 8, loop: false }
            }
        }
    }
};

/**
 * 根据资源名前缀获取动画配置
 * @param assetNamePrefix 资源名前缀
 * @returns 动画配置或null
 */
export function getAnimationConfigByPrefix(assetNamePrefix: string): EnemyAnimationConfig | null {
    return animationConfigDatabase[assetNamePrefix] || null;
}

/**
 * 获取所有可用的动画配置前缀
 * @returns 前缀数组
 */
export function getAllAnimationPrefixes(): string[] {
    return Object.keys(animationConfigDatabase);
}

/**
 * 动画状态映射：从新的枚举到原有的枚举
 */
export const animationStateMapping: Record<string, AnimationState> = {
    'idle': AnimationState.IDLE,
    'move': AnimationState.WALK,    // 将move映射到walk
    'attack': AnimationState.ATTACK,
    'hurt': AnimationState.HURT,
    'die': AnimationState.DEATH,    // 将die映射到death
    'cast': AnimationState.CAST,
    'defend': AnimationState.DEFEND
};

/**
 * 获取映射后的动画状态
 * @param state 原始状态
 * @returns 映射后的状态
 */
export function getMappedAnimationState(state: string): AnimationState {
    return animationStateMapping[state] || AnimationState.IDLE;
}

/**
 * 根据移动向量计算动画方向 - 按向量分量大小决定
 * 优先级：X轴和Y轴中绝对值较大的分量决定方向
 * @param deltaX X轴分量
 * @param deltaY Y轴分量
 * @returns 动画方向
 */
export function calculateAnimationDirectionFromVector(deltaX: number, deltaY: number, nodeName?: string): AnimationDirection {
    const nodePrefix = nodeName ? `[${nodeName}]` : '';
    
    // 如果向量长度为0（没有移动），返回默认朝向
    if (Math.abs(deltaX) < 0.001 && Math.abs(deltaY) < 0.001) {
        console.log(`${nodePrefix}[Direction] 零向量，返回默认朝向: FRONT`);
        return AnimationDirection.FRONT;
    }
    
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    let result: AnimationDirection;
    
    // 比较X轴和Y轴分量的绝对值，选择绝对值更大的轴
    if (absX > absY) {
        // 水平方向为主导
        result = deltaX > 0 ? AnimationDirection.RIGHT : AnimationDirection.LEFT;
    } else {
        // 垂直方向为主导
        result = deltaY > 0 ? AnimationDirection.BACK : AnimationDirection.FRONT;
    }
    
    return result;
}

/**
 * 根据目标位置计算朝向 - 统一接口
 * @param currentX 当前X坐标
 * @param currentY 当前Y坐标
 * @param targetX 目标X坐标
 * @param targetY 目标Y坐标
 * @param nodeName 节点名称（用于调试）
 * @returns 动画方向
 */
export function calculateDirectionToTarget(currentX: number, currentY: number, targetX: number, targetY: number, nodeName?: string): AnimationDirection {
    const deltaX = targetX - currentX;
    const deltaY = targetY - currentY;
    return calculateAnimationDirectionFromVector(deltaX, deltaY, nodeName);
}

/**
 * 从Vec2向量计算动画方向 - 便利方法
 * @param vector 移动向量
 * @param nodeName 节点名称（用于调试）
 * @returns 动画方向
 */
export function calculateDirectionFromVec2(vector: { x: number, y: number }, nodeName?: string): AnimationDirection {
    return calculateAnimationDirectionFromVector(vector.x, vector.y, nodeName);
}

// ============= 投射物动画配置 =============

/**
 * 投射物动画配置接口
 */
export interface ProjectileAnimationConfig {
    plistUrl: string;       // 图集路径
    assetNamePrefix: string; // 资源名前缀
    animations: {
        [key in ProjectileAnimationState]?: {
            framePrefix: string;
            frameCount: number;
            frameRate: number;
            loop: boolean;
        }
    };
}

/**
 * 投射物动画配置数据库
 */
export const projectileAnimationConfigDatabase: Record<string, ProjectileAnimationConfig> = {
    // 火球配置
    'fireball': {
        plistUrl: 'skill/fire',
        assetNamePrefix: 'fireball',
        animations: {
            [ProjectileAnimationState.SPAWN]: { 
                framePrefix: 'Fire_right', 
                frameCount: 1, // 只有第0帧
                frameRate: 12, 
                loop: false 
            },
            [ProjectileAnimationState.FLYING]: { 
                framePrefix: 'Fire_right', 
                frameCount: 3, // 第1-3帧
                frameRate: 12, 
                loop: true 
            },
            [ProjectileAnimationState.EXPLODING]: { 
                framePrefix: 'Fire_right', 
                frameCount: 4, // 第4-7帧
                frameRate: 12, 
                loop: false 
            }
        }
    }
};

/**
 * 根据投射物ID获取动画配置
 * @param projectileId 投射物ID
 * @returns 投射物动画配置
 */
export function getProjectileAnimationConfig(projectileId: string): ProjectileAnimationConfig | null {
    return projectileAnimationConfigDatabase[projectileId] || null;
}