import { _decorator, Component, Vec2, Node } from 'cc';
import { OrcaAgent } from '../components/OrcaAgent';
import { gridManager } from './GridManager'; // 直接复用！

// 代表ORCA计算出的一条速度约束线
interface OrcaLine {
    point: Vec2;
    direction: Vec2;
}

const { ccclass } = _decorator;

/**
 * ORCA系统管理器
 * 实现Optimal Reciprocal Collision Avoidance算法
 * 替代传统的Boids系统，提供更精确和高效的避让行为
 */
@ccclass('OrcaSystem')
export class OrcaSystem extends Component {
    private static _instance: OrcaSystem | null = null;
    
    public static get instance(): OrcaSystem {
        if (!this._instance) {
            const node = new Node("OrcaSystem");
            this._instance = node.addComponent(OrcaSystem);
        }
        return this._instance;
    }

    private agents: OrcaAgent[] = [];
    private readonly UPDATE_INTERVAL = 0.05; // ORCA建议更频繁的更新 (20 FPS)
    private lastUpdateTime = 0;

    // 临时变量，避免GC
    private tempVec2_1 = new Vec2();
    private tempVec2_2 = new Vec2();
    private tempVec2_3 = new Vec2();
    
    // 性能统计
    private performanceStats = {
        activeAgents: 0,
        orcaLinesCalculated: 0,
        velocitiesSolved: 0,
        averageNeighborsPerAgent: 0,
        lastUpdateTime: 0
    };

    protected onLoad() {
        if (OrcaSystem._instance && OrcaSystem._instance !== this) {
            console.warn('OrcaSystem: 实例已存在，销毁重复实例');
            this.destroy();
            return;
        }
        OrcaSystem._instance = this;
        
        console.log('🔀 OrcaSystem: ORCA避让系统已初始化');
        console.log('🔀 OrcaSystem: 集成GridManager，高性能邻居查询');
    }
    
    /**
     * 注册ORCA代理
     */
    public registerAgent(agent: OrcaAgent): void {
        if (!agent || !agent.isAgentValid()) {
            console.warn('OrcaSystem: 尝试注册无效的代理');
            return;
        }
        
        if (this.agents.indexOf(agent) === -1) {
            this.agents.push(agent);
            console.log(`🔀 OrcaSystem: 代理已注册 ${agent.node.name} (总数: ${this.agents.length})`);
        }
    }

    /**
     * 反注册ORCA代理
     */
    public unregisterAgent(agent: OrcaAgent): void {
        const index = this.agents.indexOf(agent);
        if (index !== -1) {
            this.agents.splice(index, 1);
            console.log(`🔀 OrcaSystem: 代理已反注册 ${agent.node.name} (总数: ${this.agents.length})`);
        }
    }

    protected update(deltaTime: number): void {
        const currentTime = Date.now() / 1000;
        if (currentTime - this.lastUpdateTime < this.UPDATE_INTERVAL) {
            return;
        }
        this.lastUpdateTime = currentTime;

        // 清理无效代理
        this.cleanupInvalidAgents();
        
        if (this.agents.length === 0) {
            return;
        }

        // 1. 计算每个Agent的ORCA线
        this.computeOrcaLines();
        
        // 2. 求解并应用新速度
        this.solveAndApplyVelocities();
        
        // 3. 更新性能统计
        this.updatePerformanceStats();
    }

    /**
     * 清理无效的代理
     */
    private cleanupInvalidAgents(): void {
        const validAgents: OrcaAgent[] = [];
        for (const agent of this.agents) {
            if (agent && agent.isAgentValid()) {
                validAgents.push(agent);
            }
        }
        
        const removedCount = this.agents.length - validAgents.length;
        if (removedCount > 0) {
            this.agents = validAgents;
            console.log(`🔀 OrcaSystem: 清理了 ${removedCount} 个无效代理`);
        }
    }

    /**
     * 计算所有代理的ORCA约束线
     */
    private computeOrcaLines(): void {
        let totalOrcaLines = 0;
        let totalNeighbors = 0;
        
        for (const agent of this.agents) {
            if (!agent || !agent.isAgentValid()) continue;

            // 复用 GridManager 来获取邻居！
            const neighbors = gridManager.getNearbyCharacters(agent.node.position, agent.neighborDist);
            totalNeighbors += neighbors.length;

            const orcaLines: OrcaLine[] = [];

            // 与其他Agent的交互
            for (const otherChar of neighbors) {
                const otherAgent = otherChar.node.getComponent(OrcaAgent);
                if (!otherAgent || agent === otherAgent || !otherAgent.isAgentValid()) continue;
                
                const line = this.calculateAgentOrcaLine(agent, otherAgent);
                if (line) {
                    orcaLines.push(line);
                    totalOrcaLines++;
                }
            }

            // TODO: 与静态障碍物的交互 (未来可以扩展)
            // orcaLines.push(...this.calculateObstacleOrcaLines(agent));

            // 将计算结果存回agent
            (agent as any)._orcaLines = orcaLines;
        }
        
        this.performanceStats.orcaLinesCalculated = totalOrcaLines;
        this.performanceStats.averageNeighborsPerAgent = this.agents.length > 0 ? totalNeighbors / this.agents.length : 0;
    }
    
    /**
     * [最终修正版] 计算两个代理之间的ORCA约束线
     * 这个版本修正了导致吸引行为的向量计算错误，并简化了逻辑。
     */
    private calculateAgentOrcaLine(agentA: OrcaAgent, agentB: OrcaAgent): OrcaLine | null {
        const rbA = agentA.character?.getRigidBody();
        const rbB = agentB.character?.getRigidBody();
        if (!rbA || !rbB) return null;

        const velA = rbA.linearVelocity;
        const radiusA = agentA.radius;
        
        const velB = rbB.linearVelocity;
        const radiusB = agentB.radius;

        const posA = agentA.position;
        const posB = agentB.position;

        const relativePosition = this.tempVec2_1.set(posB).subtract(posA);
        const relativeVelocity = this.tempVec2_2.set(velA).subtract(velB);
        const distSq = relativePosition.lengthSqr();
        const combinedRadius = radiusA + radiusB;
        const combinedRadiusSq = combinedRadius * combinedRadius;

        const timeHorizon = agentA.timeHorizon;
        const invTimeHorizon = 1.0 / timeHorizon;

        let u: Vec2;        // 这是从相对速度指向VO边界的最短向量（核心）

        if (distSq > combinedRadiusSq) {
            // Case 1: Agents are not colliding.
            // VO is a truncated cone. voCenter is the apex of the cone.
            const voCenter = relativePosition.clone().multiplyScalar(invTimeHorizon);
            
            // Vector from the apex of the cone to the relative velocity
            const w = relativeVelocity.clone().subtract(voCenter);
            const wLengthSq = w.lengthSqr();
            
            const dotProduct = w.dot(relativePosition);

            // Check if the relative velocity is inside the cone
            if (dotProduct < 0 && dotProduct * dotProduct > combinedRadiusSq * wLengthSq) {
                // The relative velocity is outside the cone, on the side. We need to find the shortest vector 'u' to the cone's side.
                const wLength = Math.sqrt(wLengthSq);
                const unitW = w.clone().normalize();

                u = unitW.multiplyScalar(combinedRadius * invTimeHorizon - wLength);

            } else {
                // The relative velocity is inside or in front of the cone.
                // We need to project it onto the edge of the cone.
                const leg = Math.sqrt(distSq - combinedRadiusSq);

                if (relativePosition.cross(w) > 0.0) {
                    // Project onto the left side of the cone
                    const normal = new Vec2(relativePosition.y, -relativePosition.x).normalize();
                    u = normal.multiplyScalar(leg).add(relativePosition).multiplyScalar(invTimeHorizon).subtract(relativeVelocity);
                } else {
                    // Project onto the right side of the cone
                    const normal = new Vec2(-relativePosition.y, relativePosition.x).normalize();
                    u = normal.multiplyScalar(leg).add(relativePosition).multiplyScalar(invTimeHorizon).subtract(relativeVelocity);
                }
            }

        } else {
            // Case 2: Agents are colliding.
            // We need to push them apart.
            const invTimeStep = 1.0 / this.UPDATE_INTERVAL;
            const w = relativeVelocity.clone().subtract(relativePosition.clone().multiplyScalar(invTimeStep));
            const wLength = w.length();
            let unitW: Vec2;
            if (w.lengthSqr() > 0) {
                unitW = w.clone().normalize();
            } else {
                unitW = new Vec2();
            }

            u = unitW.multiplyScalar(combinedRadius * invTimeStep - wLength);
        }

        // The ORCA line is defined by a point and a normal (direction)
        // Point: current agent's velocity + half of the correction vector
        // Normal: the direction of the correction vector
        const point = velA.clone().add(u.clone().multiplyScalar(0.5));
        
        if (u.lengthSqr() < 0.0001) {
            // If the correction vector is tiny, we can use the relative position to push away
            // This handles cases where they are on top of each other with no relative velocity
            if (relativePosition.lengthSqr() < 0.0001) {
                // If they are exactly at the same spot, generate a random direction
                const randomAngle = Math.random() * 2 * Math.PI;
                return { point, direction: new Vec2(Math.cos(randomAngle), Math.sin(randomAngle)) };
            }
            return { point, direction: relativePosition.clone().normalize().multiplyScalar(-1) };
        }

        const direction = u.clone().normalize();
        
        return { point, direction };
    }
    
    /**
     * 求解并应用速度
     */
    private solveAndApplyVelocities(): void {
        let solvedCount = 0;
        
        for (const agent of this.agents) {
            if (!agent || !agent.isAgentValid()) continue;

            const orcaLines: OrcaLine[] = (agent as any)._orcaLines || [];
            let newVelocity = agent.prefVelocity.clone();
            
            // 迭代求解，找到满足所有约束的速度
            const maxIterations = Math.min(orcaLines.length, 10); // 限制迭代次数
            
            for (let i = 0; i < maxIterations; i++) {
                let violatesConstraint = false;
                
                for (const line of orcaLines) {
                    const relativePoint = this.tempVec2_1.set(
                        newVelocity.x - line.point.x, 
                        newVelocity.y - line.point.y
                    );
                    const dot = relativePoint.dot(line.direction);

                    if (dot < 0) {
                        // 速度在约束线的"错误"一侧，投影到正确一侧
                        const projection = line.direction.clone().multiplyScalar(dot);
                        newVelocity.subtract(projection);
                        violatesConstraint = true;
                    }
                }
                
                // 如果没有违反约束，可以提前退出
                if (!violatesConstraint) {
                    break;
                }
            }
            
            // 限制最大速度
            const maxSpeed = agent.getMaxSpeed();
            if (newVelocity.length() > maxSpeed) {
                newVelocity.normalize().multiplyScalar(maxSpeed);
            }
            
            // 应用速度
            agent.newVelocity = newVelocity;
            agent.setVelocity(newVelocity);
            solvedCount++;
        }
        
        this.performanceStats.velocitiesSolved = solvedCount;
    }

    /**
     * 更新性能统计
     */
    private updatePerformanceStats(): void {
        this.performanceStats.activeAgents = this.agents.length;
        this.performanceStats.lastUpdateTime = Date.now() / 1000;
    }

    /**
     * 获取性能统计信息
     */
    public getPerformanceStats() {
        return { ...this.performanceStats };
    }

    /**
     * 打印调试信息
     */
    public printDebugInfo(): void {
        const stats = this.getPerformanceStats();
        console.log('\n=== OrcaSystem 调试信息 ===');
        console.log(`活跃代理数: ${stats.activeAgents}`);
        console.log(`ORCA线计算数: ${stats.orcaLinesCalculated}`);
        console.log(`速度求解数: ${stats.velocitiesSolved}`);
        console.log(`平均邻居数/代理: ${stats.averageNeighborsPerAgent.toFixed(2)}`);
        console.log(`更新间隔: ${this.UPDATE_INTERVAL}s`);
        console.log('========================\n');
    }

    /**
     * 重置系统
     */
    public reset(): void {
        this.agents = [];
        this.performanceStats = {
            activeAgents: 0,
            orcaLinesCalculated: 0,
            velocitiesSolved: 0,
            averageNeighborsPerAgent: 0,
            lastUpdateTime: 0
        };
        console.log('🔀 OrcaSystem: 系统已重置');
    }

    protected onDestroy() {
        if (OrcaSystem._instance === this) {
            OrcaSystem._instance = null;
        }
    }
}

// 导出单例访问函数
export function getOrcaSystem(): OrcaSystem | null {
    return OrcaSystem.instance;
}

// 导出单例
export const orcaSystem = OrcaSystem.instance; 