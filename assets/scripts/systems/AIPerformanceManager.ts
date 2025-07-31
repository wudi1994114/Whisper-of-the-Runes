import { _decorator, Component, Node, Vec3, find } from 'cc';
import { AINavigationController, NavigationState } from '../controllers/AINavigationController';

const { ccclass, property } = _decorator;

/**
 * LOD等级枚举
 */
export enum LODLevel {
    HIGH = 0,    // 高详细度 - 完整更新
    MEDIUM = 1,  // 中等详细度 - 降低更新频率
    LOW = 2,     // 低详细度 - 大幅降低更新频率
    MINIMAL = 3  // 最小详细度 - 仅基础更新
}

/**
 * AI代理信息
 */
interface AIAgentInfo {
    node: Node;
    navigationController: AINavigationController;
    lodLevel: LODLevel;
    lastUpdateTime: number;
    updateInterval: number;
    priority: number;
    distanceToPlayer: number;
}

/**
 * AI性能管理器
 * 特性：
 * 1. LOD系统 - 根据距离和重要性调整AI更新频率
 * 2. 分批更新 - 避免在同一帧更新过多AI
 * 3. 性能监控 - 实时监控AI系统性能
 * 4. 动态调整 - 根据性能状况自动调整设置
 * 5. 优先级管理 - 重要AI优先获得计算资源
 */
@ccclass('AIPerformanceManager')
export class AIPerformanceManager extends Component {
    
    // 单例实例
    private static _instance: AIPerformanceManager | null = null;
    
    @property({
        displayName: "最大同帧AI数量",
        tooltip: "每帧最多更新多少个AI"
    })
    // 【性能优化】减少每帧最大AI数量，分散计算负担避免单帧卡顿
    public maxAIPerFrame: number = 4;
    
    @property({
        displayName: "高LOD距离",
        tooltip: "高详细度AI的最大距离"
    })
    // 【性能优化】缩小高LOD距离，让更多AI进入低频更新模式
    public highLODDistance: number = 100;
    
    @property({
        displayName: "中LOD距离", 
        tooltip: "中等详细度AI的最大距离"
    })
    // 【性能优化】适当缩小中LOD距离
    public mediumLODDistance: number = 200;
    
    @property({
        displayName: "低LOD距离",
        tooltip: "低详细度AI的最大距离"
    })
    // 【性能优化】缩小低LOD距离，让远处AI进入最低更新频率
    public lowLODDistance: number = 400;
    
    @property({
        displayName: "启用动态调整",
        tooltip: "是否根据性能自动调整设置"
    })
    public enableDynamicAdjustment: boolean = true;
    
    @property({
        displayName: "目标帧率",
        tooltip: "期望维持的帧率"
    })
    public targetFrameRate: number = 60;
    
    // AI代理列表
    private aiAgents: AIAgentInfo[] = [];
    private updateQueue: AIAgentInfo[] = [];
    private currentUpdateIndex: number = 0;
    
    // 玩家引用（用于距离计算）
    private playerNode: Node | null = null;
    
    // LOD更新间隔（秒）
    private readonly LOD_UPDATE_INTERVALS = {
        [LODLevel.HIGH]: 0.016,    // 60fps
        [LODLevel.MEDIUM]: 0.033,  // 30fps
        [LODLevel.LOW]: 0.066,     // 15fps
        [LODLevel.MINIMAL]: 0.133  // 7.5fps
    };
    
    // 性能统计
    private performanceStats = {
        totalAIAgents: 0,
        activeAIAgents: 0,
        highLODAIs: 0,
        mediumLODAIs: 0,
        lowLODAIs: 0,
        minimalLODAIs: 0,
        averageFrameTime: 16.67,
        maxFrameTime: 16.67,
        frameTimeHistory: [] as number[],
        lastStatsUpdate: 0
    };
    
    protected onLoad(): void {
        AIPerformanceManager._instance = this;
        
        // 寻找玩家节点
        this.findPlayerNode();
        
        console.log(`%c[AIPerformanceManager] ⚡ AI性能管理器已初始化`, 'color: yellow; font-weight: bold');
        
        // 定期更新LOD等级
        this.schedule(this.updateLODLevels, 0.5);
        
        // 定期更新性能统计
        this.schedule(this.updatePerformanceStats, 1.0);
    }
    
    protected onDestroy(): void {
        if (AIPerformanceManager._instance === this) {
            AIPerformanceManager._instance = null;
        }
        this.aiAgents = [];
        this.updateQueue = [];
        console.log(`%c[AIPerformanceManager] 🗑️ AI性能管理器已销毁`, 'color: orange');
    }
    
    /**
     * 获取单例实例
     */
    public static getInstance(): AIPerformanceManager | null {
        return AIPerformanceManager._instance;
    }
    
    /**
     * 注册AI代理
     */
    public registerAI(node: Node, navigationController: AINavigationController): void {
        // 检查是否已注册
        const existingAgent = this.aiAgents.find(agent => agent.node === node);
        if (existingAgent) {
            console.warn(`%c[AIPerformanceManager] ⚠️ AI代理已存在: ${node.name}`, 'color: orange');
            return;
        }
        
        const agentInfo: AIAgentInfo = {
            node: node,
            navigationController: navigationController,
            lodLevel: LODLevel.HIGH,
            lastUpdateTime: 0,
            updateInterval: this.LOD_UPDATE_INTERVALS[LODLevel.HIGH],
            priority: this.calculateAIPriority(node),
            distanceToPlayer: 0
        };
        
        this.aiAgents.push(agentInfo);
        console.log(`%c[AIPerformanceManager] ✅ AI代理已注册: ${node.name} (总数: ${this.aiAgents.length})`, 'color: green');
    }
    
    /**
     * 反注册AI代理
     */
    public unregisterAI(node: Node): void {
        const index = this.aiAgents.findIndex(agent => agent.node === node);
        if (index !== -1) {
            this.aiAgents.splice(index, 1);
            console.log(`%c[AIPerformanceManager] ❌ AI代理已反注册: ${node.name} (剩余: ${this.aiAgents.length})`, 'color: red');
        }
        
        // 从更新队列中移除
        const queueIndex = this.updateQueue.findIndex(agent => agent.node === node);
        if (queueIndex !== -1) {
            this.updateQueue.splice(queueIndex, 1);
        }
    }
    
    /**
     * 更新系统（分批处理AI更新）
     */
    protected update(deltaTime: number): void {
        const frameStartTime = Date.now();
        
        // 记录帧时间用于性能监控
        this.recordFrameTime(deltaTime * 1000);
        
        // 构建更新队列
        this.buildUpdateQueue();
        
        // 分批更新AI
        this.processAIUpdates(frameStartTime);
        
        // 动态性能调整
        if (this.enableDynamicAdjustment) {
            this.adjustPerformanceSettings();
        }
    }
    
    /**
     * 构建AI更新队列
     */
    private buildUpdateQueue(): void {
        const currentTime = Date.now() / 1000;
        this.updateQueue = [];
        
        for (const agent of this.aiAgents) {
            // 检查节点是否有效
            if (!agent.node || !agent.node.isValid) {
                continue;
            }
            
            // 检查是否需要更新
            if (currentTime - agent.lastUpdateTime >= agent.updateInterval) {
                this.updateQueue.push(agent);
            }
        }
        
        // 按优先级排序
        this.updateQueue.sort((a, b) => {
            // 优先级高的先更新
            if (a.priority !== b.priority) {
                return b.priority - a.priority;
            }
            // 优先级相同时，距离近的先更新
            return a.distanceToPlayer - b.distanceToPlayer;
        });
    }
    
    /**
     * 处理AI更新
     */
    private processAIUpdates(frameStartTime: number): void {
        let processedCount = 0;
        const maxProcessTime = 5; // 最大处理时间5ms
        
        while (this.updateQueue.length > 0 && 
               processedCount < this.maxAIPerFrame &&
               Date.now() - frameStartTime < maxProcessTime) {
            
            const agent = this.updateQueue.shift()!;
            
            // 执行AI更新（这里可以扩展更多优化逻辑）
            this.updateAIAgent(agent);
            
            processedCount++;
        }
        
        // 如果队列还有剩余，下一帧继续处理
        if (this.updateQueue.length > 0) {
            console.log(`%c[AIPerformanceManager] ⏳ 本帧处理了 ${processedCount} 个AI，队列剩余 ${this.updateQueue.length} 个`, 'color: yellow');
        }
    }
    
    /**
     * 更新单个AI代理
     */
    private updateAIAgent(agent: AIAgentInfo): void {
        const currentTime = Date.now() / 1000;
        agent.lastUpdateTime = currentTime;
        
        // 根据LOD等级调整AI行为
        switch (agent.lodLevel) {
            case LODLevel.HIGH:
                // 高详细度 - 正常更新
                break;
                
            case LODLevel.MEDIUM:
                // 中等详细度 - 降低目标搜索频率
                this.adjustMediumLODAI(agent);
                break;
                
            case LODLevel.LOW:
                // 低详细度 - 大幅简化AI逻辑
                this.adjustLowLODAI(agent);
                break;
                
            case LODLevel.MINIMAL:
                // 最小详细度 - 几乎暂停AI
                this.adjustMinimalLODAI(agent);
                break;
        }
    }
    
    /**
     * 调整中等LOD AI
     */
    private adjustMediumLODAI(agent: AIAgentInfo): void {
        // 中等LOD：减少搜索频率，但保持路径跟随
        const navController = agent.navigationController;
        const currentState = navController.getCurrentState();
        
        // 如果没有目标且不在搜索状态，降低搜索频率
        if (currentState === NavigationState.IDLE && Math.random() > 0.5) {
            // 50%概率跳过目标搜索
            return;
        }
    }
    
    /**
     * 调整低LOD AI
     */
    private adjustLowLODAI(agent: AIAgentInfo): void {
        // 低LOD：仅保持基本移动，减少路径计算
        const navController = agent.navigationController;
        const currentTarget = navController.getCurrentTarget();
        
        if (!currentTarget) {
            // 没有目标时大幅降低搜索频率
            if (Math.random() > 0.2) {
                return; // 80%概率跳过
            }
        }
    }
    
    /**
     * 调整最小LOD AI
     */
    private adjustMinimalLODAI(agent: AIAgentInfo): void {
        // 最小LOD：几乎暂停AI，仅保持存活状态
        const navController = agent.navigationController;
        
        // 清除当前目标，让AI停止移动
        if (Math.random() > 0.1) {
            return; // 90%概率跳过所有AI逻辑
        }
    }
    
    /**
     * 更新LOD等级
     */
    private updateLODLevels(): void {
        if (!this.playerNode) {
            this.findPlayerNode();
            return;
        }
        
        const playerPosition = this.playerNode.position;
        
        for (const agent of this.aiAgents) {
            if (!agent.node || !agent.node.isValid) continue;
            
            // 计算到玩家的距离
            agent.distanceToPlayer = Vec3.distance(agent.node.position, playerPosition);
            
            // 根据距离确定LOD等级
            let newLODLevel: LODLevel;
            
            if (agent.distanceToPlayer <= this.highLODDistance) {
                newLODLevel = LODLevel.HIGH;
            } else if (agent.distanceToPlayer <= this.mediumLODDistance) {
                newLODLevel = LODLevel.MEDIUM;
            } else if (agent.distanceToPlayer <= this.lowLODDistance) {
                newLODLevel = LODLevel.LOW;
            } else {
                newLODLevel = LODLevel.MINIMAL;
            }
            
            // 考虑AI优先级调整
            if (agent.priority > 5) {
                // 高优先级AI提升一个LOD等级
                newLODLevel = Math.max(0, newLODLevel - 1);
            }
            
            // 更新LOD等级和更新间隔
            if (agent.lodLevel !== newLODLevel) {
                agent.lodLevel = newLODLevel;
                agent.updateInterval = this.LOD_UPDATE_INTERVALS[newLODLevel];
                // 减少LOD变更日志
            }
        }
    }
    
    /**
     * 计算AI优先级
     */
    private calculateAIPriority(node: Node): number {
        let priority = 1; // 基础优先级
        
        // 根据角色类型调整优先级
        const nodeName = node.name.toLowerCase();
        
        if (nodeName.includes('boss')) {
            priority += 10; // Boss最高优先级
        } else if (nodeName.includes('elite')) {
            priority += 5; // 精英较高优先级
        } else if (nodeName.includes('player')) {
            priority += 8; // 玩家相关高优先级
        }
        
        // 根据AI状态调整优先级
        const navController = node.getComponent(AINavigationController);
        if (navController) {
            const currentState = navController.getCurrentState();
            const hasTarget = !!navController.getCurrentTarget();
            
            if (hasTarget) {
                priority += 3; // 有目标的AI优先级更高
            }
            
            if (currentState === NavigationState.FOLLOWING_PATH || 
                currentState === NavigationState.APPROACHING_TARGET) {
                priority += 2; // 正在执行任务的AI优先级更高
            }
        }
        
        return priority;
    }
    
    /**
     * 寻找玩家节点
     */
    private findPlayerNode(): void {
        // 尝试多种方式找到玩家节点
        this.playerNode = find('Player') || 
                         find('Canvas/Player') || 
                         find('GameManager/Player');
        
        if (!this.playerNode) {
            // 寻找具有PlayerController组件的节点
            const allNodes = find('Canvas')?.children || [];
            for (const child of allNodes) {
                if (child.getComponent('PlayerController')) {
                    this.playerNode = child;
                    break;
                }
            }
        }
        
        if (this.playerNode) {
            console.log(`%c[AIPerformanceManager] 🎮 找到玩家节点: ${this.playerNode.name}`, 'color: green');
        } else {
            console.warn(`%c[AIPerformanceManager] ⚠️ 未找到玩家节点，LOD计算将使用原点`, 'color: orange');
            // 创建虚拟玩家节点在原点
            this.playerNode = new Node('VirtualPlayer');
            this.playerNode.setPosition(0, 0, 0);
        }
    }
    
    /**
     * 记录帧时间
     */
    private recordFrameTime(frameTimeMs: number): void {
        this.performanceStats.frameTimeHistory.push(frameTimeMs);
        
        // 保持最近100帧的记录
        if (this.performanceStats.frameTimeHistory.length > 100) {
            this.performanceStats.frameTimeHistory.shift();
        }
        
        // 更新平均帧时间
        const sum = this.performanceStats.frameTimeHistory.reduce((a, b) => a + b, 0);
        this.performanceStats.averageFrameTime = sum / this.performanceStats.frameTimeHistory.length;
        
        // 更新最大帧时间
        this.performanceStats.maxFrameTime = Math.max(frameTimeMs, this.performanceStats.maxFrameTime);
    }
    
    /**
     * 动态调整性能设置
     */
    private adjustPerformanceSettings(): void {
        const targetFrameTimeMs = 1000 / this.targetFrameRate;
        
        // 如果平均帧时间超过目标，降低性能要求
        if (this.performanceStats.averageFrameTime > targetFrameTimeMs * 1.2) {
            // 减少每帧处理的AI数量
            if (this.maxAIPerFrame > 3) {
                this.maxAIPerFrame--;
                console.log(`%c[AIPerformanceManager] 📉 性能调整: 减少每帧AI数量至 ${this.maxAIPerFrame}`, 'color: orange');
            }
            
            // 增加LOD距离阈值
            this.highLODDistance = Math.max(150, this.highLODDistance - 10);
            this.mediumLODDistance = Math.max(300, this.mediumLODDistance - 20);
            this.lowLODDistance = Math.max(600, this.lowLODDistance - 30);
            
        } else if (this.performanceStats.averageFrameTime < targetFrameTimeMs * 0.8) {
            // 性能良好时，可以适度提升质量
            if (this.maxAIPerFrame < 15) {
                this.maxAIPerFrame++;
                console.log(`%c[AIPerformanceManager] 📈 性能调整: 增加每帧AI数量至 ${this.maxAIPerFrame}`, 'color: green');
            }
        }
    }
    
    /**
     * 更新性能统计
     */
    private updatePerformanceStats(): void {
        this.performanceStats.totalAIAgents = this.aiAgents.length;
        this.performanceStats.activeAIAgents = this.aiAgents.filter(agent => 
            agent.node && agent.node.isValid).length;
        
        // 统计各LOD等级的AI数量
        this.performanceStats.highLODAIs = this.aiAgents.filter(agent => agent.lodLevel === LODLevel.HIGH).length;
        this.performanceStats.mediumLODAIs = this.aiAgents.filter(agent => agent.lodLevel === LODLevel.MEDIUM).length;
        this.performanceStats.lowLODAIs = this.aiAgents.filter(agent => agent.lodLevel === LODLevel.LOW).length;
        this.performanceStats.minimalLODAIs = this.aiAgents.filter(agent => agent.lodLevel === LODLevel.MINIMAL).length;
        
        this.performanceStats.lastStatsUpdate = Date.now() / 1000;
        
        // 重置最大帧时间
        this.performanceStats.maxFrameTime = this.performanceStats.averageFrameTime;
    }
    
    /**
     * 获取性能统计
     */
    public getPerformanceStats() {
        return {
            ...this.performanceStats,
            currentFrameRate: 1000 / this.performanceStats.averageFrameTime,
            maxAIPerFrame: this.maxAIPerFrame,
            lodDistances: {
                high: this.highLODDistance,
                medium: this.mediumLODDistance,
                low: this.lowLODDistance
            }
        };
    }
    
    /**
     * 强制调整LOD设置
     */
    public adjustLODSettings(highDist: number, mediumDist: number, lowDist: number): void {
        this.highLODDistance = highDist;
        this.mediumLODDistance = mediumDist;
        this.lowLODDistance = lowDist;
        
        console.log(`%c[AIPerformanceManager] ⚙️ LOD距离已调整: H=${highDist}, M=${mediumDist}, L=${lowDist}`, 'color: cyan');
    }
    
    /**
     * 打印调试信息
     */
    public printDebugInfo(): void {
        const stats = this.getPerformanceStats();
        console.log(`%c[AIPerformanceManager] 📊 AI性能状态:`, 'color: yellow; font-weight: bold');
        console.log(`%c[AIPerformanceManager] 🤖 AI总数: ${stats.totalAIAgents} (活跃: ${stats.activeAIAgents})`, 'color: blue');
        console.log(`%c[AIPerformanceManager] 🎯 LOD分布: H=${stats.highLODAIs}, M=${stats.mediumLODAIs}, L=${stats.lowLODAIs}, Min=${stats.minimalLODAIs}`, 'color: green');
        console.log(`%c[AIPerformanceManager] ⏱️ 性能: 帧率=${stats.currentFrameRate.toFixed(1)}fps, 平均帧时间=${stats.averageFrameTime.toFixed(2)}ms`, 'color: purple');
        console.log(`%c[AIPerformanceManager] ⚙️ 设置: 每帧AI=${stats.maxAIPerFrame}, LOD距离=[${stats.lodDistances.high}, ${stats.lodDistances.medium}, ${stats.lodDistances.low}]`, 'color: orange');
    }
    
    /**
     * 获取所有AI代理列表（用于外部系统访问）
     */
    public getAiAgents(): AIAgentInfo[] {
        return [...this.aiAgents]; // 返回副本以防止外部修改
    }
}

// 导出单例访问器
export const aiPerformanceManager = {
    getInstance: (): AIPerformanceManager | null => AIPerformanceManager.getInstance()
}; 