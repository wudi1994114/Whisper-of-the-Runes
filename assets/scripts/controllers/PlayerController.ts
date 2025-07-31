// assets/scripts/components/PlayerController.ts

import { _decorator, Component, Vec3, Vec2 } from 'cc';
import { eventManager } from '../managers/EventManager';
import { CharacterStats } from '../components/CharacterStats';
import { GameManager, GameMode } from '../managers/GameManager';
import { GameEvents } from '../components/GameEvents';

const { ccclass, property } = _decorator;

/**
 * 玩家控制器组件
 * 负责处理玩家的移动、输入和基本交互
 */
@ccclass('PlayerController')
export class PlayerController extends Component {
    
    @property
    public moveSpeed: number = 200; // 移动速度（像素/秒）

    @property
    public boundaryPadding: number = 50; // 边界内边距

    // 组件引用
    private characterStats: CharacterStats | null = null;
    
    // 移动相关
    private currentPosition: Vec3 = new Vec3();
    private targetPosition: Vec3 = new Vec3();

    protected onLoad(): void {
        // 获取角色属性组件
        this.characterStats = this.getComponent(CharacterStats);
        if (!this.characterStats) {
            console.error('PlayerController requires CharacterStats component');
            return;
        }

        // 初始化玩家属性
        this.characterStats.setStats(100, 25, 5, 1.5);
        
        // 注册游戏事件
        this.registerGameEvents();
        
        // 注册到 GameManager
        this.registerToGameManager();
    }

    protected onDestroy(): void {
        // 取消游戏事件注册
        this.unregisterGameEvents();
    }

    /**
     * 注册到 GameManager
     */
    private registerToGameManager() {
        const gameManager = GameManager.instance;
        if (gameManager) {
            gameManager.registerPlayerController(this);
        } else {
            console.warn('PlayerController: GameManager not found during registration');
        }
    }

    private registerGameEvents(): void {
        eventManager.on(GameEvents.GAME_STATE_CHANGED, this.onGameStateChanged);
        eventManager.on(GameEvents.PLAYER_DAMAGED, this.onPlayerDamaged);
        eventManager.on(GameEvents.GAME_MODE_CHANGED, this.onGameModeChanged);
    }

    private unregisterGameEvents(): void {
        eventManager.off(GameEvents.GAME_STATE_CHANGED, this.onGameStateChanged);
        eventManager.off(GameEvents.PLAYER_DAMAGED, this.onPlayerDamaged);
        eventManager.off(GameEvents.GAME_MODE_CHANGED, this.onGameModeChanged);
    }

    /**
     * 游戏模式改变事件处理
     * @param newMode 新的游戏模式
     * @param oldMode 旧的游戏模式
     */
    private onGameModeChanged = (newMode: GameMode, oldMode: GameMode) => {
        console.log(`PlayerController: Game mode changed from ${GameMode[oldMode]} to ${GameMode[newMode]}`);
        
        if (newMode === GameMode.Normal) {
            console.log('PlayerController: Now accepting movement control');
        } else {
            console.log('PlayerController: Movement control disabled');
        }
    }

    /**
     * 处理来自 GameManager 的输入
     * 这个方法会被 GameManager 在 Normal 模式下调用
     */
    public handleInput(keyCode: number): void {
        // 玩家的特殊输入处理可以在这里添加
        // 比如技能释放、道具使用等
        console.log(`PlayerController: Received input ${keyCode}`);
    }

    /**
     * 移动方法 - 由 GameManager 在 update 中调用
     * @param direction 移动方向
     * @param deltaTime 帧时间
     */
    public move(direction: Vec2, deltaTime: number): void {
        if (!this.characterStats.isAlive || direction.length() === 0) {
            return;
        }

        // 计算移动距离
        const moveDistance = this.moveSpeed * deltaTime * this.characterStats.speed;
        
        // 更新位置
        this.currentPosition = this.node.position;
        this.targetPosition.set(
            this.currentPosition.x + direction.x * moveDistance,
            this.currentPosition.y + direction.y * moveDistance,
            this.currentPosition.z
        );

        // 边界检查（这里需要根据实际屏幕大小调整）
        this.targetPosition.x = Math.max(-960 + this.boundaryPadding, Math.min(960 - this.boundaryPadding, this.targetPosition.x));
        this.targetPosition.y = Math.max(-540 + this.boundaryPadding, Math.min(540 - this.boundaryPadding, this.targetPosition.y));

        // 应用位置（包含z轴深度更新）
        const newZDepth = -this.targetPosition.y * 0.1; // Y轴越大，Z轴越小
        this.targetPosition.z = newZDepth;
        this.node.position = this.targetPosition;

        // 发送移动事件
        eventManager.emit(GameEvents.PLAYER_MOVED, this.node.position);
    }

    /**
     * 停止移动
     */
    public stopMovement(): void {
        // 玩家停止移动时可以添加额外的逻辑
        console.log('PlayerController: Movement stopped');
    }

    private onGameStateChanged = (newState: any) => {
        // 根据游戏状态调整控制器行为
        console.log('PlayerController: Game state changed to', newState);
    }

    private onPlayerDamaged = (stats: CharacterStats, damage: number) => {
        if (stats === this.characterStats) {
            console.log(`Player took ${damage} damage! Health: ${stats.currentHealth}/${stats.maxHealth}`);
            
            // 这里可以添加受伤效果，如屏幕震动、受伤动画等
            eventManager.emit(GameEvents.PLAYER_HEALTH_CHANGED, stats.currentHealth, stats.maxHealth);
        }
    }

    /**
     * 公共方法：获取玩家位置
     */
    public getPosition(): Vec3 {
        return this.node.position;
    }

    /**
     * 公共方法：设置玩家位置
     */
    public setPosition(position: Vec3): void {
        // 确保z轴深度正确
        const newZDepth = -position.y * 0.1; // Y轴越大，Z轴越小
        this.node.setPosition(position.x, position.y, newZDepth);
    }

    /**
     * 公共方法：获取角色属性
     */
    public getCharacterStats(): CharacterStats {
        return this.characterStats;
    }

    /**
     * 公共方法：获取移动速度
     */
    public getMoveSpeed(): number {
        return this.moveSpeed;
    }

    /**
     * 公共方法：设置移动速度
     */
    public setMoveSpeed(speed: number): void {
        this.moveSpeed = speed;
    }

    /**
     * 公共方法：检查是否可以移动
     */
    public canMove(): boolean {
        return this.characterStats.isAlive;
    }
} 