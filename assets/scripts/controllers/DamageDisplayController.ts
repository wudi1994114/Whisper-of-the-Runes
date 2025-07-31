// assets/scripts/core/DamageDisplayController.ts

import { _decorator, Node, Vec3, Color, tween } from 'cc';
import { poolManager } from '../managers/PoolManager';

const { ccclass } = _decorator;

/**
 * 伤害显示请求接口
 */
interface DamageDisplayRequest {
    damage: number;
    position: Vec3;
    parentNode: Node;
    timestamp: number;
}

/**
 * 全局伤害数字显示频率控制器
 * 控制0.1秒内最多显示3个伤害数字
 */
@ccclass('DamageDisplayController')
export class DamageDisplayController {
    private static _instance: DamageDisplayController;
    
    // 时间窗口配置
    private readonly TIME_WINDOW = 0.1; // 0.1秒时间窗口
    private readonly MAX_DISPLAYS_PER_WINDOW = 3; // 每个时间窗口最多3个
    
    // 显示记录
    private displayTimes: number[] = []; // 记录最近的显示时间
    private pendingRequests: DamageDisplayRequest[] = []; // 等待显示的请求队列
    
    // 临时变量池（性能优化）
    private static tempVec3 = new Vec3();

    public static get instance(): DamageDisplayController {
        if (!this._instance) {
            this._instance = new DamageDisplayController();
        }
        return this._instance;
    }

    private constructor() {
        console.log('DamageDisplayController: 全局伤害数字频率控制器初始化');
    }

    /**
     * 请求显示伤害数字
     * @param damage 伤害值
     * @param position 显示位置
     * @param parentNode 父节点
     * @param characterName 角色名称（用于日志）
     * @returns 是否立即显示
     */
    public requestDamageDisplay(
        damage: number, 
        position: Vec3, 
        parentNode: Node, 
        characterName: string = 'Unknown'
    ): boolean {
        const currentTime = Date.now() / 1000; // 转换为秒
        
        // 清理过期的显示记录
        this.cleanupExpiredDisplays(currentTime);
        
        // 检查当前时间窗口内的显示数量
        if (this.displayTimes.length < this.MAX_DISPLAYS_PER_WINDOW) {
            // 可以立即显示
            this.executeDisplay(damage, position, parentNode, currentTime);
            return true;
        } else {
            // 超出限制，跳过显示（根据用户要求，我们选择跳过而不是延迟）
            console.log(`DamageDisplayController: 跳过伤害显示 ${damage} [${characterName}] - 超出频率限制 (${this.displayTimes.length}/${this.MAX_DISPLAYS_PER_WINDOW})`);
            return false;
        }
    }

    /**
     * 执行实际的伤害数字显示
     */
    private executeDisplay(damage: number, position: Vec3, parentNode: Node, timestamp: number): void {
        // 记录显示时间
        this.displayTimes.push(timestamp);
        
        // 从PoolManager获取伤害文字节点
        const damageNode = poolManager.getDamageTextNode(damage);
        
        if (!damageNode) {
            console.error(`DamageDisplayController: 无法从PoolManager获取伤害值 ${damage} 的显示节点`);
            return;
        }
        
        // 设置父节点
        damageNode.setParent(parentNode);
        
        // 激活节点
        damageNode.active = true;
        
        // 设置位置（在指定位置上方随机偏移）
        const randomX = (Math.random() - 0.5) * 40;
        DamageDisplayController.tempVec3.set(
            position.x + randomX, 
            position.y + 60, 
            0
        );
        damageNode.setPosition(DamageDisplayController.tempVec3);
        
        // 重置初始缩放和透明度
        damageNode.setScale(1, 1, 1);
        
        // 获取Label组件以控制透明度
        const label = damageNode.getComponent('Label') as any;
        if (label) {
            // 重置为完全不透明
            label.color = new Color(255, 100, 100, 255);
        }
        
        // 动画效果：向上飘动并逐渐消失
        const moveOffset = DamageDisplayController.tempVec3;
        moveOffset.set(0, 50, 0);
        
        tween(damageNode)
            .parallel(
                tween().by(0.5, { position: moveOffset }),
                tween().delay(0.1).to(0.4, {}, { 
                    onUpdate: (target: Node, ratio?: number) => {
                        // 透明度从255渐变到0
                        const label = target.getComponent('Label') as any;
                        if (label && ratio !== undefined) {
                            const alpha = Math.floor(255 * (1 - ratio));
                            label.color = new Color(255, 100, 100, alpha);
                        }
                    }
                })
            )
            .call(() => {
                // 归还到PoolManager
                poolManager.returnDamageTextNode(damageNode);
            })
            .start();
    }

    /**
     * 清理过期的显示记录
     */
    private cleanupExpiredDisplays(currentTime: number): void {
        const cutoffTime = currentTime - this.TIME_WINDOW;
        
        // 移除超过时间窗口的记录
        this.displayTimes = this.displayTimes.filter(time => time > cutoffTime);
    }

    /**
     * 获取当前状态统计
     */
    public getStats(): { 
        currentWindowCount: number; 
        maxPerWindow: number; 
        timeWindow: number;
        canDisplay: boolean;
    } {
        const currentTime = Date.now() / 1000;
        this.cleanupExpiredDisplays(currentTime);
        
        return {
            currentWindowCount: this.displayTimes.length,
            maxPerWindow: this.MAX_DISPLAYS_PER_WINDOW,
            timeWindow: this.TIME_WINDOW,
            canDisplay: this.displayTimes.length < this.MAX_DISPLAYS_PER_WINDOW
        };
    }

    /**
     * 重置控制器状态
     */
    public reset(): void {
        this.displayTimes = [];
        this.pendingRequests = [];
        console.log('DamageDisplayController: 控制器状态已重置');
    }

    /**
     * 销毁控制器
     */
    public destroy(): void {
        this.displayTimes = [];
        this.pendingRequests = [];
        DamageDisplayController._instance = null as any;
        console.log('DamageDisplayController: 控制器已销毁');
    }
}

// 导出单例实例
export const damageDisplayController = DamageDisplayController.instance; 