import { _decorator, find } from 'cc';
import { ITargetSelector } from '../components/MonsterAI';
import { TargetSelector } from '../components/TargetSelector';
import { EnhancedTargetSelector } from '../components/EnhancedTargetSelector';
import { TargetSelectorType, TargetSelectorConfig } from './TargetSelectorConfig';

const { ccclass } = _decorator;

/**
 * 目标选择器工厂类
 * 统一管理目标选择器的创建、获取和销毁
 * 根据配置决定使用哪种类型的选择器
 */
@ccclass('TargetSelectorFactory')
export class TargetSelectorFactory {
    
    // 单例实例
    private static _instance: ITargetSelector | null = null;
    
    // 是否已初始化
    private static _initialized: boolean = false;
    
    /**
     * 获取目标选择器实例（单例模式）
     * 根据配置自动创建对应类型的选择器
     */
    public static getInstance(): ITargetSelector | null {
        if (!this._instance) {
            this._instance = this.createSelector();
            this._initialized = true;
            
            if (TargetSelectorConfig.enableDebugLogs) {
                const selectorType = TargetSelectorConfig.getSelectorType();
                console.log(`%c[TargetSelectorFactory] ✨ 创建目标选择器实例: ${selectorType}`, 'color: purple; font-weight: bold');
            }
        }
        
        return this._instance;
    }
    
    /**
     * 强制重置实例（用于配置更改时）
     */
    public static resetInstance(): void {
        if (this._instance) {
            if (TargetSelectorConfig.enableDebugLogs) {
                console.log(`%c[TargetSelectorFactory] 🔄 重置目标选择器实例`, 'color: orange; font-weight: bold');
            }
            
            // 这里可以添加清理逻辑，比如反注册所有目标
            this._instance = null;
            this._initialized = false;
        }
    }
    
    /**
     * 根据配置创建选择器实例
     */
    private static createSelector(): ITargetSelector | null {
        const selectorType = TargetSelectorConfig.getSelectorType();
        
        switch (selectorType) {
            case TargetSelectorType.BASIC:
                return this.createBasicSelector();
                
            case TargetSelectorType.ENHANCED:
                return this.createEnhancedSelector();
                
            default:
                console.warn(`%c[TargetSelectorFactory] ⚠️ 未知的选择器类型: ${selectorType}，回退到增强版`, 'color: orange');
                return this.createEnhancedSelector();
        }
    }
    
    /**
     * 创建基础版选择器
     */
    private static createBasicSelector(): ITargetSelector | null {
        // 首先尝试获取现有实例
        let selector = TargetSelector.getInstance();
        
        if (selector) {
            if (TargetSelectorConfig.enableDebugLogs) {
                console.log(`%c[TargetSelectorFactory] 🎯 使用现有的基础目标选择器`, 'color: blue');
            }
            return selector;
        }
        
        // 如果不存在，尝试创建新实例
        try {
            const gameManagerNode = find('GameManager');
            if (gameManagerNode) {
                const component = gameManagerNode.addComponent(TargetSelector);
                if (component) {
                    if (TargetSelectorConfig.enableDebugLogs) {
                        console.log(`%c[TargetSelectorFactory] 🆕 创建了基础目标选择器`, 'color: green');
                    }
                    return component;
                }
            }
        } catch (error) {
            console.error(`%c[TargetSelectorFactory] ❌ 创建基础目标选择器失败:`, 'color: red', error);
        }
        
        console.error(`%c[TargetSelectorFactory] ❌ 无法创建基础目标选择器`, 'color: red');
        return null;
    }
    
    /**
     * 创建增强版选择器
     */
    private static createEnhancedSelector(): ITargetSelector | null {
        // 首先尝试获取现有实例
        let selector = EnhancedTargetSelector.getInstance();
        
        if (selector) {
            if (TargetSelectorConfig.enableDebugLogs) {
                console.log(`%c[TargetSelectorFactory] 🎯 使用现有的增强目标选择器`, 'color: blue');
            }
            return selector;
        }
        
        // 如果不存在，尝试创建新实例
        try {
            const gameManagerNode = find('GameManager');
            if (gameManagerNode) {
                const component = gameManagerNode.addComponent(EnhancedTargetSelector);
                if (component) {
                    if (TargetSelectorConfig.enableDebugLogs) {
                        console.log(`%c[TargetSelectorFactory] 🆕 创建了增强目标选择器`, 'color: green');
                    }
                    return component;
                }
            }
        } catch (error) {
            console.error(`%c[TargetSelectorFactory] ❌ 创建增强目标选择器失败:`, 'color: red', error);
        }
        
        console.error(`%c[TargetSelectorFactory] ❌ 无法创建增强目标选择器`, 'color: red');
        return null;
    }
    
    /**
     * 检查工厂是否已初始化
     */
    public static isInitialized(): boolean {
        return this._initialized && this._instance !== null;
    }
    
    /**
     * 获取当前选择器类型信息
     */
    public static getCurrentSelectorInfo(): { type: TargetSelectorType; initialized: boolean; instance: string } {
        return {
            type: TargetSelectorConfig.getSelectorType(),
            initialized: this._initialized,
            instance: this._instance ? this._instance.constructor.name : 'none'
        };
    }
    
    /**
     * 打印工厂状态信息（用于调试）
     */
    public static printStatus(): void {
        const info = this.getCurrentSelectorInfo();
        console.log(`%c[TargetSelectorFactory] 📊 工厂状态:`, 'color: purple; font-weight: bold');
        console.log(`%c[TargetSelectorFactory] 🔧 配置类型: ${info.type}`, 'color: cyan');
        console.log(`%c[TargetSelectorFactory] 🎯 实例类型: ${info.instance}`, 'color: cyan');
        console.log(`%c[TargetSelectorFactory] ✅ 已初始化: ${info.initialized}`, 'color: cyan');
    }
} 