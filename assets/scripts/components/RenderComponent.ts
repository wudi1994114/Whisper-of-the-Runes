// assets/scripts/components/RenderComponent.ts

import { Component, Sprite, Graphics, Node, Color, UITransform, tween } from 'cc';
import { IRenderable } from '../interfaces/IRenderable';
import { systemConfigManager } from '../configs/SystemConfig';
import { damageDisplayController } from '../controllers/DamageDisplayController';
import { EnemyData } from '../configs/EnemyConfig';

/**
 * 渲染组件 - 负责UI渲染、血条、特效等视觉元素
 * 实现 IRenderable 接口，专注于渲染显示的单一职责
 */
export class RenderComponent extends Component implements IRenderable {
    // 渲染相关属性
    private _spriteComponent: Sprite | null = null;
    private _healthBarNode: Node | null = null;
    private _healthBarGraphics: Graphics | null = null;
    private _enemyData: EnemyData | null = null;

    // IRenderable 接口属性
    get spriteComponent(): Sprite | null { return this._spriteComponent; }
    get healthBarNode(): Node | null { return this._healthBarNode; }
    get healthBarGraphics(): Graphics | null { return this._healthBarGraphics; }

    protected onLoad(): void {
        // 获取或添加精灵组件
        this._spriteComponent = this.getComponent(Sprite) || this.addComponent(Sprite);
        
        // 监听事件
        this.node.on('enemy-config-loaded', this.onEnemyConfigLoaded, this);
        this.node.on('reuse-from-pool', this.onReuse, this);
        this.node.on('reset-character-state', this.onResetState, this);
        
        // 监听伤害事件
        this.node.on('character-damaged', this.onCharacterDamaged, this);
        this.node.on('character-death', this.onCharacterDeath, this);
    }

    protected onDestroy(): void {
        // 清理事件监听
        this.node.off('enemy-config-loaded', this.onEnemyConfigLoaded, this);
        this.node.off('reuse-from-pool', this.onReuse, this);
        this.node.off('reset-character-state', this.onResetState, this);
        this.node.off('character-damaged', this.onCharacterDamaged, this);
        this.node.off('character-death', this.onCharacterDeath, this);
    }

    /**
     * 创建血条
     */
    createHealthBar(): void {
        if (this._healthBarNode) {
            console.log(`[RenderComponent] 血条已存在，跳过创建`);
            return;
        }

        // 获取角色配置
        const configComponent = this.getComponent('ConfigComponent') as any;
        const characterName = configComponent ? configComponent.getCharacterDisplayName() : 'Unknown';
        const baseConfig = systemConfigManager.getHealthBarConfigForCharacter(characterName);
        
        // 获取角色的实际尺寸
        const uiTransform = this.node.getComponent(UITransform);
        const characterWidth = uiTransform ? uiTransform.contentSize.width : 64;
        const characterHeight = uiTransform ? uiTransform.contentSize.height : 64;
        
        // 计算最终血条配置
        const finalConfig = systemConfigManager.calculateFinalHealthBarConfig(
            baseConfig, 
            characterWidth, 
            characterHeight,
            this._enemyData
        );
        
        // 创建血条容器
        this._healthBarNode = new Node('HealthBar');
        this._healthBarNode.setParent(this.node);
        
        // 设置血条位置（包含z轴深度）
        const characterZDepth = this.node.position.z;
        this._healthBarNode.setPosition(0, finalConfig.offsetY, characterZDepth + finalConfig.zOffset);
        
        // 添加 UITransform 组件
        const transform = this._healthBarNode.addComponent(UITransform);
        transform.setContentSize(finalConfig.width, finalConfig.height);
        
        // 添加 Graphics 组件用于绘制血条
        this._healthBarGraphics = this._healthBarNode.addComponent(Graphics);
        
        // 绘制血条
        this.updateHealthBar();
        
        console.log(`[RenderComponent] 血条创建完成`);
    }

    /**
     * 更新血条显示
     */
    updateHealthBar(): void {
        if (!this._healthBarGraphics || !this._healthBarNode) {
            return;
        }

        // 获取血量信息
        const characterStats = this.getComponent('CharacterStats') as any;
        if (!characterStats) {
            return;
        }

        const currentHealth = characterStats.currentHealth;
        const maxHealth = characterStats.maxHealth;
        const healthPercent = maxHealth > 0 ? currentHealth / maxHealth : 0;
        
        // 获取血条的实际尺寸
        const healthBarTransform = this._healthBarNode.getComponent(UITransform);
        if (!healthBarTransform) return;
        
        const barWidth = healthBarTransform.contentSize.width;
        const barHeight = healthBarTransform.contentSize.height;
        const halfWidth = barWidth / 2;
        const halfHeight = barHeight / 2;
        
        // 清除之前的绘制
        this._healthBarGraphics.clear();
        
        // 绘制背景边框
        this._healthBarGraphics.strokeColor = new Color(30, 30, 30, 255);
        this._healthBarGraphics.lineWidth = 1;
        this._healthBarGraphics.rect(-halfWidth, -halfHeight, barWidth, barHeight);
        this._healthBarGraphics.stroke();
        
        // 绘制背景填充
        this._healthBarGraphics.fillColor = new Color(50, 50, 50, 255);
        this._healthBarGraphics.rect(-halfWidth, -halfHeight, barWidth, barHeight);
        this._healthBarGraphics.fill();
        
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
            
            this._healthBarGraphics.fillColor = fillColor;
            this._healthBarGraphics.rect(-halfWidth, -halfHeight, fillWidth, barHeight);
            this._healthBarGraphics.fill();
        }
    }

    /**
     * 显示伤害数字
     * @param damage 伤害值
     */
    showDamageText(damage: number): void {
        // 获取角色显示名称
        const configComponent = this.getComponent('ConfigComponent') as any;
        const characterName = configComponent ? configComponent.getCharacterDisplayName() : 'Unknown';
        
        // 通过全局伤害显示控制器显示伤害数字
        const displayed = damageDisplayController.requestDamageDisplay(
            damage,
            this.node.position,
            this.node.parent || this.node,
            characterName
        );
        
        if (!displayed) {
            console.log(`[RenderComponent] 伤害 ${damage} 因频率限制未显示`);
        }
    }

    /**
     * 播放红色闪烁特效
     */
    playRedFlashEffect(): void {
        if (!this._spriteComponent) {
            console.warn(`[RenderComponent] 精灵组件未初始化，无法播放闪烁特效`);
            return;
        }

        // 停止可能正在进行的动画
        tween(this._spriteComponent).stop();

        // 设置为红色，然后渐变回白色
        this._spriteComponent.color = Color.RED;
        tween(this._spriteComponent)
            .to(0.1, { color: Color.WHITE })
            .start();
    }

    /**
     * 根据Y轴位置更新Z轴深度
     */
    updateZDepthBasedOnY(): void {
        const currentPosition = this.node.position;
        const newZDepth = -currentPosition.y * 0.1; // Y轴每增加10像素，Z轴减少1
        
        // 只有当Z轴值发生变化时才更新
        if (Math.abs(currentPosition.z - newZDepth) > 0.01) {
            this.node.setPosition(currentPosition.x, currentPosition.y, newZDepth);
            
            // 同步更新血条的z轴位置
            this.updateHealthBarZDepth(newZDepth);
        }
    }

    /**
     * 更新血条的z轴深度
     * @param characterZDepth 角色的z轴深度
     */
    updateHealthBarZDepth(characterZDepth: number): void {
        if (!this._healthBarNode) return;
        
        // 获取血条配置中的z轴偏移
        const configComponent = this.getComponent('ConfigComponent') as any;
        const characterName = configComponent ? configComponent.getCharacterDisplayName() : 'Unknown';
        const baseConfig = systemConfigManager.getHealthBarConfigForCharacter(characterName);
        const finalConfig = systemConfigManager.calculateFinalHealthBarConfig(
            baseConfig, 
            64, // 默认值，这里只需要zOffset
            64,
            this._enemyData
        );
        
        // 血条显示在比角色更靠前的位置
        const healthBarPosition = this._healthBarNode.position;
        this._healthBarNode.setPosition(
            healthBarPosition.x, 
            healthBarPosition.y, 
            characterZDepth + finalConfig.zOffset
        );
    }

    /**
     * 创建UI尺寸范围显示（调试用）
     */
    createUIRangeDisplay(): void {
        // 获取UI尺寸
        const uiTransform = this.node.getComponent(UITransform);
        if (!uiTransform) return;

        const width = uiTransform.contentSize.width;
        const height = uiTransform.contentSize.height;

        // 创建UI范围显示节点
        const uiRangeNode = new Node('UIRange');
        const graphics = uiRangeNode.addComponent(Graphics);
        
        // 绘制UI边界框 - 蓝色
        graphics.strokeColor = Color.BLUE;
        graphics.lineWidth = 2;
        graphics.rect(-width / 2, -height / 2, width, height);
        graphics.stroke();
        
        // 添加到角色节点
        this.node.addChild(uiRangeNode);
        
        console.log(`[RenderComponent] UI范围显示已创建: ${width}x${height}`);
    }

    /**
     * 创建碰撞体范围显示（调试用）
     */
    createColliderRangeDisplay(): void {
        if (!this._enemyData?.colliderSize) return;

        const colliderSize = this._enemyData.colliderSize;
        
        // 创建碰撞体范围显示节点
        const colliderRangeNode = new Node('ColliderRange');
        const graphics = colliderRangeNode.addComponent(Graphics);
        
        // 绘制碰撞体边界圆 - 红色
        graphics.strokeColor = Color.RED;
        graphics.lineWidth = 2;
        
        // 计算圆形碰撞体的半径
        let radius: number;
        if (colliderSize.radius !== undefined) {
            radius = colliderSize.radius;
        } else if (colliderSize.width !== undefined && colliderSize.height !== undefined) {
            const avgSize = (colliderSize.width + colliderSize.height) / 2;
            radius = avgSize / 2;
        } else {
            radius = 25;
        }
        
        // 计算偏移位置
        let offsetX = colliderSize.xoffset || 0;
        let offsetY = colliderSize.yoffset || 0;
        
        // 绘制碰撞体圆形
        graphics.circle(offsetX, offsetY, radius);
        graphics.stroke();
        
        // 添加到角色节点
        this.node.addChild(colliderRangeNode);
        
        console.log(`[RenderComponent] 碰撞体范围显示已创建: 半径=${radius}, 偏移(${offsetX}, ${offsetY})`);
    }

    /**
     * 敌人配置加载回调
     */
    private onEnemyConfigLoaded(enemyData: EnemyData): void {
        this._enemyData = enemyData;
        
        // 检查是否需要创建血条
        const healthBarComponent = this.node.getComponent('HealthBarComponent');
        if (!healthBarComponent) {
            this.createHealthBar();
        }
    }

    /**
     * 角色受伤回调
     */
    private onCharacterDamaged(damage: number): void {
        // 显示伤害数字
        this.showDamageText(damage);
        
        // 更新血条
        this.updateHealthBar();
        
        // 播放闪红特效
        this.playRedFlashEffect();
    }

    /**
     * 角色死亡回调
     */
    private onCharacterDeath(): void {
        // 更新血条显示
        this.updateHealthBar();
        
        // 可以添加死亡特效
        console.log(`[RenderComponent] 角色死亡，更新显示效果`);
    }

    /**
     * 重用回调
     */
    private onReuse(): void {
        // 重置视觉效果
        if (this._spriteComponent) {
            this._spriteComponent.color = Color.WHITE;
        }
        
        // 更新血条
        this.updateHealthBar();
    }

    /**
     * 重置状态回调
     */
    private onResetState(): void {
        // 重置视觉状态
        if (this._spriteComponent) {
            this._spriteComponent.color = Color.WHITE;
        }
        
        // 停止所有动画
        if (this._spriteComponent) {
            tween(this._spriteComponent).stop();
        }
        
        // 更新血条
        this.updateHealthBar();
    }
}