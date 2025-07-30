import { Vec2, Vec3 } from 'cc';

/**
 * 临时变量池
 * 用于避免频繁创建和销毁 Vec2、Vec3 对象，提高性能
 * 【性能优化】扩展变量池容量，支持更多并发使用场景
 */
export class TempVarPool {
    // Vec2 临时变量池 - 扩展到8个
    public static readonly tempVec2_1 = new Vec2();
    public static readonly tempVec2_2 = new Vec2();
    public static readonly tempVec2_3 = new Vec2();
    public static readonly tempVec2_4 = new Vec2();
    public static readonly tempVec2_5 = new Vec2();
    public static readonly tempVec2_6 = new Vec2();
    public static readonly tempVec2_7 = new Vec2();
    public static readonly tempVec2_8 = new Vec2();
    
    // Vec3 临时变量池 - 扩展到8个
    public static readonly tempVec3_1 = new Vec3();
    public static readonly tempVec3_2 = new Vec3();
    public static readonly tempVec3_3 = new Vec3();
    public static readonly tempVec3_4 = new Vec3();
    public static readonly tempVec3_5 = new Vec3();
    public static readonly tempVec3_6 = new Vec3();
    public static readonly tempVec3_7 = new Vec3();
    public static readonly tempVec3_8 = new Vec3();
    
    /**
     * 重置所有临时变量为零向量（调试用）
     */
    public static resetAll(): void {
        // 重置所有Vec2变量
        this.tempVec2_1.set(0, 0);
        this.tempVec2_2.set(0, 0);
        this.tempVec2_3.set(0, 0);
        this.tempVec2_4.set(0, 0);
        this.tempVec2_5.set(0, 0);
        this.tempVec2_6.set(0, 0);
        this.tempVec2_7.set(0, 0);
        this.tempVec2_8.set(0, 0);
        
        // 重置所有Vec3变量
        this.tempVec3_1.set(0, 0, 0);
        this.tempVec3_2.set(0, 0, 0);
        this.tempVec3_3.set(0, 0, 0);
        this.tempVec3_4.set(0, 0, 0);
        this.tempVec3_5.set(0, 0, 0);
        this.tempVec3_6.set(0, 0, 0);
        this.tempVec3_7.set(0, 0, 0);
        this.tempVec3_8.set(0, 0, 0);
    }
} 