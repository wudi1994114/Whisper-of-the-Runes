// assets/scripts/components/FactionComponent.ts

import { Component, Collider2D, RigidBody2D } from 'cc';
import { IFactional } from '../interfaces/IFactional';
import { Faction, FactionUtils } from '../configs/FactionConfig';
import { factionManager } from '../managers/FactionManager';
import { ControlComponent } from './ControlComponent';
import { basicEnemyFinder } from './BasicEnemyFinder';

/**
 * 阵营组件 - 负责阵营设置、物理分组管理
 * 实现 IFactional 接口，专注于阵营管理的单一职责
 */
export class FactionComponent extends Component implements IFactional {
    // 阵营相关属性
    private _aiFaction: string = "red";
    private _currentFaction: Faction = Faction.RED;

    // 组件依赖
    private collider: Collider2D | null = null;
    private rigidBody: RigidBody2D | null = null;
    
    // 初始化状态
    private isInitialized: boolean = false;
    private pendingPhysicsUpdate: boolean = false;

    // IFactional 接口属性
    get aiFaction(): string { return this._aiFaction; }
    set aiFaction(value: string) { 
        if (this._aiFaction !== value) {
            this._aiFaction = value;
            this._currentFaction = FactionUtils.stringToFaction(value);
            this.safeUpdatePhysicsGroup();
        }
    }

    protected onLoad(): void {
        // 获取物理组件
        this.collider = this.getComponent(Collider2D);
        this.rigidBody = this.getComponent(RigidBody2D);
        
        // 标记初始化完成
        this.isInitialized = true;
        
        // 如果有待处理的物理分组更新，现在执行
        if (this.pendingPhysicsUpdate) {
            this.updatePhysicsGroup();
            this.pendingPhysicsUpdate = false;
        }
        
        // 监听生命周期事件
        this.node.on('reset-character-state', this.onResetState, this);
        
        console.log(`[FactionComponent] 初始化完成, collider: ${this.collider ? '已找到' : '未找到'}`);
    }

    protected onDestroy(): void {
        // 从目标选择器反注册
        this.deregisterFromTargetSelector();
        
        // 清理事件监听
        this.node.off('reset-character-state', this.onResetState, this);
    }

    /**
     * 设置角色阵营
     * @param faction 阵营
     */
    setFaction(faction: Faction): void {
        const oldFaction = this._currentFaction;
        
        if (oldFaction !== faction) {
            // 先反注册旧阵营
            this.deregisterFromTargetSelector();
            
            // 设置新阵营
            this._currentFaction = faction;
            this._aiFaction = FactionUtils.factionToString(faction);
            
            // 更新物理分组
            this.safeUpdatePhysicsGroup();
            
            // 重新注册新阵营
            this.registerToTargetSelector();
            
            console.log(`[FactionComponent] 阵营已变更: ${oldFaction} → ${faction} (aiFaction: ${this._aiFaction})`);
        } else {
            console.log(`[FactionComponent] 阵营未变化: ${faction}`);
        }
    }

    /**
     * 获取角色阵营
     */
    getFaction(): Faction {
        return this._currentFaction;
    }

    /**
     * 更新角色物理分组
     * @param faction 阵营
     */
    updateCharacterPhysicsGroup(faction: Faction): void {
        // 如果还没初始化，尝试重新获取组件
        if (!this.collider) {
            this.collider = this.getComponent(Collider2D);
        }
        
        if (!this.collider) {
            console.warn(`[FactionComponent] 缺少Collider2D组件，无法设置物理分组 (节点: ${this.node.name})`);
            // 延迟重试
            this.scheduleOnce(() => {
                console.log(`[FactionComponent] 重试获取Collider2D组件...`);
                this.updateCharacterPhysicsGroup(faction);
            }, 0.1);
            return;
        }

        // 使用FactionManager获取对应的物理分组
        const group = factionManager.getFactionPhysicsGroup(faction);
        this.collider.group = group;
        
        console.log(`[FactionComponent] 物理分组已更新为: ${faction} -> ${group} (节点: ${this.node.name})`);
        
        // 同时更新刚体的分组（如果存在）
        if (!this.rigidBody) {
            this.rigidBody = this.getComponent(RigidBody2D);
        }
        if (this.rigidBody) {
            this.rigidBody.group = group;
            console.log(`[FactionComponent] 刚体分组也已更新为: ${group}`);
        }
    }

    /**
     * 设置默认阵营 - 重构版本，增强依赖检查
     */
    setupDefaultFaction(): void {
        // 获取控制组件来判断控制模式 - 使用正确的类型
        let controlComponent = this.getComponent(ControlComponent);
        if (!controlComponent) {
            // 尝试通过节点获取
            controlComponent = this.node.getComponent(ControlComponent);
            if (!controlComponent) {
                console.error(`[FactionComponent] 严重错误：缺少ControlComponent，无法设置默认阵营 (节点: ${this.node.name})`);
                console.log(`[FactionComponent] 节点组件列表:`, this.node.components.map(c => c.constructor.name));
                // 设置一个默认的红色阵营以避免阻塞
                this.setFaction(Faction.RED);
                console.log(`[FactionComponent] 使用默认红色阵营作为回退方案`);
                return;
            }
        }

        const controlMode = controlComponent.controlMode;
        console.log(`[FactionComponent] 检测到控制模式: ${controlMode}, 当前aiFaction: ${this._aiFaction}`);
        
        // AI模式下根据aiFaction设置对应阵营
        if (controlMode === 1) { // ControlMode.AI
            const faction = this.mapAiFactionToEnum(this._aiFaction);
            if (faction !== this._currentFaction) {
                this.setFaction(faction);
                console.log(`[FactionComponent] AI模式，设置阵营为: ${faction} (来源: ${this._aiFaction})`);
            } else {
                console.log(`[FactionComponent] AI模式，阵营已正确设置为: ${faction}`);
            }
            return;
        }

        // 手动控制模式设置为玩家阵营
        if (controlMode === 0) { // ControlMode.MANUAL
            if (this._aiFaction === "player") {
                this.setFaction(Faction.PLAYER);
                console.log(`[FactionComponent] 手动模式，设置默认玩家阵营`);
            } else {
                console.log(`[FactionComponent] 手动模式，但阵营已设置为: ${this._aiFaction}`);
            }
        }
    }

    /**
     * 将字符串阵营映射到枚举
     */
    private mapAiFactionToEnum(aiFaction: string): Faction {
        switch (aiFaction.toLowerCase()) {
            case 'player':
                return Faction.PLAYER;
            case 'blue':
                return Faction.BLUE;
            case 'red':
                return Faction.RED;
            case 'neutral':
                return Faction.RED; // 中性默认为红色
            default:
                console.warn(`[FactionComponent] 未知的aiFaction: ${aiFaction}，默认使用红色阵营`);
                return Faction.RED;
        }
    }

    /**
     * 向目标选择器注册当前角色
     */
    private registerToTargetSelector(): void {
        // 注册到BasicEnemyFinder
        basicEnemyFinder.registerCharacter(this.node, this._currentFaction);
        console.log(`[FactionComponent] 注册到索敌系统: ${this._currentFaction}`);
    }

    /**
     * 从目标选择器反注册当前角色
     */
    private deregisterFromTargetSelector(): void {
        // 从BasicEnemyFinder反注册
        basicEnemyFinder.unregisterCharacter(this.node, this._currentFaction);
        console.log(`[FactionComponent] 从索敌系统反注册: ${this._currentFaction}`);
    }

    /**
     * 安全地更新物理分组（处理初始化顺序问题）
     */
    private safeUpdatePhysicsGroup(): void {
        if (this.isInitialized) {
            // 组件已初始化，直接更新
            this.updatePhysicsGroup();
        } else {
            // 组件未初始化，标记为待处理
            this.pendingPhysicsUpdate = true;
            console.log(`[FactionComponent] 延迟物理分组更新，等待组件初始化完成`);
        }
    }

    /**
     * 更新物理分组（内部使用）
     */
    private updatePhysicsGroup(): void {
        this.updateCharacterPhysicsGroup(this._currentFaction);
    }

    /**
     * 检查是否为敌人
     * @param otherFaction 其他角色的阵营
     */
    isEnemy(otherFaction: Faction): boolean {
        return !this.isFriendly(otherFaction);
    }

    /**
     * 检查是否为友军
     * @param otherFaction 其他角色的阵营
     */
    isFriendly(otherFaction: Faction): boolean {
        // 同阵营为友军
        if (this._currentFaction === otherFaction) {
            return true;
        }
        
        // 玩家和蓝色阵营为友军
        if ((this._currentFaction === Faction.PLAYER && otherFaction === Faction.BLUE) ||
            (this._currentFaction === Faction.BLUE && otherFaction === Faction.PLAYER)) {
            return true;
        }
        
        return false;
    }

    /**
     * 获取阵营显示名称
     */
    getFactionDisplayName(): string {
        return FactionUtils.factionToDisplayName(this._currentFaction);
    }

    /**
     * 重置状态回调
     */
    private onResetState(): void {
        // 重新设置默认阵营
        this.setupDefaultFaction();
    }
}