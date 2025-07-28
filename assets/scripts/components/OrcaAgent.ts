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
    public radius: number = 30; // 避让半径
    
    @property({
        displayName: "邻居搜索距离", 
        tooltip: "搜寻邻居的距离，越大计算开销越大但避让效果越好"
    })
    public neighborDist: number = 100; // 搜寻邻居的距离
    
    @property({
        displayName: "时间域",
        tooltip: "对其他移动角色的预测时间（秒），看的越远避让动作越早"
    })
    public timeHorizon: number = 1.5; // 预测时间（秒），看的越远，避让动作越早
    
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
    public aggressiveness: number = 0.5; // 避让的激进程度

    @property({
        displayName: "自动调整参数",
        tooltip: "是否根据代理类型和速度自动调整timeHorizon和neighborDist"
    })
    public autoAdjustParams: boolean = true; // 是否自动调整参数

    @property({
        displayName: "收敛容忍度",
        tooltip: "求解器的收敛容忍度，越小越精确但计算量越大",
        range: [0.0001, 0.01, 0.0001]
    })
    public convergenceTolerance: number = 0.001; // 求解器收敛容忍度

    @property({
        displayName: "响应敏感度",
        tooltip: "对邻居变化的响应敏感度，影响避让的及时性",
        range: [0.1, 2.0, 0.1]
    })
    public responsiveness: number = 1.0; // 响应敏感度

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
        console.log(`[ORCA_DEBUG] 🏃 ${this.node.name} 获取最大速度`);
        
        if (this.maxSpeed > 0) {
            console.log(`[ORCA_DEBUG]   - 使用配置的最大速度: ${this.maxSpeed}`);
            return this.maxSpeed;
        }
        
        const char = this.character;
        if (char) {
            const speed = char.getMoveSpeed();
            console.log(`[ORCA_DEBUG]   - 从角色组件获取速度: ${speed}`);
            return speed;
        }
        
        console.warn(`[ORCA_DEBUG]   - 无法获取速度，使用默认值: 100`);
        return 100; // 默认速度
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
    }

    protected onDestroy() {
        this._character = null;
    }

    /**
     * 获取有效的时间域，考虑自动调整和代理类型
     */
    public getEffectiveTimeHorizon(): number {
        if (!this.autoAdjustParams) {
            return this.timeHorizon;
        }

        let adjustedTime = this.timeHorizon;
        const currentSpeed = this.getMaxSpeed();

        // 根据代理类型调整
        switch (this.agentType) {
            case 1: // AGGRESSIVE
                adjustedTime *= 0.7; // 激进单位预测时间更短
                break;
            case 2: // CAUTIOUS  
                adjustedTime *= 1.3; // 谨慎单位预测时间更长
                break;
            case 3: // LARGE
                adjustedTime *= 1.2; // 大型单位需要更多预测时间
                break;
            case 4: // FAST
                adjustedTime *= Math.max(1.5, currentSpeed / 100); // 快速单位根据速度调整
                break;
        }

        // 根据激进程度微调
        const aggFactor = 1.0 - (this.aggressiveness - 0.5) * 0.4;
        adjustedTime *= aggFactor;

        // 限制在合理范围内
        return Math.max(0.5, Math.min(3.0, adjustedTime));
    }

    /**
     * 获取有效的邻居搜索距离，考虑自动调整
     */
    public getEffectiveNeighborDist(): number {
        if (!this.autoAdjustParams) {
            return this.neighborDist;
        }

        const effectiveTimeHorizon = this.getEffectiveTimeHorizon();
        const currentSpeed = this.getMaxSpeed();
        
        // 基础距离：速度 × 时间域 + 安全余量
        let adjustedDist = currentSpeed * effectiveTimeHorizon + this.radius * 2;

        // 根据代理类型调整
        switch (this.agentType) {
            case 1: // AGGRESSIVE
                adjustedDist *= 0.8; // 激进单位搜索范围更小
                break;
            case 2: // CAUTIOUS
                adjustedDist *= 1.4; // 谨慎单位搜索范围更大
                break;
            case 3: // LARGE
                adjustedDist *= 1.3; // 大型单位需要更大搜索范围
                break;
            case 4: // FAST
                adjustedDist *= 1.2; // 快速单位需要更远搜索
                break;
        }

        // 确保至少是手动设置值和计算值的较大者
        return Math.max(this.neighborDist, adjustedDist);
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
                this.radius *= 1.2;
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
} 