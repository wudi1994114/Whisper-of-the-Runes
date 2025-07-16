// assets/scripts/core/EventManager.ts

import { _decorator } from 'cc';

type EventCallback = (...args: any[]) => void;

class EventManager {
    private static instance: EventManager;
    private eventMap: Map<string, EventCallback[]> = new Map();

    public static getInstance(): EventManager {
        if (!EventManager.instance) {
            EventManager.instance = new EventManager();
        }
        return EventManager.instance;
    }

    /**
     * 注册事件
     * @param eventName 事件名称
     * @param callback 回调函数
     */
    public on(eventName: string, callback: EventCallback) {
        if (!this.eventMap.has(eventName)) {
            this.eventMap.set(eventName, []);
        }
        this.eventMap.get(eventName)!.push(callback);
    }

    /**
     * 注销事件
     * @param eventName 事件名称
     * @param callback 回调函数
     */
    public off(eventName: string, callback: EventCallback) {
        if (this.eventMap.has(eventName)) {
            const callbacks = this.eventMap.get(eventName)!;
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    /**
     * 派发事件
     * @param eventName 事件名称
     * @param args 参数
     */
    public emit(eventName: string, ...args: any[]) {
        if (this.eventMap.has(eventName)) {
            const callbacks = this.eventMap.get(eventName)!;
            callbacks.forEach(callback => {
                callback(...args);
            });
        }
    }
}

// 导出一个全局单例，方便访问
export const eventManager = EventManager.getInstance(); 