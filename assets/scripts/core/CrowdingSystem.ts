// assets/scripts/core/CrowdingSystem.ts

import { _decorator, Component, Vec2, Vec3, Node, RigidBody2D } from 'cc';
import { Faction } from '../configs/FactionConfig';

const { ccclass } = _decorator;

/**
 * 可拥挤角色接口 - 避免循环依赖
 */
export interface ICrowdableCharacter {
    node: Node;
    getFaction(): Faction;
    getRigidBody(): RigidBody2D | null;
    getMoveSpeed(): number;
    isAlive(): boolean;
}

/**
 * 拥挤系统 - 实现同阵营角色之间的排斥效果
 * 让同阵营的角色在靠近时产生自然的推挤感，避免重叠
 */
@ccclass('CrowdingSystem')
export class CrowdingSystem extends Component {
    private static _instance: CrowdingSystem;
    
    // 拥挤参数配置
    private readonly CROWDING_RADIUS = 80;        // 拥挤检测半径
    private readonly REPULSION_FORCE = 150;       // 排斥力强度
    private readonly MAX_REPULSION_DISTANCE = 60; // 最大排斥距离
    private readonly SMOOTH_FACTOR = 0.8;         // 平滑系数，避免抖动
    
    // 性能优化：缓存和临时变量
    private readonly tempVec2_1 = new Vec2();
    private readonly tempVec2_2 = new Vec2();
    private readonly tempVec3_1 = new Vec3();
    
    // 角色缓存，按阵营分组
    private charactersByFaction: Map<Faction, ICrowdableCharacter[]> = new Map();
    private lastUpdateTime = 0;
    private readonly UPDATE_INTERVAL = 0.1; // 每0.1秒更新一次，减少性能消耗

    public static get instance(): CrowdingSystem {
        if (!this._instance) {
            this._instance = new CrowdingSystem();
        }
        return this._instance;
    }

    protected onLoad() {
        if (CrowdingSystem._instance && CrowdingSystem._instance !== this) {
            this.destroy();
            return;
        }
        CrowdingSystem._instance = this;
        
        // 初始化阵营分组
        this.initializeFactionGroups();
        
        console.log('CrowdingSystem: 拥挤系统已初始化');
    }

    /**
     * 初始化阵营分组
     */
    private initializeFactionGroups(): void {
        const factions = [Faction.RED, Faction.BLUE, Faction.GREEN, Faction.PURPLE, Faction.PLAYER];
        factions.forEach(faction => {
            this.charactersByFaction.set(faction, []);
        });
    }

    /**
     * 注册角色到拥挤系统
     */
    public registerCharacter(character: ICrowdableCharacter): void {
        const faction = character.getFaction();
        const characters = this.charactersByFaction.get(faction);
        
        if (characters && characters.indexOf(character) === -1) {
            characters.push(character);
            console.log(`CrowdingSystem: 注册角色到 ${faction} 阵营，当前数量: ${characters.length}`);
        }
    }

    /**
     * 从拥挤系统移除角色
     */
    public unregisterCharacter(character: ICrowdableCharacter): void {
        const faction = character.getFaction();
        const characters = this.charactersByFaction.get(faction);
        
        if (characters) {
            const index = characters.indexOf(character);
            if (index !== -1) {
                characters.splice(index, 1);
                console.log(`CrowdingSystem: 从 ${faction} 阵营移除角色，剩余数量: ${characters.length}`);
            }
        }
    }

    /**
     * 更新拥挤效果
     */
    protected update(deltaTime: number): void {
        const currentTime = Date.now() / 1000;
        
        // 性能优化：限制更新频率
        if (currentTime - this.lastUpdateTime < this.UPDATE_INTERVAL) {
            return;
        }
        this.lastUpdateTime = currentTime;

        // 为每个阵营计算拥挤效果
        this.charactersByFaction.forEach((characters, faction) => {
            if (characters.length > 1) {
                this.applyCrowdingForFaction(characters, deltaTime);
            }
        });
    }

    /**
     * 为指定阵营的角色应用拥挤效果
     */
    private applyCrowdingForFaction(characters: ICrowdableCharacter[], deltaTime: number): void {
        // 清理无效角色
        this.cleanupInvalidCharacters(characters);
        
        if (characters.length <= 1) return;

        // 计算每个角色受到的排斥力
        for (let i = 0; i < characters.length; i++) {
            const character = characters[i];
            if (!character || !character.node || !character.node.isValid) continue;

            // 计算该角色受到的总排斥力
            const totalRepulsion = this.tempVec2_1;
            totalRepulsion.set(0, 0);

            for (let j = 0; j < characters.length; j++) {
                if (i === j) continue;
                
                const otherCharacter = characters[j];
                if (!otherCharacter || !otherCharacter.node || !otherCharacter.node.isValid) continue;

                // 计算两个角色之间的排斥力
                const repulsion = this.calculateRepulsionForce(character, otherCharacter);
                totalRepulsion.add(repulsion);
            }

            // 应用排斥力到角色移动
            if (totalRepulsion.length() > 0) {
                this.applyRepulsionToCharacter(character, totalRepulsion, deltaTime);
            }
        }
    }

    /**
     * 计算两个角色之间的排斥力
     */
    private calculateRepulsionForce(character1: ICrowdableCharacter, character2: ICrowdableCharacter): Vec2 {
        const pos1 = character1.node.position;
        const pos2 = character2.node.position;
        
        // 计算距离向量
        const direction = this.tempVec2_2;
        direction.set(pos1.x - pos2.x, pos1.y - pos2.y);
        
        const distance = direction.length();
        
        // 如果距离太远，不产生排斥力
        if (distance > this.CROWDING_RADIUS || distance < 0.1) {
            return new Vec2(0, 0);
        }

        // 归一化方向向量
        direction.normalize();

        // 计算排斥力强度（距离越近，力越大）
        const forceStrength = this.REPULSION_FORCE * (1 - distance / this.CROWDING_RADIUS);
        
        // 应用平滑因子，避免抖动
        const smoothedForce = forceStrength * this.SMOOTH_FACTOR;

        // 返回排斥力向量
        return new Vec2(direction.x * smoothedForce, direction.y * smoothedForce);
    }

    /**
     * 将排斥力应用到角色
     */
    private applyRepulsionToCharacter(character: ICrowdableCharacter, repulsionForce: Vec2, deltaTime: number): void {
        // 限制排斥力的最大强度，避免角色被推得太远
        const maxForce = this.MAX_REPULSION_DISTANCE;
        if (repulsionForce.length() > maxForce) {
            repulsionForce.normalize();
            repulsionForce.multiplyScalar(maxForce);
        }

        // 获取角色的刚体组件
        const rigidBody = character.getRigidBody();
        if (!rigidBody) return;

        // 将排斥力转换为速度增量
        const velocityDelta = this.tempVec2_1;
        velocityDelta.set(repulsionForce.x * deltaTime, repulsionForce.y * deltaTime);

        // 获取当前速度
        const currentVelocity = rigidBody.linearVelocity;
        
        // 应用排斥力（叠加到当前速度上）
        const newVelocity = new Vec2(
            currentVelocity.x + velocityDelta.x,
            currentVelocity.y + velocityDelta.y
        );

        // 限制最终速度，避免角色移动过快
        const maxSpeed = character.getMoveSpeed() * 1.5; // 允许比正常移动速度快50%
        if (newVelocity.length() > maxSpeed) {
            newVelocity.normalize();
            newVelocity.multiplyScalar(maxSpeed);
        }

        // 应用新速度
        rigidBody.linearVelocity = newVelocity;
    }

    /**
     * 清理无效角色
     */
    private cleanupInvalidCharacters(characters: BaseCharacterDemo[]): void {
        for (let i = characters.length - 1; i >= 0; i--) {
            const character = characters[i];
            if (!character || !character.node || !character.node.isValid || !character.isAlive()) {
                characters.splice(i, 1);
            }
        }
    }

    /**
     * 获取指定阵营的角色数量
     */
    public getFactionCharacterCount(faction: Faction): number {
        const characters = this.charactersByFaction.get(faction);
        return characters ? characters.length : 0;
    }

    /**
     * 获取拥挤系统状态信息
     */
    public getStatusInfo(): string {
        let info = 'CrowdingSystem 状态:\n';
        
        this.charactersByFaction.forEach((characters, faction) => {
            info += `${faction}: ${characters.length} 个角色\n`;
        });
        
        info += `更新间隔: ${this.UPDATE_INTERVAL}s\n`;
        info += `拥挤半径: ${this.CROWDING_RADIUS}px\n`;
        info += `排斥力强度: ${this.REPULSION_FORCE}\n`;
        
        return info;
    }

    /**
     * 打印状态信息
     */
    public printStatusInfo(): void {
        console.log(this.getStatusInfo());
    }

    protected onDestroy() {
        if (CrowdingSystem._instance === this) {
            CrowdingSystem._instance = null as any;
        }
    }
}

// 全局实例导出
export const crowdingSystem = CrowdingSystem.instance;