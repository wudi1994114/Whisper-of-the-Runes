import { _decorator, Component, Animation, AnimationClip, Node, Sprite } from 'cc';
import { AnimationManager } from '../animation/AnimationManager';
import { AnimationState, AnimationDirection } from '../animation/AnimationConfig';

const { ccclass, property } = _decorator;

/**
 * Ent 动画演示脚本
 * 加载 Ent1 的所有动画，并轮流播放攻击动画
 * 挂载到精灵节点上即可
 */
@ccclass('EntAnimationDemo')
export class EntAnimationDemo extends Component {
    private animationManager: AnimationManager | null = null;
    private animationComponent: Animation | null = null;
    private spriteComponent: Sprite | null = null;
    private attackClips: AnimationClip[] = [];
    private currentIndex: number = 0;
    private directions = [
        AnimationDirection.FRONT,
        AnimationDirection.BACK,
        AnimationDirection.LEFT,
        AnimationDirection.RIGHT
    ];
    private isPlaying: boolean = false;

    async onLoad() {
        console.log('[EntAnimationDemo] 开始初始化组件...');
        this.setupComponents();
        this.animationManager = AnimationManager.instance;
        console.log('[EntAnimationDemo] 开始加载 Ent1 攻击动画...');
        await this.loadEnt1AttackAnimations();
        console.log('[EntAnimationDemo] 攻击动画加载完成，开始轮流播放');
        this.playNextAttackAnimation();
    }

    /**
     * 设置必要的组件
     */
    private setupComponents() {
        // 获取或添加 Sprite 组件
        this.spriteComponent = this.getComponent(Sprite);
        if (!this.spriteComponent) {
            this.spriteComponent = this.addComponent(Sprite);
            console.log('[EntAnimationDemo] 已添加 Sprite 组件');
        } else {
            console.log('[EntAnimationDemo] 已存在 Sprite 组件');
        }
    }

    /**
     * 加载 Ent1 的所有攻击动画
     */
    private async loadEnt1AttackAnimations() {
        // 直接用 AnimationManager 创建动画剪辑
        const enemyData = {
            id: 'ent_normal',
            name: '小树人',
            plistUrl: 'monster/ent',
            assetNamePrefix: 'Ent1',
            nodeScale: 0.8,
            animationSpeed: 8
        };
        const clipsMap = await this.animationManager!.createAllAnimationClips(enemyData as any);
        console.log('[EntAnimationDemo] 动画剪辑 Map 创建完成，包含的动画：');
        clipsMap.forEach((clip, key) => {
            console.log(`  - ${key}: ${clip.name} (${clip.duration}s)`);
        });
        
        // 只取攻击动画
        this.attackClips = [
            clipsMap.get(`${AnimationState.ATTACK}_${AnimationDirection.FRONT}`)!,
            clipsMap.get(`${AnimationState.ATTACK}_${AnimationDirection.BACK}`)!,
            clipsMap.get(`${AnimationState.ATTACK}_${AnimationDirection.LEFT}`)!,
            clipsMap.get(`${AnimationState.ATTACK}_${AnimationDirection.RIGHT}`)!
        ].filter(Boolean);
        console.log(`[EntAnimationDemo] 共加载到 ${this.attackClips.length} 个攻击动画片段`);
        
        // 设置 Animation 组件
        this.animationComponent = this.animationManager!.setupAnimationComponent(this.node, clipsMap);
        if (this.animationComponent) {
            console.log('[EntAnimationDemo] Animation 组件已设置');
            console.log(`[EntAnimationDemo] Animation 组件包含 ${this.animationComponent.clips.length} 个动画片段`);
        } else {
            console.warn('[EntAnimationDemo] Animation 组件设置失败');
        }
    }

    /**
         * 轮流播放攻击动画
         */
    private playNextAttackAnimation() {
        if (!this.attackClips.length || !this.animationComponent) {
            console.warn('[EntAnimationDemo] 没有可用的攻击动画片段或 Animation 组件未初始化');
            return;
        }
        
        this.isPlaying = true;
        const clip = this.attackClips[this.currentIndex];
        const direction = this.directions[this.currentIndex];
        const animationName = `${AnimationState.ATTACK}_${direction}`;
        
        console.log(`[EntAnimationDemo] 准备播放攻击动画: ${animationName} (index: ${this.currentIndex})`);

        // 【关键诊断代码】在播放前，打印出 clip 对象的详细信息
        const clipToInspect = this.attackClips[this.currentIndex];
        console.log('[EntAnimationDemo] 检查待播放的动画剪辑数据:', clipToInspect);

        // ... 后续代码保持不变 ...
        this.animationComponent.enabled = true;
        this.animationComponent.stop();
        const state = this.animationComponent.play(animationName);
        
        // 【关键修改】检查 state 是否成功创建
        if (state) {
            console.log(`[EntAnimationDemo] 动画 '${animationName}' 已成功开始播放。持续时间: ${state.duration}s`);
            
            // 监听动画播放完成事件
            this.animationComponent.once(Animation.EventType.FINISHED, () => {
                console.log(`[EntAnimationDemo] 动画 ${animationName} 播放结束，切换到下一个`);
                this.currentIndex = (this.currentIndex + 1) % this.attackClips.length;
                this.playNextAttackAnimation();
            });
        } else {
            // 如果 state 为 null，说明播放失败
            console.error(`[EntAnimationDemo] 播放动画失败: ${animationName}。请检查动画剪辑是否有效或 Animation 组件状态是否正常。`);
            
            // 检查 Animation 组件中是否存在该剪辑，以帮助调试
            const hasClip = this.animationComponent.clips.some(c => c && c.name === animationName);
            if (!hasClip) {
                console.error(`[EntAnimationDemo] 调试信息：Animation 组件中不存在名为 '${animationName}' 的剪辑。`);
            } else {
                console.error(`[EntAnimationDemo] 调试信息：Animation 组件中存在名为 '${animationName}' 的剪辑，但无法播放。`);
            }
        }
    }

    onDestroy() {
        this.isPlaying = false;
        if (this.animationComponent) {
            this.animationComponent.stop();
            console.log('[EntAnimationDemo] 组件销毁，动画停止');
        }
    }
} 