/**
 * 对象池角色管理演示
 * 
 * 🎮 控制说明：
 * - 1: 从池创建小树精
 * - 2: 从池创建巫妖
 * - R: 回收所有角色到对象池
 * - C: 清理所有对象池
 * - P: 打印对象池统计信息
 * 
 * 🔧 演示对象池的创建、重用和回收机制
 */

import { _decorator, Component, Prefab, input, Input, EventKeyboard, KeyCode, instantiate, Vec3 } from 'cc';
import { poolManager } from '../scripts/core/PoolManager';
import { BaseCharacterDemo } from '../scripts/animation/BaseCharacterDemo';
import { EntAnimationDemo } from './EntAnimationDemo';
import { LichAnimationDemo } from './LichAnimationDemo';

const { ccclass, property } = _decorator;

@ccclass('PooledCharacterDemo')
export class PooledCharacterDemo extends Component {

    @property({
        type: Prefab,
        displayName: "小树精预制体",
        tooltip: "EntAnimationDemo预制体"
    })
    public entPrefab: Prefab | null = null;

    @property({
        type: Prefab,
        displayName: "巫妖预制体", 
        tooltip: "LichAnimationDemo预制体"
    })
    public lichPrefab: Prefab | null = null;

    @property({
        displayName: "最大池大小",
        tooltip: "每个角色类型的最大对象池大小"
    })
    public maxPoolSize: number = 10;

    @property({
        displayName: "预加载数量",
        tooltip: "每个角色类型预加载到池中的数量"
    })
    public preloadCount: number = 3;

    // 已创建的角色实例追踪
    private activeCharacters: BaseCharacterDemo[] = [];
    private characterIdCounter: number = 1;
    
    // 生成位置管理
    private spawnPositions: Vec3[] = [
        new Vec3(-300, 0, 0),
        new Vec3(-100, 0, 0),
        new Vec3(100, 0, 0),
        new Vec3(300, 0, 0),
        new Vec3(-200, 200, 0),
        new Vec3(0, 200, 0),
        new Vec3(200, 200, 0),
        new Vec3(-200, -200, 0),
        new Vec3(0, -200, 0),
        new Vec3(200, -200, 0)
    ];
    private currentSpawnIndex: number = 0;

    async onLoad() {
        console.log('[PooledCharacterDemo] 开始初始化对象池角色管理演示...');
        
        // 初始化对象池
        this.initializePools();
        
        // 设置输入系统
        this.setupInput();

        console.log('[PooledCharacterDemo] 初始化完成！');
        console.log('🎮 控制说明：');
        console.log('  1 - 从池创建小树精');
        console.log('  2 - 从池创建巫妖');
        console.log('  R - 回收所有角色到对象池');
        console.log('  C - 清理所有对象池');
        console.log('  P - 打印对象池统计信息');
    }

    /**
     * 初始化对象池
     */
    private initializePools(): void {
        if (!this.entPrefab || !this.lichPrefab) {
            console.error('[PooledCharacterDemo] 预制体未设置，无法初始化对象池');
            return;
        }

        // 注册小树精对象池
        poolManager.registerPrefab('ent_character', this.entPrefab, {
            maxSize: this.maxPoolSize,
            preloadCount: this.preloadCount
        });

        // 注册巫妖对象池
        poolManager.registerPrefab('lich_character', this.lichPrefab, {
            maxSize: this.maxPoolSize,
            preloadCount: this.preloadCount
        });

        console.log(`[PooledCharacterDemo] 对象池已初始化 - 每种角色预加载 ${this.preloadCount} 个，最大池大小 ${this.maxPoolSize}`);
    }

    /**
     * 设置输入系统
     */
    private setupInput(): void {
        input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        console.log('[PooledCharacterDemo] 输入系统已设置');
    }

    /**
     * 按键处理
     */
    private onKeyDown = (event: EventKeyboard): void => {
        switch (event.keyCode) {
            case KeyCode.DIGIT_1:
                this.createCharacterFromPool('ent');
                break;
            case KeyCode.DIGIT_2:
                this.createCharacterFromPool('lich');
                break;
            case KeyCode.KEY_R:
                this.recycleAllCharacters();
                break;
            case KeyCode.KEY_C:
                this.clearAllPools();
                break;
            case KeyCode.KEY_P:
                this.printPoolStats();
                break;
        }
    }

    /**
     * 从对象池创建角色
     */
    private createCharacterFromPool(characterType: 'ent' | 'lich'): void {
        const poolName = characterType === 'ent' ? 'ent_character' : 'lich_character';
        const characterId = `${characterType}_${this.characterIdCounter++}`;
        
        console.log(`[PooledCharacterDemo] 尝试从池 "${poolName}" 创建角色 ID: ${characterId}`);
        
        // 从对象池获取节点
        const characterNode = poolManager.get(poolName);
        if (!characterNode) {
            console.error(`[PooledCharacterDemo] 无法从池 "${poolName}" 获取角色节点`);
            return;
        }

        // 获取角色组件并设置为来自池
        const character = characterNode.getComponent(BaseCharacterDemo);
        if (!character) {
            console.error(`[PooledCharacterDemo] 角色节点缺少 BaseCharacterDemo 组件`);
            poolManager.put(characterNode); // 回收节点
            return;
        }

        // 设置对象池属性
        character.setPoolingProperties(true, poolName, characterId);

        // 设置生成位置
        const spawnPos = this.getNextSpawnPosition();
        characterNode.position = spawnPos;
        characterNode.parent = this.node;
        characterNode.active = true;

        // 调用重用回调
        character.onReuseFromPool();

        // 添加到活跃角色列表
        this.activeCharacters.push(character);

        console.log(`[PooledCharacterDemo] 成功创建 ${characterType} 角色 "${characterId}" 位置: (${spawnPos.x}, ${spawnPos.y})`);
        console.log(`[PooledCharacterDemo] 当前活跃角色数量: ${this.activeCharacters.length}`);
    }

    /**
     * 回收所有角色到对象池
     */
    private recycleAllCharacters(): void {
        console.log(`[PooledCharacterDemo] 开始回收 ${this.activeCharacters.length} 个角色到对象池...`);
        
        const recycledCount = this.activeCharacters.length;
        
        // 回收所有活跃角色
        for (const character of this.activeCharacters) {
            if (character && character.node && character.node.isValid) {
                console.log(`[PooledCharacterDemo] 回收角色 "${character.characterId}" 到池 "${character.getPoolName()}"`);
                character.returnToPool();
            }
        }

        // 清空活跃角色列表
        this.activeCharacters = [];
        
        console.log(`[PooledCharacterDemo] 成功回收 ${recycledCount} 个角色到对象池`);
        this.printPoolStats();
    }

    /**
     * 清理所有对象池
     */
    private clearAllPools(): void {
        console.log('[PooledCharacterDemo] 清理所有对象池...');
        
        // 先回收所有活跃角色
        this.recycleAllCharacters();
        
        // 清理对象池
        poolManager.clear('ent_character');
        poolManager.clear('lich_character');
        
        console.log('[PooledCharacterDemo] 所有对象池已清理');
        this.printPoolStats();
    }

    /**
     * 打印对象池统计信息
     */
    private printPoolStats(): void {
        console.log('[PooledCharacterDemo] === 对象池统计信息 ===');
        poolManager.printStats();
        console.log(`[PooledCharacterDemo] 当前活跃角色数量: ${this.activeCharacters.length}`);
        
        // 打印每个活跃角色的信息
        this.activeCharacters.forEach((character, index) => {
            if (character && character.node && character.node.isValid) {
                console.log(`[PooledCharacterDemo] 活跃角色 ${index + 1}: ${character.characterId} (${character.getPoolName()})`);
            }
        });
        console.log('[PooledCharacterDemo] ========================');
    }

    /**
     * 获取下一个生成位置
     */
    private getNextSpawnPosition(): Vec3 {
        const position = this.spawnPositions[this.currentSpawnIndex].clone();
        this.currentSpawnIndex = (this.currentSpawnIndex + 1) % this.spawnPositions.length;
        return position;
    }

    /**
     * 更新函数 - 定期清理无效角色引用
     */
    protected update(deltaTime: number): void {
        // 定期清理无效的角色引用
        this.activeCharacters = this.activeCharacters.filter(character => 
            character && character.node && character.node.isValid
        );
    }

    onDestroy() {
        // 清理输入监听
        input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        
        // 回收所有角色
        this.recycleAllCharacters();
        
        console.log('[PooledCharacterDemo] 组件已清理');
    }
} 