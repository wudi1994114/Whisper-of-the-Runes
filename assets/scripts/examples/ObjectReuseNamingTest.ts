// assets/scripts/examples/ObjectReuseNamingTest.ts

/**
 * 🔥 对象复用命名测试工具
 * 验证对象池复用时的命名机制
 */

import { Component, Vec3 } from 'cc';
import { PoolIntegratedModularCharacterFactory } from '../factories/PoolIntegratedModularCharacterFactory';
import { ICharacter } from '../interfaces';

export class ObjectReuseNamingTest extends Component {

    protected async start(): Promise<void> {
        console.log("🧪 === 对象复用命名测试开始 ===");
        
        // 等待1秒确保系统初始化完成
        await this.sleep(1000);
        
        // 测试1: 基础命名
        await this.testBasicNaming();
        
        // 测试2: 复用命名
        await this.testReuseNaming();
        
        // 测试3: 不同阵营命名
        await this.testFactionNaming();
        
        // 测试4: 批量创建和复用
        await this.testBatchCreateAndReuse();
        
        // 测试5: 名字统计
        this.testNameStatistics();
        
        console.log("🧪 === 对象复用命名测试完成 ===");
    }

    /**
     * 测试基础命名机制
     */
    private async testBasicNaming(): Promise<void> {
        console.log("\n🔬 测试1: 基础命名机制");
        
        const factory = PoolIntegratedModularCharacterFactory.getInstance();
        
        // 创建同类型的多个角色
        const characters: ICharacter[] = [];
        
        for (let i = 0; i < 3; i++) {
            const character = await factory.createCharacter('ent_normal', {
                position: new Vec3(i * 100, 0, 0),
                aiFaction: 'red'
            });
            
            if (character) {
                characters.push(character);
                const nodeName = (character as any).node.name;
                console.log(`  📝 创建角色 ${i + 1}: ${nodeName}`);
            }
        }
        
        // 回收所有角色
        characters.forEach(char => {
            const nodeName = (char as any).node.name;
            console.log(`  ♻️ 回收角色: ${nodeName}`);
            factory.recycleCharacter(char);
        });
    }

    /**
     * 测试复用命名机制
     */
    private async testReuseNaming(): Promise<void> {
        console.log("\n🔬 测试2: 复用命名机制");
        
        const factory = PoolIntegratedModularCharacterFactory.getInstance();
        
        // 第一轮：创建角色
        console.log("  🆕 第一轮创建:");
        const firstBatch: ICharacter[] = [];
        
        for (let i = 0; i < 2; i++) {
            const character = await factory.createCharacter('lich_normal', {
                position: new Vec3(i * 50, 0, 0),
                aiFaction: 'blue'
            });
            
            if (character) {
                firstBatch.push(character);
                const nodeName = (character as any).node.name;
                console.log(`    创建: ${nodeName}`);
            }
        }
        
        // 回收第一批
        console.log("  ♻️ 回收第一批:");
        firstBatch.forEach(char => {
            const nodeName = (char as any).node.name;
            console.log(`    回收: ${nodeName}`);
            factory.recycleCharacter(char);
        });
        
        // 第二轮：应该复用节点但重新命名
        console.log("  🔄 第二轮创建（应该复用节点）:");
        const secondBatch: ICharacter[] = [];
        
        for (let i = 0; i < 2; i++) {
            const character = await factory.createCharacter('lich_normal', {
                position: new Vec3(i * 50, 100, 0),
                aiFaction: 'green'
            });
            
            if (character) {
                secondBatch.push(character);
                const nodeName = (character as any).node.name;
                console.log(`    复用创建: ${nodeName}`);
            }
        }
        
        // 清理第二批
        secondBatch.forEach(char => factory.recycleCharacter(char));
    }

    /**
     * 测试不同阵营命名
     */
    private async testFactionNaming(): Promise<void> {
        console.log("\n🔬 测试3: 不同阵营命名");
        
        const factory = PoolIntegratedModularCharacterFactory.getInstance();
        const factions = ['player', 'red', 'blue', 'green', 'purple'];
        const characters: ICharacter[] = [];
        
        for (const faction of factions) {
            const character = await factory.createCharacter('orc_normal', {
                position: new Vec3(0, 0, 0),
                aiFaction: faction
            });
            
            if (character) {
                characters.push(character);
                const nodeName = (character as any).node.name;
                console.log(`  🏳️ ${faction} 阵营: ${nodeName}`);
            }
        }
        
        // 清理
        characters.forEach(char => factory.recycleCharacter(char));
    }

    /**
     * 测试批量创建和复用
     */
    private async testBatchCreateAndReuse(): Promise<void> {
        console.log("\n🔬 测试4: 批量创建和复用");
        
        const factory = PoolIntegratedModularCharacterFactory.getInstance();
        
        // 创建混合类型的角色
        const characterTypes = ['ent_normal', 'lich_normal', 'orc_normal'];
        const allCharacters: ICharacter[] = [];
        
        console.log("  🆕 批量创建不同类型角色:");
        for (let round = 0; round < 2; round++) {
            for (const type of characterTypes) {
                const character = await factory.createCharacter(type, {
                    position: new Vec3(round * 100, 0, 0),
                    aiFaction: round % 2 === 0 ? 'red' : 'blue'
                });
                
                if (character) {
                    allCharacters.push(character);
                    const nodeName = (character as any).node.name;
                    console.log(`    第${round + 1}轮 ${type}: ${nodeName}`);
                }
            }
        }
        
        console.log("  ♻️ 批量回收:");
        allCharacters.forEach(char => {
            const nodeName = (char as any).node.name;
            console.log(`    回收: ${nodeName}`);
            factory.recycleCharacter(char);
        });
        
        console.log("  🔄 重新批量创建（测试复用）:");
        const reusedCharacters: ICharacter[] = [];
        
        for (const type of characterTypes) {
            const character = await factory.createCharacter(type, {
                position: new Vec3(0, 200, 0),
                aiFaction: 'purple'
            });
            
            if (character) {
                reusedCharacters.push(character);
                const nodeName = (character as any).node.name;
                console.log(`    复用 ${type}: ${nodeName}`);
            }
        }
        
        // 最终清理
        reusedCharacters.forEach(char => factory.recycleCharacter(char));
    }

    /**
     * 测试名字统计
     */
    private testNameStatistics(): void {
        console.log("\n🔬 测试5: 名字统计信息");
        
        const factory = PoolIntegratedModularCharacterFactory.getInstance();
        
        // 获取名字统计
        const nameStats = factory.getNameStats();
        console.log("  📊 角色名字计数统计:");
        
        nameStats.forEach((count, characterType) => {
            console.log(`    ${characterType}: ${count} 个`);
        });
        
        // 获取对象池统计
        const poolStats = factory.getPoolStats();
        console.log("  📊 对象池统计信息:");
        
        poolStats.forEach((stats, characterType) => {
            console.log(`    ${characterType}池: 当前${stats.size}个, 总创建${stats.createCount}个, 复用${stats.getCount}次`);
        });
        
        // 重置计数器测试
        console.log("  🔄 重置名字计数器...");
        factory.resetNameCounters();
        
        const resetStats = factory.getNameStats();
        console.log(`  📊 重置后计数器数量: ${resetStats.size}`);
    }

    /**
     * 手动测试方法
     */
    public async manualTest(): Promise<void> {
        console.log("🔧 开始手动对象复用命名测试...");
        await this.start();
    }

    /**
     * 创建单个命名角色用于测试
     */
    public async createNamedCharacter(
        characterType: string = 'ent_normal',
        faction: string = 'red'
    ): Promise<string | null> {
        const factory = PoolIntegratedModularCharacterFactory.getInstance();
        
        const character = await factory.createCharacter(characterType, {
            position: new Vec3(Math.random() * 200 - 100, Math.random() * 200 - 100, 0),
            aiFaction: faction
        });
        
        if (character) {
            const nodeName = (character as any).node.name;
            console.log(`🎭 手动创建角色: ${nodeName}`);
            return nodeName;
        }
        
        return null;
    }

    /**
     * 睡眠函数
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

/**
 * 使用指南：
 * 
 * 1. 将此组件添加到场景中的节点
 * 2. 运行游戏查看命名效果
 * 3. 检查控制台输出验证命名规则
 * 4. 使用 manualTest() 进行手动测试
 * 5. 使用 createNamedCharacter() 创建单个角色测试
 * 
 * 命名规则验证：
 * - 新创建：阵营_类型_序号_时间戳
 * - 复用节点：重新生成新名字
 * - 不同阵营：名字包含阵营前缀
 * - 计数器：每种类型独立计数
 * - 唯一性：时间戳确保名字唯一
 */