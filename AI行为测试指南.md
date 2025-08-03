# AI行为系统测试指南

## 🎯 测试目标
验证"索敌→意向→状态机"的AI行为流程是否正常工作。

## 🧪 测试步骤

### 1. 基础功能测试
1. **启动游戏**，创建AI敌人
2. **观察日志**，确认以下初始化信息：
   ```
   [UnifiedECSFactory] 组件验证: ControlComponent=true, FactionComponent=true, AIIntentionComponent=true
   [ControlComponent] 状态机初始化完成 (节点: ent_normal_red_xxx)
   [FactionComponent] 注册到索敌系统: RED
   [AnimationComponent] Animation组件已由animationManager统一管理
   ```

### 2. AI意向测试
1. **AI待机行为**
   - 预期：AI角色播放idle动画，原地等待
   - 日志：`[AIIntentionComponent] 设置意向: idle (原因: 未发现敌人)`

2. **AI索敌行为**
   - 操作：控制玩家角色接近AI角色（150px范围内）
   - 预期：AI开始朝玩家移动
   - 日志：`[AIIntentionComponent] 设置意向: seek_enemy (原因: 发现敌人但距离较远)`

3. **AI追击行为**
   - 操作：继续接近至200px范围内
   - 预期：AI加快追击速度
   - 日志：`[AIIntentionComponent] 设置意向: chase_enemy (原因: 追击敌人)`

4. **AI攻击行为**
   - 操作：接近至50px范围内
   - 预期：AI停止移动，播放攻击动画
   - 日志：`[AIIntentionComponent] 设置意向: attack_enemy (原因: 敌人在攻击范围内)`

### 3. 状态机响应测试
1. **状态转换验证**
   - IDLE → WALKING（发现敌人时）
   - WALKING → ATTACKING（接近敌人时）
   - ATTACKING → WALKING（攻击完成且敌人仍在范围内）
   - WALKING → IDLE（敌人离开范围时）

2. **动画播放验证**
   - IDLE状态：播放idle动画
   - WALKING状态：播放walk动画，面向正确方向
   - ATTACKING状态：播放attack动画

### 4. 性能验证
1. **更新频率检查**
   - AI意向更新：每0.2秒一次
   - 索敌搜索：有100ms冷却时间
   - 状态机更新：每帧更新

2. **内存泄漏检查**
   - 角色死亡或回收时是否正确清理
   - 从索敌系统正确反注册

## 🔍 调试信息查看

### 关键日志标识
- `[AIIntentionComponent]` - AI意向相关
- `[BasicEnemyFinder]` - 索敌相关  
- `[ControlComponent]` - 控制和状态机相关
- `[FactionComponent]` - 阵营注册相关

### 调试命令（控制台）
```javascript
// 查看AI意向信息
const ai = cc.find("Canvas").children.find(n => n.name.includes("ent_normal"));
const intention = ai.getComponent("AIIntentionComponent");
console.log(intention.getDebugInfo());

// 查看索敌系统状态
const finder = require("BasicEnemyFinder").basicEnemyFinder;
console.log(finder.getDebugInfo());

// 查看状态机状态  
const control = ai.getComponent("ControlComponent");
console.log("当前状态:", control.stateMachine?.getCurrentStateName());
```

## ⚠️ 常见问题排查

### 1. AI不移动
- 检查：AIIntentionComponent是否已添加
- 检查：状态机是否正确初始化
- 检查：MovementComponent的setTargetPosition方法是否存在

### 2. AI找不到敌人
- 检查：FactionComponent是否注册到BasicEnemyFinder
- 检查：玩家和AI的阵营设置是否为敌对关系
- 检查：索敌范围是否合适（默认150px）

### 3. 状态机不响应
- 检查：ICharacterController适配器是否正确实现
- 检查：输入信号是否正确传递
- 检查：状态转换条件是否满足

### 4. 动画不播放
- 检查：AnimationComponent是否由animationManager正确管理
- 检查：敌人数据是否包含正确的动画配置
- 检查：状态机是否正确调用动画方法

## 🎮 预期行为描述

### 完整AI行为循环
1. **发现阶段**：AI在150px范围内发现玩家，开始移动
2. **追击阶段**：AI持续跟随玩家移动，保持朝向正确
3. **攻击阶段**：AI接近到50px内，停止移动并播放攻击动画
4. **冷却阶段**：攻击动画完成后，根据玩家位置决定继续追击或回到待机

### 智能行为特点
- **动态目标跟踪**：实时更新玩家位置
- **合理攻击距离**：不会无限接近，保持攻击距离
- **平滑状态转换**：避免状态抖动和频繁切换
- **性能优化**：合理的更新频率，避免性能问题

---

**测试完成标准**：AI角色能够智能地发现、追击和攻击玩家，状态转换流畅，动画播放正确。