// assets/scripts/animation/AnimationManager.ts

import { _decorator, SpriteAtlas, SpriteFrame, AnimationClip, Animation, Node, animation, Sprite, js } from 'cc';
import { AnimationState, AnimationDirection, AnimationFrameData, getAnimationConfigByPrefix, animationConfigDatabase, ProjectileAnimationState, ProjectileAnimationConfig, getProjectileAnimationConfig } from '../configs/AnimationConfig';
import { EnemyData } from '../configs/EnemyConfig';
import { dataManager } from '../managers/DataManager';
import { resourceManager } from '../managers/ResourceManager';

const { ccclass } = _decorator;

/**
 * 动画管理器
 * 负责加载和管理动画资源，动态创建动画剪辑
 */
@ccclass('AnimationManager')
export class AnimationManager {
    private static _instance: AnimationManager;
    
    // 缓存已加载的精灵图集
    private spriteAtlasCache: Map<string, SpriteAtlas> = new Map();
    
    // 缓存已创建的动画剪辑
    private animationClipCache: Map<string, AnimationClip> = new Map();
    
    // 关卡级别的动画缓存 - 格式: levelId -> enemyType -> animationClips
    private levelAnimationCache: Map<number, Map<string, Map<string, AnimationClip>>> = new Map();

    public static get instance(): AnimationManager {
        if (!this._instance) {
            this._instance = new AnimationManager();
        }
        return this._instance;
    }

    /**
     * 加载精灵图集
     * @param atlasPath 图集路径
     * @returns Promise<SpriteAtlas>
     */
    public async loadSpriteAtlas(atlasPath: string): Promise<SpriteAtlas> {
        // 检查缓存
        if (this.spriteAtlasCache.has(atlasPath)) {
            return this.spriteAtlasCache.get(atlasPath)!;
        }

        try {
            const atlas = await resourceManager.loadResource(atlasPath, SpriteAtlas);
            if (atlas) {
                this.spriteAtlasCache.set(atlasPath, atlas);
                console.log(`AnimationManager: 图集加载成功 ${atlasPath}`);
                return atlas;
            } else {
                throw new Error(`Failed to load sprite atlas: ${atlasPath}`);
            }
        } catch (error) {
            console.error(`AnimationManager: 图集加载失败 ${atlasPath}`, error);
            throw error;
        }
    }

    /**
     * 从精灵图集获取精灵帧
     * @param atlas 精灵图集
     * @param frameName 帧名称
     * @returns SpriteFrame或null
     */
    public getSpriteFrame(atlas: SpriteAtlas, frameName: string): SpriteFrame | null {
        // 首先尝试不带后缀的名称
        let spriteFrame = atlas.getSpriteFrame(frameName);
        
        // 如果没找到，尝试带 .png 后缀的名称
        if (!spriteFrame) {
            spriteFrame = atlas.getSpriteFrame(frameName + '.png');
        }
        
        if (!spriteFrame) {
            console.warn(`Sprite frame not found: ${frameName} (also tried ${frameName}.png)`);
            return null;
        }
        
        return spriteFrame;
    }

    /**
     * 格式化帧索引为两位数字符串
     * @param index 索引
     * @returns 格式化后的字符串
     */
    private formatFrameIndex(index: number): string {
        return index < 10 ? `0${index}` : `${index}`;
    }

    /**
     * 创建动画帧序列
     * @param atlas 精灵图集
     * @param framePrefix 帧前缀
     * @param frameCount 帧数量
     * @param frameRate 帧率
     * @returns 动画帧数据数组
     */
    public createAnimationFrames(atlas: SpriteAtlas, framePrefix: string, frameCount: number, frameRate: number): AnimationFrameData[] {
        const frames: AnimationFrameData[] = [];
        const frameDuration = 1 / frameRate;

        for (let i = 0; i < frameCount; i++) {
            const frameIndex = this.formatFrameIndex(i);
            const frameName = `${framePrefix}${frameIndex}`;
            
            const spriteFrame = this.getSpriteFrame(atlas, frameName);
            if (spriteFrame) {
                frames.push({
                    name: frameName,
                    spriteFrame: spriteFrame,
                    duration: frameDuration
                });
            } else {
                console.warn(`Frame not found: ${frameName}, skipping...`);
            }
        }

        return frames;
    }

    /**
     * 创建动画剪辑
     * @param animationName 动画名称
     * @param frames 动画帧数组
     * @param loop 是否循环
     * @returns AnimationClip
     */
    public createAnimationClip(animationName: string, frames: AnimationFrameData[], loop: boolean): AnimationClip {
        // 使用动画名称本身作为缓存键，因为它现在是唯一的
        const cacheKey = animationName;
        
        // 检查缓存
        if (this.animationClipCache.has(cacheKey)) {
            return this.animationClipCache.get(cacheKey)!;
        }

        const clip = new AnimationClip();
        clip.name = animationName;
        clip.duration = frames.reduce((total, frame) => total + frame.duration, 0);
        clip.wrapMode = loop ? AnimationClip.WrapMode.Loop : AnimationClip.WrapMode.Normal;

        // 创建关键帧数据
        const spriteFrames: SpriteFrame[] = [];
        const times: number[] = [];
        let currentTime = 0;
        
        for (const frame of frames) {
            times.push(currentTime);
            spriteFrames.push(frame.spriteFrame);
            currentTime += frame.duration;
        }

        // 使用 v3.3+ 的新 Track 系统创建对象轨道
        try {
            // 创建对象轨道用于 SpriteFrame 动画
            const track = new animation.ObjectTrack();
            
            // 设置轨道路径：指向 Sprite 组件的 spriteFrame 属性
            track.path = new animation.TrackPath()
                .toComponent(js.getClassName(Sprite))
                .toProperty('spriteFrame');
            
            // 创建轨道通道
            const [channel] = track.channels();
            
            // 创建关键帧数据
            const keyframes: [number, SpriteFrame][] = spriteFrames.map((frame, index) => [
                times[index], // 使用正确的时间值
                frame // 直接使用 spriteFrame 对象
            ]);
            
            // 设置曲线数据
            channel.curve.assignSorted(keyframes);
            
            // 添加轨道到剪辑
            clip.addTrack(track);
            
        } catch (error) {
            console.error('Failed to create animation track:', error);
            throw error;
        }
        
        // 缓存剪辑
        this.animationClipCache.set(cacheKey, clip);
        
        return clip;
    }

    /**
     * 根据敌人数据创建所有动画剪辑
     * @param enemyData 敌人数据
     * @returns Promise<Map<string, AnimationClip>>
     */
    public async createAllAnimationClips(enemyData: EnemyData): Promise<Map<string, AnimationClip>> {
        const clips = new Map<string, AnimationClip>();
        
        try {
            // 获取动画配置
            console.log(`AnimationManager: 查找动画配置，前缀: ${enemyData.assetNamePrefix}`);
            const animationConfig = getAnimationConfigByPrefix(enemyData.assetNamePrefix);
            if (!animationConfig) {
                console.error(`Animation config not found for prefix: ${enemyData.assetNamePrefix}`);
                console.log(`Available prefixes:`, Object.keys(animationConfigDatabase));
                return clips;
            }
            
            console.log(`AnimationManager: 找到动画配置`, {
                plistUrl: animationConfig.plistUrl,
                assetNamePrefix: animationConfig.assetNamePrefix
            });
            
            // 加载精灵图集
            const atlas = await this.loadSpriteAtlas(animationConfig.plistUrl);
            
            // 遍历所有动画状态
            for (const stateName in animationConfig.animations) {
                const stateConfig = animationConfig.animations[stateName as AnimationState];
                if (!stateConfig) continue;
                
                // 遍历所有方向
                for (const directionName in stateConfig) {
                    const directionConfig = stateConfig[directionName as AnimationDirection];
                    if (!directionConfig) continue;
                    
                    // 创建动画帧
                    const frames = this.createAnimationFrames(
                        atlas,
                        directionConfig.framePrefix,
                        directionConfig.frameCount,
                        directionConfig.frameRate
                    );
                    
                    if (frames.length > 0) {
                        // 创建动画剪辑，名称中包含前缀
                        const animationName = `${enemyData.assetNamePrefix}_${stateName}_${directionName}`;
                        const clip = this.createAnimationClip(
                            animationName, 
                            frames, 
                            directionConfig.loop
                        );
                        clips.set(animationName, clip);
                    }
                }
            }
            
            return clips;
            
        } catch (error) {
            console.error('Failed to create animation clips:', error);
            throw error;
        }
    }

    /**
     * 为节点设置动画组件
     * @param node 目标节点
     * @param clips 动画剪辑集合
     * @returns Animation
     */
    public setupAnimationComponent(node: Node, clips: Map<string, AnimationClip>): Animation {
        let animationComponent = node.getComponent(Animation);
        
        if (!animationComponent) {
            animationComponent = node.addComponent(Animation);
            console.log(`[AnimationManager] 创建新的Animation组件`);
        } else {
            console.log(`[AnimationManager] 找到现有的Animation组件，当前clips数量: ${animationComponent.clips.length}`);
            // 清空现有的clips，避免重复
            animationComponent.clips = [];
            console.log(`[AnimationManager] 清空现有clips，准备添加新的clips`);
        }
        
        // 添加新剪辑
        clips.forEach((clip, name) => {
            animationComponent.addClip(clip);
            console.log(`[AnimationManager] 添加clip: ${name}`);
        });

        console.log(`[AnimationManager] Animation component setup complete with ${clips.size} clips`);
        console.log(`[AnimationManager] 最终Animation组件中的clips数量: ${animationComponent.clips.length}`);
        return animationComponent;
    }

    /**
     * 播放动画
     * @param animationComponent 动画组件
     * @param animationName 要播放的动画的完整名称
     * @returns boolean 是否成功播放
     */
    public playAnimation(animationComponent: Animation, animationName: string): boolean {
        const hasClip = animationComponent.clips.some(c => c && c.name === animationName);
        
        if (!hasClip) {
            console.warn(`Animation not found: ${animationName}`);
            return false;
        }

        // 检查 Sprite 组件是否存在
        const spriteComponent = animationComponent.node.getComponent(Sprite);
        if (!spriteComponent) {
            console.error(`Sprite component not found on node: ${animationComponent.node.name}`);
            return false;
        }

        // 停止当前动画
        if (animationComponent.isValid) {
            animationComponent.stop();
        }
        
        // 播放新动画
        animationComponent.play(animationName);
        
        return true;
    }

    /**
     * 播放攻击动画并在指定帧触发回调
     * @param animationComponent 动画组件
     * @param animationName 动画名称
     * @param damageFrame 伤害触发帧（从1开始）
     * @param animationSpeed 动画速度（帧/秒）
     * @param onDamageFrame 伤害帧回调函数
     * @param onComplete 动画完成回调函数（可选）
     * @returns boolean 是否成功播放
     */
    public playAttackAnimation(
        animationComponent: Animation, 
        animationName: string, 
        damageFrame: number, 
        animationSpeed: number,
        onDamageFrame: () => void,
        onComplete?: () => void
    ): boolean {
        // 先播放动画
        const success = this.playAnimation(animationComponent, animationName);
        if (!success) {
            return false;
        }

        // 计算伤害帧触发时间（秒）
        const damageFrameTime = (damageFrame - 1) / animationSpeed; // 减1因为帧从0开始计算

        // 设置伤害帧定时器
        animationComponent.unschedule(onDamageFrame); // 清除之前的定时器
        animationComponent.scheduleOnce(() => {
            onDamageFrame();
        }, damageFrameTime);

        // 设置动画完成回调（如果提供）
        if (onComplete) {
            // 清除之前的监听器
            animationComponent.off(Animation.EventType.FINISHED);
            animationComponent.once(Animation.EventType.FINISHED, onComplete);
        }

        return true;
    }

    /**
     * 停止动画
     * @param animationComponent 动画组件
     */
    public stopAnimation(animationComponent: Animation): void {
        if (animationComponent && animationComponent.isValid) {
            animationComponent.stop();
        }
    }

    /**
     * 暂停动画
     * @param animationComponent 动画组件
     */
    public pauseAnimation(animationComponent: Animation): void {
        if (animationComponent && animationComponent.isValid) {
            animationComponent.pause();
        }
    }

    /**
     * 恢复动画
     * @param animationComponent 动画组件
     */
    public resumeAnimation(animationComponent: Animation): void {
        if (animationComponent && animationComponent.isValid) {
            animationComponent.resume();
        }
    }

    /**
     * 获取当前播放的动画状态
     * @param animationComponent 动画组件
     * @returns 动画状态信息
     */
    public getCurrentAnimationState(animationComponent: Animation): {state: AnimationState | null, direction: AnimationDirection | null} {
        const currentAnimationState = animationComponent.getState(animationComponent.clips[0]?.name || '');
        if (!currentAnimationState || !currentAnimationState.isPlaying) {
            return { state: null, direction: null };
        }

        const currentClipName = currentAnimationState.clip?.name;
        if (!currentClipName) {
            return { state: null, direction: null };
        }

        const parts = currentClipName.split('_');
        if (parts.length >= 2) {
            const state = parts[0] as AnimationState;
            const direction = parts[1] as AnimationDirection;
            return { state, direction };
        }

        return { state: null, direction: null };
    }

    /**
     * 清理缓存
     */
    public clearCache(): void {
        this.spriteAtlasCache.clear();
        this.animationClipCache.clear();
        this.levelAnimationCache.clear();
        console.log('Animation cache cleared');
    }

    /**
     * 为关卡创建动画缓存
     * @param levelId 关卡ID
     * @param enemyTypes 敌人类型数组
     */
    public async createLevelAnimationCache(levelId: number, enemyTypes: string[]): Promise<void> {
        console.log(`AnimationManager: Creating level cache for level ${levelId} with enemies: ${enemyTypes.join(', ')}`);
        
        // 创建关卡缓存容器
        const levelCache = new Map<string, Map<string, AnimationClip>>();
        
        // 为每种敌人类型创建动画缓存
        for (const enemyType of enemyTypes) {
            const enemyData = this.getEnemyDataByType(enemyType);
            if (!enemyData) {
                console.warn(`AnimationManager: Enemy data not found for type: ${enemyType}`);
                continue;
            }
            
            try {
                // 创建动画剪辑
                const animationClips = await this.createAllAnimationClips(enemyData);
                levelCache.set(enemyType, animationClips);
                
                console.log(`AnimationManager: Created ${animationClips.size} animations for ${enemyType}`);
            } catch (error) {
                console.error(`AnimationManager: Failed to create animations for ${enemyType}`, error);
            }
        }
        
        // 存储到关卡缓存
        this.levelAnimationCache.set(levelId, levelCache);
        
        console.log(`AnimationManager: Level ${levelId} animation cache created successfully`);
    }

    /**
     * 从关卡缓存获取动画剪辑
     * @param levelId 关卡ID
     * @param enemyType 敌人类型
     * @returns 动画剪辑映射
     */
    public getLevelAnimationClips(levelId: number, enemyType: string): Map<string, AnimationClip> | null {
        const levelCache = this.levelAnimationCache.get(levelId);
        if (!levelCache) {
            console.warn(`AnimationManager: Level cache not found for level ${levelId}`);
            return null;
        }
        
        const enemyAnimations = levelCache.get(enemyType);
        if (!enemyAnimations) {
            console.warn(`AnimationManager: Animations not found for enemy type ${enemyType} in level ${levelId}`);
            return null;
        }
        
        return enemyAnimations;
    }

    /**
     * 清理指定关卡的动画缓存
     * @param levelId 关卡ID
     */
    public clearLevelAnimationCache(levelId: number): void {
        const levelCache = this.levelAnimationCache.get(levelId);
        if (levelCache) {
            // 清理每个敌人类型的动画缓存
            levelCache.forEach((animationClips, enemyType) => {
                console.log(`AnimationManager: Clearing animations for ${enemyType} in level ${levelId}`);
                animationClips.clear();
            });
            levelCache.clear();
            
            // 从关卡缓存中移除
            this.levelAnimationCache.delete(levelId);
            
            console.log(`AnimationManager: Level ${levelId} animation cache cleared`);
        }
    }

    /**
     * 获取敌人数据（临时方法，应该从 DataManager 获取）
     * @param enemyType 敌人类型
     * @returns 敌人数据
     */
    private getEnemyDataByType(enemyType: string): EnemyData | null {
        return dataManager.getEnemyData(enemyType);
    }

    /**
     * 获取关卡缓存状态信息
     * @param levelId 关卡ID
     * @returns 缓存状态信息
     */
    public getLevelCacheInfo(levelId: number): string {
        const levelCache = this.levelAnimationCache.get(levelId);
        if (!levelCache) {
            return `Level ${levelId}: No cache`;
        }
        
        let info = `Level ${levelId} cache:\n`;
        levelCache.forEach((animationClips, enemyType) => {
            info += `  ${enemyType}: ${animationClips.size} animations\n`;
        });
        
        return info;
    }

    // ============= 投射物动画管理 =============

    /**
     * 创建投射物动画帧序列（支持指定起始帧索引）
     * @param atlas 精灵图集
     * @param framePrefix 帧前缀
     * @param startFrame 起始帧索引
     * @param frameCount 帧数量
     * @param frameRate 帧率
     * @returns 动画帧数据数组
     */
    private createProjectileAnimationFrames(
        atlas: SpriteAtlas, 
        framePrefix: string, 
        startFrame: number,
        frameCount: number, 
        frameRate: number
    ): AnimationFrameData[] {
        const frames: AnimationFrameData[] = [];
        const frameDuration = 1 / frameRate;

        for (let i = 0; i < frameCount; i++) {
            const frameIndex = this.formatFrameIndex(startFrame + i);
            const frameName = `${framePrefix}${frameIndex}`;
            
            const spriteFrame = this.getSpriteFrame(atlas, frameName);
            if (spriteFrame) {
                frames.push({
                    name: frameName,
                    spriteFrame: spriteFrame,
                    duration: frameDuration
                });
            } else {
                console.warn(`Projectile frame not found: ${frameName}, skipping...`);
            }
        }

        return frames;
    }

    /**
     * 根据投射物配置创建所有动画剪辑
     * @param projectileId 投射物ID
     * @returns Promise<Map<string, AnimationClip>>
     */
    public async createProjectileAnimationClips(projectileId: string): Promise<Map<string, AnimationClip>> {
        const clips = new Map<string, AnimationClip>();
        
        try {
            // 获取投射物动画配置
            const config = getProjectileAnimationConfig(projectileId);
            if (!config) {
                console.error(`AnimationManager: 投射物动画配置未找到: ${projectileId}`);
                return clips;
            }
            
            console.log(`AnimationManager: 创建投射物动画 ${projectileId}`, config);
            
            // 加载精灵图集
            const atlas = await this.loadSpriteAtlas(config.plistUrl);
            
            // 遍历所有投射物动画状态
            for (const stateName in config.animations) {
                const stateConfig = config.animations[stateName as ProjectileAnimationState];
                if (!stateConfig) continue;
                
                let frames: AnimationFrameData[] = [];
                
                // 根据投射物状态计算起始帧
                if (stateName === ProjectileAnimationState.SPAWN) {
                    // 生成动画：只有第0帧
                    frames = this.createProjectileAnimationFrames(
                        atlas,
                        stateConfig.framePrefix,
                        0, // 起始帧为0
                        stateConfig.frameCount,
                        stateConfig.frameRate
                    );
                } else if (stateName === ProjectileAnimationState.FLYING) {
                    // 飞行动画：第1-3帧
                    frames = this.createProjectileAnimationFrames(
                        atlas,
                        stateConfig.framePrefix,
                        1, // 起始帧为1
                        stateConfig.frameCount,
                        stateConfig.frameRate
                    );
                } else if (stateName === ProjectileAnimationState.EXPLODING) {
                    // 爆炸动画：第4-7帧
                    frames = this.createProjectileAnimationFrames(
                        atlas,
                        stateConfig.framePrefix,
                        4, // 起始帧为4
                        stateConfig.frameCount,
                        stateConfig.frameRate
                    );
                }
                
                if (frames.length > 0) {
                    // 创建动画剪辑
                    const animationName = `${config.assetNamePrefix}_${stateName}`;
                    const clip = this.createAnimationClip(
                        animationName, 
                        frames, 
                        stateConfig.loop
                    );
                    clips.set(animationName, clip);
                    console.log(`AnimationManager: 创建投射物动画剪辑 ${animationName}，帧数: ${frames.length}`);
                }
            }
            
            return clips;
            
        } catch (error) {
            console.error(`AnimationManager: 创建投射物动画失败 ${projectileId}`, error);
            throw error;
        }
    }

    /**
     * 播放投射物动画
     * @param animationComponent 动画组件
     * @param projectileId 投射物ID
     * @param state 投射物动画状态
     * @returns boolean 是否成功播放
     */
    public playProjectileAnimation(
        animationComponent: Animation, 
        projectileId: string, 
        state: ProjectileAnimationState
    ): boolean {
        const animationName = `${projectileId}_${state}`;
        return this.playAnimation(animationComponent, animationName);
    }

}

export const animationManager = AnimationManager.instance; 