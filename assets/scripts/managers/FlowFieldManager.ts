// assets/scripts/managers/FlowFieldManager.ts

import { _decorator, Component, Node } from 'cc';
import { DirectionFieldSystem } from '../systems/DirectionFieldSystem';
import { OneDimensionalGrid } from '../systems/OneDimensionalGrid';
import { GridFactory, GridType } from '../systems/GridFactory';
import { OneDimensionalUnitAI } from '../components/OneDimensionalUnitAI';
import { Faction, FactionUtils } from '../configs/FactionConfig';

const { ccclass } = _decorator;

/**
 * 流场管理器
 * 负责初始化和管理一维流场系统的生命周期
 */
@ccclass('FlowFieldManager')
export class FlowFieldManager {
    private static instance: FlowFieldManager | null = null;
    
    // 🎯 多阵营方向场系统：每个阵营有自己的方向场
    private directionFieldSystems: Map<string, DirectionFieldSystem> = new Map();
    private oneDGrid: OneDimensionalGrid | null = null;
    private activeAIUnits: Set<OneDimensionalUnitAI> = new Set();
    private pendingAIUnits: OneDimensionalUnitAI[] = [];
    
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
        // 🎯 防止重复初始化
        if (this.directionFieldSystems.size > 0 && this.oneDGrid) {
            console.log(`[FlowFieldManager] ⚠️ 流场系统已初始化，跳过重复初始化`);
            return;
        }
        
        console.log(`[FlowFieldManager] 初始化多阵营流场系统 - 列数: ${cols}`);
        
        try {
            // 创建一维网格（所有阵营共享同一个网格）
            this.oneDGrid = GridFactory.createGrid({
                type: GridType.ONE_DIMENSIONAL,
                cols,
                worldWidth,
                worldHeight
            }) as OneDimensionalGrid;
            
            // 🎯 创建双向对抗的方向场系统
            // red阵营的方向场：指导red单位走向blue
            const redDirectionField = new DirectionFieldSystem(this.oneDGrid, Faction.RED, Faction.BLUE);
            this.directionFieldSystems.set('red', redDirectionField);
            
            // blue阵营的方向场：指导blue单位走向red
            const blueDirectionField = new DirectionFieldSystem(this.oneDGrid, Faction.BLUE, Faction.RED);
            this.directionFieldSystems.set('blue', blueDirectionField);
            
            console.log(`[FlowFieldManager] ✅ 多阵营流场系统初始化完成 (red->blue, blue->red)`);
            
            // 🎯 处理等待队列中的AI单位
            this.processPendingAIUnits();
            
        } catch (error) {
            console.error(`[FlowFieldManager] ❌ 流场系统初始化失败:`, error);
            this.cleanup();
        }
    }
    
    /**
     * 更新流场系统
     */
    public update(deltaTime: number): void {
        // 🎯 更新所有阵营的方向场
        this.directionFieldSystems.forEach((directionField, faction) => {
            directionField.update(deltaTime);
        });
    }
    
    /**
     * 注册AI单位
     */
    public registerAIUnit(aiUnit: OneDimensionalUnitAI): void {
        if (!this.isSystemReady()) {
            console.warn(`[FlowFieldManager] 系统未就绪，将AI单位加入等待队列: ${aiUnit.node.name}`);
            this.pendingAIUnits.push(aiUnit);
            return;
        }
        
        // 🎯 根据AI单位的阵营选择对应的方向场
        const factionComponent = aiUnit.node.getComponent('FactionComponent');
        if (!factionComponent) {
            console.error(`[FlowFieldManager] AI单位缺少FactionComponent: ${aiUnit.node.name}`);
            return;
        }
        
        const factionString = (factionComponent as any).aiFaction;
        const directionField = this.directionFieldSystems.get(factionString);
        
        if (!directionField) {
            console.error(`[FlowFieldManager] 未找到阵营 ${factionString} 的方向场系统`);
            return;
        }
        
        // 设置系统引用（使用对应阵营的方向场）
        aiUnit.setSystemReferences(directionField, this.oneDGrid!);
        
        // 添加到活跃列表
        this.activeAIUnits.add(aiUnit);
        
        console.log(`[FlowFieldManager] 已注册AI单位 (${factionString}阵营)，当前总数: ${this.activeAIUnits.size}`);
    }
    
    /**
     * 处理等待队列中的AI单位
     */
    private processPendingAIUnits(): void {
        if (this.pendingAIUnits.length === 0) {
            return;
        }
        
        console.log(`[FlowFieldManager] 开始处理等待队列中的 ${this.pendingAIUnits.length} 个AI单位`);
        
        const unitsToProcess = [...this.pendingAIUnits];
        this.pendingAIUnits = [];
        
        let successCount = 0;
        for (const aiUnit of unitsToProcess) {
            if (aiUnit && aiUnit.node && aiUnit.node.isValid) {
                this.registerAIUnit(aiUnit);
                successCount++;
            } else {
                console.warn(`[FlowFieldManager] 跳过无效的AI单位`);
            }
        }
        
        console.log(`[FlowFieldManager] 等待队列处理完成: ${successCount}/${unitsToProcess.length} 个单位成功注册`);
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
     * 获取指定阵营的方向场系统引用
     */
    public getDirectionFieldSystem(faction: Faction): DirectionFieldSystem | undefined {
        return this.directionFieldSystems.get(FactionUtils.factionToString(faction));
    }
    
    /**
     * 获取指定阵营的方向场系统引用（字符串版本）
     */
    public getDirectionFieldSystemByString(factionString: string): DirectionFieldSystem | undefined {
        return this.directionFieldSystems.get(factionString);
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
        
        // 🎯 聚合所有方向场的信息
        let fieldsInfo = '';
        this.directionFieldSystems.forEach((system, faction) => {
            fieldsInfo += `\n--- Faction [${faction}] Direction Field ---\n`;
            fieldsInfo += system.getDebugInfo();
        });
        
        return `[FlowFieldManager] 流场管理器状态:
- 活跃AI单位数: ${this.activeAIUnits.size}
- 方向场数量: ${this.directionFieldSystems.size}
- 系统状态: ${this.isSystemReady() ? '就绪' : '未就绪'}

${gridInfo}
${fieldsInfo}`;
    }
    
    /**
     * 获取指定阵营的方向场可视化
     */
    public getFieldVisualization(faction: string, startCol: number = 0, endCol?: number): string {
        const system = this.directionFieldSystems.get(faction);
        if (!system) {
            return `[FlowFieldManager] 未找到阵营 ${faction} 的方向场系统`;
        }
        return system.getVisualization(startCol, endCol);
    }
    
    /**
     * 获取所有阵营的方向场可视化
     */
    public getAllFieldsVisualization(startCol: number = 0, endCol?: number): string {
        if (this.directionFieldSystems.size === 0) {
            return '[FlowFieldManager] 方向场系统未初始化';
        }
        
        let result = '';
        this.directionFieldSystems.forEach((system, faction) => {
            result += `\n=== ${faction.toUpperCase()} 阵营方向场 ===\n`;
            result += system.getVisualization(startCol, endCol);
            result += '\n';
        });
        return result;
    }
    
    /**
     * 强制更新所有阵营的方向场
     */
    public forceUpdateField(): void {
        if (this.directionFieldSystems.size > 0) {
            this.directionFieldSystems.forEach((system, faction) => {
                system.forceUpdate();
                console.log(`[FlowFieldManager] 强制更新阵营 [${faction}] 的方向场完成`);
            });
        } else {
            console.log(`[FlowFieldManager] 没有可更新的方向场系统`);
        }
    }
    
    /**
     * 清理系统
     */
    public cleanup(): void {
        console.log(`[FlowFieldManager] 开始清理流场系统...`);
        
        // 清理AI单位引用
        this.activeAIUnits.clear();
        this.pendingAIUnits = [];
        
        // 清理方向场系统
        this.directionFieldSystems.clear();
        
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
        return this.directionFieldSystems.size > 0 && this.oneDGrid !== null;
    }
}

// 导出单例实例
export const flowFieldManager = FlowFieldManager.getInstance();