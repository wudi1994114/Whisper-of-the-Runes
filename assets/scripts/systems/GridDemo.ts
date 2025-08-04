// assets/scripts/systems/GridDemo.ts

import { _decorator, Component, Node, Vec3 } from 'cc';
import { GridFactory, GridType, GridPresets } from './GridFactory';
import { IGrid } from '../interfaces/IGrid';
import { Faction } from '../configs/FactionConfig';
import { EntityType } from '../interfaces/IGrid';

const { ccclass, property } = _decorator;

/**
 * 网格系统演示组件
 * 展示如何使用不同类型的网格系统
 */
@ccclass('GridDemo')
export class GridDemo extends Component {
    
    @property({ tooltip: "演示模式" })
    public demoMode: number = 0; // 0=标准网格, 1=10x3网格, 2=30x3网格, 3=50x3网格
    
    @property({ tooltip: "自动切换演示" })
    public autoSwitch: boolean = false;
    
    @property({ tooltip: "切换间隔(秒)" })
    public switchInterval: number = 10.0;
    
    private currentGrid: IGrid | null = null;
    private switchTimer: number = 0;
    private testNodes: Node[] = [];
    
    protected onLoad(): void {
        console.log('[GridDemo] 网格演示系统已加载');
        this.initializeDemo();
    }
    
    protected update(deltaTime: number): void {
        // 处理网格更新
        if (this.currentGrid) {
            this.currentGrid.processUpdates(deltaTime);
        }
        
        // 自动切换演示
        if (this.autoSwitch) {
            this.switchTimer += deltaTime;
            if (this.switchTimer >= this.switchInterval) {
                this.switchToNextDemo();
                this.switchTimer = 0;
            }
        }
    }
    
    /**
     * 初始化演示
     */
    private initializeDemo(): void {
        this.createTestNodes();
        this.switchToDemo(this.demoMode);
    }
    
    /**
     * 创建测试节点
     */
    private createTestNodes(): void {
        // 创建一些测试实体
        for (let i = 0; i < 20; i++) {
            const testNode = new Node(`TestEntity_${i}`);
            this.node.addChild(testNode);
            
            // 随机位置
            testNode.setWorldPosition(new Vec3(
                (Math.random() - 0.5) * 1800,
                (Math.random() - 0.5) * 900,
                0
            ));
            
            this.testNodes.push(testNode);
        }
        
        console.log(`[GridDemo] 创建了${this.testNodes.length}个测试实体`);
    }
    
    /**
     * 切换到指定演示
     */
    public switchToDemo(mode: number): void {
        this.demoMode = mode;
        
        // 清理当前网格中的实体
        if (this.currentGrid) {
            for (const node of this.testNodes) {
                this.currentGrid.unregisterEntity(node);
            }
        }
        
        // 创建新的网格系统
        switch (mode) {
            case 0:
                this.currentGrid = GridFactory.createGrid(GridPresets.standard());
                console.log('[GridDemo] 切换到标准网格演示');
                break;
                
            case 1:
                this.currentGrid = GridFactory.createGrid({
                    type: GridType.N_BY_THREE,
                    cols: 10,
                    worldWidth: 1920,
                    worldHeight: 1080
                });
                console.log('[GridDemo] 切换到10x3网格演示');
                break;
                
            case 2:
                this.currentGrid = GridFactory.createGrid(GridPresets.mediumHorizontal());
                console.log('[GridDemo] 切换到30x3网格演示');
                break;
                
            case 3:
                this.currentGrid = GridFactory.createGrid(GridPresets.largeHorizontal());
                console.log('[GridDemo] 切换到50x3网格演示');
                break;
                
            default:
                this.currentGrid = GridFactory.createGrid(GridPresets.standard());
                console.log('[GridDemo] 使用默认标准网格');
                break;
        }
        
        // 注册测试实体到新网格
        this.registerTestEntities();
        
        // 输出网格信息
        this.logGridInfo();
    }
    
    /**
     * 注册测试实体到网格
     */
    private registerTestEntities(): void {
        if (!this.currentGrid) {
            return;
        }
        
        for (let i = 0; i < this.testNodes.length; i++) {
            const node = this.testNodes[i];
            const faction = i % 2 === 0 ? Faction.PLAYER : Faction.RED;
            
            this.currentGrid.registerEntity(node, faction, EntityType.CHARACTER);
        }
        
        console.log(`[GridDemo] 已注册${this.testNodes.length}个测试实体到网格`);
    }
    
    /**
     * 切换到下一个演示
     */
    public switchToNextDemo(): void {
        const nextMode = (this.demoMode + 1) % 4;
        this.switchToDemo(nextMode);
    }
    
    /**
     * 输出网格信息
     */
    public logGridInfo(): void {
        if (this.currentGrid) {
            console.log(this.currentGrid.getDebugInfo());
            console.log('网格配置:', this.currentGrid.getGridConfig());
        }
    }
    
    /**
     * 测试网格查询功能
     */
    public testGridQueries(): void {
        if (!this.currentGrid || this.testNodes.length === 0) {
            console.warn('[GridDemo] 无法进行查询测试：网格或测试实体不存在');
            return;
        }
        
        const centerPos = new Vec3(0, 0, 0);
        const searchRadius = 300;
        
        console.log('[GridDemo] 开始网格查询测试...');
        
        // 测试最近邻查询
        const nearest = this.currentGrid.findNearestEntity(centerPos, {
            factions: [Faction.RED],
            entityTypes: [EntityType.CHARACTER],
            maxDistance: searchRadius
        });
        
        if (nearest) {
            console.log(`最近实体: ${nearest.entity.node.name}, 距离: ${nearest.distance.toFixed(2)}`);
        } else {
            console.log('未找到最近实体');
        }
        
        // 测试范围查询
        const entitiesInRange = this.currentGrid.findEntitiesInRange(centerPos, searchRadius, {
            factions: [Faction.PLAYER, Faction.RED]
        });
        
        console.log(`范围内实体数量: ${entitiesInRange.length}`);
        
        // 测试网格坐标转换
        const gridPos = this.currentGrid.worldToGrid(centerPos);
        const worldPos = this.currentGrid.gridToWorld(gridPos);
        
        console.log(`坐标转换测试:`);
        console.log(`世界坐标 ${centerPos.toString()} -> 网格坐标 [${gridPos.x}, ${gridPos.y}]`);
        console.log(`网格坐标 [${gridPos.x}, ${gridPos.y}] -> 世界坐标 ${worldPos.toString()}`);
    }
    
    protected onDestroy(): void {
        // 清理网格系统
        if (this.currentGrid) {
            for (const node of this.testNodes) {
                this.currentGrid.unregisterEntity(node);
            }
        }
        
        console.log('[GridDemo] 网格演示系统已销毁');
    }
}