import { Vec2, Vec3 } from 'cc';

/**
 * 临时变量池
 * 用于避免频繁创建和销毁 Vec2、Vec3 对象，提高性能
 */
export class TempVarPool {
    // Vec2 临时变量池
    public static readonly tempVec2_1 = new Vec2();
    public static readonly tempVec2_2 = new Vec2();
    public static readonly tempVec2_3 = new Vec2();
    
    // Vec3 临时变量池
    public static readonly tempVec3_1 = new Vec3();
    public static readonly tempVec3_2 = new Vec3();
    public static readonly tempVec3_3 = new Vec3();
    
    /**
     * 重置所有临时变量为零向量（调试用）
     */
    public static resetAll(): void {
        this.tempVec2_1.set(0, 0);
        this.tempVec2_2.set(0, 0);
        this.tempVec2_3.set(0, 0);
        this.tempVec3_1.set(0, 0, 0);
        this.tempVec3_2.set(0, 0, 0);
        this.tempVec3_3.set(0, 0, 0);
    }
} 