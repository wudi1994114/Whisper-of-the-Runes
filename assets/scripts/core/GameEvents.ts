// assets/scripts/core/GameEvents.ts

/**
 * 游戏事件枚举
 * 统一管理所有游戏中使用的事件名称
 */
export enum GameEvents {
    // ========== 输入事件 ==========
    /** 按键按下事件 - 参数: KeyCode */
    KEY_PRESSED = 'KeyPressed',
    
    /** 按键松开事件 - 参数: KeyCode */
    KEY_RELEASED = 'KeyReleased',
    
    /** 移动方向变化事件 - 参数: Vec2 */
    MOVE_DIRECTION_CHANGED = 'MoveDirectionChanged',
    
    // ========== 游戏状态事件 ==========
    /** 游戏数据加载完成事件 - 参数: 无 */
    GAME_DATA_LOADED = 'GameDataLoaded',
    
    /** 游戏状态变化事件 - 参数: GameState */
    GAME_STATE_CHANGED = 'GameStateChanged',
    
    /** 游戏模式变化事件 - 参数: GameMode, GameMode */
    GAME_MODE_CHANGED = 'GameModeChanged',
    
    // ========== 角色通用事件 ==========
    /** 角色属性初始化完成事件 - 参数: CharacterStats */
    CHARACTER_STATS_INITIALIZED = 'CharacterStatsInitialized',
    
    /** 角色受伤事件 - 参数: CharacterStats, number */
    CHARACTER_DAMAGED = 'CharacterDamaged',
    
    /** 角色死亡事件 - 参数: CharacterStats */
    CHARACTER_DIED = 'CharacterDied',
    
    /** 角色治疗事件 - 参数: CharacterStats, number */
    CHARACTER_HEALED = 'CharacterHealed',
    
    /** 角色重置事件 - 参数: CharacterStats */
    CHARACTER_RESET = 'CharacterReset',
    
    // ========== 玩家专用事件 ==========
    /** 玩家移动事件 - 参数: Vec3 */
    PLAYER_MOVED = 'PlayerMoved',
    
    /** 玩家受伤事件 - 参数: CharacterStats, number */
    PLAYER_DAMAGED = 'PlayerDamaged',
    
    /** 玩家血量变化事件 - 参数: number, number */
    PLAYER_HEALTH_CHANGED = 'PlayerHealthChanged',
    
    // ========== 怪物专用事件 ==========
    /** 怪物死亡动画完成事件 - 参数: MonsterAnimationController */
    MONSTER_DEATH_ANIMATION_FINISHED = 'MonsterDeathAnimationFinished',
    
    // ========== 关卡系统事件 ==========
    /** 关卡开始事件 - 参数: LevelData */
    LEVEL_STARTED = 'LevelStarted',
    
    /** 关卡结束事件 - 参数: LevelData */
    LEVEL_ENDED = 'LevelEnded',
    
    /** 关卡数据加载完成事件 - 参数: Record<number, LevelData> */
    LEVEL_DATA_LOADED = 'LevelDataLoaded',
}

/**
 * 事件参数类型定义
 * 为每个事件定义具体的参数类型
 */
export interface GameEventParams {
    [GameEvents.KEY_PRESSED]: [number]; // KeyCode
    [GameEvents.KEY_RELEASED]: [number]; // KeyCode
    [GameEvents.MOVE_DIRECTION_CHANGED]: [any]; // Vec2
    [GameEvents.GAME_DATA_LOADED]: [];
    [GameEvents.GAME_STATE_CHANGED]: [any]; // GameState
    [GameEvents.GAME_MODE_CHANGED]: [any, any]; // GameMode, GameMode
    [GameEvents.CHARACTER_STATS_INITIALIZED]: [any]; // CharacterStats
    [GameEvents.CHARACTER_DAMAGED]: [any, number]; // CharacterStats, damage
    [GameEvents.CHARACTER_DIED]: [any]; // CharacterStats
    [GameEvents.CHARACTER_HEALED]: [any, number]; // CharacterStats, healAmount
    [GameEvents.CHARACTER_RESET]: [any]; // CharacterStats
    [GameEvents.PLAYER_MOVED]: [any]; // Vec3
    [GameEvents.PLAYER_DAMAGED]: [any, number]; // CharacterStats, damage
    [GameEvents.PLAYER_HEALTH_CHANGED]: [number, number]; // currentHealth, maxHealth
    [GameEvents.MONSTER_DEATH_ANIMATION_FINISHED]: [any]; // MonsterAnimationController
}

/**
 * 事件描述映射
 * 提供每个事件的详细说明
 */
export const GameEventDescriptions: Record<GameEvents, string> = {
    [GameEvents.KEY_PRESSED]: '当任何按键被按下时触发',
    [GameEvents.KEY_RELEASED]: '当任何按键被松开时触发',
    [GameEvents.MOVE_DIRECTION_CHANGED]: '当移动方向发生变化时触发（仅限WASD和方向键）',
    [GameEvents.GAME_DATA_LOADED]: '当游戏配置数据加载完成时触发',
    [GameEvents.GAME_STATE_CHANGED]: '当游戏状态发生变化时触发（如菜单、游戏中、暂停等）',
    [GameEvents.GAME_MODE_CHANGED]: '当游戏模式发生变化时触发（如正常模式、测试模式）',
    [GameEvents.CHARACTER_STATS_INITIALIZED]: '当角色属性初始化完成时触发',
    [GameEvents.CHARACTER_DAMAGED]: '当角色受到伤害时触发',
    [GameEvents.CHARACTER_DIED]: '当角色死亡时触发',
    [GameEvents.CHARACTER_HEALED]: '当角色被治疗时触发',
    [GameEvents.CHARACTER_RESET]: '当角色属性被重置时触发',
    [GameEvents.PLAYER_MOVED]: '当玩家位置发生变化时触发',
    [GameEvents.PLAYER_DAMAGED]: '当玩家受到伤害时触发',
    [GameEvents.PLAYER_HEALTH_CHANGED]: '当玩家血量发生变化时触发',
    [GameEvents.MONSTER_DEATH_ANIMATION_FINISHED]: '当怪物死亡动画播放完成时触发',
    [GameEvents.LEVEL_STARTED]: '当关卡开始时触发',
    [GameEvents.LEVEL_ENDED]: '当关卡结束时触发',
    [GameEvents.LEVEL_DATA_LOADED]: '当关卡数据加载完成时触发'
};

/**
 * 获取事件的详细信息
 * @param event 事件枚举
 * @returns 事件的详细描述
 */
export function getEventDescription(event: GameEvents): string {
    return GameEventDescriptions[event] || '未知事件';
}

/**
 * 获取所有事件的列表
 * @returns 所有事件的数组
 */
export function getAllEvents(): GameEvents[] {
    const events: GameEvents[] = [];
    for (const key in GameEvents) {
        if (GameEvents.hasOwnProperty(key)) {
            events.push(GameEvents[key as keyof typeof GameEvents]);
        }
    }
    return events;
}

/**
 * 按分类获取事件
 */
export const EventCategories = {
    /** 输入相关事件 */
    Input: [
        GameEvents.KEY_PRESSED,
        GameEvents.KEY_RELEASED,
        GameEvents.MOVE_DIRECTION_CHANGED
    ],
    
    /** 游戏状态相关事件 */
    GameState: [
        GameEvents.GAME_DATA_LOADED,
        GameEvents.GAME_STATE_CHANGED,
        GameEvents.GAME_MODE_CHANGED
    ],
    
    /** 角色通用事件 */
    Character: [
        GameEvents.CHARACTER_STATS_INITIALIZED,
        GameEvents.CHARACTER_DAMAGED,
        GameEvents.CHARACTER_DIED,
        GameEvents.CHARACTER_HEALED,
        GameEvents.CHARACTER_RESET
    ],
    
    /** 玩家专用事件 */
    Player: [
        GameEvents.PLAYER_MOVED,
        GameEvents.PLAYER_DAMAGED,
        GameEvents.PLAYER_HEALTH_CHANGED
    ],
    
    /** 怪物专用事件 */
    Monster: [
        GameEvents.MONSTER_DEATH_ANIMATION_FINISHED
    ]
}; 