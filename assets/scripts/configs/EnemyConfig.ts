// assets/scripts/configs/EnemyConfig.ts

import { AnimationDirection } from '../animation/AnimationConfig';

/**
 * 发射点偏移配置接口
 * 定义相对于角色锚点的发射点位置偏移
 */
export interface ProjectileOffset {
    x: number;  // X轴偏移（像素）
    y: number;  // Y轴偏移（像素）
}

/**
 * 发射点配置接口
 * 为不同朝向定义发射点偏移
 */
export interface ProjectileOffsets {
    [AnimationDirection.FRONT]: ProjectileOffset;   // 朝前时的发射点
    [AnimationDirection.BACK]: ProjectileOffset;    // 朝后时的发射点
    [AnimationDirection.LEFT]: ProjectileOffset;    // 朝左时的发射点
    [AnimationDirection.RIGHT]: ProjectileOffset;   // 朝右时的发射点
}

/**
 * 敌人类别枚举
 * 定义敌人稀有度/类型，用于逻辑区分（如Boss血条、精英怪物词缀等）
 */
export enum EnemyCategory {
    Normal,  // 普通怪物：基础属性，无特殊能力
    Elite,   // 精英怪物：增强属性，可能有特殊技能
    Boss,    // 首领怪物：极高属性，多种技能，需要特殊UI显示
}

/**
 * AI行为类型枚举
 * 定义敌人的基本行为模式，决定其战斗策略和移动逻辑
 */
export enum AiBehavior {
    Melee,          // 近战型：主动接近玩家并发起近距离攻击
    Ranged,         // 远程型：与玩家保持距离并发射投射物攻击
    Passive,        // 被动型：不主动攻击，仅在受击后反击或被激怒
    Support,        // 辅助型：为其他敌人提供增益效果或治疗
    Kamikaze,       // 自爆型：接近玩家后自爆造成大量伤害
}

/**
 * 敌人技能数据接口
 * 定义敌人可使用的单个技能的完整配置信息
 */
export interface EnemySkill {
    id: string;         // 技能唯一标识符，例如 'fireball', 'summon', 'heal'
    level: number;      // 技能等级，影响伤害、范围等效果强度
    cooldown: number;   // 技能冷却时间（秒），控制技能使用频率
    chance: number;     // 技能释放概率 (0.0-1.0)，1.0表示100%释放
    // 注意：具体的技能参数（如伤害值、范围等）在各自的技能配置中定义
}

/**
 * 敌人数据配置接口
 * 定义单个敌人的完整配置数据结构，涵盖ARPG游戏中怪物的所有核心属性
 * 这是敌人系统的数据驱动核心，通过修改这些配置可以快速调整游戏平衡性
 */
export interface EnemyData {
    // ===============================
    // 基础标识信息
    // ===============================
    id: string;                     // 敌人唯一标识符，用于代码中引用，例如 'ent_normal', 'lich_elite'
    name: string;                   // 敌人显示名称，用于UI显示，例如 '愤怒的树人', '暗影巫妖'
    category: EnemyCategory;        // 敌人类别，决定UI显示方式和特殊逻辑

    // ===============================
    // 视觉资源配置
    // ===============================
    plistUrl: string;               // 敌人图集文件路径 (相对于 resources 目录)，例如 'monster/ent'
    assetNamePrefix: string;        // 动画资源名前缀，例如 'Ent1'（对应 Ent1_Idle_front00.png）
    nodeScale: number;              // 节点缩放比例，用于调整敌人的视觉大小 (1.0 = 原始大小)
    
    // ===============================
    // 核心战斗属性
    // ===============================
    baseHealth: number;             // 基础生命值，敌人的血量上限
    baseAttack: number;             // 基础攻击力，影响对玩家造成的伤害
    baseDefense: number;            // 基础防御力，减少受到的伤害
    moveSpeed: number;              // 移动速度 (像素/秒)，控制敌人移动快慢
    
    // ===============================
    // 攻击系统配置
    // ===============================
    attackRange: number;            // 攻击距离 (像素)，敌人开始攻击的最小距离
    attackInterval: number;         // 攻击间隔时间 (秒)，控制攻击频率
    projectileId?: string;          // 远程攻击的投射物ID (可选)，仅远程敌人需要
    
    // ===============================
    // 动画系统配置
    // ===============================
    animationSpeed: number;         // 动画播放速度 (帧/秒)，控制动画播放快慢
    
    // ===============================
    // AI行为系统配置
    // ===============================
    ai: AiBehavior;                 // AI行为模式，决定敌人的基本战斗策略
    detectionRange: number;         // 检测范围 (像素)，玩家进入此范围敌人开始激活
    pursuitRange: number;           // 追击范围 (像素)，超出此范围敌人停止追击
    returnDistance: number;         // 返回距离 (像素)，离开出生点多远开始返回
    chaseSpeedMultiplier: number;   // 追逐速度倍数，基于moveSpeed的倍数
    hurtDuration: number;           // 受伤状态持续时间 (秒)，受伤动画播放时间
    deathDuration: number;          // 死亡动画持续时间 (秒)，死亡动画播放时间
    idleWaitTime: number;           // 待机状态等待时间 (秒)，待机状态最小持续时间
    aggroDecayTime: number;         // 脱战后仇恨消失时间 (秒)，离开战斗状态后仇恨衰减时间
    
    // ===============================
    // 物理碰撞配置
    // ===============================
    colliderSize: { width: number, height: number }; // 碰撞体尺寸 (像素)，影响碰撞检测
    
    // ===============================
    // 技能系统配置 (可选)
    // ===============================
    skills?: EnemySkill[];          // 敌人技能列表，定义敌人可使用的特殊能力
    
    // ===============================
    // 奖励系统配置
    // ===============================
    expReward: number;              // 击杀奖励经验值，影响玩家升级进度
    dropTableId?: string;           // 掉落表ID (可选)，定义敌人死亡后的物品掉落
    
    // ===============================
    // 视觉反馈配置 (可选)
    // ===============================
    stunDuration?: number;          // 受击硬直时间 (秒)，敌人受伤后的无法行动时间
    damageFlashDuration?: number;   // 受伤闪烁持续时间 (秒)，敌人受伤时的视觉反馈时长
    
    // ===============================
    // 投射物发射配置 (可选)
    // ===============================
    projectileOffsets?: ProjectileOffsets; // 不同方向的发射点偏移配置，用于远程攻击类敌人
} 