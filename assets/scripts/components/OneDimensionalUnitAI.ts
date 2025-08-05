// assets/scripts/components/OneDimensionalUnitAI.ts

import { _decorator, Component, Node, Vec3, Vec2 } from 'cc';
import { FlowDirection, FlowFieldUnitState, FlowFieldUnitConfig, DEFAULT_FLOW_FIELD_CONFIG } from '../systems/FlowDirection';
import { DirectionFieldSystem } from '../systems/DirectionFieldSystem';
import { OneDimensionalGrid } from '../systems/OneDimensionalGrid';
import { FactionComponent } from './FactionComponent';
import { MovementComponent } from './MovementComponent';
import { CombatComponent } from './CombatComponent';
import { Faction } from '../configs/FactionConfig';
import { EntityType, QueryOptions } from '../interfaces/IGrid';

const { ccclass, property } = _decorator;

/**
 * 一维流场单位AI组件
 * 实现用户指定的双状态FSM：MARCHING（行军）和COMBAT（战斗）
 */
@ccclass('OneDimensionalUnitAI')
export class OneDimensionalUnitAI extends Component {
    
    // ================= 属性配置区域 =================
    @property({ 
        displayName: "索敌范围", 
        tooltip: "单位的索敌范围（像素）" 
    })
    public detectionRange: number = DEFAULT_FLOW_FIELD_CONFIG.detectionRange;
    
    @property({ 
        displayName: "攻击范围", 
        tooltip: "单位的攻击范围（像素）" 
    })
    public attackRange: number = DEFAULT_FLOW_FIELD_CONFIG.attackRange;
    
    @property({ 
        displayName: "战斗超时", 
        tooltip: "战斗状态的超时时间（秒）" 
    })
    public combatTimeout: number = DEFAULT_FLOW_FIELD_CONFIG.combatTimeout;
    
    @property({ 
        displayName: "移动速度", 
        tooltip: "战斗状态下的移动速度" 
    })
    public moveSpeed: number = DEFAULT_FLOW_FIELD_CONFIG.moveSpeed;
    
    @property({ 
        displayName: "行军速度", 
        tooltip: "行军状态下的前进速度" 
    })
    public marchSpeed: number = DEFAULT_FLOW_FIELD_CONFIG.marchSpeed;
    
    @property({ 
        displayName: "调试模式", 
        tooltip: "开启调试信息输出" 
    })
    public debugMode: boolean = false;
    
    // ================= 系统状态 =================
    private currentState: FlowFieldUnitState = FlowFieldUnitState.MARCHING;
    private combatTimer: number = 0;
    private lastStateChangeTime: number = 0;
    
    // ================= 系统引用 =================
    private directionFieldSystem: DirectionFieldSystem | null = null;
    private oneDGrid: OneDimensionalGrid | null = null;
    
    // ================= 组件引用 =================
    private factionComponent: FactionComponent | null = null;
    private movementComponent: MovementComponent | null = null;
    private combatComponent: CombatComponent | null = null;
    
    // ================= 缓存变量 =================
    private lastKnownColumn: number = -1;
    private lastEnemyCheckTime: number = 0;
    private readonly ENEMY_CHECK_INTERVAL = 0.1; // 100ms检查一次敌人
    
    // ================= 生命周期方法 =================
    
    protected onLoad(): void {
        this.initializeComponents();
        this.lastStateChangeTime = Date.now();
        
        if (this.debugMode) {
            console.log(`[OneDimensionalUnitAI] AI组件已加载: ${this.node.name}`);
        }
    }
    
    protected start(): void {
        this.initializeSystems();
        
        // 自动注册到流场系统
        this.registerToFlowFieldSystem();
        
        if (this.debugMode) {
            console.log(`[OneDimensionalUnitAI] AI系统已启动: ${this.node.name}`);
            console.log(`[OneDimensionalUnitAI] 初始状态: ${this.currentState}`);
        }
    }
    
    protected update(deltaTime: number): void {
        if (!this.isSystemReady()) {
            return;
        }
        
        this.updateCurrentColumn();
        
        // 根据当前状态执行对应逻辑
        switch (this.currentState) {
            case FlowFieldUnitState.MARCHING:
                this.handleMarchingState(deltaTime);
                break;
                
            case FlowFieldUnitState.COMBAT:
                this.handleCombatState(deltaTime);
                break;
                
            default:
                console.warn(`[OneDimensionalUnitAI] 未知状态: ${this.currentState}`);
                break;
        }
    }
    
    protected onDestroy(): void {
        if (this.debugMode) {
            console.log(`[OneDimensionalUnitAI] AI组件已销毁: ${this.node.name}`);
        }
    }
    
    // ================= 状态处理方法 =================
    
    /**
     * 状态一：行军 MARCHING
     * 用户指定逻辑：笔直向前 + 九宫格索敌 + 发现敌人切换战斗
     */
    private handleMarchingState(deltaTime: number): void {
        // 1. 笔直向前移动（用户指定：完全不参考方向场）
        this.moveForward();
        
        // 2. 索敌：检测左中右三列范围内的敌人（一维版本的"九宫格"）
        if (this.shouldCheckEnemies()) {
            const enemies = this.findEnemiesInThreeColumns();
            
            // 3. 发现敌人后，切换到战斗状态
            if (enemies.length > 0) {
                this.transitionToState(FlowFieldUnitState.COMBAT);
                
                if (this.debugMode) {
                    console.log(`[OneDimensionalUnitAI] ${this.node.name} 发现${enemies.length}个敌人，切换到战斗状态`);
                }
            }
        }
    }
    
    /**
     * 状态二：战斗 COMBAT  
     * 用户指定逻辑：优先攻击 -> 智能移动（参考方向场）-> 超时回到行军
     */
    private handleCombatState(deltaTime: number): void {
        this.combatTimer += deltaTime;
        
        // 情况A：攻击范围内有敌人（用户指定：最高优先级，忽略一切移动指令）
        const attackableEnemies = this.findAttackableEnemies();
        if (attackableEnemies.length > 0) {
            this.performAttack(attackableEnemies[0]);
            this.combatTimer = 0; // 重置战斗计时器
            return;
        }
        
        // 情况B：攻击范围内无敌人（用户指定：开始参考方向场进行"智能移动"）
        this.performIntelligentMovement(deltaTime);
        
        // 超时检查：若索敌范围在一段时间内无任何敌人，则切换回行军状态
        if (this.combatTimer >= this.combatTimeout) {
            const nearbyEnemies = this.findEnemiesInThreeColumns();
            if (nearbyEnemies.length === 0) {
                this.transitionToState(FlowFieldUnitState.MARCHING);
                
                if (this.debugMode) {
                    console.log(`[OneDimensionalUnitAI] ${this.node.name} 战斗超时且无敌人，回到行军状态`);
                }
            } else {
                this.combatTimer = 0; // 还有敌人，重置计时器
            }
        }
    }
    
    // ================= 核心行为方法 =================
    
    /**
     * 笔直向前移动（行军状态专用）
     * 用户指定：velocity = (forward_speed, 0)，完全不参考方向场
     */
    private moveForward(): void {
        if (!this.movementComponent) {
            return;
        }
        
        // 设置前进方向（假设X轴正方向为前进方向）
        const forwardDirection = new Vec2(1, 0);
        this.movementComponent.setMoveDirection(forwardDirection);
        this.movementComponent.moveSpeed = this.marchSpeed;
        
        if (this.debugMode) {
            // console.log(`[OneDimensionalUnitAI] ${this.node.name} 笔直前进，速度: ${this.marchSpeed}`);
        }
    }
    
    /**
     * 智能移动（战斗状态专用）
     * 用户指定：水平移动参考方向场 + 垂直移动朝向最近敌人
     */
    private performIntelligentMovement(deltaTime: number): void {
        if (!this.movementComponent || !this.directionFieldSystem) {
            return;
        }
        
        // 获取当前所在列的方向建议
        const flowDirection = this.directionFieldSystem.getDirectionForColumn(this.lastKnownColumn);
        
        // 寻找最近的敌人用于垂直移动
        const nearestEnemy = this.findNearestEnemyInThreeColumns();
        
        // 组合移动向量
        const combinedDirection = this.combineMovementDirection(flowDirection, nearestEnemy);
        
        // 应用移动
        this.movementComponent.setMoveDirection(combinedDirection);
        this.movementComponent.moveSpeed = this.moveSpeed;
        
        if (this.debugMode) {
            console.log(`[OneDimensionalUnitAI] ${this.node.name} 智能移动 - 流场方向: ${flowDirection}, 目标敌人: ${nearestEnemy ? nearestEnemy.node.name : '无'}`);
        }
    }
    
    /**
     * 组合移动方向
     * 用户指定：将水平和垂直的移动意图结合起来，形成最终的移动向量
     */
    private combineMovementDirection(flowDirection: FlowDirection, nearestEnemy: any): Vec2 {
        let horizontalDir = 0;
        let verticalDir = 0;
        
        // 水平移动：根据方向场
        switch (flowDirection) {
            case FlowDirection.LEFT:
                horizontalDir = -1;
                break;
            case FlowDirection.RIGHT:
                horizontalDir = 1;
                break;
        }
        
        // 垂直移动：朝向最近的敌人
        if (nearestEnemy) {
            const enemyPos = nearestEnemy.worldPosition;
            const myPos = this.node.getWorldPosition();
            
            const deltaY = enemyPos.y - myPos.y;
            if (Math.abs(deltaY) > 10) { // 10像素的死区
                verticalDir = deltaY > 0 ? 1 : -1;
            }
        }
        
        // 归一化组合向量
        const combinedDir = new Vec2(horizontalDir, verticalDir);
        if (combinedDir.length() > 0) {
            combinedDir.normalize();
        }
        
        return combinedDir;
    }
    
    /**
     * 执行攻击
     */
    private performAttack(target: any): void {
        if (!this.combatComponent) {
            return;
        }
        
        // 停止移动
        if (this.movementComponent) {
            this.movementComponent.stopMovement();
        }
        
        // 执行攻击
        this.combatComponent.performAttack(target.node);
        
        if (this.debugMode) {
            console.log(`[OneDimensionalUnitAI] ${this.node.name} 攻击目标: ${target.node.name}`);
        }
    }
    
    // ================= 敌人检测方法 =================
    
    /**
     * 检测左中右三列的敌人（一维版本的"九宫格"检索）
     * 用户指定：这个过程完全不需要，也完全不关心方向场
     */
    private findEnemiesInThreeColumns(): any[] {
        if (!this.oneDGrid || !this.factionComponent) {
            return [];
        }
        
        const myFaction = this.factionComponent.faction;
        const queryOptions: QueryOptions = {
            entityTypes: [EntityType.CHARACTER],
            ignoreEntity: this.node,
            onlyAlive: true
        };
        
        // 获取敌对阵营
        queryOptions.factions = this.getEnemyFactions(myFaction);
        
        // 使用一维网格的专用方法检索三列
        const results = this.oneDGrid.findEntitiesInThreeColumnRange(this.lastKnownColumn, queryOptions);
        
        return results.filter(result => result.distance <= this.detectionRange);
    }
    
    /**
     * 查找攻击范围内的敌人
     */
    private findAttackableEnemies(): any[] {
        const allEnemies = this.findEnemiesInThreeColumns();
        return allEnemies.filter(enemy => enemy.distance <= this.attackRange);
    }
    
    /**
     * 查找最近的敌人（用于垂直移动）
     */
    private findNearestEnemyInThreeColumns(): any | null {
        const enemies = this.findEnemiesInThreeColumns();
        
        if (enemies.length === 0) {
            return null;
        }
        
        // 已经按距离排序，返回最近的
        return enemies[0];
    }
    
    // ================= 辅助方法 =================
    
    /**
     * 状态转换
     */
    private transitionToState(newState: FlowFieldUnitState): void {
        if (this.currentState === newState) {
            return;
        }
        
        const oldState = this.currentState;
        this.currentState = newState;
        this.lastStateChangeTime = Date.now();
        this.combatTimer = 0; // 重置战斗计时器
        
        if (this.debugMode) {
            console.log(`[OneDimensionalUnitAI] ${this.node.name} 状态转换: ${oldState} -> ${newState}`);
        }
    }
    
    /**
     * 更新当前所在列
     */
    private updateCurrentColumn(): void {
        if (!this.oneDGrid) {
            return;
        }
        
        const worldPos = this.node.getWorldPosition();
        this.lastKnownColumn = this.oneDGrid.worldToGridCol(worldPos);
    }
    
    /**
     * 是否应该检查敌人
     */
    private shouldCheckEnemies(): boolean {
        const currentTime = Date.now();
        if (currentTime - this.lastEnemyCheckTime >= this.ENEMY_CHECK_INTERVAL * 1000) {
            this.lastEnemyCheckTime = currentTime;
            return true;
        }
        return false;
    }
    
    /**
     * 获取敌对阵营列表
     */
    private getEnemyFactions(myFaction: Faction): Faction[] {
        // 简单实现：除了自己的阵营，其他都是敌对
        const allFactions = [Faction.PLAYER, Faction.RED, Faction.BLUE, Faction.GREEN, Faction.PURPLE];
        return allFactions.filter(faction => faction !== myFaction);
    }
    
    /**
     * 系统是否就绪
     */
    private isSystemReady(): boolean {
        return this.directionFieldSystem !== null && 
               this.oneDGrid !== null && 
               this.factionComponent !== null && 
               this.movementComponent !== null;
    }
    
    // ================= 初始化方法 =================
    
    /**
     * 初始化组件引用
     */
    private initializeComponents(): void {
        this.factionComponent = this.getComponent(FactionComponent);
        this.movementComponent = this.getComponent(MovementComponent);
        this.combatComponent = this.getComponent(CombatComponent);
        
        if (!this.factionComponent) {
            console.error(`[OneDimensionalUnitAI] 缺少FactionComponent: ${this.node.name}`);
        }
        
        if (!this.movementComponent) {
            console.error(`[OneDimensionalUnitAI] 缺少MovementComponent: ${this.node.name}`);
        }
        
        if (!this.combatComponent) {
            console.warn(`[OneDimensionalUnitAI] 缺少CombatComponent: ${this.node.name}`);
        }
    }
    
    /**
     * 初始化系统引用
     */
    private initializeSystems(): void {
        // 这些系统引用需要在系统创建后设置
        // 通常通过游戏管理器或依赖注入设置
        
        if (this.debugMode) {
            console.log(`[OneDimensionalUnitAI] 等待系统引用设置: ${this.node.name}`);
        }
    }
    
    // ================= 公共接口 =================
    
    /**
     * 设置系统引用（由外部系统调用）
     */
    public setSystemReferences(directionFieldSystem: DirectionFieldSystem, oneDGrid: OneDimensionalGrid): void {
        this.directionFieldSystem = directionFieldSystem;
        this.oneDGrid = oneDGrid;
        
        if (this.debugMode) {
            console.log(`[OneDimensionalUnitAI] 系统引用已设置: ${this.node.name}`);
        }
    }
    
    /**
     * 获取当前状态
     */
    public getCurrentState(): FlowFieldUnitState {
        return this.currentState;
    }
    
    /**
     * 强制切换状态（用于测试）
     */
    public forceTransitionToState(state: FlowFieldUnitState): void {
        this.transitionToState(state);
        
        if (this.debugMode) {
            console.log(`[OneDimensionalUnitAI] 强制切换状态到: ${state}`);
        }
    }
    
    /**
     * 获取调试信息
     */
    public getDebugInfo(): string {
        return `[OneDimensionalUnitAI] ${this.node.name}:
- 当前状态: ${this.currentState}
- 所在列: ${this.lastKnownColumn}
- 战斗计时: ${this.combatTimer.toFixed(2)}s
- 系统就绪: ${this.isSystemReady()}`;
    }

    /**
     * 自动注册到流场系统
     */
    private registerToFlowFieldSystem(): void {
        // 延迟执行注册，确保流场管理器已初始化
        setTimeout(() => {
            try {
                // 尝试获取全局流场管理器实例
                const flowFieldManager = (globalThis as any).flowFieldManager;
                if (flowFieldManager && typeof flowFieldManager.registerAIUnit === 'function') {
                    flowFieldManager.registerAIUnit(this);
                    
                    if (this.debugMode) {
                        console.log(`[OneDimensionalUnitAI] 已注册到流场管理器: ${this.node.name}`);
                    }
                } else {
                    if (this.debugMode) {
                        console.warn(`[OneDimensionalUnitAI] 流场管理器未找到，将稍后重试: ${this.node.name}`);
                    }
                    // 重试机制
                    setTimeout(() => this.registerToFlowFieldSystem(), 500);
                }
            } catch (error) {
                console.warn(`[OneDimensionalUnitAI] 流场管理器注册失败: ${this.node.name}`, error);
            }
        }, 100);
    }
}