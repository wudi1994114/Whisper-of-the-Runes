// assets/scripts/core/FactionManager.ts

import { _decorator, Component } from 'cc';
import { 
    Faction, 
    FactionRelationships, 
    DEFAULT_FACTION_RELATIONSHIPS,
    FactionUtils
} from '../configs/FactionConfig';

const { ccclass } = _decorator;

/**
 * 阵营管理器
 * 负责管理游戏中的阵营关系和攻击判定
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
        
        // 调试日志
        console.log(`FactionManager: ${attackerFaction} ${willAttack ? '会' : '不会'} 攻击 ${targetFaction}`);
        
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
        const enemies: Faction[] = [];
        
        // 检查当前阵营会攻击的阵营
        const relation = this._currentFactionRelationships[faction];
        if (relation) {
            enemies.push(...relation.attacks);
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
                        }
                    }
                }
            }
        }

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

    protected onDestroy() {
        if (FactionManager._instance === this) {
            FactionManager._instance = null as any;
        }
    }
}

// 全局实例导出
export const factionManager = FactionManager.instance; 