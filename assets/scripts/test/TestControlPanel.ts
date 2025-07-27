import { _decorator, Component, Node, Button, Label, Slider, Toggle, UITransform, Widget, director, Color, Vec3 } from 'cc';
import { GameManager } from '../managers/GameManager';

const { ccclass, property } = _decorator;

/**
 * 测试控制面板组件
 * 为手动测试模式提供可视化控制界面
 */
@ccclass('TestControlPanel')
export class TestControlPanel extends Component {
    
    // === UI 节点引用 ===
    @property(Node)
    panelContainer: Node | null = null;
    
    @property(Button)
    toggleModeButton: Button | null = null;
    
    @property(Button)
    spawnEnemyButton: Button | null = null;
    
    @property(Button)
    clearEnemyButton: Button | null = null;
    
    @property(Button)
    nextEnemyTypeButton: Button | null = null;
    
    @property(Button)
    prevEnemyTypeButton: Button | null = null;
    
    @property(Button)
    attackButton: Button | null = null;
    
    @property(Button)
    takeDamageButton: Button | null = null;
    
    @property(Button)
    hidePanelButton: Button | null = null;
    
    @property(Label)
    currentModeLabel: Label | null = null;
    
    @property(Label)
    currentEnemyTypeLabel: Label | null = null;
    
    @property(Label)
    enemyHealthLabel: Label | null = null;
    
    @property(Label)
    instructionsLabel: Label | null = null;
    
    // === 控制参数 ===
    @property(Slider)
    moveSpeedSlider: Slider | null = null;
    
    @property(Label)
    moveSpeedLabel: Label | null = null;
    
    @property(Toggle)
    showDebugToggle: Toggle | null = null;
    
    // === 面板显示控制 ===
    @property({
        displayName: "面板可见",
        tooltip: "控制面板是否显示"
    })
    public panelVisible: boolean = true;
    
    @property({
        displayName: "面板位置",
        tooltip: "面板在屏幕上的位置"
    })
    public panelPosition: Vec3 = new Vec3(0, 0, 0);
    
    // === 私有属性 ===
    private gameManager: GameManager | null = null;
    private updateTimer: number = 0;
    private readonly UPDATE_INTERVAL = 0.5; // 更新间隔（秒）
    
    onLoad() {
        this.initializePanel();
        this.setupEventListeners();
    }
    
    start() {
        this.gameManager = GameManager.instance;
        
        // 注册到GameManager
        if (this.gameManager) {
            this.gameManager.registerTestControlPanel(this);
        }
        
        this.updateDisplayInfo();
    }
    
    update(deltaTime: number) {
        this.updateTimer += deltaTime;
        if (this.updateTimer >= this.UPDATE_INTERVAL) {
            this.updateDisplayInfo();
            this.updateTimer = 0;
        }
    }
    
    /**
     * 初始化面板
     */
    private initializePanel(): void {
        if (!this.panelContainer) {
            console.warn('TestControlPanel: panelContainer未设置');
            return;
        }
        
        // 设置面板位置
        this.panelContainer.setPosition(this.panelPosition);
        
        // 设置面板可见性
        this.panelContainer.active = this.panelVisible;
        
        // 设置面板到顶层
        this.panelContainer.setSiblingIndex(1000);
        
        console.log('🎛️ 测试控制面板已初始化');
    }
    
    /**
     * 设置事件监听器
     */
    public setupEventListeners(): void {
        // 模式切换按钮
        if (this.toggleModeButton) {
            this.toggleModeButton.node.on(Button.EventType.CLICK, this.onToggleModeClick, this);
        }
        
        // 生成敌人按钮
        if (this.spawnEnemyButton) {
            this.spawnEnemyButton.node.on(Button.EventType.CLICK, this.onSpawnEnemyClick, this);
        }
        
        // 清除敌人按钮
        if (this.clearEnemyButton) {
            this.clearEnemyButton.node.on(Button.EventType.CLICK, this.onClearEnemyClick, this);
        }
        
        // 切换敌人类型按钮
        if (this.nextEnemyTypeButton) {
            this.nextEnemyTypeButton.node.on(Button.EventType.CLICK, this.onNextEnemyTypeClick, this);
        }
        
        if (this.prevEnemyTypeButton) {
            this.prevEnemyTypeButton.node.on(Button.EventType.CLICK, this.onPrevEnemyTypeClick, this);
        }
        
        // 快捷操作按钮
        if (this.attackButton) {
            this.attackButton.node.on(Button.EventType.CLICK, this.onAttackClick, this);
        }
        
        if (this.takeDamageButton) {
            this.takeDamageButton.node.on(Button.EventType.CLICK, this.onTakeDamageClick, this);
        }
        
        if (this.hidePanelButton) {
            this.hidePanelButton.node.on(Button.EventType.CLICK, this.onHidePanelClick, this);
        }
        
        // 移动速度滑块
        if (this.moveSpeedSlider) {
            this.moveSpeedSlider.node.on('slide', this.onMoveSpeedChanged, this);
        }
        
        // 调试开关
        if (this.showDebugToggle) {
            this.showDebugToggle.node.on('toggle', this.onDebugToggleChanged, this);
        }
    }
    
    /**
     * 更新显示信息
     */
    private updateDisplayInfo(): void {
        if (!this.gameManager) return;
        
        // 更新模式显示
        if (this.currentModeLabel) {
            const mode = this.gameManager.testMode ? '手动测试模式' : '正常模式';
            this.currentModeLabel.string = `当前模式: ${mode}`;
        }
        
        // 更新敌人类型显示
        if (this.currentEnemyTypeLabel) {
            const enemyType = this.gameManager.getCurrentTestEnemyType();
            this.currentEnemyTypeLabel.string = `敌人类型: ${enemyType}`;
        }
        
        // 更新敌人血量显示
        if (this.enemyHealthLabel) {
            const healthInfo = this.getEnemyHealthInfo();
            this.enemyHealthLabel.string = healthInfo;
        }
        
        // 更新指令显示
        if (this.instructionsLabel) {
            if (this.gameManager.testMode) {
                this.instructionsLabel.string = 
                    '键盘操作:\n' +
                    'WASD: 移动 | J: 攻击 | H: 受伤\n' +
                    'P: 显示/隐藏面板 | T: 切换模式';
            } else {
                this.instructionsLabel.string = '切换到手动测试模式以启用控制功能';
            }
        }
        
        // 更新移动速度显示
        if (this.moveSpeedLabel && this.moveSpeedSlider) {
            const speed = Math.round(this.moveSpeedSlider.progress * 200); // 0-200的速度范围
            this.moveSpeedLabel.string = `移动速度: ${speed}`;
        }
    }
    
    // === 事件处理方法 ===
    
    /**
     * 切换模式按钮点击
     */
    private onToggleModeClick(): void {
        if (this.gameManager) {
            this.gameManager.toggleGameModePublic();
            console.log('🔄 通过面板切换游戏模式');
        }
    }
    
    /**
     * 生成敌人按钮点击
     */
    private onSpawnEnemyClick(): void {
        if (this.gameManager && this.gameManager.testMode) {
            const enemyType = this.gameManager.getCurrentTestEnemyType();
            this.gameManager.spawnTestEnemy(enemyType);
            console.log(`🎭 通过面板生成测试敌人: ${enemyType}`);
        } else {
            console.warn('⚠️ 只能在手动测试模式下生成敌人');
        }
    }
    
    /**
     * 清除敌人按钮点击
     */
    private onClearEnemyClick(): void {
        if (this.gameManager) {
            this.gameManager.clearTestEnemyPublic();
            console.log('🗑️ 通过面板清除测试敌人');
        }
    }

    /**
     * 下一个敌人类型按钮点击
     */
    private onNextEnemyTypeClick(): void {
        if (this.gameManager) {
            this.gameManager.switchToNextEnemyTypePublic();
            console.log('➡️ 通过面板切换到下一个敌人类型');
        }
    }

    /**
     * 上一个敌人类型按钮点击
     */
    private onPrevEnemyTypeClick(): void {
        if (this.gameManager) {
            this.gameManager.switchToPrevEnemyTypePublic();
            console.log('⬅️ 通过面板切换到上一个敌人类型');
        }
    }

    /**
     * 攻击按钮点击
     */
    private onAttackClick(): void {
        this.triggerAttack();
    }

    /**
     * 受伤测试按钮点击
     */
    private onTakeDamageClick(): void {
        this.triggerTakeDamage();
    }

    /**
     * 隐藏面板按钮点击
     */
    private onHidePanelClick(): void {
        this.togglePanel();
    }
    
    /**
     * 移动速度改变
     */
    private onMoveSpeedChanged(slider: Slider): void {
        const speed = Math.round(slider.progress * 200);
        console.log(`⚡ 通过面板调整移动速度: ${speed}`);
        
        // 将速度应用到当前测试敌人
        this.applySpeedToCurrentEnemy(speed);
    }
    
    /**
     * 调试开关改变
     */
    private onDebugToggleChanged(toggle: Toggle): void {
        if (this.gameManager) {
            // 切换调试显示
            this.gameManager.showSizeRanges = toggle.isChecked;
            console.log(`🔍 通过面板切换调试显示: ${toggle.isChecked ? '开启' : '关闭'}`);
        }
    }
    
    // === 公共接口方法 ===
    
    /**
     * 显示/隐藏面板
     */
    public togglePanel(): void {
        if (this.panelContainer) {
            this.panelVisible = !this.panelVisible;
            this.panelContainer.active = this.panelVisible;
            console.log(`🎛️ 面板显示状态: ${this.panelVisible ? '显示' : '隐藏'}`);
        }
    }
    
    /**
     * 设置面板位置
     */
    public setPanelPosition(position: Vec3): void {
        this.panelPosition = position;
        if (this.panelContainer) {
            this.panelContainer.setPosition(position);
        }
    }
    
    /**
     * 强制更新显示
     */
    public forceUpdateDisplay(): void {
        this.updateDisplayInfo();
    }

    // === 私有辅助方法 ===

    /**
     * 获取敌人血量信息
     */
    private getEnemyHealthInfo(): string {
        if (!this.gameManager) return '敌人血量: GameManager未初始化';
        
        // 获取当前测试敌人
        const currentEnemy = (this.gameManager as any).currentTestEnemy;
        if (!currentEnemy || !currentEnemy.isValid) {
            return '敌人血量: 无活跃测试敌人';
        }
        
        // 获取血量组件
        const characterStats = currentEnemy.getComponent('CharacterStats');
        if (characterStats) {
            const currentHealth = (characterStats as any).currentHealth || 0;
            const maxHealth = (characterStats as any).maxHealth || 0;
            return `敌人血量: ${currentHealth}/${maxHealth}`;
        }
        
        // 尝试获取血条组件
        const healthBar = currentEnemy.getComponent('HealthBarComponent');
        if (healthBar) {
            const healthData = (healthBar as any).getHealthData();
            if (healthData) {
                return `敌人血量: ${healthData.current}/${healthData.max}`;
            }
        }
        
        return '敌人血量: 无法获取血量数据';
    }

    /**
     * 将速度应用到当前测试敌人
     */
    private applySpeedToCurrentEnemy(speed: number): void {
        if (!this.gameManager) return;
        
        const currentEnemy = (this.gameManager as any).currentTestEnemy;
        if (!currentEnemy || !currentEnemy.isValid) {
            console.warn('⚠️ 无活跃测试敌人，无法应用速度');
            return;
        }
        
        // 获取BaseCharacterDemo组件
        const characterDemo = currentEnemy.getComponent('BaseCharacterDemo');
        if (characterDemo) {
            // 设置移动速度
            (characterDemo as any).moveSpeed = speed;
            console.log(`⚡ 已将移动速度设置为: ${speed}`);
        } else {
            console.warn('⚠️ 未找到BaseCharacterDemo组件');
        }
    }

    /**
     * 添加快捷攻击按钮功能
     */
    public triggerAttack(): void {
        console.log('🗡️ 通过面板触发攻击');
        // 模拟J键按下
        if (this.gameManager) {
            const KeyCode = (window as any).cc?.macro?.KEY || {};
            (this.gameManager as any).handleEnemyInput?.(KeyCode.KEY_J || 74);
        }
    }

    /**
     * 添加快捷受伤按钮功能
     */
    public triggerTakeDamage(): void {
        console.log('💔 通过面板触发受伤测试');
        // 模拟H键按下
        if (this.gameManager) {
            const KeyCode = (window as any).cc?.macro?.KEY || {};
            (this.gameManager as any).handleEnemyInput?.(KeyCode.KEY_H || 72);
        }
    }
} 