// assets/scripts/managers/FlowFieldManager.ts

import { _decorator, Component, Node } from 'cc';
import { DirectionFieldSystem } from '../systems/DirectionFieldSystem';
import { OneDimensionalGrid } from '../systems/OneDimensionalGrid';
import { GridFactory, GridType } from '../systems/GridFactory';
import { OneDimensionalUnitAI } from '../components/OneDimensionalUnitAI';

const { ccclass } = _decorator;

/**
 * 流场管理器
 * 负责初始化和管理一维流场系统的生命周期
 */
@ccclass('FlowFieldManager')
export class FlowFieldManager {
    private static instance: FlowFieldManager | null = null;
    
    private directionFieldSystem: DirectionFieldSystem | null = null;
    private oneDGrid: OneDimensionalGrid | null = null;
    private activeAIUnits: Set<OneDimensionalUnitAI> = new Set();
    
    /**
     * 获取单例实例
     */
    public static getInstance(): FlowFieldManager {
        if (!FlowFieldManager.instance) {
            FlowFieldManager.instance = new FlowFieldManager();
        }
        return FlowFieldManager.instance;
    }
    
    /**
     * 初始化流场系统
     */
    public initialize(cols: number = 30, worldWidth: number = 1920, worldHeight: number = 1080): void {
        console.log(`[FlowFieldManager] 初始化流场系统 - 列数: ${cols}`);
        
        try {
            // 创建一维网格
            this.oneDGrid = GridFactory.createGrid({
                type: GridType.ONE_DIMENSIONAL,
                cols,
                worldWidth,
                worldHeight
            }) as OneDimensionalGrid;
            
            // 创建方向场系统
            this.directionFieldSystem = DirectionFieldSystem.getInstance(this.oneDGrid);
            
            console.log(`[FlowFieldManager] ✅ 流场系统初始化完成`);
            
        } catch (error) {
            console.error(`[FlowFieldManager] ❌ 流场系统初始化失败:`, error);
            this.cleanup();
        }
    }
    
    /**
     * 更新流场系统
     */
    public update(deltaTime: number): void {
        if (this.directionFieldSystem) {
            this.directionFieldSystem.update(deltaTime);
        }
    }
    
    /**
     * 注册AI单位
     */
    public registerAIUnit(aiUnit: OneDimensionalUnitAI): void {
        if (!this.isSystemReady()) {
            console.warn(`[FlowFieldManager] 系统未就绪，延迟注册AI单位`);
            // 延迟注册，等待系统初始化完成
            setTimeout(() => {
                this.registerAIUnit(aiUnit);
            }, 100);
            return;
        }
        
        // 设置系统引用
        aiUnit.setSystemReferences(this.directionFieldSystem!, this.oneDGrid!);
        
        // 添加到活跃列表
        this.activeAIUnits.add(aiUnit);
        
        console.log(`[FlowFieldManager] 已注册AI单位，当前总数: ${this.activeAIUnits.size}`);
    }
    
    /**
     * 注销AI单位
     */
    public unregisterAIUnit(aiUnit: OneDimensionalUnitAI): void {
        this.activeAIUnits.delete(aiUnit);
        console.log(`[FlowFieldManager] 已注销AI单位，当前总数: ${this.activeAIUnits.size}`);
    }
    
    /**
     * 批量注册AI单位
     */
    public registerAIUnitsFromNodes(nodes: Node[]): void {
        if (!this.isSystemReady()) {
            console.warn(`[FlowFieldManager] 系统未就绪，无法批量注册AI单位`);
            return;
        }
        
        let registeredCount = 0;
        
        for (const node of nodes) {
            const aiComponent = node.getComponent(OneDimensionalUnitAI);
            if (aiComponent) {
                this.registerAIUnit(aiComponent);
                registeredCount++;
            }
        }
        
        console.log(`[FlowFieldManager] 批量注册完成: ${registeredCount}/${nodes.length} 个AI单位`);
    }
    
    /**
     * 获取方向场系统引用
     */
    public getDirectionFieldSystem(): DirectionFieldSystem | null {
        return this.directionFieldSystem;
    }
    
    /**
     * 获取一维网格系统引用
     */
    public getOneDimensionalGrid(): OneDimensionalGrid | null {
        return this.oneDGrid;
    }
    
    /**
     * 获取调试信息
     */
    public getDebugInfo(): string {
        if (!this.isSystemReady()) {
            return '[FlowFieldManager] 系统未初始化';
        }
        
        const gridInfo = this.oneDGrid!.getDebugInfo();
        const fieldInfo = this.directionFieldSystem!.getDebugInfo();
        
        return `[FlowFieldManager] 流场管理器状态:
- 活跃AI单位数: ${this.activeAIUnits.size}
- 系统状态: ${this.isSystemReady() ? '就绪' : '未就绪'}

${gridInfo}

${fieldInfo}`;
    }
    
    /**
     * 获取方向场可视化
     */
    public getFieldVisualization(startCol: number = 0, endCol?: number): string {
        if (!this.directionFieldSystem) {
            return '[FlowFieldManager] 方向场系统未初始化';
        }
        
        return this.directionFieldSystem.getVisualization(startCol, endCol);
    }
    
    /**
     * 强制更新方向场
     */
    public forceUpdateField(): void {
        if (this.directionFieldSystem) {
            this.directionFieldSystem.forceUpdate();
            console.log(`[FlowFieldManager] 强制更新方向场完成`);
        }
    }
    
    /**
     * 清理系统
     */
    public cleanup(): void {
        console.log(`[FlowFieldManager] 开始清理流场系统...`);
        
        // 清理AI单位引用
        this.activeAIUnits.clear();
        
        // 清理方向场系统
        if (this.directionFieldSystem) {
            DirectionFieldSystem.resetInstance();
            this.directionFieldSystem = null;
        }
        
        // 清理一维网格
        if (this.oneDGrid) {
            OneDimensionalGrid.resetInstance();
            this.oneDGrid = null;
        }
        
        console.log(`[FlowFieldManager] ✅ 流场系统清理完成`);
    }
    
    /**
     * 重置管理器
     */
    public static resetInstance(): void {
        if (FlowFieldManager.instance) {
            FlowFieldManager.instance.cleanup();
            FlowFieldManager.instance = null;
        }
    }
    
    /**
     * 系统是否就绪
     */
    private isSystemReady(): boolean {
        return this.directionFieldSystem !== null && this.oneDGrid !== null;
    }
}

// 导出单例实例
export const flowFieldManager = FlowFieldManager.getInstance();

// 将流场管理器实例添加到全局对象，供AI组件访问
(globalThis as any).flowFieldManager = flowFieldManager;