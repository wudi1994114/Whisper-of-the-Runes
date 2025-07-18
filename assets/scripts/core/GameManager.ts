// assets/scripts/core/GameManager.ts

import { _decorator, Component, Node, director, Enum, KeyCode, Vec2, Prefab } from 'cc';
import { dataManager } from './DataManager';
import { eventManager } from './EventManager';
import { inputManager } from './InputManager';
import { poolManager } from './PoolManager';
import { resourceManager } from './ResourceManager';
import { GameEvents } from './GameEvents';
import { PlayerController } from '../components/PlayerController';
import { NormalEnemy } from '../game/NormalEnemy';
import { levelManager } from './LevelManager';
import { animationManager } from '../animation/AnimationManager';

const { ccclass, property } = _decorator;

// 定义游戏状态枚举
export enum GameState {
    MainMenu,
    Playing,
    Paused,
    GameOver,
}

// 定义游戏模式枚举
export enum GameMode {
    Normal,    // 正常模式 - 玩家控制
    Testing,   // 测试模式 - 怪物控制
}

@ccclass('GameManager')
export class GameManager extends Component {
    public static instance: GameManager;

    @property({
        type: Enum(GameMode),
        tooltip: "游戏模式：正常模式或测试模式"
    })
    public gameMode: GameMode = GameMode.Normal;

    // ===== 预制体挂载区域 =====
    @property({
        type: Prefab,
        displayName: "小树精预制体",
        tooltip: "ent敌人预制体，用于所有非lich敌人类型"
    })
    public entPrefab: Prefab | null = null;

    @property({
        type: Prefab,
        displayName: "巫妖预制体", 
        tooltip: "lich敌人预制体，用于所有lich系列敌人"
    })
    public lichPrefab: Prefab | null = null;

    @property({
        type: Prefab,
        displayName: "火球预制体",
        tooltip: "火球技能预制体，用于火球术"
    })
    public firePrefab: Prefab | null = null;

    private _gameState: GameState = GameState.MainMenu;

    // 输入分发相关
    private playerController: any = null;
    private enemyController: any = null;

    // 移动控制
    private currentMoveDirection: Vec2 = new Vec2(0, 0);
    private isMoving: boolean = false;

    protected onLoad(): void {
        if (GameManager.instance) {
            this.destroy();
            return;
        }
        GameManager.instance = this;
        director.addPersistRootNode(this.node); // 设置为常驻节点，切换场景时不销毁
        // 加载所有player enemy level skill数据
        this.initManagers();
        this.setupInputDispatcher();
    }

    protected onDestroy(): void {
        // 清理事件监听
        eventManager.off(GameEvents.KEY_PRESSED, this.onKeyPressed);
        eventManager.off(GameEvents.MOVE_DIRECTION_CHANGED, this.onMoveDirectionChanged);

        // 结束当前关卡
        if (levelManager.isLevelActive()) {
            levelManager.endLevel().catch(error => {
                console.error('Failed to end level on destroy:', error);
            });
        }
    }

    protected update(deltaTime: number): void {
        // 更新对象池管理器
        poolManager.update();

        // 根据游戏模式处理移动
        if (this.isMoving && this.currentMoveDirection.length() > 0) {
            switch (this.gameMode) {
                case GameMode.Testing:
                    if (this.enemyController) {
                        const moveMethod = (this.enemyController as any).move;
                        if (moveMethod && typeof moveMethod === 'function') {
                            moveMethod.call(this.enemyController, this.currentMoveDirection, deltaTime);
                        }
                    }
                    break;

                case GameMode.Normal:
                    if (this.playerController) {
                        const moveMethod = (this.playerController as any).move;
                        if (moveMethod && typeof moveMethod === 'function') {
                            moveMethod.call(this.playerController, this.currentMoveDirection, deltaTime);
                        }
                    }
                    break;
            }
        }

        // 在Normal模式下更新怪物AI
        if (this.gameMode === GameMode.Normal) {
            this.updateMonsterAI(deltaTime);
        }
    }

    // 缓存的怪物列表
    private cachedMonsters: any[] = [];
    private lastMonsterCacheTime: number = 0;
    private monsterCacheInterval: number = 1000; // 1秒更新一次缓存

    /**
     * 更新怪物AI
     */
    private updateMonsterAI(deltaTime: number): void {
        const currentTime = Date.now();

        // 定期更新怪物缓存，避免每帧查找
        if (currentTime - this.lastMonsterCacheTime > this.monsterCacheInterval) {
            this.refreshMonsterCache();
            this.lastMonsterCacheTime = currentTime;
        }

        // 更新缓存中的怪物AI
        this.cachedMonsters.forEach(monster => {
            if (monster && monster.node && monster.node.isValid) {
                const updateAIMethod = monster.updateAI;
                if (updateAIMethod && typeof updateAIMethod === 'function') {
                    updateAIMethod.call(monster, deltaTime);
                }
            }
        });
    }

    /**
     * 刷新怪物缓存
     */
    private refreshMonsterCache(): void {
        const monsters = director.getScene()?.getComponentsInChildren('NormalEnemy');
        this.cachedMonsters = monsters ? monsters.filter(monster =>
            monster && monster.node && monster.node.isValid
        ) : [];
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
        // 处理全局按键
        if (keyCode === KeyCode.KEY_T) {
            this.toggleGameMode();
            return;
        }

        // 添加调试按键
        if (keyCode === KeyCode.KEY_L) {
            this.testLevelSystem();
            return;
        }

        if (keyCode === KeyCode.KEY_C) {
            this.showCacheInfo();
            return;
        }

        // 根据游戏模式分发输入
        if (this.gameMode === GameMode.Normal) {
            this.handlePlayerInput(keyCode);
        } else if (this.gameMode === GameMode.Testing) {
            this.handleEnemyInput(keyCode);
        }
    }

    /**
     * 键盘按键松开处理
     */
    private onKeyReleased = (keyCode: KeyCode): void => {
        // 处理需要松开事件的全局按键
        // 例如：长按功能、连击检测等

        // 根据游戏模式分发松开事件
        if (this.gameMode === GameMode.Normal) {
            this.handlePlayerKeyRelease(keyCode);
        } else if (this.gameMode === GameMode.Testing) {
            this.handleEnemyKeyRelease(keyCode);
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
            if (this.gameMode === GameMode.Normal && this.playerController) {
                const stopMethod = (this.playerController as PlayerController).stopMovement;
                if (stopMethod && typeof stopMethod === 'function') {
                    stopMethod.call(this.playerController);
                }
            } else if (this.gameMode === GameMode.Testing && this.enemyController) {
                const stopMethod = (this.enemyController as NormalEnemy).stopMovement;
                if (stopMethod && typeof stopMethod === 'function') {
                    stopMethod.call(this.enemyController);
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
     * 注册敌人控制器
     */
    public registerEnemyController(controller: Component): void {
        this.enemyController = controller;
        console.log('GameManager: EnemyController registered');
    }

    /**
     * 切换游戏模式
     */
    private toggleGameMode(): void {
        const newMode = this.gameMode === GameMode.Normal ? GameMode.Testing : GameMode.Normal;
        this.setGameMode(newMode);

        // 切换模式时停止当前移动
        this.currentMoveDirection.set(0, 0);
        this.isMoving = false;

        console.log(`GameManager: Switched to ${GameMode[newMode]} mode`);
        if (newMode === GameMode.Testing) {
            console.log('GameManager: Control given to Monster. Press T to switch back to Player control.');
        } else {
            console.log('GameManager: Control given to Player. Press T to switch to Monster control.');
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
        console.log(`GameManager initializing in ${GameMode[this.gameMode]} mode...`);

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

        // 注册挂载的预制体到对象池
        this.registerMountedPrefabs();

        // 启动默认关卡，加载敌人预制体到对象池
        await this.startDefaultLevelForInit();

        // 数据加载完成后，可以通知其他模块进行初始化
        eventManager.emit(GameEvents.GAME_DATA_LOADED);
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
        this.startDefaultLevel();
    }

    /**
     * 注册挂载的预制体到对象池
     */
    private registerMountedPrefabs(): void {
        console.log('GameManager: 开始注册挂载的预制体到对象池...');
        
        let successCount = 0;
        let totalCount = 0;

        // 注册小树精预制体
        if (this.entPrefab) {
            totalCount++;
            const success = resourceManager.registerMountedPrefabToPool(
                'ent_normal',
                this.entPrefab,
                {
                    poolName: 'ent_normal',
                    maxSize: 30,
                    preloadCount: 5
                }
            );
            if (success) {
                successCount++;
                console.log('✅ GameManager: 小树精预制体注册成功');
            } else {
                console.error('❌ GameManager: 小树精预制体注册失败');
            }
        } else {
            console.warn('⚠️ GameManager: 未挂载小树精预制体');
        }

        // 注册巫妖预制体
        if (this.lichPrefab) {
            totalCount++;
            const success = resourceManager.registerMountedPrefabToPool(
                'lich_normal',
                this.lichPrefab,
                {
                    poolName: 'lich_normal',
                    maxSize: 20,
                    preloadCount: 3
                }
            );
            if (success) {
                successCount++;
                console.log('✅ GameManager: 巫妖预制体注册成功');
            } else {
                console.error('❌ GameManager: 巫妖预制体注册失败');
            }
        } else {
            console.warn('⚠️ GameManager: 未挂载巫妖预制体');
        }

        // 注册火球预制体
        if (this.firePrefab) {
            totalCount++;
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
                successCount++;
                console.log('✅ GameManager: 火球预制体注册成功');
            } else {
                console.error('❌ GameManager: 火球预制体注册失败');
            }
        } else {
            console.warn('⚠️ GameManager: 未挂载火球预制体');
        }

        console.log(`🎯 GameManager: 预制体注册完成 - 成功: ${successCount}/${totalCount}`);
    }

    /**
     * 启动默认关卡（用于初始化时加载敌人预制体到对象池）
     */
    private async startDefaultLevelForInit() {
        try {
            console.log('GameManager: 启动默认关卡进行初始化，加载敌人预制体到对象池...');
            await levelManager.startLevel(1); // 启动第一个关卡，触发敌人预制体加载
            console.log('GameManager: 默认关卡初始化完成，敌人预制体已加载到对象池');
        } catch (error) {
            console.error('GameManager: 初始化时启动默认关卡失败', error);
            console.warn('GameManager: 敌人预制体可能未完全加载到对象池，游戏可能需要动态创建敌人');
        }
    }

    /**
     * 启动默认关卡（用于测试）
     */
    private async startDefaultLevel() {
        try {
            console.log('GameManager: Starting default level...');
            await levelManager.startLevel(1); // 启动第一个关卡
        } catch (error) {
            console.error('GameManager: Failed to start default level', error);
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
     * 测试关卡系统
     */
    private async testLevelSystem() {
        console.log('\n=== Level System Test ===');

        try {
            if (levelManager.isLevelActive()) {
                console.log('Ending current level...');
                await levelManager.endLevel();

                // 等待一秒后启动新关卡
                setTimeout(async () => {
                    console.log('Starting level 1 again...');
                    await levelManager.startLevel(1);
                }, 1000);
            } else {
                console.log('Starting level 1...');
                await levelManager.startLevel(1);
            }
        } catch (error) {
            console.error('Level system test failed:', error);
        }
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
} 