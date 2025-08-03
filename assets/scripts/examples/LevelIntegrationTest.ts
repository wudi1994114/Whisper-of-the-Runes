// assets/scripts/examples/LevelIntegrationTest.ts

/**
 * 关卡集成测试 - 验证新的模块化角色系统与关卡加载的集成
 * 展示如何根据 levels.json 配置创建角色
 */

import { Component, Node } from 'cc';
import { levelManager, LevelData } from '../managers/LevelManager';
import { ModularCharacterFactory } from '../factories/ModularCharacterFactory';
import { dataManager } from '../managers/DataManager';

export class LevelIntegrationTest extends Component {
    
    protected async start(): Promise<void> {
        console.log("=== 关卡集成测试开始 ===");
        
        // 等待数据管理器加载完成
        await this.waitForDataManager();
        
        // 测试关卡数据解析
        this.testLevelDataParsing();
        
        // 测试模块化工厂与关卡的集成
        await this.testLevelWithModularFactory();
        
        // 模拟完整的关卡启动流程
        await this.testFullLevelFlow();
        
        console.log("=== 关卡集成测试完成 ===");
    }

    /**
     * 等待数据管理器加载完成
     */
    private async waitForDataManager(): Promise<void> {
        if (!dataManager.isDataLoaded()) {
            console.log("等待数据管理器加载...");
            await dataManager.loadAllData();
        }
        console.log("✅ 数据管理器加载完成");
    }

    /**
     * 测试关卡数据解析
     */
    private testLevelDataParsing(): void {
        console.log("\n--- 测试关卡数据解析 ---");
        
        // 获取关卡0的数据
        const level0Data = this.getLevelData(0);
        if (level0Data) {
            console.log(`关卡名称: ${level0Data.name}`);
            console.log(`怪物生成器数量: ${level0Data.monsterSpawners?.length || 0}`);
            
            // 解析每个生成器的敌人类型
            level0Data.monsterSpawners?.forEach((spawner, index) => {
                console.log(`生成器 ${index + 1} (${spawner.id}):`);
                spawner.enemies?.forEach(enemy => {
                    console.log(`  - ${enemy.type}: 数量=${enemy.count}, 阵营=${enemy.faction}`);
                });
            });
        }
    }

    /**
     * 测试模块化工厂与关卡的集成
     */
    private async testLevelWithModularFactory(): Promise<void> {
        console.log("\n--- 测试模块化工厂与关卡集成 ---");
        
        const level0Data = this.getLevelData(0);
        if (!level0Data) return;

        // 从关卡数据提取敌人类型
        const enemyTypes = this.extractEnemyTypesFromLevel(level0Data);
        console.log(`关卡需要的敌人类型:`, enemyTypes);

        // 测试为每种敌人类型创建角色
        const factory = ModularCharacterFactory.getInstance();
        const testCharacters: any[] = [];

        for (const enemyType of enemyTypes) {
            try {
                // 创建AI敌人
                const character = factory.createCharacter(enemyType, {
                    controlMode: 1, // ControlMode.AI
                    aiFaction: 'red',
                    aiBehaviorType: 'melee'
                });

                if (character) {
                    testCharacters.push(character);
                    console.log(`✅ 成功创建 ${enemyType} 角色`);
                    
                    // 测试角色的基本功能
                    this.testCharacterBasicFunctions(character, enemyType);
                } else {
                    console.error(`❌ 创建 ${enemyType} 角色失败`);
                }
            } catch (error) {
                console.error(`❌ 创建 ${enemyType} 角色异常:`, error);
            }
        }

        // 清理测试角色
        console.log(`清理 ${testCharacters.length} 个测试角色...`);
        testCharacters.forEach(character => {
            try {
                factory.recycleCharacter(character);
            } catch (error) {
                console.warn(`清理角色失败:`, error);
            }
        });
    }

    /**
     * 测试角色的基本功能
     */
    private testCharacterBasicFunctions(character: any, enemyType: string): void {
        console.log(`  测试 ${enemyType} 角色功能:`);
        
        // 测试基本属性
        console.log(`    - 角色类型: ${character.getCharacterType()}`);
        console.log(`    - 显示名称: ${character.getCharacterDisplayName()}`);
        console.log(`    - 阵营: ${character.getFaction()}`);
        console.log(`    - 存活状态: ${character.isAlive()}`);
        
        // 测试移动功能
        if (typeof character.setNodePosition === 'function') {
            character.setNodePosition(100, 100);
            console.log(`    - 移动测试: ✅`);
        }
        
        // 测试动画功能
        if (typeof character.updateDirectionTowards === 'function') {
            character.updateDirectionTowards({ x: 200, y: 200 });
            console.log(`    - 动画朝向: ✅`);
        }
        
        // 测试配置功能
        if (typeof character.getEnemyData === 'function') {
            const enemyData = character.getEnemyData();
            console.log(`    - 敌人数据: ${enemyData ? '✅' : '❌'}`);
        }
    }

    /**
     * 测试完整的关卡启动流程
     */
    private async testFullLevelFlow(): Promise<void> {
        console.log("\n--- 测试完整关卡启动流程 ---");
        
        try {
            // 1. 初始化关卡管理器
            await levelManager.initialize();
            console.log("✅ 关卡管理器初始化完成");
            
            // 2. 启动关卡0
            console.log("启动关卡0...");
            await levelManager.startLevel(0);
            console.log("✅ 关卡0启动成功");
            
            // 3. 等待一段时间让怪物生成器工作
            await this.sleep(2000);
            
            // 4. 检查活跃角色数量
            const activeCount = ModularCharacterFactory.getInstance().getActiveCharacterCount();
            console.log(`当前活跃角色数量: ${activeCount}`);
            
            // 5. 结束关卡
            console.log("结束关卡...");
            await levelManager.endLevel();
            console.log("✅ 关卡结束成功");
            
        } catch (error) {
            console.error("❌ 关卡流程测试失败:", error);
        }
    }

    /**
     * 获取关卡数据
     */
    private getLevelData(levelId: number): LevelData | null {
        try {
            // 直接从dataManager获取关卡数据
            const allLevels = dataManager.getAllLevels();
            return allLevels.find(level => level.id === levelId) || null;
        } catch (error) {
            console.error(`获取关卡 ${levelId} 数据失败:`, error);
            return null;
        }
    }

    /**
     * 从关卡数据中提取敌人类型
     */
    private extractEnemyTypesFromLevel(levelData: LevelData): string[] {
        const enemyTypes: string[] = [];
        
        // 从 monsterSpawners 中提取
        if (levelData.monsterSpawners) {
            levelData.monsterSpawners.forEach(spawner => {
                spawner.enemies?.forEach(enemy => {
                    if (enemy.type && enemyTypes.indexOf(enemy.type) === -1) {
                        enemyTypes.push(enemy.type);
                    }
                });
            });
        }
        
        // 从旧格式的 enemies 中提取（向后兼容）
        if ((levelData as any).enemies) {
            (levelData as any).enemies.forEach((enemy: any) => {
                if (enemy.type && enemyTypes.indexOf(enemy.type) === -1) {
                    enemyTypes.push(enemy.type);
                }
            });
        }
        
        return enemyTypes;
    }

    /**
     * 睡眠函数
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 手动测试方法 - 可以在游戏运行时调用
     */
    public async manualTest(): Promise<void> {
        console.log("开始手动测试...");
        await this.start();
    }

    /**
     * 测试根据levels.json创建指定数量的角色
     */
    public testCreateCharactersFromLevelConfig(): void {
        console.log("\n--- 测试根据关卡配置创建角色 ---");
        
        const level0Data = this.getLevelData(0);
        if (!level0Data?.monsterSpawners) {
            console.error("关卡数据不存在或无怪物生成器配置");
            return;
        }

        const factory = ModularCharacterFactory.getInstance();
        const createdCharacters: any[] = [];

        // 遍历每个怪物生成器
        level0Data.monsterSpawners.forEach((spawner, spawnerIndex) => {
            console.log(`\n处理生成器 ${spawnerIndex + 1}: ${spawner.id}`);
            
            // 遍历每种敌人配置
            spawner.enemies?.forEach((enemyConfig, enemyIndex) => {
                console.log(`  创建敌人类型: ${enemyConfig.type}`);
                console.log(`  预期数量: ${enemyConfig.count}`);
                console.log(`  阵营: ${enemyConfig.faction}`);
                
                // 创建指定数量的角色
                for (let i = 0; i < enemyConfig.count; i++) {
                    const character = factory.createCharacter(enemyConfig.type, {
                        controlMode: 1, // ControlMode.AI
                        aiFaction: enemyConfig.faction,
                        aiBehaviorType: 'melee',
                        position: {
                            x: spawner.position.x + (Math.random() - 0.5) * spawner.spawnRadius,
                            y: spawner.position.y + (Math.random() - 0.5) * spawner.spawnRadius,
                            z: 0
                        }
                    });

                    if (character) {
                        createdCharacters.push(character);
                        console.log(`    ✅ 创建角色 ${i + 1}/${enemyConfig.count}`);
                    } else {
                        console.error(`    ❌ 创建角色失败 ${i + 1}/${enemyConfig.count}`);
                    }
                }
            });
        });

        console.log(`\n📊 创建统计:`);
        console.log(`总共创建角色: ${createdCharacters.length}`);
        console.log(`工厂活跃角色数: ${factory.getActiveCharacterCount()}`);
        
        // 可选：清理创建的角色
        console.log(`\n清理创建的角色...`);
        createdCharacters.forEach(character => {
            factory.recycleCharacter(character);
        });
        
        console.log(`清理完成，剩余活跃角色: ${factory.getActiveCharacterCount()}`);
    }
}

/**
 * 使用指南：
 * 
 * 1. 将此组件添加到场景中的某个节点
 * 2. 运行游戏，组件会自动执行测试
 * 3. 查看控制台输出验证集成结果
 * 4. 可以调用 manualTest() 进行手动测试
 * 5. 调用 testCreateCharactersFromLevelConfig() 测试根据配置创建角色
 * 
 * 验证要点：
 * - 关卡数据是否正确解析
 * - 模块化工厂是否能创建所有敌人类型
 * - 角色的基本功能是否正常
 * - 关卡启动/结束流程是否完整
 * - 根据配置创建的角色数量是否正确
 */