import { _decorator, Component, Vec2, Node } from 'cc';
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
            return char.getMoveSpeed();
        }
        
        return 100; // 默认速度
    }

    /**
     * 检查角色是否有效且存活
     */
    public isAgentValid(): boolean {
        if (!this.node || !this.node.isValid) {
            return false;
        }
        
        const char = this.character;
        if (!char) {
            return false;
        }
        
        return char.isAlive();
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
} 