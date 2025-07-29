import { _decorator, Component, Vec2, Node } from 'cc';
import { OrcaAgent } from '../components/OrcaAgent';
import { gridManager } from './GridManager'; // 直接复用！

// 代表ORCA计算出的一条速度约束线
interface OrcaLine {
    point: Vec2;
    direction: Vec2;
}

const { ccclass } = _decorator;

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
    private lastDebugPrintTime = 0;

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
            this.destroy();
            return;
        }
        OrcaSystem._instance = this;
    }
    
    /**
     * 注册ORCA代理
     */
    public registerAgent(agent: OrcaAgent): void {
        if (!agent || !agent.isAgentValid()) {
            return;
        }
        
        if (this.agents.indexOf(agent) === -1) {
            this.agents.push(agent);
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
        
        // 控制更新频率
        if (currentTime - this.lastUpdateTime < this.UPDATE_INTERVAL) {
            return;
        }
        
        // 【调试增强】添加ORCA系统运行状态日志
        if (currentTime - this.lastDebugPrintTime > 2.0) { // 每2秒打印一次
            console.log(`[123|OrcaSystem] OrcaSystem: 运行中，代理数量=${this.agents.length}, 活跃代理=${this.agents.filter(a => a && a.isAgentValid()).length}`)
            this.lastDebugPrintTime = currentTime;
        }
        
        this.lastUpdateTime = currentTime;
        
        // 清理无效代理
        this.agents = this.agents.filter(agent => agent && agent.isAgentValid());
        
        if (this.agents.length === 0) {
            console.log(`[123|OrcaSystem] OrcaSystem: 无活跃代理，跳过更新`)
            return;
        }
        
        console.log(`[123|OrcaSystem] OrcaSystem: 开始处理 ${this.agents.length} 个代理`)
        
        // 重置性能统计
        this.performanceStats.activeAgents = this.agents.length;
        this.performanceStats.orcaLinesCalculated = 0;
        this.performanceStats.velocitiesSolved = 0;
        this.performanceStats.averageNeighborsPerAgent = 0;
        
        // 计算ORCA约束线
        this.computeOrcaLines();
        
        // 求解并应用速度
        this.solveAndApplyVelocities();
        
        this.performanceStats.lastUpdateTime = currentTime;
        
        console.log(`[123|OrcaSystem] OrcaSystem: 完成更新，计算了 ${this.performanceStats.orcaLinesCalculated} 条约束线，求解了 ${this.performanceStats.velocitiesSolved} 个速度`)
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

            // 使用有效的邻居搜索距离（考虑自动调整）
            const effectiveNeighborDist = agent.getEffectiveNeighborDist();
            const neighbors = gridManager.getNearbyCharacters(agent.node.position, effectiveNeighborDist);
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
     * 计算两个代理之间的ORCA约束线
     * 基于标准RVO2算法实现，修复了锥体投影逻辑
     */
    private calculateAgentOrcaLine(agentA: OrcaAgent, agentB: OrcaAgent): OrcaLine | null {
        // 【修复】直接检查节点名称，排除自己和自己计算
        if (agentA.node.name === agentB.node.name) {
            return null;
        }
        
        const rbA = agentA.character?.getRigidBody();
        const rbB = agentB.character?.getRigidBody();
        if (!rbA || !rbB) return null;

        // 获取代理基本属性（使用有效值）
        const velA = rbA.linearVelocity;
        const velB = rbB.linearVelocity;
        const posA = agentA.position;
        const posB = agentB.position;
        const radiusA = agentA.getEffectiveRadius(); // 使用有效半径
        const radiusB = agentB.getEffectiveRadius(); // 使用有效半径
        
        console.log(`[ORCA 调试] A半径: ${radiusA}, B半径: ${radiusB}`);
        const timeHorizon = agentA.getEffectiveTimeHorizon(); // 使用有效时间域

        // 根据响应敏感度调整互惠性
        const responsiveness = agentA.responsiveness;
        const reciprocityFactor = Math.min(1.0, responsiveness);

        // 计算相对位置和相对速度
        const relativePosition = this.tempVec2_1.set(posB).subtract(posA);
        const relativeVelocity = this.tempVec2_2.set(velA).subtract(velB);
        
        const dist = relativePosition.length();
        const combinedRadius = radiusA + radiusB;

        let u: Vec2; // 从当前相对速度指向VO边界的最小修正向量

        if (dist > combinedRadius) {
            // === 情况1：代理未碰撞，构建截断速度障碍锥体 ===
            // 几何原理：在速度空间中，所有会导致碰撞的相对速度形成一个以原点为顶点的圆锥
            // 由于我们只关心timeHorizon时间内的碰撞，锥体被"截断"，形成有限的障碍区域
            
            // voApex: 截断锥体的"顶点"在速度空间中的位置
            // 物理意义：如果相对速度等于voApex，两代理将在timeHorizon时间后刚好接触
            const voApex = relativePosition.clone().multiplyScalar(1.0 / timeHorizon);
            
            // w: 从截断锥体顶点指向当前相对速度的向量
            // 用于判断当前相对速度在锥体中的位置关系
            const w = relativeVelocity.clone().subtract(voApex);
            
            // === 计算锥体的几何参数 ===
            // tanHalfAngle: 锥体半角的正切值，由两代理的距离和组合半径决定
            const tanHalfAngle = combinedRadius / dist;
            const sinHalfAngle = tanHalfAngle / Math.sqrt(1 + tanHalfAngle * tanHalfAngle);
            const cosHalfAngle = 1.0 / Math.sqrt(1 + tanHalfAngle * tanHalfAngle);
            
            // === 判断相对速度在锥体中的位置 ===
            const wDotRelPos = w.dot(relativePosition);
            const wLengthSq = w.lengthSqr();
            
            // 检查是否在锥体外侧：利用几何关系判断角度
            if (wDotRelPos < 0 && wDotRelPos * wDotRelPos > combinedRadius * combinedRadius * wLengthSq / (dist * dist)) {
                // 相对速度在锥体外侧，需要找到到锥体边界的最短向量
                // 这种情况下，最短路径是直接移动到锥体边上的最近点
                const wLength = Math.sqrt(wLengthSq);
                if (wLength > 0.001) {
                    const unitW = w.clone().normalize();
                    // 计算到锥体圆弧边界的最短距离
                    u = unitW.multiplyScalar(combinedRadius / timeHorizon - wLength);
                } else {
                    // w几乎为零（相对速度≈voApex），随机选择推开方向
                    const randomAngle = Math.random() * 2 * Math.PI;
                    u = new Vec2(Math.cos(randomAngle), Math.sin(randomAngle)).multiplyScalar(combinedRadius / timeHorizon);
                }
            } else {
                // 相对速度在锥体内部或前方，需要投影到锥体的直线边界
                // 物理意义：当前轨迹会导致碰撞，需要偏转到安全方向
                
                // === 计算锥体的左右边界切线方向 ===
                // 使用旋转矩阵计算切线方向：将relativePosition旋转±半角
                const leftTangent = new Vec2(
                    relativePosition.x * cosHalfAngle - relativePosition.y * sinHalfAngle,
                    relativePosition.x * sinHalfAngle + relativePosition.y * cosHalfAngle
                ).normalize();
                
                const rightTangent = new Vec2(
                    relativePosition.x * cosHalfAngle + relativePosition.y * sinHalfAngle,
                    -relativePosition.x * sinHalfAngle + relativePosition.y * cosHalfAngle
                ).normalize();
                
                // === 计算投影目标点 ===
                // 在锥体边界上找到距离当前相对速度最近的点
                const leftTarget = voApex.clone().add(leftTangent.clone().multiplyScalar(combinedRadius / timeHorizon));
                const rightTarget = voApex.clone().add(rightTangent.clone().multiplyScalar(combinedRadius / timeHorizon));
                
                // 选择距离更近的边界作为投影目标
                const distToLeft = leftTarget.clone().subtract(relativeVelocity).lengthSqr();
                const distToRight = rightTarget.clone().subtract(relativeVelocity).lengthSqr();
                
                if (distToLeft < distToRight) {
                    u = leftTarget.subtract(relativeVelocity);
                } else {
                    u = rightTarget.subtract(relativeVelocity);
                }
            }
            
        } else {
            // === 情况2：代理发生碰撞（重叠），需要立即分离 ===
            // 物理意义：两个代理的避让半径重叠，必须立即推开以避免"卡住"
            console.log(`[ORCA 调试] ${agentA.node.name} 和 ${agentB.node.name} 进入重叠处理逻辑！距离: ${dist}, 组合半径: ${combinedRadius}`);
            
            const invTimeStep = 1.0 / this.UPDATE_INTERVAL;
            let separationVector: Vec2;
            if (relativePosition.length() > 0.001) {
                separationVector = relativePosition.clone().normalize().multiplyScalar(combinedRadius - dist);
            } else {
                // 完全重叠时，使用一个基于Agent ID的、固定的、非对称的推开方向
                // 这样A推B和B推A的方向不是完全相反的，有助于打破对称性
                const angleOffset = (agentA.node.uuid.charCodeAt(0) % 16) / 16.0 * Math.PI; // 简单的基于ID的偏移
                const pushDirection = new Vec2(Math.cos(angleOffset), Math.sin(angleOffset));
                separationVector = pushDirection.multiplyScalar(combinedRadius);
            }
            
            // 计算达到分离所需的相对速度：距离/时间
            const requiredRelativeVel = separationVector.multiplyScalar(invTimeStep);
            
            // u: 从当前相对速度到所需相对速度的修正向量
            u = requiredRelativeVel.subtract(relativeVelocity);
            console.log(`[ORCA 调试] 计算出的分离向量 u: (${u.x.toFixed(2)}, ${u.y.toFixed(2)})`);
        }

        // === 构建ORCA约束线 ===
        // ORCA线是速度空间中的一条直线，将"安全"和"危险"的速度区域分开
        // 代理的新速度必须位于这条线的"安全"一侧
        
        // point: ORCA线上的一个参考点
        // 物理意义：代理A的当前速度加上"互惠修正"后的点
        // 互惠性原理：两个代理各承担50%的避让责任，避免"谁让谁"的不确定性
        const point = velA.clone().add(u.clone().multiplyScalar(0.5 * reciprocityFactor));
        
        // direction: ORCA线的方向向量（法向量）
        // 物理意义：指向"安全区域"的方向，与修正向量u同向
        // 正确理解：u向量本身就指向安全方向，ORCA线的法向量就是u的方向
        let direction: Vec2;
        if (u.lengthSqr() > 0.0001) {
            // 正确的做法：direction就是u的方向，指向安全半平面
            direction = u.clone().normalize(); 
        } else {
            // 边界情况处理：修正向量很小时的备用方案
            if (relativePosition.lengthSqr() > 0.0001) {
                // 使用位置差的垂直方向
                direction = new Vec2(-relativePosition.y, relativePosition.x).normalize();
            } else {
                // 完全重叠且无相对速度：随机方向
                const randomAngle = Math.random() * 2 * Math.PI;
                direction = new Vec2(Math.cos(randomAngle), Math.sin(randomAngle));
            }
        }
        
        return { point, direction };
    }
    
    /**
     * 求解并应用速度 - 优化版本
     * 实现优先级约束处理和自适应迭代
     */
    private solveAndApplyVelocities(): void {
        let solvedCount = 0;
        
        for (const agent of this.agents) {
            if (!agent || !agent.isAgentValid()) continue;

            const orcaLines: OrcaLine[] = (agent as any)._orcaLines || [];
            
            if (orcaLines.length === 0) {
                // 没有约束，直接使用期望速度
                const maxSpeed = agent.getMaxSpeed();
                let newVelocity = agent.prefVelocity.clone();
                if (newVelocity.length() > maxSpeed) {
                    newVelocity.normalize().multiplyScalar(maxSpeed);
                }
                agent.newVelocity = newVelocity;
                agent.setVelocity(newVelocity);
                solvedCount++;
                continue;
            }

            // 按约束紧急程度排序（距离越近优先级越高）
            const sortedLines = this.sortLinesByPriority(agent, orcaLines);
            
            let newVelocity = agent.prefVelocity.clone();
            const maxSpeed = agent.getMaxSpeed();
            
            // 限制初始速度
            if (newVelocity.length() > maxSpeed) {
                newVelocity.normalize().multiplyScalar(maxSpeed);
            }
            
            // 自适应迭代求解
            const converged = this.adaptiveConstraintSolver(newVelocity, sortedLines, maxSpeed, agent);
            
            // 最终速度限制
            if (newVelocity.length() > maxSpeed) {
                newVelocity.normalize().multiplyScalar(maxSpeed);
            }
            
            // 应用速度
            agent.newVelocity = newVelocity;
            agent.setVelocity(newVelocity);
            solvedCount++;
            
            // 记录收敛状态（可用于调试）
            if (!converged) {
                // console.log(`代理 ${agent.node.name} 在最大迭代次数内未完全收敛`);
            }
        }
        
        this.performanceStats.velocitiesSolved = solvedCount;
    }

    /**
     * 按约束紧急程度对ORCA线排序
     * 距离越近的约束优先级越高
     */
    private sortLinesByPriority(agent: OrcaAgent, lines: OrcaLine[]): Array<{line: OrcaLine, urgency: number}> {
        const result: Array<{line: OrcaLine, urgency: number}> = [];
        const agentVel = agent.character?.getRigidBody()?.linearVelocity || new Vec2();
        
        for (const line of lines) {
            // 计算当前速度到约束线的距离（作为紧急程度指标）
            const relativePoint = this.tempVec2_1.set(
                agentVel.x - line.point.x,
                agentVel.y - line.point.y
            );
            const violation = relativePoint.dot(line.direction);
            
            // violation < 0 表示违反约束，值越小越紧急
            const urgency = violation < 0 ? -violation : 0;
            result.push({ line, urgency });
        }
        
        // 按紧急程度降序排列
        result.sort((a, b) => b.urgency - a.urgency);
        return result;
    }

    /**
     * 自适应约束求解器
     * 优先处理紧急约束，动态调整迭代次数，使用代理个性化配置
     */
    private adaptiveConstraintSolver(velocity: Vec2, sortedLines: Array<{line: OrcaLine, urgency: number}>, maxSpeed: number, agent?: OrcaAgent): boolean {
        // 获取代理的个性化配置
        const config = agent?.getSolverConfig() || {
            convergenceTolerance: 0.001,
            responsiveness: 1.0,
            aggressiveness: 0.5,
            maxIterations: 20
        };
        
        const maxIterations = Math.min(config.maxIterations, sortedLines.length * 3);
        const convergenceThreshold = config.convergenceTolerance;
        const responsiveness = config.responsiveness;
        const aggressiveness = config.aggressiveness;
        
        for (let iteration = 0; iteration < maxIterations; iteration++) {
            let maxViolation = 0;
            let anyViolation = false;
            
            // 处理所有约束，记录最大违反程度
            for (const {line, urgency} of sortedLines) {
                const relativePoint = this.tempVec2_1.set(
                    velocity.x - line.point.x,
                    velocity.y - line.point.y
                );
                const violation = relativePoint.dot(line.direction);
                
                if (violation < -convergenceThreshold) {
                    // 违反约束，进行投影
                    let projectionStrength = 1.0;
                    
                    // 根据激进程度调整投影强度
                    projectionStrength *= (1.0 + (1.0 - aggressiveness) * 0.5);
                    
                    // 根据响应敏感度调整
                    projectionStrength *= responsiveness;
                    
                    const projection = line.direction.clone().multiplyScalar(violation * projectionStrength);
                    velocity.subtract(projection);
                    
                    anyViolation = true;
                    maxViolation = Math.max(maxViolation, -violation);
                    
                    // 重新限制速度（避免投影后超速）
                    if (velocity.length() > maxSpeed) {
                        velocity.normalize().multiplyScalar(maxSpeed);
                    }
                    
                    // 紧急约束的额外处理
                    if (urgency > 0.5 && violation < -0.01) {
                        const urgencyBoost = Math.min(2.0, urgency);
                        const secondProjection = line.direction.clone().multiplyScalar(violation * 0.1 * urgencyBoost);
                        velocity.subtract(secondProjection);
                    }
                }
            }
            
            // 检查收敛条件
            if (!anyViolation || maxViolation < convergenceThreshold) {
                return true; // 收敛成功
            }
            
            // 激进的代理可以更早终止
            const earlyTerminationThreshold = aggressiveness > 0.7 ? 0.005 : 0.002;
            if (iteration > 3 && maxViolation < earlyTerminationThreshold) {
                return true; // 足够好的解
            }
        }
        
        return false; // 未在最大迭代次数内收敛
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