// assets/scripts/core/ErrorHandler.ts

import { _decorator } from 'cc';
import { eventManager } from '../managers/EventManager';
import { GameEvents } from './GameEvents';

const { ccclass } = _decorator;

/**
 * 错误类型枚举
 */
export enum ErrorType {
    NETWORK = 'NETWORK',
    DATA_LOADING = 'DATA_LOADING',
    COMPONENT_MISSING = 'COMPONENT_MISSING',
    RESOURCE_LOADING = 'RESOURCE_LOADING',
    ANIMATION = 'ANIMATION',
    GAME_LOGIC = 'GAME_LOGIC',
    UNKNOWN = 'UNKNOWN'
}

/**
 * 错误严重级别
 */
export enum ErrorSeverity {
    LOW = 'LOW',       // 不影响游戏继续
    MEDIUM = 'MEDIUM', // 影响部分功能
    HIGH = 'HIGH',     // 严重影响游戏体验
    CRITICAL = 'CRITICAL' // 游戏无法继续
}

/**
 * 游戏错误接口
 */
export interface GameError {
    type: ErrorType;
    severity: ErrorSeverity;
    message: string;
    details?: any;
    timestamp: number;
    stack?: string;
}

/**
 * 统一错误处理器
 */
@ccclass('ErrorHandler')
export class ErrorHandler {
    private static _instance: ErrorHandler;
    private errorLog: GameError[] = [];
    private maxLogSize: number = 100;

    public static get instance(): ErrorHandler {
        if (!ErrorHandler._instance) {
            ErrorHandler._instance = new ErrorHandler();
        }
        return ErrorHandler._instance;
    }

    /**
     * 处理错误
     */
    public handleError(
        type: ErrorType,
        severity: ErrorSeverity,
        message: string,
        details?: any,
        error?: Error
    ): void {
        const gameError: GameError = {
            type,
            severity,
            message,
            details,
            timestamp: Date.now(),
            stack: error?.stack
        };

        // 记录错误
        this.logError(gameError);

        // 根据严重程度处理
        this.processError(gameError);

        // 发送错误事件
        eventManager.emit('ERROR_OCCURRED', gameError);
    }

    /**
     * 记录错误
     */
    private logError(error: GameError): void {
        this.errorLog.push(error);

        // 限制日志大小
        if (this.errorLog.length > this.maxLogSize) {
            this.errorLog.shift();
        }

        // 控制台输出
        const logMethod = this.getLogMethod(error.severity);
        logMethod(`[${error.type}] ${error.message}`, error.details);
    }

    /**
     * 处理错误
     */
    private processError(error: GameError): void {
        switch (error.severity) {
            case ErrorSeverity.LOW:
                // 低级错误，仅记录
                break;
            case ErrorSeverity.MEDIUM:
                // 中级错误，可能需要用户知晓
                this.showUserNotification(error);
                break;
            case ErrorSeverity.HIGH:
                // 高级错误，需要尝试恢复
                this.attemptRecovery(error);
                break;
            case ErrorSeverity.CRITICAL:
                // 严重错误，可能需要重启游戏
                this.handleCriticalError(error);
                break;
        }
    }

    /**
     * 获取日志方法
     */
    private getLogMethod(severity: ErrorSeverity): Function {
        switch (severity) {
            case ErrorSeverity.LOW:
                return console.log;
            case ErrorSeverity.MEDIUM:
                return console.warn;
            case ErrorSeverity.HIGH:
            case ErrorSeverity.CRITICAL:
                return console.error;
            default:
                return console.log;
        }
    }

    /**
     * 显示用户通知
     */
    private showUserNotification(error: GameError): void {
        // 这里可以显示游戏内通知
        console.warn(`用户通知: ${error.message}`);
    }

    /**
     * 尝试恢复
     */
    private attemptRecovery(error: GameError): void {
        console.warn(`尝试从错误中恢复: ${error.message}`);
        
        switch (error.type) {
            case ErrorType.DATA_LOADING:
                // 尝试重新加载数据
                this.retryDataLoading(error);
                break;
            case ErrorType.COMPONENT_MISSING:
                // 尝试重新获取组件
                this.retryComponentAccess(error);
                break;
            default:
                console.warn('无法自动恢复此类型的错误');
        }
    }

    /**
     * 处理严重错误
     */
    private handleCriticalError(error: GameError): void {
        console.error(`严重错误: ${error.message}`);
        console.error('游戏可能需要重启');
        
        // 发送严重错误事件
        eventManager.emit('CRITICAL_ERROR', error);
    }

    /**
     * 重试数据加载
     */
    private retryDataLoading(error: GameError): void {
        // 实现数据重新加载逻辑
        console.log('尝试重新加载数据...');
    }

    /**
     * 重试组件访问
     */
    private retryComponentAccess(error: GameError): void {
        // 实现组件重新获取逻辑
        console.log('尝试重新获取组件...');
    }

    /**
     * 获取错误日志
     */
    public getErrorLog(): GameError[] {
        return [...this.errorLog];
    }

    /**
     * 清除错误日志
     */
    public clearErrorLog(): void {
        this.errorLog = [];
    }

    /**
     * 获取特定类型的错误
     */
    public getErrorsByType(type: ErrorType): GameError[] {
        return this.errorLog.filter(error => error.type === type);
    }

    /**
     * 获取特定严重级别的错误
     */
    public getErrorsBySeverity(severity: ErrorSeverity): GameError[] {
        return this.errorLog.filter(error => error.severity === severity);
    }
}

/**
 * 便捷的错误处理函数
 */
export const handleError = (
    type: ErrorType,
    severity: ErrorSeverity,
    message: string,
    details?: any,
    error?: Error
): void => {
    ErrorHandler.instance.handleError(type, severity, message, details, error);
};

/**
 * 异步操作包装器
 */
export const safeAsync = async <T>(
    operation: () => Promise<T>,
    errorType: ErrorType = ErrorType.UNKNOWN,
    errorMessage: string = '异步操作失败'
): Promise<T | null> => {
    try {
        return await operation();
    } catch (error) {
        handleError(
            errorType,
            ErrorSeverity.MEDIUM,
            errorMessage,
            { operation: operation.name },
            error as Error
        );
        return null;
    }
};

// 导出单例
export const errorHandler = ErrorHandler.instance;