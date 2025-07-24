import { _decorator, Component, Vec2, Vec3, Node, RigidBody2D } from 'cc';
import { Faction } from '../configs/FactionConfig';
import { gridManager, GridManager } from './GridManager';

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
 * 拥挤系统 - 实现所有角色之间的排斥效果
 * 让所有角色在靠近时产生自然的推挤感，避免重叠（不分阵营）
 * 【网格优化版】使用GridManager实现O(k)复杂度的邻居查询
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
    
    // 【网格优化】角色缓存 - 不再按阵营分组，统一管理所有角色
    private allCharacters: ICrowdableCharacter[] = [];
    private lastUpdateTime = 0;
    private readonly UPDATE_INTERVAL = 0.1; // 每0.1秒更新一次，减少性能消耗
    
    // 【网格优化】性能统计
    private performanceStats = {
        lastUpdateCharacterCount: 0,
        avgQueryTime: 0,
        maxQueryTime: 0,
        totalQueries: 0
    };

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
        
        console.log('CrowdingSystem: 网格优化版拥挤系统已初始化（全角色拥挤模式）');
        console.log(`CrowdingSystem: 集成GridManager，预期性能提升: O(n²) → O(k)`);
    }

    /**
     * 注册角色到拥挤系统
     * 【网格优化】同时注册到GridManager - 不分阵营，所有角色统一处理
     */
    public registerCharacter(character: ICrowdableCharacter): void {
        if (this.allCharacters.indexOf(character) === -1) {
            this.allCharacters.push(character);
            
            // 【网格优化】注册到GridManager
            gridManager.addCharacter(character);
            
            const faction = character.getFaction();
            console.log(`CrowdingSystem: 注册角色 (${faction})，总角色数量: ${this.allCharacters.length}`);
        }
    }

    /**
     * 从拥挤系统移除角色
     * 【网格优化】同时从GridManager移除
     */
    public unregisterCharacter(character: ICrowdableCharacter): void {
        const index = this.allCharacters.indexOf(character);
        if (index !== -1) {
            this.allCharacters.splice(index, 1);
            
            // 【网格优化】从GridManager移除
            gridManager.removeCharacter(character);
            
            const faction = character.getFaction();
            console.log(`CrowdingSystem: 移除角色 (${faction})，剩余角色数量: ${this.allCharacters.length}`);
        }
    }

    /**
     * 更新角色位置（当角色移动时调用）
     * 【网格优化】通知GridManager更新角色位置
     */
    public updateCharacterPosition(character: ICrowdableCharacter, oldPos?: Vec3): void {
        gridManager.updateCharacterPosition(character, oldPos);
    }

    /**
     * 更新拥挤效果
     * 【网格优化】使用GridManager减少计算量 - 对所有角色统一处理
     */
    protected update(deltaTime: number): void {
        const currentTime = Date.now() / 1000;
        
        // 性能优化：限制更新频率
        if (currentTime - this.lastUpdateTime < this.UPDATE_INTERVAL) {
            return;
        }
        this.lastUpdateTime = currentTime;

        // 【网格优化】对所有角色统一计算拥挤效果，不分阵营
        if (this.allCharacters.length > 1) {
            this.applyCrowdingForAllCharacters(this.allCharacters, deltaTime);
        }
        
        // 更新性能统计
        this.updatePerformanceStats();
    }

    /**
     * 【网格优化】为所有角色应用拥挤效果 - 不分阵营统一处理
     */
    private applyCrowdingForAllCharacters(characters: ICrowdableCharacter[], deltaTime: number): void {
        // 清理无效角色
        this.cleanupInvalidCharacters();
        
        if (this.allCharacters.length <= 1) return;

        const startTime = performance.now();
        let queryCount = 0;

        // 【网格优化】对每个角色，查询其附近的所有角色（不分阵营）
        for (const character of this.allCharacters) {
            console.log('拥挤-1')
            if (!character || !character.node || !character.node.isValid || !character.isAlive()) {
                continue;
            }
            console.log('拥挤-2')
            // 【关键优化】使用GridManager查询附近的所有角色（移除阵营过滤）
            const nearbyCharacters = gridManager.getNearbyCharacters(
                character.node.position,
                this.CROWDING_RADIUS
                // 注意：这里移除了faction参数，查询所有阵营的角色
            );
            queryCount++;
            console.log('拥挤-3')
            if (nearbyCharacters.length <= 1) {
                continue; // 只有自己，无需计算排斥力
            }
            console.log('拥挤-4')
            // 计算该角色受到的总排斥力
            const totalRepulsion = this.tempVec2_1;
            totalRepulsion.set(0, 0);

            for (const otherCharacter of nearbyCharacters) {
                if (character === otherCharacter) continue;
                
                if (!otherCharacter || !otherCharacter.node || !otherCharacter.node.isValid || !otherCharacter.isAlive()) {
                    continue;
                }

                // 计算两个角色之间的排斥力（不考虑阵营）
                const repulsion = this.calculateRepulsionForce(character, otherCharacter);
                totalRepulsion.add(repulsion);
            }
            console.log('拥挤-5')    
            // 应用排斥力到角色移动
            if (totalRepulsion.length() > 0) {
                console.log('拥挤-6')
                this.applyRepulsionToCharacter(character, totalRepulsion, deltaTime);
                
                // 【网格优化】通知GridManager角色可能移动了
                // 注意：这里不立即更新位置，而是让GridManager在下一帧检查
                // 这样可以避免同一帧内多次位置更新
            }
        }

        // 记录性能数据
        const endTime = performance.now();
        const queryTime = endTime - startTime;
        this.performanceStats.totalQueries += queryCount;
        this.performanceStats.avgQueryTime = (this.performanceStats.avgQueryTime + queryTime) / 2;
        this.performanceStats.maxQueryTime = Math.max(this.performanceStats.maxQueryTime, queryTime);
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
        
        console.log('挤开')// 限制排斥力的最大强度，避免角色被推得太远
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
    private cleanupInvalidCharacters(): void {
        for (let i = this.allCharacters.length - 1; i >= 0; i--) {
            const character = this.allCharacters[i];
            if (!character || !character.node || !character.node.isValid || !character.isAlive()) {
                this.allCharacters.splice(i, 1);
                
                // 【网格优化】同时从GridManager清理
                if (character) {
                    gridManager.removeCharacter(character);
                }
            }
        }
    }

    /**
     * 【网格优化】更新性能统计
     */
    private updatePerformanceStats(): void {
        this.performanceStats.lastUpdateCharacterCount = this.allCharacters.length;
    }

    /**
     * 获取总角色数量
     */
    public getTotalCharacterCount(): number {
        return this.allCharacters.length;
    }

    /**
     * 获取指定阵营的角色数量（用于统计）
     */
    public getFactionCharacterCount(faction: Faction): number {
        return this.allCharacters.filter(char => char.getFaction() === faction).length;
    }

    /**
     * 【网格优化】获取性能统计信息
     */
    public getPerformanceStats(): typeof this.performanceStats & { gridStats: any } {
        return {
            ...this.performanceStats,
            gridStats: gridManager.getStats()
        };
    }

    /**
     * 获取拥挤系统状态信息
     * 【网格优化】包含网格统计 - 显示所有角色统计
     */
    public getStatusInfo(): string {
        let info = 'CrowdingSystem 状态 (全角色拥挤模式):\n';
        
        // 总角色数
        info += `总角色数: ${this.allCharacters.length}\n`;
        
        // 按阵营统计（仅用于显示）
        const factionCounts = new Map<Faction, number>();
        this.allCharacters.forEach(char => {
            const faction = char.getFaction();
            factionCounts.set(faction, (factionCounts.get(faction) || 0) + 1);
        });
        
        info += `阵营分布:\n`;
        factionCounts.forEach((count, faction) => {
            info += `  ${faction}: ${count} 个角色\n`;
        });
        
        info += `更新间隔: ${this.UPDATE_INTERVAL}s\n`;
        info += `拥挤半径: ${this.CROWDING_RADIUS}px\n`;
        info += `排斥力强度: ${this.REPULSION_FORCE}\n`;
        
        // 【网格优化】添加性能信息
        const perfStats = this.getPerformanceStats();
        info += `\n=== 性能统计 ===\n`;
        info += `当前角色数: ${perfStats.lastUpdateCharacterCount}\n`;
        info += `平均查询时间: ${perfStats.avgQueryTime.toFixed(2)}ms\n`;
        info += `最大查询时间: ${perfStats.maxQueryTime.toFixed(2)}ms\n`;
        info += `总查询次数: ${perfStats.totalQueries}\n`;
        
        // 网格统计
        const gridStats = perfStats.gridStats;
        info += `\n=== 网格统计 ===\n`;
        info += `活跃网格数: ${gridStats.activeGrids}\n`;
        info += `网格查询次数: ${gridStats.queryCount}\n`;
        info += `平均每网格角色数: ${gridStats.averageCharactersPerGrid.toFixed(2)}\n`;
        
        return info;
    }

    /**
     * 打印状态信息
     * 【网格优化】包含详细的性能分析
     */
    public printStatusInfo(): void {
        console.log(this.getStatusInfo());
        
        // 额外的网格调试信息
        gridManager.printDebugInfo();
    }

    /**
     * 【网格优化】重置性能统计
     */
    public resetPerformanceStats(): void {
        this.performanceStats.avgQueryTime = 0;
        this.performanceStats.maxQueryTime = 0;
        this.performanceStats.totalQueries = 0;
        console.log('CrowdingSystem: 性能统计已重置');
    }

    /**
     * 【网格优化】批量更新所有角色位置
     * 适用于大规模角色移动后的统一更新
     */
    public batchUpdatePositions(): void {
        let updateCount = 0;
        this.allCharacters.forEach(character => {
            if (character && character.node && character.node.isValid) {
                gridManager.updateCharacterPosition(character);
                updateCount++;
            }
        });
        console.log(`CrowdingSystem: 批量更新了 ${updateCount} 个角色的网格位置`);
    }

    protected onDestroy() {
        if (CrowdingSystem._instance === this) {
            CrowdingSystem._instance = null as any;
        }
    }
}

// 全局实例导出
export const crowdingSystem = CrowdingSystem.instance;