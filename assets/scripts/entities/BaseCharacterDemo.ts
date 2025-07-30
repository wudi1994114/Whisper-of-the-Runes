import { _decorator, Component, Animation, Sprite, Vec2, Node, EventKeyboard, KeyCode, input, Input, find, Graphics, Color, Collider2D, RigidBody2D, Enum, UITransform, instantiate, Prefab, Label, tween, director, Vec3, ERigidBody2DType, BoxCollider2D, CircleCollider2D } from 'cc';
import { dataManager } from '../managers/DataManager';
import { EnemyData } from '../configs/EnemyConfig';
import { CharacterStats } from '../components/CharacterStats';
import { HealthBarComponent } from '../components/HealthBarComponent';
import { systemConfigManager } from '../configs/SystemConfig';
import { AnimationState, AnimationDirection } from '../configs/AnimationConfig';
import { animationManager } from '../managers/AnimationManager';
import { Faction, FactionUtils } from '../configs/FactionConfig';
import { TargetInfo } from '../components/MonsterAI';

import { factionManager } from '../managers/FactionManager';
import { GameEvents } from '../components/GameEvents';
import { eventManager } from '../managers/EventManager';
import { FireballLauncher } from '../controllers/FireballLauncher';
import { GameManager } from '../managers/GameManager';
import { damageDisplayController } from '../controllers/DamageDisplayController';
import { ICrowdableCharacter } from '../systems/GridManager';
import { OrcaAgent } from '../components/OrcaAgent';
import { getOrcaSystem } from '../systems/OrcaSystem';
import { gridManager } from '../systems/GridManager';
import { AINavigationController } from '../controllers/AINavigationController';
import { AIPerformanceManager } from '../systems/AIPerformanceManager';
import { TempVarPool } from '../utils/TempVarPool';
import { ControlMode, CharacterState } from '../state-machine/CharacterEnums';
import { StateMachine, ICharacterController } from '../state-machine/CharacterStateMachine';
import { CharacterPoolFactory } from '../pool/CharacterPoolSystem';
import { TargetSelectorFactory } from '../configs/TargetSelectorFactory';


const { ccclass, property } = _decorator;

@ccclass('BaseCharacterDemo')
export class BaseCharacterDemo extends Component implements ICrowdableCharacter, ICharacterController {

    @property({
        displayName: "移动速度",
        tooltip: "角色移动速度（像素/秒）"
    })
    protected moveSpeed: number =5;

    @property({
        displayName: "角色ID",
        tooltip: "用于对象池管理的角色标识"
    })
    public characterId: string = '';

    @property({
        type: Enum(ControlMode),
        displayName: "控制模式",
        tooltip: "MANUAL: 键盘手动控制, AI: 自动AI控制"
    })
    public controlMode: ControlMode = ControlMode.MANUAL;

    @property({
        displayName: "AI阵营",
        tooltip: "AI模式下的阵营 (red/blue/green/purple/player)"
    })
    public aiFaction: string = "red";

    public aiBehaviorType: string = "melee";

    // 【新架构】输入信号系统 - 统一的状态机输入接口
    private currentInputSignals = {
        hasMovementInput: false,
        wantsToAttack: false,
        // 未来可扩展其他输入信号
    };

    // 核心组件
    protected animationComponent: Animation | null = null;
    protected spriteComponent: Sprite | null = null;
    protected characterStats: CharacterStats | null = null;
    protected rigidBody: RigidBody2D | null = null;
    protected collider: CircleCollider2D | null = null;
    protected orcaAgent: OrcaAgent | null = null;
    protected aiNavigationController: AINavigationController | null = null;
    
    // 敌人配置数据
    protected enemyData: EnemyData | null = null;
    
    // 状态机
    protected stateMachine: import('../state-machine/CharacterStateMachine').StateMachine | null = null;
    protected currentDirection: AnimationDirection = AnimationDirection.FRONT;
    
    // 输入状态
    protected keyStates: { [key: number]: boolean } = {};
    protected moveDirection: Vec2 = new Vec2(0, 0); // 【注意】这个是成员变量，保持创建
    
    // 攻击间隔控制
    protected lastAttackTime: number = 0;
    protected attackCooldown: number = 1.0; // 默认攻击间隔（秒）
    
    // AI相关属性已整合到enemyData中
    protected currentTarget: Node | null = null;
    protected targetInfo: TargetInfo | null = null;
    protected lastTargetSearchTime: number = 0;
    protected targetSearchInterval: number = 1000; // 1秒搜索一次目标
    protected originalPosition: Vec3 = new Vec3(); // AI回归位置
    protected lastAIDebugTime: number = 0; // AI调试日志频率控制
    protected lastFallbackWarningTime: number = 0; // 回退系统警告频率控制
    
    // 血条显示系统
    protected healthBarNode: Node | null = null;
    protected healthBarGraphics: Graphics | null = null;
    
    // 对象池相关
    protected isFromPool: boolean = false;
    protected poolName: string = '';
    
    // 无敌状态标志位
    private isInvincible: boolean = false;

    // 智能攻击系统 (从UniversalCharacterDemo合并)
    private fireballLauncher: FireballLauncher | null = null;
    private isRangedAttacker: boolean = false;
    private hasRangedSkills: boolean = false;
    
    // 显式设置的敌人类型（用于正常模式下MonsterSpawner设置）
    private explicitEnemyType: string | null = null;

    /**
     * 设置敌人类型 - 供MonsterSpawner等外部调用
     * @param enemyType 敌人类型ID，如 'lich_normal', 'ent_elite' 等
     */
    public setEnemyType(enemyType: string): void {
        console.log(`[BaseCharacterDemo] 🔧 设置敌人类型: ${enemyType}`);
        this.explicitEnemyType = enemyType;
    }

    /**
     * 获取敌人配置ID - 支持多种模式 (从UniversalCharacterDemo合并)
     */
    protected getEnemyConfigId(): string {
        // 优先级1：显式设置的类型（正常模式下由MonsterSpawner设置）
        if (this.explicitEnemyType) {
            return this.explicitEnemyType;
        }
        
        // 优先级2：从GameManager获取（手动测试模式）
        if (!GameManager.instance) {
            console.warn('[BaseCharacterDemo] GameManager.instance 不存在，使用默认敌人类型');
            return 'ent_normal';
        }

        // 检查是否为手动测试模式
        if (GameManager.instance.manualTestMode) {
            const availableTypes = GameManager.instance.getAvailableEnemyTypes();
            const currentIndex = GameManager.instance.testEnemyType;
            
            if (currentIndex >= 0 && currentIndex < availableTypes.length) {
                const enemyType = availableTypes[currentIndex];
                console.log(`[BaseCharacterDemo] 🎮 手动测试模式，从 GameManager 获取敌人类型: ${enemyType} (索引: ${currentIndex})`);
                return enemyType;
            } else {
                console.warn(`[BaseCharacterDemo] GameManager 中的敌人类型索引 ${currentIndex} 无效，使用默认类型`);
                return 'ent_normal';
            }
        }
        
        // 优先级3：正常模式的处理
        if (GameManager.instance.normalMode) {
            // 【修复】检查是否正在初始化过程中，如果是则延迟警告
            const isInitializing = !this.node.activeInHierarchy || this.node.name.includes('Pool');
            
            if (isInitializing) {
                console.log(`[BaseCharacterDemo] 📝 正常模式初始化中，暂时使用默认类型 (节点: ${this.node.name})`);
            } else {
                console.log(`[BaseCharacterDemo] ⚠️ 正常模式但未设置敌人类型，使用默认类型 (建议通过 setEnemyType 设置)`);
            }
        }
        
        return 'ent_normal';
    }

    /**
     * 获取角色显示名称 - 基于敌人类型生成
     */
    protected getCharacterDisplayName(): string {
        const baseId = this.getEnemyConfigId();
        return `BaseCharacterDemo_${baseId}`;
    }

    /**
     * 执行特殊攻击逻辑 - 智能判断攻击方式 (从UniversalCharacterDemo合并)
     */
    protected performSpecialAttack(): void {
        if (!this.enemyData) {
            this.performMeleeAttack();
            return;
        }

        // 检查是否为远程攻击敌人
        if (this.isRangedAttacker) {
            this.performRangedAttack();
        } else {
            this.performMeleeAttack();
        }
    }

    /**
     * 执行近战攻击伤害逻辑
     */
    protected performMeleeAttack(): void {
        if (!this.characterStats || !this.enemyData) {
            console.warn(`[${this.getCharacterDisplayName()}] 缺少必要组件，无法执行近战攻击`);
            return;
        }

        let targetToAttack: Node | null = null;
        let attackDamage = this.characterStats.baseAttack;

        // AI模式：攻击当前目标
       
        if (this.controlMode === ControlMode.AI && this.currentTarget) {
            const distance = Vec2.distance(this.node.position, this.currentTarget.position);
            const attackRange = this.enemyData?.attackRange || 60;
            
            if (distance <= attackRange) {
                targetToAttack = this.currentTarget;
            }
        }
        // 手动模式：搜索附近的敌人
        else if (this.controlMode === ControlMode.MANUAL) {
            targetToAttack = this.findNearestEnemy();
        }

        // 对目标造成伤害
        if (targetToAttack) {
            this.dealDamageToTarget(targetToAttack, attackDamage);
        }
    }

    /**
     * 执行远程攻击（火球发射）- 从UniversalCharacterDemo合并
     */
    protected performRangedAttack(): void {
        if (!this.fireballLauncher) {
            console.warn(`[${this.getCharacterDisplayName()}] 远程攻击敌人但火球发射器未初始化`);
            return;
        }

        // 🔥 【重要修改】直接发射火球，不再使用额外的延迟
        // 因为此方法现在只会在 onAttackDamageFrame() 中被调用，已经有正确的时机控制
        console.log(`[${this.getCharacterDisplayName()}] 立即触发远程攻击 - 发射火球`);
        
        // 根据当前状态调整火球参数
        this.adjustFireballParamsBasedOnState();
        
        // 直接发射火球
        this.launchFireball();
    }

    /**
     * 计算火球触发时间（基于动画帧率和敌人配置）
     * 🗑️ 【已废弃】此方法不再使用，因为火球现在直接在 attackDamageFrame 帧触发
     */
    private calculateFireballTriggerTime(): number {
        if (!this.enemyData) return 333; // 默认值

        // ⚠️ 注意：此方法已废弃，保留仅为向后兼容
        // 现在火球发射时机完全由 attackDamageFrame 控制
        const frameRate = this.enemyData.animationSpeed || 12;
        const triggerFrame = this.enemyData.attackDamageFrame || 5; // 🔧 修复：使用 attackDamageFrame
        return (triggerFrame / frameRate) * 1000; // 转换为毫秒
    }

    /**
     * 根据敌人状态动态调整火球参数
     */
    private adjustFireballParamsBasedOnState(): void {
        if (!this.enemyData || !this.characterStats) return;

        // 获取生命值百分比
        const healthPercent = this.characterStats.currentHealth / this.characterStats.maxHealth;
        
        // 基于怪物配置的基础伤害值计算
        let damage = this.enemyData.baseAttack;
        
        // 血量越低，火球伤害越高（狂暴效果）
        if (healthPercent < 0.3) {
            damage = Math.floor(this.enemyData.baseAttack * 1.8); // 高伤害
            console.log(`[${this.getCharacterDisplayName()}] 进入狂暴状态，火球威力大幅提升！`);
        } else if (healthPercent < 0.6) {
            damage = Math.floor(this.enemyData.baseAttack * 1.4); // 中等伤害
            console.log(`[${this.getCharacterDisplayName()}] 受伤状态，火球威力提升`);
        }
        
        // 更新火球发射器的伤害
        if (this.fireballLauncher) {
            this.fireballLauncher.damage = damage;
        }
    }

    /**
     * 发射火球 - 支持动态瞄准（AI模式瞄准当前目标，手动模式瞄准最近敌人）
     */
    private launchFireball(): void {
        if (!this.fireballLauncher) {
            console.warn(`[${this.getCharacterDisplayName()}] 火球发射器未初始化`);
            return;
        }

        let targetToAim: any = null;

        // 根据控制模式选择目标
        if (this.controlMode === ControlMode.AI) {
            // AI模式：瞄准当前AI目标
            targetToAim = this.getAICurrentTarget?.() || this.currentTarget;
        } else if (this.controlMode === ControlMode.MANUAL) {
            // 手动模式：智能瞄准最近的敌人
            targetToAim = this.findNearestEnemy?.();
        }
        
        if (targetToAim && targetToAim.isValid) {
            // 直接朝目标位置发射火球（精确瞄准）
            const targetPos = targetToAim.position;
            const mode = this.controlMode === ControlMode.AI ? 'AI' : '手动';
            console.log(`[${this.getCharacterDisplayName()}] 🎯 ${mode}模式精确瞄准目标 ${targetToAim.name} 位置: (${targetPos.x.toFixed(1)}, ${targetPos.y.toFixed(1)})`);
            this.fireballLauncher.launchFireballToPosition(targetPos);
        } else {
            // 没有目标时按角度发射
            const targetAngle = this.calculateLaunchAngle();
            console.log(`[${this.getCharacterDisplayName()}] 📐 无目标，按朝向发射火球: ${targetAngle}°`);
            this.fireballLauncher.launchFireballAtAngle(targetAngle);
        }
        
        console.log(`[${this.getCharacterDisplayName()}] 🔥 火球发射完成！伤害: ${this.fireballLauncher.damage}`);
    }

    /**
     * 动态计算发射角度 - 优先瞄准当前目标，否则基于朝向（性能优化：避免创建临时对象）
     */
    private calculateLaunchAngle(): number {
        // 优先瞄准当前AI目标
        const currentTarget = this.getAICurrentTarget?.() || this.currentTarget;
        
        if (currentTarget && currentTarget.isValid) {
            // 【性能优化】直接使用 position 属性，避免创建临时变量
            const myPos = this.node.position;
            const targetPos = currentTarget.position;
            
            // 计算方向向量（直接计算，无需临时对象）
            const deltaX = targetPos.x - myPos.x;
            const deltaY = targetPos.y - myPos.y;
            
            // 计算角度（弧度转角度）
            const angleRadians = Math.atan2(deltaY, deltaX);
            const angleDegrees = angleRadians * 180 / Math.PI;
            
            return angleDegrees;
        }
        
        // 备用方案：没有目标时基于角色朝向计算角度
        let baseAngle = 0;
        
        // 根据当前朝向确定基础角度
        switch (this.currentDirection) {
            case AnimationDirection.FRONT:
                baseAngle = -90; // 向下
                break;
            case AnimationDirection.BACK:
                baseAngle = 90;  // 向上
                break;
            case AnimationDirection.LEFT:
                baseAngle = 180; // 向左
                break;
            case AnimationDirection.RIGHT:
                baseAngle = 0;   // 向右
                break;
            default:
                baseAngle = 0;
        }
        
        console.log(`[${this.getCharacterDisplayName()}] 📐 基于朝向发射，角度: ${baseAngle}°`);
        return baseAngle;
    }

    /**
     * 寻找最近的敌人（手动模式用）
     */
    protected findNearestEnemy(): Node | null {
        if (!this.enemyData) return null;

        const attackRange = this.enemyData.attackRange || 60;
        const selector = TargetSelectorFactory.getInstance();
        if (!selector) {
            console.warn(`[${this.getCharacterDisplayName()}] 目标选择器工厂未初始化，无法查找敌人`);
            return null;
        }

        // 获取当前角色的阵营
        let myFaction = this.getFaction();
        
        // 查找最近的敌人
        const targetInfo = selector.findBestTarget(this.node.position, myFaction, attackRange);
        return targetInfo ? targetInfo.node : null;
    }

    /**
     * 对目标造成伤害
     */
    protected dealDamageToTarget(target: Node, damage: number): void {
        if (!target || !target.isValid) {
            console.warn(`[${this.getCharacterDisplayName()}] 无效的攻击目标`);
            return;
        }

        // 获取目标的BaseCharacterDemo组件来造成伤害（优先使用类型获取，效率更高）
        const targetCharacterDemo = target.getComponent(BaseCharacterDemo);
        if (targetCharacterDemo && targetCharacterDemo.takeDamage) {
            targetCharacterDemo.takeDamage(damage);
        } else {
            // 如果没有BaseCharacterDemo，尝试CharacterStats组件
            const targetStats = target.getComponent(CharacterStats);
            if (targetStats && targetStats.takeDamage) {
                targetStats.takeDamage(damage);
            } else {
                console.warn(`[${this.getCharacterDisplayName()}] 目标 ${target.name} 没有可攻击的组件`);
            }
        }
    }

    /**
     * 获取敌人数据配置
     */
    public getEnemyData(): EnemyData | null {
        return this.enemyData;
    }

    /**
     * 获取角色类型（公开版本的getEnemyConfigId）
     */
    public getCharacterType(): string {
        return this.getEnemyConfigId();
    }

    /**
     * 【新架构】状态机查询接口 - 检查是否有移动输入
     */
    public hasMovementInput(): boolean {
        return this.currentInputSignals.hasMovementInput;
    }
    
    /**
     * 【新架构】状态机查询接口 - 获取攻击意图
     */
    public get wantsToAttack(): boolean {
        return this.currentInputSignals.wantsToAttack;
    }
    
    /**
     * 【新架构】状态机查询接口 - 设置攻击意图（用于手动模式）
     */
    public set wantsToAttack(value: boolean) {
        this.currentInputSignals.wantsToAttack = value;
    }

    /**
     * 立即停止物理运动
     */
    public stopPhysicalMovement(): void {
        if (this.rigidBody) {
            // 【性能优化】使用临时变量池设置零速度
            this.rigidBody.linearVelocity = TempVarPool.tempVec2_4.set(0, 0);
        }
    }
    
    /**
     * 【新架构】统一的停止移动接口 - 封装所有停止移动的细节
     */
    public stopMovement(): void {
        // 1. 通过ORCA系统停止移动（最重要的控制点）
        if (this.orcaAgent) {
            this.orcaAgent.prefVelocity.set(0, 0);
        }
        
        // 2. 通过物理系统停止移动（直接控制）
        if (this.rigidBody) {
            // 【性能优化】使用临时变量池设置零速度
            this.rigidBody.linearVelocity = TempVarPool.tempVec2_5.set(0, 0);
        }
        
        // 3. 通过导航系统停止移动（如果存在，作为补充保障）
        if (this.aiNavigationController) {
            this.aiNavigationController.stopMovement();
        }
        
        // 4. 清空移动方向（特别是手动模式）
        this.moveDirection.set(0, 0);
    }

    /**
     * 播放受伤动画
     */
    public playHurtAnimation(): void {
        this.playHurtAnimationWithCallback(null);
    }

    /**
     * 播放受伤动画并设置完成回调
     */
    public playHurtAnimationWithCallback(callback: (() => void) | null): void {
        if (!this.animationComponent || !this.enemyData) {
            console.warn(`[${this.getCharacterDisplayName()}] 动画组件或敌人数据未初始化`);
            if (callback) callback();
            return;
        }

        // 构建完整的动画名称
        const animationName = `${this.enemyData.assetNamePrefix}_${AnimationState.HURT}_${this.currentDirection}`;

        // 使用 AnimationManager 播放受伤动画
        const success = animationManager.playAnimation(this.animationComponent, animationName);
        
        if (success) {
            // 清除之前的监听器
            this.animationComponent.off(Animation.EventType.FINISHED);
            
            // 移除受伤动画播放日志
            
            // 设置受伤动画结束回调
            this.animationComponent.once(Animation.EventType.FINISHED, () => {
                if (callback) {
                    callback();
                }
            });
        } else {
            console.warn(`[${this.getCharacterDisplayName()}] 受伤动画播放失败: ${animationName}`);
            if (callback) callback();
        }
    }

    /**
     * 播放死亡动画
     */
    public playDeathAnimation(): void {
        this.playCurrentAnimation(AnimationState.DEATH);
    }

    /**
     * 创建血条
     */
    private createHealthBar(): void {
        // 获取角色类型和基础血条配置
        const characterName = this.getCharacterDisplayName();
        const baseConfig = systemConfigManager.getHealthBarConfigForCharacter(characterName);
        
        // 获取角色的实际尺寸用于比例计算
        const uiTransform = this.node.getComponent(UITransform);
        const characterWidth = uiTransform ? uiTransform.contentSize.width : 64;
        const characterHeight = uiTransform ? uiTransform.contentSize.height : 64;
        
        // 计算最终血条配置（支持比例）
        const finalConfig = systemConfigManager.calculateFinalHealthBarConfig(
            baseConfig, 
            characterWidth, 
            characterHeight,
            this.enemyData
        );
        
        // 创建血条容器
        this.healthBarNode = new Node('HealthBar');
        this.healthBarNode.setParent(this.node);
        
        // 设置血条位置
        this.healthBarNode.setPosition(0, finalConfig.offsetY, 0);
        
        // 添加 UITransform 组件
        const transform = this.healthBarNode.addComponent(UITransform);
        transform.setContentSize(finalConfig.width, finalConfig.height);
        
        // 添加 Graphics 组件用于绘制血条
        this.healthBarGraphics = this.healthBarNode.addComponent(Graphics);
        
        // 绘制血条
        this.updateHealthBar();
        
    }

    /**
     * 更新血条显示
     */
    private updateHealthBar(): void {
        if (!this.healthBarGraphics || !this.characterStats || !this.healthBarNode) return;
        
        const currentHealth = this.characterStats.currentHealth;
        const maxHealth = this.characterStats.maxHealth;
        const healthPercent = maxHealth > 0 ? currentHealth / maxHealth : 0;
        
        // 获取血条的实际尺寸
        const healthBarTransform = this.healthBarNode.getComponent(UITransform);
        if (!healthBarTransform) return;
        
        const barWidth = healthBarTransform.contentSize.width;
        const barHeight = healthBarTransform.contentSize.height;
        const halfWidth = barWidth / 2;
        const halfHeight = barHeight / 2;
        
        // 清除之前的绘制
        this.healthBarGraphics.clear();
        
        // 绘制背景（深灰色边框）
        this.healthBarGraphics.strokeColor = new Color(30, 30, 30, 255);
        this.healthBarGraphics.lineWidth = 1;
        this.healthBarGraphics.rect(-halfWidth, -halfHeight, barWidth, barHeight);
        this.healthBarGraphics.stroke();
        
        // 绘制背景填充（深灰色）
        this.healthBarGraphics.fillColor = new Color(50, 50, 50, 255);
        this.healthBarGraphics.rect(-halfWidth, -halfHeight, barWidth, barHeight);
        this.healthBarGraphics.fill();
        
        // 绘制血量填充
        if (healthPercent > 0) {
            const fillWidth = barWidth * healthPercent;
            
            // 根据血量百分比选择颜色
            let fillColor: Color;
            if (healthPercent > 0.6) {
                fillColor = new Color(0, 255, 0, 255); // 绿色
            } else if (healthPercent > 0.3) {
                fillColor = new Color(255, 255, 0, 255); // 黄色
            } else {
                fillColor = new Color(255, 0, 0, 255); // 红色
            }
            
            this.healthBarGraphics.fillColor = fillColor;
            this.healthBarGraphics.rect(-halfWidth, -halfHeight, fillWidth, barHeight);
            this.healthBarGraphics.fill();
        }
        
        // 移除血条更新日志，避免频繁输出
    }



    /**
     * 受到伤害
     */
    public takeDamage(damage: number): void {
        // 1. 检查无敌状态，防止被连续快速伤害
        if (!this.characterStats) {
            return;
        }

        // 2. 从CharacterStats获取详细的伤害结果
        const result = this.characterStats.takeDamage(damage);

        // 3. 触发短暂的无敌时间 (无论是硬直还是闪红，都应该有无敌)
        // 硬直的无敌时间可以长一点，闪红的短一点
        const invincibilityDuration = result.isStunned ? 0.6 : 0.2;
        this.activateInvincibility(invincibilityDuration);

        // 4. 显示伤害数字和更新血条（这部分逻辑不变）
        this.showDamageText(damage);
        this.updateHealthBar();

        // 5. 根据结果执行不同的表现
        if (result.isDead) {
            // 角色死亡
            this.stateMachine?.transitionTo(CharacterState.DEAD);
        } else if (result.isStunned) {
            // 霸体值为0，产生硬直 -> 播放完整受伤动画
            this.stateMachine?.transitionTo(CharacterState.HURT);
        } else {
            // 霸体值>0，不产生硬直 -> 仅播放闪红特效
            this.playRedFlashEffect();
        }

    }

    /**
     * 显示伤害数字（通过全局频率控制器，0.1秒最多显示3个）
     */
    private showDamageText(damage: number): void {
        // 通过全局频率控制器请求显示伤害数字
        const displayed = damageDisplayController.requestDamageDisplay(
            damage,
            this.node.position,
            this.node.parent || this.node,
            this.getCharacterDisplayName()
        );
        
        if (!displayed) {
            // 如果由于频率限制未能显示，可以在这里添加其他反馈（如音效）
            console.log(`[${this.getCharacterDisplayName()}] 伤害 ${damage} 因频率限制未显示`);
        }
    }

    /**
     * 伤害测试 - 按H键触发
     */
    private testDamage(): void {
        if (this.stateMachine?.isInState(CharacterState.DEAD)) {
            return;
        }
        
        const damage = Math.floor(Math.random() * 10) + 1; // 1-10000点随机伤害
        this.takeDamage(damage);
    }

    /**
     * 死亡测试 - 按K键触发
     */
    private testDeath(): void {
        if (this.characterStats) {
            // 直接造成致命伤害
            const result = this.characterStats.takeDamage(this.characterStats.maxHealth);
            this.updateHealthBar();
            if (result.isDead) {
                this.stateMachine?.transitionTo(CharacterState.DEAD);
            }
        }
    }

    /**
     * 激活无敌帧
     * @param duration 无敌持续时间（秒）
     */
    public activateInvincibility(duration: number): void {
        if (this.isInvincible) return; // 如果已经是无敌的，则不重置计时器

        this.isInvincible = true;
        this.scheduleOnce(() => {
            this.isInvincible = false;
        }, duration);
    }

    /**
     * 播放身体闪红的特效
     */
    private playRedFlashEffect(): void {
        if (!this.spriteComponent) return;

        // 停止可能正在进行的旧的闪烁动画，防止冲突
        tween(this.spriteComponent).stop();

        // 将颜色设置为红色，然后用0.1秒缓动回白色
        this.spriteComponent.color = Color.RED;
        tween(this.spriteComponent)
            .to(0.1, { color: Color.WHITE })
            .start();
    }



    /**
     * 初始化AI - 使用新的AINavigationController系统
     */
    public initializeAI(): void {
        if (this.controlMode !== ControlMode.AI) {
            return;
        }
        
        if (!this.enemyData) {
            return;
        }
        
        // 【修复】只在首次初始化时设置原始位置，重用时保持原有位置
        if (!this.originalPosition || this.originalPosition.equals(Vec3.ZERO)) {
            this.originalPosition.set(this.node.position);
        }

        // 初始化AINavigationController
        if (this.aiNavigationController) {
            const faction = this.getFaction();
            
            this.aiNavigationController.initializeNavigation(this.aiBehaviorType, faction, {
                detectionRange: this.enemyData.detectionRange || 200,
                attackRange: this.enemyData.attackRange || 60,
                pathUpdateInterval: 2.0,
                pathNodeThreshold: 20,
                maxPathAge: 10.0,
                blockedCheckInterval: 1.0,
                giveUpDistance: this.enemyData.pursuitRange || 400
            });
            
            // 【性能优化】安全地注册到AI性能管理器（支持重复调用）
            const performanceManager = AIPerformanceManager.getInstance();
            if (performanceManager) {
                // 先反注册再注册，确保不会重复
                performanceManager.unregisterAI(this.node);
                performanceManager.registerAI(this.node, this.aiNavigationController);
            }
        } else {
            // 【修复】清理可能存在的旧定时器，避免重复
            this.unschedule(this.updateAITargetSearch);
            // 回退到旧的目标搜索系统
            const searchInterval = this.targetSearchInterval / 1000;
            this.schedule(this.updateAITargetSearch, searchInterval);
        }
    }

    /**
     * AI目标搜索（性能优化：改为定时器调用，无需时间间隔检查）
     */
    private updateAITargetSearch(): void {
        if (!this.enemyData) return;
        
        const selector = TargetSelectorFactory.getInstance();
        if (!selector) {
            console.warn(`[${this.getCharacterDisplayName()}] 目标选择器工厂未初始化`);
            return;
        }
        // 使用CharacterStats中的实际阵营
        const myFaction = this.aiFaction;
        
        // 搜索最佳目标
        const detectionRange = this.enemyData.detectionRange || 200;
        const bestTarget = selector.findBestTarget(
            this.node.position,
            FactionUtils.stringToFaction(myFaction),
            detectionRange
        );

        // 更新目标 - 只在目标变化时输出日志
        if (bestTarget && bestTarget.node !== this.currentTarget) {
            // 只在目标变化时输出简化日志
            this.currentTarget = bestTarget.node;
            this.targetInfo = bestTarget;
        } else if (this.currentTarget) {
            // 检查当前目标是否仍然有效
            const targetStats = this.currentTarget.getComponent(CharacterStats);
            const distance = Vec3.distance(this.node.position, this.currentTarget.position);
            const pursuitRange = this.enemyData.pursuitRange || 300;

            if (!targetStats || !targetStats.isAlive || distance > pursuitRange) {
                this.currentTarget = null;
                this.targetInfo = null;
            }
        }
    }

    /**
     * 设置AI移动方向（基于物理系统的移动）
     */
    private setAIMoveDirection(targetPosition: Vec3): void {
        // 【性能优化】复用静态临时变量，避免频繁创建对象
        const direction = TempVarPool.tempVec2_1;
        const targetVec2 = TempVarPool.tempVec2_2;
        const nodeVec2 = TempVarPool.tempVec2_3;
        
        // 设置临时变量值
        targetVec2.set(targetPosition.x, targetPosition.y);
        nodeVec2.set(this.node.position.x, this.node.position.y);
        
        // 计算方向向量
        Vec2.subtract(direction, targetVec2, nodeVec2);
        
        direction.normalize();
        this.moveDirection.set(direction.x, direction.y);
        // 更新角色朝向
        this.updateDirectionTowards(targetPosition);
    }

    private updateDirectionTowards(targetPosition: Vec3): void {
        // 【性能优化】复用静态临时变量，避免频繁创建对象
        const direction = TempVarPool.tempVec3_2;
        Vec3.subtract(direction, targetPosition, this.node.position);
    
        if (Math.abs(direction.x) > Math.abs(direction.y)) {
            this.currentDirection = direction.x > 0 ? AnimationDirection.RIGHT : AnimationDirection.LEFT;
        } else {
            this.currentDirection = direction.y > 0 ? AnimationDirection.BACK : AnimationDirection.FRONT;
        }
    }

    async onLoad() {
        // 【修复1】注册BaseCharacterDemo类到对象池工厂（防重复注册已在工厂内部处理）
        CharacterPoolFactory.registerBaseCharacterClass(BaseCharacterDemo);
        
        await this.ensureManagers();
        // 等待数据管理器加载完成
        await this.waitForDataManager();
        
        // 加载角色配置
        this.loadEnemyConfig();
        
        const enemyType = this.getEnemyConfigId();
        
        // 分析敌人类型并设置攻击系统
        this.analyzeEnemyAttackType();
        
        // 如果是远程攻击敌人，初始化火球发射器
        if (this.isRangedAttacker) {
            this.setupFireballLauncher();
        }
        
        // 控制模式完全从GameManager获取
        if (GameManager.instance) {
            if (GameManager.instance.manualTestMode) {
                // 手动测试模式：设置为手动控制
                this.controlMode = ControlMode.MANUAL;
                console.log('[BaseCharacterDemo] 手动测试模式：设置为手动控制（键盘操作）');
                    } else if (GameManager.instance.normalMode) {
            // AI测试模式 + 正常模式：都设置为AI控制
            this.controlMode = ControlMode.AI;
            const mode = GameManager.instance.testMode ? 'AI测试模式' : '正常模式';
            console.log(`[BaseCharacterDemo] ${mode}：设置为AI控制`);
            } else {
                console.warn('[BaseCharacterDemo] 未知模式，使用默认控制模式');
            }
        } else {
            console.warn('[BaseCharacterDemo] GameManager不存在，使用默认控制模式');
        }
        
        // 设置组件
        this.setupComponents();
        
        // 显示尺寸范围（如果开关开启）
        this.setupSizeRangeDisplay();
        
        // 设置默认阵营（如果还未设置）
        this.setupDefaultFaction();
        
        // 设置输入系统
        this.setupInput();
        
        // 使用 AnimationManager 加载资源和创建动画
        await this.setupAnimationsWithManager();
        
        // 检查是否已有HealthBarComponent，如果没有则创建内置血条
        const healthBarComponent = this.node.getComponent(HealthBarComponent);
        if (!healthBarComponent) {
            this.createHealthBar();
        } else {
            console.log(`[${this.getCharacterDisplayName()}] 检测到HealthBarComponent，跳过内置血条创建`);
        }
        
        // 初始化状态机
        this.stateMachine = new StateMachine(this);
        this.stateMachine.start();

        if (GameManager.instance) {
            console.log(`[BaseCharacterDemo] GameManager 可用敌人类型: ${GameManager.instance.getAvailableEnemyTypes().join(', ')}`);
        }
        
        // 输出攻击类型信息
        const attackType = this.isRangedAttacker ? '远程攻击' : '近战攻击';
        const skillInfo = this.hasRangedSkills ? ` (检测到远程技能: ${this.getRemoteSkillNames()})` : ' (无远程技能)';
        const controlModeStr = this.controlMode === ControlMode.MANUAL ? '手动控制' : 'AI控制';
        console.log(`🎯 [${this.getCharacterDisplayName()}] 攻击类型: ${attackType}${skillInfo}, 控制模式: ${controlModeStr}`);

        // 注册到目标选择器
        this.registerToTargetSelector();
        
        // 注册到拥挤系统
        this.registerToCrowdingSystem();
        
        // 【修复4】延迟初始化AI，确保所有组件都已准备好
        if (this.controlMode === ControlMode.AI) {
            // 延迟一帧初始化AI，确保所有组件设置完毕
            this.scheduleOnce(() => {
                console.log(`[${this.getCharacterDisplayName()}] 开始延迟AI初始化`);
                this.initializeAI();
            }, 0.1);
        }
        
        console.log(`[${this.getCharacterDisplayName()}] 初始化完成！`);
    }

    /**
     * 使用 AnimationManager 设置动画
     */
    private async setupAnimationsWithManager(): Promise<void> {
        if (!this.enemyData) {
            console.error(`[${this.getCharacterDisplayName()}] 无敌人配置数据，无法设置动画`);
            return;
        }

        try {
            // 使用 AnimationManager 创建所有动画剪辑
            const animationClips = await animationManager.createAllAnimationClips(this.enemyData);
            
            if (animationClips.size === 0) {
                console.warn(`[${this.getCharacterDisplayName()}] 没有创建任何动画剪辑`);
                return;
            }

            // 使用 AnimationManager 设置动画组件
            this.animationComponent = animationManager.setupAnimationComponent(this.node, animationClips);
            
        } catch (error) {
            console.error(`[${this.getCharacterDisplayName()}] 动画设置失败:`, error);
        }
    }

    /**
     * 等待数据管理器加载完成（事件驱动方式）
     */
    private async waitForDataManager(): Promise<void> {
        // 检查数据是否已经加载
        if (dataManager.isDataLoaded()) {
            console.log(`[${this.getCharacterDisplayName()}] 数据已加载，无需等待`);
            return;
        }
        
        // 使用事件监听方式等待数据加载完成
        return new Promise((resolve) => {
            const onDataLoaded = () => {
                console.log(`[${this.getCharacterDisplayName()}] 数据加载完成`);
                // 移除监听器
                eventManager.off(GameEvents.GAME_DATA_LOADED, onDataLoaded);
                resolve();
            };
            
            // 监听数据加载完成事件
            eventManager.on(GameEvents.GAME_DATA_LOADED, onDataLoaded);
            
            // 备用方案：如果事件系统不可用，手动触发数据加载
            if (!dataManager.isDataLoaded()) {
                dataManager.loadAllData().then(() => {
                    onDataLoaded();
                }).catch((error) => {
                    console.error(`[${this.getCharacterDisplayName()}] 数据加载失败:`, error);
                    // 即使失败也要resolve，避免永久等待
                    onDataLoaded();
                });
            }
        });
    }

    /**
     * 加载角色敌人配置
     */
    private loadEnemyConfig(): void {
        const configId = this.getEnemyConfigId();
        this.enemyData = dataManager.getEnemyData(configId);
        if (this.enemyData) {
            // 设置攻击冷却时间
            this.attackCooldown = this.enemyData.attackInterval;
            
            // 初始化CharacterStats组件
            if (this.characterStats) {
                this.characterStats.initWithEnemyData(this.enemyData);
            }
            
        } else {
            console.error(`[${this.getCharacterDisplayName()}] 无法加载配置 ${configId}`);
        }
    }

    private setupComponents() {
        // 获取或添加当前节点的Sprite组件
        this.spriteComponent = this.getComponent(Sprite) || this.addComponent(Sprite);
        
        // 获取或添加CharacterStats组件
        this.characterStats = this.getComponent(CharacterStats) || this.addComponent(CharacterStats);
        
        // 保存节点的原始位置
        this.originalPosition.set(this.node.position);
        
        this.animationComponent = this.getComponent(Animation) || this.addComponent(Animation);
        this.rigidBody = this.getComponent(RigidBody2D) || this.addComponent(RigidBody2D);
        this.collider = this.getComponent(CircleCollider2D) || this.addComponent(CircleCollider2D);
        
        // 【新增】获取或添加OrcaAgent组件
        this.orcaAgent = this.getComponent(OrcaAgent) || this.addComponent(OrcaAgent);
        
        // 【新增】获取或添加AINavigationController组件（仅AI模式）
        if (this.controlMode === ControlMode.AI) {
            this.aiNavigationController = this.getComponent(AINavigationController) || this.addComponent(AINavigationController);
        }
        
        // // 【新增】根据配置设置UI尺寸
        this.setupUISize();
        
        // 确保节点角度锁定为0
        this.lockNodeRotation();
        
        // 配置刚体组件
        this.setupRigidBody();
        
        // 配置碰撞体组件  
        this.setupCollider();
    }

    /**
     * 根据配置设置UI尺寸
     */
    private setupUISize(): void {
        if (!this.enemyData || !this.enemyData.uiSize) {
            console.log(`[${this.getCharacterDisplayName()}] 未配置uiSize，保持默认UI尺寸`);
            return;
        }

        // 获取UITransform组件
        const uiTransform = this.node.getComponent(UITransform);
        if (!uiTransform) {
            console.warn(`[${this.getCharacterDisplayName()}] 缺少UITransform组件，无法设置UI尺寸`);
            return;
        }

        const configSize = this.enemyData.uiSize;
        const originalSize = `${uiTransform.contentSize.width}x${uiTransform.contentSize.height}`;
        
        // 设置新的UI尺寸
        uiTransform.setContentSize(configSize.width, configSize.height);
        
        console.log(`[${this.getCharacterDisplayName()}] UI尺寸已更新: ${originalSize} → ${configSize.width}x${configSize.height}`);
    }

    /**
     * 配置刚体组件
     */
    private setupRigidBody(): void {
        if (!this.rigidBody) return;
        
        // 设置为动态刚体，可以移动但受物理影响
        this.rigidBody.type = ERigidBody2DType.Dynamic;
        
        // 设置基础物理属性 - 移除阻尼以获得恒定速度
        this.rigidBody.linearDamping = 0; // 移除线性阻尼，保持恒定速度
        this.rigidBody.angularDamping = 10; // 角度阻尼，防止旋转
        this.rigidBody.gravityScale = 0; // 不受重力影响（2D俯视角游戏）
        this.rigidBody.allowSleep = false; // 不允许休眠，保持物理更新
        this.rigidBody.fixedRotation = true; // 固定旋转，角色不应该旋转
        
        // 启用碰撞监听
        this.rigidBody.enabledContactListener = true;
        this.rigidBody.bullet = false; // 角色不是高速物体，不需要连续碰撞检测
        
        // 根据当前阵营设置物理分组
        const currentFaction = this.getFaction();
        const physicsGroup = factionManager.getFactionPhysicsGroup(currentFaction);
        this.rigidBody.group = physicsGroup;
        
    }

    /**
     * 配置碰撞体组件 - 圆形碰撞体
     */
    private setupCollider(): void {
        if (!this.collider || !this.enemyData) return;
        
        const circleCollider = this.collider; // CircleCollider2D类型
        
        // 【修复】强制应用敌人配置中的碰撞体尺寸，覆盖预制体设置
        const colliderSize = this.enemyData.colliderSize;
        if (colliderSize) {
            // 检查是否有新的radius配置
            if (colliderSize.radius !== undefined) {
                // 直接使用radius配置
                circleCollider.radius = colliderSize.radius;
            } else if (colliderSize.width !== undefined && colliderSize.height !== undefined) {
                // 兼容旧的width/height配置（使用平均值）
                const avgSize = (colliderSize.width + colliderSize.height) / 2;
                circleCollider.radius = avgSize / 2; // 半径为平均尺寸的一半
                console.log(`[${this.getCharacterDisplayName()}] 兼容模式: 从width/height计算半径=${circleCollider.radius}`);
            } else {
                // 使用默认半径
                circleCollider.radius = 25;
                console.log(`[${this.getCharacterDisplayName()}] 配置缺失，使用默认半径=25`);
            }
            
            // 设置偏移
            circleCollider.offset.x = colliderSize.xoffset || 0;
            circleCollider.offset.y = colliderSize.yoffset || 0;
        } else {
            // 默认圆形碰撞体半径
            circleCollider.radius = 25; // 半径25，相当于50x50的方形
            circleCollider.offset.x = 0;
            circleCollider.offset.y = 0;
            console.log(`[${this.getCharacterDisplayName()}] 使用默认圆形碰撞体配置: 半径=25`);
        }
        
        // 设置为实体碰撞，不允许穿过
        circleCollider.sensor = false;
        
        // 根据当前阵营设置物理分组
        const currentFaction = this.getFaction();
        const physicsGroup = factionManager.getFactionPhysicsGroup(currentFaction);
        circleCollider.group = physicsGroup;
        
        console.log(`[${this.getCharacterDisplayName()}] 圆形碰撞体组件配置完成: 分组=${physicsGroup}, 半径=${circleCollider.radius}, 偏移=(${circleCollider.offset.x}, ${circleCollider.offset.y})`);
        
        // 【新增】同步ORCA避让半径与碰撞体半径
        if (this.orcaAgent) {
            const oldRadius = this.orcaAgent.radius;
            this.orcaAgent.radius = circleCollider.radius;
            console.log(`[${this.getCharacterDisplayName()}] 🔄 ORCA半径同步: ${oldRadius} → ${circleCollider.radius} (碰撞体半径)`);
            
            // 验证有效半径计算
            const effectiveRadius = this.orcaAgent.getEffectiveRadius();
            console.log(`[${this.getCharacterDisplayName()}] 📏 ORCA有效半径: ${effectiveRadius} (类型: ${this.orcaAgent.agentType})`);
        }
    }

    /**
     * 禁用碰撞检测 - 角色死亡时调用
     */
    public disableCollision(): void {
        // 禁用碰撞体组件
        if (this.collider) {
            this.collider.enabled = false;
            console.log(`[${this.getCharacterDisplayName()}] 碰撞体已禁用`);
        }
        
        // 禁用刚体的碰撞监听
        if (this.rigidBody) {
            this.rigidBody.enabledContactListener = false;
            // 停止所有物理运动
            // 【性能优化】使用临时变量池设置零速度
            this.rigidBody.linearVelocity = TempVarPool.tempVec2_6.set(0, 0);
            console.log(`[${this.getCharacterDisplayName()}] 刚体碰撞监听已禁用，运动已停止`);
        }
    }

    /**
     * 启用碰撞检测 - 角色复活时调用
     */
    public enableCollision(): void {
        // 启用碰撞体组件
        if (this.collider) {
            this.collider.enabled = true;
            console.log(`[${this.getCharacterDisplayName()}] 碰撞体已启用`);
        }
        
        // 启用刚体的碰撞监听
        if (this.rigidBody) {
            this.rigidBody.enabledContactListener = true;
            console.log(`[${this.getCharacterDisplayName()}] 刚体碰撞监听已启用`);
        }
    }

    /**
     * 根据Y轴位置更新Z轴深度 - 实现深度效果
     */
    private updateZDepthBasedOnY(): void {
        const currentPosition = this.node.position;
        const newZDepth = -currentPosition.y * 0.1; // Y轴每增加10像素，Z轴减少1
        
        // 只有当Z轴值发生变化时才更新，避免不必要的设置
        if (Math.abs(currentPosition.z - newZDepth) > 0.01) {
            this.node.setPosition(currentPosition.x, currentPosition.y, newZDepth);
        }
    }

    /**
     * 设置尺寸范围显示
     */
    private setupSizeRangeDisplay(): void {
        // 检查GameManager中的开关是否开启
        if (!GameManager.instance || !GameManager.instance.showSizeRanges) {
            return;
        }

        // 创建显示UI尺寸范围的节点
        this.createUIRangeDisplay();
        
        // 创建显示碰撞体范围的节点
        this.createColliderRangeDisplay();
    }

    /**
     * 创建UI尺寸范围显示
     */
    public createUIRangeDisplay(): void {
        // 获取UI尺寸
        const uiTransform = this.node.getComponent(UITransform);
        if (!uiTransform) return;

        const width = uiTransform.contentSize.width;
        const height = uiTransform.contentSize.height;

        // 创建UI范围显示节点
        const uiRangeNode = new Node('UIRange');
        const graphics = uiRangeNode.addComponent(Graphics);
        
        // 绘制UI边界框 - 蓝色
        graphics.strokeColor = Color.BLUE;
        graphics.lineWidth = 2;
        graphics.rect(-width / 2, -height / 2, width, height);
        graphics.stroke();
        
        // 添加到角色节点
        this.node.addChild(uiRangeNode);
        
        console.log(`[${this.getCharacterDisplayName()}] UI范围显示已创建: ${width}x${height}`);
    }

    /**
     * 创建碰撞体范围显示 - 圆形
     */
    public createColliderRangeDisplay(): void {
        if (!this.enemyData?.colliderSize) return;

        const colliderSize = this.enemyData.colliderSize;
        
        // 创建碰撞体范围显示节点
        const colliderRangeNode = new Node('ColliderRange');
        const graphics = colliderRangeNode.addComponent(Graphics);
        
        // 绘制碰撞体边界圆 - 红色
        graphics.strokeColor = Color.RED;
        graphics.lineWidth = 2;
        
        // 计算圆形碰撞体的半径
        let radius: number;
        if (colliderSize.radius !== undefined) {
            // 直接使用radius配置
            radius = colliderSize.radius;
        } else if (colliderSize.width !== undefined && colliderSize.height !== undefined) {
            // 兼容旧配置：使用宽度和高度的平均值
            const avgSize = (colliderSize.width + colliderSize.height) / 2;
            radius = avgSize / 2;
        } else {
            // 默认半径
            radius = 25;
        }
        
        // 计算偏移位置
        let offsetX = colliderSize.xoffset || 0;
        let offsetY = colliderSize.yoffset || 0;
        
        // 转换Y偏移（从UI坐标系转换为相对于中心的偏移）
        if (colliderSize.yoffset !== undefined) {
            const uiTransform = this.node.getComponent(UITransform);
            const nodeHeight = uiTransform ? uiTransform.contentSize.height : 128;
            offsetY = colliderSize.yoffset - (nodeHeight / 2);
        }
        
        // 绘制碰撞体圆形
        graphics.circle(offsetX, offsetY, radius);
        graphics.stroke();
        
        // 添加到角色节点
        this.node.addChild(colliderRangeNode);
        
        console.log(`[${this.getCharacterDisplayName()}] 圆形碰撞体范围显示已创建: 半径=${radius}, 偏移(${offsetX}, ${offsetY})`);
    }

    /**
     * 设置输入系统
     */
    protected setupInput(): void {
        // 只有手动模式才监听键盘输入
        if (this.controlMode === ControlMode.MANUAL) {
            input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
            input.on(Input.EventType.KEY_UP, this.onKeyUp, this);
            console.log(`[${this.getCharacterDisplayName()}] 手动控制输入系统已设置`);
        } else {
            console.log(`[${this.getCharacterDisplayName()}] AI模式，跳过输入系统设置`);
        }
    }

    /**
     * 按键按下处理
     */
    private onKeyDown = (event: EventKeyboard): void => {
        this.keyStates[event.keyCode] = true;
        
        // J键攻击 - 只有在非攻击状态才能攻击
        if (event.keyCode === KeyCode.KEY_J) {
            this.tryAttack();
        }
        
        // H键受伤测试
        if (event.keyCode === KeyCode.KEY_H) {
            this.testDamage();
        }
        
        // K键死亡测试
        if (event.keyCode === KeyCode.KEY_K) {
            this.testDeath();
        }
        
        // 更新移动方向（WSAD）- 始终更新移动方向，但状态转换在updateMoveDirection中控制
        this.updateMoveDirection();
    }

    /**
     * 按键松开处理  
     */
    private onKeyUp = (event: EventKeyboard): void => {
        this.keyStates[event.keyCode] = false;
        
        // 始终更新移动方向，但状态转换在updateMoveDirection中控制
        this.updateMoveDirection();
    }

    /**
     * 尝试攻击
     */
    private tryAttack(): void {
        // 检查是否在攻击状态中 (这个检查可以保留，作为快速否决)
        if (this.stateMachine?.isInState(CharacterState.ATTACKING)) {
            return;
        }
        
        // 检查攻击冷却时间
        const currentTime = Date.now() / 1000;
        if (currentTime - this.lastAttackTime < this.attackCooldown) {
            return;
        }
        
        // 记录攻击时间（将在协调者中处理）
        // this.lastAttackTime = currentTime; // 移到协调者中处理
        
        // 【新架构】设置攻击意图到输入信号
        this.currentInputSignals.wantsToAttack = true;
    }

    /**
     * 更新移动方向
     */
    private updateMoveDirection(): void {
        // 【修复】AI模式下不响应键盘输入，避免覆盖AI设置的moveDirection
        if (this.controlMode === ControlMode.AI) {
            // AI模式下跳过键盘输入处理
            return;
        }
        
        this.moveDirection.set(0, 0);
        
        // 基于按键状态更新移动方向
        if (this.keyStates[KeyCode.KEY_A]) this.moveDirection.x -= 1;
        if (this.keyStates[KeyCode.KEY_D]) this.moveDirection.x += 1;
        if (this.keyStates[KeyCode.KEY_W]) this.moveDirection.y += 1;
        if (this.keyStates[KeyCode.KEY_S]) this.moveDirection.y -= 1;
        
        // 归一化方向向量
        if (this.moveDirection.length() > 0) {
            this.moveDirection.normalize();
        }
        
        // 【重构】移除prefVelocity设置 - 现在由AINavigationController统一控制
        // 手动模式下的速度控制将通过AINavigationController.setDesiredVelocity()或专门的PlayerController处理
        
        // 更新角色朝向
        if (this.moveDirection.length() > 0) {
            // 根据移动方向更新朝向
            if (Math.abs(this.moveDirection.x) > Math.abs(this.moveDirection.y)) {
                // 水平移动为主
                this.currentDirection = this.moveDirection.x > 0 ? AnimationDirection.RIGHT : AnimationDirection.LEFT;
            } else {
                // 垂直移动为主
                this.currentDirection = this.moveDirection.y > 0 ? AnimationDirection.BACK : AnimationDirection.FRONT;
            }
        }
    }

    /**
     * 播放当前方向的指定动画
     */
    public playCurrentAnimation(state: AnimationState): void {
        if (!this.animationComponent || !this.enemyData) {
            console.warn(`[${this.getCharacterDisplayName()}] 动画组件或敌人数据未初始化`);
            return;
        }

        // 构建完整的动画名称
        const animationName = `${this.enemyData.assetNamePrefix}_${state}_${this.currentDirection}`;

        // 使用 AnimationManager 播放动画
        const success = animationManager.playAnimation(this.animationComponent, animationName);
        
        // 移除频繁的动画播放日志
        if (!success) {
            console.warn(`[${this.getCharacterDisplayName()}] 动画播放失败: ${animationName}`);
        }
    }

    /**
     * 播放攻击动画并处理结束回调
     */
    public playAttackAnimation(onFinished?: () => void): void {
        if (!this.animationComponent || !this.enemyData) {
            console.warn(`[${this.getCharacterDisplayName()}] 动画组件或敌人数据未初始化`);
            if (onFinished) {
                onFinished();
            }
            return;
        }

        // 构建完整的动画名称
        const animationName = `${this.enemyData.assetNamePrefix}_${AnimationState.ATTACK}_${this.currentDirection}`;

        // 获取攻击伤害帧配置
        const damageFrame = this.enemyData.attackDamageFrame || 5; // 默认第5帧
        const animSpeed = this.enemyData.animationSpeed || 8; // 默认8帧/秒

        // 使用 AnimationManager 播放攻击动画，带帧事件支持
        const success = animationManager.playAttackAnimation(
            this.animationComponent,
            animationName,
            damageFrame,
            animSpeed,
            () => this.onAttackDamageFrame(), // 伤害帧回调
            onFinished // 动画完成回调
        );
        
        if (!success) {
            console.warn(`[${this.getCharacterDisplayName()}] 攻击动画播放失败: ${animationName}`);
            // 如果动画播放失败，也立即调用回调
            if (onFinished) {
                onFinished();
            }
        }
    }

    /**
     * 攻击伤害帧回调 - 在动画的指定帧触发实际攻击逻辑
     * 这个方法在攻击动画的伤害帧被调用，负责执行实际的攻击效果
     */
    protected onAttackDamageFrame(): void {
        const damageFrame = this.enemyData?.attackDamageFrame || 5;
        const animSpeed = this.enemyData?.animationSpeed || 8;
        const actualDelay = (damageFrame - 1) / animSpeed;
        
        // 执行实际的攻击逻辑（之前在playAttackAnimation中立即执行的逻辑）
        this.performSpecialAttack();
    }



    /**
     * 状态机转换接口
     */
    public transitionToState(state: CharacterState): void {
        this.stateMachine?.transitionTo(state);
    }

    /**
     * 获取当前状态（供外部查询）
     */
    public getCurrentState(): CharacterState | null {
        return this.stateMachine?.getCurrentState() || null;
    }

    /**
     * 【新架构】更新函数 - 协调者模式
     */
    protected update(deltaTime: number): void {
        this.lockNodeRotation();
        
        // 根据控制模式调用不同的协调逻辑
        if (this.controlMode === ControlMode.AI && this.characterStats?.isAlive) {
            this.updateAICoordination(deltaTime);
        } else if (this.controlMode === ControlMode.MANUAL) {
            this.updateManualCoordination(deltaTime);
        }
        
        // 状态机根据统一的输入信号更新
        this.stateMachine?.update(deltaTime);
        
        // 重置一次性信号
        this.currentInputSignals.wantsToAttack = false;
    }

    /**
     * 【新架构】AI模式的协调逻辑 (已修复冷却期间移动问题)
     */
    private updateAICoordination(deltaTime: number): void {
        if (!this.characterStats || !this.characterStats.isAlive || !this.enemyData || !this.aiNavigationController) {
            // 如果必要组件或数据不存在，直接返回，不做任何操作
            return;
        }
        
        // 1. 从AI导航系统获取原始决策
        const aiDecision = this.aiNavigationController.computeDecision();
        
        // 2. 检查攻击冷却状态
        const currentTime = Date.now() / 1000;
        const isCoolingDown = (currentTime - this.lastAttackTime) < this.attackCooldown;

        // 3. 定义最终将要执行的决策变量
        let finalPrefVelocity = aiDecision.prefVelocity;
        let finalWantsToAttack = aiDecision.wantsToAttack;

        // 4. 处理攻击意图和冷却计时
        if (finalWantsToAttack) {
            if (isCoolingDown) {
                // 正在冷却中，强制取消本次攻击意图
                finalWantsToAttack = false; 
            } else {
                // 不在冷却中，这是一个有效的攻击请求，记录下当前时间作为新的攻击起始时间
                this.lastAttackTime = currentTime; 
            }
        }

        // 5. 【关键修复】处理冷却期间的移动行为
        // 如果角色正在冷却中，并且依然有目标，那么无论导航想让它怎么动，我们都强制它站住不动。
        const hasTarget = this.aiNavigationController.getCurrentTarget() != null;
        if (isCoolingDown && hasTarget) {
            // 强制将期望速度设置为零，覆盖导航的移动决策
            finalPrefVelocity = Vec2.ZERO; 
            // 为了调试清晰，可以打印日志
            // console.log(`[${this.node.name}] 攻击冷却中，强制停止移动。`);
        }

        // 6. 应用最终修正后的决策到物理和动画系统
        // 设置物理移动
        if (this.orcaAgent) {
            this.orcaAgent.prefVelocity.set(finalPrefVelocity.x, finalPrefVelocity.y);
        }
        
        // 更新角色朝向
        if (aiDecision.targetDirection) {
            this.updateDirectionTowards(aiDecision.targetDirection);
        }
        
        // 转换为状态机输入信号
        this.currentInputSignals.hasMovementInput = finalPrefVelocity.lengthSqr() > 0.01;
        this.currentInputSignals.wantsToAttack = finalWantsToAttack;
        
        // 7. 更新目标引用（兼容性）
        const aiTarget = this.aiNavigationController.getCurrentTarget();
        this.currentTarget = aiTarget ? aiTarget.node : null;
    }
    
    /**
     * 【新架构】手动模式的协调逻辑
     */
    private updateManualCoordination(deltaTime: number): void {
        // 1. 处理键盘输入（现有逻辑）
        // moveDirection已在按键事件中更新
        
        // 2. 设置物理移动
        if (this.orcaAgent) {
            const speed = this.moveSpeed;
            // 【性能优化】使用临时变量池避免GC压力
            const velocity = TempVarPool.tempVec2_1.set(
                this.moveDirection.x * speed,
                this.moveDirection.y * speed
            );
            this.orcaAgent.prefVelocity.set(velocity.x, velocity.y);
        }
        
        // 3. 转换为状态机输入信号
        this.currentInputSignals.hasMovementInput = this.moveDirection.lengthSqr() > 0.01;
        // wantsToAttack 已在 tryAttack() 中设置到 currentInputSignals
    }

    /**
     * 处理角色移动 - 由状态机调用（使用物理系统速度控制）
     * 【ORCA支持】优先使用ORCA系统，否则回退到原有的移动逻辑
     * 【网格优化】在移动后通知拥挤系统更新位置
     */
    public handleMovement(deltaTime: number): void {
        if (!this.rigidBody) {
            console.warn(`[${this.getCharacterDisplayName()}] 刚体组件未初始化，无法使用物理移动`);
            return;
        }

        
        // 记录移动前的位置
        const oldPosition = this.node.position.clone();
        
        // 【调试增强】详细检查ORCA代理状态

        if (this.orcaAgent) {

        }
        
        // 【ORCA支持】如果有OrcaAgent，使用ORCA系统控制移动
        if (this.orcaAgent && this.orcaAgent.isAgentValid()) {
            
            // ORCA系统完全接管移动控制，prefVelocity由AINavigationController设置
            // 这里不再基于moveDirection来覆盖prefVelocity，避免干扰AI导航
            
            // 【修复】应用ORCA系统计算出的最终速度到刚体
            if (this.orcaAgent.newVelocity && this.orcaAgent.newVelocity.length() > 0.01) {
                
                this.rigidBody.linearVelocity = this.orcaAgent.newVelocity;
            } else {
                // 【性能优化】使用临时变量池设置零速度
                this.rigidBody.linearVelocity = TempVarPool.tempVec2_2.set(0, 0);
            }
        } else {

            // 【回退逻辑】没有ORCA代理时，使用原有的移动逻辑
            // 检查是否有移动输入
            if (this.moveDirection.length() === 0) {

                // 没有移动输入时，立即停止
                // 【性能优化】使用临时变量池设置零速度
                this.rigidBody.linearVelocity = TempVarPool.tempVec2_3.set(0, 0);
                return;
            }
            

            
            // 使用直接的移动速度（像素/秒）
            const speed = this.moveSpeed;
            
            // 确保移动方向已归一化（对角线移动速度一致）
            const normalizedDirection = TempVarPool.tempVec2_1;
            normalizedDirection.set(this.moveDirection.x, this.moveDirection.y);
            normalizedDirection.normalize();
            
            // 【物理移动】设置刚体的线性速度
            const velocity = TempVarPool.tempVec2_2;
            velocity.set(
                normalizedDirection.x * speed,
                normalizedDirection.y * speed
            );
            

            
            // 应用速度到刚体
            this.rigidBody.linearVelocity = velocity;
        }
        
        // 【深度效果】根据Y轴位置更新Z轴深度
        this.updateZDepthBasedOnY();
        
        // 【网格优化】通知网格系统位置可能发生变化
        // GridManager会被ORCA和Boids系统同时复用
        gridManager.updateCharacterPosition(this, oldPosition);
        
        // 注释：边界检查现在由物理系统和碰撞体处理
        // 如果需要硬性边界，可以在场景中添加不可见的墙壁碰撞体
    }

    /**
     * 统一创建接口 - 强制使用对象池
     * @param characterType 角色类型
     * @param options 创建选项
     * @returns BaseCharacterDemo实例
     */
    public static create(characterType: string, options?: {
        characterId?: string;
        position?: Vec3;
        controlMode?: ControlMode;
        aiFaction?: string;
        aiBehaviorType?: string;
    }): BaseCharacterDemo | null {
        return CharacterPoolFactory.getInstance().createCharacter(characterType, options) as BaseCharacterDemo | null;
    }

    /**
     * 设置对象池属性
     */
    public setPoolingProperties(isFromPool: boolean, poolName: string, characterId: string): void {
        this.isFromPool = isFromPool;
        this.poolName = poolName;
        this.characterId = characterId;
    }

    /**
     * 回收到对象池
     * 【网格优化】回收时从拥挤系统反注册
     */
    public returnToPool(): void {
        // 【网格优化】从拥挤系统反注册
        this.unregisterFromCrowdingSystem();
        
        if (this.isFromPool && this.poolName) {
            // 使用CharacterPoolFactory进行回收
            CharacterPoolFactory.getInstance().recycleCharacter(this);
        } else {
            console.warn(`[${this.getCharacterDisplayName()}] 非池化对象，无法回收到对象池`);
        }
    }

    /**
     * 从池中重用时的回调 - 整合了UniversalCharacterDemo的功能
     * 【网格优化】重用时重新注册到拥挤系统
     */
    public onReuseFromPool(): void {
        
        if (!this.explicitEnemyType) {
            console.warn(`[BaseCharacterDemo] ⚠️ 重用时未发现预设敌人类型，将在后续初始化中确定`);
        }
        
        // 重置状态
        this.resetCharacterState();
        
        // 激活节点
        this.node.active = true;
        
        // 重新设置输入（因为可能在回收时被清理）
        this.setupInput();
        
        // 启动状态机
        if (this.stateMachine) {
            this.stateMachine.start();
        }
        
        // 【修复5】延迟重新注册到拥挤系统，确保状态完全重置
        this.scheduleOnce(() => {
            this.registerToCrowdingSystem();
            console.log(`[${this.getCharacterDisplayName()}] 延迟重新注册到拥挤系统完成`);
        }, 0.05);
        
        // 【修复】如果是AI模式，重新初始化AI系统
        if (this.controlMode === ControlMode.AI) {
            // 延迟初始化AI，确保所有组件都准备好
            this.scheduleOnce(() => {
                console.log(`[${this.getCharacterDisplayName()}] 重用后开始重新初始化AI`);
                this.initializeAI();
            }, 0.1);
        }
    }

    /**
     * 回收到池时的回调（性能优化：清理定时器）
     */
    public onRecycleToPool(): void {
        console.log(`[${this.getCharacterDisplayName()}] 回收到对象池 ID: ${this.characterId}`);
        
        // 【修复5】确保从网格系统完全清理
        this.unregisterFromCrowdingSystem();
        
        // 【性能优化】清理AI目标搜索定时器
        this.unschedule(this.updateAITargetSearch);
        console.log(`[${this.getCharacterDisplayName()}] AI目标搜索定时器已清理`);
        
        // 【新系统】清理AINavigationController状态
        if (this.aiNavigationController) {
            // AINavigationController会在自己的onDestroy中清理状态
            console.log(`[${this.getCharacterDisplayName()}] AINavigationController状态将自动清理`);
        }
        
        // 清理输入监听
        this.cleanupInput();
        
        // 停止动画
        if (this.animationComponent && this.animationComponent.isValid) {
            try {
                this.animationComponent.stop();
            } catch (error) {
                console.warn(`[${this.getCharacterDisplayName()}] 动画组件停止失败:`, error);
            }
        }
        
        // 重置状态机
        if (this.stateMachine) {
            this.stateMachine.reset();
        }
        
        // 【修复5】清空当前目标，避免重用时出现错误引用
        this.currentTarget = null;
        this.targetInfo = null;
    }

    /**
     * 重置角色状态
     */
    protected resetCharacterState(): void {
        // 重置位置
        this.node.setPosition(this.originalPosition);
        
        // 【深度效果】根据Y轴位置更新Z轴深度
        this.updateZDepthBasedOnY();
        
        // 重置角度为0
        this.lockNodeRotation();
        
        // 重置方向
        this.currentDirection = AnimationDirection.FRONT;
        
        // 重置输入状态
        this.keyStates = {};
        this.moveDirection.set(0, 0);
        
        // 重置攻击时间
        this.lastAttackTime = 0;
        
        // 重置物理状态 - 立即停止所有运动
        if (this.rigidBody) {
            // 【性能优化】使用临时变量池设置零速度
            this.rigidBody.linearVelocity = TempVarPool.tempVec2_7.set(0, 0);
            this.rigidBody.angularVelocity = 0;
            // 确保旋转固定
            this.rigidBody.fixedRotation = true;
            // 唤醒刚体以确保物理更新
            this.rigidBody.wakeUp();
        }
        
        // 重置血量
        if (this.characterStats) {
            this.characterStats.reset();
            this.updateHealthBar();
        }
        
        // 重新启用碰撞检测
        this.enableCollision();
        
        console.log(`[${this.getCharacterDisplayName()}] 角色状态已重置`);
    }

    /**
     * 清理输入监听
     */
    protected cleanupInput(): void {
        // 只有手动模式才需要清理输入监听
        if (this.controlMode === ControlMode.MANUAL) {
            input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
            input.off(Input.EventType.KEY_UP, this.onKeyUp, this);
        }
    }

    /**
     * 获取角色是否来自对象池
     */
    public getIsFromPool(): boolean {
        return this.isFromPool;
    }

    /**
     * 获取对象池名称
     */
    public getPoolName(): string {
        return this.poolName;
    }

    /**
     * 获取AI当前目标（供外部查询）
     */
    public getAICurrentTarget(): Node | null {
        return this.currentTarget;
    }

    /**
     * 获取AI当前状态（供外部查询）
     */
    public getAICurrentState(): string {
        if (!this.stateMachine) {
            return 'no_state_machine';
        }
        
        return this.stateMachine.getCurrentStateName();
    }

    /**
     * 设置角色阵营
     * @param faction 阵营
     */
    public setFaction(faction: Faction): void {
        const oldFaction = this.getFaction();
        const newFactionString = FactionUtils.factionToString(faction);
        
        // 如果阵营发生变化，需要重新注册
        if (oldFaction !== faction) {
            // 先反注册旧阵营
            this.deregisterFromTargetSelector();
            
            // 设置新阵营
            this.aiFaction = newFactionString;
            
            // 重新注册新阵营
            this.registerToTargetSelector();
            
            console.log(`[${this.getCharacterDisplayName()}] 阵营已变更: ${oldFaction} → ${faction} (aiFaction: ${this.aiFaction})`);
        } else {
            console.log(`[${this.getCharacterDisplayName()}] 阵营未变化: ${faction}`);
        }
        
        this.updateCharacterPhysicsGroup(faction); // 设置物理分组
    }

    /**
     * 根据阵营更新物理分组
     * @param faction 阵营
     */
    private updateCharacterPhysicsGroup(faction: Faction): void {
        const collider = this.getComponent(Collider2D);
        if (!collider) {
            console.warn(`[${this.getCharacterDisplayName()}] 缺少Collider2D组件，无法设置物理分组`);
            return;
        }

        // 使用FactionManager获取对应的物理分组
        const group = factionManager.getFactionPhysicsGroup(faction);
        collider.group = group;
        
        console.log(`[${this.getCharacterDisplayName()}] 物理分组已更新为: ${faction} -> ${group}`);
        
        // 同时更新刚体的分组（如果存在）
        if (this.rigidBody) {
            this.rigidBody.group = group;
            console.log(`[${this.getCharacterDisplayName()}] 刚体分组也已更新为: ${group}`);
        }
    }

    /**
     * 获取角色阵营
     */
    public getFaction(): Faction {
        // 直接从aiFaction属性获取阵营信息
        return FactionUtils.stringToFaction(this.aiFaction);
    }

    /**
     * 获取刚体组件（供拥挤系统使用）
     */
    public getRigidBody(): RigidBody2D | null {
        return this.rigidBody;
    }

    /**
     * 获取移动速度（供拥挤系统使用）
     */
    public getMoveSpeed(): number {
        return this.moveSpeed;
    }

    /**
     * 检查角色是否存活（供拥挤系统使用）
     */
    public isAlive(): boolean {
        return this.characterStats ? this.characterStats.isAlive : true;
    }
    
    /**
     * 向目标选择器注册当前角色
     */
    private registerToTargetSelector(): void {
        const faction = this.getFaction();
        
        // 使用工厂获取统一配置的选择器进行注册
        const selector = TargetSelectorFactory.getInstance();
        if (selector) {
            selector.registerTarget(this.node, faction);
        } else {
            console.error(`目标选择器工厂未初始化，无法注册: ${this.node.name}`);
        }
    }
    
    /**
     * 从目标选择器反注册当前角色
     */
    private deregisterFromTargetSelector(): void {
        const faction = this.getFaction();
        
        // 使用工厂获取统一配置的选择器进行反注册
        const selector = TargetSelectorFactory.getInstance();
        if (selector) {
            selector.deregisterTarget(this.node, faction);
        } else {
            console.warn(`目标选择器工厂未初始化，跳过反注册: ${this.node.name}`);
        }
    }

    /**
     * 注册到ORCA系统
     */
    private registerToCrowdingSystem(): void {
        // 【修复3】避免重复注册 - 检查是否已经在网格系统中
        try {
            // 检查是否已经在GridManager的characterToGrid中
            if (gridManager && (gridManager as any).characterToGrid && (gridManager as any).characterToGrid.has(this)) {
                console.log(`%c[BaseCharacterDemo] 🔄 角色已在网格系统中，跳过重复注册: ${this.node.name}`, 'color: orange');
                return;
            }
        } catch (error) {
            // 如果检查失败，继续注册流程
            console.log(`%c[BaseCharacterDemo] 🔄 无法检查网格注册状态，继续注册: ${this.node.name}`, 'color: yellow');
        }
        
        // 注册到ORCA系统
        if (this.orcaAgent && this.orcaAgent.isAgentValid()) {
            const orcaSystem = getOrcaSystem();
            if (orcaSystem) {
                orcaSystem.registerAgent(this.orcaAgent);
                console.log(`%c[BaseCharacterDemo] 🔀 已注册到ORCA系统: ${this.node.name} → ${this.getFaction()}`, 'color: blue');
                
                // 同时注册到GridManager（ORCA系统复用GridManager进行邻居查询）
                gridManager.addCharacter(this);
                console.log(`%c[BaseCharacterDemo] 📍 已注册到网格系统: ${this.node.name}`, 'color: green');
            }
        }
    }

    /**
     * 从ORCA系统反注册
     */
    private unregisterFromCrowdingSystem(): void {
        // 从ORCA系统反注册
        if (this.orcaAgent) {
            const orcaSystem = getOrcaSystem();
            if (orcaSystem) {
                orcaSystem.unregisterAgent(this.orcaAgent);
                console.log(`%c[BaseCharacterDemo] 🔀 已从ORCA系统反注册: ${this.node.name} ← ${this.getFaction()}`, 'color: blue');
            }
            
            // 从GridManager反注册
            gridManager.removeCharacter(this);
            console.log(`%c[BaseCharacterDemo] 📍 已从网格系统反注册: ${this.node.name}`, 'color: green');
        }
    }

    /**
     * 设置默认阵营
     * 对于手动控制的角色（通常是玩家），设置为玩家阵营
     * 对于AI控制的角色，通过其他方式设置阵营
     */
    private setupDefaultFaction(): void {
        if (!this.characterStats) {
            return;
        }

        // 【修复】AI模式下不设置默认阵营，等待MonsterSpawner或其他系统设置
        if (this.controlMode === ControlMode.AI) {
            console.log(`[${this.getCharacterDisplayName()}] AI模式，跳过默认阵营设置，等待外部系统设置阵营`);
            return;
        }

        // 对于手动控制的角色，设置为玩家阵营（只有在还是默认player阵营时才设置）
        if (this.controlMode === ControlMode.MANUAL) {
            if (this.aiFaction === "player") {
                this.setFaction(Faction.PLAYER);
                console.log(`[${this.getCharacterDisplayName()}] 手动模式，设置默认玩家阵营`);
            } else {
                console.log(`[${this.getCharacterDisplayName()}] 手动模式，但阵营已设置为: ${this.aiFaction}`);
            }
        }
    }

    // ============= 便利的池化创建方法 =============

    /**
     * 创建玩家角色（手动控制）
     */
    public static createPlayer(characterType: string, position?: Vec3): BaseCharacterDemo | null {
        return BaseCharacterDemo.create(characterType, {
            controlMode: ControlMode.MANUAL,
            position: position
        });
    }

    /**
     * 创建AI敌人
     */
    public static createAIEnemy(characterType: string, options: {
        position?: Vec3;
        faction: string;
        behaviorType?: string;
    }): BaseCharacterDemo | null {
        return BaseCharacterDemo.create(characterType, {
            controlMode: ControlMode.AI,
            position: options.position,
            aiFaction: options.faction,
            aiBehaviorType: options.behaviorType || 'melee'
        });
    }

    /**
     * 回收所有同类型角色
     */
    public static recycleAllByType(characterType: string): void {
        const factory = CharacterPoolFactory.getInstance();
        const characters = factory.getActiveCharactersByType(characterType);
        characters.forEach((character: any) => {
            character.returnToPool();
        });
        console.log(`[BaseCharacterDemo] 已回收所有${characterType}类型角色，数量: ${characters.length}`);
    }

    /**
     * 获取所有活跃角色数量
     */
    public static getActiveCharacterCount(): number {
        return CharacterPoolFactory.getInstance().getActiveCharacterCount();
    }

    /**
     * 组件销毁时的清理
     * 【网格优化】销毁时从拥挤系统反注册
     */
    protected onDestroy(): void {
        // 【网格优化】从拥挤系统反注册
        this.unregisterFromCrowdingSystem();
        
        // 停止AI定时器
        this.unschedule(this.updateAITargetSearch);
        
        // 【性能优化】从AI性能管理器反注册
        if (this.controlMode === ControlMode.AI) {
            const performanceManager = AIPerformanceManager.getInstance();
            if (performanceManager) {
                performanceManager.unregisterAI(this.node);
                console.log(`%c[AI] ${this.getCharacterDisplayName()} 已从性能管理器反注册`, 'color: gray');
            }
        }
        
        // 从目标选择器反注册
        this.deregisterFromTargetSelector();
        
        // 清理输入监听
        this.cleanupInput();
        
        // 停止动画
        if (this.animationComponent && this.animationComponent.isValid) {
            try {
                this.animationComponent.stop();
            } catch (error) {
                console.warn(`[${this.getCharacterDisplayName()}] 动画组件停止失败:`, error);
            }
        }
        
        // 清理物理组件 - 立即停止所有运动
        if (this.rigidBody) {
            // 【性能优化】使用临时变量池设置零速度
            this.rigidBody.linearVelocity = TempVarPool.tempVec2_8.set(0, 0);
            this.rigidBody.angularVelocity = 0;
        }
        
        console.log(`[${this.getCharacterDisplayName()}] 角色已销毁并清理完成`);
    }

    /**
     * 分析敌人攻击类型（近战/远程）- 基于怪物配置 (从UniversalCharacterDemo合并)
     */
    private analyzeEnemyAttackType(): void {
        if (!this.enemyData) {
            this.isRangedAttacker = false;
            this.hasRangedSkills = false;
            return;
        }

        // 多重判断条件确定是否为远程攻击者
        const enemyId = this.enemyData.id;
        let isRanged = false;

        // 1. 检查是否有projectileId（最直接的远程攻击标识）
        if (this.enemyData.projectileId) {
            isRanged = true;
            console.log(`[${this.getCharacterDisplayName()}] 检测到projectileId: ${this.enemyData.projectileId}，判定为远程攻击`);
        }

        // 2. 检查技能中是否有远程攻击技能
        if (!isRanged && this.enemyData.skills) {
            const hasRangedSkill = this.enemyData.skills.some(skill => 
                skill.id === 'fireball' || 
                skill.id === 'lightning' || 
                skill.id.includes('ranged') ||
                skill.id.includes('projectile')
            );
            if (hasRangedSkill) {
                isRanged = true;
                console.log(`[${this.getCharacterDisplayName()}] 检测到远程技能，判定为远程攻击`);
            }
        }

        // 3. 检查是否有projectileOffsets（火球发射位置偏移）
        if (!isRanged && (this.enemyData as any).projectileOffsets) {
            isRanged = true;
            console.log(`[${this.getCharacterDisplayName()}] 检测到projectileOffsets，判定为远程攻击`);
        }

        // 4. 备用方案：基于敌人ID判断（保持向后兼容）
        if (!isRanged && enemyId.indexOf('lich') !== -1) {
            isRanged = true;
            console.log(`[${this.getCharacterDisplayName()}] 基于敌人ID判断为远程攻击（向后兼容）`);
        }

        this.isRangedAttacker = isRanged;
        this.hasRangedSkills = isRanged;

        const attackType = this.isRangedAttacker ? '远程攻击' : '近战攻击';
        console.log(`[${this.getCharacterDisplayName()}] 攻击类型分析完成: ${attackType} (敌人ID: ${enemyId})`);
    }

    /**
     * 获取远程技能名称
     */
    private getRemoteSkillNames(): string {
        if (this.isRangedAttacker) {
            return 'fireball'; // 默认使用火球术
        }
        return '';
    }

    /**
     * 初始化火球发射器 - 完全基于怪物配置 (从UniversalCharacterDemo合并)
     */
    private setupFireballLauncher(): void {
        // 获取或创建FireballLauncher组件
        this.fireballLauncher = this.getComponent(FireballLauncher);
        
        if (this.fireballLauncher) {
            console.log(`[${this.getCharacterDisplayName()}] 使用预制体中已有的FireballLauncher组件`);
        } else {
            // 创建新的FireballLauncher组件
            this.fireballLauncher = this.addComponent(FireballLauncher);
            console.log(`[${this.getCharacterDisplayName()}] 创建了新的FireballLauncher组件`);
        }
        
        // 从敌人配置中读取参数
        this.configureFireballLauncherFromEnemyData();
        
        console.log(`🔥 [${this.getCharacterDisplayName()}] 火球发射器已初始化，完全依赖对象池`);
    }

    /**
     * 从敌人配置数据中配置火球发射器参数
     */
    private configureFireballLauncherFromEnemyData(): void {
        if (!this.fireballLauncher || !this.enemyData) {
            console.warn(`[${this.getCharacterDisplayName()}] 无法配置火球发射器：组件或敌人数据缺失`);
            return;
        }

        // 设置火球基础伤害（从怪物配置获取）
        this.fireballLauncher.damage = this.enemyData.baseAttack;

        // 设置发射者阵营信息（重要！）
        const currentFaction = this.getFaction();
        this.fireballLauncher.setFactionInfo(currentFaction, this.node);

        console.log(`[${this.getCharacterDisplayName()}] 火球发射器配置完成: 伤害=${this.fireballLauncher.damage}, 阵营=${currentFaction}`);
    }

    /**
     * 确保核心管理器存在于场景中 (从UniversalCharacterDemo合并)
     */
    private async ensureManagers(): Promise<void> {
        let gameManagerNode = find('GameManager');
        if (!gameManagerNode) {
            console.log('[BaseCharacterDemo] 检测到 GameManager 不存在，正在自动创建...');
            gameManagerNode = new Node('GameManager');
            gameManagerNode.addComponent(GameManager);
            find('Canvas')?.addChild(gameManagerNode); // 假设有一个Canvas节点

            // 等待一帧以确保 GameManager 的 onLoad 和 start 方法被调用
            return new Promise(resolve => setTimeout(resolve, 100));
        } else {
            console.log('[BaseCharacterDemo] GameManager 已存在，跳过创建。');
        }
    }

    /**
     * 锁定节点角度为0（防止旋转）
     */
    private lockNodeRotation(): void {
        if (this.node) {
            this.node.setRotationFromEuler(0, 0, 0);
        }
    }
}