// assets/scripts/components/OneDimensionalUnitAI.ts

import { _decorator, Component, Node, Vec3, Vec2 } from 'cc';
import { FlowDirection, FlowFieldUnitState, FlowFieldUnitConfig, DEFAULT_FLOW_FIELD_CONFIG } from '../systems/FlowDirection';
import { DirectionFieldSystem } from '../systems/DirectionFieldSystem';
import { OneDimensionalGrid } from '../systems/OneDimensionalGrid';
import { FactionComponent } from './FactionComponent';
import { MovementComponent } from './MovementComponent';
import { CombatComponent } from './CombatComponent';
import { Faction, FactionUtils } from '../configs/FactionConfig';
import { flowFieldManager } from '../managers/FlowFieldManager';
import { EntityType, QueryOptions } from '../interfaces/IGrid';
import { AIIntentionComponent, AIIntention } from './AIIntentionComponent';

const { ccclass, property } = _decorator;

/**
 * 一维流场单位AI组件
 * 负责流场移动和敌人检测，通过AI意图系统与状态机协作
 * 职责：1. 流场移动（MARCHING状态）2. 敌人检测 3. 设置AI意图
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
    public debugMode: boolean = true;
    
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
    private aiIntentionComponent: AIIntentionComponent | null = null;
    
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
        
        console.log(`[OneDimensionalUnitAI] 🚀 AI系统已启动: ${this.node.name} (初始状态: ${this.currentState})`);
        
        if (this.debugMode) {
            console.log(`[OneDimensionalUnitAI] AI系统已启动: ${this.node.name}`);
            console.log(`[OneDimensionalUnitAI] 初始状态: ${this.currentState}`);
        }
    }
    
    protected update(deltaTime: number): void {
        if (!this.isSystemReady()) {
            // 定期输出系统状态以便调试
            if (Date.now() - this.lastStateChangeTime > 5000) {
                console.log(`[OneDimensionalUnitAI] ⚠️ 系统未就绪: ${this.node.name} (方向场: ${!!this.directionFieldSystem}, 网格: ${!!this.oneDGrid}, 阵营: ${!!this.factionComponent}, 移动: ${!!this.movementComponent})`);
                this.lastStateChangeTime = Date.now();
            }
            return;
        }
        
        this.updateCurrentColumn();
        
        // 根据当前状态执行对应逻辑
        switch (this.currentState) {
            case FlowFieldUnitState.MARCHING:
                this.handleMarchingState(deltaTime);
                break;
                
            case FlowFieldUnitState.ENCOUNTER:
                this.handleEncounterState(deltaTime);
                break;
                
            default:
                console.warn(`[OneDimensionalUnitAI] 未知状态: ${this.currentState}`);
                break;
        }
        
        // 🎯 关键修复：调用MovementComponent执行实际移动
        if (this.movementComponent) {
            this.movementComponent.handleMovement(deltaTime);
        }
    }
    
    protected onDestroy(): void {
        // 从网格系统注销
        this.unregisterFromGrid();
        
        if (this.debugMode) {
            console.log(`[OneDimensionalUnitAI] AI组件已销毁: ${this.node.name}`);
        }
    }
    
    // ================= 状态处理方法 =================
    
    /**
     * 行军状态：流场移动 + 简单索敌
     * 职责：1. 按流场方向移动 2. 检测三列内是否有敌人 3. 有敌人立即切换到ENCOUNTER
     */
    private handleMarchingState(deltaTime: number): void {
        // 1. 流场移动：根据方向场系统设置移动方向（仅当当前不是ENCOUNTER时）
        // 避免因异步调用造成的状态切换滞后仍然沿用行军移动
        if (this.currentState === FlowFieldUnitState.MARCHING) {
            this.performFlowFieldMovement();
        }
        
        // 2. 简单索敌：只检查有没有敌人，有就切换状态
        if (this.shouldCheckEnemies()) {
            const enemies = this.findEnemiesInThreeColumns();
            
            if (enemies.length > 0) {
                // 发现敌人，立即切换到遭遇状态，并清空行军移动输入
                this.transitionToState(FlowFieldUnitState.ENCOUNTER);
                if (this.movementComponent) {
                    this.movementComponent.stopMovement();
                }
                
                if (this.debugMode) {
                    console.log(`[OneDimensionalUnitAI] ${this.node.name} 发现${enemies.length}个敌人，切换到遭遇状态`);
                }
            }
        }
    }
    
    /**
     * 遭遇状态：处理所有战斗相关的复杂逻辑
     * 职责：1. 优先攻击 2. 智能移动（参考方向场） 3. 超时回到行军
     */
    private handleEncounterState(deltaTime: number): void {
        this.combatTimer += deltaTime;
        
        // 情况A：攻击范围内有敌人（最高优先级，设置攻击意图）
        const attackableEnemies = this.findAttackableEnemies();
        if (attackableEnemies.length > 0) {
            this.setAttackIntention(attackableEnemies[0]);
            this.combatTimer = 0; // 重置战斗计时器
            return;
        }
        
        // 情况B：攻击范围内无敌人，但索敌范围内有敌人（设置追击意图）
        const detectedEnemies = this.findEnemiesInThreeColumns();
        if (detectedEnemies.length > 0) {
            this.setChaseIntention(detectedEnemies[0]);
            this.combatTimer = 0; // 重置战斗计时器
            return;
        }
        
        // 情况C：索敌范围内无敌人，检查超时切换回行军
        if (this.combatTimer >= this.combatTimeout) {
            this.transitionToState(FlowFieldUnitState.MARCHING);
            this.clearAIIntention();
            
            if (this.debugMode) {
                console.log(`[OneDimensionalUnitAI] ${this.node.name} 战斗超时且无敌人，回到行军状态`);
            }
        }
    }

    
    // ================= 核心行为方法 =================
    
    /**
     * 执行流场移动：根据方向场系统设置移动方向和速度
     */
    private performFlowFieldMovement(): void {
        if (!this.movementComponent || !this.directionFieldSystem) {
            if (!this.movementComponent) {
                console.warn(`[OneDimensionalUnitAI] ${this.node.name} MovementComponent未找到`);
            }
            if (!this.directionFieldSystem) {
                console.warn(`[OneDimensionalUnitAI] ${this.node.name} DirectionFieldSystem未找到`);
            }
            return;
        }
        
        // 获取当前列的方向建议
        const flowDirection = this.directionFieldSystem.getDirectionForColumn(this.lastKnownColumn);
        
        // 根据方向场设置移动方向
        let moveDirection: Vec2;
        if (flowDirection === FlowDirection.LEFT) {
            moveDirection = new Vec2(-1, 0); // 向左
        } else {
            moveDirection = new Vec2(1, 0);  // 向右
        }
        
        this.movementComponent.moveDirection = moveDirection;
        this.movementComponent.moveSpeed = this.marchSpeed;

    }
    
    /**
     * 设置攻击意图
     */
    private setAttackIntention(enemy: any): void {
        if (!this.aiIntentionComponent) {
            return;
        }
        
        this.aiIntentionComponent.setIntention({
            intention: AIIntention.ATTACK_ENEMY,
            targetNode: enemy.entity?.node,
            priority: 10,
            expirationTime: Date.now() + 2000,
            reason: `敌人在攻击范围内 (距离: ${enemy.distance.toFixed(1)})`
        });
        
        if (this.debugMode) {
            console.log(`[OneDimensionalUnitAI] ${this.node.name} 设置攻击意图，目标距离: ${enemy.distance.toFixed(1)}`);
        }
    }
    
    /**
     * 设置追击意图
     */
    private setChaseIntention(enemy: any): void {
        if (!this.aiIntentionComponent) {
            return;
        }
        
        this.aiIntentionComponent.setIntention({
            intention: AIIntention.CHASE_ENEMY,
            targetNode: enemy.entity?.node,
            targetPosition: enemy.entity?.node?.getWorldPosition(),
            priority: 8,
            expirationTime: Date.now() + 3000,
            reason: `追击敌人 (距离: ${enemy.distance.toFixed(1)})`
        });
        
        if (this.debugMode) {
            console.log(`[OneDimensionalUnitAI] ${this.node.name} 设置追击意图，目标距离: ${enemy.distance.toFixed(1)}`);
        }
    }
    
    /**
     * 清除AI意图
     */
    private clearAIIntention(): void {
        if (this.aiIntentionComponent) {
            this.aiIntentionComponent.clearIntention();
        }
    }
    
    // ================= 敌人检测方法 =================
    
    /**
     * 检测左中右三列的敌人（一维版本的"九宫格"检索）
     * 用户指定：这个过程完全不需要，也完全不关心方向场
     */
    public findEnemiesInThreeColumns(): any[] {
        if (!this.oneDGrid || !this.factionComponent) {
            return [];
        }
        
        const myFactionString = this.factionComponent.aiFaction;
        const queryOptions: QueryOptions = {
            entityTypes: [EntityType.CHARACTER],
            ignoreEntity: this.node,
            onlyAlive: true
        };
        
        // 将字符串阵营转换为Faction枚举
        const myFaction = FactionUtils.stringToFaction(myFactionString);
        
        // 获取敌对阵营
        queryOptions.factions = this.getEnemyFactions(myFaction);
        
        // 使用一维网格的专用方法检索三列
        const results = this.oneDGrid.findEntitiesInThreeColumnRange(this.lastKnownColumn, queryOptions);
        
        // 使用实际世界距离重新计算并过滤，提升攻击/索敌判定的精度
        const myWorldPos = this.node.getWorldPosition();
        const recomputed = results.map(r => ({
            entity: r.entity,
            distance: this.node && r.entity && r.entity.worldPosition
                ? Math.sqrt(
                    (r.entity.worldPosition.x - myWorldPos.x) * (r.entity.worldPosition.x - myWorldPos.x) +
                    (r.entity.worldPosition.y - myWorldPos.y) * (r.entity.worldPosition.y - myWorldPos.y)
                  )
                : r.distance
        }));
        
        const filteredResults = recomputed.filter(result => result.distance <= this.detectionRange);
        filteredResults.sort((a, b) => a.distance - b.distance);
        
        if (this.debugMode && filteredResults.length > 0) {
            console.log(`[OneDimensionalUnitAI] 🔍 ${this.node.name} 检测到${filteredResults.length}个敌人 (列: ${this.lastKnownColumn})`);
        }
        
        return filteredResults;
    }
    
    /**
     * 查找攻击范围内的敌人
     */
    public findAttackableEnemies(): any[] {
        const allEnemies = this.findEnemiesInThreeColumns();
        return allEnemies.filter(enemy => enemy.distance <= this.attackRange);
    }
    

    
    // ================= 辅助方法 =================
    
    /**
     * 状态转换：支持MARCHING和ENCOUNTER两个状态
     */
    private transitionToState(newState: FlowFieldUnitState): void {
        if (this.currentState === newState) {
            return;
        }
        
        const oldState = this.currentState;
        this.currentState = newState;
        this.lastStateChangeTime = Date.now();
        
        // 状态切换时重置战斗计时器并立即停止行军残留移动
        if (newState === FlowFieldUnitState.ENCOUNTER) {
            this.combatTimer = 0;
            if (this.movementComponent) {
                this.movementComponent.stopMovement();
            }
        }
        
        // 显示状态转换（用于调试AI工作状态）
        console.log(`[OneDimensionalUnitAI] 🎯 ${this.node.name} 状态转换: ${oldState} -> ${newState} (列: ${this.lastKnownColumn})`);
        
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
       
    /**
     * 初始化组件引用
     */
    private initializeComponents(): void {
        this.factionComponent = this.getComponent(FactionComponent);
        this.movementComponent = this.getComponent(MovementComponent);
        this.combatComponent = this.getComponent(CombatComponent);
        this.aiIntentionComponent = this.getComponent(AIIntentionComponent);
        
        if (!this.factionComponent) {
            console.error(`[OneDimensionalUnitAI] 缺少FactionComponent: ${this.node.name}`);
        }
        
        if (!this.movementComponent) {
            console.error(`[OneDimensionalUnitAI] 缺少MovementComponent: ${this.node.name}`);
        }
        
        if (!this.combatComponent) {
            console.warn(`[OneDimensionalUnitAI] 缺少CombatComponent: ${this.node.name}`);
        }
        
        if (!this.aiIntentionComponent) {
            console.warn(`[OneDimensionalUnitAI] 缺少AIIntentionComponent: ${this.node.name}，AI意图功能将不可用`);
        } else {
            // 同步配置到AIIntentionComponent
            this.syncConfigToAIIntention();
        }
    }
    
    /**
     * 同步配置到AIIntentionComponent
     */
    private syncConfigToAIIntention(): void {
        if (!this.aiIntentionComponent) {
            return;
        }
        
        // 同步各种范围配置
        this.aiIntentionComponent.setDetectionRange(this.detectionRange);
        this.aiIntentionComponent.setAttackRange(this.attackRange);
        this.aiIntentionComponent.setChaseRange(this.detectionRange); // 使用索敌范围作为追击范围
        
        if (this.debugMode) {
            console.log(`[OneDimensionalUnitAI] 配置已同步到AIIntentionComponent: ${this.node.name}`);
        }
    }
    
    /**
     * 初始化系统引用
     */
    private initializeSystems(): void {
        
        if (this.debugMode) {
            console.log(`[OneDimensionalUnitAI] 等待系统引用设置: ${this.node.name}`);
        }
    }

    /**
     * 设置系统引用（由外部系统调用）
     */
    public setSystemReferences(directionFieldSystem: DirectionFieldSystem, oneDGrid: OneDimensionalGrid): void {
        this.directionFieldSystem = directionFieldSystem;
        this.oneDGrid = oneDGrid;
        
        console.log(`[OneDimensionalUnitAI] ✅ 系统引用已设置: ${this.node.name} (方向场: ${!!directionFieldSystem}, 网格: ${!!oneDGrid})`);
        
        // 🎯 关键修复：立即注册到网格系统
        this.registerToGrid();
        
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
     * 强制切换状态（支持MARCHING和ENCOUNTER状态）
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
- 系统就绪: ${this.isSystemReady()}
- AI意图组件: ${this.aiIntentionComponent ? '已连接' : '未连接'}`;
    }

    /**
     * 注册到网格系统
     */
    private registerToGrid(): void {
        if (!this.oneDGrid || !this.factionComponent) {
            console.warn(`[OneDimensionalUnitAI] 无法注册到网格：缺少系统引用或阵营组件: ${this.node.name}`);
            return;
        }

        try {
            // 获取阵营信息并转换为Faction枚举
            const myFactionString = this.factionComponent.aiFaction;
            const myFaction = FactionUtils.stringToFaction(myFactionString);
            
            // 注册到网格系统
            this.oneDGrid.registerEntity(this.node, myFaction, EntityType.CHARACTER);
            
            console.log(`[OneDimensionalUnitAI] 🌐 已注册到网格系统: ${this.node.name} (阵营: ${myFactionString})`);
            
        } catch (error) {
            console.error(`[OneDimensionalUnitAI] 网格注册失败: ${this.node.name}`, error);
        }
    }

    /**
     * 从网格系统注销
     */
    private unregisterFromGrid(): void {
        if (!this.oneDGrid) {
            return;
        }

        try {
            this.oneDGrid.unregisterEntity(this.node);
            console.log(`[OneDimensionalUnitAI] 🌐 已从网格系统注销: ${this.node.name}`);
        } catch (error) {
            console.error(`[OneDimensionalUnitAI] 网格注销失败: ${this.node.name}`, error);
        }
    }

    /**
     * 自动注册到流场系统
     */
    private registerToFlowFieldSystem(): void {
        try {
            console.log(`[OneDimensionalUnitAI] 🔍 尝试注册: ${this.node.name} (管理器存在: ${!!flowFieldManager})`);
            
            if (flowFieldManager && typeof flowFieldManager.registerAIUnit === 'function') {
                flowFieldManager.registerAIUnit(this);
                
                console.log(`[OneDimensionalUnitAI] ✅ 已注册到流场管理器: ${this.node.name}`);
                
                if (this.debugMode) {
                    console.log(`[OneDimensionalUnitAI] 已注册到流场管理器: ${this.node.name}`);
                }
            } else {
                console.error(`[OneDimensionalUnitAI] ❌ 流场管理器不可用: ${this.node.name}`);
            }
        } catch (error) {
            console.error(`[OneDimensionalUnitAI] 流场管理器注册失败: ${this.node.name}`, error);
        }
    }
}