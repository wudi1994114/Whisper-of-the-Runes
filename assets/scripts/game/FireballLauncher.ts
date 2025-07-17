// assets/scripts/game/FireballLauncher.ts

import { _decorator, Component, Node, Prefab, Vec3, instantiate, input, Input, EventMouse } from 'cc';
import { FireballController } from './FireballController';

const { ccclass, property } = _decorator;

/**
 * 火球发射器
 * 用于演示如何使用FireballController
 */
@ccclass('FireballLauncher')
export class FireballLauncher extends Component {
    
    @property({ type: Prefab, tooltip: "火球预制体" })
    public fireballPrefab: Prefab | null = null;
    
    @property({ tooltip: "发射冷却时间（秒）" })
    public launchCooldown: number = 0.5;
    
    @property({ tooltip: "是否启用鼠标点击发射" })
    public enableMouseLaunch: boolean = true;
    
    @property({ tooltip: "默认发射角度（度），0=水平向右，90=向上，-90=向下" })
    public defaultAngle: number = 0;
    
    // 发射相关
    private lastLaunchTime: number = 0;
    
    protected start() {
        // 注册鼠标点击事件
        if (this.enableMouseLaunch) {
            input.on(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
        }
        
        console.log('FireballLauncher: 初始化完成');
    }
    
    /**
     * 鼠标点击事件处理
     */
    private onMouseDown = (event: EventMouse): void => {
        // 简化处理：根据点击位置计算方向
        const screenPos = new Vec3(event.getLocationX(), event.getLocationY(), 0);
        
        // 假设屏幕中心为发射起点，计算方向
        const screenCenter = new Vec3(960, 540, 0); // 1920x1080的一半
        const direction = new Vec3();
        Vec3.subtract(direction, screenPos, screenCenter);
        direction.z = 0;
        direction.normalize();
        
        // 发射火球
        this.launchFireballInDirection(direction);
    }
    
    /**
     * 发射火球到指定位置
     * @param targetPos 目标位置
     */
    public launchFireballToPosition(targetPos: Vec3): void {
        if (!this.canLaunch()) {
            console.log('FireballLauncher: 冷却中，无法发射');
            return;
        }
        
        const fireball = this.createFireball();
        if (!fireball) {
            console.error('FireballLauncher: 创建火球失败');
            return;
        }
        
        // 设置火球位置为发射器位置
        fireball.node.position = this.node.position;
        
        // 设置火球目标
        fireball.setTarget(targetPos);
        
        // 更新最后发射时间
        this.lastLaunchTime = Date.now() / 1000;
        
        console.log(`FireballLauncher: 发射火球到位置 (${targetPos.x.toFixed(2)}, ${targetPos.y.toFixed(2)})`);
    }
    
    /**
     * 发射火球到指定方向
     * @param direction 发射方向（已归一化）
     */
    public launchFireballInDirection(direction: Vec3): void {
        if (!this.canLaunch()) {
            console.log('FireballLauncher: 冷却中，无法发射');
            return;
        }
        
        const fireball = this.createFireball();
        if (!fireball) {
            console.error('FireballLauncher: 创建火球失败');
            return;
        }
        
        // 设置火球位置为发射器位置
        fireball.node.position = this.node.position;
        
        // 设置火球方向
        fireball.setMoveDirection(direction);
        
        // 更新最后发射时间
        this.lastLaunchTime = Date.now() / 1000;
        
        console.log(`FireballLauncher: 发射火球，方向 (${direction.x.toFixed(2)}, ${direction.y.toFixed(2)})`);
    }
    
    /**
     * 按指定角度发射火球
     * @param angleDegrees 发射角度（度），0=水平向右，90=向上，-90=向下，180=向左
     */
    public launchFireballAtAngle(angleDegrees: number): void {
        if (!this.canLaunch()) {
            console.log('FireballLauncher: 冷却中，无法发射');
            return;
        }
        
        const fireball = this.createFireball();
        if (!fireball) {
            console.error('FireballLauncher: 创建火球失败');
            return;
        }
        
        // 设置火球位置为发射器位置
        fireball.node.position = this.node.position;
        
        // 设置火球角度
        fireball.setAngle(angleDegrees);
        
        // 更新最后发射时间
        this.lastLaunchTime = Date.now() / 1000;
        
        console.log(`FireballLauncher: 发射火球，角度 ${angleDegrees}°`);
    }
    
    /**
     * 按默认角度发射火球
     */
    public launchFireball(): void {
        this.launchFireballAtAngle(this.defaultAngle);
    }
    
    /**
     * 检查是否可以发射
     */
    private canLaunch(): boolean {
        if (!this.fireballPrefab) {
            console.error('FireballLauncher: 火球预制体未设置');
            return false;
        }
        
        const currentTime = Date.now() / 1000;
        return (currentTime - this.lastLaunchTime) >= this.launchCooldown;
    }
    
    /**
     * 创建火球实例
     */
    private createFireball(): FireballController | null {
        if (!this.fireballPrefab) {
            return null;
        }
        
        // 实例化火球预制体
        const fireballNode = instantiate(this.fireballPrefab);
        
        // 添加到场景
        this.node.parent?.addChild(fireballNode);
        
        // 获取火球控制器组件
        const fireballController = fireballNode.getComponent(FireballController);
        if (!fireballController) {
            console.error('FireballLauncher: 火球预制体缺少FireballController组件');
            fireballNode.destroy();
            return null;
        }
        
        return fireballController;
    }
    
    /**
     * 获取剩余冷却时间
     */
    public getRemainingCooldown(): number {
        const currentTime = Date.now() / 1000;
        const timeSinceLastLaunch = currentTime - this.lastLaunchTime;
        return Math.max(0, this.launchCooldown - timeSinceLastLaunch);
    }
    
    /**
     * 是否在冷却中
     */
    public isOnCooldown(): boolean {
        return this.getRemainingCooldown() > 0;
    }
    
    protected onDestroy(): void {
        // 清理事件监听
        if (this.enableMouseLaunch) {
            input.off(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
        }
        
        console.log('FireballLauncher: 组件已销毁');
    }
} 