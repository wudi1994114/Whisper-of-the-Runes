/**
 * 巫妖角色动画演示 - 基于BaseCharacterDemo
 * 
 * 🎮 控制说明：
 * - WSAD: 移动控制
 * - J: 攻击
 * - 攻击时无法移动
 * 
 * 🔧 从敌人配置读取精英巫妖数据，继承BaseCharacterDemo的所有功能，支持对象池管理，具有火球攻击能力
 */

import { _decorator, Node, UITransform, Vec3 } from 'cc';
import { BaseCharacterDemo } from '../scripts/animation/BaseCharacterDemo';
import { AnimationDirection } from '../scripts/animation/AnimationConfig';
import { FireballLauncher } from '../scripts/launcher/FireballLauncher';
import { animationManager } from '../scripts/animation/AnimationManager';

const { ccclass, property } = _decorator;

@ccclass('LichAnimationDemo')
export class LichAnimationDemo extends BaseCharacterDemo {

    @property({
        displayName: "火球伤害",
        tooltip: "巫妖发射的火球伤害值"
    })
    public fireballDamage: number = 75;

    @property({
        displayName: "火球角度偏移",
        tooltip: "在基础角度上的额外偏移（度）"
    })
    public fireballAngleOffset: number = 0;

    // 火球发射器组件
    private fireballLauncher: FireballLauncher | null = null;

    /**
     * 获取敌人配置ID - 精英巫妖
     */
    protected getEnemyConfigId(): string {
        return 'lich_elite';
    }

    /**
     * 获取角色显示名称
     */
    protected getCharacterDisplayName(): string {
        return 'LichAnimationDemo';
    }

    /**
     * 执行特殊攻击逻辑 - 火球发射
     */
    protected performSpecialAttack(): void {
        // 在第5帧触发火球（Lich攻击动画总共8帧，帧率12FPS，第5帧约在4/12=0.333秒）
        const fireballTriggerTime = (4 / 12) * 1000; // 转换为毫秒
        setTimeout(() => {
            console.log(`[LichAnimationDemo] 第5帧触发火球发射`);
            
            // 根据当前状态调整火球参数
            this.adjustFireballParamsBasedOnState();
            
            // 发射火球
            this.launchFireball();
        }, fireballTriggerTime);
    }

    async onLoad() {
        // 调用父类的onLoad
        await super.onLoad();
        
        // 初始化火球发射器
        this.setupFireballLauncher();
        
        console.log('🧙‍♂️ 巫妖特殊功能：火球攻击已激活');
    }

    /**
     * 初始化火球发射器 - 依赖对象池
     */
    private setupFireballLauncher(): void {
        // 获取或创建FireballLauncher组件
        this.fireballLauncher = this.getComponent(FireballLauncher);
        
        if (this.fireballLauncher) {
            console.log('[LichAnimationDemo] 使用预制体中已有的FireballLauncher组件');
        } else {
            // 创建新的FireballLauncher组件
            this.fireballLauncher = this.addComponent(FireballLauncher);
            console.log('[LichAnimationDemo] 创建了新的FireballLauncher组件');
        }
        
        // 从怪物配置中读取参数
        this.configureFireballLauncherFromEnemyData();
        
        console.log('[LichAnimationDemo] 火球发射器已初始化，完全依赖对象池');
    }

    /**
     * 从敌人配置数据中配置火球发射器参数
     */
    private configureFireballLauncherFromEnemyData(): void {
        if (!this.fireballLauncher || !this.enemyData) {
            console.warn('[LichAnimationDemo] 无法配置火球发射器：组件或敌人数据缺失');
            return;
        }

        // 设置基础攻击间隔作为发射冷却时间
        this.fireballLauncher.launchCooldown = this.enemyData.attackInterval;
        
        // 查找火球技能配置
        const fireballSkill = this.enemyData.skills?.find(skill => skill.id === 'fireball');
        if (fireballSkill) {
            this.fireballLauncher.launchCooldown = Math.min(this.enemyData.attackInterval, fireballSkill.cooldown);
        }
    }

    /**
     * 【修复】发射火球 - 支持动态瞄准（AI模式瞄准当前目标，手动模式瞄准最近敌人）
     */
    public launchFireball(): void {
        if (!this.fireballLauncher) {
            console.warn('[LichAnimationDemo] 火球发射器未初始化');
            return;
        }

        // 检查是否在冷却中
        if (this.fireballLauncher.isOnCooldown()) {
            console.log('[LichAnimationDemo] 火球发射器冷却中，无法发射');
            return;
        }

        let targetToAim: any = null;

        // 根据控制模式选择目标
        if ((this as any).controlMode === 1) { // ControlMode.AI
            // AI模式：瞄准当前AI目标
            targetToAim = this.getAICurrentTarget?.() || (this as any).currentTarget;
        } else if ((this as any).controlMode === 0) { // ControlMode.MANUAL
            // 手动模式：智能瞄准最近的敌人
            targetToAim = (this as any).findNearestEnemy?.();
        }
        
        if (targetToAim && targetToAim.isValid) {
            // 直接朝目标位置发射火球（精确瞄准）
            const targetPos = targetToAim.position;
            const mode = (this as any).controlMode === 1 ? 'AI' : '手动';
            console.log(`[LichAnimationDemo] 🎯 ${mode}模式精确瞄准目标 ${targetToAim.name} 位置: (${targetPos.x.toFixed(1)}, ${targetPos.y.toFixed(1)})`);
            this.fireballLauncher.launchFireballToPosition(targetPos, this.fireballDamage);
        } else {
            // 【备用方案】没有目标时使用原有的位置偏移逻辑
            const baseAngle = this.getFireballAngleByDirection();
            const finalAngle = baseAngle + this.fireballAngleOffset;
            
            // 计算实际发射位置（基础位置 + 方向偏移）
            const adjustedPosition = this.calculateFireballStartPosition();
            
            // 使用改进的发射方法，直接设置正确的位置
            this.launchFireballWithPosition(finalAngle, adjustedPosition);
            
            console.log(`[LichAnimationDemo] 📐 无目标，按朝向发射火球: ${finalAngle.toFixed(1)}°`);
        }
        
        console.log(`[LichAnimationDemo] 🔥 火球发射完成！伤害: ${this.fireballDamage}`);
    }

    /**
     * 根据当前朝向获取发射角度
     */
    private getFireballAngleByDirection(): number {
        switch (this.currentDirection) {
            case AnimationDirection.FRONT:
                return -90; // 向下
            case AnimationDirection.BACK:
                return 90;  // 向上
            case AnimationDirection.LEFT:
                return 180; // 向左
            case AnimationDirection.RIGHT:
                return 0;   // 向右
            default:
                return 0;
        }
    }

    /**
     * 调整火球的视觉角度和发射位置
     */
    private adjustFireballVisualAngle(launchAngle: number): void {
        setTimeout(() => {
            const fireballNode = this.findLatestFireball();
            if (fireballNode) {
                const uiTransform = fireballNode.getComponent(UITransform);
                if (uiTransform) {
                    uiTransform.setAnchorPoint(0.5, 0.6);
                }
                
                this.adjustFireballStartPosition(fireballNode);
                fireballNode.angle = launchAngle;
                
                console.log(`[LichAnimationDemo] 火球视觉角度: ${launchAngle}°，发射位置已调整`);
            }
        }, 30);
    }

    /**
     * 调整火球发射起始位置
     */
    private adjustFireballStartPosition(fireballNode: Node): void {
        if (!this.enemyData) return;

        const lichPos = this.node.position;
        const projectileOffsets = this.enemyData.projectileOffsets;
        
        if (!projectileOffsets) {
            fireballNode.position = lichPos;
            return;
        }
        
        // 映射方向
        let mappedDirection: string = 'front';
        switch (this.currentDirection) {
            case AnimationDirection.FRONT: mappedDirection = 'front'; break;
            case AnimationDirection.BACK: mappedDirection = 'back'; break;
            case AnimationDirection.LEFT: mappedDirection = 'left'; break;
            case AnimationDirection.RIGHT: mappedDirection = 'right'; break;
        }
        
        const currentOffset = (projectileOffsets as any)[mappedDirection];
        if (!currentOffset) {
            fireballNode.position = lichPos;
            return;
        }
        
        const fireballStartPos = new Vec3(
            lichPos.x + currentOffset.x,
            lichPos.y + currentOffset.y,
            lichPos.z
        );
        
        fireballNode.position = fireballStartPos;
        console.log(`[LichAnimationDemo] 火球发射位置设置完成`);
    }

    // =================== 火球参数动态调整方法 ===================

    /**
     * 根据巫妖状态动态调整火球参数
     */
    public adjustFireballParamsBasedOnState(): void {
        if (!this.enemyData) return;

        // 模拟生命值百分比（实际应该从 CharacterStats 获取）
        const healthPercent = Math.random(); // 临时模拟，实际应该替换为真实数据
        
        // 血量越低，火球伤害越高（狂暴效果）
        if (healthPercent < 0.3) {
            this.fireballDamage = 120; // 高伤害
            this.fireballAngleOffset = 0; // 精准角度
            console.log('[LichAnimationDemo] 巫妖进入狂暴状态，火球威力大幅提升！');
        } else if (healthPercent < 0.6) {
            this.fireballDamage = 90;  // 中等伤害
            this.fireballAngleOffset = 5; // 轻微偏移
            console.log('[LichAnimationDemo] 巫妖受伤，火球威力提升');
        } else {
            this.fireballDamage = 75;  // 基础伤害
            this.fireballAngleOffset = 0; // 无偏移
        }
    }

    /**
     * 设置火球伤害
     * @param damage 新的伤害值
     */
    public setFireballDamage(damage: number): void {
        this.fireballDamage = damage;
        console.log(`[LichAnimationDemo] 火球伤害设置为: ${damage}`);
    }



    /**
     * 设置火球角度偏移
     * @param offset 角度偏移值
     */
    public setFireballAngleOffset(offset: number): void {
        this.fireballAngleOffset = offset;
        console.log(`[LichAnimationDemo] 火球角度偏移设置为: ${offset}°`);
    }

    /**
     * 发射带随机偏移的火球（模拟不稳定状态）
     */
    public launchUnstableFireball(): void {
        // 临时保存原始偏移
        const originalOffset = this.fireballAngleOffset;
        
        // 添加随机偏移 (-15° 到 +15°)
        const randomOffset = (Math.random() - 0.5) * 30;
        this.fireballAngleOffset = originalOffset + randomOffset;
        
        // 发射火球
        this.launchFireball();
        
        // 恢复原始偏移
        this.fireballAngleOffset = originalOffset;
        
        console.log(`[LichAnimationDemo] 发射不稳定火球，随机偏移: ${randomOffset.toFixed(1)}°`);
    }

    /**
     * 一次性设置所有火球参数
     * @param damage 伤害值
     * @param angleOffset 角度偏移
     */
    public configureFireball(damage: number, angleOffset: number = 0): void {
        this.fireballDamage = damage;
        this.fireballAngleOffset = angleOffset;
        
        console.log(`[LichAnimationDemo] 火球配置已更新:`);
        console.log(`  - 伤害: ${damage}`);
        console.log(`  - 角度偏移: ${angleOffset}°`);
    }

    /**
     * 获取当前火球配置
     */
    public getFireballConfig(): { damage: number; angleOffset: number } {
        return {
            damage: this.fireballDamage,
            angleOffset: this.fireballAngleOffset
        };
    }

    /**
     * 查找最新创建的火球节点
     */
    private findLatestFireball(): Node | null {
        if (!this.node.parent) return null;
        
        const children = this.node.parent.children;
        for (let i = children.length - 1; i >= 0; i--) {
            const child = children[i];
            if (child.getComponent('FireballController')) {
                return child;
            }
        }
        return null;
    }

    /**
     * 计算火球发射起始位置
     * @returns 计算后的发射位置
     */
    private calculateFireballStartPosition(): Vec3 {
        if (!this.enemyData) {
            return this.node.position.clone();
        }

        const lichPos = this.node.position;
        const projectileOffsets = this.enemyData.projectileOffsets;
        
        if (!projectileOffsets) {
            return lichPos.clone();
        }
        
        // 映射方向
        let mappedDirection: string = 'front';
        switch (this.currentDirection) {
            case AnimationDirection.FRONT: mappedDirection = 'front'; break;
            case AnimationDirection.BACK: mappedDirection = 'back'; break;
            case AnimationDirection.LEFT: mappedDirection = 'left'; break;
            case AnimationDirection.RIGHT: mappedDirection = 'right'; break;
        }
        
        const currentOffset = (projectileOffsets as any)[mappedDirection];
        if (!currentOffset) {
            return lichPos.clone();
        }
        
        const fireballStartPos = new Vec3(
            lichPos.x + currentOffset.x,
            lichPos.y + currentOffset.y,
            lichPos.z
        );
        
        console.log(`[LichAnimationDemo] 计算火球发射位置: (${fireballStartPos.x.toFixed(1)}, ${fireballStartPos.y.toFixed(1)})`);
        return fireballStartPos;
    }

    /**
     * 带指定位置发射火球
     * @param angle 发射角度
     * @param startPosition 起始位置
     */
    private launchFireballWithPosition(angle: number, startPosition: Vec3): void {
        if (!this.fireballLauncher) {
            console.warn('[LichAnimationDemo] 火球发射器未初始化');
            return;
        }

        // 临时保存发射器原始位置
        const originalPosition = this.fireballLauncher.node.position.clone();
        
        // 设置发射器到目标位置
        this.fireballLauncher.node.position = startPosition;
        
        // 发射火球，传递巫妖的伤害值参数（速度从JSON配置中读取）
        this.fireballLauncher.launchFireballAtAngle(
            angle,                    // 发射角度（来自巫妖的朝向和角度偏移）
            this.fireballDamage       // 巫妖的火球伤害值
        );
        
        // 恢复发射器原始位置
        this.fireballLauncher.node.position = originalPosition;
        
        console.log(`[LichAnimationDemo] 从位置 (${startPosition.x.toFixed(1)}, ${startPosition.y.toFixed(1)}) 发射火球`);
        console.log(`[LichAnimationDemo] 火球参数 - 角度: ${angle.toFixed(1)}°, 伤害: ${this.fireballDamage}`);
    }

} 