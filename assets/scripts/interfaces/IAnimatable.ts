// assets/scripts/interfaces/IAnimatable.ts

import { Animation } from 'cc';
import { AnimationState, AnimationDirection } from '../configs/AnimationConfig';

/**
 * 可动画对象接口
 * 负责处理角色的动画播放和状态管理
 */
export interface IAnimatable {
    /**
     * 动画组件引用
     */
    readonly animationComponent: Animation | null;
    
    /**
     * 当前朝向
     */
    readonly currentDirection: AnimationDirection;
    
    /**
     * 播放当前动画
     * @param state 动画状态
     */
    playCurrentAnimation(state: AnimationState): void;
    
    /**
     * 播放攻击动画
     * @param onFinished 完成回调
     */
    playAttackAnimation(onFinished?: () => void): void;
    
    /**
     * 播放受伤动画
     */
    playHurtAnimation(): void;
    
    /**
     * 播放受伤动画并执行回调
     * @param callback 完成回调
     */
    playHurtAnimationWithCallback(callback: (() => void) | null): void;
    
    /**
     * 播放死亡动画
     */
    playDeathAnimation(): void;
    
    /**
     * 更新朝向
     * @param targetPosition 目标位置，用于计算朝向
     */
    updateDirectionTowards(targetPosition: any): void;
}