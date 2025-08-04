// assets/scripts/controllers/EnhancedProjectileSystem.ts

import { _decorator, Component, Node, Vec3 } from 'cc';
import { gridSystem, EntityType, QueryOptions } from '../systems/GridSystem';
import { Faction } from '../configs/FactionConfig';
import { factionManager } from '../managers/FactionManager';

const { ccclass } = _decorator;

/**
 * 投射物预测结果
 */
export interface ProjectilePrediction {
    willHit: boolean;
    hitTarget?: Node;
    hitPosition?: Vec3;
    timeToHit?: number;
    interceptAngle?: number;
}

/**
 * 弹道计算参数
 */
export interface TrajectoryParams {
    startPos: Vec3;
    targetPos: Vec3;
    projectileSpeed: number;
    targetVelocity?: Vec3;
    gravity?: number;
    leadTime?: number;
}

/**
 * 增强投射物系统
 * 基于网格系统提供高效的弹道预测和碰撞检测
 */
@ccclass('EnhancedProjectileSystem')
export class EnhancedProjectileSystem extends Component {
    private static instance: EnhancedProjectileSystem | null = null;
    
    // 预测参数
    private readonly PREDICTION_STEP = 16;      // 预测步长（像素）
    private readonly MAX_PREDICTION_TIME = 5.0;  // 最大预测时间（秒）
    private readonly COLLISION_RADIUS = 8;       // 碰撞半径（像素）
    
    public static getInstance(): EnhancedProjectileSystem {
        if (!EnhancedProjectileSystem.instance) {
            const node = new Node('EnhancedProjectileSystem');
            EnhancedProjectileSystem.instance = node.addComponent(EnhancedProjectileSystem);
        }
        return EnhancedProjectileSystem.instance;
    }
    
    /**
     * 预测投射物轨迹和碰撞
     * @param params 弹道参数
     * @param shooterFaction 发射者阵营
     * @returns 预测结果
     */
    public predictTrajectory(params: TrajectoryParams, shooterFaction: Faction): ProjectilePrediction {
        const { startPos, targetPos, projectileSpeed, targetVelocity, gravity = 0 } = params;
        
        // 计算基础方向
        const direction = new Vec3();
        Vec3.subtract(direction, targetPos, startPos);
        
        // 如果目标有速度，计算预判位置
        let adjustedTargetPos = targetPos.clone();
        if (targetVelocity && targetVelocity.length() > 0) {
            const timeToTarget = direction.length() / projectileSpeed;
            const prediction = new Vec3();
            Vec3.multiplyScalar(prediction, targetVelocity, timeToTarget);
            Vec3.add(adjustedTargetPos, targetPos, prediction);
            
            // 重新计算方向
            Vec3.subtract(direction, adjustedTargetPos, startPos);
        }
        
        direction.normalize();
        
        // 使用网格系统预测碰撞路径
        const result = this.predictCollisionPath(
            startPos,
            direction,
            projectileSpeed,
            shooterFaction,
            gravity
        );
        
        return result;
    }
    
    /**
     * 计算拦截角度
     * @param shooterPos 发射者位置
     * @param targetPos 目标位置
     * @param targetVelocity 目标速度
     * @param projectileSpeed 投射物速度
     * @returns 拦截角度和位置
     */
    public calculateInterceptAngle(
        shooterPos: Vec3,
        targetPos: Vec3,
        targetVelocity: Vec3,
        projectileSpeed: number
    ): { angle: number, interceptPos: Vec3 } | null {
        
        const relativePos = new Vec3();
        Vec3.subtract(relativePos, targetPos, shooterPos);
        
        const a = targetVelocity.lengthSqr() - projectileSpeed * projectileSpeed;
        const b = 2 * Vec3.dot(relativePos, targetVelocity);
        const c = relativePos.lengthSqr();
        
        const discriminant = b * b - 4 * a * c;
        
        if (discriminant < 0) {
            return null; // 无法拦截
        }
        
        const t1 = (-b + Math.sqrt(discriminant)) / (2 * a);
        const t2 = (-b - Math.sqrt(discriminant)) / (2 * a);
        
        const t = Math.min(t1 > 0 ? t1 : Infinity, t2 > 0 ? t2 : Infinity);
        
        if (t === Infinity) {
            return null;
        }
        
        // 计算拦截位置
        const interceptPos = new Vec3();
        Vec3.multiplyScalar(interceptPos, targetVelocity, t);
        Vec3.add(interceptPos, targetPos, interceptPos);
        
        // 计算角度
        const direction = new Vec3();
        Vec3.subtract(direction, interceptPos, shooterPos);
        const angle = Math.atan2(direction.y, direction.x);
        
        return { angle, interceptPos };
    }
    
    /**
     * 查找最佳攻击目标
     * @param shooterPos 发射者位置
     * @param shooterFaction 发射者阵营
     * @param maxRange 最大射程
     * @param projectileSpeed 投射物速度
     * @returns 最佳目标和预测信息
     */
    public findBestTarget(
        shooterPos: Vec3,
        shooterFaction: Faction,
        maxRange: number,
        projectileSpeed: number
    ): { target: Node, prediction: ProjectilePrediction } | null {
        
        // 获取敌对阵营
        const enemyFactions = this.getEnemyFactions(shooterFaction);
        
        const queryOptions: QueryOptions = {
            factions: enemyFactions,
            entityTypes: [EntityType.CHARACTER],
            onlyAlive: true
        };
        
        // 查找范围内的所有敌人
        const targets = gridSystem.findEntitiesInRange(shooterPos, maxRange, queryOptions);
        
        let bestTarget: Node | null = null;
        let bestScore = -1;
        let bestPrediction: ProjectilePrediction | null = null;
        
        for (const targetResult of targets) {
            const target = targetResult.entity.node;
            const targetPos = target.getWorldPosition();
            
            // 获取目标移动组件来预测移动
            const movementComponent = target.getComponent('MovementComponent');
            let targetVelocity = new Vec3(0, 0, 0);
            
            if (movementComponent && (movementComponent as any).getMoveDirection) {
                const moveDir = (movementComponent as any).getMoveDirection();
                const moveSpeed = (movementComponent as any).getMoveSpeed();
                targetVelocity = new Vec3(moveDir.x * moveSpeed, moveDir.y * moveSpeed, 0);
            }
            
            // 预测弹道
            const prediction = this.predictTrajectory({
                startPos: shooterPos,
                targetPos: targetPos,
                projectileSpeed: projectileSpeed,
                targetVelocity: targetVelocity
            }, shooterFaction);
            
            if (prediction.willHit) {
                // 计算目标优先级分数
                const distance = targetResult.distance;
                const healthRatio = this.getTargetHealthRatio(target);
                const threatLevel = this.getTargetThreatLevel(target);
                
                // 综合评分：距离近、血量少、威胁高的目标优先
                const score = (1 / (distance + 1)) * (1 - healthRatio) * threatLevel;
                
                if (score > bestScore) {
                    bestScore = score;
                    bestTarget = target;
                    bestPrediction = prediction;
                }
            }
        }
        
        if (bestTarget && bestPrediction) {
            return { target: bestTarget, prediction: bestPrediction };
        }
        
        return null;
    }
    
    /**
     * 检查投射物路径是否被阻挡
     * @param startPos 起始位置
     * @param endPos 结束位置
     * @param shooterFaction 发射者阵营
     * @returns 是否被阻挡
     */
    public isPathBlocked(startPos: Vec3, endPos: Vec3, shooterFaction: Faction): boolean {
        const direction = new Vec3();
        Vec3.subtract(direction, endPos, startPos);
        const distance = direction.length();
        direction.normalize();
        
        // 检查路径上是否有障碍物
        const step = this.PREDICTION_STEP;
        const steps = Math.ceil(distance / step);
        
        for (let i = 1; i < steps; i++) {
            const checkPos = new Vec3();
            Vec3.multiplyScalar(checkPos, direction, step * i);
            Vec3.add(checkPos, startPos, checkPos);
            
            // 查找该位置的实体
            const obstacles = gridSystem.findEntitiesInRange(checkPos, this.COLLISION_RADIUS, {
                entityTypes: [EntityType.OBSTACLE],
                maxDistance: this.COLLISION_RADIUS
            });
            
            if (obstacles.length > 0) {
                return true; // 路径被阻挡
            }
        }
        
        return false;
    }
    
    // =================== 私有方法 ===================
    
    /**
     * 预测碰撞路径
     */
    private predictCollisionPath(
        startPos: Vec3,
        direction: Vec3,
        speed: number,
        shooterFaction: Faction,
        gravity: number
    ): ProjectilePrediction {
        
        const result = gridSystem.predictCollisionAlongPath(startPos, direction, speed * this.MAX_PREDICTION_TIME, {
            factions: this.getEnemyFactions(shooterFaction),
            entityTypes: [EntityType.CHARACTER, EntityType.OBSTACLE],
            onlyAlive: true
        });
        
        if (result) {
            const timeToHit = result.distance / speed;
            return {
                willHit: true,
                hitTarget: result.entity.node,
                hitPosition: result.entity.worldPosition.clone(),
                timeToHit: timeToHit
            };
        }
        
        return { willHit: false };
    }
    
    /**
     * 获取敌对阵营列表
     */
    private getEnemyFactions(shooterFaction: Faction): Faction[] {
        const allFactions = [Faction.PLAYER, Faction.RED, Faction.BLUE, Faction.GREEN, Faction.PURPLE];
        return allFactions.filter(faction => factionManager.doesAttack(shooterFaction, faction));
    }
    
    /**
     * 获取目标血量比例
     */
    private getTargetHealthRatio(target: Node): number {
        const characterStats = target.getComponent('CharacterStats');
        if (characterStats) {
            const current = (characterStats as any).currentHealth || 100;
            const max = (characterStats as any).maxHealth || 100;
            return current / max;
        }
        return 1.0;
    }
    
    /**
     * 获取目标威胁等级
     */
    private getTargetThreatLevel(target: Node): number {
        const characterStats = target.getComponent('CharacterStats');
        if (characterStats) {
            const attack = (characterStats as any).baseAttack || 10;
            // 攻击力越高威胁等级越高
            return Math.min(attack / 50, 2.0);
        }
        return 1.0;
    }
}

// 导出单例
export const enhancedProjectileSystem = EnhancedProjectileSystem.getInstance();