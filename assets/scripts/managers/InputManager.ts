import { _decorator, Component, input, Input, EventKeyboard, EventMouse, KeyCode, Vec2, Vec3, director, Camera, view } from 'cc';
import { eventManager } from './EventManager';
import { GameEvents } from '../components/GameEvents';

const { ccclass } = _decorator;

/**
 * 输入管理器组件
 * 既可以作为组件挂载，也可以作为单例使用
 */
@ccclass('InputManager')
export class InputManager extends Component {
    private static _instance: InputManager | null = null;
    
    // 键盘状态记录
    private keyStates: { [key: number]: boolean } = {};
    // 移动方向向量
    private moveDirection: Vec2 = new Vec2(0, 0);
    // 初始化状态
    private isInitialized: boolean = false;
    // 鼠标状态记录
    private currentMousePosition: Vec3 = new Vec3(0, 0, 0);
    private lastMousePosition: Vec3 = new Vec3(0, 0, 0);
    // 允许的移动按键列表
    private readonly MOVEMENT_KEYS: KeyCode[] = [
        KeyCode.KEY_W,      // W键 - 上
        KeyCode.KEY_A,      // A键 - 左
        KeyCode.KEY_S,      // S键 - 下
        KeyCode.KEY_D,      // D键 - 右
        KeyCode.ARROW_UP,   // 上箭头
        KeyCode.ARROW_LEFT, // 左箭头
        KeyCode.ARROW_DOWN, // 下箭头
        KeyCode.ARROW_RIGHT // 右箭头
    ];
    
    /**
     * 获取单例实例
     */
    public static get instance(): InputManager | null {
        if (!InputManager._instance) {
            // 尝试在场景中查找现有的InputManager组件
            const existingInputManager = director.getScene()?.getComponentInChildren(InputManager);
            if (existingInputManager) {
                InputManager._instance = existingInputManager;
            } else {
                // 如果没有找到，创建一个新的节点并挂载InputManager
                console.warn('InputManager: No InputManager component found in scene. Please add InputManager component to a node.');
                return null;
            }
        }
        return InputManager._instance;
    }
    
    protected onLoad() {
        // 确保只有一个InputManager实例
        if (InputManager._instance && InputManager._instance !== this) {
            console.warn('InputManager: Multiple InputManager instances detected. Destroying duplicate.');
            this.destroy();
            return;
        }
        
        InputManager._instance = this;
        this.initialize();
    }
    
    protected onDestroy() {
        if (InputManager._instance === this) {
            InputManager._instance = null;
        }
        this.cleanup();
    }
    
    /**
     * 初始化输入管理器
     */
    private initialize(): void {
        if (this.isInitialized) {
            return;
        }
        
        // 注册键盘事件监听
        input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        input.on(Input.EventType.KEY_UP, this.onKeyUp, this);
        
        // 注册鼠标事件监听
        input.on(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
        input.on(Input.EventType.MOUSE_MOVE, this.onMouseMove, this);
        
        this.isInitialized = true;
        console.log('InputManager: Initialized as component');
        console.log('InputManager: Movement restricted to WASD and Arrow keys only');
    }
    
    /**
     * 清理资源
     */
    private cleanup(): void {
        if (this.isInitialized) {
            input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
            input.off(Input.EventType.KEY_UP, this.onKeyUp, this);
            input.off(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
            input.off(Input.EventType.MOUSE_MOVE, this.onMouseMove, this);
            this.isInitialized = false;
        }
        
        // 清空键盘状态
        this.keyStates = {};
        this.moveDirection.set(0, 0);
        
        console.log('InputManager: Cleaned up');
    }
    
    /**
     * 检查按键是否是移动按键
     */
    private isMovementKey(keyCode: KeyCode): boolean {
        return this.MOVEMENT_KEYS.indexOf(keyCode) !== -1;
    }
    
    /**
     * 按键按下事件处理
     */
    private onKeyDown = (event: EventKeyboard): void => {
        this.keyStates[event.keyCode] = true;
        
        // 移动键和非移动键都需要更新移动方向
        if (this.isMovementKey(event.keyCode)) {
            this.updateMoveDirection();
        } else {
            // 发送非移动按键事件，让GameManager处理
            eventManager.emit(GameEvents.KEY_PRESSED, event.keyCode);
        }
    }
    
    /**
     * 按键松开事件处理
     */
    private onKeyUp = (event: EventKeyboard): void => {
        this.keyStates[event.keyCode] = false;
        
        // 移动键和非移动键都需要更新移动方向
        if (this.isMovementKey(event.keyCode)) {
            this.updateMoveDirection();
        } else {
            // 发送非移动按键松开事件
            eventManager.emit(GameEvents.KEY_RELEASED, event.keyCode);
        }
    }
    
    /**
     * 更新移动方向向量
     * 只响应WASD和方向键
     */
    private updateMoveDirection(): void {
        this.moveDirection.set(0, 0);
        
        // WASD 或方向键移动 - 严格限制只有这些按键
        if (this.isKeyPressed(KeyCode.KEY_A) || this.isKeyPressed(KeyCode.ARROW_LEFT)) {
            this.moveDirection.x -= 1;
        }
        if (this.isKeyPressed(KeyCode.KEY_D) || this.isKeyPressed(KeyCode.ARROW_RIGHT)) {
            this.moveDirection.x += 1;
        }
        if (this.isKeyPressed(KeyCode.KEY_W) || this.isKeyPressed(KeyCode.ARROW_UP)) {
            this.moveDirection.y += 1;
        }
        if (this.isKeyPressed(KeyCode.KEY_S) || this.isKeyPressed(KeyCode.ARROW_DOWN)) {
            this.moveDirection.y -= 1;
        }
        
        // 归一化方向向量
        if (this.moveDirection.length() > 0) {
            this.moveDirection.normalize();
        }
        
        // 发送移动方向更新事件
        eventManager.emit(GameEvents.MOVE_DIRECTION_CHANGED, this.moveDirection);
    }
    
    /**
     * 检查指定按键是否被按下
     */
    public isKeyPressed(keyCode: KeyCode): boolean {
        return !!this.keyStates[keyCode];
    }
    
    /**
     * 获取当前移动方向
     */
    public getMoveDirection(): Vec2 {
        return this.moveDirection.clone();
    }
    
    /**
     * 检查是否有任何移动输入
     */
    public hasMovementInput(): boolean {
        return this.moveDirection.length() > 0;
    }
    
    /**
     * 检查指定按键是否是允许的移动按键
     */
    public isValidMovementKey(keyCode: KeyCode): boolean {
        return this.isMovementKey(keyCode);
    }
    
    /**
     * 获取所有允许的移动按键
     */
    public getMovementKeys(): KeyCode[] {
        return [...this.MOVEMENT_KEYS];
    }
    
    /**
     * 获取当前按下的移动按键
     */
    public getPressedMovementKeys(): KeyCode[] {
        const pressedKeys: KeyCode[] = [];
        for (const keyCode of this.MOVEMENT_KEYS) {
            if (this.isKeyPressed(keyCode)) {
                pressedKeys.push(keyCode);
            }
        }
        return pressedKeys;
    }
    
    /**
     * 获取所有当前按下的键
     */
    public getPressedKeys(): KeyCode[] {
        const pressedKeys: KeyCode[] = [];
        for (const key in this.keyStates) {
            if (this.keyStates[key]) {
                pressedKeys.push(parseInt(key));
            }
        }
        return pressedKeys;
    }
    
    /**
     * 鼠标点击事件处理
     */
    private onMouseDown = (event: EventMouse): void => {
        const worldPosition = this.screenToWorldPosition(event.getLocationX(), event.getLocationY());
        this.currentMousePosition.set(worldPosition);
        
        console.log(`InputManager: 鼠标点击 - 屏幕坐标:(${event.getLocationX()}, ${event.getLocationY()}), 世界坐标:(${worldPosition.x.toFixed(2)}, ${worldPosition.y.toFixed(2)})`);
        
        // 发送鼠标点击事件
        eventManager.emit(GameEvents.MOUSE_CLICKED, worldPosition.clone());
    }
    
    /**
     * 鼠标移动事件处理
     */
    private onMouseMove = (event: EventMouse): void => {
        const worldPosition = this.screenToWorldPosition(event.getLocationX(), event.getLocationY());
        
        // 只有当鼠标位置确实发生变化时才发送事件（避免过多的事件触发）
        const threshold = 1.0; // 像素阈值
        if (Vec3.distance(this.currentMousePosition, worldPosition) > threshold) {
            this.lastMousePosition.set(this.currentMousePosition);
            this.currentMousePosition.set(worldPosition);
            
            // 发送鼠标移动事件
            eventManager.emit(GameEvents.MOUSE_MOVED, worldPosition.clone());
        }
    }
    
    /**
     * 将屏幕坐标转换为世界坐标
     * @param screenX 屏幕X坐标
     * @param screenY 屏幕Y坐标
     * @returns 世界坐标
     */
    private screenToWorldPosition(screenX: number, screenY: number): Vec3 {
        // 获取屏幕尺寸
        const visibleSize = view.getVisibleSize();
        
        // 将屏幕坐标转换为相对于屏幕中心的坐标
        const centerX = visibleSize.width / 2;
        const centerY = visibleSize.height / 2;
        
        // 计算相对于中心的偏移量
        const offsetX = screenX - centerX;
        const offsetY = centerY - screenY; // Y轴需要翻转
        
        return new Vec3(offsetX, offsetY, 0);
    }
    
    /**
     * 获取当前鼠标位置（世界坐标）
     */
    public getCurrentMousePosition(): Vec3 {
        return this.currentMousePosition.clone();
    }
    
    /**
     * 获取上一次鼠标位置（世界坐标）
     */
    public getLastMousePosition(): Vec3 {
        return this.lastMousePosition.clone();
    }
}

// 导出单例实例的获取方法
export const inputManager = {
    get instance() {
        return InputManager.instance;
    }
}; 