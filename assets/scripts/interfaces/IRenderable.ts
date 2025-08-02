// assets/scripts/interfaces/IRenderable.ts

import { Sprite, Graphics, Node } from 'cc';

/**
 * 可渲染对象接口
 * 负责处理角色的视觉渲染、UI显示、深度管理等
 */
export interface IRenderable {
    /**
     * 精灵组件引用
     */
    readonly spriteComponent: Sprite | null;
    
    /**
     * 血条节点
     */
    readonly healthBarNode: Node | null;
    
    /**
     * 血条图形组件
     */
    readonly healthBarGraphics: Graphics | null;
    
    /**
     * 创建血条
     */
    createHealthBar(): void;
    
    /**
     * 更新血条
     */
    updateHealthBar(): void;
    
    /**
     * 显示伤害文字
     * @param damage 伤害值
     */
    showDamageText(damage: number): void;
    
    /**
     * 播放红色闪烁效果
     */
    playRedFlashEffect(): void;
    
    /**
     * 根据Y轴位置更新Z轴深度
     */
    updateZDepthBasedOnY(): void;
    
    /**
     * 更新血条Z轴深度
     * @param characterZDepth 角色Z深度
     */
    updateHealthBarZDepth(characterZDepth: number): void;
    
    /**
     * 创建UI范围显示
     */
    createUIRangeDisplay(): void;
    
    /**
     * 创建碰撞体范围显示
     */
    createColliderRangeDisplay(): void;
}