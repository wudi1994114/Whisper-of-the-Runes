# 火球动画系统使用说明

## 🔥 概述

该火球动画系统实现了三个阶段的动画控制：
1. **生成阶段**：第一帧播放一次
2. **飞行阶段**：第二三四帧循环播放  
3. **爆炸阶段**：检测到碰撞后播放第5-8帧

## 📁 文件结构

```
assets/scripts/game/
├── FireballController.ts    # 火球控制器（核心脚本）
└── FireballLauncher.ts      # 火球发射器（使用示例）

assets/resources/skill/
├── fire.plist              # 火球图集配置文件
└── fire.png                # 火球贴图（包含9帧动画）
```

## 🎯 动画帧说明

火球贴图包含9个动画帧：

| 帧索引 | 帧名称 | 用途 | 播放方式 |
|--------|--------|------|----------|
| 0 | Fire_right00 | 生成效果 | 播放一次 |
| 1-3 | Fire_right01-03 | 飞行循环 | 循环播放 |
| 4-7 | Fire_right04-07 | 爆炸效果 | 播放一次 |
| 8 | Fire_right08 | 备用帧 | 当前未使用 |

## 🛠️ 设置步骤

### 方案一：在现有Sprite节点上使用（推荐） ⭐

如果您已经有一个包含 `Sprite` 组件的节点：

1. **选择您现有的Sprite节点**
2. **添加以下组件**：
   - `FireballController` 脚本
   - `Animation` 组件（如果没有的话）
   - `CircleCollider2D` 组件（用于碰撞检测）
   - `RigidBody2D` 组件（可选，用于物理移动）

**FireballController会自动识别并使用您现有的Sprite组件！** 🎯

### 方案二：创建新的火球预制体

如果需要创建独立的火球预制体：

1. 在场景中创建一个新的2D节点，命名为 `Fireball`
2. 为节点添加以下组件：
   - `Sprite` 组件（用于显示火球贴图）
   - `Animation` 组件（用于播放动画）
   - `FireballController` 脚本
   - `CircleCollider2D` 组件（用于碰撞检测）
   - `RigidBody2D` 组件（可选，用于物理移动）

### 碰撞体配置

```typescript
// 碰撞体设置建议
CircleCollider2D: {
    radius: 24,        // 半径24像素（火球大小48x48的一半）
    isSensor: true,    // 设为传感器，避免物理碰撞
}

RigidBody2D: {
    type: Kinematic,   // 运动学刚体
    gravityScale: 0,   // 不受重力影响
}
```

### FireballController参数配置

```typescript
// 在编辑器中设置或通过代码设置
FireballController: {
    moveSpeed: 300,      // 移动速度（像素/秒）
    damage: 50,          // 伤害值
    lifeTime: 5,         // 生命时间（秒）
    frameRate: 12,       // 动画帧率
    launchAngle: 0,      // 发射角度（度），0=水平向右，90=向上，-90=向下
}
```

### 保存为预制体（可选）

如果需要重复使用，将配置好的节点拖拽到 `assets/prefabs/` 目录下保存为预制体。

## 💻 代码使用示例

### 在现有节点上使用（推荐）

```typescript
import { FireballController } from '../game/FireballController';

// 方式1：在现有sprite节点上直接添加组件
const existingSpriteNode = this.myPlayerNode; // 您现有的sprite节点
const fireballController = existingSpriteNode.addComponent(FireballController);

// 方式2：如果已经有FireballController组件
const fireballController = existingSpriteNode.getComponent(FireballController);

// 设置发射参数
fireballController.moveSpeed = 400;
fireballController.damage = 75;

// 设置发射角度（推荐）
fireballController.setAngle(45);  // 45度角发射（向右上方）
fireballController.setAngle(0);   // 水平向右发射（默认）
fireballController.setAngle(90);  // 垂直向上发射
fireballController.setAngle(-90); // 垂直向下发射

// 设置发射方向向量
const direction = new Vec3(1, 0, 0); // 向右发射
fireballController.setMoveDirection(direction);

// 设置目标位置（自动计算角度和方向）
const targetPos = new Vec3(100, 100, 0);
fireballController.setTarget(targetPos);

// 手动触发爆炸
fireballController.explode();
```

### 使用预制体创建火球

```typescript
import { FireballController } from '../game/FireballController';

// 创建火球实例
const fireballNode = instantiate(fireballPrefab);
const fireball = fireballNode.getComponent(FireballController);

// 设置发射角度（推荐）
fireball.setAngle(45);  // 45度角发射（向右上方）
fireball.setAngle(0);   // 水平向右发射（默认）
fireball.setAngle(90);  // 垂直向上发射
fireball.setAngle(-90); // 垂直向下发射

// 设置发射方向向量
const direction = new Vec3(1, 0, 0); // 向右发射
fireball.setMoveDirection(direction);

// 设置目标位置（自动计算角度和方向）
const targetPos = new Vec3(100, 100, 0);
fireball.setTarget(targetPos);

// 手动触发爆炸
fireball.explode();
```

### 使用发射器

```typescript
import { FireballLauncher } from '../game/FireballLauncher';

// 在编辑器中设置fireballPrefab属性和defaultAngle
// 然后可以通过代码发射火球

// 方式1：按默认角度发射（推荐）
fireballLauncher.launchFireball(); // 使用defaultAngle属性的角度

// 方式2：按指定角度发射
fireballLauncher.launchFireballAtAngle(45);   // 45度角发射
fireballLauncher.launchFireballAtAngle(0);    // 水平发射
fireballLauncher.launchFireballAtAngle(90);   // 向上发射
fireballLauncher.launchFireballAtAngle(-45);  // 向右下45度发射

// 方式3：向指定方向发射
const direction = new Vec3(1, 1, 0);
fireballLauncher.launchFireballInDirection(direction);

// 方式4：向指定位置发射
const targetPos = new Vec3(200, 200, 0);
fireballLauncher.launchFireballToPosition(targetPos);

// 检查冷却状态
if (!fireballLauncher.isOnCooldown()) {
    // 可以发射
}
```

## 🎮 快速开始

**最简单的使用方式：**

1. 选择您现有的sprite节点
2. 添加 `FireballController` 组件
3. 调用 `fireballController.setAngle(0)` 开始发射

就这么简单！🚀

## 🔧 自定义配置

### 修改动画帧分配

如果需要调整动画帧的使用，可以修改 `FireballController.ts` 中的 `createAnimationClips` 方法：

```typescript
// 创建生成动画（第0帧，播放一次）
this.spawnClip = this.createAnimationClip('fireball_spawn', [0], false);

// 创建飞行动画（第1-3帧，循环播放）
this.flyingClip = this.createAnimationClip('fireball_flying', [1, 2, 3], true);

// 创建爆炸动画（第4-7帧，播放一次）
this.explodeClip = this.createAnimationClip('fireball_explode', [4, 5, 6, 7], false);
```

### 添加自定义事件

系统已集成事件管理器，可以监听火球相关事件：

```typescript
import { eventManager } from '../core/EventManager';

// 监听火球销毁事件
eventManager.on('FIREBALL_DESTROYED', (fireballNode: Node) => {
    console.log('火球已销毁:', fireballNode.name);
});

// 监听角色受伤事件（火球造成的伤害）
eventManager.on(GameEvents.CHARACTER_DAMAGED, (target: Node, damage: number) => {
    console.log(`${target.name} 受到 ${damage} 点伤害`);
});
```

## 🚀 性能优化建议

1. **对象池化**：对于频繁创建/销毁的火球，考虑使用对象池
2. **资源预加载**：在游戏开始时预加载火球图集
3. **碰撞优化**：合理设置碰撞体大小，避免过度检测
4. **生命周期管理**：及时销毁超时的火球，避免内存泄漏

## 🐛 故障排除

### 常见问题

1. **动画不播放**
   - 检查火球图集是否正确加载
   - 确认 Sprite 和 Animation 组件已添加

2. **碰撞检测不工作**
   - 确认已添加 Collider2D 组件
   - 检查碰撞层级设置

3. **火球不移动**
   - 确认已调用 `setMoveDirection` 或 `setTarget`
   - 检查 moveSpeed 参数是否大于0

4. **性能问题**
   - 减少同时存在的火球数量
   - 检查是否有火球未正确销毁

## 📝 重要提示

1. ✅ **可以直接在现有Sprite节点上使用** - FireballController会自动识别现有组件
2. ✅ 确保火球图集路径正确：`assets/resources/skill/fire`
3. ✅ 火球会在碰撞或超时后自动销毁
4. ✅ 使用发射器时需要设置预制体引用
5. ✅ 建议在真机上测试性能表现

## 🎨 扩展功能

可以基于现有系统扩展更多功能：

- 不同类型的投射物（冰球、雷球等）
- 轨迹效果和粒子系统
- 伤害类型和属性系统
- AI自动瞄准系统
- 技能冷却UI显示

---

有任何问题或建议，请查看代码注释或联系开发团队。🔥 