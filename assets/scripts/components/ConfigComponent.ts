// assets/scripts/components/ConfigComponent.ts

import { Component } from 'cc';
import { IConfigurable } from '../interfaces/IConfigurable';
import { EnemyData } from '../configs/EnemyConfig';
import { dataManager } from '../managers/DataManager';
import { GameManager } from '../managers/GameManager';

/**
 * 配置组件 - 负责配置数据加载、类型管理
 * 实现 IConfigurable 接口，专注于配置管理的单一职责
 */
export class ConfigComponent extends Component implements IConfigurable {
    // 配置相关属性
    private _enemyData: EnemyData | null = null;
    private _aiBehaviorType: string = "melee";
    private _explicitEnemyType: string | null = null;

    // IConfigurable 接口属性
    get enemyData(): EnemyData | null { return this._enemyData; }
    get aiBehaviorType(): string { return this._aiBehaviorType; }
    set aiBehaviorType(value: string) { this._aiBehaviorType = value; }

    protected onLoad(): void {
        // 监听生命周期事件
        this.node.on('reuse-from-pool', this.onReuse, this);
        this.node.on('reset-character-state', this.onResetState, this);
    }

    protected onDestroy(): void {
        // 清理事件监听
        this.node.off('reuse-from-pool', this.onReuse, this);
        this.node.off('reset-character-state', this.onResetState, this);
    }

    /**
     * 设置敌人类型
     * @param enemyType 敌人类型ID，如 'lich_normal', 'ent_elite' 等
     */
    setEnemyType(enemyType: string): void {
        console.log(`[ConfigComponent] 🔧 设置敌人类型: ${enemyType}`);
        this._explicitEnemyType = enemyType;
        
        // 重新加载配置
        this.loadEnemyConfig();
    }

    /**
     * 获取敌人配置ID - 支持多种模式
     */
    getEnemyConfigId(): string {
        // 优先级1：显式设置的类型（正常模式下由MonsterSpawner设置）
        if (this._explicitEnemyType) {
            return this._explicitEnemyType;
        }
        
        // 优先级2：从GameManager获取（手动测试模式）
        if (!GameManager.instance) {
            console.warn('[ConfigComponent] GameManager.instance 不存在，使用默认敌人类型');
            return 'ent_normal';
        }

        // 检查是否为手动测试模式
        if (GameManager.instance.manualTestMode) {
            const availableTypes = GameManager.instance.getAvailableEnemyTypes();
            const currentIndex = GameManager.instance.testEnemyType;
            
            if (currentIndex >= 0 && currentIndex < availableTypes.length) {
                const enemyType = availableTypes[currentIndex];
                console.log(`[ConfigComponent] 🎮 手动测试模式，从 GameManager 获取敌人类型: ${enemyType} (索引: ${currentIndex})`);
                return enemyType;
            } else {
                console.warn(`[ConfigComponent] GameManager 中的敌人类型索引 ${currentIndex} 无效，使用默认类型`);
                return 'ent_normal';
            }
        }
        
        // 优先级3：正常模式的处理
        if (GameManager.instance.normalMode) {
            const isInitializing = !this.node.activeInHierarchy || this.node.name.includes('Pool');
            
            if (isInitializing) {
                console.log(`[ConfigComponent] 📝 正常模式初始化中，暂时使用默认类型 (节点: ${this.node.name})`);
            } else {
                console.log(`[ConfigComponent] ⚠️ 正常模式但未设置敌人类型，使用默认类型 (建议通过 setEnemyType 设置)`);
            }
        }
        
        return 'ent_normal';
    }

    /**
     * 获取敌人数据
     */
    getEnemyData(): EnemyData | null {
        return this._enemyData;
    }

    /**
     * 获取角色类型
     */
    getCharacterType(): string {
        return this.getEnemyConfigId();
    }

    /**
     * 获取角色显示名称
     */
    getCharacterDisplayName(): string {
        const baseId = this.getEnemyConfigId();
        return `Character_${baseId}`;
    }

    /**
     * 加载敌人配置 - 重构版本，只加载数据不初始化组件
     */
    loadEnemyConfig(): void {
        const configId = this.getEnemyConfigId();
        this._enemyData = dataManager.getEnemyData(configId);
        
        if (this._enemyData) {
            console.log(`[ConfigComponent] 成功加载敌人配置: ${configId}`);
            
            // 通知其他组件配置已加载
            this.node.emit('enemy-config-loaded', this._enemyData);
            
            // 分析攻击类型（仅数据分析，不初始化组件）
            this.analyzeEnemyAttackType();
        } else {
            console.error(`[ConfigComponent] 无法加载配置 ${configId}`);
        }
    }

    /**
     * 手动初始化相关组件 - 由工厂统一调用
     */
    initializeRelatedComponentsManually(): void {
        this.initializeRelatedComponents();
    }

    /**
     * 初始化AI
     */
    initializeAI(): void {
        const controlComponent = this.getComponent('ControlComponent') as any;
        if (!controlComponent || controlComponent.controlMode !== 1) { // ControlMode.AI
            return;
        }
        
        if (!this._enemyData) {
            console.warn(`[ConfigComponent] 敌人数据未加载，无法初始化AI`);
            return;
        }
        
        console.log(`[ConfigComponent] 初始化AI系统，行为类型: ${this._aiBehaviorType}`);
        
        // 通知其他组件AI初始化
        this.node.emit('ai-initialized', {
            behaviorType: this._aiBehaviorType,
            enemyData: this._enemyData
        });
    }

    /**
     * 等待数据管理器加载完成
     */
    async waitForDataManager(): Promise<void> {
        // 检查数据是否已经加载
        if (dataManager.isDataLoaded()) {
            console.log(`[ConfigComponent] 数据已加载，无需等待`);
            return;
        }
        
        // 使用Promise等待数据加载完成
        return new Promise((resolve) => {
            const checkDataLoaded = () => {
                if (dataManager.isDataLoaded()) {
                    console.log(`[ConfigComponent] 数据加载完成`);
                    resolve();
                } else {
                    // 继续等待
                    setTimeout(checkDataLoaded, 100);
                }
            };
            
            // 开始检查
            checkDataLoaded();
            
            // 备用方案：触发数据加载
            if (!dataManager.isDataLoaded()) {
                dataManager.loadAllData().then(() => {
                    resolve();
                }).catch((error) => {
                    console.error(`[ConfigComponent] 数据加载失败:`, error);
                    resolve(); // 即使失败也要resolve，避免永久等待
                });
            }
        });
    }

    /**
     * 分析敌人攻击类型（近战/远程）
     */
    analyzeEnemyAttackType(): { isRanged: boolean, hasRangedSkills: boolean } {
        if (!this._enemyData) {
            return { isRanged: false, hasRangedSkills: false };
        }

        const enemyId = this._enemyData.id;
        let isRanged = false;

        // 1. 检查是否有projectileId
        if (this._enemyData.projectileId) {
            isRanged = true;
            console.log(`[ConfigComponent] 检测到projectileId: ${this._enemyData.projectileId}，判定为远程攻击`);
        }

        // 2. 检查技能中是否有远程攻击技能
        if (!isRanged && this._enemyData.skills) {
            const hasRangedSkill = this._enemyData.skills.some(skill => 
                skill.id === 'fireball' || 
                skill.id === 'lightning' || 
                skill.id.includes('ranged') ||
                skill.id.includes('projectile')
            );
            if (hasRangedSkill) {
                isRanged = true;
                console.log(`[ConfigComponent] 检测到远程技能，判定为远程攻击`);
            }
        }

        // 3. 检查是否有projectileOffsets
        if (!isRanged && (this._enemyData as any).projectileOffsets) {
            isRanged = true;
            console.log(`[ConfigComponent] 检测到projectileOffsets，判定为远程攻击`);
        }

        // 4. 基于敌人ID判断（向后兼容）
        if (!isRanged && enemyId.indexOf('lich') !== -1) {
            isRanged = true;
            console.log(`[ConfigComponent] 基于敌人ID判断为远程攻击（向后兼容）`);
        }

        const result = { isRanged, hasRangedSkills: isRanged };
        const attackType = result.isRanged ? '远程攻击' : '近战攻击';
        console.log(`[ConfigComponent] 攻击类型分析完成: ${attackType} (敌人ID: ${enemyId})`);
        
        return result;
    }

    /**
     * 获取远程技能名称
     */
    getRemoteSkillNames(): string {
        const analysis = this.analyzeEnemyAttackType();
        if (analysis.isRanged) {
            return 'fireball'; // 默认使用火球术
        }
        return '';
    }

    /**
     * 初始化相关组件
     */
    private initializeRelatedComponents(): void {
        if (!this._enemyData) return;

        // 通知CharacterStats组件
        const characterStats = this.getComponent('CharacterStats');
        if (characterStats && typeof (characterStats as any).initWithEnemyData === 'function') {
            (characterStats as any).initWithEnemyData(this._enemyData);
        }

        // 通知动画组件
        const animationComponent = this.getComponent('AnimationComponent') as any;
        if (animationComponent && typeof animationComponent.setEnemyData === 'function') {
            animationComponent.setEnemyData(this._enemyData);
        }

        // 分析攻击类型并通知战斗组件
        const attackAnalysis = this.analyzeEnemyAttackType();
        this.node.emit('attack-type-analyzed', attackAnalysis);
    }

    /**
     * 重用回调
     */
    private onReuse(): void {
        if (!this._explicitEnemyType) {
            console.warn(`[ConfigComponent] ⚠️ 重用时未发现预设敌人类型，将在后续初始化中确定`);
        }
        
        // 重新加载配置
        this.loadEnemyConfig();
    }

    /**
     * 重置状态回调
     */
    private onResetState(): void {
        // 保持配置数据，只重置运行时状态
        console.log(`[ConfigComponent] 重置配置状态完成`);
    }
}