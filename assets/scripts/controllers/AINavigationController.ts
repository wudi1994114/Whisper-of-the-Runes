import { _decorator, Component, Node, Vec3, Vec2, find } from 'cc';
import { EnhancedTargetSelector } from '../components/EnhancedTargetSelector';
import { TargetSelector } from '../components/TargetSelector';
import { PathfindingManager, PathInfo } from '../systems/PathfindingManager';
import { OrcaAgent } from '../components/OrcaAgent';
import { Faction } from '../configs/FactionConfig';
import { TargetInfo, ITargetSelector } from '../components/MonsterAI';

const { ccclass, property } = _decorator;

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
    
    // 导航状态
    private currentState: NavigationState = NavigationState.IDLE;
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
        // 优先尝试使用增强版目标选择器
        let enhancedSelector = EnhancedTargetSelector.getInstance();
        
        if (enhancedSelector) {
            this.targetSelector = enhancedSelector;
            console.log(`%c[AINavigationController] 🎯 使用增强版目标选择器`, 'color: green');
            return;
        }
        
        // 如果增强版不可用，尝试创建一个
        try {
            const gameManagerNode = find('GameManager');
            if (gameManagerNode) {
                const enhancedComponent = gameManagerNode.addComponent(EnhancedTargetSelector);
                if (enhancedComponent) {
                    this.targetSelector = enhancedComponent;
                    console.log(`%c[AINavigationController] 🎯 创建了增强版目标选择器`, 'color: blue');
                    return;
                }
            }
        } catch (error) {
            console.warn(`%c[AINavigationController] ⚠️ 创建增强版目标选择器失败:`, 'color: orange', error);
        }
        
        // 回退到原始目标选择器
        const originalSelector = TargetSelector.getInstance();
        if (originalSelector) {
            this.targetSelector = originalSelector;
            console.log(`%c[AINavigationController] 🎯 回退到原始目标选择器`, 'color: yellow');
            return;
        }
        
        // 如果原始选择器也不可用，尝试创建一个
        try {
            const gameManagerNode = find('GameManager');
            if (gameManagerNode) {
                const originalComponent = gameManagerNode.addComponent(TargetSelector);
                if (originalComponent) {
                    this.targetSelector = originalComponent;
                    console.log(`%c[AINavigationController] 🎯 创建了原始目标选择器`, 'color: cyan');
                    return;
                }
            }
        } catch (error) {
            console.warn(`%c[AINavigationController] ⚠️ 创建原始目标选择器失败:`, 'color: orange', error);
        }
        
        // 如果都失败了，输出错误信息
        console.error(`%c[AINavigationController] ❌ 无法初始化任何目标选择器，AI导航将无法正常工作`, 'color: red');
        this.targetSelector = null;
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
        console.log(`%c[TARGET_DEBUG] ⚙️ ${this.node.name} 开始初始化导航参数`, 'color: blue; font-weight: bold');
        console.log(`%c[TARGET_DEBUG] 🏛️ ${this.node.name} 设置角色: ${role}, 阵营: ${faction}`, 'color: blue');
        
        this.aiRole = role;
        // 移除重复的aiFaction属性，统一从BaseCharacterDemo获取
        
        console.log(`%c[TARGET_DEBUG] 🔧 ${this.node.name} 阵营设置完成: aiFaction=${faction}`, 'color: blue');
        
        // 应用配置
        if (config) {
            if (config.detectionRange !== undefined) this.detectionRange = config.detectionRange;
            if (config.attackRange !== undefined) this.attackRange = config.attackRange;
            if (config.pathUpdateInterval !== undefined) this.pathUpdateInterval = config.pathUpdateInterval;
            if (config.pathNodeThreshold !== undefined) this.pathNodeThreshold = config.pathNodeThreshold;
            if (config.maxPathAge !== undefined) this.maxPathAge = config.maxPathAge;
            if (config.blockedCheckInterval !== undefined) this.blockedCheckInterval = config.blockedCheckInterval;
            if (config.giveUpDistance !== undefined) this.giveUpDistance = config.giveUpDistance;
            
            console.log(`%c[TARGET_DEBUG] 🎛️ ${this.node.name} 配置参数: 搜索范围=${this.detectionRange}, 攻击范围=${this.attackRange}`, 'color: blue');
        }
        
        console.log(`%c[TARGET_DEBUG] ✅ ${this.node.name} 导航参数配置完成: ${role} -> ${faction}，可以开始搜索目标`, 'color: green; font-weight: bold');
        
        // 【修复】阵营初始化完成后，立即开始搜索目标（如果当前是IDLE状态）
        if (this.currentState === NavigationState.IDLE) {
            console.log(`%c[TARGET_DEBUG] 🚀 ${this.node.name} 阵营初始化完成，立即转入SEEKING_TARGET状态`, 'color: green; font-weight: bold');
            this.transitionToState(NavigationState.SEEKING_TARGET, Date.now() / 1000);
        }
    }
    
    /**
     * 获取当前角色的阵营（从BaseCharacterDemo获取）
     */
    private getCurrentFaction(): Faction | null {
        const baseCharacter = this.node.getComponent('BaseCharacterDemo') as any;
        if (baseCharacter && baseCharacter.getFaction) {
            return baseCharacter.getFaction();
        }
        return null;
    }
    
    /**
     * 更新导航系统
     */
    protected update(deltaTime: number): void {
        const currentTime = Date.now() / 1000;
        
        // 更新导航状态机
        this.updateNavigationStateMachine(currentTime);
        
        // 每3秒打印一次状态信息，避免刷屏
        if (currentTime - (this.lastDebugTime || 0) > 3.0) {
            const currentFaction = this.getCurrentFaction();
            console.log(`%c[TARGET_DEBUG] 🔄 ${this.node.name} AI状态: ${this.currentState}, 阵营: ${currentFaction || '未初始化'}, 有目标: ${!!this.currentTarget}`, 'color: gray');
            
            // 【立即调试】打印TargetSelector状态
            const selector = TargetSelector.getInstance();
            if (selector) {
                console.log(`%c[TARGET_DEBUG] 📊 TargetSelector可用，立即检查注册表状态`, 'color: yellow');
                (selector as any).printFullRegistryInfo();
            } else {
                console.log(`%c[TARGET_DEBUG] ❌ TargetSelector未初始化！`, 'color: red');
            }
            
            this.lastDebugTime = currentTime;
        }
        
        // 根据当前状态执行相应逻辑
        switch (this.currentState) {
            case NavigationState.IDLE:
                this.updateIdleState(currentTime);
                break;
            case NavigationState.SEEKING_TARGET:
                this.updateSeekingState(currentTime);
                break;
            case NavigationState.PATHFINDING:
                this.updatePathfindingState(currentTime);
                break;
            case NavigationState.FOLLOWING_PATH:
                this.updateFollowingPathState(currentTime);
                break;
            case NavigationState.APPROACHING_TARGET:
                this.updateApproachingTargetState(currentTime);
                break;
            case NavigationState.BLOCKED:
                this.updateBlockedState(currentTime);
                break;
            case NavigationState.LOST_TARGET:
                this.updateLostTargetState(currentTime);
                break;
        }
    }
    
    /**
     * 更新导航状态机
     */
    private updateNavigationStateMachine(currentTime: number): void {
        // 检查目标是否仍然有效
        if (this.currentTarget && !this.isTargetValid(this.currentTarget)) {
            this.transitionToState(NavigationState.LOST_TARGET, currentTime);
            return;
        }
        
        // 检查是否需要重新搜索目标
        if (!this.currentTarget && currentTime - this.lastTargetSearchTime > 1.0) {
            this.transitionToState(NavigationState.SEEKING_TARGET, currentTime);
            return;
        }
        
        // 检查路径是否过期
        if (this.currentPath && currentTime - this.currentPath.timestamp > this.maxPathAge) {
            console.log(`%c[AINavigationController] ⏰ 路径过期，重新寻路`, 'color: orange');
            this.clearCurrentPath();
            if (this.currentTarget) {
                this.transitionToState(NavigationState.PATHFINDING, currentTime);
            }
        }
        
        // 检查是否被阻挡
        if (this.currentState === NavigationState.FOLLOWING_PATH && 
            currentTime - this.lastBlockedCheckTime > this.blockedCheckInterval) {
            this.lastBlockedCheckTime = currentTime;
            if (this.isPathBlocked()) {
                this.transitionToState(NavigationState.BLOCKED, currentTime);
            }
        }
    }
    
    /**
     * 待机状态更新
     */
    private updateIdleState(currentTime: number): void {
        // 【修复】首先检查阵营是否已初始化
        const currentFaction = this.getCurrentFaction();
        if (!currentFaction) {
            if (Math.random() < 0.05) { // 只有5%的概率打印，避免刷屏
                console.log(`%c[TARGET_DEBUG] ⏳ ${this.node.name} IDLE状态：等待阵营初始化 (无法获取阵营信息)`, 'color: orange');
            }
            return; // 阵营未初始化时，不要转换状态
        }
        
        // 定期搜索目标
        if (currentTime - this.lastTargetSearchTime > 1.0) {
            console.log(`%c[TARGET_DEBUG] 💤 ${this.node.name} IDLE状态：时间间隔已满足，准备转入SEEKING_TARGET`, 'color: cyan');
            console.log(`%c[TARGET_DEBUG] 🔍 ${this.node.name} IDLE -> SEEKING_TARGET`, 'color: cyan');
            this.transitionToState(NavigationState.SEEKING_TARGET, currentTime);
        } else {
            const timeUntilNext = 1.0 - (currentTime - this.lastTargetSearchTime);
            if (Math.random() < 0.1) { // 只有10%的概率打印，避免刷屏
                console.log(`%c[TARGET_DEBUG] ⏰ ${this.node.name} IDLE状态：等待搜索间隔，还需${timeUntilNext.toFixed(1)}秒`, 'color: lightgray');
            }
        }
    }
    
    /**
     * 搜索目标状态更新
     */
    private updateSeekingState(currentTime: number): void {
        console.log(`%c[TARGET_DEBUG] 🔍 ${this.node.name} 开始搜索目标`, 'color: cyan; font-weight: bold');
        
        if (!this.targetSelector) {
            console.log(`%c[TARGET_DEBUG] ❌ ${this.node.name} 目标选择器不可用`, 'color: red');
            return;
        }
        
        // 【修复】从BaseCharacterDemo获取阵营信息
        const currentFaction = this.getCurrentFaction();
        if (!currentFaction) {
            console.log(`%c[TARGET_DEBUG] ⚠️ ${this.node.name} 无法获取阵营信息，等待BaseCharacterDemo初始化`, 'color: orange');
            return;
        }
        
        console.log(`%c[TARGET_DEBUG] 🏛️ ${this.node.name} 阵营: ${currentFaction}, 搜索范围: ${this.detectionRange}`, 'color: blue');
        
        this.lastTargetSearchTime = currentTime;
        
        // 使用增强版目标选择器搜索目标
        const targetInfo = this.targetSelector.findBestTarget(
            this.node.position,
            currentFaction,
            this.detectionRange
        );
        
        if (targetInfo) {
            this.currentTarget = targetInfo;
            this.performanceStats.targetsFound++;
            console.log(`%c[TARGET_DEBUG] 🎯 ${this.node.name} 找到目标: ${targetInfo.node.name}, 距离: ${targetInfo.distance.toFixed(1)}, 阵营: ${targetInfo.faction}`, 'color: green');
            
            // 检查是否在攻击范围内
            if (targetInfo.distance <= this.attackRange) {
                console.log(`%c[TARGET_DEBUG] ⚔️ ${this.node.name} 目标在攻击范围内 (${targetInfo.distance.toFixed(1)} <= ${this.attackRange})`, 'color: green');
                this.transitionToState(NavigationState.APPROACHING_TARGET, currentTime);
            } else {
                console.log(`%c[TARGET_DEBUG] 🏃 ${this.node.name} 目标超出攻击范围，开始寻路 (${targetInfo.distance.toFixed(1)} > ${this.attackRange})`, 'color: yellow');
                this.transitionToState(NavigationState.PATHFINDING, currentTime);
            }
        } else {
            // 没有找到目标，返回待机状态
            console.log(`%c[TARGET_DEBUG] ❌ ${this.node.name} 未找到目标，返回IDLE状态 (阵营: ${currentFaction}, 搜索范围: ${this.detectionRange})`, 'color: red');
            this.transitionToState(NavigationState.IDLE, currentTime);
        }
    }
    
    /**
     * 寻路状态更新
     */
    private updatePathfindingState(currentTime: number): void {
        if (!this.currentTarget) {
            this.transitionToState(NavigationState.IDLE, currentTime);
            return;
        }
        
        // 如果有寻路管理器，使用A*寻路
        if (this.pathfindingManager) {
            this.performanceStats.totalPathRequests++;
            
            // 请求路径计算
            this.pathfindingManager.requestPath(
                this.node.position,
                this.currentTarget.position,
                (path: PathInfo | null) => {
                    if (path) {
                        this.currentPath = path;
                        this.currentPathIndex = 0;
                        this.performanceStats.successfulPaths++;
                        console.log(`%c[AINavigationController] 🗺️ 路径计算成功: ${path.nodes.length} 个节点`, 'color: blue');
                        this.transitionToState(NavigationState.FOLLOWING_PATH, Date.now() / 1000);
                    } else {
                        console.warn(`%c[AINavigationController] ❌ 路径计算失败，回退到直接接近`, 'color: red');
                        this.transitionToState(NavigationState.APPROACHING_TARGET, Date.now() / 1000);
                    }
                },
                1 // 高优先级
            );
        } else {
            // 没有寻路管理器时，直接接近目标
            console.log(`%c[AINavigationController] 📐 无寻路管理器，使用直线接近`, 'color: yellow');
            this.transitionToState(NavigationState.APPROACHING_TARGET, currentTime);
        }
    }
    
    /**
     * 跟随路径状态更新
     */
    private updateFollowingPathState(currentTime: number): void {
        if (!this.currentPath || !this.currentTarget) {
            this.transitionToState(NavigationState.IDLE, currentTime);
            return;
        }
        
        // 检查是否已到达路径终点
        if (this.currentPathIndex >= this.currentPath.nodes.length) {
            this.transitionToState(NavigationState.APPROACHING_TARGET, currentTime);
            return;
        }
        
        // 获取当前目标路径点
        const targetNode = this.currentPath.nodes[this.currentPathIndex];
        const distanceToNode = Vec3.distance(this.node.position, targetNode);
        
        // 检查是否到达当前路径点
        if (distanceToNode <= this.pathNodeThreshold) {
            this.currentPathIndex++;
            console.log(`%c[AINavigationController] 📍 到达路径点 ${this.currentPathIndex}/${this.currentPath.nodes.length}`, 'color: cyan');
            
            // 如果到达最后一个路径点
            if (this.currentPathIndex >= this.currentPath.nodes.length) {
                this.transitionToState(NavigationState.APPROACHING_TARGET, currentTime);
                return;
            }
        }
        
        // 设置ORCA期望速度指向当前路径点
        this.setOrcaDesiredVelocityTowards(targetNode);
        
        // 检查是否需要更新路径
        if (currentTime - this.lastPathUpdateTime > this.pathUpdateInterval) {
            this.lastPathUpdateTime = currentTime;
            // 如果目标移动太远，重新计算路径
            const targetDistance = Vec3.distance(this.currentTarget.position, 
                this.currentPath.nodes[this.currentPath.nodes.length - 1]);
            
            if (targetDistance > this.pathNodeThreshold * 2) {
                console.log(`%c[AINavigationController] 🔄 目标移动，重新寻路`, 'color: yellow');
                this.transitionToState(NavigationState.PATHFINDING, currentTime);
            }
        }
        
        // 检查是否在攻击范围内
        if (this.currentTarget.distance <= this.attackRange) {
            this.transitionToState(NavigationState.APPROACHING_TARGET, currentTime);
        }
    }
    
    /**
     * 接近目标状态更新
     */
    private updateApproachingTargetState(currentTime: number): void {
        if (!this.currentTarget) {
            this.transitionToState(NavigationState.IDLE, currentTime);
            return;
        }
        
        const currentDistance = Vec3.distance(this.node.position, this.currentTarget.position);
        
        // 如果脱离攻击范围，重新寻路
        if (currentDistance > this.attackRange * 1.2) {
            console.log(`%c[AINavigationController] 📏 脱离攻击范围，重新寻路`, 'color: orange');
            this.transitionToState(NavigationState.PATHFINDING, currentTime);
            return;
        }
        
        // 直接朝目标移动（由ORCA处理避让）
        this.setOrcaDesiredVelocityTowards(this.currentTarget.position);
    }
    
    /**
     * 阻挡状态更新
     */
    private updateBlockedState(currentTime: number): void {
        this.performanceStats.blockedPaths++;
        
        // 等待一段时间后重新寻路
        if (currentTime - this.stateEnterTime > 2.0) {
            console.log(`%c[AINavigationController] 🔓 阻挡状态超时，重新寻路`, 'color: yellow');
            this.clearCurrentPath();
            if (this.currentTarget) {
                this.transitionToState(NavigationState.PATHFINDING, currentTime);
            } else {
                this.transitionToState(NavigationState.SEEKING_TARGET, currentTime);
            }
        }
    }
    
    /**
     * 丢失目标状态更新
     */
    private updateLostTargetState(currentTime: number): void {
        this.performanceStats.targetsLost++;
        
        // 清理当前目标和路径
        this.currentTarget = null;
        this.clearCurrentPath();
        
        // 等待一段时间后重新搜索
        if (currentTime - this.stateEnterTime > 1.0) {
            this.transitionToState(NavigationState.SEEKING_TARGET, currentTime);
        }
    }
    
    /**
     * 状态转换
     */
    private transitionToState(newState: NavigationState, currentTime: number): void {
        const oldState = this.currentState;
        this.currentState = newState;
        this.stateEnterTime = currentTime;
        
        // 减少状态转换日志，仅记录重要转换
        if (newState === NavigationState.FOLLOWING_PATH || 
            newState === NavigationState.BLOCKED ||
            newState === NavigationState.LOST_TARGET) {
            console.log(`%c[AINavigationController] 🔄 状态转换: ${oldState} → ${newState}`, 'color: purple');
        }
    }
    
    /**
     * 设置ORCA期望速度指向目标位置
     */
    private setOrcaDesiredVelocityTowards(targetPosition: Vec3): void {
        if (!this.orcaAgent) {
            console.warn(`%c[AINavigationController] ⚠️ ORCA代理不可用`, 'color: orange');
            return;
        }
        
        // 计算方向向量
        const direction = new Vec2(
            targetPosition.x - this.node.position.x,
            targetPosition.y - this.node.position.y
        );
        
        const distance = direction.length();
        
        if (distance < 0.1) {
            // 已经很接近，停止移动
            this.orcaAgent.prefVelocity.set(0, 0);
            console.log(`%c[AINavigationController] 🛑 ${this.node.name} 已接近目标，停止移动`, 'color: green');
            return;
        }
        
        // 归一化方向并设置期望速度
        direction.normalize();
        const maxSpeed = this.orcaAgent.getMaxSpeed();
        const desiredVelocity = direction.multiplyScalar(maxSpeed);
        
        this.orcaAgent.prefVelocity.set(desiredVelocity.x, desiredVelocity.y);
        console.log(`%c[AINavigationController] 🎯 ${this.node.name} 设置期望速度: (${desiredVelocity.x.toFixed(1)}, ${desiredVelocity.y.toFixed(1)})`, 'color: blue');
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
    
    /**
     * 检查路径是否被阻挡
     */
    private isPathBlocked(): boolean {
        if (!this.currentPath || this.currentPathIndex >= this.currentPath.nodes.length) {
            return false;
        }
        
        // 简单的阻挡检查：如果在相同位置停留太久
        const stateTime = Date.now() / 1000 - this.stateEnterTime;
        if (stateTime > 3.0) {
            // 检查是否移动距离太小
            const targetNode = this.currentPath.nodes[this.currentPathIndex];
            const distanceToNode = Vec3.distance(this.node.position, targetNode);
            
            // 如果3秒内没有明显接近目标路径点，认为被阻挡
            if (distanceToNode > this.pathNodeThreshold * 1.5) {
                console.log(`%c[AINavigationController] 🚧 检测到路径阻挡`, 'color: red');
                return true;
            }
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
    
    /**
     * 强制重新搜索目标
     */
    public forceTargetSearch(): void {
        this.lastTargetSearchTime = 0;
        this.transitionToState(NavigationState.SEEKING_TARGET, Date.now() / 1000);
    }
    
    /**
     * 【调试方法】立即强制搜索，无视时间间隔
     */
    public forceImmediateSearch(): void {
        console.log(`%c[TARGET_DEBUG] 🚀 ${this.node.name} 强制立即搜索目标`, 'color: yellow; font-weight: bold');
        
        const currentTime = Date.now() / 1000;
        
        // 检查组件状态
        const currentFaction = this.getCurrentFaction();
        console.log(`%c[TARGET_DEBUG] 🔍 当前阵营: ${currentFaction}`, 'color: yellow');
        
        if (!this.targetSelector) {
            console.log(`%c[TARGET_DEBUG] ❌ targetSelector 未初始化`, 'color: red');
            return;
        }
        
        if (!currentFaction) {
            console.log(`%c[TARGET_DEBUG] ❌ 无法获取阵营信息`, 'color: red');
            return;
        }
        
        // 立即执行搜索逻辑
        this.updateSeekingState(currentTime);
    }
    
    /**
     * 强制重新计算路径
     */
    public forceRepath(): void {
        this.clearCurrentPath();
        if (this.currentTarget) {
            this.transitionToState(NavigationState.PATHFINDING, Date.now() / 1000);
        }
    }
    
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
    
    /**
     * 打印调试信息
     */
    public printDebugInfo(): void {
        const stats = this.getPerformanceStats();
        console.log(`%c[AINavigationController] 📊 AI导航状态 (${this.node.name}):`, 'color: purple; font-weight: bold');
        console.log(`%c[AINavigationController] 🎯 当前状态: ${stats.currentState}`, 'color: blue');
        console.log(`%c[AINavigationController] 📍 目标: ${stats.hasTarget ? this.currentTarget?.node.name : '无'}`, 'color: green');
        console.log(`%c[AINavigationController] 🗺️ 路径: ${stats.hasPath ? `进度 ${stats.pathProgress}` : '无'}`, 'color: cyan');
        console.log(`%c[AINavigationController] 📈 统计: 寻路=${stats.totalPathRequests}, 成功=${stats.successfulPaths}, 阻挡=${stats.blockedPaths}`, 'color: orange');
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