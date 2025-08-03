// assets/scripts/core/MonsterSpawner.ts

import { _decorator, Component, Node, director, Vec3, instantiate, Prefab } from 'cc';
import { AIBehaviorType } from '../components/MonsterAI';
import { Faction, FactionUtils } from '../configs/FactionConfig';
import { dataManager } from './DataManager';
import { poolManager } from './PoolManager';
import { eventManager } from './EventManager';
import { GameEvents } from '../components/GameEvents';
import { GameManager } from './GameManager';
import { BaseCharacterDemo } from '../entities/BaseCharacterDemo';
import { ControlMode } from '../state-machine/CharacterEnums';
import { UnifiedECSCharacterFactory, ensureFactoryInitialized } from '../factories/UnifiedECSCharacterFactory';

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
    randomOffset?: { x: number, y: number }; // 随机偏移范围
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
    
    // 【性能优化】生成器更新定时控制
    private spawnUpdateTimer: number = 0;
    private readonly SPAWN_UPDATE_INTERVAL = 0.5; // 0.5秒更新一次
    
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
        
        // 【性能优化】降低生成计时器更新频率
        this.spawnUpdateTimer += deltaTime;
        if (this.spawnUpdateTimer >= this.SPAWN_UPDATE_INTERVAL) {
            this.updateSpawnTimers(this.spawnUpdateTimer);
            this.spawnUpdateTimer = 0;
        }
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
                this.spawnEnemyGroup(enemyConfig).catch(error => {
                    console.error(`MonsterSpawner: 生成敌人组失败:`, error);
                });
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
            this.spawnEnemyGroup(enemyConfig).catch(error => {
                console.error(`MonsterSpawner: 重新生成敌人失败:`, error);
            });
        }
    }
    
    /**
     * 生成一组怪物
     */
    private async spawnEnemyGroup(enemyConfig: EnemySpawnConfig): Promise<void> {
        const aliveCount = this.getAliveCount(enemyConfig.type);
        const needSpawn = Math.min(
            enemyConfig.count, 
            enemyConfig.maxAlive - aliveCount
        );
        
        for (let i = 0; i < needSpawn; i++) {
            const spawnPos = this.getSpawnPosition();
            const monster = await this.createMonster(enemyConfig.type, spawnPos, enemyConfig);
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
        
        // 应用随机偏移
        if (config.randomOffset) {
            const randomOffsetX = (Math.random() - 0.5) * 2 * config.randomOffset.x;
            const randomOffsetY = (Math.random() - 0.5) * 2 * config.randomOffset.y;
            x += randomOffsetX;
            y += randomOffsetY;
        }
        
        // 根据Y轴位置计算Z轴深度：Y轴越高，Z轴越低（更靠前）
        const finalY = this.node.position.y + y;
        const zDepth = -finalY * 0.1; // Y轴每增加10像素，Z轴减少1
        
        return new Vec3(
            this.node.position.x + x,
            finalY,
            zDepth
        );
    }
    
    /**
     * 创建怪物 - 使用新的模块化角色工厂系统
     */
    private async createMonster(enemyType: string, position: Vec3, enemyConfig?: EnemySpawnConfig): Promise<Node | null> {
        try {
            console.log(`MonsterSpawner: 创建怪物 ${enemyType} 位置: ${position.x}, ${position.y}`);
            
            // 1. 获取敌人配置数据
            const enemyData = dataManager.getEnemyData(enemyType);
            if (!enemyData) {
                console.error(`MonsterSpawner: 未找到敌人类型 ${enemyType} 的配置数据`);
                return null;
            }

            const behaviorType = this.determineAIBehaviorType(enemyType);
            
            // 2. 🔥 使用统一ECS工厂创建AI敌人（先确保工厂可用）
            let character = null;
            try {
                character = await UnifiedECSCharacterFactory.createAIEnemy(enemyType, {
                    position: position,
                    faction: enemyConfig?.faction || 'red',
                    behaviorType: behaviorType,
                    useBaseCharacterDemo: false // 默认使用 ModularCharacter
                });
            } catch (factoryError) {
                console.error(`[MonsterSpawner] 工厂初始化失败:`, factoryError);
                // 回退到旧系统
                return this.createMonsterWithOldSystem(enemyType, position, enemyConfig);
            }

            if (!character) {
                console.error(`MonsterSpawner: 统一ECS工厂创建怪物失败 ${enemyType}`);
                // 回退到旧系统
                return this.createMonsterWithOldSystem(enemyType, position, enemyConfig);
            }

            // 3. 获取角色节点
            const characterNode = (character as any).node as Node;
            
            // 4. 添加到Canvas下
            this.addMonsterToCanvas(characterNode);
            
            const characterName = (character as any).node.name;
            console.log(`MonsterSpawner: ✅ 使用统一ECS工厂创建怪物成功: ${characterName} [${enemyType}]`);
            return characterNode;
            
        } catch (error) {
            console.error('MonsterSpawner: 统一ECS工厂创建失败', error);
            // 回退到旧系统
            return this.createMonsterWithOldSystem(enemyType, position, enemyConfig);
        }
    }

    /**
     * 使用旧系统创建怪物（回退方案）
     */
    private createMonsterWithOldSystem(enemyType: string, position: Vec3, enemyConfig?: EnemySpawnConfig): Node | null {
        console.warn(`MonsterSpawner: 回退到旧系统创建怪物 ${enemyType}`);
        return this.createMonsterTraditional(enemyType, position, enemyConfig);
    }

    /**
     * 传统方式创建怪物（最终回退方案）
     */
    private createMonsterTraditional(enemyType: string, position: Vec3, enemyConfig?: EnemySpawnConfig): Node | null {
        try {
            console.warn(`MonsterSpawner: 使用传统方式创建怪物 ${enemyType}`);
            
            const enemyData = dataManager.getEnemyData(enemyType);
            if (!enemyData) {
                console.error(`MonsterSpawner: 未找到敌人类型 ${enemyType} 的配置数据`);
                return null;
            }

            // 尝试从旧的对象池获取
            let monster = poolManager.getEnemyInstance(enemyType, enemyData);
            if (monster) {
                monster.setPosition(position);
                monster.active = true;
                
                // 【强化】确保敌人类型已设置（getEnemyInstance已经设置了，但双重保险）
                this.ensureEnemyTypeSet(monster, enemyType);
                
                this.addAIController(monster, enemyType, enemyData, enemyConfig);
                this.addMonsterToCanvas(monster);
                
                console.log(`MonsterSpawner: 传统对象池创建 ${enemyType} 成功`);
                return monster;
            }

            // 最后的回退：实例化预制体
            if (!this.monsterPrefab) {
                console.error('MonsterSpawner: Monster prefab not set');
                return null;
            }
            
            monster = instantiate(this.monsterPrefab);
            monster.setPosition(position);
            
            // 【强化】在初始化组件之前先设置敌人类型
            this.ensureEnemyTypeSet(monster, enemyType);
            
            // 然后进行组件初始化
            this.initializeMonsterComponents(monster, enemyType, enemyData);
            
            this.addAIController(monster, enemyType, enemyData, enemyConfig);
            this.addMonsterToCanvas(monster);
            
            console.log(`MonsterSpawner: 预制体实例化创建 ${enemyType} 成功`);
            return monster;
            
        } catch (error) {
            console.error('MonsterSpawner: Traditional creation failed', error);
            return null;
        }
    }

    /**
     * 【新增】确保敌人类型已正确设置的统一方法
     * @param monsterNode 怪物节点
     * @param enemyType 敌人类型
     */
    private ensureEnemyTypeSet(monsterNode: Node, enemyType: string): void {
        try {
            // 1. 设置BaseCharacterDemo的explicitEnemyType
            const baseDemo = monsterNode.getComponent('BaseCharacterDemo');
            if (baseDemo && (baseDemo as any).setEnemyType) {
                (baseDemo as any).setEnemyType(enemyType);
                console.log(`MonsterSpawner: ✅ 确认敌人类型已设置: ${enemyType}`);
            } else {
                console.warn(`MonsterSpawner: ⚠️ 未找到BaseCharacterDemo组件或setEnemyType方法`);
            }

            // 2. 设置BaseCharacterDemo的相关属性（如果需要）
            if (baseDemo) {
                // 可以在这里设置其他相关属性
                console.log(`MonsterSpawner: BaseCharacterDemo组件已找到，敌人类型: ${enemyType}`);
            }

            // 3. 设置节点名称（便于调试）
            if (!monsterNode.name.includes(enemyType)) {
                monsterNode.name = `Monster_${enemyType}_${Date.now()}`;
            }
            
        } catch (error) {
            console.error(`MonsterSpawner: 设置敌人类型失败 - ${enemyType}`, error);
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
            // 【强化】确保敌人类型在组件初始化开始时已设置
            this.ensureEnemyTypeSet(monster, enemyType);
            
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
     * 为怪物设置AI控制（传统方式创建的怪物用）
     */
    private addAIController(monster: Node, enemyType: string, enemyData: any, enemyConfig?: EnemySpawnConfig): void {
        try {
            // 【强化】在AI设置开始前确保敌人类型已设置
            this.ensureEnemyTypeSet(monster, enemyType);
            
            // 获取BaseCharacterDemo组件
            const characterDemo = monster.getComponent('BaseCharacterDemo');
            if (!characterDemo) {
                console.warn(`MonsterSpawner: ${monster.name} 没有BaseCharacterDemo组件，无法设置AI`);
                return;
            }

            // 检查是否已经通过新对象池系统设置了AI（避免重复设置）
            if ((characterDemo as any).controlMode === ControlMode.AI) {
                console.log(`MonsterSpawner: ${monster.name} 已通过新对象池系统设置AI，跳过重复设置`);
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

                // 2. AI配置已在createCharacter时通过options设置，无需重复设置

                // 3. 初始化AI（简化版本，直接使用enemyData）
                if ((characterDemo as any).initializeAI) {
                    (characterDemo as any).initializeAI();
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
    private determineAIBehaviorType(enemyType: string): string {
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