// assets/scripts/core/MonsterSpawner.ts

import { _decorator, Component, Node, director, Vec3, instantiate, Prefab } from 'cc';
import { AIConfig, AIBehaviorType } from './MonsterAI';
import { Faction, FactionUtils } from '../configs/FactionConfig';
import { dataManager } from './DataManager';
import { poolManager } from './PoolManager';
import { eventManager } from './EventManager';
import { GameEvents } from './GameEvents';
import { GameManager } from './GameManager';

const { ccclass, property } = _decorator;

/**
 * 怪物生成器接口
 */
interface SpawnerConfig {
    id: string;
    position: { x: number, y: number };
    spawnRadius: number;
    spawnType: string;
    size?: { width: number, height: number };
    enemies: EnemySpawnConfig[];
}

/**
 * 敌人生成配置接口
 */
interface EnemySpawnConfig {
    type: string;
    count: number;
    spawnInterval: number;
    maxAlive: number;
    spawnDelay: number;
    respawnOnDeath: boolean;
    faction?: string; // 支持每个敌人指定独立的阵营
}

/**
 * 怪物生成器组件
 * 负责根据关卡配置生成和管理怪物
 */
@ccclass('MonsterSpawner')
export class MonsterSpawner extends Component {
    
    @property({ type: Prefab, displayName: "怪物预制体" })
    public monsterPrefab: Prefab | null = null;
    
    // 生成器配置
    private spawnerConfig: SpawnerConfig | null = null;
    
    // 存活怪物管理
    private aliveMonsters: Map<string, Node[]> = new Map();
    
    // 生成计时器
    private spawnTimers: Map<string, number> = new Map();
    
    // 是否已初始化
    private isInitialized: boolean = false;
    
    // 移除spawnerFaction，每个敌人按照自己的配置设置阵营
    
    protected onLoad(): void {
        // 监听怪物死亡事件
        eventManager.on(GameEvents.MONSTER_DEATH_ANIMATION_FINISHED, this.onMonsterDeath.bind(this));
    }
    
    protected onDestroy(): void {
        // 取消事件监听
        eventManager.off(GameEvents.MONSTER_DEATH_ANIMATION_FINISHED, this.onMonsterDeath.bind(this));
        
        // 清理所有计时器
        this.unscheduleAllCallbacks();
    }
    
    protected update(deltaTime: number): void {
        if (!this.isInitialized || !this.spawnerConfig) {
            return;
        }
        
        // 更新生成计时器
        this.updateSpawnTimers(deltaTime);
    }
    
    /**
     * 使用配置初始化生成器
     * @param config 生成器配置
     */
    public initWithConfig(config: SpawnerConfig): void {
        this.spawnerConfig = config;
        this.node.setPosition(config.position.x, config.position.y);
        
        // 不再设置生成器默认阵营，每个敌人按照自己的配置设置阵营
        console.log(`MonsterSpawner: 初始化生成器 ${config.id}，将根据每个敌人的配置单独设置阵营`);
        
        // 初始化存活怪物映射
        config.enemies.forEach(enemyConfig => {
            this.aliveMonsters.set(enemyConfig.type, []);
            this.spawnTimers.set(enemyConfig.type, enemyConfig.spawnDelay);
        });
        
        this.isInitialized = true;
        
        // 开始生成怪物
        this.startSpawning();
        
        console.log(`MonsterSpawner initialized: ${config.id}`);
    }
    
    /**
     * 开始生成怪物
     */
    private startSpawning(): void {
        if (!this.spawnerConfig) return;
        
        this.spawnerConfig.enemies.forEach((enemyConfig: EnemySpawnConfig) => {
            // 初始生成
            this.scheduleOnce(() => {
                this.spawnEnemyGroup(enemyConfig);
            }, enemyConfig.spawnDelay);
        });
    }
    
    /**
     * 更新生成计时器
     */
    private updateSpawnTimers(deltaTime: number): void {
        if (!this.spawnerConfig) return;
        
        this.spawnerConfig.enemies.forEach(enemyConfig => {
            if (!enemyConfig.respawnOnDeath) return;
            
            const currentTimer = this.spawnTimers.get(enemyConfig.type) || 0;
            const newTimer = currentTimer - deltaTime;
            
            if (newTimer <= 0) {
                // 时间到了，尝试重新生成
                this.checkAndRespawn(enemyConfig);
                this.spawnTimers.set(enemyConfig.type, enemyConfig.spawnInterval);
            } else {
                this.spawnTimers.set(enemyConfig.type, newTimer);
            }
        });
    }
    
    /**
     * 检查并重新生成怪物
     */
    private checkAndRespawn(enemyConfig: EnemySpawnConfig): void {
        const aliveCount = this.getAliveCount(enemyConfig.type);
        
        if (aliveCount < enemyConfig.maxAlive) {
            this.spawnEnemyGroup(enemyConfig);
        }
    }
    
    /**
     * 生成一组怪物
     */
    private spawnEnemyGroup(enemyConfig: EnemySpawnConfig): void {
        const aliveCount = this.getAliveCount(enemyConfig.type);
        const needSpawn = Math.min(
            enemyConfig.count, 
            enemyConfig.maxAlive - aliveCount
        );
        
        for (let i = 0; i < needSpawn; i++) {
            const spawnPos = this.getSpawnPosition();
            const monster = this.createMonster(enemyConfig.type, spawnPos, enemyConfig);
            if (monster) {
                this.registerMonster(enemyConfig.type, monster);
            }
        }
        
        const factionInfo = enemyConfig.faction ? ` (阵营: ${enemyConfig.faction})` : '';
        console.log(`MonsterSpawner: Spawned ${needSpawn} ${enemyConfig.type} monsters${factionInfo}`);
    }
    
    /**
     * 获取生成位置
     */
    private getSpawnPosition(): Vec3 {
        if (!this.spawnerConfig) {
            return this.node.position;
        }
        
        const config = this.spawnerConfig;
        let x = 0;
        let y = 0;
        
        switch (config.spawnType) {
            case 'circle':
                const angle = Math.random() * Math.PI * 2;
                const radius = Math.random() * config.spawnRadius;
                x = Math.cos(angle) * radius;
                y = Math.sin(angle) * radius;
                break;
                
            case 'rectangle':
                if (config.size) {
                    x = (Math.random() - 0.5) * config.size.width;
                    y = (Math.random() - 0.5) * config.size.height;
                } else {
                    x = (Math.random() - 0.5) * config.spawnRadius * 2;
                    y = (Math.random() - 0.5) * config.spawnRadius * 2;
                }
                break;
                
            case 'point':
            default:
                // 固定位置生成
                x = 0;
                y = 0;
                break;
        }
        
        return new Vec3(
            this.node.position.x + x,
            this.node.position.y + y,
            0
        );
    }
    
    /**
     * 创建怪物 - 使用对象池和统一初始化
     */
    private createMonster(enemyType: string, position: Vec3, enemyConfig?: EnemySpawnConfig): Node | null {
        try {
            // 1. 获取敌人配置数据
            const enemyData = dataManager.getEnemyData(enemyType);
            if (!enemyData) {
                console.error(`MonsterSpawner: 未找到敌人类型 ${enemyType} 的配置数据`);
                return null;
            }

            // 2. 尝试从对象池获取敌人实例（使用统一初始化）
            let monster = poolManager.getEnemyInstance(enemyType, enemyData);
            if (monster) {
                // 从对象池成功获取
                monster.setPosition(position);
                
                // 激活节点
                monster.active = true;
                
                // 【关键修复】设置敌人类型到UniversalCharacterDemo
                const universalDemo = monster.getComponent('UniversalCharacterDemo');
                if (universalDemo && (universalDemo as any).setEnemyType) {
                    (universalDemo as any).setEnemyType(enemyType);
                    console.log(`MonsterSpawner: ✅ 已设置敌人类型: ${enemyType}`);
                } else {
                    console.warn(`MonsterSpawner: ⚠️ 未找到UniversalCharacterDemo组件或setEnemyType方法`);
                }
                
                // 添加AI组件
                this.addAIController(monster, enemyType, enemyData, enemyConfig);
                
                // 添加到Canvas下
                this.addMonsterToCanvas(monster);
                
                console.log(`MonsterSpawner: 从对象池创建怪物 ${enemyType} 成功`);
                return monster;
            }

            // 3. 对象池不可用，回退到传统实例化方式
            console.warn(`MonsterSpawner: 对象池 ${enemyType} 不可用，使用传统实例化`);
            
            if (!this.monsterPrefab) {
                console.error('MonsterSpawner: Monster prefab not set');
                return null;
            }
            
            monster = instantiate(this.monsterPrefab);
            monster.setPosition(position);
            
            // 手动初始化组件
            this.initializeMonsterComponents(monster, enemyType, enemyData);
            
            // 【关键修复】设置敌人类型到UniversalCharacterDemo（传统实例化方式）
            const universalDemo = monster.getComponent('UniversalCharacterDemo');
            if (universalDemo && (universalDemo as any).setEnemyType) {
                (universalDemo as any).setEnemyType(enemyType);
                console.log(`MonsterSpawner: ✅ 已设置敌人类型（传统方式）: ${enemyType}`);
            } else {
                console.warn(`MonsterSpawner: ⚠️ 未找到UniversalCharacterDemo组件或setEnemyType方法（传统方式）`);
            }
            
            // 添加AI组件
            this.addAIController(monster, enemyType, enemyData, enemyConfig);
            
            // 添加到Canvas下
            this.addMonsterToCanvas(monster);
            
            console.log(`MonsterSpawner: 使用传统方式创建怪物 ${enemyType} 成功`);
            return monster;
            
        } catch (error) {
            console.error('MonsterSpawner: Failed to create monster', error);
            return null;
        }
    }

    /**
     * 将怪物节点添加到Canvas下
     * @param monsterNode 怪物节点
     */
    private addMonsterToCanvas(monsterNode: Node): void {
        const scene = director.getScene();
        if (!scene) {
            console.error('MonsterSpawner: 无法获取当前场景。');
            return;
        }

        const canvas = scene.getComponentInChildren('cc.Canvas');
        if (canvas && canvas.node) {
            canvas.node.addChild(monsterNode);
        } else {
            console.warn('MonsterSpawner: 未在场景中找到Canvas节点，怪物将被添加到根节点。');
            scene.addChild(monsterNode);
        }
    }

    /**
     * 手动初始化怪物组件（传统实例化的备用方案）
     */
    private initializeMonsterComponents(monster: Node, enemyType: string, enemyData: any): void {
        try {
            // 设置怪物类型
            const enemyComponent = monster.getComponent('NormalEnemy');
            if (enemyComponent) {
                const setEnemyIdMethod = (enemyComponent as any).setEnemyId;
                if (setEnemyIdMethod && typeof setEnemyIdMethod === 'function') {
                    setEnemyIdMethod.call(enemyComponent, enemyType);
                }
                
                // 设置出生位置
                const setSpawnPositionMethod = (enemyComponent as any).setSpawnPosition;
                if (setSpawnPositionMethod && typeof setSpawnPositionMethod === 'function') {
                    setSpawnPositionMethod.call(enemyComponent, monster.position);
                }
            }

            // 手动初始化CharacterStats组件
            const characterStats = monster.getComponent('CharacterStats') as any;
            if (characterStats && characterStats.initWithEnemyData) {
                characterStats.initWithEnemyData(enemyData).catch((error: any) => {
                    console.error('MonsterSpawner: CharacterStats初始化失败', error);
                });
            }

            // 手动初始化血条组件
            const healthBarComponent = monster.getComponent('HealthBarComponent') as any;
            if (healthBarComponent) {
                if (characterStats) {
                    healthBarComponent.bindCharacterStats(characterStats);
                } else {
                    healthBarComponent.setHealthData(enemyData.baseHealth || 100);
                }
                
                const characterType = enemyType.startsWith('ent_') ? 'ent' : 'lich';
                healthBarComponent.setCharacterType(characterType);
            }

            console.log(`MonsterSpawner: 手动初始化怪物组件完成 - ${enemyType}`);
            
        } catch (error) {
            console.error('MonsterSpawner: 手动初始化怪物组件失败', error);
        }
    }
    
    /**
     * 为怪物设置AI控制
     */
    private addAIController(monster: Node, enemyType: string, enemyData: any, enemyConfig?: EnemySpawnConfig): void {
        try {
            // 获取BaseCharacterDemo组件
            const characterDemo = monster.getComponent('BaseCharacterDemo');
            if (!characterDemo) {
                console.warn(`MonsterSpawner: ${monster.name} 没有BaseCharacterDemo组件，无法设置AI`);
                return;
            }

            // 【关键修复】确保MonsterSpawner只在正常模式下设置AI，不干扰其他模式
            // 检查当前是否为正常模式（正常模式下通过关卡生成的怪物需要设置AI）
            const gameManager = GameManager?.instance;
            if (gameManager && gameManager.normalMode) {
                // 【重构】每个敌人必须有自己的阵营配置
                if (!enemyConfig || !enemyConfig.faction) {
                    console.error(`MonsterSpawner: 敌人 ${enemyType} 缺少阵营配置，无法设置AI`);
                    return;
                }
                
                const targetFaction = FactionUtils.stringToFaction(enemyConfig.faction);
                console.log(`MonsterSpawner: 设置敌人阵营: ${enemyConfig.faction} -> ${targetFaction}`);
                
                console.log(`MonsterSpawner: 开始设置 ${enemyType} 的阵营和AI - 目标阵营: ${targetFaction}`);
                
                // 【关键修复1】先设置阵营，再配置AI
                // 1. 设置阵营信息到角色组件（这会同时更新物理分组）
                if ((characterDemo as any).setFaction) {
                    (characterDemo as any).setFaction(targetFaction);
                    console.log(`MonsterSpawner: ✅ 阵营已设置: ${targetFaction}`);
                } else {
                    console.warn(`MonsterSpawner: ❌ setFaction方法不存在`);
                }

                // 2. 设置AI模式和基础配置
                (characterDemo as any).controlMode = 1; // ControlMode.AI
                (characterDemo as any).aiFaction = this.factionToString(targetFaction);
                (characterDemo as any).aiBehaviorType = this.determineAIBehaviorType(enemyType) === AIBehaviorType.RANGED ? 'ranged' : 'melee';

                // 3. 创建AI配置
                const aiConfig: AIConfig = {
                    detectionRange: enemyData.detectionRange || 200,
                    attackRange: enemyData.attackRange || 60,
                    pursuitRange: enemyData.pursuitRange || 300,
                    moveSpeed: enemyData.moveSpeed * 100 || 100, // 转换为像素/秒
                    attackInterval: enemyData.attackInterval || 2,
                    behaviorType: this.determineAIBehaviorType(enemyType),
                    faction: targetFaction,
                    returnDistance: enemyData.returnDistance || 200,
                    patrolRadius: 50,
                    maxIdleTime: enemyData.idleWaitTime || 2
                };

                // 4. 初始化AI
                if ((characterDemo as any).initializeAI) {
                    (characterDemo as any).initializeAI(enemyData, aiConfig);
                    console.log(`MonsterSpawner: ✅ AI配置完成 - ${enemyType}, 阵营: ${targetFaction}`);
                } else {
                    console.warn(`MonsterSpawner: ❌ initializeAI方法不存在`);
                }
            } else {
                console.log(`MonsterSpawner: 跳过AI设置 - 当前不是正常模式，让其他逻辑处理控制模式`);
            }
        } catch (error) {
            console.error(`MonsterSpawner: 设置BaseCharacterDemo AI失败 - ${enemyType}`, error);
        }
    }

    /**
     * 根据敌人类型确定AI行为类型
     */
    private determineAIBehaviorType(enemyType: string): AIBehaviorType {
        // 巫妖系列为远程攻击
        if (enemyType.includes('lich')) {
            return AIBehaviorType.RANGED;
        }
        
        // 其他为近战攻击
        return AIBehaviorType.MELEE;
    }
    
    /**
     * 将Faction枚举转换为字符串
     */
    private factionToString(faction: Faction): string {
        // 使用FactionUtils来转换
        return FactionUtils.factionToString(faction);
    }
    
    /**
     * 注册怪物
     */
    private registerMonster(enemyType: string, monster: Node): void {
        const monsters = this.aliveMonsters.get(enemyType) || [];
        monsters.push(monster);
        this.aliveMonsters.set(enemyType, monsters);
        
        // 监听怪物销毁事件
        monster.on(Node.EventType.NODE_DESTROYED, () => {
            this.unregisterMonster(enemyType, monster);
        });
    }
    
    /**
     * 取消注册怪物
     */
    private unregisterMonster(enemyType: string, monster: Node): void {
        const monsters = this.aliveMonsters.get(enemyType) || [];
        const index = monsters.indexOf(monster);
        if (index !== -1) {
            monsters.splice(index, 1);
            this.aliveMonsters.set(enemyType, monsters);
        }
    }
    
    /**
     * 获取存活怪物数量
     */
    private getAliveCount(enemyType: string): number {
        const monsters = this.aliveMonsters.get(enemyType) || [];
        // 过滤掉已经销毁的节点
        const aliveMonsters = monsters.filter(monster => monster && monster.isValid);
        this.aliveMonsters.set(enemyType, aliveMonsters);
        return aliveMonsters.length;
    }
    
    /**
     * 怪物死亡事件处理
     */
    private onMonsterDeath(controller: any): void {
        // 找到对应的怪物节点
        const monsterNode = controller.node;
        if (!monsterNode) return;
        
        // 从存活列表中移除
        this.aliveMonsters.forEach((monsters, enemyType) => {
            const index = monsters.indexOf(monsterNode);
            if (index !== -1) {
                monsters.splice(index, 1);
                this.aliveMonsters.set(enemyType, monsters);
                console.log(`MonsterSpawner: Monster ${enemyType} died`);
            }
        });
    }
    
    /**
     * 获取生成器状态信息
     */
    public getStatusInfo(): string {
        if (!this.spawnerConfig) {
            return 'Not initialized';
        }
        
        let info = `Spawner ${this.spawnerConfig.id}:\n`;
        this.spawnerConfig.enemies.forEach(enemyConfig => {
            const alive = this.getAliveCount(enemyConfig.type);
            const timer = this.spawnTimers.get(enemyConfig.type) || 0;
            info += `  ${enemyConfig.type}: ${alive}/${enemyConfig.maxAlive} (next: ${timer.toFixed(1)}s)\n`;
        });
        
        return info;
    }
    
    /**
     * 强制生成所有怪物
     */
    public forceSpawnAll(): void {
        if (!this.spawnerConfig) return;
        
        this.spawnerConfig.enemies.forEach(enemyConfig => {
            this.spawnEnemyGroup(enemyConfig);
        });
    }
    
    /**
     * 清理所有怪物
     */
    public clearAllMonsters(): void {
        this.aliveMonsters.forEach((monsters, enemyType) => {
            monsters.forEach(monster => {
                if (monster && monster.isValid) {
                    monster.destroy();
                }
            });
            this.aliveMonsters.set(enemyType, []);
        });
        
        console.log('MonsterSpawner: All monsters cleared');
    }
} 