import { _decorator, Component, Vec2, Node } from 'cc';
import { OrcaAgent } from '../components/OrcaAgent';
import { gridManager } from './GridManager'; // 直接复用！
import { poolManager } from '../managers/PoolManager';
import { TempVarPool } from '../utils/TempVarPool';

// 代表ORCA计算出的一条速度约束线
interface OrcaLine {
    point: Vec2;
    direction: Vec2;
}

const { ccclass } = _decorator;

/**
 * ORCA系统管理器
 * 实现Optimal Reciprocal Collision Avoidance算法
 * 
 * 核心概念解释：
 * 1. 速度障碍(VO): 在速度空间中，会导致碰撞的所有相对速度形成的锥形区域
 * 2. 截断速度障碍: 由于我们只关心有限时间内的碰撞，VO锥体被截断成有限区域
 * 3. ORCA线: 将VO区域一分为二的直线，代理的新速度应该在"安全"一侧
 * 4. 互惠性: 两个代理各自承担50%的避让责任，避免"互相礼让"的僵局
 * 
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
    // 【抖动优化】调整更新频率平衡性能与平滑度，15FPS提供更好的避让响应
    private readonly UPDATE_INTERVAL = 0.067; // 约15FPS，平衡性能和避让平滑度
    private lastUpdateTime = 0;

    // 【性能优化】使用 poolManager 管理临时变量，避免频繁创建对象
    
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
        const timeHorizon = agentA.getEffectiveTimeHorizon(); // 使用有效时间域

        // 【新功能】根据主动/被动状态调整互惠性
        let reciprocityFactor = Math.min(1.0, agentA.responsiveness);
        
        // 【专注锁定和攻击状态处理】检查各种锁定状态，调整避让责任
        const agentAAttacking = agentA.isAttacking && agentA.isAttacking();
        const agentBAttacking = agentB.isAttacking && agentB.isAttacking();
        const agentAFocusLock = agentA.getFocusLockPriority && agentA.getFocusLockPriority() >= 1;
        const agentBFocusLock = agentB.getFocusLockPriority && agentB.getFocusLockPriority() >= 1;
        
        // 【调试】只在有特殊状态时输出日志
        if (agentAAttacking || agentBAttacking || agentAFocusLock || agentBFocusLock) {
            console.log(`[ORCA_DEBUG] 🎯 状态检查: ${agentA.node.name}[攻击=${agentAAttacking}, 专注=${agentAFocusLock}], ${agentB.node.name}[攻击=${agentBAttacking}, 专注=${agentBFocusLock}]`);
        }
        
        // 【优先级1：专注锁定状态】专注锁定优先级最高
        if (agentAFocusLock && !agentBFocusLock) {
            // A在专注锁定，B不在：A几乎完全坚持位置
            const resistance = agentA.getEffectiveResistance();
            reciprocityFactor *= (1.0 - resistance); // 减少A的避让责任
            console.log(`[ORCA] 🔒 ${agentA.node.name} 专注锁定中，抗推力=${resistance.toFixed(2)}, 避让责任减少到${reciprocityFactor.toFixed(2)}`);
        } else if (!agentAFocusLock && agentBFocusLock) {
            // A不在专注锁定，B在：A主动避让B
            reciprocityFactor = Math.min(1.0, reciprocityFactor * 2.0); // 大幅增加A的避让责任
            console.log(`[ORCA] 🔒 ${agentB.node.name} 专注锁定中，${agentA.node.name} 主动避让`);
        } else if (agentAFocusLock && agentBFocusLock) {
            // 两个都在专注锁定：各自坚持位置，但适度调整
            const resistanceA = agentA.getEffectiveResistance();
            reciprocityFactor *= (1.0 - resistanceA * 0.7); // 较强的抗推力
            console.log(`[ORCA] 🔒 双方都在专注锁定，适度调整避让`);
        }
        // 【优先级2：攻击状态】如果没有专注锁定，才考虑攻击状态
        else if (agentAAttacking && !agentBAttacking) {
            // A在攻击，B不在攻击：A坚持位置，B负责避让
            const resistance = agentA.getEffectiveResistance();
            reciprocityFactor *= (1.0 - resistance); // 减少A的避让责任
            console.log(`[ORCA] ⚔️ ${agentA.node.name} 攻击中，抗推力=${resistance.toFixed(2)}, 避让责任减少到${reciprocityFactor.toFixed(2)}`);
        } else if (!agentAAttacking && agentBAttacking) {
            // A不在攻击，B在攻击：A主动避让B
            reciprocityFactor = Math.min(1.0, reciprocityFactor * 1.5); // 增加A的避让责任
        } else if (agentAAttacking && agentBAttacking) {
            // 两个都在攻击：保持原有逻辑，但各自应用抗推力
            const resistanceA = agentA.getEffectiveResistance();
            reciprocityFactor *= (1.0 - resistanceA * 0.5); // 部分抗推力
        }
        
        // 如果当前代理A是主动的，代理B是被动的，则A承担全部避让责任
        if (!agentA.isPassive && agentB.isPassive) {
            reciprocityFactor = Math.max(reciprocityFactor, 1.0); // A承担避让责任，但不低于当前值
        }
        // 如果当前代理A是被动的，代理B是主动的，则A不承担避让责任
        else if (agentA.isPassive && !agentB.isPassive) {
            reciprocityFactor = 0.0; // A不承担避让责任，让B来处理
        }
        // 其他情况（两个都是主动或两个都是被动）使用调整后的逻辑

        // 【性能优化】使用对象池管理临时Vec2对象
        const relativePosition = poolManager.getVec2(posB.x, posB.y).subtract(posA);
        const relativeVelocity = poolManager.getVec2(velA.x, velA.y).subtract(velB);
        
        const dist = relativePosition.length();
        const combinedRadius = radiusA + radiusB;
        
        // 【抖动优化】减少调试输出频率，避免日志干扰性能测量
        if (dist > 50 && dist < 100 && Math.random() < 0.05) { // 5%概率输出
            console.log(`🔍 ORCA计算: ${agentA.node.name} vs ${agentB.node.name}, 距离=${dist.toFixed(1)}, 时间域=${timeHorizon.toFixed(1)}, 邻居距离=${agentA.getEffectiveNeighborDist().toFixed(1)}`);
        }

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
                    // 【性能优化】使用临时变量池避免GC压力
                    u = TempVarPool.tempVec2_1.set(Math.cos(randomAngle), Math.sin(randomAngle)).multiplyScalar(combinedRadius / timeHorizon);
                }
            } else {
                // 相对速度在锥体内部或前方，需要投影到锥体的直线边界
                // 物理意义：当前轨迹会导致碰撞，需要偏转到安全方向
                
                // === 计算锥体的左右边界切线方向 ===
                // 使用旋转矩阵计算切线方向：将relativePosition旋转±半角
                // 【性能优化】使用临时变量池避免GC压力
                const leftTangent = TempVarPool.tempVec2_2.set(
                    relativePosition.x * cosHalfAngle - relativePosition.y * sinHalfAngle,
                    relativePosition.x * sinHalfAngle + relativePosition.y * cosHalfAngle
                ).normalize();
                
                const rightTangent = TempVarPool.tempVec2_3.set(
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
            
            const invTimeStep = 1.0 / this.UPDATE_INTERVAL;
            
            // 计算最小分离距离和方向
            // separationVector: 指向从当前重叠状态到刚好不重叠状态的向量
            const separationVector = relativePosition.length() > 0.001 ? 
                relativePosition.clone().normalize().multiplyScalar(combinedRadius - dist) :
                // 完全重叠时，随机选择分离方向
                // 【性能优化】使用临时变量池避免GC压力
                TempVarPool.tempVec2_4.set(Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(combinedRadius);
            
            // 【专注锁定和攻击状态优化】计算达到分离所需的相对速度，考虑各种锁定状态的抗推力
            let separationStrength = invTimeStep;
            if (agentAFocusLock) {
                const resistance = agentA.getEffectiveResistance();
                separationStrength *= (1.0 - resistance * 0.8); // 专注锁定中的角色分离力度大幅降低
                console.log(`[ORCA] 🔒 ${agentA.node.name} 专注锁定重叠分离，强度降低到${(separationStrength/invTimeStep).toFixed(2)}`);
            } else if (agentAAttacking) {
                const resistance = agentA.getEffectiveResistance();
                separationStrength *= (1.0 - resistance * 0.7); // 攻击中的角色分离力度降低
                console.log(`[ORCA] ⚔️ ${agentA.node.name} 攻击中重叠分离，强度降低到${(separationStrength/invTimeStep).toFixed(2)}`);
            }
            
            const requiredRelativeVel = separationVector.multiplyScalar(separationStrength);
            
            // u: 从当前相对速度到所需相对速度的修正向量
            u = requiredRelativeVel.subtract(relativeVelocity);
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
                // 【性能优化】使用临时变量池避免GC压力
                direction = TempVarPool.tempVec2_5.set(-relativePosition.y, relativePosition.x).normalize();
            } else {
                // 完全重叠且无相对速度：随机方向
                const randomAngle = Math.random() * 2 * Math.PI;
                // 【性能优化】使用临时变量池避免GC压力
                direction = TempVarPool.tempVec2_6.set(Math.cos(randomAngle), Math.sin(randomAngle));
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

            // 【专注锁定特殊处理】专注锁定状态下的强制坚持逻辑
            const focusLockPriority = agent.getFocusLockPriority && agent.getFocusLockPriority();
            if (focusLockPriority && focusLockPriority >= 1) {
                // 专注锁定中：如果期望速度很小（想要保持位置），就强制保持不动
                if (agent.prefVelocity.lengthSqr() < 0.5) { // 期望速度很小，想要保持位置
                    const newVelocity = new Vec2(0, 0); // 强制保持静止
                    agent.newVelocity = newVelocity;
                    agent.setVelocity(newVelocity);
                    solvedCount++;
                    console.log(`[ORCA] 🔒 ${agent.node.name} 专注锁定中且期望静止，强制保持不动`);
                    continue;
                } else {
                    // 专注锁定但有移动意图：大幅降低约束影响
                    console.log(`[ORCA] 🔒 ${agent.node.name} 专注锁定中但有移动意图，降低约束影响`);
                }
            }

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
        // 【性能优化】使用临时变量池避免GC压力
        const agentVel = agent.character?.getRigidBody()?.linearVelocity || TempVarPool.tempVec2_7.set(0, 0);
        
        for (const line of lines) {
            // 计算当前速度到约束线的距离（作为紧急程度指标）
            const relativePoint = TempVarPool.tempVec2_1.set(
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
                const relativePoint = TempVarPool.tempVec2_2.set(
                    velocity.x - line.point.x,
                    velocity.y - line.point.y
                );
                const violation = relativePoint.dot(line.direction);
                
                if (violation < -convergenceThreshold) {
                    // 违反约束，进行投影
                    let projectionStrength = 1.0;
                    
                    // 【专注锁定特殊处理】大幅降低投影强度
                    const focusLockPriority = agent?.getFocusLockPriority && agent.getFocusLockPriority();
                    if (focusLockPriority && focusLockPriority >= 1) {
                        projectionStrength *= 0.01; // 专注锁定时投影强度降低99%
                        console.log(`[ORCA] 🔒 ${agent?.node.name} 专注锁定中，约束投影强度降低到${projectionStrength.toFixed(3)}`);
                    }
                    
                    // 根据激进程度调整投影强度
                    projectionStrength *= (1.0 + (1.0 - aggressiveness) * 0.5);
                    
                    // 根据响应敏感度调整
                    projectionStrength *= responsiveness;
                    
                    // 【修复Bug】violation是负数，需要取负号才能正确推开
                    const projection = line.direction.clone().multiplyScalar(-violation * projectionStrength);
                    velocity.subtract(projection);
                    
                    anyViolation = true;
                    maxViolation = Math.max(maxViolation, -violation);
                    
                    // 重新限制速度（避免投影后超速）
                    if (velocity.length() > maxSpeed) {
                        velocity.normalize().multiplyScalar(maxSpeed);
                    }
                    
                    // 紧急约束的额外处理
                    if (urgency > 0.5 && violation < -0.01) {
                        let urgencyBoost = Math.min(2.0, urgency);
                        
                        // 【专注锁定特殊处理】紧急约束也要考虑专注锁定
                        if (focusLockPriority && focusLockPriority >= 1) {
                            urgencyBoost *= 0.01; // 专注锁定时紧急约束也大幅降低
                        }
                        
                        // 【修复Bug】同样需要取负号才能正确推开
                        const secondProjection = line.direction.clone().multiplyScalar(-violation * 0.1 * urgencyBoost);
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
     * 【抖动优化】批量应用抖动优化预设到所有代理
     * @param presetName 预设名称
     * @param filterFaction 可选，只对特定阵营应用
     */
    public applyAntiJitterPresetToAll(presetName: string, filterFaction?: string): void {
        let appliedCount = 0;
        
        for (const agent of this.agents) {
            if (!agent || !agent.isAgentValid()) continue;
            
            // 阵营过滤
            if (filterFaction) {
                const agentFaction = agent.getFaction();
                if (agentFaction !== filterFaction) continue;
            }
            
            agent.applyAntiJitterPreset(presetName);
            appliedCount++;
        }
        
        console.log(`[OrcaSystem] 🔧 已对 ${appliedCount} 个代理应用抖动优化预设: ${presetName}`);
    }

    /**
     * 【抖动优化】分析系统整体抖动风险
     */
    public analyzeSystemJitterRisk(): void {
        if (this.agents.length === 0) {
            console.log('[OrcaSystem] 📊 无活跃代理，无法分析抖动风险');
            return;
        }
        
        let totalRisk = 0;
        let highRiskCount = 0;
        let mediumRiskCount = 0;
        let lowRiskCount = 0;
        
        const agentRisks: Array<{name: string, risk: number}> = [];
        
        for (const agent of this.agents) {
            if (!agent || !agent.isAgentValid()) continue;
            
            const risk = agent.getJitterRiskAssessment();
            totalRisk += risk;
            agentRisks.push({name: agent.node.name, risk});
            
            if (risk > 0.6) highRiskCount++;
            else if (risk > 0.3) mediumRiskCount++;
            else lowRiskCount++;
        }
        
        const averageRisk = totalRisk / this.agents.length;
        
        console.log('\n=== ORCA抖动风险分析 ===');
        console.log(`整体平均风险: ${(averageRisk * 100).toFixed(1)}%`);
        console.log(`高风险代理 (>60%): ${highRiskCount}`);
        console.log(`中风险代理 (30-60%): ${mediumRiskCount}`);
        console.log(`低风险代理 (<30%): ${lowRiskCount}`);
        
        // 显示最高风险的前5个代理
        agentRisks.sort((a, b) => b.risk - a.risk);
        console.log('\n最高风险代理:');
        for (let i = 0; i < Math.min(5, agentRisks.length); i++) {
            const agent = agentRisks[i];
            console.log(`  ${agent.name}: ${(agent.risk * 100).toFixed(1)}%`);
        }
        
        // 给出优化建议
        if (averageRisk > 0.5) {
            console.log('\n🔧 建议: 系统整体抖动风险较高，推荐应用 "smooth" 预设');
        } else if (averageRisk > 0.3) {
            console.log('\n🔧 建议: 系统有一定抖动风险，推荐应用 "stable" 预设');
        } else {
            console.log('\n✅ 系统抖动风险在可接受范围内');
        }
        console.log('========================\n');
    }

    /**
     * 【抖动优化】实时参数监控和自适应调整
     */
    public enableAdaptiveAntiJitter(enable: boolean = true): void {
        // 这里可以实现自适应逻辑，根据实时性能数据自动调整参数
        if (enable) {
            console.log('[OrcaSystem] 🔧 启用自适应抖动优化 (未来功能)');
            // TODO: 实现自适应逻辑
        } else {
            console.log('[OrcaSystem] 🔧 禁用自适应抖动优化');
        }
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