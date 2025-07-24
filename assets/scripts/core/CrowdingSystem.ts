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
 * Boids群聚系统 - 实现基于Boids算法的群体行为
 * 包含分离(Separation)、对齐(Alignment)、聚合(Cohesion)三个核心规则
 * 【网格优化版】使用GridManager实现O(k)复杂度的邻居查询
 */
@ccclass('CrowdingSystem')
export class CrowdingSystem extends Component {
    private static _instance: CrowdingSystem;
    
    // Boids算法参数配置
    private readonly NEIGHBOR_RADIUS = 60;           // 邻居检测半径
    private readonly SEPARATION_RADIUS = 30;         // 分离行为半径
    
    // Boids三个规则的权重
    private readonly SEPARATION_WEIGHT = 2.0;        // 分离权重（避免碰撞）
    private readonly ALIGNMENT_WEIGHT = 1.0;         // 对齐权重（方向一致）
    private readonly COHESION_WEIGHT = 1.0;          // 聚合权重（向群体中心）
    
    // 物理参数
    private readonly MAX_FORCE = 8.0;                // 最大施加力
    private readonly MAX_SPEED_MULTIPLIER = 1.5;     // 最大速度倍数
    private readonly SMOOTH_FACTOR = 0.8;            // 平滑系数
    
    // 【开关控制】系统启用状态
    private _isEnabled = true;
    
    // 性能优化：缓存和临时变量
    private readonly tempVec2_1 = new Vec2();
    private readonly tempVec2_2 = new Vec2();
    private readonly tempVec2_3 = new Vec2();
    private readonly tempVec3_1 = new Vec3();
    
    // 角色缓存
    private allCharacters: ICrowdableCharacter[] = [];
    private lastUpdateTime = 0;
    private readonly UPDATE_INTERVAL = 0.1; // 每0.1秒更新一次
    
    // 性能统计
    private performanceStats = {
        lastUpdateCharacterCount: 0,
        avgQueryTime: 0,
        maxQueryTime: 0,
        totalQueries: 0,
        separationCalculations: 0,
        alignmentCalculations: 0,
        cohesionCalculations: 0
    };

    public static get instance(): CrowdingSystem | null {
        return this._instance;
    }

    protected onLoad() {
        if (CrowdingSystem._instance && CrowdingSystem._instance !== this) {
            console.warn('Boids群聚系统: 实例已存在，销毁重复实例');
            this.destroy();
            return;
        }
        CrowdingSystem._instance = this;
        
        console.log('Boids群聚系统: 已初始化（分离+对齐+聚合）');
        console.log(`Boids群聚系统: 集成GridManager，性能优化: O(n²) → O(k)`);
    }

    /**
     * 注册角色到Boids系统
     */
    public registerCharacter(character: ICrowdableCharacter): void {
        if (this.allCharacters.indexOf(character) === -1) {
            this.allCharacters.push(character);
            gridManager.addCharacter(character);
            
            const faction = character.getFaction();
            console.log(`Boids系统: 注册角色 (${faction})，总数: ${this.allCharacters.length}`);
        }
    }

    /**
     * 从Boids系统移除角色
     */
    public unregisterCharacter(character: ICrowdableCharacter): void {
        const index = this.allCharacters.indexOf(character);
        if (index !== -1) {
            this.allCharacters.splice(index, 1);
            gridManager.removeCharacter(character);
            
            const faction = character.getFaction();
            console.log(`Boids系统: 移除角色 (${faction})，剩余: ${this.allCharacters.length}`);
        }
    }

    /**
     * 更新角色位置
     */
    public updateCharacterPosition(character: ICrowdableCharacter, oldPos?: Vec3): void {
        gridManager.updateCharacterPosition(character, oldPos);
    }

    /**
     * 主更新循环 - 应用Boids算法
     */
    protected update(deltaTime: number): void {
        if (!this._isEnabled) {
            return;
        }
        
        const currentTime = Date.now() / 1000;
        
        // 性能优化：限制更新频率
        if (currentTime - this.lastUpdateTime < this.UPDATE_INTERVAL) {
            return;
        }
        this.lastUpdateTime = currentTime;

        // 应用Boids算法到所有角色
        if (this.allCharacters.length > 1) {
            this.applyBoidsAlgorithm(deltaTime);
        }
        
        this.updatePerformanceStats();
    }

    /**
     * 应用Boids算法的核心实现
     */
    private applyBoidsAlgorithm(deltaTime: number): void {
        this.cleanupInvalidCharacters();
        
        if (this.allCharacters.length <= 1) return;

        const startTime = performance.now();
        let queryCount = 0;

        // 重置统计计数器
        this.performanceStats.separationCalculations = 0;
        this.performanceStats.alignmentCalculations = 0;
        this.performanceStats.cohesionCalculations = 0;

        for (const character of this.allCharacters) {
            if (!character || !character.node || !character.node.isValid || !character.isAlive()) {
                continue;
            }

            // 使用GridManager查询邻居
            const neighbors = gridManager.getNearbyCharacters(
                character.node.position,
                this.NEIGHBOR_RADIUS
            );
            queryCount++;

            if (neighbors.length <= 1) continue; // 只有自己

            // 计算Boids三个规则的力
            const separationForce = this.calculateSeparation(character, neighbors);
            const alignmentForce = this.calculateAlignment(character, neighbors);
            const cohesionForce = this.calculateCohesion(character, neighbors);

            // 组合所有力
            const totalForce = this.tempVec2_1;
            totalForce.set(0, 0);
            
            // 应用权重并组合力
            totalForce.add2f(
                separationForce.x * this.SEPARATION_WEIGHT,
                separationForce.y * this.SEPARATION_WEIGHT
            );
            totalForce.add2f(
                alignmentForce.x * this.ALIGNMENT_WEIGHT,
                alignmentForce.y * this.ALIGNMENT_WEIGHT
            );
            totalForce.add2f(
                cohesionForce.x * this.COHESION_WEIGHT,
                cohesionForce.y * this.COHESION_WEIGHT
            );

            // 应用力到角色
            this.applyForceToCharacter(character, totalForce, deltaTime);
        }

        // 记录性能数据
        const endTime = performance.now();
        const queryTime = endTime - startTime;
        this.performanceStats.totalQueries += queryCount;
        this.performanceStats.avgQueryTime = (this.performanceStats.avgQueryTime + queryTime) / 2;
        this.performanceStats.maxQueryTime = Math.max(this.performanceStats.maxQueryTime, queryTime);
    }

    /**
     * Boids规则1: 分离 (Separation)
     * 避免与邻近个体过于接近
     */
    private calculateSeparation(character: ICrowdableCharacter, neighbors: ICrowdableCharacter[]): Vec2 {
        const steer = this.tempVec2_2;
        steer.set(0, 0);
        let count = 0;

        const characterPos = character.node.position;

        for (const neighbor of neighbors) {
            if (neighbor === character) continue;
            if (!neighbor || !neighbor.node || !neighbor.node.isValid || !neighbor.isAlive()) continue;

            const neighborPos = neighbor.node.position;
            const distance = Vec3.distance(characterPos, neighborPos);

            // 只考虑分离半径内的邻居
            if (distance > 0 && distance < this.SEPARATION_RADIUS) {
                const diff = this.tempVec3_1;
                Vec3.subtract(diff, characterPos, neighborPos);
                
                // 标准化并根据距离加权（距离越近，力越大）
                const magnitude = diff.length();
                if (magnitude > 0) {
                    diff.normalize();
                    diff.multiplyScalar(1.0 / distance); // 距离越近，力越大
                    steer.add2f(diff.x, diff.y);
                    count++;
                }
            }
        }

        // 平均化并限制力的大小
        if (count > 0) {
            steer.multiplyScalar(1.0 / count);
            this.limitForce(steer, this.MAX_FORCE);
            this.performanceStats.separationCalculations++;
        }

        return steer;
    }

    /**
     * Boids规则2: 对齐 (Alignment)
     * 与邻近个体保持相同的方向
     */
    private calculateAlignment(character: ICrowdableCharacter, neighbors: ICrowdableCharacter[]): Vec2 {
        const averageVelocity = this.tempVec2_3;
        averageVelocity.set(0, 0);
        let count = 0;

        for (const neighbor of neighbors) {
            if (neighbor === character) continue;
            if (!neighbor || !neighbor.node || !neighbor.node.isValid || !neighbor.isAlive()) continue;

            const rigidBody = neighbor.getRigidBody();
            if (rigidBody) {
                const velocity = rigidBody.linearVelocity;
                averageVelocity.add(velocity);
                count++;
            }
        }

        if (count > 0) {
            // 计算平均速度方向
            averageVelocity.multiplyScalar(1.0 / count);
            
            // 计算转向力（希望的速度 - 当前速度）
            const currentRigidBody = character.getRigidBody();
            if (currentRigidBody) {
                const steer = this.tempVec2_2;
                Vec2.subtract(steer, averageVelocity, currentRigidBody.linearVelocity);
                this.limitForce(steer, this.MAX_FORCE);
                this.performanceStats.alignmentCalculations++;
                return steer;
            }
        }

        return new Vec2(0, 0);
    }

    /**
     * Boids规则3: 聚合 (Cohesion)
     * 向邻近个体的重心移动
     */
    private calculateCohesion(character: ICrowdableCharacter, neighbors: ICrowdableCharacter[]): Vec2 {
        const centerOfMass = this.tempVec3_1;
        centerOfMass.set(0, 0, 0);
        let count = 0;

        for (const neighbor of neighbors) {
            if (neighbor === character) continue;
            if (!neighbor || !neighbor.node || !neighbor.node.isValid || !neighbor.isAlive()) continue;

            centerOfMass.add(neighbor.node.position);
            count++;
        }

        if (count > 0) {
            // 计算重心
            centerOfMass.multiplyScalar(1.0 / count);
            
            // 计算向重心的转向力
            const characterPos = character.node.position;
            const desired = this.tempVec2_2;
            desired.set(centerOfMass.x - characterPos.x, centerOfMass.y - characterPos.y);
            
            // 标准化到期望速度
            const maxSpeed = character.getMoveSpeed();
            if (desired.length() > 0) {
                desired.normalize();
                desired.multiplyScalar(maxSpeed);
                
                // 计算转向力
                const currentRigidBody = character.getRigidBody();
                if (currentRigidBody) {
                    const steer = this.tempVec2_3;
                    Vec2.subtract(steer, desired, currentRigidBody.linearVelocity);
                    this.limitForce(steer, this.MAX_FORCE);
                    this.performanceStats.cohesionCalculations++;
                    return steer;
                }
            }
        }

        return new Vec2(0, 0);
    }

    /**
     * 限制力的大小
     */
    private limitForce(force: Vec2, maxForce: number): void {
        if (force.length() > maxForce) {
            force.normalize();
            force.multiplyScalar(maxForce);
        }
    }

    /**
     * 将计算出的力应用到角色
     */
    private applyForceToCharacter(character: ICrowdableCharacter, force: Vec2, deltaTime: number): void {
        if (force.length() < 0.1) return; // 忽略微小的力

        const rigidBody = character.getRigidBody();
        if (!rigidBody) return;

        // 应用平滑因子
        force.multiplyScalar(this.SMOOTH_FACTOR);

        // 转换为速度增量
        const velocityDelta = this.tempVec2_1;
        velocityDelta.set(force.x * deltaTime, force.y * deltaTime);

        // 获取当前速度并应用增量
        const currentVelocity = rigidBody.linearVelocity;
        const newVelocity = new Vec2(
            currentVelocity.x + velocityDelta.x,
            currentVelocity.y + velocityDelta.y
        );

        // 限制最大速度
        const maxSpeed = character.getMoveSpeed() * this.MAX_SPEED_MULTIPLIER;
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

    // ==================== 【开关控制】Boids系统启用控制 ====================
    
    /**
     * 启用Boids群聚系统
     */
    public enableBoids(): void {
        this._isEnabled = true;
        console.log('Boids系统: 群聚算法已启用');
    }

    /**
     * 禁用Boids群聚系统
     */
    public disableBoids(): void {
        this._isEnabled = false;
        console.log('Boids系统: 群聚算法已禁用');
    }

    /**
     * 切换Boids系统启用状态
     */
    public toggleBoids(): void {
        this._isEnabled = !this._isEnabled;
        console.log(`Boids系统: 群聚算法已${this._isEnabled ? '启用' : '禁用'}`);
    }

    /**
     * 获取Boids系统启用状态
     */
    public isEnabled(): boolean {
        return this._isEnabled;
    }

    // 兼容性方法（保持向后兼容）
    public enableCrowding = this.enableBoids;
    public disableCrowding = this.disableBoids;
    public toggleCrowding = this.toggleBoids;

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
     * 获取当前Boids算法参数配置
     */
    public getBoidsConfig(): { [key: string]: number } {
        return {
            neighborRadius: this.NEIGHBOR_RADIUS,
            separationRadius: this.SEPARATION_RADIUS,
            separationWeight: this.SEPARATION_WEIGHT,
            alignmentWeight: this.ALIGNMENT_WEIGHT,
            cohesionWeight: this.COHESION_WEIGHT,
            maxForce: this.MAX_FORCE,
            maxSpeedMultiplier: this.MAX_SPEED_MULTIPLIER,
            smoothFactor: this.SMOOTH_FACTOR,
            updateInterval: this.UPDATE_INTERVAL
        };
    }

    // 兼容性方法
    public getCrowdingConfig = this.getBoidsConfig;

    /**
     * 获取Boids群聚系统状态信息
     * 【网格优化】包含网格统计和Boids算法统计
     */
    public getStatusInfo(): string {
        let info = 'Boids群聚系统状态 (分离+对齐+聚合):\n';
        
        // 系统启用状态
        info += `系统状态: ${this._isEnabled ? '🟢 已启用' : '🔴 已禁用'}\n`;
        
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
        
        info += `\n=== Boids算法参数 ===\n`;
        info += `更新间隔: ${this.UPDATE_INTERVAL}s\n`;
        info += `邻居检测半径: ${this.NEIGHBOR_RADIUS}px\n`;
        info += `分离行为半径: ${this.SEPARATION_RADIUS}px\n`;
        info += `分离权重: ${this.SEPARATION_WEIGHT} (避免碰撞)\n`;
        info += `对齐权重: ${this.ALIGNMENT_WEIGHT} (方向一致)\n`;
        info += `聚合权重: ${this.COHESION_WEIGHT} (向群体中心)\n`;
        info += `最大施加力: ${this.MAX_FORCE}\n`;
        info += `最大速度倍数: ${this.MAX_SPEED_MULTIPLIER}x\n`;
        info += `平滑系数: ${this.SMOOTH_FACTOR}\n`;
        
        // 【网格优化】添加性能信息
        const perfStats = this.getPerformanceStats();
        info += `\n=== 性能统计 ===\n`;
        info += `当前角色数: ${perfStats.lastUpdateCharacterCount}\n`;
        info += `平均查询时间: ${perfStats.avgQueryTime.toFixed(2)}ms\n`;
        info += `最大查询时间: ${perfStats.maxQueryTime.toFixed(2)}ms\n`;
        info += `总查询次数: ${perfStats.totalQueries}\n`;
        
        info += `\n=== Boids算法统计 ===\n`;
        info += `分离计算次数: ${perfStats.separationCalculations}\n`;
        info += `对齐计算次数: ${perfStats.alignmentCalculations}\n`;
        info += `聚合计算次数: ${perfStats.cohesionCalculations}\n`;
        
        // 网格统计
        const gridStats = perfStats.gridStats;
        info += `\n=== 网格统计 ===\n`;
        info += `活跃网格数: ${gridStats.activeGrids}\n`;
        info += `网格查询次数: ${gridStats.queryCount}\n`;
        info += `平均每网格角色数: ${gridStats.averageCharactersPerGrid.toFixed(2)}\n`;
        
        return info;
    }

    /**
     * 打印Boids系统状态信息
     * 【网格优化】包含详细的性能分析和Boids算法统计
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
        this.performanceStats.separationCalculations = 0;
        this.performanceStats.alignmentCalculations = 0;
        this.performanceStats.cohesionCalculations = 0;
        console.log('Boids系统: 性能统计已重置');
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
        console.log(`Boids系统: 批量更新了 ${updateCount} 个角色的网格位置`);
    }

    protected onDestroy() {
        if (CrowdingSystem._instance === this) {
            CrowdingSystem._instance = null as any;
        }
    }
}

// 全局实例访问器 - 安全获取Boids系统单例实例
export function getCrowdingSystem(): CrowdingSystem | null {
    return CrowdingSystem.instance;
}

// Boids系统访问器别名
export function getBoidsSystem(): CrowdingSystem | null {
    return CrowdingSystem.instance;
}