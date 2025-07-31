import { _decorator, Component, Vec2, Node, Enum } from 'cc';
import { ICrowdableCharacter } from '../systems/GridManager'; // 复用GridManager中的接口

const { ccclass, property } = _decorator;

/**
 * ORCA代理组件
 * 挂载在每个需要进行ORCA避让的角色上，负责存储该角色的ORCA相关参数和状态
 */
@ccclass('OrcaAgent')
export class OrcaAgent extends Component {
    // --- 内部状态 ---
    // 由AI或移动控制逻辑设置
    public prefVelocity: Vec2 = new Vec2(); // 期望速度 (AI希望角色移动的方向和速率)
    public newVelocity: Vec2 = new Vec2();  // 由ORCA系统计算出的新速度

    // --- ORCA 参数 ---
    @property({
        displayName: "避让半径",
        tooltip: "角色的避让半径，决定了与其他角色保持的最小距离"
    })
    public radius: number = 25; // 避让半径，默认与碰撞体半径一致
    
    @property({
        displayName: "邻居搜索距离", 
        tooltip: "搜寻邻居的距离，建议设为 2 * timeHorizon * maxSpeed，自动调整时会动态计算"
    })
    public neighborDist: number = 35; // 【抖动优化】增加搜索距离，配合更长的时间域
    
    @property({
        displayName: "时间域",
        tooltip: "预测碰撞的时间（秒），2.0-5.0秒可有效减少抖动，避免短视行为"
    })
    public timeHorizon: number = 0.6; // 【抖动优化】增加到3秒，提供更平滑的避让行为
    
    @property({
        displayName: "障碍物时间域",
        tooltip: "对静态障碍物的预测时间（秒）"
    })
    public timeHorizonObst: number = 1.0; // 对静态障碍物的预测时间

    @property({
        displayName: "最大速度",
        tooltip: "角色的最大移动速度，0表示从角色组件自动获取"
    })
    public maxSpeed: number = 0; // 最大速度，0表示从角色组件获取

    @property({
        displayName: "代理类型",
        tooltip: "代理的行为类型，影响避让参数的自动调整",
        type: Enum({
            NORMAL: 0,      // 普通单位
            AGGRESSIVE: 1,  // 激进单位（较少避让）
            CAUTIOUS: 2,    // 谨慎单位（更多避让）
            LARGE: 3,       // 大型单位（需要更大避让空间）
            FAST: 4         // 快速单位（需要更远预测距离）
        })
    })
    public agentType: number = 0; // 代理类型

    @property({
        displayName: "避让激进程度",
        tooltip: "0-1之间的值，越大越激进（较少避让），越小越保守（更多避让）",
        range: [0, 1, 0.1]
    })
    public aggressiveness: number = 0.1; // 避让的激进程度

    @property({
        displayName: "自动调整参数",
        tooltip: "是否根据代理类型和速度自动调整timeHorizon和neighborDist"
    })
    public autoAdjustParams: boolean = false; // 是否自动调整参数

    @property({
        displayName: "收敛容忍度",
        tooltip: "求解器的收敛容忍度，越小越精确但计算量越大",
        range: [0.0001, 0.01, 0.0001]
    })
    public convergenceTolerance: number = 0.01; // 求解器收敛容忍度

    @property({
        displayName: "响应敏感度",
        tooltip: "对邻居变化的响应敏感度，影响避让的及时性",
        range: [0.1, 2.0, 0.1]
    })
    public responsiveness: number = 1.0; // 响应敏感度

    @property({
        displayName: "被动单位",
        tooltip: "被动单位在被主动单位撞击时不会移动，只有主动单位负责避让"
    })
    public isPassive: boolean = false; // 是否为被动单位

    @property({
        displayName: "攻击状态抗推力",
        tooltip: "攻击状态中的抗推开能力，0-1之间，越大越难被推开",
        range: [0, 1, 0.1]
    })
    public attackResistance: number = 1; // 攻击状态的抗推开能力

    @property({
        displayName: "专注锁定强度",
        tooltip: "专注锁定时的抗推能力，0-1之间，越大越难被推开",
        range: [0, 1, 0.01]
    })
    public focusLockResistance: number = 0.99; // 专注锁定的抗推开能力

    // 攻击状态标志 - 内部使用，不暴露到编辑器
    private _isAttacking: boolean = false;

    // 专注锁定系统 - 内部使用
    private _lockPriority: number = 0; // 0=正常, 1=专注锁定, 2=强制锁定(未来扩展)
    private _lockTargets: Set<Node> = new Set(); // 锁定的目标列表

    // --- 引用 ---
    private _character: ICrowdableCharacter | null = null;
    
    /**
     * 获取关联的角色组件
     */
    public get character(): ICrowdableCharacter | null {
        if (!this._character) {
            // 尝试在同一节点上找到实现ICrowdableCharacter接口的组件
            const components = this.node.getComponents(Component);
            for (const comp of components) {
                if ((comp as any) !== this && this.isICrowdableCharacter(comp)) {
                    this._character = comp as unknown as ICrowdableCharacter;
                    break;
                }
            }
        }
        return this._character;
    }

    /**
     * 检查组件是否实现了ICrowdableCharacter接口
     */
    private isICrowdableCharacter(comp: any): boolean {
        return comp && 
               typeof comp.getFaction === 'function' && 
               typeof comp.getRigidBody === 'function' && 
               typeof comp.getMoveSpeed === 'function' && 
               typeof comp.isAlive === 'function';
    }

    /**
     * 获取角色的2D位置
     */
    public get position(): Vec2 {
        const pos3D = this.node.position;
        return new Vec2(pos3D.x, pos3D.y);
    }
    
    /**
     * 获取角色的当前速度
     */
    public get velocity(): Vec2 {
        const char = this.character;
        if (char) {
            const rb = char.getRigidBody();
            if (rb && rb.linearVelocity) {
                return new Vec2(rb.linearVelocity.x, rb.linearVelocity.y);
            }
        }
        return new Vec2(0, 0);
    }

    /**
     * 获取角色的最大速度
     */
    public getMaxSpeed(): number {
        
        if (this.maxSpeed > 0) {
            return this.maxSpeed;
        }
        
        const char = this.character;
        if (char) {
            const speed = char.getMoveSpeed();
            return speed;
        }
        
        return 5; // 默认速度
    }

    /**
     * 检查角色是否有效且存活
     */
    public isAgentValid(): boolean {
        if (!this.node || !this.node.isValid) {
            console.warn(`[ORCA_DEBUG] ❌ ${this.node?.name || 'Unknown'} 节点无效`);
            return false;
        }
        
        const char = this.character;
        if (!char) {
            console.warn(`[ORCA_DEBUG] ❌ ${this.node.name} 角色组件不存在`);
            return false;
        }
        
        const isAlive = char.isAlive();
        if (!isAlive) {
            console.warn(`[ORCA_DEBUG] ❌ ${this.node.name} 角色已死亡`);
        }
        
        return isAlive;
    }

    /**
     * 获取角色的阵营
     */
    public getFaction() {
        const char = this.character;
        return char ? char.getFaction() : null;
    }

    /**
     * 设置角色的速度（通过刚体）
     */
    public setVelocity(velocity: Vec2): void {
        const char = this.character;
        if (char) {
            const rb = char.getRigidBody();
            if (rb) {
                rb.linearVelocity = velocity;
            }
        }
    }

    protected onLoad() {
        console.log(`[OrcaAgent] ORCA代理组件已初始化: ${this.node.name}`);
        const randomFactor = (this.node.uuid.charCodeAt(1) % 11) / 10.0; // 0.0 to 1.0
        this.responsiveness = 0.4 + randomFactor * 0.2;
    }

    protected onDestroy() {
        this._character = null;
    }

    /**
     * 获取有效的时间域，考虑自动调整和代理类型
     * 【抖动优化】确保时间域在合理范围内，避免过短导致的抖动
     */
    public getEffectiveTimeHorizon(): number {
        if (!this.autoAdjustParams) {
            return Math.max(1.0, this.timeHorizon); // 【抖动优化】确保最小时间域为2秒
        }

        let adjustedTime = this.timeHorizon;
        const currentSpeed = this.getMaxSpeed();

        // 【抖动优化】根据速度动态调整时间域，高速单位需要更长预测时间
        if (currentSpeed > 80) {
            adjustedTime = Math.max(adjustedTime, 4.0); // 高速单位最少4秒预测
        } else if (currentSpeed > 50) {
            adjustedTime = Math.max(adjustedTime, 3.5); // 中速单位最少3.5秒预测
        } else {
            adjustedTime = Math.max(adjustedTime, 2.5); // 低速单位最少2.5秒预测
        }

        // 根据代理类型调整
        switch (this.agentType) {
            case 1: // AGGRESSIVE
                adjustedTime *= 0.8; // 激进单位预测时间稍短，但不低于最小值
                break;
            case 2: // CAUTIOUS  
                adjustedTime *= 1.4; // 谨慎单位预测时间更长
                break;
            case 3: // LARGE
                adjustedTime *= 1.3; // 大型单位需要更多预测时间
                break;
            case 4: // FAST
                adjustedTime *= Math.max(1.6, currentSpeed / 60); // 快速单位根据速度大幅调整
                break;
        }

        // 根据激进程度微调，但保持在合理范围
        const aggFactor = 1.0 - (this.aggressiveness - 0.5) * 0.3; // 【抖动优化】减少激进程度的影响
        adjustedTime *= aggFactor;

        // 【抖动优化】限制在合理范围内，确保不会太短
        return Math.max(2.0, Math.min(8.0, adjustedTime));
    }

    /**
     * 获取有效的邻居搜索距离，考虑自动调整
     * 【抖动优化】使用标准公式：neighborDist ≈ 2 * timeHorizon * maxSpeed
     */
    public getEffectiveNeighborDist(): number {
        const effectiveTimeHorizon = this.getEffectiveTimeHorizon();
        const currentSpeed = this.getMaxSpeed();
        
        // 【抖动优化】使用推荐公式：略大于 2 * timeHorizon * maxSpeed
        const formulaBasedDist = 2.2 * effectiveTimeHorizon * currentSpeed;
        
        // 添加基础安全余量
        const safetyMargin = this.getEffectiveRadius() * 3; // 半径的3倍作为安全余量
        let adjustedDist = formulaBasedDist + safetyMargin;

        // 根据代理类型调整
        switch (this.agentType) {
            case 1: // AGGRESSIVE
                adjustedDist *= 0.9; // 激进单位搜索范围稍小
                break;
            case 2: // CAUTIOUS
                adjustedDist *= 1.3; // 谨慎单位搜索范围更大
                break;
            case 3: // LARGE
                adjustedDist *= 1.4; // 大型单位需要更大搜索范围
                break;
            case 4: // FAST
                adjustedDist *= 1.3; // 快速单位需要更远搜索
                break;
        }

        // 【抖动优化】确保搜索距离有合理的最小值和最大值
        const minDist = Math.max(this.neighborDist, this.getEffectiveRadius() * 4);
        const maxDist = Math.min(300, currentSpeed * 8); // 限制最大搜索距离避免性能问题
        
        return Math.max(minDist, Math.min(maxDist, adjustedDist));
    }

    /**
     * 获取有效的避让半径，考虑代理类型
     */
    public getEffectiveRadius(): number {
        let adjustedRadius = this.radius;

        // 根据代理类型调整
        switch (this.agentType) {
            case 3: // LARGE
                adjustedRadius *= 1.2; // 大型单位半径更大
                break;
            case 4: // FAST
                adjustedRadius *= 1.1; // 快速单位需要略大的安全距离
                break;
        }

        return adjustedRadius;
    }

    /**
     * 获取解算器配置
     */
    public getSolverConfig() {
        return {
            convergenceTolerance: this.convergenceTolerance,
            responsiveness: this.responsiveness,
            aggressiveness: this.aggressiveness,
            maxIterations: this.agentType === 2 ? 25 : 20 // 谨慎单位允许更多迭代
        };
    }

    /**
     * 应用代理类型预设
     */
    public applyAgentTypePreset(type: number): void {
        this.agentType = type;
        
        switch (type) {
            case 1: // AGGRESSIVE
                this.aggressiveness = 0.8;
                this.convergenceTolerance = 0.005; // 较低精度换取性能
                this.responsiveness = 1.3;
                break;
            case 2: // CAUTIOUS
                this.aggressiveness = 0.2;
                this.convergenceTolerance = 0.0005; // 高精度
                this.responsiveness = 0.8;
                break;
            case 3: // LARGE
                this.aggressiveness = 0.4;
                // 【修复】移除重复调整，半径调整在getEffectiveRadius中统一处理
                this.convergenceTolerance = 0.001;
                break;
            case 4: // FAST
                this.aggressiveness = 0.6;
                this.responsiveness = 1.5;
                this.convergenceTolerance = 0.002;
                break;
            default: // NORMAL
                this.aggressiveness = 0.5;
                this.convergenceTolerance = 0.001;
                this.responsiveness = 1.0;
                break;
        }
    }

    /**
     * 【抖动优化】应用抖动优化预设配置
     * @param presetName 预设名称：'smooth', 'performance', 'aggressive', 'stable'
     */
    public applyAntiJitterPreset(presetName: string): void {
        console.log(`[OrcaAgent] 🔧 ${this.node.name} 应用抖动优化预设: ${presetName}`);
        
        switch (presetName.toLowerCase()) {
            case 'smooth': // 平滑优先，最少抖动
                this.timeHorizon = 4.0;
                this.neighborDist = 120;
                this.aggressiveness = 0.2;
                this.responsiveness = 0.8;
                this.convergenceTolerance = 0.0005;
                this.autoAdjustParams = true;
                console.log(`[OrcaAgent] 🔧 ${this.node.name} 已设置为平滑优先模式`);
                break;
                
            case 'performance': // 性能优先，适度抖动
                this.timeHorizon = 2.5;
                this.neighborDist = 70;
                this.aggressiveness = 0.6;
                this.responsiveness = 1.2;
                this.convergenceTolerance = 0.002;
                this.autoAdjustParams = true;
                console.log(`[OrcaAgent] 🔧 ${this.node.name} 已设置为性能优先模式`);
                break;
                
            case 'aggressive': // 激进模式，快速响应
                this.timeHorizon = 2.0;
                this.neighborDist = 60;
                this.aggressiveness = 0.8;
                this.responsiveness = 1.5;
                this.convergenceTolerance = 0.005;
                this.autoAdjustParams = false;
                console.log(`[OrcaAgent] 🔧 ${this.node.name} 已设置为激进模式`);
                break;
                
            case 'stable': // 稳定模式，平衡各方面
                this.timeHorizon = 3.0;
                this.neighborDist = 80;
                this.aggressiveness = 0.4;
                this.responsiveness = 1.0;
                this.convergenceTolerance = 0.001;
                this.autoAdjustParams = true;
                console.log(`[OrcaAgent] 🔧 ${this.node.name} 已设置为稳定模式`);
                break;
                
            default:
                console.warn(`[OrcaAgent] ⚠️ ${this.node.name} 未知的抖动优化预设: ${presetName}`);
                break;
        }
    }

    /**
     * 【抖动优化】获取当前抖动风险评估
     * @returns 返回0-1之间的值，0表示无抖动风险，1表示高抖动风险
     */
    public getJitterRiskAssessment(): number {
        const effectiveTimeHorizon = this.getEffectiveTimeHorizon();
        const effectiveNeighborDist = this.getEffectiveNeighborDist();
        const currentSpeed = this.getMaxSpeed();
        
        let riskScore = 0;
        
        // 时间域过短的风险
        if (effectiveTimeHorizon < 2.0) {
            riskScore += (2.0 - effectiveTimeHorizon) * 0.4; // 最多贡献0.4
        }
        
        // 邻居搜索距离与推荐值的偏差
        const recommendedNeighborDist = 2.2 * effectiveTimeHorizon * currentSpeed;
        const distanceRatio = effectiveNeighborDist / Math.max(recommendedNeighborDist, 1);
        if (distanceRatio < 0.8 || distanceRatio > 2.0) {
            riskScore += 0.3; // 距离设置不当
        }
        
        // 激进程度过高的风险
        if (this.aggressiveness > 0.7) {
            riskScore += (this.aggressiveness - 0.7) * 0.3; // 最多贡献0.09
        }
        
        // 响应敏感度过高的风险
        if (this.responsiveness > 1.3) {
            riskScore += (this.responsiveness - 1.3) * 0.2; // 过度敏感
        }
        
        return Math.min(1.0, riskScore);
    }

    /**
     * 设置攻击状态 - 影响ORCA避让行为
     */
    public setAttackingState(isAttacking: boolean): void {
        if (this._isAttacking !== isAttacking) {
            this._isAttacking = isAttacking;
            console.log(`[OrcaAgent] 🎯 ${this.node.name} 攻击状态变更: ${isAttacking ? '进入攻击' : '退出攻击'} (抗推力=${this.attackResistance})`);
        }
    }

    /**
     * 获取当前是否在攻击状态
     */
    public isAttacking(): boolean {
        return this._isAttacking;
    }

    /**
     * 获取有效的抗推能力（攻击状态中增强）
     */
    public getEffectiveResistance(): number {
        // 专注锁定优先级最高
        if (this._lockPriority >= 1) {
            return this.focusLockResistance;
        }
        // 其次是攻击状态
        if (this._isAttacking) {
            return this.attackResistance;
        }
        // 正常状态无抗推力
        return 0.0;
    }

    /**
     * 设置专注锁定等级
     * @param priority 锁定等级：0=正常，1=专注锁定，2=强制锁定
     */
    public setFocusLockPriority(priority: number): void {
        if (this._lockPriority !== priority) {
            this._lockPriority = Math.max(0, Math.min(2, priority));
            console.log(`[OrcaAgent] 🎯 ${this.node.name} 专注锁定等级变更: ${priority} (抗推力=${this.getEffectiveResistance().toFixed(2)})`);
        }
    }

    /**
     * 添加锁定目标
     * @param target 要锁定的目标节点
     */
    public addLockTarget(target: Node): void {
        if (target && target.isValid) {
            this._lockTargets.add(target);
            console.log(`[OrcaAgent] 🔒 ${this.node.name} 添加锁定目标: ${target.name} (总数: ${this._lockTargets.size})`);
            
            // 有锁定目标时自动设置专注锁定
            if (this._lockTargets.size > 0 && this._lockPriority === 0) {
                this.setFocusLockPriority(1);
            }
        }
    }

    /**
     * 移除锁定目标
     * @param target 要移除的目标节点
     */
    public removeLockTarget(target: Node): void {
        if (this._lockTargets.has(target)) {
            this._lockTargets.delete(target);
            console.log(`[OrcaAgent] 🔓 ${this.node.name} 移除锁定目标: ${target.name} (剩余: ${this._lockTargets.size})`);
            
            // 没有锁定目标时自动解除专注锁定
            if (this._lockTargets.size === 0 && this._lockPriority >= 1) {
                this.setFocusLockPriority(0);
            }
        }
    }

    /**
     * 清除所有锁定目标
     */
    public clearAllLockTargets(): void {
        const count = this._lockTargets.size;
        this._lockTargets.clear();
        this.setFocusLockPriority(0);
        if (count > 0) {
            console.log(`[OrcaAgent] 🔓 ${this.node.name} 清除所有锁定目标 (${count}个)`);
        }
    }

    /**
     * 获取当前锁定等级
     */
    public getFocusLockPriority(): number {
        return this._lockPriority;
    }

    /**
     * 获取锁定目标数量
     */
    public getLockTargetCount(): number {
        return this._lockTargets.size;
    }

    /**
     * 检查是否锁定了特定目标
     */
    public isLockingTarget(target: Node): boolean {
        return this._lockTargets.has(target);
    }

    /**
     * 获取所有锁定目标的副本
     */
    public getLockTargets(): Node[] {
        return Array.from(this._lockTargets);
    }
} 