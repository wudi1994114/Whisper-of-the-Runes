import { _decorator } from 'cc';

const { ccclass } = _decorator;

/**
 * 目标选择器类型枚举
 */
export enum TargetSelectorType {
    BASIC = 'basic',        // 原始版本
    ENHANCED = 'enhanced'   // 增强版本（默认）
}

/**
 * 目标选择器配置类
 * 用于配置使用哪种类型的目标选择器
 */
@ccclass('TargetSelectorConfig')
export class TargetSelectorConfig {
    
    /**
     * 当前使用的选择器类型
     * 默认使用增强版本
     */
    public static selectorType: TargetSelectorType = TargetSelectorType.ENHANCED;
    
    /**
     * 是否启用调试日志
     */
    public static enableDebugLogs: boolean = true;
    
    /**
     * 设置选择器类型
     * @param type 选择器类型
     */
    public static setSelectorType(type: TargetSelectorType): void {
        if (this.selectorType !== type) {
            const oldType = this.selectorType;
            this.selectorType = type;
            
            if (this.enableDebugLogs) {
                console.log(`%c[TargetSelectorConfig] 🔄 选择器类型已切换: ${oldType} → ${type}`, 'color: blue; font-weight: bold');
            }
            
            // 通知工厂重新创建实例
            const TargetSelectorFactory = require('./TargetSelectorFactory').TargetSelectorFactory;
            if (TargetSelectorFactory && TargetSelectorFactory.resetInstance) {
                TargetSelectorFactory.resetInstance();
            }
        }
    }
    
    /**
     * 获取当前选择器类型
     */
    public static getSelectorType(): TargetSelectorType {
        return this.selectorType;
    }
    
    /**
     * 检查是否使用增强版选择器
     */
    public static isEnhancedMode(): boolean {
        return this.selectorType === TargetSelectorType.ENHANCED;
    }
    
    /**
     * 检查是否使用基础版选择器
     */
    public static isBasicMode(): boolean {
        return this.selectorType === TargetSelectorType.BASIC;
    }
    
    /**
     * 设置调试日志状态
     * @param enabled 是否启用调试日志
     */
    public static setDebugLogs(enabled: boolean): void {
        this.enableDebugLogs = enabled;
        
        if (enabled) {
            console.log(`%c[TargetSelectorConfig] 🐛 调试日志已启用`, 'color: green');
        }
    }
} 