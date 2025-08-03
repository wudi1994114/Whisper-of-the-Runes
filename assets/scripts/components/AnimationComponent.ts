// assets/scripts/components/AnimationComponent.ts

import { Component, Animation } from 'cc';
import { IAnimatable } from '../interfaces/IAnimatable';
import { AnimationState, AnimationDirection } from '../configs/AnimationConfig';
import { animationManager } from '../managers/AnimationManager';
import { EnemyData } from '../configs/EnemyConfig';

/**
 * 动画组件 - 负责动画播放、朝向控制等视觉表现
 * 实现 IAnimatable 接口，专注于动画功能的单一职责
 */
export class AnimationComponent extends Component implements IAnimatable {
    // 动画相关属性
    private _animationComponent: Animation | null = null;
    private _currentDirection: AnimationDirection = AnimationDirection.FRONT;
    private _enemyData: EnemyData | null = null;

    // IAnimatable 接口属性
    get animationComponent(): Animation | null { return this._animationComponent; }
    get currentDirection(): AnimationDirection { return this._currentDirection; }
    set currentDirection(value: AnimationDirection) { this._currentDirection = value; }

    protected onLoad(): void {
        // 不在这里创建Animation组件，让animationManager统一管理
        // this._animationComponent 将在 initializeAnimations 中由 animationManager 创建
        console.log(`[AnimationComponent] onLoad - 等待animationManager初始化动画组件`);
    }

    /**
     * 设置敌人数据（用于动画配置）
     * @param enemyData 敌人配置数据
     */
    setEnemyData(enemyData: EnemyData): void {
        this._enemyData = enemyData;
    }

    /**
     * 播放当前方向的指定动画 - 增强版本，添加详细错误检查
     * @param state 动画状态
     */
    playCurrentAnimation(state: AnimationState): void {
        // 详细的状态检查
        if (!this._animationComponent) {
            console.error(`[AnimationComponent] 动画组件未初始化 (节点: ${this.node?.name || 'unknown'})`);
            return;
        }

        if (!this._enemyData) {
            console.error(`[AnimationComponent] 敌人数据未设置 (节点: ${this.node?.name || 'unknown'})`);
            return;
        }

        if (!this._enemyData.assetNamePrefix) {
            console.error(`[AnimationComponent] 敌人数据缺少assetNamePrefix (节点: ${this.node?.name || 'unknown'})`);
            return;
        }

        // 构建完整的动画名称
        const animationName = `${this._enemyData.assetNamePrefix}_${state}_${this._currentDirection}`;
        console.log(`[AnimationComponent] 尝试播放动画: ${animationName} (节点: ${this.node?.name || 'unknown'})`);

        // 使用 AnimationManager 播放动画
        const success = animationManager.playAnimation(this._animationComponent, animationName);
        
        if (!success) {
            console.warn(`[AnimationComponent] 动画播放失败: ${animationName} (节点: ${this.node?.name || 'unknown'})`);
        } else {
            console.log(`[AnimationComponent] 动画播放成功: ${animationName}`);
        }
    }

    /**
     * 播放攻击动画
     * @param onFinished 动画完成回调
     */
    playAttackAnimation(onFinished?: () => void): void {
        if (!this._animationComponent || !this._enemyData) {
            console.warn(`[AnimationComponent] 动画组件或敌人数据未初始化`);
            if (onFinished) onFinished();
            return;
        }

        // 构建攻击动画名称
        const animationName = `${this._enemyData.assetNamePrefix}_${AnimationState.ATTACK}_${this._currentDirection}`;

        // 获取攻击伤害帧配置
        const damageFrame = this._enemyData.attackDamageFrame || 5;
        const animSpeed = this._enemyData.animationSpeed || 8;

        // 使用 AnimationManager 播放攻击动画，带帧事件支持
        const success = animationManager.playAttackAnimation(
            this._animationComponent,
            animationName,
            damageFrame,
            animSpeed,
            () => this.onAttackDamageFrame(), // 伤害帧回调
            onFinished // 动画完成回调
        );
        
        if (!success) {
            console.warn(`[AnimationComponent] 攻击动画播放失败: ${animationName}`);
            if (onFinished) onFinished();
        }
    }

    /**
     * 播放受伤动画
     */
    playHurtAnimation(): void {
        this.playHurtAnimationWithCallback(null);
    }

    /**
     * 播放受伤动画并设置完成回调
     * @param callback 完成回调
     */
    playHurtAnimationWithCallback(callback: (() => void) | null): void {
        if (!this._animationComponent || !this._enemyData) {
            console.warn(`[AnimationComponent] 动画组件或敌人数据未初始化`);
            if (callback) callback();
            return;
        }

        // 构建受伤动画名称
        const animationName = `${this._enemyData.assetNamePrefix}_${AnimationState.HURT}_${this._currentDirection}`;

        // 使用 AnimationManager 播放受伤动画
        const success = animationManager.playAnimation(this._animationComponent, animationName);
        
        if (success && this._animationComponent) {
            // 清除之前的监听器
            this._animationComponent.off(Animation.EventType.FINISHED);
            
            // 设置受伤动画结束回调
            this._animationComponent.once(Animation.EventType.FINISHED, () => {
                if (callback) callback();
            });
        } else {
            console.warn(`[AnimationComponent] 受伤动画播放失败: ${animationName}`);
            if (callback) callback();
        }
    }

    /**
     * 播放死亡动画
     */
    playDeathAnimation(): void {
        this.playCurrentAnimation(AnimationState.DEATH);
    }

    /**
     * 更新角色朝向
     * @param targetPosition 目标位置
     */
    updateDirectionTowards(targetPosition: any): void {
        if (!targetPosition) return;

        // 计算朝向
        const currentPos = this.node.position;
        const deltaX = targetPosition.x - currentPos.x;
        const deltaY = targetPosition.y - currentPos.y;

        // 根据方向向量确定动画朝向
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            // 水平方向移动
            this._currentDirection = deltaX > 0 ? AnimationDirection.RIGHT : AnimationDirection.LEFT;
        } else {
            // 垂直方向移动
            this._currentDirection = deltaY > 0 ? AnimationDirection.BACK : AnimationDirection.FRONT;
        }
    }

    /**
     * 攻击伤害帧回调 - 在动画的指定帧触发
     * 这个方法会通知战斗组件执行实际的攻击逻辑
     */
    private onAttackDamageFrame(): void {
        // 触发攻击伤害事件，让战斗组件处理实际逻辑
        this.node.emit('attack-damage-frame');
        
        console.log(`[AnimationComponent] 攻击伤害帧触发`);
    }

    /**
     * 初始化动画资源 - 使用animationManager统一管理
     * @param enemyData 敌人配置数据
     */
    async initializeAnimations(enemyData: EnemyData): Promise<void> {
        console.log(`[AnimationComponent] 开始初始化动画资源 (节点: ${this.node?.name || 'unknown'})`);
        
        // 验证输入参数
        if (!enemyData) {
            console.error(`[AnimationComponent] 敌人数据为空，无法初始化动画`);
            return;
        }

        if (!enemyData.assetNamePrefix) {
            console.error(`[AnimationComponent] 敌人数据缺少assetNamePrefix，无法初始化动画`);
            return;
        }

        this._enemyData = enemyData;

        try {
            console.log(`[AnimationComponent] 委托animationManager创建和设置动画组件...`);
            
            // 使用 AnimationManager 创建所有动画剪辑
            const animationClips = await animationManager.createAllAnimationClips(enemyData);
            
            if (!animationClips || animationClips.size === 0) {
                console.warn(`[AnimationComponent] AnimationManager返回空的动画剪辑集合 (敌人: ${enemyData.id})`);
                return;
            }

            // 委托 AnimationManager 统一设置Animation组件和clips
            this._animationComponent = animationManager.setupAnimationComponent(this.node, animationClips);
            
            console.log(`[AnimationComponent] 动画资源初始化完成，共 ${animationClips.size} 个动画剪辑 (节点: ${this.node?.name || 'unknown'})`);
            console.log(`[AnimationComponent] Animation组件已由animationManager统一管理`);
            
        } catch (error) {
            console.error(`[AnimationComponent] 动画初始化失败:`, error);
            console.error(`[AnimationComponent] 错误堆栈:`, error.stack);
        }
    }

    /**
     * 停止所有动画
     */
    stopAllAnimations(): void {
        if (this._animationComponent && this._animationComponent.isValid) {
            try {
                this._animationComponent.stop();
            } catch (error) {
                console.warn(`[AnimationComponent] 停止动画失败:`, error);
            }
        }
    }

    /**
     * 重置动画状态
     */
    resetAnimationState(): void {
        this._currentDirection = AnimationDirection.FRONT;
        this.stopAllAnimations();
    }
}