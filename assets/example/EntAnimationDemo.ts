/**
 * 小树精角色动画演示 - 基于BaseCharacterDemo
 * 
 * 🎮 控制说明：
 * - WSAD: 移动控制
 * - J: 攻击
 * - 攻击时无法移动
 * 
 * 🔧 从敌人配置读取小树精数据，继承BaseCharacterDemo的所有功能，支持对象池管理
 */

import { _decorator } from 'cc';
import { BaseCharacterDemo } from '../scripts/animation/BaseCharacterDemo';

const { ccclass, property } = _decorator;

@ccclass('EntAnimationDemo')
export class EntAnimationDemo extends BaseCharacterDemo {

    /**
     * 获取敌人配置ID - 小树精
     */
    protected getEnemyConfigId(): string {
        return 'ent_normal';
    }

         /**
      * 获取角色显示名称
      */
     protected getCharacterDisplayName(): string {
         return 'EntAnimationDemo';
     }
}