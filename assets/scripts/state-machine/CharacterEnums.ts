/**
 * 角色控制模式枚举
 */
export enum ControlMode {
    MANUAL = 0,    // 手动控制（键盘输入）
    AI = 1         // AI控制
}

/**
 * 角色状态枚举
 */
export enum CharacterState {
    IDLE = 'idle',
    WALKING = 'walking', 
    ATTACKING = 'attacking',
    HURT = 'hurt',
    DEAD = 'dead'
} 