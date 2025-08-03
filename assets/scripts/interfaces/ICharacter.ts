// assets/scripts/interfaces/ICharacter.ts

import { IMovable } from './IMovable';
import { ICombat } from './ICombat';
import { IAnimatable } from './IAnimatable';
import { ILifecycle } from './ILifecycle';
import { IControllable } from './IControllable';
import { IFactional } from './IFactional';
import { IConfigurable } from './IConfigurable';
import { IRenderable } from './IRenderable';

/**
 * 角色接口 - 组合所有角色相关的功能接口
 * 采用接口分离原则，每个接口负责单一职责
 */
export interface ICharacter extends 
    IMovable,
    ICombat, 
    IAnimatable,
    ILifecycle,
    IControllable,
    IFactional,
    IConfigurable,
    IRenderable {
    
    /**
     * 角色的唯一标识
     */
    readonly id: string;
    
    /**
     * 角色名称
     */
    readonly name: string;
}

/**
 * 角色工厂接口
 */
export interface ICharacterFactory {
    /**
     * 创建角色
     * @param characterType 角色类型
     * @param options 创建选项
     */
    createCharacter(characterType: string, options?: any): Promise<ICharacter | null> | ICharacter | null;
    
    /**
     * 回收角色
     * @param character 角色实例
     */
    recycleCharacter(character: ICharacter): void;
    
    /**
     * 按类型回收所有角色
     * @param characterType 角色类型
     */
    recycleAllByType(characterType: string): void;
    
    /**
     * 获取活跃角色数量
     */
    getActiveCharacterCount(): number;
}

/**
 * 角色管理器接口
 */
export interface ICharacterManager {
    /**
     * 注册角色
     * @param character 角色实例
     */
    registerCharacter(character: ICharacter): void;
    
    /**
     * 注销角色
     * @param character 角色实例
     */
    unregisterCharacter(character: ICharacter): void;
    
    /**
     * 获取所有活跃角色
     */
    getAllActiveCharacters(): ICharacter[];
    
    /**
     * 按阵营获取角色
     * @param faction 阵营
     */
    getCharactersByFaction(faction: string): ICharacter[];
    
    /**
     * 按类型获取角色
     * @param characterType 角色类型
     */
    getCharactersByType(characterType: string): ICharacter[];
    
    /**
     * 更新所有角色
     * @param deltaTime 帧时间间隔
     */
    updateAllCharacters(deltaTime: number): void;
    
    /**
     * 清理所有角色
     */
    cleanup(): void;
}