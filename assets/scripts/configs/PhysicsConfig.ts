// assets/scripts/configs/PhysicsConfig.ts

import { physics, PhysicsSystem2D } from 'cc';

/**
 * 物理碰撞分组枚举
 * 注意：这里的顺序和值必须与 Cocos Creator 编辑器中的项目设置 -> 物理 -> 分组管理器中的配置完全一致。
 * Cocos 使用位掩码，所以每个组都是2的幂。
 * Group 0: DEFAULT (1 << 0)
 * Group 1: PLAYER (1 << 1)
 * Group 2: PLAYER_PROJECTILE (1 << 2)
 * Group 3: FACTION_RED (1 << 3)
 * Group 4: FACTION_RED_PROJECTILE (1 << 4)
 * Group 5: FACTION_BLUE (1 << 5)
 * Group 6: FACTION_BLUE_PROJECTILE (1 << 6)
 * Group 7: FACTION_GREEN (1 << 7)
 * Group 8: FACTION_GREEN_PROJECTILE (1 << 8)
 * Group 9: FACTION_PURPLE (1 << 9)
 * Group 10: FACTION_PURPLE_PROJECTILE (1 << 10)
 * Group 11: WORLD_OBSTACLE (1 << 11) - (可选) 用于墙壁、障碍物等
 */
export const PhysicsGroup = {
    DEFAULT: 1 << 0,
    PLAYER: 1 << 1,
    PLAYER_PROJECTILE: 1 << 2,
    FACTION_RED: 1 << 3,
    FACTION_RED_PROJECTILE: 1 << 4,
    FACTION_BLUE: 1 << 5,
    FACTION_BLUE_PROJECTILE: 1 << 6,
    FACTION_GREEN: 1 << 7,
    FACTION_GREEN_PROJECTILE: 1 << 8,
    FACTION_PURPLE: 1 << 9,
    FACTION_PURPLE_PROJECTILE: 1 << 10,
    WORLD_OBSTACLE: 1 << 11,
};

/**
 * 设置所有物理分组的碰撞关系
 * 这是游戏的核心碰撞规则
 */
export function setupPhysicsGroupCollisions() {
    const collisionMatrix = PhysicsSystem2D.instance.collisionMatrix;

    // 1. 玩家的碰撞关系
    // 玩家可以与所有敌对阵营及其投射物碰撞
    collisionMatrix[PhysicsGroup.PLAYER] = 
        PhysicsGroup.FACTION_RED | PhysicsGroup.FACTION_RED_PROJECTILE |
        PhysicsGroup.FACTION_BLUE | PhysicsGroup.FACTION_BLUE_PROJECTILE |
        PhysicsGroup.FACTION_GREEN | PhysicsGroup.FACTION_GREEN_PROJECTILE |
        PhysicsGroup.FACTION_PURPLE | PhysicsGroup.FACTION_PURPLE_PROJECTILE |
        PhysicsGroup.WORLD_OBSTACLE;

    // 2. 玩家投射物的碰撞关系
    // 玩家投射物只与所有敌对阵营碰撞
    collisionMatrix[PhysicsGroup.PLAYER_PROJECTILE] = 
        PhysicsGroup.FACTION_RED | PhysicsGroup.FACTION_BLUE |
        PhysicsGroup.FACTION_GREEN | PhysicsGroup.FACTION_PURPLE |
        PhysicsGroup.WORLD_OBSTACLE;

    // 3. 红色阵营的碰撞关系
    // 红色阵营与玩家、蓝色、绿色、紫色阵营及其投射物碰撞
    collisionMatrix[PhysicsGroup.FACTION_RED] = 
        PhysicsGroup.PLAYER | PhysicsGroup.PLAYER_PROJECTILE |
        PhysicsGroup.FACTION_BLUE | PhysicsGroup.FACTION_BLUE_PROJECTILE |
        PhysicsGroup.FACTION_GREEN | PhysicsGroup.FACTION_GREEN_PROJECTILE |
        PhysicsGroup.FACTION_PURPLE | PhysicsGroup.FACTION_PURPLE_PROJECTILE |
        PhysicsGroup.WORLD_OBSTACLE;
    
    // 4. 红色阵营投射物的碰撞关系
    // 红色投射物只与玩家、蓝色、绿色、紫色阵营碰撞
    collisionMatrix[PhysicsGroup.FACTION_RED_PROJECTILE] = 
        PhysicsGroup.PLAYER | PhysicsGroup.FACTION_BLUE |
        PhysicsGroup.FACTION_GREEN | PhysicsGroup.FACTION_PURPLE |
        PhysicsGroup.WORLD_OBSTACLE;

    // 5. 蓝色阵营的碰撞关系
    collisionMatrix[PhysicsGroup.FACTION_BLUE] = 
        PhysicsGroup.PLAYER | PhysicsGroup.PLAYER_PROJECTILE |
        PhysicsGroup.FACTION_RED | PhysicsGroup.FACTION_RED_PROJECTILE |
        PhysicsGroup.FACTION_GREEN | PhysicsGroup.FACTION_GREEN_PROJECTILE |
        PhysicsGroup.FACTION_PURPLE | PhysicsGroup.FACTION_PURPLE_PROJECTILE |
        PhysicsGroup.WORLD_OBSTACLE;

    // 6. 蓝色阵营投射物的碰撞关系
    collisionMatrix[PhysicsGroup.FACTION_BLUE_PROJECTILE] = 
        PhysicsGroup.PLAYER | PhysicsGroup.FACTION_RED |
        PhysicsGroup.FACTION_GREEN | PhysicsGroup.FACTION_PURPLE |
        PhysicsGroup.WORLD_OBSTACLE;
    
    // 7. 绿色阵营的碰撞关系
    collisionMatrix[PhysicsGroup.FACTION_GREEN] = 
        PhysicsGroup.PLAYER | PhysicsGroup.PLAYER_PROJECTILE |
        PhysicsGroup.FACTION_RED | PhysicsGroup.FACTION_RED_PROJECTILE |
        PhysicsGroup.FACTION_BLUE | PhysicsGroup.FACTION_BLUE_PROJECTILE |
        PhysicsGroup.FACTION_PURPLE | PhysicsGroup.FACTION_PURPLE_PROJECTILE |
        PhysicsGroup.WORLD_OBSTACLE;

    // 8. 绿色阵营投射物的碰撞关系
    collisionMatrix[PhysicsGroup.FACTION_GREEN_PROJECTILE] = 
        PhysicsGroup.PLAYER | PhysicsGroup.FACTION_RED |
        PhysicsGroup.FACTION_BLUE | PhysicsGroup.FACTION_PURPLE |
        PhysicsGroup.WORLD_OBSTACLE;

    // 9. 紫色阵营的碰撞关系
    collisionMatrix[PhysicsGroup.FACTION_PURPLE] = 
        PhysicsGroup.PLAYER | PhysicsGroup.PLAYER_PROJECTILE |
        PhysicsGroup.FACTION_RED | PhysicsGroup.FACTION_RED_PROJECTILE |
        PhysicsGroup.FACTION_BLUE | PhysicsGroup.FACTION_BLUE_PROJECTILE |
        PhysicsGroup.FACTION_GREEN | PhysicsGroup.FACTION_GREEN_PROJECTILE |
        PhysicsGroup.WORLD_OBSTACLE;

    // 10. 紫色阵营投射物的碰撞关系
    collisionMatrix[PhysicsGroup.FACTION_PURPLE_PROJECTILE] = 
        PhysicsGroup.PLAYER | PhysicsGroup.FACTION_RED |
        PhysicsGroup.FACTION_BLUE | PhysicsGroup.FACTION_GREEN |
        PhysicsGroup.WORLD_OBSTACLE;

    console.log("物理碰撞关系矩阵设置完成。");
} 