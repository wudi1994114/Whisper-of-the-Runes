// assets/scripts/components/RenderComponent.ts

import { _decorator, Component, Sprite, Graphics, Node, Color, UITransform, tween } from 'cc';
import { IRenderable } from '../interfaces/IRenderable';
import { systemConfigManager } from '../configs/SystemConfig';
import { damageDisplayController } from '../controllers/DamageDisplayController';
import { EnemyData } from '../configs/EnemyConfig';
import { AnimationManager } from '../managers/AnimationManager';

const { ccclass, property } = _decorator;

/**
 * 渲染组件 - 负责UI渲染、血条、特效等视觉元素
 * 实现 IRenderable 接口，专注于渲染显示的单一职责
 */
@ccclass('RenderComponent')
export class RenderComponent extends Component implements IRenderable {
    // 渲染相关属性
    private _spriteComponent: Sprite | null = null;
    private _enemyData: EnemyData | null = null;

    // IRenderable 接口属性
    get spriteComponent(): Sprite | null { return this._spriteComponent; }

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
     * 创建血条 (已废弃 - 由 HealthBarComponent 统一管理)
     * @deprecated 血条创建现在由 HealthBarComponent 统一管理
     */
    createHealthBar(): void {
        console.warn(`[RenderComponent] createHealthBar() 已废弃，血条创建由 HealthBarComponent 统一管理`);
        
        // 不再在这里创建血条，避免重复创建
        // 血条创建和管理已转移到 HealthBarComponent
    }

    /**
     * 更新血条显示 (已废弃 - 由 HealthBarComponent 统一管理)
     * @deprecated 血条更新现在由 HealthBarComponent 统一管理
     */
    updateHealthBar(): void {
        // 不再在这里更新血条，由 HealthBarComponent 统一管理
        // 通过事件通知 HealthBarComponent 更新血条
        const characterStats = this.getComponent('CharacterStats') as any;
        if (characterStats && characterStats.isInitialized) {
            const currentHealth = characterStats.currentHealth;
            const maxHealth = characterStats.maxHealth;
            
            // 通知 HealthBarComponent 更新血条
            this.node.emit('health-changed', currentHealth, maxHealth);
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
            
            // 血条深度管理已转移到 HealthBarComponent
        }
    }

    /**
     * 更新血条的z轴深度 (已废弃 - 由 HealthBarComponent 统一管理)
     * @param characterZDepth 角色的z轴深度
     * @deprecated 血条深度管理现在由 HealthBarComponent 统一处理
     */
    updateHealthBarZDepth(characterZDepth: number): void {
        console.warn(`[RenderComponent] updateHealthBarZDepth() 已废弃，血条深度管理由 HealthBarComponent 统一处理`);
        // 血条深度管理已转移到 HealthBarComponent
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
        
        console.log(`[RenderComponent] 🎨 开始应用敌人配置: ${enemyData.name} (${enemyData.id})`);
        
        // 应用所有渲染相关配置
        this.applyEnemyVisualConfig(enemyData);
        
        // 不再在这里创建血条，由 HealthBarComponent 统一管理
        // 血条创建由 HealthBarComponent 在 onLoad 中自动处理
    }

    /**
     * 应用敌人可视化配置
     */
    private async applyEnemyVisualConfig(enemyData: EnemyData): Promise<void> {
        try {
            // 1. 设置节点缩放
            if (enemyData.nodeScale) {
                this.node.setScale(enemyData.nodeScale, enemyData.nodeScale, enemyData.nodeScale);
                console.log(`[RenderComponent] ✅ 节点缩放已设置: ${enemyData.nodeScale}`);
            }

            // 2. 设置UI尺寸
            if (enemyData.uiSize) {
                const uiTransform = this.node.getComponent('cc.UITransform');
                if (uiTransform) {
                    (uiTransform as any).setContentSize(enemyData.uiSize.width, enemyData.uiSize.height);
                    console.log(`[RenderComponent] ✅ UI尺寸已设置: ${enemyData.uiSize.width}x${enemyData.uiSize.height}`);
                }
            }

            // 3. 加载并设置精灵资源
            if (enemyData.plistUrl && enemyData.assetNamePrefix && this._spriteComponent) {
                await this.loadSpriteResource(enemyData.plistUrl, enemyData.assetNamePrefix);
            }

            // 4. 设置物理碰撞体大小
            this.applyColliderConfig(enemyData);

            // 5. 设置投射物发射起点（如果有CombatComponent）
            this.applyProjectileOriginConfig(enemyData);

            console.log(`[RenderComponent] 🎨 敌人可视化配置应用完成: ${enemyData.name}`);

        } catch (error) {
            console.error(`[RenderComponent] 应用敌人配置失败:`, error);
        }
    }

    /**
     * 加载精灵资源
     */
    private async loadSpriteResource(plistUrl: string, assetNamePrefix: string): Promise<void> {
        try {
            // 使用AnimationManager加载精灵图集
            const atlas = await AnimationManager.instance.loadSpriteAtlas(plistUrl);
            
            if (atlas && this._spriteComponent) {
                // 从图集中获取精灵帧
                const spriteFrame = atlas.getSpriteFrame(assetNamePrefix);
                if (spriteFrame) {
                    this._spriteComponent.spriteFrame = spriteFrame;
                    console.log(`[RenderComponent] ✅ 精灵资源已加载: ${plistUrl}/${assetNamePrefix}`);
                } else {
                    console.warn(`[RenderComponent] 图集中未找到精灵帧: ${assetNamePrefix}`);
                }
            } else {
                console.warn(`[RenderComponent] 精灵图集加载失败: ${plistUrl}`);
            }
        } catch (error) {
            console.error(`[RenderComponent] 加载精灵资源异常:`, error);
        }
    }

    /**
     * 应用碰撞体配置
     */
    private applyColliderConfig(enemyData: EnemyData): void {
        if (!enemyData.colliderSize) return;

        const collider = this.node.getComponent('cc.CircleCollider2D') || this.node.getComponent('cc.BoxCollider2D');
        if (collider) {
            // 圆形碰撞体
            if ((collider as any).radius !== undefined && enemyData.colliderSize.radius) {
                (collider as any).radius = enemyData.colliderSize.radius;
                console.log(`[RenderComponent] ✅ 圆形碰撞体半径已设置: ${enemyData.colliderSize.radius}`);
            }
            
            // 设置偏移
            if (enemyData.colliderSize.xoffset !== undefined || enemyData.colliderSize.yoffset !== undefined) {
                const offset = (collider as any).offset || { x: 0, y: 0 };
                if (enemyData.colliderSize.xoffset !== undefined) offset.x = enemyData.colliderSize.xoffset;
                if (enemyData.colliderSize.yoffset !== undefined) offset.y = enemyData.colliderSize.yoffset;
                (collider as any).offset = offset;
                console.log(`[RenderComponent] ✅ 碰撞体偏移已设置: (${offset.x}, ${offset.y})`);
            }
        }
    }

    /**
     * 应用投射物发射起点配置
     */
    private applyProjectileOriginConfig(enemyData: EnemyData): void {
        const combatComponent = this.node.getComponent('CombatComponent');
        if (!combatComponent) return;

        // 根据怪物尺寸和类型设置发射起点
        let projectileOrigin = { x: 0, y: 0 };
        
        if (enemyData.uiSize) {
            // 默认从角色中心偏上一点发射
            projectileOrigin.y = enemyData.uiSize.height * 0.3;
        }

        // 如果配置中有特定的发射点配置，优先使用
        if ((enemyData as any).projectileOrigin) {
            projectileOrigin = (enemyData as any).projectileOrigin;
        }

        // 应用到CombatComponent
        if (typeof (combatComponent as any).setProjectileOrigin === 'function') {
            (combatComponent as any).setProjectileOrigin(projectileOrigin.x, projectileOrigin.y);
            console.log(`[RenderComponent] ✅ 投射物发射起点已设置: (${projectileOrigin.x}, ${projectileOrigin.y})`);
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