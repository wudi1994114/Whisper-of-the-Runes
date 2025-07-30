import { _decorator, Component, Node, Vec3, Vec2, find, RigidBody2D } from 'cc';
import { PathfindingManager, PathInfo } from '../systems/PathfindingManager';
import { OrcaAgent } from '../components/OrcaAgent';
import { Faction } from '../configs/FactionConfig';
import { TargetInfo, ITargetSelector } from '../components/MonsterAI';
import { BaseCharacterDemo } from '../entities/BaseCharacterDemo';
import { TargetSelectorFactory } from '../configs/TargetSelectorFactory';

const { ccclass, property } = _decorator;

/**
 * AI导航决策输出
 */
export interface AINavigationOutput {
    prefVelocity: Vec2;           // 期望移动速度
    wantsToAttack: boolean;       // 是否想要攻击
    targetDirection: Vec3 | null; // 面向目标的方向（可选）
    debugInfo?: string;           // 调试信息
}

/**
 * 导航状态枚举
 */
export enum NavigationState {
    IDLE = 'idle',              // 待机状态
    SEEKING_TARGET = 'seeking', // 搜索目标
    PATHFINDING = 'pathfinding', // 计算路径中
    FOLLOWING_PATH = 'following', // 跟随路径
    APPROACHING_TARGET = 'approaching', // 接近目标
    BLOCKED = 'blocked',        // 路径被阻挡
    LOST_TARGET = 'lost'        // 丢失目标
}

/**
 * 导航配置
 */
interface NavigationConfig {
    detectionRange: number;     // 搜索范围
    attackRange: number;        // 攻击范围
    pathUpdateInterval: number; // 路径更新间隔
    pathNodeThreshold: number;  // 路径节点到达阈值
    maxPathAge: number;         // 路径最大有效时间
    blockedCheckInterval: number; // 阻挡检查间隔
    giveUpDistance: number;     // 放弃追击距离
}

/**
 * AI导航控制器
 * 核心功能：
 * 1. 协调索敌、寻路、避让三个系统
 * 2. 管理AI的导航状态机
 * 3. 处理路径跟随逻辑
 * 4. 智能的重新寻路判断
 * 5. 目标丢失和恢复处理
 */
@ccclass('AINavigationController')
export class AINavigationController extends Component {
    
    @property({
        displayName: "搜索范围",
        tooltip: "AI搜索目标的最大距离"
    })
    public detectionRange: number = 200;
    
    @property({
        displayName: "攻击范围",
        tooltip: "AI的攻击距离"
    })
    public attackRange: number = 60;
    
    @property({
        displayName: "路径更新间隔",
        tooltip: "重新计算路径的时间间隔（秒）"
    })
    public pathUpdateInterval: number = 2.0;
    
    @property({
        displayName: "路径节点阈值",
        tooltip: "到达路径节点的距离阈值"
    })
    public pathNodeThreshold: number = 20;
    
    @property({
        displayName: "最大路径有效时间",
        tooltip: "路径的最大有效时间（秒）"
    })
    public maxPathAge: number = 10.0;
    
    @property({
        displayName: "阻挡检查间隔",
        tooltip: "检查路径是否被阻挡的时间间隔（秒）"
    })
    public blockedCheckInterval: number = 1.0;
    
    @property({
        displayName: "放弃追击距离",
        tooltip: "超过此距离将放弃当前目标"
    })
    public giveUpDistance: number = 400;
    
    // 组件引用
    private targetSelector: ITargetSelector | null = null;
    private pathfindingManager: PathfindingManager | null = null;
    private orcaAgent: OrcaAgent | null = null;
    
    // 【简化】只保留必要的目标和路径信息
    private currentTarget: TargetInfo | null = null;
    private currentPath: PathInfo | null = null;
    private currentPathIndex: number = 0;
    
    // 时间管理
    private lastTargetSearchTime: number = 0;
    private lastPathUpdateTime: number = 0;
    private lastBlockedCheckTime: number = 0;
    private stateEnterTime: number = 0;
    private lastDebugTime: number = 0;
    
    // AI属性
    private aiRole: string = '';
    private originalPosition: Vec3 = new Vec3(); // AI的原始位置（用于回归）
    // 移除重复的aiFaction属性，统一从BaseCharacterDemo获取
    
    // 性能统计
    private performanceStats = {
        totalPathRequests: 0,
        successfulPaths: 0,
        blockedPaths: 0,
        targetsFound: 0,
        targetsLost: 0
    };
    
    protected onLoad(): void {
        // 获取组件引用 - 智能初始化各个系统
        this.initializeTargetSelector();
        this.initializePathfindingManager();
        this.orcaAgent = this.getComponent(OrcaAgent);
        
        // 初始化状态
        this.currentState = NavigationState.IDLE;
        this.stateEnterTime = Date.now() / 1000;
        
        console.log(`%c[AINavigationController] 🧭 AI导航控制器已初始化: ${this.node.name}`, 'color: purple; font-weight: bold');
    }
    
    /**
     * 智能初始化目标选择器
     */
    private initializeTargetSelector(): void {
        console.log(`%c[AINavigationController] 🎯 开始初始化目标选择器 (使用工厂模式)`, 'color: blue; font-weight: bold');
        
        // 使用工厂获取统一配置的选择器
        this.targetSelector = TargetSelectorFactory.getInstance();
        
        if (this.targetSelector) {
            const selectorInfo = TargetSelectorFactory.getCurrentSelectorInfo();
            console.log(`%c[AINavigationController] ✅ 目标选择器初始化成功: ${selectorInfo.instance} (${selectorInfo.type})`, 'color: green; font-weight: bold');
            
            // 打印工厂状态（调试用）
            TargetSelectorFactory.printStatus();
        } else {
            console.error(`%c[AINavigationController] ❌ 目标选择器初始化失败，AI导航将无法正常工作`, 'color: red; font-weight: bold');
        }
    }
    
    /**
     * 智能初始化寻路管理器
     */
    private initializePathfindingManager(): void {
        // 尝试获取现有实例
        this.pathfindingManager = PathfindingManager.getInstance();
        
        if (this.pathfindingManager) {
            console.log(`%c[AINavigationController] 🗺️ 使用现有寻路管理器`, 'color: green');
            return;
        }
        
        // 如果不存在，尝试创建一个
        try {
            const gameManagerNode = find('GameManager');
            if (gameManagerNode) {
                const pathfindingComponent = gameManagerNode.addComponent(PathfindingManager);
                if (pathfindingComponent) {
                    this.pathfindingManager = pathfindingComponent;
                    console.log(`%c[AINavigationController] 🗺️ 创建了寻路管理器`, 'color: blue');
                    return;
                }
            }
        } catch (error) {
            console.warn(`%c[AINavigationController] ⚠️ 创建寻路管理器失败:`, 'color: orange', error);
        }
        
        console.warn(`%c[AINavigationController] ⚠️ 无法初始化寻路管理器，将使用直线移动`, 'color: orange');
        this.pathfindingManager = null;
    }
    
    /**
     * 初始化AI导航参数
     */
    public initializeNavigation(role: string, faction: Faction, config?: Partial<NavigationConfig>): void {

        
        this.aiRole = role;
        
        // 【新架构】设置原始位置
        if (!this.originalPosition || this.originalPosition.equals(Vec3.ZERO)) {
            this.originalPosition.set(this.node.position);

        }
        

        
        // 应用配置
        if (config) {
            if (config.detectionRange !== undefined) this.detectionRange = config.detectionRange;
            if (config.attackRange !== undefined) this.attackRange = config.attackRange;
            if (config.pathUpdateInterval !== undefined) this.pathUpdateInterval = config.pathUpdateInterval;
            if (config.pathNodeThreshold !== undefined) this.pathNodeThreshold = config.pathNodeThreshold;
            if (config.maxPathAge !== undefined) this.maxPathAge = config.maxPathAge;
            if (config.blockedCheckInterval !== undefined) this.blockedCheckInterval = config.blockedCheckInterval;
            if (config.giveUpDistance !== undefined) this.giveUpDistance = config.giveUpDistance;
            

        }
        

    }
    
    /**
     * 获取当前角色的阵营（从BaseCharacterDemo获取）
     */
    private getCurrentFaction(): Faction | null {
        const baseCharacter = this.node.getComponent(BaseCharacterDemo) as any;
        if (baseCharacter && baseCharacter.getFaction) {
            return baseCharacter.getFaction();
        }
        return null;
    }
    
    /**
     * 【新架构】计算AI导航决策 - 唯一对外接口
     * 输入：当前状态
     * 输出：期望移动速度和攻击意图
     */
    public computeDecision(): AINavigationOutput {
        const output: AINavigationOutput = {
            prefVelocity: new Vec2(0, 0),
            wantsToAttack: false,
            targetDirection: null,
            debugInfo: `${this.node.name}: 计算决策`
        };

        // 检查AI是否已初始化
        const currentFaction = this.getCurrentFaction();
        if (!currentFaction || !this.targetSelector) {
            output.debugInfo = `${this.node.name}: 未初始化，保持待机`;
            return output;
        }

        // 1. 搜索目标
        const currentTarget = this.findBestTarget();
        
        if (currentTarget) {
            const distance = Vec3.distance(this.node.position, currentTarget.position);
            
            if (distance <= this.attackRange) {
                // 在攻击范围内：停止移动，准备攻击
                output.prefVelocity.set(0, 0);
                output.wantsToAttack = true;
                output.targetDirection = currentTarget.position;
                output.debugInfo = `${this.node.name}: 攻击范围内(${distance.toFixed(1)} <= ${this.attackRange})，准备攻击`;
            } else {
                // 不在攻击范围：计算移动速度
                output.prefVelocity = this.calculateMoveVelocityTowards(currentTarget.position);
                output.wantsToAttack = false;
                output.targetDirection = currentTarget.position;
                output.debugInfo = `${this.node.name}: 追击目标(距离=${distance.toFixed(1)})`;
            }
            
            // 更新内部目标引用（用于路径计算）
            this.currentTarget = currentTarget;
        } else {
            // 没有目标：检查是否需要回归原位
            const homeDistance = Vec3.distance(this.node.position, this.originalPosition);
            if (homeDistance > 10) {
                output.prefVelocity = this.calculateMoveVelocityTowards(this.originalPosition);
                output.debugInfo = `${this.node.name}: 回归原位(距离=${homeDistance.toFixed(1)})`;
            } else {
                output.prefVelocity.set(0, 0); // 待机
                output.debugInfo = `${this.node.name}: 原位待机`;
            }
            output.wantsToAttack = false;
            this.currentTarget = null;
        }
        
        return output;
    }

    /**
     * 【兼容性】保留update方法供现有系统调用
     * 但现在只负责内部维护，不再控制状态机
     */
    protected update(deltaTime: number): void {
        // 仅保留基础的目标有效性检查和路径维护
        const currentTime = Date.now() / 1000;
        
        // 清理无效目标
        if (this.currentTarget && !this.isTargetValid(this.currentTarget)) {
            this.currentTarget = null;
        }
        
        // 路径维护（如果有的话）
        if (this.currentPath && currentTime - this.currentPath.timestamp > this.maxPathAge) {
            this.clearCurrentPath();
        }
    }
    
    // 【移除】旧的状态机更新方法已被computeDecision()替代
    
    // 【移除】旧的状态更新方法，已被computeDecision()统一替代
    
    // 【移除】旧寻路状态更新，新架构中路径计算集成到calculateMoveVelocityTowards中
    
    // 【移除】所有旧的状态更新方法，新架构使用computeDecision()统一计算
    
    // 【移除】状态转换方法，新架构不再使用内部状态机
    
    /**
     * 统一的期望速度设置方法 - AINavigationController的唯一速度控制入口
     * 这是整个AI导航系统设置ORCA期望速度的唯一接口
     */
    public setDesiredVelocity(velocity: Vec2): void {
        if (this.orcaAgent) {
            this.orcaAgent.prefVelocity.set(velocity.x, velocity.y);
            console.log(`[AINavigationController|${this.node.name}] 设置期望速度=(${velocity.x.toFixed(2)}, ${velocity.y.toFixed(2)})`);
        }
    }

    /**
     * 停止移动 - 清空期望速度
     */
    public stopMovement(): void {
        if (this.orcaAgent) {
            this.orcaAgent.prefVelocity.set(0, 0);
            console.log(`[AINavigationController|${this.node.name}] 停止移动`);
        }
    }

    /**
     * 【新架构】搜索最佳目标
     */
    private findBestTarget(): TargetInfo | null {
        if (!this.targetSelector) {
            return null;
        }
        
        const currentFaction = this.getCurrentFaction();
        if (!currentFaction) {
            return null;
        }
        
        return this.targetSelector.findBestTarget(
            this.node.position,
            currentFaction,
            this.detectionRange
        );
    }
    
    /**
     * 【新架构】计算朝向目标的移动速度
     */
    private calculateMoveVelocityTowards(targetPosition: Vec3): Vec2 {
        const direction = new Vec2(
            targetPosition.x - this.node.position.x,
            targetPosition.y - this.node.position.y
        );
        
        // 如果距离目标过近，停止移动
        if (direction.lengthSqr() < 1) {
            return new Vec2(0, 0);
        }
        
        // 计算期望速度：朝目标全速前进
        direction.normalize();
        const maxSpeed = this.orcaAgent ? this.orcaAgent.getMaxSpeed() : 100; // 默认速度
        return direction.multiplyScalar(maxSpeed);
    }
    
    /**
     * 设置期望速度指向目标方向
     * @param targetPosition 目标位置
     */
    public setDesiredVelocityTowards(targetPosition: Vec3): void {
        if (!this.orcaAgent) {
            return;
        }
        
        const velocity = this.calculateMoveVelocityTowards(targetPosition);
        this.setDesiredVelocity(velocity);
    }
    /**
     * 内部方法：设置ORCA期望速度指向目标位置（保持现有调用兼容性）
     */
    private setOrcaDesiredVelocityTowards(targetPosition: Vec3): void {
        this.setDesiredVelocityTowards(targetPosition);
    }
    
    /**
     * 检查目标是否仍然有效
     */
    private isTargetValid(target: TargetInfo): boolean {
        if (!target.node || !target.node.isValid) {
            return false;
        }
        
        // 检查目标是否存活
        const characterStats = target.node.getComponent('CharacterStats') as any;
        if (characterStats && !characterStats.isAlive) {
            return false;
        }
        
        // 检查距离是否超出放弃范围
        const currentDistance = Vec3.distance(this.node.position, target.node.position);
        if (currentDistance > this.giveUpDistance) {
            return false;
        }
        
        return true;
    }
    
    private isPathBlocked(): boolean {
        if (!this.currentPath || this.currentPathIndex >= this.currentPath.nodes.length || !this.orcaAgent) {
            return false;
        }
    
        // 检查是否有移动意图
        const wantsToMove = this.orcaAgent.prefVelocity.lengthSqr() > 0.1;
    
        // 检查实际速度
        const actualVelocity = this.node.getComponent(RigidBody2D)?.linearVelocity;
        const isStuck = actualVelocity ? actualVelocity.lengthSqr() < 0.1 : true; // 如果没有刚体也认为卡住
    
        // 如果有移动意图，但在原地停留超过1.5秒，则认为被阻挡
        const stateTime = (Date.now() / 1000) - this.stateEnterTime;
        if (wantsToMove && isStuck && stateTime > 1.5) {
            console.log(`%c[AINavigationController] 🚧 检测到路径阻挡 (想动但动不了): ${this.node.name}`, 'color: red');
            return true;
        }
        
        return false;
    }
    
    /**
     * 清理当前路径
     */
    private clearCurrentPath(): void {
        this.currentPath = null;
        this.currentPathIndex = 0;
    }
    
    /**
     * 获取当前导航状态
     */
    public getCurrentState(): NavigationState {
        return this.currentState;
    }
    
    /**
     * 获取当前目标
     */
    public getCurrentTarget(): TargetInfo | null {
        return this.currentTarget;
    }
    
    // 【移除】强制搜索方法，新架构中通过computeDecision()自动处理
    
    /**
     * 获取性能统计
     */
    public getPerformanceStats() {
        return {
            ...this.performanceStats,
            currentState: this.currentState,
            hasTarget: !!this.currentTarget,
            hasPath: !!this.currentPath,
            pathProgress: this.currentPath ? 
                `${this.currentPathIndex}/${this.currentPath.nodes.length}` : 'N/A'
        };
    }
    
    protected onDestroy(): void {
        this.clearCurrentPath();
        this.currentTarget = null;
        console.log(`%c[AINavigationController] 🗑️ AI导航控制器已销毁: ${this.node.name}`, 'color: gray');
    }
}

// 导出单例访问器
export const aiNavigationController = {
    createForNode: (node: Node): AINavigationController | null => {
        return node.addComponent(AINavigationController);
    }
};