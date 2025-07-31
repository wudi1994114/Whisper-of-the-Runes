// assets/scripts/components/HealthBarComponent.ts

import { _decorator, Component, Node, Graphics, UITransform, Color } from 'cc';
import { systemConfigManager } from '../configs/SystemConfig';

const { ccclass, property } = _decorator;

/**
 * 血条组件 - 业内标准实现
 * 特点：
 * 1. 事件驱动，完全解耦
 * 2. 支持对象池复用
 * 3. 生命周期管理完善
 * 4. 内存安全
 */
@ccclass('HealthBarComponent')
export class HealthBarComponent extends Component {
    
    @property({ tooltip: '是否显示调试信息' })
    public showDebugInfo: boolean = false;

    // 内部组件
    private healthBarNode: Node | null = null;
    private healthBarGraphics: Graphics | null = null;
    
    // 目标绑定
    private _targetNode: Node | null = null; // 血条绑定的目标节点
    private _characterType: string = 'default'; // 角色类型（影响血条样式）
    
    // 当前血量数据（缓存，用于显示）
    private _currentHealth: number = 100;
    private _maxHealth: number = 100;

    onLoad() {
        // 创建血条UI，但不绑定任何目标
        this.createHealthBar();
    }

    onDestroy() {
        // 确保清理绑定
        this.unbindTarget();
    }

    /**
     * 绑定目标节点 - 这是血条被创建或从对象池取出后最重要的初始化步骤
     * @param targetNode 需要显示血条的角色节点
     * @param characterType 角色类型（可选，影响血条样式）
     */
    public setTarget(targetNode: Node, characterType: string = 'default'): void {
        if (this._targetNode) {
            // 如果已经绑定了旧目标，先解绑，防止事件重复监听
            this.unbindTarget();
        }

        this._targetNode = targetNode;
        this._characterType = characterType;
        
        // 监听新目标的血量变化事件
        this._targetNode.on('health-changed', this.onHealthChanged, this);
        
        // 重新创建血条以应用新的角色类型样式
        if (this.healthBarNode) {
            this.healthBarNode.destroy();
        }
        this.createHealthBar();
        
        if (this.showDebugInfo) {
            console.log(`[HealthBarComponent] 成功绑定到节点: ${targetNode.name}, 类型: ${characterType}`);
        }
    }

    /**
     * 解绑目标节点
     */
    public unbindTarget(): void {
        if (this._targetNode) {
            // 关键：解除事件监听，防止内存泄漏
            this._targetNode.off('health-changed', this.onHealthChanged, this);
            
            if (this.showDebugInfo) {
                console.log(`[HealthBarComponent] 从节点 ${this._targetNode.name} 解绑`);
            }
        }
        
        this._targetNode = null;
    }

    /**
     * 接收到血量变化事件后的回调函数
     * @param currentHealth 当前血量
     * @param maxHealth 最大血量
     */
    private onHealthChanged(currentHealth: number, maxHealth: number): void {
        if (maxHealth <= 0) return;

        // 更新缓存数据
        this._currentHealth = currentHealth;
        this._maxHealth = maxHealth;
        
        // 更新血条显示
        this.updateHealthBar();
        
        // 【新增】同时更新血条的z轴位置（跟随目标角色）
        this.updateHealthBarZDepth();
        
        if (this.showDebugInfo) {
            console.log(`[HealthBarComponent] 血量变化: ${currentHealth}/${maxHealth} (${((currentHealth/maxHealth)*100).toFixed(1)}%)`);
        }
    }

    /**
     * 创建血条UI
     */
    private createHealthBar(): void {
        // 获取基础血条配置
        let baseConfig;
        if (this._targetNode) {
            // 尝试从目标节点获取敌人数据
            const characterStats = this._targetNode.getComponent('CharacterStats') as any;
            const enemyData = characterStats?.enemyData;
            
            if (enemyData) {
                baseConfig = systemConfigManager.getHealthBarConfigFromEnemyData(enemyData);
            } else {
                // 没有敌人数据，使用角色类型配置
                baseConfig = systemConfigManager.getHealthBarConfigForCharacter(this._characterType);
            }
        } else {
            // 没有目标节点，使用角色类型配置
            baseConfig = systemConfigManager.getHealthBarConfigForCharacter(this._characterType);
        }
        
        // 获取角色的实际尺寸用于比例计算
        let characterWidth = 64;  // 默认值
        let characterHeight = 64; // 默认值
        
        if (this._targetNode) {
            const uiTransform = this._targetNode.getComponent(UITransform);
            if (uiTransform) {
                characterWidth = uiTransform.contentSize.width;
                characterHeight = uiTransform.contentSize.height;
            }
        }
        
        // 获取敌人数据传递给配置计算
        let enemyData = null;
        if (this._targetNode) {
            const characterStats = this._targetNode.getComponent('CharacterStats') as any;
            enemyData = characterStats?.enemyData;
        }
        
        // 计算最终血条配置（支持比例）
        const finalConfig = systemConfigManager.calculateFinalHealthBarConfig(
            baseConfig, 
            characterWidth, 
            characterHeight,
            enemyData
        );
        
        // 创建血条容器
        this.healthBarNode = new Node('HealthBar');
        this.healthBarNode.setParent(this.node);
        
        // 设置血条位置（包含z轴深度）
        let characterZDepth = 0;
        if (this._targetNode) {
            characterZDepth = this._targetNode.position.z;
        }
        this.healthBarNode.setPosition(0, finalConfig.offsetY, characterZDepth + finalConfig.zOffset);
        
        // 添加 UITransform 组件
        const transform = this.healthBarNode.addComponent(UITransform);
        transform.setContentSize(finalConfig.width, finalConfig.height);
        
        // 添加 Graphics 组件用于绘制血条
        this.healthBarGraphics = this.healthBarNode.addComponent(Graphics);
        
        // 初始化显示
        this.updateHealthBar();
        
        if (this.showDebugInfo) {
            console.log(`[HealthBarComponent] 血条已创建 - 类型: ${this._characterType}`);
            console.log(`- 血条配置: ${finalConfig.width}x${finalConfig.height}, Y=${finalConfig.offsetY}px`);
            console.log(`- 角色尺寸: ${characterWidth}x${characterHeight}px`);
            console.log(`- 配置来源: ${baseConfig.width !== undefined ? '固定像素值' : '比例计算'}`);
        }
    }

    /**
     * 更新血条显示
     */
    private updateHealthBar(): void {
        if (!this.healthBarGraphics || !this.healthBarNode) return;
        
        const healthPercent = this._maxHealth > 0 ? this._currentHealth / this._maxHealth : 0;
        
        // 获取血条的实际尺寸
        const healthBarTransform = this.healthBarNode.getComponent(UITransform);
        if (!healthBarTransform) return;
        
        const barWidth = healthBarTransform.contentSize.width;
        const barHeight = healthBarTransform.contentSize.height;
        const halfWidth = barWidth / 2;
        const halfHeight = barHeight / 2;
        
        // 清除之前的绘制
        this.healthBarGraphics.clear();
        
        // 绘制背景（深灰色边框）
        this.healthBarGraphics.strokeColor = new Color(30, 30, 30, 255);
        this.healthBarGraphics.lineWidth = 1;
        this.healthBarGraphics.rect(-halfWidth, -halfHeight, barWidth, barHeight);
        this.healthBarGraphics.stroke();
        
        // 绘制背景填充（深灰色）
        this.healthBarGraphics.fillColor = new Color(50, 50, 50, 255);
        this.healthBarGraphics.rect(-halfWidth, -halfHeight, barWidth, barHeight);
        this.healthBarGraphics.fill();
        
        // 绘制血量填充
        if (healthPercent > 0) {
            const fillWidth = barWidth * healthPercent;
            
            // 根据血量百分比选择颜色
            let fillColor: Color;
            if (healthPercent > 0.6) {
                fillColor = new Color(0, 255, 0, 255); // 绿色
            } else if (healthPercent > 0.3) {
                fillColor = new Color(255, 255, 0, 255); // 黄色
            } else {
                fillColor = new Color(255, 0, 0, 255); // 红色
            }
            
            this.healthBarGraphics.fillColor = fillColor;
            this.healthBarGraphics.rect(-halfWidth, -halfHeight, fillWidth, barHeight);
            this.healthBarGraphics.fill();
        }
    }

    /**
     * 当血条被回收到对象池时，必须调用的重置/清理方法
     */
    public reset(): void {
        // 解绑目标
        this.unbindTarget();
        
        // 重置数据
        this._currentHealth = 100;
        this._maxHealth = 100;
        this._characterType = 'default';
        
        // 恢复到初始外观
        this.updateHealthBar();
        
        if (this.showDebugInfo) {
            console.log(`[HealthBarComponent] 血条已重置，准备回收到对象池`);
        }
    }

    /**
     * 如果使用Cocos的PoolManager，可以重写onUnuse
     */
    public onUnuse(): void {
        this.reset();
    }

    /**
     * 显示/隐藏血条
     */
    public setVisible(visible: boolean): void {
        if (this.healthBarNode) {
            this.healthBarNode.active = visible;
        }
    }

    /**
     * 获取当前血量数据（用于调试）
     */
    public getHealthData(): { current: number, max: number, percent: number } {
        return {
            current: this._currentHealth,
            max: this._maxHealth,
            percent: this._maxHealth > 0 ? this._currentHealth / this._maxHealth : 0
        };
    }

    /**
     * 获取绑定的目标节点
     */
    public getTarget(): Node | null {
        return this._targetNode;
    }

    /**
     * 获取角色类型
     */
    public getCharacterType(): string {
        return this._characterType;
    }

    /**
     * 更新血条的z轴位置（跟随目标角色）
     */
    private updateHealthBarZDepth(): void {
        if (!this.healthBarNode || !this._targetNode) return;
        
        // 获取当前血条配置
        const baseConfig = systemConfigManager.getHealthBarConfigForCharacter(this._characterType);
        const finalConfig = systemConfigManager.calculateFinalHealthBarConfig(
            baseConfig, 
            64, // 默认值，这里只需要zOffset
            64,
            null // 没有直接访问enemyData，使用默认值
        );
        
        // 获取目标角色的当前z轴位置
        const targetZDepth = this._targetNode.position.z;
        
        // 更新血条z轴位置
        const healthBarPosition = this.healthBarNode.position;
        this.healthBarNode.setPosition(
            healthBarPosition.x,
            healthBarPosition.y,
            targetZDepth + finalConfig.zOffset
        );
    }

    /**
     * 强制更新血条位置（供外部调用）
     */
    public forceUpdatePosition(): void {
        this.updateHealthBarZDepth();
    }
} 