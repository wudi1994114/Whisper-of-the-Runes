// assets/scripts/core/MonsterSpawner.ts

import { _decorator, Component, Node, Prefab, instantiate, Vec3, director } from 'cc';
import { dataManager } from './DataManager';
import { eventManager } from './EventManager';
import { GameEvents } from './GameEvents';

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
            const monster = this.createMonster(enemyConfig.type, spawnPos);
            if (monster) {
                this.registerMonster(enemyConfig.type, monster);
            }
        }
        
        console.log(`MonsterSpawner: Spawned ${needSpawn} ${enemyConfig.type} monsters`);
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
     * 创建怪物
     */
    private createMonster(enemyType: string, position: Vec3): Node | null {
        if (!this.monsterPrefab) {
            console.error('MonsterSpawner: Monster prefab not set');
            return null;
        }
        
        try {
            const monster = instantiate(this.monsterPrefab);
            monster.setPosition(position);
            
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
                    setSpawnPositionMethod.call(enemyComponent, position);
                }
            }
            
            // 添加到场景
            const scene = director.getScene();
            if (scene) {
                scene.addChild(monster);
            }
            
            return monster;
        } catch (error) {
            console.error('MonsterSpawner: Failed to create monster', error);
            return null;
        }
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