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
                [AnimationDirection.FRONT]: {
                    framePrefix: 'Ent1_Idle_front',
                    frameCount: 4,
                    frameRate: 8,
                    loop: true
                },
                [AnimationDirection.BACK]: {
                    framePrefix: 'Ent1_Idle_back',
                    frameCount: 4,
                    frameRate: 8,
                    loop: true
                },
                [AnimationDirection.LEFT]: {
                    framePrefix: 'Ent1_Idle_left',
                    frameCount: 4,
                    frameRate: 8,
                    loop: true
                },
                [AnimationDirection.RIGHT]: {
                    framePrefix: 'Ent1_Idle_right',
                    frameCount: 4,
                    frameRate: 8,
                    loop: true
                }
            },
            [AnimationState.WALK]: {
                [AnimationDirection.FRONT]: {
                    framePrefix: 'Ent1_Walk_front',
                    frameCount: 6,
                    frameRate: 10,
                    loop: true
                },
                [AnimationDirection.BACK]: {
                    framePrefix: 'Ent1_Walk_back',
                    frameCount: 6,
                    frameRate: 10,
                    loop: true
                },
                [AnimationDirection.LEFT]: {
                    framePrefix: 'Ent1_Walk_left',
                    frameCount: 6,
                    frameRate: 10,
                    loop: true
                },
                [AnimationDirection.RIGHT]: {
                    framePrefix: 'Ent1_Walk_right',
                    frameCount: 6,
                    frameRate: 10,
                    loop: true
                }
            },
            [AnimationState.ATTACK]: {
                [AnimationDirection.FRONT]: {
                    framePrefix: 'Ent1_Attack_front',
                    frameCount: 7,
                    frameRate: 12,
                    loop: false
                },
                [AnimationDirection.BACK]: {
                    framePrefix: 'Ent1_Attack_back',
                    frameCount: 7,
                    frameRate: 12,
                    loop: false
                },
                [AnimationDirection.LEFT]: {
                    framePrefix: 'Ent1_Attack_left',
                    frameCount: 7,
                    frameRate: 12,
                    loop: false
                },
                [AnimationDirection.RIGHT]: {
                    framePrefix: 'Ent1_Attack_right',
                    frameCount: 7,
                    frameRate: 12,
                    loop: false
                }
            },
            [AnimationState.HURT]: {
                [AnimationDirection.FRONT]: {
                    framePrefix: 'Ent1_Hurt_front',
                    frameCount: 4,
                    frameRate: 15,
                    loop: false
                },
                [AnimationDirection.BACK]: {
                    framePrefix: 'Ent1_Hurt_back',
                    frameCount: 4,
                    frameRate: 15,
                    loop: false
                },
                [AnimationDirection.LEFT]: {
                    framePrefix: 'Ent1_Hurt_left',
                    frameCount: 4,
                    frameRate: 15,
                    loop: false
                },
                [AnimationDirection.RIGHT]: {
                    framePrefix: 'Ent1_Hurt_right',
                    frameCount: 4,
                    frameRate: 15,
                    loop: false
                }
            },
            [AnimationState.DEATH]: {
                [AnimationDirection.FRONT]: {
                    framePrefix: 'Ent1_Death_front',
                    frameCount: 6,
                    frameRate: 8,
                    loop: false
                },
                [AnimationDirection.BACK]: {
                    framePrefix: 'Ent1_Death_back',
                    frameCount: 6,
                    frameRate: 8,
                    loop: false
                },
                [AnimationDirection.LEFT]: {
                    framePrefix: 'Ent1_Death_left',
                    frameCount: 6,
                    frameRate: 8,
                    loop: false
                },
                [AnimationDirection.RIGHT]: {
                    framePrefix: 'Ent1_Death_right',
                    frameCount: 6,
                    frameRate: 8,
                    loop: false
                }
            }
        }
    },

    // Lich1 动画配置 - 基于实际图集分析
    'Lich1': {
        plistUrl: 'monster/lich',
        assetNamePrefix: 'Lich1',
        animations: {
            [AnimationState.IDLE]: {
                [AnimationDirection.FRONT]: {
                    framePrefix: 'Lich1_Idle_front',
                    frameCount: 4,
                    frameRate: 6,
                    loop: true
                },
                [AnimationDirection.BACK]: {
                    framePrefix: 'Lich1_Idle_back',
                    frameCount: 4,
                    frameRate: 6,
                    loop: true
                },
                [AnimationDirection.LEFT]: {
                    framePrefix: 'Lich1_Idle_left',
                    frameCount: 4,
                    frameRate: 6,
                    loop: true
                },
                [AnimationDirection.RIGHT]: {
                    framePrefix: 'Lich1_Idle_right',
                    frameCount: 4,
                    frameRate: 6,
                    loop: true
                }
            },
            [AnimationState.WALK]: {
                [AnimationDirection.FRONT]: {
                    framePrefix: 'Lich1_Walk_front',
                    frameCount: 6,
                    frameRate: 8,
                    loop: true
                },
                [AnimationDirection.BACK]: {
                    framePrefix: 'Lich1_Walk_back',
                    frameCount: 6,
                    frameRate: 8,
                    loop: true
                },
                [AnimationDirection.LEFT]: {
                    framePrefix: 'Lich1_Walk_left',
                    frameCount: 6,
                    frameRate: 8,
                    loop: true
                },
                [AnimationDirection.RIGHT]: {
                    framePrefix: 'Lich1_Walk_right',
                    frameCount: 6,
                    frameRate: 8,
                    loop: true
                }
            },
            [AnimationState.ATTACK]: {
                [AnimationDirection.FRONT]: {
                    framePrefix: 'Lich1_Attack_front',
                    frameCount: 8,
                    frameRate: 12,
                    loop: false
                },
                [AnimationDirection.BACK]: {
                    framePrefix: 'Lich1_Attack_back',
                    frameCount: 8,
                    frameRate: 12,
                    loop: false
                },
                [AnimationDirection.LEFT]: {
                    framePrefix: 'Lich1_Attack_left',
                    frameCount: 8,
                    frameRate: 12,
                    loop: false
                },
                [AnimationDirection.RIGHT]: {
                    framePrefix: 'Lich1_Attack_right',
                    frameCount: 8,
                    frameRate: 12,
                    loop: false
                }
            },
            [AnimationState.HURT]: {
                [AnimationDirection.FRONT]: {
                    framePrefix: 'Lich1_Hurt_front',
                    frameCount: 4,
                    frameRate: 15,
                    loop: false
                },
                [AnimationDirection.BACK]: {
                    framePrefix: 'Lich1_Hurt_back',
                    frameCount: 4,
                    frameRate: 15,
                    loop: false
                },
                [AnimationDirection.LEFT]: {
                    framePrefix: 'Lich1_Hurt_left',
                    frameCount: 4,
                    frameRate: 15,
                    loop: false
                },
                [AnimationDirection.RIGHT]: {
                    framePrefix: 'Lich1_Hurt_right',
                    frameCount: 4,
                    frameRate: 15,
                    loop: false
                }
            },
            [AnimationState.DEATH]: {
                [AnimationDirection.FRONT]: {
                    framePrefix: 'Lich1_Death_front',
                    frameCount: 10,
                    frameRate: 8,
                    loop: false
                },
                [AnimationDirection.BACK]: {
                    framePrefix: 'Lich1_Death_back',
                    frameCount: 10,
                    frameRate: 8,
                    loop: false
                },
                [AnimationDirection.LEFT]: {
                    framePrefix: 'Lich1_Death_left',
                    frameCount: 10,
                    frameRate: 8,
                    loop: false
                },
                [AnimationDirection.RIGHT]: {
                    framePrefix: 'Lich1_Death_right',
                    frameCount: 10,
                    frameRate: 8,
                    loop: false
                }
            }
        }
    },

    // Lich2 动画配置 - 基于实际图集分析
    'Lich2': {
        plistUrl: 'monster/lich',
        assetNamePrefix: 'Lich2',
        animations: {
            [AnimationState.IDLE]: {
                [AnimationDirection.FRONT]: {
                    framePrefix: 'Lich2_Idle_front',
                    frameCount: 4,
                    frameRate: 6,
                    loop: true
                },
                [AnimationDirection.BACK]: {
                    framePrefix: 'Lich2_Idle_back',
                    frameCount: 4,
                    frameRate: 6,
                    loop: true
                },
                [AnimationDirection.LEFT]: {
                    framePrefix: 'Lich2_Idle_left',
                    frameCount: 4,
                    frameRate: 6,
                    loop: true
                },
                [AnimationDirection.RIGHT]: {
                    framePrefix: 'Lich2_Idle_right',
                    frameCount: 4,
                    frameRate: 6,
                    loop: true
                }
            },
            [AnimationState.WALK]: {
                [AnimationDirection.FRONT]: {
                    framePrefix: 'Lich2_Walk_front',
                    frameCount: 6,
                    frameRate: 8,
                    loop: true
                },
                [AnimationDirection.BACK]: {
                    framePrefix: 'Lich2_Walk_back',
                    frameCount: 6,
                    frameRate: 8,
                    loop: true
                },
                [AnimationDirection.LEFT]: {
                    framePrefix: 'Lich2_Walk_left',
                    frameCount: 6,
                    frameRate: 8,
                    loop: true
                },
                [AnimationDirection.RIGHT]: {
                    framePrefix: 'Lich2_Walk_right',
                    frameCount: 6,
                    frameRate: 8,
                    loop: true
                }
            },
            [AnimationState.ATTACK]: {
                [AnimationDirection.FRONT]: {
                    framePrefix: 'Lich2_Attack_front',
                    frameCount: 8,
                    frameRate: 12,
                    loop: false
                },
                [AnimationDirection.BACK]: {
                    framePrefix: 'Lich2_Attack_back',
                    frameCount: 8,
                    frameRate: 12,
                    loop: false
                },
                [AnimationDirection.LEFT]: {
                    framePrefix: 'Lich2_Attack_left',
                    frameCount: 8,
                    frameRate: 12,
                    loop: false
                },
                [AnimationDirection.RIGHT]: {
                    framePrefix: 'Lich2_Attack_right',
                    frameCount: 8,
                    frameRate: 12,
                    loop: false
                }
            },
            [AnimationState.HURT]: {
                [AnimationDirection.FRONT]: {
                    framePrefix: 'Lich2_Hurt_front',
                    frameCount: 4,
                    frameRate: 15,
                    loop: false
                },
                [AnimationDirection.BACK]: {
                    framePrefix: 'Lich2_Hurt_back',
                    frameCount: 4,
                    frameRate: 15,
                    loop: false
                },
                [AnimationDirection.LEFT]: {
                    framePrefix: 'Lich2_Hurt_left',
                    frameCount: 4,
                    frameRate: 15,
                    loop: false
                },
                [AnimationDirection.RIGHT]: {
                    framePrefix: 'Lich2_Hurt_right',
                    frameCount: 4,
                    frameRate: 15,
                    loop: false
                }
            },
            [AnimationState.DEATH]: {
                [AnimationDirection.FRONT]: {
                    framePrefix: 'Lich2_Death_front',
                    frameCount: 10,
                    frameRate: 8,
                    loop: false
                },
                [AnimationDirection.BACK]: {
                    framePrefix: 'Lich2_Death_back',
                    frameCount: 10,
                    frameRate: 8,
                    loop: false
                },
                [AnimationDirection.LEFT]: {
                    framePrefix: 'Lich2_Death_left',
                    frameCount: 10,
                    frameRate: 8,
                    loop: false
                },
                [AnimationDirection.RIGHT]: {
                    framePrefix: 'Lich2_Death_right',
                    frameCount: 10,
                    frameRate: 8,
                    loop: false
                }
            }
        }
    },

    // Lich3 动画配置 - 基于实际图集分析
    'Lich3': {
        plistUrl: 'monster/lich',
        assetNamePrefix: 'Lich3',
        animations: {
            [AnimationState.IDLE]: {
                [AnimationDirection.FRONT]: {
                    framePrefix: 'Lich3_Idle_front',
                    frameCount: 4,
                    frameRate: 6,
                    loop: true
                },
                [AnimationDirection.BACK]: {
                    framePrefix: 'Lich3_Idle_back',
                    frameCount: 4,
                    frameRate: 6,
                    loop: true
                },
                [AnimationDirection.LEFT]: {
                    framePrefix: 'Lich3_Idle_left',
                    frameCount: 4,
                    frameRate: 6,
                    loop: true
                },
                [AnimationDirection.RIGHT]: {
                    framePrefix: 'Lich3_Idle_right',
                    frameCount: 4,
                    frameRate: 6,
                    loop: true
                }
            },
            [AnimationState.WALK]: {
                [AnimationDirection.FRONT]: {
                    framePrefix: 'Lich3_Walk_front',
                    frameCount: 6,
                    frameRate: 8,
                    loop: true
                },
                [AnimationDirection.BACK]: {
                    framePrefix: 'Lich3_Walk_back',
                    frameCount: 6,
                    frameRate: 8,
                    loop: true
                },
                [AnimationDirection.LEFT]: {
                    framePrefix: 'Lich3_Walk_left',
                    frameCount: 6,
                    frameRate: 8,
                    loop: true
                },
                [AnimationDirection.RIGHT]: {
                    framePrefix: 'Lich3_Walk_right',
                    frameCount: 6,
                    frameRate: 8,
                    loop: true
                }
            },
            [AnimationState.ATTACK]: {
                [AnimationDirection.FRONT]: {
                    framePrefix: 'Lich3_Attack_front',
                    frameCount: 8,
                    frameRate: 12,
                    loop: false
                },
                [AnimationDirection.BACK]: {
                    framePrefix: 'Lich3_Attack_back',
                    frameCount: 8,
                    frameRate: 12,
                    loop: false
                },
                [AnimationDirection.LEFT]: {
                    framePrefix: 'Lich3_Attack_left',
                    frameCount: 8,
                    frameRate: 12,
                    loop: false
                },
                [AnimationDirection.RIGHT]: {
                    framePrefix: 'Lich3_Attack_right',
                    frameCount: 8,
                    frameRate: 12,
                    loop: false
                }
            },
            [AnimationState.HURT]: {
                [AnimationDirection.FRONT]: {
                    framePrefix: 'Lich3_Hurt_front',
                    frameCount: 4,
                    frameRate: 15,
                    loop: false
                },
                [AnimationDirection.BACK]: {
                    framePrefix: 'Lich3_Hurt_back',
                    frameCount: 4,
                    frameRate: 15,
                    loop: false
                },
                [AnimationDirection.LEFT]: {
                    framePrefix: 'Lich3_Hurt_left',
                    frameCount: 4,
                    frameRate: 15,
                    loop: false
                },
                [AnimationDirection.RIGHT]: {
                    framePrefix: 'Lich3_Hurt_right',
                    frameCount: 4,
                    frameRate: 15,
                    loop: false
                }
            },
            [AnimationState.DEATH]: {
                [AnimationDirection.FRONT]: {
                    framePrefix: 'Lich3_Death_front',
                    frameCount: 10,
                    frameRate: 8,
                    loop: false
                },
                [AnimationDirection.BACK]: {
                    framePrefix: 'Lich3_Death_back',
                    frameCount: 10,
                    frameRate: 8,
                    loop: false
                },
                [AnimationDirection.LEFT]: {
                    framePrefix: 'Lich3_Death_left',
                    frameCount: 10,
                    frameRate: 8,
                    loop: false
                },
                [AnimationDirection.RIGHT]: {
                    framePrefix: 'Lich3_Death_right',
                    frameCount: 10,
                    frameRate: 8,
                    loop: false
                }
            }
        }
    },

    // Ent3 动画配置 - 基于实际图集分析
    'Ent3': {
        plistUrl: 'monster/ent',
        assetNamePrefix: 'Ent3',
        animations: {
            [AnimationState.IDLE]: {
                [AnimationDirection.FRONT]: {
                    framePrefix: 'Ent3_Idle_front',
                    frameCount: 4,
                    frameRate: 8,
                    loop: true
                },
                [AnimationDirection.BACK]: {
                    framePrefix: 'Ent3_Idle_back',
                    frameCount: 4,
                    frameRate: 8,
                    loop: true
                },
                [AnimationDirection.LEFT]: {
                    framePrefix: 'Ent3_Idle_left',
                    frameCount: 4,
                    frameRate: 8,
                    loop: true
                },
                [AnimationDirection.RIGHT]: {
                    framePrefix: 'Ent3_Idle_right',
                    frameCount: 4,
                    frameRate: 8,
                    loop: true
                }
            },
            [AnimationState.WALK]: {
                [AnimationDirection.FRONT]: {
                    framePrefix: 'Ent3_Walk_front',
                    frameCount: 6,
                    frameRate: 10,
                    loop: true
                },
                [AnimationDirection.BACK]: {
                    framePrefix: 'Ent3_Walk_back',
                    frameCount: 6,
                    frameRate: 10,
                    loop: true
                },
                [AnimationDirection.LEFT]: {
                    framePrefix: 'Ent3_Walk_left',
                    frameCount: 6,
                    frameRate: 10,
                    loop: true
                },
                [AnimationDirection.RIGHT]: {
                    framePrefix: 'Ent3_Walk_right',
                    frameCount: 6,
                    frameRate: 10,
                    loop: true
                }
            },
            [AnimationState.ATTACK]: {
                [AnimationDirection.FRONT]: {
                    framePrefix: 'Ent3_Attack_front',
                    frameCount: 7,
                    frameRate: 12,
                    loop: false
                },
                [AnimationDirection.BACK]: {
                    framePrefix: 'Ent3_Attack_back',
                    frameCount: 7,
                    frameRate: 12,
                    loop: false
                },
                [AnimationDirection.LEFT]: {
                    framePrefix: 'Ent3_Attack_left',
                    frameCount: 7,
                    frameRate: 12,
                    loop: false
                },
                [AnimationDirection.RIGHT]: {
                    framePrefix: 'Ent3_Attack_right',
                    frameCount: 7,
                    frameRate: 12,
                    loop: false
                }
            },
            [AnimationState.HURT]: {
                [AnimationDirection.FRONT]: {
                    framePrefix: 'Ent3_Hurt_front',
                    frameCount: 4,
                    frameRate: 15,
                    loop: false
                },
                [AnimationDirection.BACK]: {
                    framePrefix: 'Ent3_Hurt_back',
                    frameCount: 4,
                    frameRate: 15,
                    loop: false
                },
                [AnimationDirection.LEFT]: {
                    framePrefix: 'Ent3_Hurt_left',
                    frameCount: 4,
                    frameRate: 15,
                    loop: false
                },
                [AnimationDirection.RIGHT]: {
                    framePrefix: 'Ent3_Hurt_right',
                    frameCount: 4,
                    frameRate: 15,
                    loop: false
                }
            },
            [AnimationState.DEATH]: {
                [AnimationDirection.FRONT]: {
                    framePrefix: 'Ent3_Death_front',
                    frameCount: 12,
                    frameRate: 8,
                    loop: false
                },
                [AnimationDirection.BACK]: {
                    framePrefix: 'Ent3_Death_back',
                    frameCount: 12,
                    frameRate: 8,
                    loop: false
                },
                [AnimationDirection.LEFT]: {
                    framePrefix: 'Ent3_Death_left',
                    frameCount: 12,
                    frameRate: 8,
                    loop: false
                },
                [AnimationDirection.RIGHT]: {
                    framePrefix: 'Ent3_Death_right',
                    frameCount: 12,
                    frameRate: 8,
                    loop: false
                }
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