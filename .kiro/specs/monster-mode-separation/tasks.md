# 实现计划

- [ ] 1. 创建核心接口和枚举
  - 定义包含所有必需方法的 IMonsterController 接口
  - 创建用于不同怪物类型的 MonsterType 枚举
  - 定义用于控制器配置的 ControllerConfig 接口
  - _需求: 4.1, 4.2_

- [ ] 2. 实现 MonsterControllerFactory 工厂类
  - 创建带有静态 createController 方法的工厂类
  - 实现游戏模式检测和控制器选择逻辑
  - 为不支持的模式和类型添加错误处理
  - 为工厂功能编写单元测试
  - _需求: 2.1, 2.2_

- [ ] 3. 创建 BaseMonster 抽象基类
  - 实现通用怪物功能和组件设置
  - 为子类定义抽象的 getMonsterType 方法
  - 添加控制器委托方法（move、handleInput 等）
  - 实现共享的初始化和清理逻辑
  - _需求: 3.1, 3.2_

- [ ] 4. 实现 AIController 类
- [ ] 4.1 创建 AIController 类结构
  - 实现 IMonsterController 接口
  - 使用 AIState 枚举设置 AI 状态机
  - 添加组件引用（CharacterStats、MonsterAnimationController）
  - _需求: 1.1, 4.3_

- [ ] 4.2 实现 AI 状态机逻辑
  - 将现有 AI 逻辑从 NormalEnemy 移植到 AIController
  - 实现状态转换检查和状态执行方法
  - 添加玩家检测和交互逻辑
  - _需求: 1.1_

- [ ] 4.3 添加 AI 更新和移动系统
  - 实现用于 AI 逻辑处理的 update 方法
  - 添加移动方法（追逐、返回出生点、巡逻）
  - 与动画控制器集成以实现状态可视化
  - _需求: 1.1_

- [ ] 5. 实现 TestController 类
- [ ] 5.1 创建 TestController 类结构
  - 实现 IMonsterController 接口
  - 设置输入处理系统
  - 添加调试信息显示方法
  - _需求: 1.2, 4.4_

- [ ] 5.2 实现手动控制逻辑
  - 添加移动和动作的键盘输入处理
  - 实现带方向控制的手动移动
  - 添加调试命令（状态信息、动画测试）
  - _需求: 1.2_

- [ ] 5.3 添加测试专用功能
  - 实现状态信息显示
  - 添加手动动画控制命令
  - 创建测试实用方法
  - _需求: 1.2_

- [ ] 6. 重构 NormalEnemy 类
- [ ] 6.1 将 NormalEnemy 转换为使用 BaseMonster
  - 继承 BaseMonster 而不是 Component
  - 移除现有的 AI 和测试逻辑
  - 实现 getMonsterType 方法
  - _需求: 3.1, 3.2_

- [ ] 6.2 更新 NormalEnemy 初始化
  - 修改初始化以使用控制器工厂
  - 移除重复的组件设置代码
  - 更新事件处理以适配新架构
  - _需求: 2.1, 5.1_

- [ ] 6.3 清理 NormalEnemy 方法
  - 移除旧的 AI 方法（updateAI、checkStateTransition 等）
  - 移除旧的输入处理方法
  - 只保留怪物特定的配置方法
  - _需求: 1.1, 1.2_

- [ ] 7. 更新 GameManager 集成
- [ ] 7.1 修改 GameManager 控制器注册
  - 更新 registerEnemyController 以适配新架构
  - 修改怪物 AI 更新循环以使用控制器系统
  - 更新测试模式的输入分发
  - _需求: 2.1, 2.2_

- [ ] 7.2 移除模式切换逻辑
  - 移除 toggleGameMode 方法和相关功能
  - 简化游戏模式处理为仅启动时配置
  - 更新模式变更事件处理
  - _需求: 1.4, 5.3_

- [ ] 8. 创建 BossEnemy 类
  - 继承 BaseMonster 类
  - 实现返回 BOSS 类型的 getMonsterType 方法
  - 添加 Boss 特定的配置属性
  - 使用 AI 和测试控制器进行测试
  - _需求: 3.1, 3.3_

- [ ] 9. 更新 MonsterSpawner 集成
  - 修改怪物创建以使用新的 BaseMonster 类
  - 更新怪物类型检测和控制器分配
  - 确保生成的怪物根据游戏模式使用正确的控制器
  - _需求: 2.1, 5.1_

- [ ] 10. 添加错误处理和安全措施
  - 实现用于错误恢复的 SafeControllerWrapper
  - 添加控制器初始化失败处理
  - 创建控制器错误的回退机制
  - 添加全面的错误日志记录
  - _需求: 5.4_

- [ ] 11. 编写全面的测试
- [ ] 11.1 为控制器创建单元测试
  - 测试 AIController 状态机逻辑
  - 测试 TestController 输入处理
  - 测试 MonsterControllerFactory 创建逻辑
  - _需求: 4.1, 4.2, 4.3, 4.4_

- [ ] 11.2 创建集成测试
  - 测试不同控制器的完整怪物生命周期
  - 测试游戏模式初始化和控制器选择
  - 测试多种怪物类型与不同控制器的配合
  - _需求: 2.1, 3.1, 5.1_

- [ ] 12. 清理和优化
  - 从重构的文件中移除未使用的导入和死代码
  - 优化控制器更新性能
  - 为新类和方法添加文档注释
  - 验证所有 TypeScript 错误已解决
  - _需求: 1.1, 1.2, 1.4_