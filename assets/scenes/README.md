# 场景设置指南

## 如何在 Cocos Creator 编辑器中设置游戏场景

### 1. 创建主游戏场景

1. 在 Cocos Creator 编辑器中，右键点击 `assets/scenes` 文件夹
2. 选择 "新建" > "场景"
3. 将场景命名为 "Game.scene"

### 2. 设置游戏核心节点

在 Game.scene 中创建以下节点结构：

```
Game (场景根节点)
├── Canvas (画布节点)
│   ├── GameRoot (空节点)
│   │   └── 添加 GameManager 组件
│   ├── Player (玩家节点)
│   │   ├── 添加 Sprite 组件 (玩家图片)
│   │   ├── 添加 CharacterStats 组件
│   │   └── 添加 PlayerController 组件
│   └── UI (UI根节点)
│       ├── HealthBar (生命条)
│       └── GameInfo (游戏信息)
└── Camera (摄像机节点)
```

### 3. 节点设置详细说明

#### GameRoot 节点设置：
1. 创建空节点，命名为 "GameRoot"
2. 添加 GameManager 组件：
   - 在属性检查器中点击 "添加组件"
   - 搜索 "GameManager"
   - 添加组件

#### Player 节点设置：
1. 创建空节点，命名为 "Player"
2. 添加 Sprite 组件用于显示玩家图像
3. 添加 CharacterStats 组件
4. 添加 PlayerController 组件
5. 设置位置为 (0, 0, 0)

#### 摄像机设置：
1. 确保 Camera 节点存在
2. 设置摄像机位置为 (0, 0, 1000)
3. 设置 Clear Color 为黑色或你想要的背景色

### 4. 组件属性配置

#### PlayerController 组件：
- Move Speed: 200 (移动速度)
- Boundary Padding: 50 (边界内边距)

#### CharacterStats 组件：
- 这个组件会在代码中自动初始化，无需手动设置

### 5. 运行测试

1. 保存场景
2. 在 Cocos Creator 中点击 "运行" 按钮
3. 使用 WASD 或方向键控制玩家移动
4. 检查控制台输出，确认管理器正常初始化

### 6. 常见问题解决

#### 如果遇到组件找不到的问题：
1. 确认所有 TypeScript 文件都已编译
2. 检查 import 路径是否正确
3. 在编辑器中刷新脚本列表 (Ctrl+R)

#### 如果玩家移动有问题：
1. 检查 Player 节点是否正确添加了 CharacterStats 和 PlayerController 组件
2. 确认输入事件已正确注册
3. 检查边界设置是否合理

### 7. 下一步开发

场景设置完成后，你可以：
1. 添加敌人生成系统
2. 实现战斗系统
3. 添加 UI 界面
4. 创建音效和动画

记住：所有的脚本组件都使用了事件系统，这样可以轻松地扩展功能而不破坏现有代码。 