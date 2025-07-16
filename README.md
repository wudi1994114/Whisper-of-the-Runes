# Whisper-of-the-Runes (符文之语)

一个基于 Cocos Creator 开发的 2D ARPG 游戏项目。

## 🎮 项目概述

Whisper-of-the-Runes 是一个功能完整的 2D 动作角色扮演游戏，具有：
- 玩家角色控制系统
- 智能敌人 AI 系统
- 完整的动画系统
- 数据驱动的配置系统
- 事件驱动的架构设计

## 🛠️ 技术栈

- **引擎**: Cocos Creator 3.8.5
- **语言**: TypeScript (严格模式)
- **架构**: 事件驱动 + 组件化设计
- **平台**: Web/移动端

## 🚀 快速开始

### 环境要求
- Cocos Creator 3.8.5+
- Node.js 16+
- TypeScript 4.0+

### 安装步骤
1. 克隆项目到本地
2. 使用 Cocos Creator 打开项目
3. 等待资源导入完成
4. 运行项目进行测试

### 场景设置
参考 `assets/scenes/README.md` 了解如何正确设置游戏场景。

## 🎯 核心功能

### 玩家系统
- WASD/方向键控制移动
- 角色属性系统（生命值、攻击力、防御力、速度）
- 边界检测和碰撞处理

### 敌人 AI 系统
- 多种敌人类型（普通、精英、Boss）
- 智能状态机（待机、追逐、攻击、返回、受伤、死亡）
- 可配置的 AI 行为参数

### 动画系统
- 四方向动画支持（前、后、左、右）
- 状态驱动的动画切换
- 可配置的动画参数

### 数据管理
- JSON 配置文件驱动
- 异步数据加载
- 类型安全的数据访问

## 🎮 游戏控制

### 基础控制
- `WASD` 或 `方向键`: 移动角色
- `T`: 切换控制模式（玩家/怪物测试模式）
- `I`: 显示状态信息（测试模式下）

### 游戏模式
- **Normal 模式**: 玩家控制角色，怪物自动 AI
- **Testing 模式**: 可以控制怪物进行测试

## 📁 项目结构

```
assets/
├── animations/          # 动画资源
├── audio/              # 音频资源
├── prefabs/            # 预制体
├── resources/          # 运行时资源
│   ├── data/          # 配置数据
│   ├── monster/       # 怪物资源
│   ├── player/        # 玩家资源
│   └── skill/         # 技能资源
├── scenes/            # 场景文件
├── scripts/           # 脚本代码
│   ├── animation/     # 动画控制
│   ├── components/    # 组件
│   ├── configs/       # 配置定义
│   ├── core/         # 核心系统
│   ├── game/         # 游戏逻辑
│   └── ui/           # UI 系统
└── textures/         # 纹理资源
```

## 🔧 开发指南

### 添加新敌人
1. 在 `assets/resources/data/enemies.jsonc` 中添加配置
2. 准备对应的图集资源
3. 使用 `DataManager.getEnemyData()` 获取配置

### 扩展 AI 行为
1. 在 `EnemyConfig.ts` 中定义新的 AI 类型
2. 在 `NormalEnemy.ts` 中实现对应逻辑
3. 更新状态机转换条件

### 添加新动画
1. 准备动画帧资源
2. 在 `AnimationConfig.ts` 中定义动画状态
3. 在 `MonsterAnimationController.ts` 中实现播放逻辑

## 🐛 已知问题

- UI 系统尚未完全实现
- 音频管理系统待开发
- 技能系统需要完善
- 缺少存档功能

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 发起 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 📞 联系方式

如有问题或建议，请通过 Issues 联系我们。

---

**注意**: 本项目正在积极开发中，功能和 API 可能会发生变化。
