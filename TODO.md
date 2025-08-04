cursor-memory
```
The user prefers that the assistant does not make any changes until the full context has been comprehensively reviewed. Immediate or direct modifications without considering the surrounding content are discouraged.
The user prefers that code modifications strictly follow the project’s existing framework, especially the animation framework, and not introduce fallback or backup solutions; they want the root issue identified before making any changes.
The user prefers that the assistant not include documentation and provide direct outputs.
```


# 游戏功能开发记录

## 待开发
- 怪物技能和普通区分 🔄 待重构 (目前简化为只有巫妖远程攻击)

# 2025-07-25
- 增加物理碰撞日志检测 查询碰撞触发不了的原因
- 修改架构ecs 现在配置文件过于巨大 修改后把这些都拆开

寻路算法文档
https://blog.csdn.net/a1047120490/article/details/107333561
http://www.meltycriss.com/2017/01/13/paper-rvo/
https://blog.csdn.net/u012740992/article/details/89397714
https://zhuanlan.zhihu.com/p/74888471

1.首先索敌 确定敌人所在
2.通过A*寻路算法 计算出最短路径
3.通过Orca算法 控制碰撞



# 2025-07-21 
- 对战测试重构为一种关卡-测试关卡
- 增加物理碰撞--逻辑阵营的重构

## 2025-07-20 开完完成
- 所有怪物动画适配
- 增加对战测试

## 2015-07-19 已完成功能:
- 怪物基类增加血条
- 增加伤害字体
- 增加伤害测试、死亡测试
- 攻击间隔和攻击动画协调 ✅ 完成


