// assets/scripts/core/GameManager.ts

import { _decorator, Component, Node, director, Enum, KeyCode, Vec2, Vec3, Prefab, PhysicsSystem2D } from 'cc';
import { dataManager } from './DataManager';
import { eventManager } from './EventManager';
import { inputManager } from './InputManager';
import { poolManager } from './PoolManager';
import { systemConfigManager } from '../configs/SystemConfig';
import { resourceManager } from './ResourceManager';
import { GameEvents } from '../components/GameEvents';
import { levelManager } from './LevelManager';
import { animationManager } from './AnimationManager';
import { instantiate } from 'cc';
import { AIBehaviorType } from '../components/MonsterAI';
import { Faction } from '../configs/FactionConfig';
import { targetSelector } from '../components/TargetSelector';
import { TargetSelector } from '../components/TargetSelector';
import { UITransform } from 'cc';
import { setupPhysicsGroupCollisions } from '../configs/PhysicsConfig';
import { BaseCharacterDemo } from '../entities/BaseCharacterDemo';
import { ControlMode } from '../state-machine/CharacterEnums';
import { CharacterPoolInitializer, CharacterPoolFactory } from '../pool/CharacterPoolSystem';
import { damageDisplayController } from '../controllers/DamageDisplayController';
import { getCrowdingSystem, CrowdingSystem } from '../systems/CrowdingSystem';
import { gridManager, GridManager } from '../systems/GridManager';

const { ccclass, property } = _decorator;

// 定义游戏状态枚举
export enum GameState {
    MainMenu,
    Playing,
    Paused,
    GameOver,
}

// 简化的游戏模式枚举  
export enum GameMode {
    DEVELOPMENT = 0,    // 开发模式
    PRODUCTION = 1      // 生产模式
}

@ccclass('GameManager')
export class GameManager extends Component {
    public static instance: GameManager;

    @property({
        type: Enum(GameMode),
        tooltip: "游戏模式：开发或生产环境"
    })
    public gameMode: GameMode = GameMode.DEVELOPMENT;

    // ===== 简化预制体配置区域 =====
            // BaseCharacterDemo 智能系统现在只需要两个预制体
    
    @property({
        type: Prefab,
        displayName: "通用敌人预制体 (必需)",
        tooltip: "用于所有敌人类型的基础模板\n包含基础动画、血条、攻击组件\nBaseCharacterDemo 会根据敌人类型自动配置远程攻击能力"
    })
    public entPrefab: Prefab | null = null;

    @property({
        type: Prefab,
        displayName: "火球预制体 (必需)",
        tooltip: "远程攻击技能预制体，供所有巫妖使用\n包含火球动画、物理、伤害等完整逻辑"
    })
    public firePrefab: Prefab | null = null;

    // ===== 测试模式配置（互斥勾选） =====
    @property({
        displayName: "正常模式",
        tooltip: "通过关卡生成怪物，启用AI系统"
    })
    public normalMode: boolean = true;

    @property({
        displayName: "手动控制测试",
        tooltip: "手动控制单个怪物进行调试"
    })
    public manualTestMode: boolean = false;

    // ===== 关卡选择配置 =====
    @property({
        displayName: "选择关卡ID",
        tooltip: "正常模式下使用的关卡ID\n0: 普通测试场景\n1: 森林边缘\n2: 暗黑洞穴\n3: 兽人要塞",
        min: 0,
        step: 1
    })
    public selectedLevelId: number = 0;

    @property({
        type: Enum({
            ent_normal: 0,
            ent_elite: 1,
            ent_boss: 2,
            lich_normal: 3,
            lich_elite: 4,
            lich_boss: 5,
            skeleton_normal: 6,
            skeleton_elite: 7,
            skeleton_boss: 8,
            orc_normal: 9,
            orc_elite: 10,
            orc_boss: 11,
            goblin_normal: 12,
            goblin_elite: 13,
            goblin_boss: 14,
            slime_normal: 15,
            slime_fire: 16,
            slime_ice: 17,
            slime_bomb: 18,
            slime_ghost: 19,
            slime_lightning: 20,
            slime_crystal: 21,
            slime_devil: 22,
            slime_lava: 23,
            golem_normal: 24,
            golem_elite: 25,
            golem_boss: 26
        }),
        displayName: "测试怪物类型",
        tooltip: "手动测试模式下选择要生成的怪物类型"
    })
    public testEnemyType: number = 0;

    // ===== 调试配置 =====
    @property({
        displayName: "显示尺寸范围",
        tooltip: "显示所有角色的UISize和碰撞体范围（调试用）"
    })
    public showSizeRanges: boolean = false;

    private _gameState: GameState = GameState.MainMenu;

    // 输入分发相关
    private playerController: any = null;
    private enemyController: any = null;

    // 统一的角色管理器
    private activeCharacters: Map<string, any> = new Map();

    // 移动控制
    private currentMoveDirection: Vec2 = new Vec2(0, 0);
    private isMoving: boolean = false;

    // 便捷方法
    public get testMode(): boolean {
        return this.manualTestMode;
    }
    
    // 测试模式相关
    private currentTestEnemy: Node | null = null;
    private availableEnemyTypes: string[] = [
        'ent_normal', 'ent_elite', 'ent_boss',
        'lich_normal', 'lich_elite', 'lich_boss',
        'skeleton_normal', 'skeleton_elite', 'skeleton_boss',
        'orc_normal', 'orc_elite', 'orc_boss',
        'goblin_normal', 'goblin_elite', 'goblin_boss',
        'slime_normal', 'slime_fire', 'slime_ice', 'slime_bomb',
        'slime_ghost', 'slime_lightning', 'slime_crystal', 'slime_devil', 'slime_lava',
        'golem_normal', 'golem_elite', 'golem_boss'
    ];

    /**
     * 将枚举索引转换为怪物类型字符串
     */
    private getEnemyTypeFromIndex(index: number): string {
        return this.availableEnemyTypes[index] || 'ent_normal';
    }
    
    protected onLoad(): void {
        if (GameManager.instance) {
            this.destroy();
            return;
        }
        GameManager.instance = this;
        
        // 确保GameManager节点在场景根目录下，以便设置为常驻节点
        if (this.node.parent === director.getScene()) {
            director.addPersistRootNode(this.node);
            console.log('GameManager: 节点已成功设置为常驻节点。');
        } else {
            console.warn('GameManager: 节点不在场景根目录下，无法设置为常驻节点。请将GameManager节点拖到层级管理器的根层级。');
            // 备用方案：尝试将节点移动到根目录
            if (this.node.parent) {
                this.node.parent.removeChild(this.node);
                director.getScene()?.addChild(this.node);
                director.addPersistRootNode(this.node);
                console.log('GameManager: 已尝试将节点移动到根并设置为常驻节点。');
            }
        }
    }
    
    protected async start(): Promise<void> {
        // 确保模式互斥
        this.enforceModeMutex();
        
        // 打印详细的模式状态
        console.log(`GameManager: 模式状态详情 - normalMode: ${this.normalMode}, manualTestMode: ${this.manualTestMode}`);
        
        // 加载所有player enemy level skill数据
        await this.initManagers();
        this.setupInputDispatcher();
    }

    protected onDestroy(): void {
        this.cleanupInputDispatcher();
        
        // 清理伤害显示频率控制器
        damageDisplayController.destroy();
    }

    protected update(deltaTime: number): void {
        // 更新对象池管理器
        poolManager.update();

        // 玩家移动（如果不是手动测试模式）
        if (!this.manualTestMode && this.playerController && this.isMoving && this.currentMoveDirection.length() > 0) {
            this.playerController.move(this.currentMoveDirection, deltaTime);
        }

        // 手动测试模式下的怪物移动
        if (this.manualTestMode && this.enemyController && this.isMoving && this.currentMoveDirection.length() > 0) {
            const moveMethod = (this.enemyController as any).move;
            if (moveMethod && typeof moveMethod === 'function') {
                moveMethod.call(this.enemyController, this.currentMoveDirection, deltaTime);
            }
        }
    }
    
    /**
     * 统一更新所有活动角色
     */
    private updateCharacters(deltaTime: number): void {
        // 此方法已废弃，逻辑合并到 update 中
    }

    /**
     * 设置输入分发器
     */
    private setupInputDispatcher(): void {
        // 监听输入事件
        eventManager.on(GameEvents.KEY_PRESSED, this.onKeyPressed);
        eventManager.on(GameEvents.KEY_RELEASED, this.onKeyReleased);
        eventManager.on(GameEvents.MOVE_DIRECTION_CHANGED, this.onMoveDirectionChanged);

        console.log('GameManager: Input dispatcher setup complete');
    }

    /**
     * 清理输入分发器
     */
    private cleanupInputDispatcher(): void {
        eventManager.off(GameEvents.KEY_PRESSED, this.onKeyPressed);
        eventManager.off(GameEvents.KEY_RELEASED, this.onKeyReleased);
        eventManager.off(GameEvents.MOVE_DIRECTION_CHANGED, this.onMoveDirectionChanged);
    }

    /**
     * 键盘按键处理
     */
    private onKeyPressed = (keyCode: KeyCode): void => {
        // 【新增调试】记录所有按键
        console.log(`GameManager: 收到按键 ${keyCode}`);
        
        // 处理全局按键
        if (keyCode === KeyCode.KEY_T) {
            console.log('GameManager: 处理T键 - 切换模式');
            this.toggleGameMode();
            return;
        }

        if (keyCode === KeyCode.KEY_C) {
            this.showCacheInfo();
            return;
        }





        // 根据测试模式分发输入
        if (this.testMode) {
            this.handleEnemyInput(keyCode);
        } else {
            this.handlePlayerInput(keyCode);
        }
    }

    /**
     * 键盘按键松开处理
     */
    private onKeyReleased = (keyCode: KeyCode): void => {
        // 处理需要松开事件的全局按键
        // 例如：长按功能、连击检测等

        // 根据测试模式分发松开事件
        if (this.testMode) {
            this.handleEnemyKeyRelease(keyCode);
        } else {
            this.handlePlayerKeyRelease(keyCode);
        }
    }

    /**
     * 移动方向变化处理
     */
    private onMoveDirectionChanged = (direction: Vec2): void => {
        this.currentMoveDirection = direction.clone();
        this.isMoving = direction.length() > 0;

        // 如果停止移动，通知相应的控制器
        if (!this.isMoving) {
            if (this.testMode && this.enemyController) {
                const stopMethod = (this.enemyController as any).stopMovement;
                if (stopMethod && typeof stopMethod === 'function') {
                    stopMethod.call(this.enemyController);
                }
            } else if (!this.testMode && this.playerController) {
                const stopMethod = (this.playerController as any).stopMovement;
                if (stopMethod && typeof stopMethod === 'function') {
                    stopMethod.call(this.playerController);
                }
            }
        }
    }

    /**
     * 处理玩家输入
     */
    private handlePlayerInput(keyCode: KeyCode): void {
        if (!this.playerController) {
            // 尝试查找玩家控制器
            this.findPlayerController();
        }

        if (this.playerController) {
            // 将输入传递给玩家控制器
            const method = (this.playerController as any).handleInput;
            if (method && typeof method === 'function') {
                method.call(this.playerController, keyCode);
            }
        }
    }

    /**
     * 处理敌人输入
     */
    private handleEnemyInput(keyCode: KeyCode): void {
        if (!this.enemyController) {
            this.findEnemyController();
        }

        if (this.enemyController) {
            const method = (this.enemyController as any).handleInput;
            if (method && typeof method === 'function') {
                method.call(this.enemyController, keyCode);
            }
        }
    }

    /**
     * 处理玩家按键松开
     */
    private handlePlayerKeyRelease(keyCode: KeyCode): void {
        if (!this.playerController) {
            this.findPlayerController();
        }

        if (this.playerController) {
            const method = (this.playerController as any).handleKeyRelease;
            if (method && typeof method === 'function') {
                method.call(this.playerController, keyCode);
            }
        }
    }

    /**
     * 处理敌人按键松开
     */
    private handleEnemyKeyRelease(keyCode: KeyCode): void {
        if (!this.enemyController) {
            this.findEnemyController();
        }

        if (this.enemyController) {
            const method = (this.enemyController as any).handleKeyRelease;
            if (method && typeof method === 'function') {
                method.call(this.enemyController, keyCode);
            }
        }
    }

    /**
     * 查找玩家控制器
     */
    private findPlayerController(): void {
        // 尝试在场景中查找玩家控制器
        const playerNodes = director.getScene()?.getComponentsInChildren('PlayerController');
        if (playerNodes && playerNodes.length > 0) {
            this.playerController = playerNodes[0];
            console.log('GameManager: Found PlayerController');
        }
    }

    /**
     * 查找敌人控制器
     */
    private findEnemyController(): void {
        // 尝试在场景中查找敌人控制器
        const enemyNodes = director.getScene()?.getComponentsInChildren('NormalEnemy');
        if (enemyNodes && enemyNodes.length > 0) {
            this.enemyController = enemyNodes[0];
            console.log('GameManager: Found NormalEnemy controller');
        }
    }

    /**
     * 注册控制器
     */
    public registerPlayerController(controller: Component): void {
        this.playerController = controller;
        console.log('GameManager: PlayerController registered');
    }

    /**
     * 注册敌人控制器（用于手动测试）
     */
    public registerEnemyController(controller: Component): void {
        this.enemyController = controller;
        console.log('GameManager: EnemyController for manual test registered');
    }

    /**
     * 切换测试模式（简化版，仅用于控制切换）
     */
    private toggleGameMode(): void {
        // 在两种模式间切换
        if (this.normalMode) {
            this.setMode(false, true);  // 切换到手动测试
        } else { // Was manualTestMode
            this.setMode(true, false);  // 切换到正常模式
        }

        // 切换模式时停止当前移动
        this.currentMoveDirection.set(0, 0);
        this.isMoving = false;

        const currentMode = this.normalMode ? '正常模式' : '手动测试模式';
        console.log(`GameManager: 切换到 ${currentMode}`);
        
        // 清理之前的状态
        this.clearTestEnemy();
        
        // 根据新模式设置场景
        if (this.manualTestMode) {
            this.initTestMode(); // 切换到手动测试时，初始化
            console.log('GameManager: 控制切换到怪物。按T键切换回玩家控制。');
        } else {
            console.log('GameManager: 控制切换到玩家。按T键切换到怪物控制。');
            // 切换回正常模式时，重新加载所选关卡
            this.startSelectedLevel();
        }
    }

    /**
     * 获取当前移动方向
     */
    public getCurrentMoveDirection(): Vec2 {
        return this.currentMoveDirection.clone();
    }

    /**
     * 检查是否正在移动
     */
    public isCurrentlyMoving(): boolean {
        return this.isMoving;
    }

    async initManagers() {
        console.log(`GameManager initializing - 测试模式: ${this.testMode ? '启用' : '禁用'}...`);

        // 初始化InputManager
        const inputMgr = inputManager.instance; // 获取InputManager实例
        if (!inputMgr) {
            console.warn('GameManager: InputManager not found. Please add InputManager component to a node in the scene.');
        }

        // 设置资源预加载配置
        resourceManager.setPreloadConfig({
            data: ['data/enemies', 'data/levels', 'data/skills'], // skills.json 确实存在
            textures: [], // 暂时移除所有纹理预加载，避免路径问题
            prefabs: [] // 预制体将通过新的批量加载系统管理
        });

        // 执行资源预加载
        await resourceManager.preloadResources();

        // 异步加载所有配置数据
        await dataManager.loadAllData();

        // 初始化关卡管理器
        await levelManager.initialize();

        // 【关键修复】检查并启用物理引擎
        this.checkAndEnablePhysicsEngine();

        // 设置物理碰撞组
        if (PhysicsSystem2D.instance) {
            setupPhysicsGroupCollisions();
        } else {
            console.error('GameManager: PhysicsSystem2D实例不存在，无法设置碰撞关系');
        }

        // 【修复初始化顺序】预先注册 BaseCharacterDemo 类到对象池工厂
        // 这样确保在对象池初始化时类已经可用，避免"类未注册"错误
        CharacterPoolFactory.registerBaseCharacterClass(BaseCharacterDemo);
        console.log('[GameManager] ✅ 预先注册 BaseCharacterDemo 类到对象池工厂');

        // 注册挂载的预制体到对象池
        this.registerMountedPrefabs();

        // 【关键修复】提前初始化目标选择器，确保在角色生成前可用
        this.initializeTargetSelector();
        
        // 初始化拥挤系统
        this.initializeCrowdingSystem();
        
        // 初始化伤害文字池系统
        poolManager.initializeDamageTextPool();
        
        // 根据模式启动关卡或测试（在TargetSelector初始化后）
        if (this.normalMode) {
            await this.startSelectedLevel();
        }
        
        // 打印伤害文字池状态
        const damagePoolStats = poolManager.getDamageTextPoolStats();
        console.log('GameManager: 伤害文字池状态', damagePoolStats);

        // 数据加载完成后，可以通知其他模块进行初始化
        eventManager.emit(GameEvents.GAME_DATA_LOADED);
        
        // 检查资源引用完整性
        this.checkResourceIntegrity();
        
        // 初始化测试模式
        console.log(`GameManager: 检查测试模式状态 - testMode: ${this.testMode}`);
        if (this.manualTestMode) {
            console.log('GameManager: 开始初始化测试模式...');
            this.initTestMode();
        } else {
            console.log('GameManager: 正常模式，由关卡管理器控制');
        }
        
        console.log("GameManager initialized.");
        

    }

    public get gameState(): GameState {
        return this._gameState;
    }

    public set gameState(newState: GameState) {
        if (this._gameState === newState) return;

        this._gameState = newState;
        eventManager.emit(GameEvents.GAME_STATE_CHANGED, newState);
        console.log(`Game state changed to: ${GameState[newState]}`);
    }

    public startGame() {
        this.gameState = GameState.Playing;
        // 这里可以添加加载游戏场景的逻辑
        // director.loadScene('Game');

        // 可以在这里启动默认关卡
        this.startSelectedLevel();
    }

    /**
     * 启动选择的关卡
     */
    public async startSelectedLevel() {
        try {
            // 如果已有活动关卡，先结束
            if (levelManager.isLevelActive()) {
                await levelManager.endLevel();
            }
            console.log(`GameManager: Starting level ${this.selectedLevelId}...`);
            await levelManager.startLevel(this.selectedLevelId);
        } catch (error) {
            console.error(`GameManager: Failed to start level ${this.selectedLevelId}`, error);
        }
    }

    /**
     * 注册挂载的预制体到对象池
     */
    private registerMountedPrefabs(): void {
        console.log(`GameManager: 开始注册挂载的预制体到对象池...`);
        
        if (this.manualTestMode) {
            // 手动测试模式：注册所有敌人类型到对象池
            console.log(`GameManager: 当前为手动测试模式，注册所有敌人类型`);
            this.registerAllEnemyTypesToPool();
        } else {
            // 正常模式：只注册基础预制体，敌人由levelManager按需加载
            console.log(`GameManager: 当前为正常模式，只注册基础敌人类型`);
            this.registerBasicPrefabs();
        }
    }

    /**
     * 测试模式：注册所有敌人类型到对象池
     */
    private registerAllEnemyTypesToPool(): void {
        console.log('🧪 测试模式：注册所有敌人类型到对象池...');
        
        let successCount = 0;
        let totalCount = 0;

        // 注册通用敌人预制体到所有敌人类型的对象池（包括巫妖）
        if (this.entPrefab) {
            const allEnemyTypes = [
                'ent_normal', 'ent_elite', 'ent_boss',
                'lich_normal', 'lich_elite', 'lich_boss',  // 巫妖现在也使用通用预制体
                'skeleton_normal', 'skeleton_elite', 'skeleton_boss',
                'orc_normal', 'orc_elite', 'orc_boss',
                'goblin_normal', 'goblin_elite', 'goblin_boss',
                'slime_normal', 'slime_fire', 'slime_ice', 'slime_bomb',
                'slime_ghost', 'slime_lightning', 'slime_crystal', 'slime_devil', 'slime_lava',
                'golem_normal', 'golem_elite', 'golem_boss'
            ];
            
            const getPoolConfig = (enemyType: string) => {
                if (enemyType.includes('normal') || enemyType.startsWith('slime_')) {
                    return { maxSize: 30, preloadCount: 5 };
                } else if (enemyType.includes('elite')) {
                    return { maxSize: 15, preloadCount: 3 };
                } else if (enemyType.includes('boss')) {
                    return { maxSize: 5, preloadCount: 1 };
                } else {
                    return { maxSize: 20, preloadCount: 3 };
                }
            };
            
            for (const enemyType of allEnemyTypes) {
                totalCount++;
                const config = getPoolConfig(enemyType);
                const success = resourceManager.registerMountedPrefabToPool(
                    enemyType,
                    this.entPrefab,
                    {
                        poolName: enemyType,
                        maxSize: config.maxSize,
                        preloadCount: config.preloadCount
                    }
                );
                if (success) {
                    successCount++;
                    console.log(`✅ GameManager: 通用敌人预制体注册到 ${enemyType} 池成功`);
                } else {
                    console.error(`❌ GameManager: 通用敌人预制体注册到 ${enemyType} 池失败`);
                }
            }
        } else {
            console.warn('⚠️ GameManager: 未挂载通用敌人预制体');
        }

        // 注册火球预制体
        this.registerFireballPrefab();

        console.log(`🧪 测试模式预制体注册完成 - 成功: ${successCount}/${totalCount}`);
    }

    /**
     * 正常模式：根据选择的关卡注册所需的敌人类型
     */
    private registerBasicPrefabs(): void {
        console.log('🎮 正常模式：根据关卡注册所需的敌人类型...');
        
        let successCount = 0;
        let totalCount = 0;

        if (!this.entPrefab) {
            console.warn('⚠️ GameManager: 未挂载通用敌人预制体');
            return;
        }

        // 【关键修复】获取选择关卡需要的所有敌人类型
        const requiredEnemyTypes = this.getRequiredEnemyTypesForLevel(this.selectedLevelId);
        
        if (requiredEnemyTypes.length === 0) {
            console.warn(`🎮 GameManager: 关卡 ${this.selectedLevelId} 没有配置敌人，只注册基础类型`);
            requiredEnemyTypes.push('ent_normal'); // 至少注册一个基础类型
        }

        console.log(`🎮 GameManager: 关卡 ${this.selectedLevelId} 需要敌人类型:`, requiredEnemyTypes);

        // 为关卡需要的每个敌人类型注册对象池
        for (const enemyType of requiredEnemyTypes) {
            totalCount++;
            const config = this.getPoolConfigByEnemyType(enemyType);
            const success = resourceManager.registerMountedPrefabToPool(
                enemyType,
                this.entPrefab,
                {
                    poolName: enemyType,
                    maxSize: config.maxSize,
                    preloadCount: config.preloadCount
                }
            );
            if (success) {
                successCount++;
                console.log(`✅ GameManager: 敌人预制体注册到 ${enemyType} 池成功`);
            } else {
                console.error(`❌ GameManager: 敌人预制体注册到 ${enemyType} 池失败`);
            }
        }

        // 注册火球预制体
        this.registerFireballPrefab();

        console.log(`🎮 正常模式预制体注册完成 - 成功: ${successCount}/${totalCount}`);
        console.log(`📌 已为关卡 ${this.selectedLevelId} 注册所有需要的敌人类型`);
    }

    /**
     * 注册火球预制体（测试模式和正常模式都需要）
     */
    private registerFireballPrefab(): void {
        if (this.firePrefab) {
            const success = resourceManager.registerMountedPrefabToPool(
                'fireball',
                this.firePrefab,
                {
                    poolName: 'fireball',
                    maxSize: 100,  // 大幅增加最大大小
                    preloadCount: 20  // 增加预加载数量
                }
            );
            if (success) {
                console.log('✅ GameManager: 火球预制体注册成功（优化配置：最大100，预加载20）');
            } else {
                console.error('❌ GameManager: 火球预制体注册失败');
            }
        } else {
            console.warn('⚠️ GameManager: 未挂载火球预制体');
        }
    }

    /**
     * 获取指定关卡需要的敌人类型
     * @param levelId 关卡ID
     * @returns 敌人类型数组
     */
    private getRequiredEnemyTypesForLevel(levelId: number): string[] {
        const enemyTypes = new Set<string>();
        
        try {
            // 从DataManager获取关卡数据
            const levelData = dataManager.getLevelData(levelId);
            if (!levelData) {
                console.warn(`GameManager: 未找到关卡 ${levelId} 的数据`);
                return [];
            }

            // 从新格式的monsterSpawners中提取
            if (levelData.monsterSpawners) {
                levelData.monsterSpawners.forEach(spawner => {
                    spawner.enemies?.forEach(enemy => {
                        enemyTypes.add(enemy.type);
                    });
                });
            }
            
            // 从旧格式的enemies中提取（兼容性）
            if (levelData.enemies) {
                levelData.enemies.forEach(enemy => {
                    enemyTypes.add(enemy.type);
                });
            }

            return Array.from(enemyTypes);
        } catch (error) {
            console.error(`GameManager: 获取关卡 ${levelId} 敌人类型失败`, error);
            return [];
        }
    }

    /**
     * 根据敌人类型获取对象池配置
     * @param enemyType 敌人类型
     * @returns 对象池配置
     */
    private getPoolConfigByEnemyType(enemyType: string): { maxSize: number; preloadCount: number } {
        if (enemyType.includes('normal') || enemyType.startsWith('slime_')) {
            return { maxSize: 30, preloadCount: 5 };
        } else if (enemyType.includes('elite')) {
            return { maxSize: 15, preloadCount: 3 };
        } else if (enemyType.includes('boss')) {
            return { maxSize: 5, preloadCount: 1 };
        } else {
            return { maxSize: 20, preloadCount: 3 };
        }
    }

    /**
     * 结束当前关卡
     */
    public async endCurrentLevel() {
        try {
            if (levelManager.isLevelActive()) {
                console.log('GameManager: Ending current level...');
                await levelManager.endLevel();
            }
        } catch (error) {
            console.error('GameManager: Failed to end current level', error);
        }
    }

    public pauseGame() {
        if (this.gameState !== GameState.Playing) return;
        this.gameState = GameState.Paused;
    }

    public resumeGame() {
        if (this.gameState !== GameState.Paused) return;
        this.gameState = GameState.Playing;
    }

    public endGame() {
        this.gameState = GameState.GameOver;
    }

    /**
     * 切换游戏模式
     * @param mode 新的游戏模式
     */
    public setGameMode(mode: GameMode) {
        if (this.gameMode === mode) return;

        const oldMode = this.gameMode;
        this.gameMode = mode;

        console.log(`Game mode changed from ${GameMode[oldMode]} to ${GameMode[mode]}`);
        eventManager.emit(GameEvents.GAME_MODE_CHANGED, mode, oldMode);
    }

    /**
     * 获取当前游戏模式
     */
    public getGameMode(): GameMode {
        return this.gameMode;
    }

    /**
     * 显示缓存信息
     */
    private showCacheInfo() {
        console.log('\n=== Animation Cache Info ===');

        if (levelManager.isLevelActive()) {
            const currentLevelId = levelManager.getCurrentLevelId();
            const currentLevel = levelManager.getCurrentLevel();

            console.log(`Current Level: ${currentLevelId} - ${currentLevel?.name}`);

            // 获取动画管理器的缓存信息
            const cacheInfo = animationManager.getLevelCacheInfo(currentLevelId);
            console.log(cacheInfo);
        } else {
            console.log('No active level');
        }

        console.log('=== End Cache Info ===\n');
    }

    // =================== 系统配置管理 ===================

    /**
     * 打印当前系统配置
     */
    public printSystemConfig(): void {
        systemConfigManager.printConfig();
    }

    /**
     * 打印伤害文字池状态
     */
    public printDamageTextPoolStats(): void {
        const stats = poolManager.getDamageTextPoolStats();
        console.log('=== 伤害文字池统计 ===');
        console.log(`池数量: ${stats.totalPools}`);
        console.log(`总节点数: ${stats.totalNodes}`);
        console.log(`活跃节点数: ${stats.activeNodes}`);
        console.log(`配置: ${JSON.stringify(stats.config, null, 2)}`);
        console.log('==================');
    }

    /**
     * 打印伤害显示频率控制器状态
     */
    public printDamageDisplayControllerStats(): void {
        const stats = damageDisplayController.getStats();
        console.log('=== 伤害显示频率控制器统计 ===');
        console.log(`当前窗口显示数量: ${stats.currentWindowCount}/${stats.maxPerWindow}`);
        console.log(`时间窗口: ${stats.timeWindow}秒`);
        console.log(`可以显示: ${stats.canDisplay ? '是' : '否'}`);
        console.log('=============================');
    }

    /**
     * 重置伤害显示频率控制器
     */
    public resetDamageDisplayController(): void {
        damageDisplayController.reset();
        console.log('伤害显示频率控制器已重置');
    }

    /**
     * 测试伤害显示频率控制（快速连续造成伤害，验证频率限制）
     */
    public testDamageDisplayRateLimit(): void {
        if (!this.currentTestEnemy || !this.currentTestEnemy.isValid) {
            console.warn('没有可用的测试怪物，无法测试伤害显示频率');
            return;
        }
        
        console.log('=== 开始测试伤害显示频率控制 ===');
        console.log('将在0.05秒内连续造成6次伤害，预期只显示前3个');
        
        const characterStats = this.currentTestEnemy.getComponent('CharacterStats') as any;
        if (!characterStats) {
            console.error('测试怪物没有CharacterStats组件');
            return;
        }
        
        // 快速连续造成6次伤害，每次间隔0.01秒
        for (let i = 0; i < 6; i++) {
            setTimeout(() => {
                const damage = (i + 1) * 10; // 10, 20, 30, 40, 50, 60
                console.log(`测试伤害 #${i + 1}: ${damage}点伤害`);
                
                // 直接调用takeDamage，这会触发showDamageText
                characterStats.takeDamage(damage);
                
                if (i === 5) {
                    // 最后一次伤害后，显示统计信息
                    setTimeout(() => {
                        this.printDamageDisplayControllerStats();
                        console.log('=== 伤害显示频率控制测试完成 ===');
                    }, 200);
                }
            }, i * 10); // 每10ms一次
        }
    }

    /**
     * 测试不同配置
     */
    public testDamageTextPoolConfigs(): void {
        console.log('GameManager: 开始测试不同的伤害文字池配置...');
        
        // 测试全量加载模式
        console.log('--- 测试全量加载模式 ---');
        systemConfigManager.updateConfig({
            poolSystem: {
                ...systemConfigManager.getPoolSystemConfig(),
                damageTextPool: {
                    ...systemConfigManager.getDamageTextPoolConfig(),
                    enableBatchLoading: false
                }
            }
        });
        
        // 清理并重新初始化
        poolManager.clearDamageTextPool();
        poolManager.initializeDamageTextPool();
        this.printDamageTextPoolStats();
        
        // 恢复默认配置
        console.log('--- 恢复默认配置 ---');
        systemConfigManager.resetToDefault();
        poolManager.clearDamageTextPool();
        poolManager.initializeDamageTextPool();
        this.printDamageTextPoolStats();
    }

    /**
     * 预热伤害文字池（高伤害范围）
     */
    public warmupHighDamagePool(): void {
        console.log('GameManager: 预热高伤害文字池（1000-5000）...');
        poolManager.warmupDamageTextPool(1000, 5000, 2); // 每个数值创建2个节点
        this.printDamageTextPoolStats();
    }

    /**
     * 清理无效的伤害文字节点
     */
    public cleanupDamageTextPool(): void {
        console.log('GameManager: 清理伤害文字池中的无效节点...');
        poolManager.cleanupInvalidDamageTextNodes();
        this.printDamageTextPoolStats();
    }

    /**
     * 监控活跃伤害文字节点（调试用）
     */
    public monitorActiveDamageNodes(): void {
        const stats = poolManager.getDamageTextPoolStats();
        console.log(`📊 伤害文字池实时状态:`);
        console.log(`- 活跃节点: ${stats.activeNodes}/${stats.totalNodes}`);
        console.log(`- 池使用率: ${((stats.activeNodes / stats.totalNodes) * 100).toFixed(1)}%`);
        
        // 如果活跃节点过多，建议清理
        if (stats.activeNodes > stats.totalNodes * 0.8) {
            console.warn('⚠️ 活跃节点过多，建议检查回收逻辑');
        }
    }

    /**
     * 确保预制体包含所有必要的组件（用于修复现有预制体）
     */
    public ensurePrefabComponents(): void {
        console.log('=== 检查和修复预制体组件 ===');
        
        // 检查ent预制体
        if (this.entPrefab) {
            const entNode = instantiate(this.entPrefab);
            console.log(`\n检查 ent 预制体组件:`);
            
            // 检查CharacterStats
            let characterStats = entNode.getComponent('CharacterStats');
            if (!characterStats) {
                console.warn('⚠️ ent预制体缺少CharacterStats组件');
                // 注意：在编辑器中需要手动添加组件到预制体
            } else {
                console.log('✅ CharacterStats组件存在');
            }
            
            // 检查HealthBarComponent
            let healthBar = entNode.getComponent('HealthBarComponent');
            if (!healthBar) {
                console.warn('⚠️ ent预制体缺少HealthBarComponent组件');
                // 注意：在编辑器中需要手动添加组件到预制体
            } else {
                console.log('✅ HealthBarComponent组件存在');
            }
            
            entNode.destroy();
        }
    }

    /**
     * 测试拥挤系统 - 生成多个同阵营角色验证拥挤效果
     */
    public testCrowdingSystem(): void {
        console.log('=== 开始测试拥挤系统 ===');
        
        if (!this.manualTestMode) {
            console.warn('拥挤系统测试需要在手动测试模式下进行');
            return;
        }

        // 清除现有测试怪物
        this.clearTestEnemy();

        // 生成5个同阵营的角色在相近位置
        const testPositions = [
            new Vec3(0, 0, 0),
            new Vec3(20, 10, 0),
            new Vec3(-15, 5, 0),
            new Vec3(10, -20, 0),
            new Vec3(-10, -10, 0)
        ];

        const enemyType = this.getEnemyTypeFromIndex(this.testEnemyType);
        console.log(`生成5个 ${enemyType} 角色测试拥挤效果`);

        testPositions.forEach((position, index) => {
            this.spawnTestEnemyAtPosition(enemyType, position, `test_crowd_${index}`);
        });

        // 打印拥挤系统状态
        setTimeout(() => {
            const crowdingSystem = getCrowdingSystem();
            if (crowdingSystem) {
                crowdingSystem.printStatusInfo();
            }
        }, 1000);

        console.log('=== 拥挤系统测试完成 ===');
        console.log('观察角色是否会相互推开，避免重叠');
    }

    /**
     * 【网格优化】测试网格化拥挤系统性能
     */
    public testGridBasedCrowdingPerformance(): void {
        console.log('=== 🚀 网格化拥挤系统性能测试 ===');
        
        if (!this.manualTestMode) {
            console.warn('性能测试需要在手动测试模式下进行，请先切换模式');
            return;
        }

        // 清除现有测试怪物
        this.clearTestEnemy();

        // 重置性能统计
        const crowdingSystem = getCrowdingSystem();
        if (crowdingSystem) {
            crowdingSystem.resetPerformanceStats();
        }
        gridManager.reset();

        // 生成大量同阵营角色进行压力测试
        const testCount = 50; // 50个角色
        const testPositions: Vec3[] = [];
        const testRadius = 200; // 在200px半径内随机分布
        
        console.log(`生成 ${testCount} 个角色进行网格性能测试...`);

        // 生成随机位置
        for (let i = 0; i < testCount; i++) {
            const angle = (Math.PI * 2 * i) / testCount + Math.random() * 0.5;
            const radius = Math.random() * testRadius;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            testPositions.push(new Vec3(x, y, 0));
        }

        // 创建角色
        const createdCharacters: Node[] = [];
        testPositions.forEach((position, index) => {
            const enemyType = 'ent_normal'; // 使用轻量级角色
            const character = this.spawnTestEnemyAtPosition(enemyType, position, `perf_test_${index}`);
            if (character) {
                createdCharacters.push(character);
            }
        });

        console.log(`✅ 成功创建 ${createdCharacters.length} 个测试角色`);

        // 等待几秒让系统稳定，然后输出性能报告
        setTimeout(() => {
            this.printGridPerformanceReport();
            
            // 清理测试角色
            setTimeout(() => {
                console.log('🧹 清理测试角色...');
                createdCharacters.forEach(character => {
                    if (character && character.isValid) {
                        const demo = character.getComponent('BaseCharacterDemo');
                        if (demo && (demo as any).returnToPool) {
                            (demo as any).returnToPool();
                        }
                    }
                });
                console.log('✅ 性能测试完成，角色已清理');
            }, 3000);
        }, 5000);
    }

    /**
     * 【网格优化】打印网格性能报告
     */
    public printGridPerformanceReport(): void {
        console.log('\n=== 📊 网格化拥挤系统性能报告 ===');
        
        // 拥挤系统性能统计
        const crowdingSystem = getCrowdingSystem();
        if (crowdingSystem) {
            crowdingSystem.printStatusInfo();
        }
        
        // 网格管理器详细统计
        const gridStats = gridManager.getStats();
        console.log('\n🏗️ 网格详细统计:');
        console.log(`- 网格尺寸: 120px × 120px`);
        console.log(`- 总网格数: ${gridStats.totalGrids}`);
        console.log(`- 活跃网格数: ${gridStats.activeGrids}`);
        console.log(`- 网格利用率: ${gridStats.totalGrids > 0 ? ((gridStats.activeGrids / gridStats.totalGrids) * 100).toFixed(1) : 0}%`);
        console.log(`- 总角色数: ${gridStats.totalCharacters}`);
        console.log(`- 平均每网格角色数: ${gridStats.averageCharactersPerGrid.toFixed(2)}`);
        console.log(`- 最大单网格角色数: ${gridStats.maxCharactersInGrid}`);
        console.log(`- 查询总次数: ${gridStats.queryCount}`);
        
        // 性能效益分析
        const avgCharactersPerGrid = gridStats.averageCharactersPerGrid;
        const totalCharacters = gridStats.totalCharacters;
        
        console.log('\n⚡ 性能效益分析:');
        if (totalCharacters > 1) {
            const oldComplexity = totalCharacters * (totalCharacters - 1); // O(n²)
            const newComplexity = gridStats.queryCount * avgCharactersPerGrid; // O(k)
            const improvement = oldComplexity > 0 ? (oldComplexity / newComplexity).toFixed(1) : 'N/A';
            
            console.log(`- 传统方式计算量: ${oldComplexity} (O(n²))`);
            console.log(`- 网格方式计算量: ${newComplexity.toFixed(0)} (O(k))`);
            console.log(`- 性能提升倍数: ${improvement}x`);
            console.log(`- 内存使用: ${gridStats.totalGrids} 个网格 + ${totalCharacters} 个角色引用`);
        }
        
        console.log('\n💡 优化建议:');
        if (gridStats.maxCharactersInGrid > 20) {
            console.log('- ⚠️ 某些网格角色过多，考虑减小网格尺寸');
        }
        if (gridStats.averageCharactersPerGrid < 2) {
            console.log('- ⚠️ 网格利用率较低，考虑增大网格尺寸');
        }
        if (gridStats.activeGrids / gridStats.totalGrids < 0.3) {
            console.log('- ✅ 网格分布合理，空间利用效率良好');
        }
        
        console.log('=====================================\n');
    }

    /**
     * 【网格优化】启用网格可视化调试
     */
    public enableGridVisualization(): void {
        console.log('🔍 启用网格可视化调试...');
        
        const visualData = gridManager.getGridVisualizationData();
        console.log(`📊 当前有 ${visualData.length} 个活跃网格:`);
        
        visualData.forEach(grid => {
            const worldX = grid.x * 120; // CELL_SIZE = 120
            const worldY = grid.y * 120;
            console.log(`  网格 ${grid.key}: 世界坐标(${worldX}, ${worldY}), 角色数: ${grid.count}`);
        });
        
        // 打印网格热点分析
        if (visualData.length > 0) {
            const maxCount = Math.max(...visualData.map(g => g.count));
            const hotGrids = visualData.filter(g => g.count === maxCount);
            
            console.log(`🔥 热点网格分析:`);
            console.log(`- 最大角色数: ${maxCount}`);
            console.log(`- 热点网格数: ${hotGrids.length}`);
            hotGrids.forEach(grid => {
                const worldX = grid.x * 120;
                const worldY = grid.y * 120;
                console.log(`  🔥 热点 ${grid.key}: (${worldX}, ${worldY})`);
            });
        }
    }

    /**
     * 【网格优化】对比测试：传统模式 vs 网格模式
     */
    public compareTraditionalVsGridPerformance(): void {
        console.log('=== ⚖️ 传统模式 vs 网格模式性能对比 ===');
        
        if (!this.manualTestMode) {
            console.warn('性能对比测试需要在手动测试模式下进行');
            return;
        }

        // 模拟传统O(n²)算法的计算量
        const characterCount = gridManager.getStats().totalCharacters;
        if (characterCount < 5) {
            console.warn('角色数量太少，请先创建更多角色进行有意义的对比');
            return;
        }

        console.log(`📊 当前角色数量: ${characterCount}`);
        
        // 计算理论复杂度
        const traditionalComplexity = characterCount * (characterCount - 1);
        const gridComplexity = gridManager.getStats().queryCount * gridManager.getStats().averageCharactersPerGrid;
        
        console.log('\n📈 算法复杂度对比:');
        console.log(`传统遍历法: O(n²) = ${traditionalComplexity} 次计算`);
        console.log(`网格查询法: O(k) ≈ ${gridComplexity.toFixed(0)} 次计算`);
        
        if (traditionalComplexity > 0) {
            const improvement = traditionalComplexity / gridComplexity;
            console.log(`🚀 理论性能提升: ${improvement.toFixed(1)}x`);
            
            // 性能等级评估
            if (improvement > 10) {
                console.log('🏆 性能等级: 优秀 (>10x提升)');
            } else if (improvement > 5) {
                console.log('🥈 性能等级: 良好 (5-10x提升)');
            } else if (improvement > 2) {
                console.log('🥉 性能等级: 一般 (2-5x提升)');
            } else {
                console.log('⚠️ 性能等级: 需优化 (<2x提升)');
            }
        }
        
        // 内存使用对比
        const gridMemory = gridManager.getStats().totalGrids * 32 + characterCount * 16; // 估算字节
        const traditionalMemory = characterCount * 8; // 简单数组
        
        console.log('\n💾 内存使用对比:');
        console.log(`传统方式: ~${traditionalMemory} 字节`);
        console.log(`网格方式: ~${gridMemory} 字节`);
        console.log(`内存开销: ${(gridMemory / traditionalMemory).toFixed(1)}x`);
        
        // 推荐使用场景
        console.log('\n💡 推荐使用场景:');
        if (characterCount > 20) {
            console.log('✅ 角色数量较多，强烈推荐使用网格优化');
        } else if (characterCount > 10) {
            console.log('✅ 角色数量中等，推荐使用网格优化');
        } else {
            console.log('⚪ 角色数量较少，网格优化效果有限');
        }
        
        console.log('==========================================\n');
    }

    /**
     * 【网格优化】动态调整网格参数测试
     */
    public testDynamicGridParameters(): void {
        console.log('=== 🔧 动态网格参数测试 ===');
        
        const currentStats = gridManager.getStats();
        console.log(`当前状态: ${currentStats.totalCharacters} 个角色，${currentStats.activeGrids} 个活跃网格`);
        
        if (currentStats.totalCharacters < 10) {
            console.warn('角色数量太少，请先创建更多角色进行参数测试');
            return;
        }
        
        // 分析当前网格密度
        const avgDensity = currentStats.averageCharactersPerGrid;
        const maxDensity = currentStats.maxCharactersInGrid;
        
        console.log('\n📊 当前网格密度分析:');
        console.log(`平均密度: ${avgDensity.toFixed(2)} 角色/网格`);
        console.log(`最大密度: ${maxDensity} 角色/网格`);
        
        // 给出调优建议
        console.log('\n💡 参数调优建议:');
        
        if (avgDensity > 8) {
            console.log('📏 建议减小网格尺寸 (当前120px → 建议80px)');
            console.log('   原因: 网格密度过高，影响查询效率');
        } else if (avgDensity < 2) {
            console.log('📏 建议增大网格尺寸 (当前120px → 建议160px)');
            console.log('   原因: 网格密度过低，空间浪费');
        } else {
            console.log('✅ 当前网格尺寸 (120px) 较为合适');
        }
        
        if (maxDensity > 15) {
            console.log('⚠️ 存在热点网格，考虑增加拥挤半径限制');
        }
        
        if (currentStats.activeGrids / currentStats.totalGrids > 0.8) {
            console.log('📈 网格利用率很高，系统运行高效');
        }
        
        console.log('================================\n');
    }

    /**
     * 在指定位置生成测试敌人
     */
    private spawnTestEnemyAtPosition(enemyType: string, position: Vec3, characterId?: string): Node | null {
        const factory = CharacterPoolFactory.getInstance();
        
        const character = factory.createCharacter(enemyType, {
            characterId: characterId || `${enemyType}_${Date.now()}`,
            position: position,
            controlMode: ControlMode.AI,
            aiFaction: 'red', // 同阵营测试
            aiBehaviorType: 'melee'
        });

        if (character) {
            console.log(`✅ 在位置 (${position.x}, ${position.y}) 生成角色: ${characterId}`);
            return character.node;
        } else {
            console.error(`❌ 在位置 (${position.x}, ${position.y}) 生成角色失败`);
            return null;
        }
    }

    /**
     * 初始化测试模式
     */
    private initTestMode(): void {
        console.log('🧪 [测试模式] 初始化角色对象池系统...');
        
        // 初始化所有角色对象池（测试模式）
        CharacterPoolInitializer.initializeAllPools();
        
        // 打印对象池状态
        this.printPoolStatus();
        
        // 自动生成默认测试怪物
        this.spawnTestEnemy(this.getEnemyTypeFromIndex(this.testEnemyType));
    }

    /**
     * 生成测试怪物
     * @param enemyType 怪物类型
     */
    public spawnTestEnemy(enemyType: string): void {
        // 【修复】此方法仅用于手动测试模式
        if (!this.manualTestMode) {
            console.warn(`GameManager: spawnTestEnemy只应在手动测试模式下使用。当前模式为正常模式，敌人生成由MonsterSpawner负责。`);
            return;
        }

        console.log(`🧪 手动测试模式：生成可控制的测试怪物: ${enemyType}`);
        
        // 清除之前的测试怪物
        this.clearTestEnemy();
        
        // 获取敌人数据
        const enemyData = dataManager.getEnemyData(enemyType);
        if (!enemyData) {
            console.error(`找不到怪物类型: ${enemyType}`);
            return;
        }

        // 使用新的对象池系统创建手动控制的角色
        const testPosition = new Vec3(0, 0, 0); // 屏幕中心
        const character = BaseCharacterDemo.createPlayer(enemyType, testPosition);
        
        if (!character) {
            console.error(`❌ 无法从新对象池系统创建怪物: ${enemyType}`);
            return;
        }

        console.log(`🎮 手动测试模式：创建手动控制角色: ${enemyType}`);

        const enemyInstance = character.node;
        
        // 角色已经在创建时设置了位置，确保激活状态
        enemyInstance.active = true;
        console.log(`🎯 测试怪物位置: (${testPosition.x}, ${testPosition.y})`);
        
        // 找到合适的父节点 - 优先使用Canvas
        let parentNode = null;
        
        // 方法1: 查找Canvas节点
        const scene = director.getScene();
        if (scene) {
            const canvas = scene.getComponentInChildren('cc.Canvas');
            if (canvas && canvas.node) {
                parentNode = canvas.node;
                console.log('🖼️ 使用Canvas作为父节点');
            } else {
                // 方法2: 查找名为Canvas的节点
                parentNode = scene.getChildByName('Canvas');
                if (parentNode) {
                    console.log('🖼️ 找到Canvas节点');
                } else {
                    // 方法3: 使用场景根节点
                    parentNode = scene;
                    console.log('🏠 使用场景根节点');
                }
            }
        }
        
        if (parentNode) {
            parentNode.addChild(enemyInstance);
            enemyInstance.setSiblingIndex(1000); // 置顶显示
            console.log(`📍 测试怪物已添加到: ${parentNode.name}`);
        } else {
            console.error('❌ 找不到合适的父节点');
        }
        
        this.currentTestEnemy = enemyInstance;
        // 更新testEnemyType为对应的索引
        const typeIndex = this.availableEnemyTypes.indexOf(enemyType);
        if (typeIndex !== -1) {
            this.testEnemyType = typeIndex;
        }
        
        const modeStr = this.manualTestMode ? '手动控制' : 'AI控制';
        console.log(`✅ 测试怪物已生成: ${enemyData.name} (血量: ${enemyData.baseHealth}) - ${modeStr}`);
        
        // 检查血条配置
        const healthBarComponent = enemyInstance.getComponent('HealthBarComponent') as any;
        if (healthBarComponent) {
            const healthData = healthBarComponent.getHealthData();
            console.log(`📊 血条数据: ${healthData.current}/${healthData.max}`);
        }
        
        console.log('🎮 手动测试模式操作说明:');
        console.log('  - WASD: 移动怪物');
        console.log('  - J: 攻击');
        console.log('  - H: 受伤测试');
        console.log('  - K: 死亡测试');
    }

    /**
     * 清除当前测试怪物
     */
    public clearTestEnemy(): void {
        if (this.currentTestEnemy && this.currentTestEnemy.isValid) {
            // 检查是否是新对象池系统创建的角色
            const characterDemo = this.currentTestEnemy.getComponent('BaseCharacterDemo');
            if (characterDemo && (characterDemo as any).getIsFromPool && (characterDemo as any).getIsFromPool()) {
                // 使用新对象池系统回收
                (characterDemo as any).returnToPool();
                console.log('🗑️ 测试怪物已通过新对象池系统回收');
            } else {
                // 使用旧对象池系统回收
                poolManager.put(this.currentTestEnemy);
                console.log('🗑️ 测试怪物已通过旧对象池系统回收');
            }
        }
        this.currentTestEnemy = null;
    }

    /**
     * 切换测试怪物类型
     * @param enemyType 新的怪物类型
     */
    public switchTestEnemy(enemyType: string): void {
        if (this.availableEnemyTypes.indexOf(enemyType) === -1) {
            console.error(`无效的怪物类型: ${enemyType}`);
            console.log('可用类型:', this.availableEnemyTypes.join(', '));
            return;
        }
        
        this.spawnTestEnemy(enemyType);
    }

    /**
     * 对测试怪物造成伤害
     * @param damage 伤害值
     */
    public damageTestEnemy(damage: number): void {
        if (!this.currentTestEnemy || !this.currentTestEnemy.isValid) {
            console.warn('没有可用的测试怪物');
            return;
        }
        
        const characterStats = this.currentTestEnemy.getComponent('CharacterStats') as any;
        if (characterStats) {
            const beforeHealth = characterStats.currentHealth;
            const result = characterStats.takeDamage(damage);
            const afterHealth = characterStats.currentHealth;
            
            console.log(`💥 造成伤害: ${damage}, 血量: ${beforeHealth} -> ${afterHealth}`);
            
            if (result.isDead) {
                console.log('💀 测试怪物死亡');
                // 延迟清除，让死亡动画播放完
                setTimeout(() => {
                    this.clearTestEnemy();
                }, 2000);
            }
        } else {
            console.error('测试怪物没有CharacterStats组件');
        }
    }

    /**
     * 治疗测试怪物
     * @param healAmount 治疗量
     */
    public healTestEnemy(healAmount: number): void {
        if (!this.currentTestEnemy || !this.currentTestEnemy.isValid) {
            console.warn('没有可用的测试怪物');
            return;
        }
        
        const characterStats = this.currentTestEnemy.getComponent('CharacterStats') as any;
        if (characterStats) {
            const beforeHealth = characterStats.currentHealth;
            characterStats.heal(healAmount);
            const afterHealth = characterStats.currentHealth;
            
            console.log(`💚 治疗: ${healAmount}, 血量: ${beforeHealth} -> ${afterHealth}`);
        } else {
            console.error('测试怪物没有CharacterStats组件');
        }
    }

    /**
     * 获取可用的怪物类型列表
     */
    public getAvailableEnemyTypes(): string[] {
        return [...this.availableEnemyTypes];
    }

    /**
     * 根据敌人类型字符串设置测试敌人类型
     * @param enemyType 敌人类型字符串
     * @returns 是否设置成功
     */
    public setTestEnemyType(enemyType: string): boolean {
        const index = this.availableEnemyTypes.indexOf(enemyType);
        if (index !== -1) {
            this.testEnemyType = index;
            console.log(`GameManager: 设置测试敌人类型为 ${enemyType} (索引: ${index})`);
            return true;
        } else {
            console.error(`GameManager: 无效的敌人类型: ${enemyType}`);
            console.log('可用类型:', this.availableEnemyTypes.join(', '));
            return false;
        }
    }

    /**
     * 获取当前测试敌人类型
     * @returns 当前敌人类型字符串
     */
    public getCurrentTestEnemyType(): string {
        return this.getEnemyTypeFromIndex(this.testEnemyType);
    }

    /**
     * 切换到下一个敌人类型
     */
    public switchToNextEnemyType(): void {
        const nextIndex = (this.testEnemyType + 1) % this.availableEnemyTypes.length;
        this.testEnemyType = nextIndex;
        const enemyType = this.getEnemyTypeFromIndex(nextIndex);
        console.log(`GameManager: 切换到下一个敌人类型: ${enemyType} (${nextIndex}/${this.availableEnemyTypes.length - 1})`);
        
        // 如果测试模式启用，自动切换测试怪物
        if (this.testMode) {
            this.switchTestEnemy(enemyType);
        }
    }

    /**
     * 切换到上一个敌人类型
     */
    public switchToPreviousEnemyType(): void {
        const prevIndex = this.testEnemyType === 0 ? this.availableEnemyTypes.length - 1 : this.testEnemyType - 1;
        this.testEnemyType = prevIndex;
        const enemyType = this.getEnemyTypeFromIndex(prevIndex);
        console.log(`GameManager: 切换到上一个敌人类型: ${enemyType} (${prevIndex}/${this.availableEnemyTypes.length - 1})`);
        
        // 如果测试模式启用，自动切换测试怪物
        if (this.testMode) {
            this.switchTestEnemy(enemyType);
        }
    }

    /**
     * 移动测试怪物到指定位置
     * @param x X坐标
     * @param y Y坐标
     */
    public moveTestEnemy(x: number, y: number): void {
        if (!this.currentTestEnemy || !this.currentTestEnemy.isValid) {
            console.warn('没有可用的测试怪物');
            return;
        }
        
        this.currentTestEnemy.setPosition(x, y, 0);
        console.log(`🚀 测试怪物已移动到: (${x}, ${y})`);
    }

    /**
     * 将测试怪物移动到指定父节点下
     * @param parentName 父节点名称
     */
    public moveTestEnemyToParent(parentName: string): void {
        if (!this.currentTestEnemy || !this.currentTestEnemy.isValid) {
            console.warn('没有可用的测试怪物');
            return;
        }
        
        const scene = director.getScene();
        if (!scene) {
            console.error('找不到场景');
            return;
        }
        
        // 查找指定名称的节点
        const targetParent = scene.getChildByName(parentName);
        if (!targetParent) {
            console.error(`找不到名为 ${parentName} 的节点`);
            
            // 打印可用的节点名称
            console.log('可用的节点名称:');
            scene.children.forEach((child, index) => {
                console.log(`  ${index}: ${child.name}`);
            });
            return;
        }
        
        // 移动怪物到新父节点
        targetParent.addChild(this.currentTestEnemy);
        this.currentTestEnemy.setSiblingIndex(1000); // 置顶
        console.log(`📦 测试怪物已移动到节点: ${parentName}`);
    }

    /**
     * 打印对象池状态
     */
    public printPoolStatus(): void {
        console.log('\n=== 对象池状态 ===');
        
        // 检查所有可用的敌人类型对象池
        const allPools = [...this.availableEnemyTypes, 'fireball'];
        
        allPools.forEach(poolName => {
            const stats = poolManager.getStats(poolName) as any;
            if (stats && !Array.isArray(stats)) {
                console.log(`📦 ${poolName}: ${stats.size}/${stats.maxSize} (获取${stats.getCount}次, 放回${stats.putCount}次, 创建${stats.createCount}次)`);
            } else {
                console.log(`❌ ${poolName}: 池不存在`);
            }
        });
        
        console.log('==================\n');
    }

    /**
     * 打印场景节点树结构
     */
    public printSceneTree(): void {
        const scene = director.getScene();
        if (!scene) {
            console.error('找不到场景');
            return;
        }
        
        console.log('=== 场景节点树 ===');
        this.printNodeTree(scene, 0);
    }
    
    private printNodeTree(node: Node, depth: number): void {
        const indent = '  '.repeat(depth);
        console.log(`${indent}${node.name} (${node.children.length} children)`);
        
        node.children.forEach(child => {
            this.printNodeTree(child, depth + 1);
        });
    }

    /**
     * 检查资源引用完整性
     */
    public checkResourceIntegrity(): void {
        console.log('=== 检查资源引用完整性 ===');
        
        // 检查预制体资源完整性
        if (this.entPrefab) {
            console.log('✅ 通用敌人预制体已挂载');
        } else {
            console.error('❌ 通用敌人预制体未挂载');
        }
        
        if (this.firePrefab) {
            console.log('✅ 火球预制体已挂载');
        } else {
            console.error('❌ 火球预制体未挂载');
        }
        
        console.log('=== 资源检查完成 ===');
    }

    /**
     * 尝试自动修复资源问题
     */
    public async attemptResourceFix(): Promise<void> {
        console.log('=== 尝试自动修复资源问题 ===');
        
        try {
            // 如果预制体未挂载，尝试从 resources 加载
            if (!this.entPrefab) {
                console.log('尝试加载通用敌人预制体...');
                this.entPrefab = await resourceManager.loadResource('prefabs/enemies/ent', Prefab);
                if (this.entPrefab) {
                    console.log('✅ 通用敌人预制体加载成功');
                } else {
                    console.error('❌ 通用敌人预制体加载失败');
                }
            }
            
            if (!this.firePrefab) {
                console.log('尝试加载火球预制体...');
                this.firePrefab = await resourceManager.loadResource('prefabs/effects/fire', Prefab);
                if (this.firePrefab) {
                    console.log('✅ 火球预制体加载成功');
                } else {
                    console.error('❌ 火球预制体加载失败');
                }
            }
            
            // 重新注册修复后的预制体
            if (this.entPrefab || this.firePrefab) {
                console.log('重新注册修复后的预制体...');
                this.registerMountedPrefabs();
            }
            
            console.log('=== 资源修复完成 ===');
        } catch (error) {
            console.error('资源修复过程中出现错误:', error);
        }
    }
    
    /**
     * 初始化目标选择器（全局单例）
     */
    private initializeTargetSelector(): void {
        // 【修复】首先检查是否已有有效的单例实例
        const existingInstance = TargetSelector.getInstance();
        if (existingInstance && existingInstance.node && existingInstance.node.isValid) {
            console.log(`GameManager: TargetSelector单例已存在，位于 ${existingInstance.node.parent?.name || 'unknown'} 下`);
            return;
        }

        // 查找场景和Canvas节点
        const scene = director.getScene();
        if (!scene) {
            console.error('GameManager: 无法获取场景');
            return;
        }
        
        let canvasNode = scene.getChildByName('Canvas');
        if (!canvasNode) {
            // 如果找不到Canvas，尝试查找第一个Canvas组件
            const canvasComponent = scene.getComponentInChildren('Canvas');
            canvasNode = canvasComponent ? canvasComponent.node : null;
        }
        
        if (!canvasNode) {
            console.warn('GameManager: 未找到Canvas节点，将TargetSelector放在场景根级别');
            canvasNode = scene;
        }

        // 【修复】清理可能存在的重复TargetSelector节点
        const existingSelectors = canvasNode.children.filter(child => child.name === 'TargetSelector');
        if (existingSelectors.length > 0) {
            console.log(`GameManager: 清理 ${existingSelectors.length} 个重复的TargetSelector节点`);
            existingSelectors.forEach(node => {
                if (node.isValid) {
                    node.destroy();
                }
            });
        }

        // 创建新的TargetSelector节点
        const targetSelectorNode = new Node('TargetSelector');
        targetSelectorNode.addComponent(TargetSelector);
        canvasNode.addChild(targetSelectorNode);
        
        console.log(`GameManager: ✅ 全局TargetSelector已创建并添加到 ${canvasNode.name} 下`);
        console.log(`GameManager: 所有AI角色将共享此TargetSelector实例`);
    }

    /**
     * 初始化拥挤系统（全局单例）
     */
    private initializeCrowdingSystem(): void {
        // 检查是否已有有效的单例实例
        const existingInstance = getCrowdingSystem();
        if (existingInstance && existingInstance.node && existingInstance.node.isValid) {
            console.log(`GameManager: CrowdingSystem单例已存在，位于 ${existingInstance.node.parent?.name || 'unknown'} 下`);
            return;
        }

        // 查找场景和Canvas节点
        const scene = director.getScene();
        if (!scene) {
            console.error('GameManager: 无法获取场景');
            return;
        }
        
        let canvasNode = scene.getChildByName('Canvas');
        if (!canvasNode) {
            // 如果找不到Canvas，尝试查找第一个Canvas组件
            const canvasComponent = scene.getComponentInChildren('Canvas');
            canvasNode = canvasComponent ? canvasComponent.node : null;
        }
        
        if (!canvasNode) {
            console.warn('GameManager: 未找到Canvas节点，将CrowdingSystem放在场景根级别');
            canvasNode = scene;
        }

        // 清理可能存在的重复CrowdingSystem节点
        const existingSystems = canvasNode.children.filter(child => child.name === 'CrowdingSystem');
        if (existingSystems.length > 0) {
            console.log(`GameManager: 清理 ${existingSystems.length} 个重复的CrowdingSystem节点`);
            existingSystems.forEach(node => {
                if (node.isValid) {
                    node.destroy();
                }
            });
        }

        // 创建新的CrowdingSystem节点
        const crowdingSystemNode = new Node('CrowdingSystem');
        crowdingSystemNode.addComponent(CrowdingSystem);
        canvasNode.addChild(crowdingSystemNode);
        
        console.log(`GameManager: ✅ 全局CrowdingSystem已创建并添加到 ${canvasNode.name} 下`);
        console.log(`GameManager: 同阵营角色将通过此系统实现拥挤效果`);
    }
    
    /**
     * 设置模式（互斥）
     */
    private setMode(normal: boolean, manual: boolean): void {
        this.normalMode = normal;
        this.manualTestMode = manual;
    }
    
    /**
     * 强制模式互斥
     */
    private enforceModeMutex(): void {
        // 统计勾选的模式数量
        const isNormal = this.normalMode;
        const isManual = this.manualTestMode;

        if (isNormal && isManual) {
            // 如果都勾选了，默认保留正常模式
            this.setMode(true, false);
            console.warn('GameManager: 正常模式和手动测试模式不能同时启用，已默认切换到正常模式。');
        } else if (!isNormal && !isManual) {
            // 如果都没选，默认开启正常模式
            this.setMode(true, false);
            console.log('GameManager: 没有选择模式，默认启用正常模式');
        }
        
        const currentMode = this.normalMode ? '正常模式' : '手动测试模式';
        console.log(`GameManager: 当前模式 - ${currentMode}`);
    }

    /**
     * 调试物理分组映射问题
     */
    public debugPhysicsGroupMapping(): void {
        console.log('\n=== 🔍 物理分组映射调试 ===');
        
        // 1. 打印代码中的映射关系
        console.log('📋 代码中的阵营-物理分组映射:');
        
        // 2. 打印具体的数值
        console.log('🔢 具体数值映射:');
        console.log(`RED: ${(1 << 3)} (二进制: ${(1 << 3).toString(2)})`);
        console.log(`BLUE: ${(1 << 5)} (二进制: ${(1 << 5).toString(2)})`);
        console.log(`GREEN: ${(1 << 7)} (二进制: ${(1 << 7).toString(2)})`);
        console.log(`PURPLE: ${(1 << 9)} (二进制: ${(1 << 9).toString(2)})`);
        
        // 3. 检查当前测试怪物的分组（如果存在）
        if (this.currentTestEnemy && this.currentTestEnemy.isValid) {
            console.log('\n🎯 当前测试怪物信息:');
            const baseDemo = this.currentTestEnemy.getComponent('BaseCharacterDemo');
            if (baseDemo && (baseDemo as any).getCollisionInfo) {
                console.log((baseDemo as any).getCollisionInfo());
            }
            
            // 检查实际的物理分组
            const collider = this.currentTestEnemy.getComponent('cc.Collider2D') as any;
            const rigidbody = this.currentTestEnemy.getComponent('cc.RigidBody2D') as any;
            if (collider) {
                console.log(`实际碰撞体分组: ${collider.group}`);
            }
            if (rigidbody) {
                console.log(`实际刚体分组: ${rigidbody.group}`);
            }
        }
        
        // 4. 提示检查编辑器设置
        console.log('\n⚠️  请检查以下设置:');
        console.log('1. 打开 Cocos Creator 编辑器');
        console.log('2. 菜单栏 -> 项目 -> 项目设置');
        console.log('3. 选择"物理"选项卡');
        console.log('4. 检查"分组管理器"中的分组设置');
        console.log('5. 确保分组顺序为:');
        console.log('   Group 0: DEFAULT');
        console.log('   Group 1: PLAYER');
        console.log('   Group 2: PLAYER_PROJECTILE');
        console.log('   Group 3: RED ← 应该是红色');
        console.log('   Group 4: RED_PROJECTILE');
        console.log('   Group 5: BLUE ← 应该是蓝色');
        console.log('   Group 6: BLUE_PROJECTILE');
        console.log('   Group 7: GREEN ← 应该是绿色');
        console.log('   Group 8: GREEN_PROJECTILE');
        console.log('   ...');
        console.log('\n🎨 如果编辑器中的颜色与名称不匹配，请修改编辑器中的分组名称或颜色');
        console.log('=========================\n');
    }

    /**
     * 快速修复物理分组映射问题的建议
     */
    public suggestPhysicsGroupFix(): void {
        console.log('\n=== 🔧 物理分组修复建议 ===');
        console.log('问题：蓝色映射到绿色，红色映射到蓝色');
        console.log('\n方案1: 修改编辑器中的分组颜色');
        console.log('- 打开项目设置 -> 物理 -> 分组管理器');
        console.log('- 将Group 3的颜色改为红色');
        console.log('- 将Group 5的颜色改为蓝色');
        console.log('- 将Group 7的颜色改为绿色');
        
        console.log('\n方案2: 修改代码中的映射关系');
        console.log('- 如果编辑器中Group 3是蓝色，Group 5是绿色，Group 7是红色');
        console.log('- 则需要调整FactionManager中的映射表');
        
        console.log('\n⚠️  推荐使用方案1，保持代码清晰');
        console.log('======================\n');
    }

    /**
     * 检查并启用物理引擎
     */
    private checkAndEnablePhysicsEngine(): void {
        console.log('GameManager: 检查物理引擎状态...');
        
        // 检查PhysicsSystem2D是否存在
        const physicsSystem = PhysicsSystem2D.instance;
        if (!physicsSystem) {
            console.error('❌ GameManager: PhysicsSystem2D实例不存在！这通常意味着：');
            console.error('   1. 项目设置中physics-2d模块未启用');
            console.error('   2. 具体的物理引擎实现(如physics-2d-box2d)未启用');
            console.error('   3. 请检查项目设置 -> 功能剪裁 -> 物理系统');
            return;
        }
        
        // 检查物理引擎是否启用
        console.log(`✅ GameManager: PhysicsSystem2D实例存在`);
        console.log(`📊 GameManager: 物理引擎状态详情:`);
        console.log(`   - 重力: (${physicsSystem.gravity.x}, ${physicsSystem.gravity.y})`);
        console.log(`   - 时间步长: ${physicsSystem.fixedTimeStep}`);
        console.log(`   - 速度迭代: ${physicsSystem.velocityIterations}`);
        console.log(`   - 位置迭代: ${physicsSystem.positionIterations}`);
        
        // 强制启用物理引擎（如果支持）
        try {
            // 设置合适的物理参数以确保2D俯视角游戏正常工作
            physicsSystem.gravity = new Vec2(0, 0); // 2D俯视角游戏通常不需要重力
            console.log('🔧 GameManager: 已设置重力为(0,0)，适合2D俯视角游戏');
            
            // 输出碰撞矩阵状态
            if (physicsSystem.collisionMatrix) {
                console.log('📋 GameManager: 碰撞矩阵已配置');
            } else {
                console.warn('⚠️ GameManager: 碰撞矩阵未配置');
            }
        } catch (error) {
            console.error('❌ GameManager: 设置物理引擎参数失败', error);
        }
        
        console.log('✅ GameManager: 物理引擎检查完成');
    }

    /**
     * 【网格优化】完整的网格拥挤系统调试套件
     */
    public debugGridCrowdingSystem(): void {
        console.log('\n=== 🔧 网格拥挤系统调试套件 ===');
        console.log('可用的调试命令:');
        console.log('');
        console.log('📊 性能测试:');
        console.log('  GameManager.instance.testGridBasedCrowdingPerformance()');
        console.log('  - 生成50个角色进行压力测试');
        console.log('');
        console.log('📈 性能报告:');
        console.log('  GameManager.instance.printGridPerformanceReport()');
        console.log('  - 显示详细的性能统计');
        console.log('');
        console.log('🔍 可视化调试:');
        console.log('  GameManager.instance.enableGridVisualization()');
        console.log('  - 显示网格分布和热点');
        console.log('');
        console.log('⚖️ 性能对比:');
        console.log('  GameManager.instance.compareTraditionalVsGridPerformance()');
        console.log('  - 对比传统算法和网格算法');
        console.log('');
        console.log('🔧 参数调优:');
        console.log('  GameManager.instance.testDynamicGridParameters()');
        console.log('  - 分析并建议网格参数');
        console.log('');
        console.log('🧹 系统清理:');
        console.log('  gridManager.reset()');
        console.log('  crowdingSystem.resetPerformanceStats()');
        console.log('');
        console.log('📋 快速状态:');
        console.log('  crowdingSystem.printStatusInfo()');
        console.log('  gridManager.printDebugInfo()');
        console.log('================================\n');
    }

    /**
     * 【网格优化】快速性能检查
     */
    public quickGridPerformanceCheck(): void {
        const gridStats = gridManager.getStats();
        const crowdingSystem = getCrowdingSystem();
        
        console.log('\n=== ⚡ 快速性能检查 ===');
        console.log(`角色总数: ${gridStats.totalCharacters}`);
        console.log(`活跃网格: ${gridStats.activeGrids}`);
        console.log(`查询次数: ${gridStats.queryCount}`);
        
        if (crowdingSystem) {
            const crowdingStats = crowdingSystem.getPerformanceStats();
            console.log(`平均查询时间: ${crowdingStats.avgQueryTime.toFixed(2)}ms`);
        }
        
        if (gridStats.totalCharacters > 20) {
            console.log('⚠️  角色数量较多，建议观察性能');
        }
        
        if (gridStats.activeGrids > 100) {
            console.log('⚠️  活跃网格过多，可能需要优化网格大小');
        }
    }

    /**
     * 高级网格性能分析
     */
    public advancedGridPerformanceAnalysis(): void {
        const gridStats = gridManager.getStats();
        const crowdingSystem = getCrowdingSystem();
        
        console.log('\n=== 🔬 高级网格性能分析 ===');
        console.log('基础统计:');
        console.log(`  角色总数: ${gridStats.totalCharacters}`);
        console.log(`  活跃网格数: ${gridStats.activeGrids}`);
        console.log(`  查询总数: ${gridStats.queryCount}`);
        console.log(`  平均每网格角色数: ${gridStats.averageCharactersPerGrid.toFixed(2)}`);
        
        if (crowdingSystem) {
            const crowdingStats = crowdingSystem.getPerformanceStats();
            console.log('\n拥挤系统统计:');
            console.log(`  平均查询时间: ${crowdingStats.avgQueryTime.toFixed(2)}ms`);
            console.log(`  最大查询时间: ${crowdingStats.maxQueryTime.toFixed(2)}ms`);
            console.log(`  总查询次数: ${crowdingStats.totalQueries}`);
        }
        
        // 性能建议
        console.log('\n性能建议:');
        if (gridStats.averageCharactersPerGrid > 10) {
            console.log('  🔧 建议减小网格尺寸以均匀分布角色');
        }
        if (gridStats.queryCount > gridStats.totalCharacters * 2) {
            console.log('  🔧 查询频率过高，建议增加更新间隔');
        }
        
        // 实时性能监控建议
        console.log('\n实时监控:');
        console.log('  使用 gameManager.quickGridPerformanceCheck() 进行快速检查');
        console.log('  使用 gridManager.printDebugInfo() 查看详细网格信息');
        if (crowdingSystem) {
            console.log('  使用 getCrowdingSystem().printStatusInfo() 查看拥挤系统状态');
        }
    }

    /**
     * 深度系统性能分析（完整版）
     */
    public deepSystemPerformanceAnalysis(): void {
        console.log('\n=== 🏗️ 深度系统性能分析 ===');
        
        // 网格管理器分析
        const gridStats = gridManager.getStats();
        console.log('1. 网格管理器:');
        console.log(`   ✓ 角色总数: ${gridStats.totalCharacters}`);
        console.log(`   ✓ 活跃网格: ${gridStats.activeGrids} 个`);
        console.log(`   ✓ 网格密度: ${gridStats.averageCharactersPerGrid.toFixed(2)} 角色/网格`);
        console.log(`   ✓ 查询效率: ${gridStats.queryCount} 次查询`);
        
        // 拥挤系统分析
        const crowdingSystem = getCrowdingSystem();
        if (crowdingSystem) {
            const crowdingStats = crowdingSystem.getPerformanceStats();
            console.log('\n2. 拥挤系统:');
            console.log(`   ✓ 角色数量: ${crowdingStats.lastUpdateCharacterCount}`);
            console.log(`   ✓ 平均查询: ${crowdingStats.avgQueryTime.toFixed(2)}ms`);
            console.log(`   ✓ 峰值查询: ${crowdingStats.maxQueryTime.toFixed(2)}ms`);
            console.log(`   ✓ 总查询数: ${crowdingStats.totalQueries}`);
        }
        
        // 性能建议
        console.log('\n性能建议:');
        if (gridStats.averageCharactersPerGrid > 10) {
            console.log('  🔧 建议减小网格尺寸以均匀分布角色');
        }
        if (gridStats.queryCount > gridStats.totalCharacters * 2) {
            console.log('  🔧 查询频率过高，建议增加更新间隔');
        }
        
        // 实时性能监控建议
        console.log('\n实时监控:');
        console.log('  使用 gameManager.quickGridPerformanceCheck() 进行快速检查');
        console.log('  使用 gridManager.printDebugInfo() 查看详细网格信息');
        if (crowdingSystem) {
            console.log('  使用 getCrowdingSystem().printStatusInfo() 查看拥挤系统状态');
        }
    }

    /**
     * 【网格优化】停止实时监控
     */
    public stopGridMonitoring(): void {
        this.gridMonitoringActive = false;
        if (this.gridMonitoringInterval) {
            clearInterval(this.gridMonitoringInterval);
            this.gridMonitoringInterval = null;
        }
        console.log('🛑 网格系统实时监控已停止');
    }

    // 监控相关属性
    private gridMonitoringActive = false;
    private gridMonitoringInterval: any = null;
    /**
     * 启用拥挤系统
     */
    public enableCrowdingSystem(): void {
        const crowdingSystem = getCrowdingSystem();
        if (crowdingSystem) {
            crowdingSystem.enableCrowding();
            console.log('🟢 GameManager: 拥挤系统已启用');
        } else {
            console.warn('⚠️ GameManager: 拥挤系统实例不存在');
        }
    }

    /**
     * 禁用拥挤系统
     */
    public disableCrowdingSystem(): void {
        const crowdingSystem = getCrowdingSystem();
        if (crowdingSystem) {
            crowdingSystem.disableCrowding();
            console.log('🔴 GameManager: 拥挤系统已禁用');
        } else {
            console.warn('⚠️ GameManager: 拥挤系统实例不存在');
        }
    }

    /**
     * 切换拥挤系统启用状态
     */
    public toggleCrowdingSystem(): void {
        const crowdingSystem = getCrowdingSystem();
        if (crowdingSystem) {
            crowdingSystem.toggleCrowding();
            const status = crowdingSystem.isEnabled() ? '🟢 已启用' : '🔴 已禁用';
            console.log(`🔄 GameManager: 拥挤系统状态切换为 ${status}`);
        } else {
            console.warn('⚠️ GameManager: 拥挤系统实例不存在');
        }
    }

    /**
     * 获取拥挤系统启用状态
     */
    public isCrowdingSystemEnabled(): boolean {
        const crowdingSystem = getCrowdingSystem();
        if (crowdingSystem) {
            return crowdingSystem.isEnabled();
        }
        console.warn('⚠️ GameManager: 拥挤系统实例不存在');
        return false;
    }
}