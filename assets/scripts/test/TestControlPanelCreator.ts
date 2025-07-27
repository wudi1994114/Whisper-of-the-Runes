import { _decorator, Node, Button, Label, Slider, Toggle, UITransform, Color, Sprite, Layout, Widget } from 'cc';
import { TestControlPanel } from './TestControlPanel';

const { ccclass } = _decorator;

/**
 * 测试控制面板UI创建器
 * 负责动态创建完整的测试控制面板UI组件
 */
@ccclass('TestControlPanelCreator')
export class TestControlPanelCreator {
    
    /**
     * 创建完整的测试控制面板UI
     * @param container 面板容器节点
     * @param panelComponent TestControlPanel组件实例
     */
    public static createCompleteUI(container: Node, panelComponent: TestControlPanel): void {
        console.log('🎨 开始创建完整的测试控制面板UI...');
        
        // 设置容器基本属性
        this.setupContainer(container);
        
        // 创建主要区域
        const titleArea = this.createTitleArea(container);
        const modeArea = this.createModeControlArea(container);
        const enemyArea = this.createEnemyManagementArea(container);
        const paramArea = this.createParameterArea(container);
        const actionArea = this.createActionArea(container);
        const infoArea = this.createInfoArea(container);
        
        // 分配UI引用到TestControlPanel组件
        this.assignUIReferences(panelComponent, {
            titleArea,
            modeArea,
            enemyArea,
            paramArea,
            actionArea,
            infoArea
        });
        
        console.log('✅ 测试控制面板UI创建完成');
    }
    
    /**
     * 设置容器基本属性
     */
    private static setupContainer(container: Node): void {
        // 获取或添加UITransform
        let uiTransform = container.getComponent(UITransform);
        if (!uiTransform) {
            uiTransform = container.addComponent(UITransform);
        }
        uiTransform.setContentSize(420, 600);
        
        // 设置位置到右侧
        container.setPosition(400, 280, 0);
        
        // 添加背景
        const bg = this.createBackground(container, 420, 600);
        container.addChild(bg);
        
        // 添加垂直布局组件（用于自动排列子元素）
        const layout = container.addComponent(Layout);
        layout.type = Layout.Type.VERTICAL;
        layout.resizeMode = Layout.ResizeMode.CONTAINER;
        layout.paddingTop = 20;
        layout.paddingBottom = 20;
        layout.paddingLeft = 20;
        layout.paddingRight = 20;
        layout.spacingY = 15;
    }
    
    /**
     * 创建背景节点
     */
    private static createBackground(parent: Node, width: number, height: number): Node {
        const bgNode = new Node('Background');
        const sprite = bgNode.addComponent(Sprite);
        
        let uiTransform = bgNode.getComponent(UITransform);
        if (!uiTransform) {
            uiTransform = bgNode.addComponent(UITransform);
        }
        uiTransform.setContentSize(width, height);
        
        // 设置半透明深色背景
        sprite.color = new Color(30, 30, 30, 200);
        
        return bgNode;
    }
    
    /**
     * 创建标题区域
     */
    private static createTitleArea(parent: Node): any {
        const titleNode = new Node('TitleArea');
        const titleLabel = titleNode.addComponent(Label);
        
        let uiTransform = titleNode.getComponent(UITransform);
        if (!uiTransform) {
            uiTransform = titleNode.addComponent(UITransform);
        }
        uiTransform.setContentSize(380, 40);
        
        titleLabel.string = '🎛️ 测试控制面板';
        titleLabel.fontSize = 22;
        titleLabel.color = new Color(255, 255, 100, 255); // 金黄色标题
        
        parent.addChild(titleNode);
        return { titleLabel };
    }
    
    /**
     * 创建模式控制区域
     */
    private static createModeControlArea(parent: Node): any {
        const modeArea = new Node('ModeControlArea');
        let uiTransform = modeArea.getComponent(UITransform);
        if (!uiTransform) {
            uiTransform = modeArea.addComponent(UITransform);
        }
        uiTransform.setContentSize(380, 80);
        
        // 创建区域标题
        const sectionTitle = this.createSectionTitle('📱 模式控制', modeArea);
        
        // 创建切换模式按钮
        const toggleButton = this.createButton('切换模式', modeArea, 0, -25);
        
        // 创建模式显示标签
        const modeLabel = this.createLabel('当前模式: 正常模式', modeArea, 0, -45, 16);
        
        parent.addChild(modeArea);
        return { toggleButton, modeLabel };
    }
    
    /**
     * 创建敌人管理区域
     */
    private static createEnemyManagementArea(parent: Node): any {
        const enemyArea = new Node('EnemyManagementArea');
        let uiTransform = enemyArea.getComponent(UITransform);
        if (!uiTransform) {
            uiTransform = enemyArea.addComponent(UITransform);
        }
        uiTransform.setContentSize(380, 120);
        
        // 创建区域标题
        const sectionTitle = this.createSectionTitle('👾 敌人管理', enemyArea);
        
        // 创建敌人类型切换行
        const typeRow = new Node('TypeRow');
        typeRow.setPosition(0, -25, 0);
        enemyArea.addChild(typeRow);
        
        const prevButton = this.createButton('⬅️', typeRow, -120, 0, 60);
        const typeLabel = this.createLabel('敌人类型: ent_normal', typeRow, 0, 0, 14);
        const nextButton = this.createButton('➡️', typeRow, 120, 0, 60);
        
        // 创建操作按钮行
        const buttonRow = new Node('ButtonRow');
        buttonRow.setPosition(0, -50, 0);
        enemyArea.addChild(buttonRow);
        
        const spawnButton = this.createButton('生成敌人', buttonRow, -70, 0, 100);
        const clearButton = this.createButton('清除敌人', buttonRow, 70, 0, 100);
        
        // 创建血量显示
        const healthLabel = this.createLabel('敌人血量: 无活跃敌人', enemyArea, 0, -75, 14);
        
        parent.addChild(enemyArea);
        return { 
            prevButton, 
            nextButton, 
            typeLabel, 
            spawnButton, 
            clearButton, 
            healthLabel 
        };
    }
    
    /**
     * 创建参数调节区域
     */
    private static createParameterArea(parent: Node): any {
        const paramArea = new Node('ParameterArea');
        let uiTransform = paramArea.getComponent(UITransform);
        if (!uiTransform) {
            uiTransform = paramArea.addComponent(UITransform);
        }
        uiTransform.setContentSize(380, 100);
        
        // 创建区域标题
        const sectionTitle = this.createSectionTitle('⚙️ 参数调节', paramArea);
        
        // 创建移动速度行
        const speedRow = new Node('SpeedRow');
        speedRow.setPosition(0, -30, 0);
        paramArea.addChild(speedRow);
        
        const speedLabel = this.createLabel('移动速度: 100', speedRow, -120, 0, 14);
        const speedSlider = this.createSlider(speedRow, 30, 0, 200);
        
        // 创建调试开关行
        const debugRow = new Node('DebugRow');
        debugRow.setPosition(0, -55, 0);
        paramArea.addChild(debugRow);
        
        const debugToggle = this.createToggle(debugRow, -120, 0);
        const debugLabel = this.createLabel('显示调试信息', debugRow, -80, 0, 14);
        
        parent.addChild(paramArea);
        return { speedSlider, speedLabel, debugToggle };
    }
    
    /**
     * 创建快捷操作区域
     */
    private static createActionArea(parent: Node): any {
        const actionArea = new Node('ActionArea');
        let uiTransform = actionArea.getComponent(UITransform);
        if (!uiTransform) {
            uiTransform = actionArea.addComponent(UITransform);
        }
        uiTransform.setContentSize(380, 80);
        
        // 创建区域标题
        const sectionTitle = this.createSectionTitle('🎮 快捷操作', actionArea);
        
        // 创建按钮行
        const buttonRow = new Node('ActionButtonRow');
        buttonRow.setPosition(0, -35, 0);
        actionArea.addChild(buttonRow);
        
        const attackButton = this.createButton('攻击', buttonRow, -90, 0, 80);
        const damageButton = this.createButton('受伤', buttonRow, 0, 0, 80);
        const hideButton = this.createButton('隐藏', buttonRow, 90, 0, 80);
        
        parent.addChild(actionArea);
        return { attackButton, damageButton, hideButton };
    }
    
    /**
     * 创建信息显示区域
     */
    private static createInfoArea(parent: Node): any {
        const infoArea = new Node('InfoArea');
        let uiTransform = infoArea.getComponent(UITransform);
        if (!uiTransform) {
            uiTransform = infoArea.addComponent(UITransform);
        }
        uiTransform.setContentSize(380, 80);
        
        // 创建信息标签
        const infoLabel = this.createLabel(
            '键盘操作:\nWASD: 移动 | J: 攻击 | H: 受伤\nP: 显示/隐藏面板 | T: 切换模式',
            infoArea, 0, 0, 12
        );
        infoLabel.color = new Color(180, 180, 180, 255);
        
        parent.addChild(infoArea);
        return { infoLabel };
    }
    
    /**
     * 创建区域标题
     */
    private static createSectionTitle(text: string, parent: Node): Label {
        const titleNode = new Node('SectionTitle');
        const label = titleNode.addComponent(Label);
        
        let uiTransform = titleNode.getComponent(UITransform);
        if (!uiTransform) {
            uiTransform = titleNode.addComponent(UITransform);
        }
        uiTransform.setContentSize(380, 25);
        
        titleNode.setPosition(0, 15, 0);
        label.string = text;
        label.fontSize = 16;
        label.color = new Color(100, 200, 255, 255); // 蓝色区域标题
        
        parent.addChild(titleNode);
        return label;
    }
    
    /**
     * 创建按钮
     */
    private static createButton(text: string, parent: Node, x: number, y: number, width: number = 100): Button {
        const buttonNode = new Node('Button_' + text);
        const button = buttonNode.addComponent(Button);
        
        let uiTransform = buttonNode.getComponent(UITransform);
        if (!uiTransform) {
            uiTransform = buttonNode.addComponent(UITransform);
        }
        uiTransform.setContentSize(width, 30);
        
        buttonNode.setPosition(x, y, 0);
        
        // 创建背景子节点
        const bgNode = new Node('Background');
        const bgSprite = bgNode.addComponent(Sprite);
        let bgTransform = bgNode.getComponent(UITransform);
        if (!bgTransform) {
            bgTransform = bgNode.addComponent(UITransform);
        }
        bgTransform.setContentSize(width, 30);
        bgSprite.color = new Color(70, 70, 150, 255); // 深蓝色按钮背景
        buttonNode.addChild(bgNode);
        
        // 创建文字子节点
        const labelNode = new Node('Label');
        const label = labelNode.addComponent(Label);
        let labelTransform = labelNode.getComponent(UITransform);
        if (!labelTransform) {
            labelTransform = labelNode.addComponent(UITransform);
        }
        labelTransform.setContentSize(width, 30);
        
        // 设置按钮文字
        label.string = text;
        label.fontSize = 14;
        label.color = new Color(255, 255, 255, 255);
        
        buttonNode.addChild(labelNode);
        
        // 设置Button组件的目标节点
        button.target = buttonNode;
        
        parent.addChild(buttonNode);
        return button;
    }
    
    /**
     * 创建标签
     */
    private static createLabel(text: string, parent: Node, x: number, y: number, fontSize: number = 14): Label {
        const labelNode = new Node('Label');
        const label = labelNode.addComponent(Label);
        
        let uiTransform = labelNode.getComponent(UITransform);
        if (!uiTransform) {
            uiTransform = labelNode.addComponent(UITransform);
        }
        uiTransform.setContentSize(300, fontSize * 2);
        
        labelNode.setPosition(x, y, 0);
        label.string = text;
        label.fontSize = fontSize;
        label.color = new Color(220, 220, 220, 255);
        label.lineHeight = fontSize + 2;
        
        parent.addChild(labelNode);
        return label;
    }
    
    /**
     * 创建滑块
     */
    private static createSlider(parent: Node, x: number, y: number, width: number = 150): Slider {
        const sliderNode = new Node('Slider');
        const slider = sliderNode.addComponent(Slider);
        
        let uiTransform = sliderNode.getComponent(UITransform);
        if (!uiTransform) {
            uiTransform = sliderNode.addComponent(UITransform);
        }
        uiTransform.setContentSize(width, 20);
        
        sliderNode.setPosition(x, y, 0);
        
        // 创建背景
        const bg = new Node('Background');
        const bgSprite = bg.addComponent(Sprite);
        let bgTransform = bg.getComponent(UITransform);
        if (!bgTransform) {
            bgTransform = bg.addComponent(UITransform);
        }
        bgTransform.setContentSize(width, 6);
        bgSprite.color = new Color(60, 60, 60, 255);
        sliderNode.addChild(bg);
        
        // 创建进度条
        const progress = new Node('Progress');
        const progressSprite = progress.addComponent(Sprite);
        let progressTransform = progress.getComponent(UITransform);
        if (!progressTransform) {
            progressTransform = progress.addComponent(UITransform);
        }
        progressTransform.setContentSize(width, 6);
        progressSprite.color = new Color(100, 200, 100, 255);
        sliderNode.addChild(progress);
        
        // 创建滑块把手
        const handle = new Node('Handle');
        const handleSprite = handle.addComponent(Sprite);
        let handleTransform = handle.getComponent(UITransform);
        if (!handleTransform) {
            handleTransform = handle.addComponent(UITransform);
        }
        handleTransform.setContentSize(20, 20);
        handleSprite.color = new Color(150, 150, 255, 255);
        sliderNode.addChild(handle);
        
        // 设置滑块组件引用
        slider.slideEvents = [];
        slider.progress = 0.5; // 默认50%
        
        parent.addChild(sliderNode);
        return slider;
    }
    
    /**
     * 创建开关
     */
    private static createToggle(parent: Node, x: number, y: number): Toggle {
        const toggleNode = new Node('Toggle');
        const toggle = toggleNode.addComponent(Toggle);
        
        let uiTransform = toggleNode.getComponent(UITransform);
        if (!uiTransform) {
            uiTransform = toggleNode.addComponent(UITransform);
        }
        uiTransform.setContentSize(30, 30);
        
        toggleNode.setPosition(x, y, 0);
        
        // 创建背景
        const bg = new Node('Background');
        const bgSprite = bg.addComponent(Sprite);
        let bgTransform = bg.getComponent(UITransform);
        if (!bgTransform) {
            bgTransform = bg.addComponent(UITransform);
        }
        bgTransform.setContentSize(25, 25);
        bgSprite.color = new Color(80, 80, 80, 255);
        toggleNode.addChild(bg);
        
        // 创建勾选标记
        const checkmark = new Node('Checkmark');
        const checkSprite = checkmark.addComponent(Sprite);
        let checkTransform = checkmark.getComponent(UITransform);
        if (!checkTransform) {
            checkTransform = checkmark.addComponent(UITransform);
        }
        checkTransform.setContentSize(20, 20);
        checkSprite.color = new Color(100, 255, 100, 255);
        checkmark.active = false; // 默认不勾选
        toggleNode.addChild(checkmark);
        
        parent.addChild(toggleNode);
        return toggle;
    }
    
    /**
     * 分配UI引用到TestControlPanel组件
     */
    private static assignUIReferences(panelComponent: TestControlPanel, areas: any): void {
        // 分配按钮引用
        (panelComponent as any).toggleModeButton = areas.modeArea.toggleButton;
        (panelComponent as any).spawnEnemyButton = areas.enemyArea.spawnButton;
        (panelComponent as any).clearEnemyButton = areas.enemyArea.clearButton;
        (panelComponent as any).nextEnemyTypeButton = areas.enemyArea.nextButton;
        (panelComponent as any).prevEnemyTypeButton = areas.enemyArea.prevButton;
        (panelComponent as any).attackButton = areas.actionArea.attackButton;
        (panelComponent as any).takeDamageButton = areas.actionArea.damageButton;
        (panelComponent as any).hidePanelButton = areas.actionArea.hideButton;
        
        // 分配标签引用
        (panelComponent as any).currentModeLabel = areas.modeArea.modeLabel;
        (panelComponent as any).currentEnemyTypeLabel = areas.enemyArea.typeLabel;
        (panelComponent as any).enemyHealthLabel = areas.enemyArea.healthLabel;
        (panelComponent as any).instructionsLabel = areas.infoArea.infoLabel;
        (panelComponent as any).moveSpeedLabel = areas.paramArea.speedLabel;
        
        // 分配控制组件引用
        (panelComponent as any).moveSpeedSlider = areas.paramArea.speedSlider;
        (panelComponent as any).showDebugToggle = areas.paramArea.debugToggle;
        
        console.log('🔗 UI组件引用分配完成');
    }
} 