// assets/scripts/core/FactionManager.ts

import { _decorator, Component } from 'cc';
import { 
    Faction, 
    FactionRelationships, 
    DEFAULT_FACTION_RELATIONSHIPS,
    FactionUtils
} from '../configs/FactionConfig';
import { PhysicsGroup } from '../configs/PhysicsConfig';

const { ccclass } = _decorator;

/**
 * 阵营到物理分组的映射表
 * 将游戏阵营映射到对应的物理碰撞分组
 */
const FACTION_TO_PHYSICS_GROUP: { [key in Faction]: number } = {
    [Faction.PLAYER]: PhysicsGroup.PLAYER,
    [Faction.RED]: PhysicsGroup.RED,
    [Faction.BLUE]: PhysicsGroup.BLUE,
    [Faction.GREEN]: PhysicsGroup.GREEN,
    [Faction.PURPLE]: PhysicsGroup.PURPLE,
};

/**
 * 物理分组到阵营的反向映射表
 */
const PHYSICS_GROUP_TO_FACTION: { [key: number]: Faction } = {};

// 初始化反向映射表
for (const faction in FACTION_TO_PHYSICS_GROUP) {
    if (FACTION_TO_PHYSICS_GROUP.hasOwnProperty(faction)) {
        const factionKey = faction as Faction;
        const physicsGroup = FACTION_TO_PHYSICS_GROUP[factionKey];
        PHYSICS_GROUP_TO_FACTION[physicsGroup] = factionKey;
    }
}

/**
 * 阵营管理器
 * 负责管理游戏中的阵营关系、攻击判定和物理碰撞分组映射
 */
@ccclass('FactionManager')
export class FactionManager extends Component {
    private static _instance: FactionManager;
    
    private _currentFactionRelationships: FactionRelationships = DEFAULT_FACTION_RELATIONSHIPS;
    private _isInitialized: boolean = false;

    /**
     * 单例模式获取实例
     */
    public static get instance(): FactionManager {
        if (!this._instance) {
            this._instance = new FactionManager();
        }
        return this._instance;
    }

    protected onLoad() {
        if (FactionManager._instance && FactionManager._instance !== this) {
            this.destroy();
            return;
        }
        FactionManager._instance = this;
        this.initialize();
    }

    /**
     * 初始化阵营管理器
     */
    private initialize(): void {
        if (this._isInitialized) {
            return;
        }

        console.log('FactionManager: 初始化阵营管理器');
        console.log('FactionManager: 当前阵营关系配置:', this._currentFactionRelationships);
        
        this._isInitialized = true;
    }

    /**
     * 设置关卡的阵营关系配置
     * @param relationships 阵营关系配置
     */
    public setFactionRelationships(relationships: FactionRelationships): void {
        if (!FactionUtils.validateFactionRelationships(relationships)) {
            console.warn('FactionManager: 阵营关系配置验证失败，使用默认配置');
            this._currentFactionRelationships = DEFAULT_FACTION_RELATIONSHIPS;
            return;
        }

        this._currentFactionRelationships = { ...relationships };
        console.log('FactionManager: 已更新阵营关系配置:', this._currentFactionRelationships);
    }

    /**
     * 重置为默认阵营关系
     */
    public resetToDefaultRelationships(): void {
        this._currentFactionRelationships = { ...DEFAULT_FACTION_RELATIONSHIPS };
        console.log('FactionManager: 已重置为默认阵营关系');
    }

    /**
     * 检查阵营A是否会攻击阵营B
     * @param attackerFaction 攻击者阵营
     * @param targetFaction 目标阵营
     * @returns 是否会攻击
     */
    public doesAttack(attackerFaction: Faction, targetFaction: Faction): boolean {
        // 同阵营不攻击
        if (attackerFaction === targetFaction) {
            return false;
        }

        const relation = this._currentFactionRelationships[attackerFaction];
        if (!relation) {
            console.warn(`FactionManager: 未找到阵营 ${attackerFaction} 的关系配置，默认不攻击`);
            return false;
        }

        const willAttack = relation.attacks.indexOf(targetFaction) !== -1;
        
        // 移除频繁的调试日志
        
        return willAttack;
    }

    /**
     * 检查两个阵营是否互为敌对
     * @param factionA 阵营A
     * @param factionB 阵营B
     * @returns 是否敌对
     */
    public areEnemies(factionA: Faction, factionB: Faction): boolean {
        return this.doesAttack(factionA, factionB) || this.doesAttack(factionB, factionA);
    }

    /**
     * 检查两个阵营是否友好
     * @param factionA 阵营A
     * @param factionB 阵营B
     * @returns 是否友好
     */
    public areFriendly(factionA: Faction, factionB: Faction): boolean {
        return factionA === factionB || !this.areEnemies(factionA, factionB);
    }

    /**
     * 获取指定阵营的所有敌对阵营
     * @param faction 阵营
     * @returns 敌对阵营列表
     */
    public getEnemyFactions(faction: Faction): Faction[] {
        console.log(`%c[TARGET_DEBUG] 🔍 FactionManager查询敌对阵营 - 查询者阵营: ${faction}`, 'color: darkgreen');
        
        const enemies: Faction[] = [];
        
        // 检查当前阵营会攻击的阵营
        const relation = this._currentFactionRelationships[faction];
        if (relation) {
            enemies.push(...relation.attacks);
            console.log(`%c[TARGET_DEBUG] ⚔️ ${faction} 主动攻击的阵营: [${relation.attacks.join(', ')}]`, 'color: darkgreen');
        } else {
            console.log(`%c[TARGET_DEBUG] ⚠️ 未找到阵营 ${faction} 的关系配置`, 'color: orange');
        }

        // 检查会攻击当前阵营的其他阵营
        for (const otherFactionKey in this._currentFactionRelationships) {
            if (this._currentFactionRelationships.hasOwnProperty(otherFactionKey)) {
                const otherFaction = otherFactionKey as Faction;
                if (otherFaction !== faction) {
                    const otherRelation = this._currentFactionRelationships[otherFaction];
                    if (otherRelation && otherRelation.attacks.indexOf(faction) !== -1) {
                        // 避免重复添加
                        if (enemies.indexOf(otherFaction) === -1) {
                            enemies.push(otherFaction);
                            console.log(`%c[TARGET_DEBUG] 🛡️ ${otherFaction} 会攻击 ${faction}，添加到敌对列表`, 'color: darkgreen');
                        }
                    }
                }
            }
        }

        console.log(`%c[TARGET_DEBUG] 📊 ${faction} 的最终敌对阵营列表: [${enemies.join(', ')}]`, 'color: darkgreen; font-weight: bold');
        
        return enemies;
    }

    /**
     * 获取指定阵营的所有友好阵营
     * @param faction 阵营
     * @returns 友好阵营列表
     */
    public getFriendlyFactions(faction: Faction): Faction[] {
        const friendlies: Faction[] = [faction]; // 包含自己
        
        for (const otherFactionKey in this._currentFactionRelationships) {
            if (this._currentFactionRelationships.hasOwnProperty(otherFactionKey)) {
                const otherFaction = otherFactionKey as Faction;
                if (otherFaction !== faction && this.areFriendly(faction, otherFaction)) {
                    friendlies.push(otherFaction);
                }
            }
        }

        return friendlies;
    }

    /**
     * 获取当前阵营关系配置的调试信息
     */
    public getDebugInfo(): string {
        let info = 'FactionManager 当前配置:\n';
        
        for (const factionKey in this._currentFactionRelationships) {
            if (this._currentFactionRelationships.hasOwnProperty(factionKey)) {
                const relation = this._currentFactionRelationships[factionKey];
                info += `${factionKey} 攻击: [${relation.attacks.join(', ')}]\n`;
            }
        }
        
        return info;
    }

    /**
     * 打印调试信息到控制台
     */
    public printDebugInfo(): void {
        console.log(this.getDebugInfo());
    }

    // ============= 物理碰撞分组映射方法 =============

    /**
     * 获取阵营对应的物理分组
     * @param faction 阵营
     * @returns 物理分组ID
     */
    public getFactionPhysicsGroup(faction: Faction): number {
        const group = FACTION_TO_PHYSICS_GROUP[faction];
        if (group === undefined) {
            console.warn(`FactionManager: 未找到阵营 ${faction} 对应的物理分组，使用默认分组`);
            return PhysicsGroup.DEFAULT;
        }
        return group;
    }

    /**
     * 获取物理分组对应的阵营
     * @param physicsGroup 物理分组ID
     * @returns 阵营，如果未找到则返回null
     */
    public getPhysicsGroupFaction(physicsGroup: number): Faction | null {
        const faction = PHYSICS_GROUP_TO_FACTION[physicsGroup];
        if (!faction) {
            console.warn(`FactionManager: 未找到物理分组 ${physicsGroup} 对应的阵营`);
            return null;
        }
        return faction;
    }

    /**
     * 检查两个物理分组是否应该发生碰撞
     * @param group1 物理分组1
     * @param group2 物理分组2
     * @returns 是否应该碰撞
     */
    public shouldPhysicsGroupsCollide(group1: number, group2: number): boolean {
        const faction1 = this.getPhysicsGroupFaction(group1);
        const faction2 = this.getPhysicsGroupFaction(group2);
        
        if (!faction1 || !faction2) {
            // 如果有未知分组，默认允许碰撞
            return true;
        }
        
        // 检查阵营关系来决定是否碰撞
        return this.areEnemies(faction1, faction2);
    }

    /**
     * 获取与指定阵营敌对的所有物理分组
     * @param faction 阵营
     * @returns 敌对物理分组列表
     */
    public getEnemyPhysicsGroups(faction: Faction): number[] {
        const enemyFactions = this.getEnemyFactions(faction);
        const enemyGroups: number[] = [];
        
        enemyFactions.forEach(enemyFaction => {
            const group = this.getFactionPhysicsGroup(enemyFaction);
            enemyGroups.push(group);
        });
        
        return enemyGroups;
    }

    /**
     * 获取与指定阵营友好的所有物理分组
     * @param faction 阵营
     * @returns 友好物理分组列表
     */
    public getFriendlyPhysicsGroups(faction: Faction): number[] {
        const friendlyFactions = this.getFriendlyFactions(faction);
        const friendlyGroups: number[] = [];
        
        friendlyFactions.forEach(friendlyFaction => {
            const group = this.getFactionPhysicsGroup(friendlyFaction);
            friendlyGroups.push(group);
        });
        
        return friendlyGroups;
    }

    /**
     * 获取阵营和物理分组映射的调试信息
     */
    public getPhysicsGroupMappingInfo(): string {
        let info = 'FactionManager 阵营-物理分组映射:\n';
        
        for (const faction in FACTION_TO_PHYSICS_GROUP) {
            if (FACTION_TO_PHYSICS_GROUP.hasOwnProperty(faction)) {
                const factionKey = faction as Faction;
                const group = FACTION_TO_PHYSICS_GROUP[factionKey];
                const groupName = this.getPhysicsGroupName(group);
                info += `${factionKey} -> ${groupName} (${group})\n`;
            }
        }
        
        return info;
    }

    /**
     * 获取物理分组名称（用于调试）
     */
    private getPhysicsGroupName(group: number): string {
        const groupNames = {
            [PhysicsGroup.DEFAULT]: 'DEFAULT',
            [PhysicsGroup.PLAYER]: 'PLAYER',
            [PhysicsGroup.PLAYER_PROJECTILE]: 'PLAYER_PROJECTILE',
            [PhysicsGroup.RED]: 'RED',
            [PhysicsGroup.RED_PROJECTILE]: 'RED_PROJECTILE',
            [PhysicsGroup.BLUE]: 'BLUE',
            [PhysicsGroup.BLUE_PROJECTILE]: 'BLUE_PROJECTILE',
            [PhysicsGroup.GREEN]: 'GREEN',
            [PhysicsGroup.GREEN_PROJECTILE]: 'GREEN_PROJECTILE',
            [PhysicsGroup.PURPLE]: 'PURPLE',
            [PhysicsGroup.PURPLE_PROJECTILE]: 'PURPLE_PROJECTILE',
            [PhysicsGroup.WORLD_OBSTACLE]: 'WORLD_OBSTACLE',
        };
        
        return groupNames[group] || `UNKNOWN(${group})`;
    }

    /**
     * 打印物理分组映射信息到控制台
     */
    public printPhysicsGroupMappingInfo(): void {
        console.log(this.getPhysicsGroupMappingInfo());
    }

    protected onDestroy() {
        if (FactionManager._instance === this) {
            FactionManager._instance = null as any;
        }
    }
}

// 全局实例导出
export const factionManager = FactionManager.instance; 