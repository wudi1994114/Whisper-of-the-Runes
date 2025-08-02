// assets/scripts/interfaces/IControllable.ts

import { ControlMode, CharacterState } from '../state-machine/CharacterEnums';

/**
 * 输入信号接口
 */
export interface IInputSignals {
    hasMovementInput: boolean;
    wantsToAttack: boolean;
}

/**
 * 可控制对象接口
 * 负责处理角色的控制模式、输入处理、状态机管理
 */
export interface IControllable {
    /**
     * 控制模式
     */
    readonly controlMode: ControlMode;
    
    /**
     * 当前输入信号
     */
    readonly currentInputSignals: IInputSignals;
    
    /**
     * 设置输入
     */
    setupInput(): void;
    
    /**
     * 清理输入
     */
    cleanupInput(): void;
    
    /**
     * 转换到指定状态
     * @param state 目标状态
     */
    transitionToState(state: CharacterState): void;
    
    /**
     * 获取当前状态
     */
    getCurrentState(): CharacterState | null;
    
    /**
     * 更新逻辑
     * @param deltaTime 帧时间间隔
     */
    update(deltaTime: number): void;
}