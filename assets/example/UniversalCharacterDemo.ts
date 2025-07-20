import { _decorator, Vec3 } from 'cc';
import { BaseCharacterDemo } from '../scripts/animation/BaseCharacterDemo';
import { GameManager } from '../scripts/core/GameManager';
import { FireballLauncher } from '../scripts/launcher/FireballLauncher';
import { AnimationDirection, AnimationState } from '../scripts/animation/AnimationConfig';
import { dataManager } from '../scripts/core/DataManager';
import { animationManager } from '../scripts/animation/AnimationManager';

const { ccclass, property } = _decorator;

@ccclass('UniversalCharacterDemo')
export class UniversalCharacterDemo extends BaseCharacterDemo {

    /**
     * 角色显示名称后缀 - 可选配置
     */
    @property({
        displayName: "显示名称后缀", 
        tooltip: "可选的显示名称后缀，用于区分多个相同类型的角色"
    })
    public displayNameSuffix: string = '';

    /**
     * 【关键修复】外部指定的敌人类型 - 优先级高于GameManager配置
     */
    @property({
        displayName: "指定敌人类型",
        tooltip: "外部指定的敌人类型，如果设置则优先使用此配置而不是从GameManager读取"
    })
    public specifiedEnemyType: string = '';

    /**
     * 火球伤害 - 远程攻击敌人使用
     */
    @property({
        displayName: "火球伤害",
        tooltip: "远程攻击敌人的火球伤害值"
    })
    public fireballDamage: number = 75;

    /**
     * 火球角度偏移 - 远程攻击敌人使用
     */
    @property({
        displayName: "火球角度偏移", 
        tooltip: "在基础角度上的额外偏移（度）"
    })
    public fireballAngleOffset: number = 0;

    // 智能攻击系统
    private fireballLauncher: FireballLauncher | null = null;
    private isRangedAttacker: boolean = false;
    private hasRangedSkills: boolean = false;

    /**
     * 【关键修复】获取敌人配置ID - 支持外部指定类型
     */
    protected getEnemyConfigId(): string {
        // 优先使用外部指定的敌人类型
        if (this.specifiedEnemyType && this.specifiedEnemyType.trim() !== '') {
            console.log(`[UniversalCharacterDemo] 使用外部指定的敌人类型: ${this.specifiedEnemyType}`);
            return this.specifiedEnemyType.trim();
        }

        // 回退到从GameManager获取
        if (!GameManager.instance) {
            console.warn('[UniversalCharacterDemo] GameManager.instance 不存在，使用默认敌人类型');
            return 'ent_normal';
        }

        // 从 GameManager 获取当前配置的敌人类型
        const availableTypes = GameManager.instance.getAvailableEnemyTypes();
        const currentIndex = GameManager.instance.testEnemyType;
        
        if (currentIndex >= 0 && currentIndex < availableTypes.length) {
            const enemyType = availableTypes[currentIndex];
            console.log(`[UniversalCharacterDemo] 从 GameManager 获取敌人类型: ${enemyType} (索引: ${currentIndex})`);
            return enemyType;
        } else {
            console.warn(`[UniversalCharacterDemo] GameManager 中的敌人类型索引 ${currentIndex} 无效，使用默认类型`);
            return 'ent_normal';
        }
    }

    /**
     * 【新增】设置敌人类型 - 供外部调用
     */
    public setEnemyType(enemyType: string): void {
        this.specifiedEnemyType = enemyType;
        console.log(`[UniversalCharacterDemo] 敌人类型已设置为: ${enemyType}`);
        
        // 如果已经初始化过，需要重新加载配置
        if (this.enemyData) {
            console.log(`[UniversalCharacterDemo] 重新加载敌人配置...`);
            this.reloadEnemyConfiguration();
        }
    }

    /**
     * 【新增】重新加载敌人配置 - 当敌人类型改变时调用
     */
    private async reloadEnemyConfiguration(): Promise<void> {
        try {
            // 重新加载敌人配置
            const configId = this.getEnemyConfigId();
            this.enemyData = dataManager.getEnemyData(configId);
            
            if (!this.enemyData) {
                console.error(`[UniversalCharacterDemo] 无法加载敌人配置: ${configId}`);
                return;
            }

            console.log(`[UniversalCharacterDemo] 重新加载配置成功: ${this.enemyData.name}`);

            // 更新CharacterStats
            if (this.characterStats) {
                this.characterStats.initWithEnemyData(this.enemyData);
            }

            // 重新分析攻击类型
            this.analyzeEnemyAttackType();

            // 重新设置火球发射器（如果需要）
            if (this.isRangedAttacker && !this.fireballLauncher) {
                this.setupFireballLauncher();
            }

            // 重新创建动画剪辑
            await this.reloadAnimations();

            console.log(`[UniversalCharacterDemo] 敌人配置重新加载完成: ${configId}`);

        } catch (error) {
            console.error(`[UniversalCharacterDemo] 重新加载敌人配置失败:`, error);
        }
    }

    /**
     * 【新增】重新加载动画系统
     */
    private async reloadAnimations(): Promise<void> {
        if (!this.enemyData) {
            console.warn(`[UniversalCharacterDemo] 无敌人数据，无法重新加载动画`);
            return;
        }

        try {
            // 使用 AnimationManager 重新创建动画剪辑
            const animationClips = await animationManager.createAllAnimationClips(this.enemyData);
            
            if (animationClips.size === 0) {
                console.warn(`[UniversalCharacterDemo] 重新加载时没有创建任何动画剪辑`);
                return;
            }

            // 重新设置动画组件
            this.animationComponent = animationManager.setupAnimationComponent(this.node, animationClips);
            
            console.log(`[UniversalCharacterDemo] 动画重新加载完成，创建了 ${animationClips.size} 个动画剪辑`);

            // 播放默认动画（Idle）
            this.playCurrentAnimation(AnimationState.IDLE);

        } catch (error) {
            console.error(`[UniversalCharacterDemo] 重新加载动画失败:`, error);
        }
    }

    /**
     * 获取角色显示名称
     */
    protected getCharacterDisplayName(): string {
        const baseId = this.getEnemyConfigId();
        const suffix = this.displayNameSuffix ? `_${this.displayNameSuffix}` : '';
        return `UniversalDemo_${baseId}${suffix}`;
    }

    /**
     * 智能特殊攻击逻辑 - 根据敌人类型自动判断攻击方式
     */
    protected performSpecialAttack(): void {
        if (!this.enemyData) {
            console.log(`[${this.getCharacterDisplayName()}] 无敌人配置数据，使用基础攻击`);
            super.performSpecialAttack();
            return;
        }

        // 检查是否为远程攻击敌人
        if (this.isRangedAttacker) {
            this.performRangedAttack();
        } else {
            console.log(`[${this.getCharacterDisplayName()}] 执行近战攻击`);
            super.performSpecialAttack();
        }
    }

    /**
     * 执行远程攻击（火球发射）
     */
    private performRangedAttack(): void {
        if (!this.fireballLauncher) {
            console.warn(`[${this.getCharacterDisplayName()}] 远程攻击敌人但火球发射器未初始化`);
            return;
        }

        // 在攻击动画的合适帧触发火球（类似巫妖的第5帧）
        const fireballTriggerTime = this.calculateFireballTriggerTime();
        
        setTimeout(() => {
            console.log(`[${this.getCharacterDisplayName()}] 触发远程攻击 - 发射火球`);
            
            // 根据当前状态调整火球参数
            this.adjustFireballParamsBasedOnState();
            
            // 发射火球
            this.launchFireball();
        }, fireballTriggerTime);
    }

    /**
     * 计算火球触发时间（基于动画帧率和敌人配置）
     */
    private calculateFireballTriggerTime(): number {
        if (!this.enemyData) return 333; // 默认值

        // 基于动画速度和帧数计算合适的触发时间
        const frameRate = this.enemyData.animationSpeed || 12;
        const triggerFrame = 5; // 通常在第5帧触发
        return (triggerFrame / frameRate) * 1000; // 转换为毫秒
    }

    /**
     * 根据敌人状态动态调整火球参数
     */
    private adjustFireballParamsBasedOnState(): void {
        if (!this.enemyData || !this.characterStats) return;

        // 获取生命值百分比
        const healthPercent = this.characterStats.currentHealth / this.characterStats.maxHealth;
        
        // 血量越低，火球伤害越高（狂暴效果）
        if (healthPercent < 0.3) {
            this.fireballDamage = Math.floor(this.enemyData.baseAttack * 1.8); // 高伤害
            this.fireballAngleOffset = 0; // 精准角度
            console.log(`[${this.getCharacterDisplayName()}] 进入狂暴状态，火球威力大幅提升！`);
        } else if (healthPercent < 0.6) {
            this.fireballDamage = Math.floor(this.enemyData.baseAttack * 1.4); // 中等伤害
            this.fireballAngleOffset = 5; // 轻微偏移
            console.log(`[${this.getCharacterDisplayName()}] 受伤状态，火球威力提升`);
        } else {
            this.fireballDamage = this.enemyData.baseAttack; // 基础伤害
            this.fireballAngleOffset = 0; // 无偏移
        }
    }

    /**
     * 【优化】发射火球 - 支持动态瞄准（AI模式瞄准当前目标，手动模式瞄准最近敌人）
     */
    private launchFireball(): void {
        if (!this.fireballLauncher) {
            console.warn(`[${this.getCharacterDisplayName()}] 火球发射器未初始化`);
            return;
        }

        // 检查是否在冷却中
        if (this.fireballLauncher.isOnCooldown()) {
            console.log(`[${this.getCharacterDisplayName()}] 火球发射器冷却中，无法发射`);
            return;
        }

        let targetToAim: any = null;

        // 根据控制模式选择目标
        if ((this as any).controlMode === 1) { // ControlMode.AI
            // AI模式：瞄准当前AI目标
            targetToAim = this.getAICurrentTarget?.() || (this as any).currentTarget;
        } else if ((this as any).controlMode === 0) { // ControlMode.MANUAL
            // 手动模式：智能瞄准最近的敌人
            targetToAim = (this as any).findNearestEnemy?.();
        }
        
        if (targetToAim && targetToAim.isValid) {
            // 直接朝目标位置发射火球（精确瞄准）
            const targetPos = targetToAim.position;
            const mode = (this as any).controlMode === 1 ? 'AI' : '手动';
            console.log(`[${this.getCharacterDisplayName()}] 🎯 ${mode}模式精确瞄准目标 ${targetToAim.name} 位置: (${targetPos.x.toFixed(1)}, ${targetPos.y.toFixed(1)})`);
            this.fireballLauncher.launchFireballToPosition(targetPos, this.fireballDamage);
        } else {
            // 没有目标时按角度发射
            const targetAngle = this.calculateLaunchAngle();
            console.log(`[${this.getCharacterDisplayName()}] 📐 无目标，按朝向发射火球: ${targetAngle}°`);
            this.fireballLauncher.launchFireballAtAngle(targetAngle, this.fireballDamage);
        }
        
        console.log(`[${this.getCharacterDisplayName()}] 🔥 火球发射完成！伤害: ${this.fireballDamage}`);
    }

    /**
     * 【修复】动态计算发射角度 - 优先瞄准当前目标，否则基于朝向
     */
    private calculateLaunchAngle(): number {
        // 【关键修复】优先瞄准当前AI目标
        const currentTarget = this.getAICurrentTarget?.() || (this as any).currentTarget;
        
        if (currentTarget && currentTarget.isValid) {
            // 计算从巫妖位置到目标位置的角度
            const myPos = this.node.position;
            const targetPos = currentTarget.position;
            
            // 计算方向向量
            const deltaX = targetPos.x - myPos.x;
            const deltaY = targetPos.y - myPos.y;
            
            // 计算角度（弧度转角度）
            const angleRadians = Math.atan2(deltaY, deltaX);
            const angleDegrees = angleRadians * 180 / Math.PI;
            
            console.log(`[${this.getCharacterDisplayName()}] 🎯 动态瞄准目标 ${currentTarget.name}`);
            console.log(`  巫妖位置: (${myPos.x.toFixed(1)}, ${myPos.y.toFixed(1)})`);
            console.log(`  目标位置: (${targetPos.x.toFixed(1)}, ${targetPos.y.toFixed(1)})`);
            console.log(`  计算角度: ${angleDegrees.toFixed(1)}°`);
            
            // 应用角度偏移
            return angleDegrees + this.fireballAngleOffset;
        }
        
        // 【备用方案】没有目标时基于角色朝向计算角度
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
        
        // 应用角度偏移
        return baseAngle + this.fireballAngleOffset;
    }

    /**
     * 编辑器中的调试信息
     */
    public async onLoad(): Promise<void> {
        console.log(`[${this.getCharacterDisplayName()}] 开始初始化角色演示（状态机版本）...`);
        
        // 等待数据管理器加载完成
        await super.onLoad();
        
        const enemyType = this.getEnemyConfigId();
        console.log(`[UniversalCharacterDemo] 使用 GameManager 配置的敌人类型: ${enemyType}`);
        
        // 分析敌人类型并设置攻击系统
        this.analyzeEnemyAttackType();
        
        // 如果是远程攻击敌人，初始化火球发射器
        if (this.isRangedAttacker) {
            this.setupFireballLauncher();
        }
        
        // 【关键修复】统一的模式判断和控制模式设置
        if (GameManager.instance) {
            if (GameManager.instance.manualTestMode) {
                // 手动测试模式：设置为手动控制，让用户通过键盘操作
                this.controlMode = 0; // ControlMode.MANUAL
                console.log('[UniversalCharacterDemo] 手动测试模式：设置为手动控制（键盘操作）');
            } else if (GameManager.instance.aiTestMode || GameManager.instance.normalMode) {
                // AI测试模式 + 正常模式：都设置为AI控制（走同一套逻辑）
                this.controlMode = 1; // ControlMode.AI
                const mode = GameManager.instance.aiTestMode ? 'AI测试模式' : '正常模式';
                console.log(`[UniversalCharacterDemo] ${mode}：设置为AI控制`);
            } else {
                console.warn('[UniversalCharacterDemo] 未知模式，使用默认控制模式');
            }
        } else {
            console.warn('[UniversalCharacterDemo] GameManager不存在，使用默认控制模式');
        }
        
        if (GameManager.instance) {
            console.log(`[UniversalCharacterDemo] GameManager 可用敌人类型: ${GameManager.instance.getAvailableEnemyTypes().join(', ')}`);
        }
        
        // 输出攻击类型信息
        const attackType = this.isRangedAttacker ? '远程攻击' : '近战攻击';
        const skillInfo = this.hasRangedSkills ? ` (检测到远程技能: ${this.getRemoteSkillNames()})` : ' (无远程技能)';
        const controlModeStr = this.controlMode === 0 ? '手动控制' : 'AI控制';
        console.log(`🎯 [${this.getCharacterDisplayName()}] 攻击类型: ${attackType}${skillInfo}, 控制模式: ${controlModeStr}`);
    }

    /**
     * 分析敌人攻击类型（近战/远程）
     */
    private analyzeEnemyAttackType(): void {
        if (!this.enemyData) {
            this.isRangedAttacker = false;
            this.hasRangedSkills = false;
            return;
        }

        // 【改进】多重判断条件确定是否为远程攻击者
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
        this.hasRangedSkills = isRanged; // 简化：远程攻击就认为有远程技能

        const attackType = this.isRangedAttacker ? '远程攻击' : '近战攻击';
        console.log(`[${this.getCharacterDisplayName()}] 攻击类型分析完成: ${attackType} (敌人ID: ${enemyId})`);
    }

    /**
     * 获取远程技能名称 - 简化版本
     */
    private getRemoteSkillNames(): string {
        if (this.isRangedAttacker) {
            return 'fireball'; // 巫妖默认使用火球术
        }
        return '';
    }

    /**
     * 初始化火球发射器 - 仅在远程攻击敌人需要时调用
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

        // 设置基础攻击间隔作为发射冷却时间
        this.fireballLauncher.launchCooldown = this.enemyData.attackInterval;
        
        // 查找火球技能配置
        const fireballSkill = this.enemyData.skills?.find(skill => skill.id === 'fireball');
        if (fireballSkill) {
            this.fireballLauncher.launchCooldown = Math.min(this.enemyData.attackInterval, fireballSkill.cooldown);
        }

        // 设置火球基础伤害
        this.fireballDamage = this.enemyData.baseAttack;
        this.fireballLauncher.damage = this.fireballDamage;

        console.log(`[${this.getCharacterDisplayName()}] 火球发射器配置完成: 冷却=${this.fireballLauncher.launchCooldown}s, 伤害=${this.fireballDamage}`);
    }

    /**
     * 从 GameManager 获取当前敌人类型
     */
    public getCurrentEnemyType(): string {
        return this.getEnemyConfigId();
    }

    /**
     * 检查 GameManager 配置是否有效
     */
    private validateGameManagerConfig(): boolean {
        if (!GameManager.instance) {
            console.error('[UniversalCharacterDemo] GameManager.instance 不存在');
            return false;
        }

        const availableTypes = GameManager.instance.getAvailableEnemyTypes();
        const currentIndex = GameManager.instance.testEnemyType;

        if (currentIndex < 0 || currentIndex >= availableTypes.length) {
            console.error(`[UniversalCharacterDemo] GameManager 中的敌人类型索引 ${currentIndex} 超出范围 [0, ${availableTypes.length - 1}]`);
            return false;
        }

        return true;
    }

    /**
     * 初始化时验证配置
     */
    protected start(): void {
        this.validateGameManagerConfig();
        if (super.start) {
            super.start();
        }
    }

    /**
     * 获取 GameManager 中所有可用的敌人类型（用于调试）
     */
    public getAvailableEnemyTypes(): string[] {
        if (GameManager.instance) {
            return GameManager.instance.getAvailableEnemyTypes();
        }
        return [];
    }

    /**
     * 检查当前敌人是否为远程攻击类型
     */
    public isCurrentEnemyRanged(): boolean {
        return this.isRangedAttacker;
    }

    /**
     * 获取攻击类型描述
     */
    public getAttackTypeDescription(): string {
        if (this.isRangedAttacker) {
            return `远程攻击 (${this.hasRangedSkills ? this.getRemoteSkillNames() : '基于敌人类型判断'})`;
        } else {
            return '近战攻击';
        }
    }
} 