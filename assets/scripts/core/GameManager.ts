// assets/scripts/core/GameManager.ts

import { _decorator, Component, Node, director, Enum, KeyCode, Vec2, Prefab, PhysicsSystem2D } from 'cc';
import { dataManager } from './DataManager';
import { eventManager } from './EventManager';
import { inputManager } from './InputManager';
import { poolManager } from './PoolManager';
import { systemConfigManager } from './SystemConfig';
import { resourceManager } from './ResourceManager';
import { GameEvents } from './GameEvents';
import { levelManager } from './LevelManager';
import { animationManager } from '../animation/AnimationManager';
import { instantiate } from 'cc';
import { AIConfig, AIBehaviorType } from './MonsterAI';
import { Faction } from '../configs/FactionConfig';
import { targetSelector } from './TargetSelector';
import { TargetSelector } from './TargetSelector';
import { UITransform } from 'cc';
import { setupPhysicsGroupCollisions } from '../configs/PhysicsConfig';

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
    // UniversalCharacterDemo 智能系统现在只需要两个预制体
    
    @property({
        type: Prefab,
        displayName: "通用敌人预制体 (必需)",
        tooltip: "用于所有敌人类型的基础模板\n包含基础动画、血条、攻击组件\nUniversalCharacterDemo 会根据敌人类型自动配置远程攻击能力"
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

        // 设置物理碰撞组
        if (PhysicsSystem2D.instance) {
            setupPhysicsGroupCollisions();
        }

        // 注册挂载的预制体到对象池
        this.registerMountedPrefabs();

        // 【关键修复】提前初始化目标选择器，确保在角色生成前可用
        this.initializeTargetSelector();
        
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
        
        // 输出修复建议
        const suggestions = this.getResourceFixSuggestions();
        if (suggestions.length > 0) {
            console.warn('⚠️ 发现资源配置问题，修复建议：');
            suggestions.forEach((suggestion, index) => {
                console.warn(`  ${index + 1}. ${suggestion}`);
            });
        }
        
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
                    maxSize: 30,
                    preloadCount: 5
                }
            );
            if (success) {
                console.log('✅ GameManager: 火球预制体注册成功');
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
     * 打印血条配置信息
     */
    public printHealthBarConfigs(): void {
        const configs = systemConfigManager.getHealthBarConfigs();
        console.log('=== 血条配置信息 ===');
        console.log('Lich血条:', configs.lich);
        console.log('Ent血条:', configs.ent);
        console.log('默认血条:', configs.default);
        console.log('================');
    }

    /**
     * 测试不同角色的血条配置
     */
    public testHealthBarConfigs(): void {
        console.log('=== 角色血条配置测试 ===');
        
        const testCharacters = ['LichAnimationDemo', 'EntAnimationDemo', 'UnknownCharacter'];
        testCharacters.forEach(charName => {
            const config = systemConfigManager.getHealthBarConfigForCharacter(charName);
            console.log(`${charName}: ${config.width}x${config.height} (Y偏移: ${config.offsetY}px)`);
        });
        
        console.log('====================');
    }

    /**
     * 测试血条配置的默认值系统
     */
    public testHealthBarDefaultConfigs(): void {
        console.log('=== 测试血条配置默认值系统 ===');
        
        // 测试不同类型的敌人配置
        const testCases = [
            { id: 'ent_normal', name: '小树人' },
            { id: 'ent_elite', name: '精英树人' },
            { id: 'lich_normal', name: '普通巫妖' },
            { id: 'goblin_normal', name: '哥布林' },
            { id: 'unknown_enemy', name: '未知敌人' }
        ];
        
        testCases.forEach(testCase => {
            console.log(`\n--- ${testCase.name} (${testCase.id}) ---`);
            
            // 测试有完整配置的敌人数据
            const fullEnemyData = {
                id: testCase.id,
                name: testCase.name,
                healthBar: { width: 50, height: 3, offsetY: 50 }
            };
            
            const configWithData = systemConfigManager.getHealthBarConfigFromEnemyData(fullEnemyData);
            console.log(`有配置时: ${configWithData.width}x${configWithData.height}, Y=${configWithData.offsetY}`);
            
            // 测试没有血条配置的敌人数据
            const simpleEnemyData = {
                id: testCase.id,
                name: testCase.name
            };
            
            const configWithoutData = systemConfigManager.getHealthBarConfigFromEnemyData(simpleEnemyData);
            console.log(`无配置时: ${configWithoutData.width}x${configWithoutData.height}, Y=${configWithoutData.offsetY}`);
        });
        
        console.log('\n=== 默认配置规则 ===');
        console.log('ent_normal/ent_elite: 40x2, Y=40');
        console.log('其他敌人: 32x2, Y=32');
        console.log('有配置时: 优先使用敌人配置');
        console.log('======================');
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
     * 初始化测试模式
     */
    private initTestMode(): void {
        
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
        console.log(`生成测试怪物: ${enemyType}`);
        
        // 清除之前的测试怪物
        this.clearTestEnemy();
        
        // 获取敌人数据
        const enemyData = dataManager.getEnemyData(enemyType);
        if (!enemyData) {
            console.error(`找不到怪物类型: ${enemyType}`);
            return;
        }
        
        // 从对象池获取怪物实例
        const enemyInstance = poolManager.getEnemyInstance(enemyType, enemyData);
        if (!enemyInstance) {
            console.error(`无法从对象池获取怪物: ${enemyType}`);
            return;
        }
        
        // 【关键修复】只在手动测试模式下设置控制模式
        const characterDemo = enemyInstance.getComponent('BaseCharacterDemo');
        if (characterDemo && this.manualTestMode) {
            // 只有手动测试模式才设置为手动控制
            (characterDemo as any).controlMode = 0; // ControlMode.MANUAL
            console.log(`🎮 [手动测试模式] 怪物 ${enemyInstance.name} 设置为手动控制`);
        }
        // 注意：正常模式下不在这里设置控制模式，交给 MonsterSpawner 处理

        // 【关键修复】确保UniversalCharacterDemo使用正确的敌人类型
        const universalDemo = enemyInstance.getComponent('UniversalCharacterDemo');
        if (universalDemo && (universalDemo as any).setEnemyType) {
            (universalDemo as any).setEnemyType(enemyType);
            console.log(`GameManager: 已为手动测试怪物设置敌人类型: ${enemyType}`);
        }
        
        // 设置为测试位置（屏幕中心）并置顶
        // 直接使用常见的屏幕中心坐标
        const testPosition = { x: 0, y: 0 }; // 适合大多数移动设备
        
        enemyInstance.setPosition(testPosition.x, testPosition.y, 0);
        console.log(`🎯 测试怪物位置: (${testPosition.x}, ${testPosition.y})`);
        enemyInstance.active = true;
        
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
        console.log('  - T: 切换模式');
    }

    /**
     * 清除当前测试怪物
     */
    public clearTestEnemy(): void {
        if (this.currentTestEnemy && this.currentTestEnemy.isValid) {
            // 回收到对象池
            poolManager.put(this.currentTestEnemy);
            console.log('🗑️ 测试怪物已清除');
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
            const isDead = characterStats.takeDamage(damage);
            const afterHealth = characterStats.currentHealth;
            
            console.log(`💥 造成伤害: ${damage}, 血量: ${beforeHealth} -> ${afterHealth}`);
            
            if (isDead) {
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
     * 测试生成所有敌人类型（调试用）
     */
    public testAllEnemyTypes(): void {
        console.log('\n=== 测试所有敌人类型生成 ===');
        
        const testResults: { [key: string]: boolean } = {};
        
        for (const enemyType of this.availableEnemyTypes) {
            try {
                // 获取敌人数据
                const enemyData = dataManager.getEnemyData(enemyType);
                if (!enemyData) {
                    console.error(`❌ ${enemyType}: 找不到敌人数据`);
                    testResults[enemyType] = false;
                    continue;
                }
                
                // 尝试从对象池获取实例
                const enemyInstance = poolManager.getEnemyInstance(enemyType, enemyData);
                if (enemyInstance) {
                    console.log(`✅ ${enemyType}: 成功从对象池获取实例`);
                    testResults[enemyType] = true;
                    
                    // 立即回收，避免占用太多内存
                    poolManager.put(enemyInstance);
                } else {
                    console.error(`❌ ${enemyType}: 无法从对象池获取实例`);
                    testResults[enemyType] = false;
                }
            } catch (error) {
                console.error(`❌ ${enemyType}: 生成失败`, error);
                testResults[enemyType] = false;
            }
        }
        
        // 统计结果
        let successCount = 0;
        let totalCount = 0;
        const failedTypes: string[] = [];
        
        for (const enemyType in testResults) {
            if (testResults.hasOwnProperty(enemyType)) {
                totalCount++;
                if (testResults[enemyType]) {
                    successCount++;
                } else {
                    failedTypes.push(enemyType);
                }
            }
        }
        
        console.log(`\n=== 测试结果统计 ===`);
        console.log(`成功: ${successCount}/${totalCount}`);
        
        if (failedTypes.length > 0) {
            console.log('\n失败的敌人类型:');
            failedTypes.forEach(enemyType => {
                console.log(`  - ${enemyType}`);
            });
        }
        
        console.log('=================\n');
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
     * 资源修复建议
     */
    public getResourceFixSuggestions(): string[] {
        const suggestions: string[] = [];
        
        if (!this.entPrefab) {
            suggestions.push('在编辑器中为GameManager组件挂载通用敌人预制体 (assets/resources/prefabs/enemies/ent.prefab)');
        }
        
        if (!this.firePrefab) {
            suggestions.push('在编辑器中为GameManager组件挂载火球预制体 (assets/resources/prefabs/effects/fire.prefab)');
        }
        
        return suggestions;
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
     * 调试命令：手动触发资源检查和修复
     */
    public debugResourceCheck(): void {
        console.log('\n=== 手动资源检查 ===');
        this.checkResourceIntegrity();
        
        const suggestions = this.getResourceFixSuggestions();
        if (suggestions.length > 0) {
            console.warn('\n修复建议:');
            suggestions.forEach((suggestion, index) => {
                console.warn(`  ${index + 1}. ${suggestion}`);
            });
            console.log('\n可以运行 GameManager.instance.attemptResourceFix() 尝试自动修复');
        } else {
            console.log('\n✅ 所有资源配置正常');
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
}