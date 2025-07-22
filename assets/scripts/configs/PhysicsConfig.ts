// assets/scripts/configs/PhysicsConfig.ts

import { physics, PhysicsSystem2D } from 'cc';

/**
 * 物理碰撞分组枚举
 * 注意：这里的顺序和值必须与 Cocos Creator 编辑器中的项目设置 -> 物理 -> 分组管理器中的配置完全一致。
 * Cocos 使用位掩码，所以每个组都是2的幂。
 * Group 0: DEFAULT (1 << 0)
 * Group 1: PLAYER (1 << 1)
 * Group 2: PLAYER_PROJECTILE (1 << 2)
 * Group 3: RED (1 << 3)
 * Group 4: RED_PROJECTILE (1 << 4)
 * Group 5: BLUE (1 << 5)
 * Group 6: BLUE_PROJECTILE (1 << 6)
 * Group 7: GREEN (1 << 7)
 * Group 8: GREEN_PROJECTILE (1 << 8)
 * Group 9: PURPLE (1 << 9)
 * Group 10: PURPLE_PROJECTILE (1 << 10)
 * Group 11: WORLD_OBSTACLE (1 << 11) - (可选) 用于墙壁、障碍物等
 */
export const PhysicsGroup = {
    DEFAULT: 1 << 0,
    PLAYER: 1 << 1,
    PLAYER_PROJECTILE: 1 << 2,
    RED: 1 << 3,
    RED_PROJECTILE: 1 << 4,
    BLUE: 1 << 5,
    BLUE_PROJECTILE: 1 << 6,
    GREEN: 1 << 7,
    GREEN_PROJECTILE: 1 << 8,
    PURPLE: 1 << 9,
    PURPLE_PROJECTILE: 1 << 10,
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
        PhysicsGroup.RED | PhysicsGroup.RED_PROJECTILE |
        PhysicsGroup.BLUE | PhysicsGroup.BLUE_PROJECTILE |
        PhysicsGroup.GREEN | PhysicsGroup.GREEN_PROJECTILE |
        PhysicsGroup.PURPLE | PhysicsGroup.PURPLE_PROJECTILE |
        PhysicsGroup.WORLD_OBSTACLE;

    // 2. 玩家投射物的碰撞关系
    // 玩家投射物只与所有敌对阵营碰撞
    collisionMatrix[PhysicsGroup.PLAYER_PROJECTILE] = 
        PhysicsGroup.RED | PhysicsGroup.BLUE |
        PhysicsGroup.GREEN | PhysicsGroup.PURPLE |
        PhysicsGroup.WORLD_OBSTACLE;

    // 3. 红色阵营的碰撞关系
    // 红色阵营与玩家、蓝色、绿色、紫色阵营及其投射物碰撞
    collisionMatrix[PhysicsGroup.RED] = 
        PhysicsGroup.PLAYER | PhysicsGroup.PLAYER_PROJECTILE |
        PhysicsGroup.BLUE | PhysicsGroup.BLUE_PROJECTILE |
        PhysicsGroup.GREEN | PhysicsGroup.GREEN_PROJECTILE |
        PhysicsGroup.PURPLE | PhysicsGroup.PURPLE_PROJECTILE |
        PhysicsGroup.WORLD_OBSTACLE;
    
    // 4. 红色阵营投射物的碰撞关系
    // 红色投射物只与玩家、蓝色、绿色、紫色阵营碰撞
    collisionMatrix[PhysicsGroup.RED_PROJECTILE] = 
        PhysicsGroup.PLAYER | PhysicsGroup.BLUE |
        PhysicsGroup.GREEN | PhysicsGroup.PURPLE |
        PhysicsGroup.WORLD_OBSTACLE;

    // 5. 蓝色阵营的碰撞关系
    collisionMatrix[PhysicsGroup.BLUE] = 
        PhysicsGroup.PLAYER | PhysicsGroup.PLAYER_PROJECTILE |
        PhysicsGroup.RED | PhysicsGroup.RED_PROJECTILE |
        PhysicsGroup.GREEN | PhysicsGroup.GREEN_PROJECTILE |
        PhysicsGroup.PURPLE | PhysicsGroup.PURPLE_PROJECTILE |
        PhysicsGroup.WORLD_OBSTACLE;

    // 6. 蓝色阵营投射物的碰撞关系
    collisionMatrix[PhysicsGroup.BLUE_PROJECTILE] = 
        PhysicsGroup.PLAYER | PhysicsGroup.RED |
        PhysicsGroup.GREEN | PhysicsGroup.PURPLE |
        PhysicsGroup.WORLD_OBSTACLE;
    
    // 7. 绿色阵营的碰撞关系
    collisionMatrix[PhysicsGroup.GREEN] = 
        PhysicsGroup.PLAYER | PhysicsGroup.PLAYER_PROJECTILE |
        PhysicsGroup.RED | PhysicsGroup.RED_PROJECTILE |
        PhysicsGroup.BLUE | PhysicsGroup.BLUE_PROJECTILE |
        PhysicsGroup.PURPLE | PhysicsGroup.PURPLE_PROJECTILE |
        PhysicsGroup.WORLD_OBSTACLE;

    // 8. 绿色阵营投射物的碰撞关系
    collisionMatrix[PhysicsGroup.GREEN_PROJECTILE] = 
        PhysicsGroup.PLAYER | PhysicsGroup.RED |
        PhysicsGroup.BLUE | PhysicsGroup.PURPLE |
        PhysicsGroup.WORLD_OBSTACLE;

    // 9. 紫色阵营的碰撞关系
    collisionMatrix[PhysicsGroup.PURPLE] = 
        PhysicsGroup.PLAYER | PhysicsGroup.PLAYER_PROJECTILE |
        PhysicsGroup.RED | PhysicsGroup.RED_PROJECTILE |
        PhysicsGroup.BLUE | PhysicsGroup.BLUE_PROJECTILE |
        PhysicsGroup.GREEN | PhysicsGroup.GREEN_PROJECTILE |
        PhysicsGroup.WORLD_OBSTACLE;

    // 10. 紫色阵营投射物的碰撞关系
    collisionMatrix[PhysicsGroup.PURPLE_PROJECTILE] = 
        PhysicsGroup.PLAYER | PhysicsGroup.RED |
        PhysicsGroup.BLUE | PhysicsGroup.GREEN |
        PhysicsGroup.WORLD_OBSTACLE;

    console.log("物理碰撞关系矩阵设置完成。");
} 