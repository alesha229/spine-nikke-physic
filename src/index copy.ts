// bone-physics.ts
import * as PIXI from "pixi.js";
import { PhysicsConfig, PhysicsSettings } from "./physics-config";

export class BonePhysics {
  public bone: any;
  public animationBone: any;
  public settings: PhysicsSettings;
  public velocity: PIXI.Point;

  private physicsConfig: PhysicsConfig;
  private globalSettings: any;
  private originalBoneLength: number;
  private frameCount: number = 0;
  private isInitialized: boolean = false;

  private physicsOffset: PIXI.Point;
  private lastAnimationWorldPos: PIXI.Point;
  private animationVelocity: PIXI.Point;
  private lastUpdateTime: number;

  constructor(
    bone: any,
    animationBone: any,
    settings: PhysicsSettings,
    physicsConfig: PhysicsConfig,
    globalSettings: any
  ) {
    this.bone = bone;
    this.animationBone = animationBone;
    this.settings = settings;
    this.physicsConfig = physicsConfig;
    this.globalSettings = globalSettings;

    this.velocity = new PIXI.Point(0, 0);
    this.physicsOffset = new PIXI.Point(0, 0);
    this.lastAnimationWorldPos = new PIXI.Point(
      animationBone.worldX,
      animationBone.worldY
    );
    this.animationVelocity = new PIXI.Point(0, 0);
    this.lastUpdateTime = Date.now();

    this.originalBoneLength = Math.sqrt(bone.x * bone.x + bone.y * bone.y);

    if (this.originalBoneLength < 1.0) {
      this.originalBoneLength = 1.0;
    }
  }

  private shouldApplyPhysics(): boolean {
    this.frameCount++;
    return this.frameCount > 5;
  }

  private initialize() {
    if (!this.isInitialized) {
      this.velocity.set(0, 0);
      this.physicsOffset.set(0, 0);
      this.lastAnimationWorldPos.set(
        this.animationBone.worldX,
        this.animationBone.worldY
      );
      this.animationVelocity.set(0, 0);
      this.lastUpdateTime = Date.now();
      this.isInitialized = true;
    }
  }

  // Упрощенный и эффективный метод для применения импульсов от анимации
  private applyAnimationImpulses(deltaTime: number) {
    if (this.settings.Mass <= 0 || deltaTime <= 0) return;

    const currentWorldX = this.animationBone.worldX;
    const currentWorldY = this.animationBone.worldY;

    // Вычисляем мгновенную скорость анимации
    const instantVelocityX =
      (currentWorldX - this.lastAnimationWorldPos.x) / deltaTime;
    const instantVelocityY =
      (currentWorldY - this.lastAnimationWorldPos.y) / deltaTime;

    // Увеличиваем чувствительность к изменениям анимации
    const sensitivity = 2 * this.globalSettings.physicsStrengthMultiplier;
    const massFactor = 1.0 / Math.max(0.1, this.settings.Mass);

    // Применяем импульс более агрессивно
    this.velocity.x += instantVelocityX * sensitivity * massFactor;
    this.velocity.y += instantVelocityY * sensitivity * massFactor;

    // Добавляем дополнительную силу к цели анимации
    const attractionStrength = 2;
    const targetOffsetX = this.animationBone.x - this.bone.x;
    const targetOffsetY = this.animationBone.y - this.bone.y;

    this.velocity.x += targetOffsetX * attractionStrength * massFactor;
    this.velocity.y += targetOffsetY * attractionStrength * massFactor;

    this.lastAnimationWorldPos.set(currentWorldX, currentWorldY);
  }

  public update(deltaTime: number) {
    if (deltaTime === 0) return;

    this.initialize();

    if (!this.shouldApplyPhysics()) {
      this.copyFromAnimationBone();
      return;
    }

    if (this.settings.FixPosition) {
      this.copyFromAnimationBone();
      return;
    }

    // Применяем импульсы от движения анимационной кости
    this.applyAnimationImpulses(deltaTime);

    const springForceX = -this.physicsOffset.x * this.settings.Shiftiness * 0.3;
    const springForceY = -this.physicsOffset.y * this.settings.Shiftiness * 0.3;
    const dampingForceX = -this.velocity.x;
    const dampingForceY = -this.velocity.y;

    const totalForceX =
      (springForceX + dampingForceX) *
      this.settings.ForceMultiplier *
      this.globalSettings.physicsStrengthMultiplier;
    const totalForceY =
      (springForceY + dampingForceY) *
      this.settings.ForceMultiplier *
      this.globalSettings.physicsStrengthMultiplier;

    // Применяем силы
    this.velocity.x += (totalForceX / this.settings.Mass) * deltaTime;
    this.velocity.y += (totalForceY / this.settings.Mass) * deltaTime;

    // Ограничиваем максимальную скорость
    const maxSpeed = this.globalSettings.maxSpeed;
    const speed = Math.sqrt(
      this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y
    );
    if (speed > maxSpeed) {
      this.velocity.x = (this.velocity.x / speed) * maxSpeed;
      this.velocity.y = (this.velocity.y / speed) * maxSpeed;
    }

    // Обновляем физическое смещение
    this.physicsOffset.x += this.velocity.x * deltaTime;
    this.physicsOffset.y += this.velocity.y * deltaTime;

    // Применяем ограничения
    this.applyConstraints();

    // Применяем результат к кости
    this.applyPhysicsToTargetBone();

    // Обновляем время последнего обновления
    this.lastUpdateTime = Date.now();
  }

  private copyFromAnimationBone() {
    this.bone.x = this.animationBone.x;
    this.bone.y = this.animationBone.y;
    this.bone.rotation = this.animationBone.rotation;
    this.bone.scaleX = this.animationBone.scaleX;
    this.bone.scaleY = this.animationBone.scaleY;
  }

  private applyPhysicsToTargetBone() {
    // Просто добавляем физическое смещение к позиции анимационной кости
    this.bone.x = this.animationBone.x + this.physicsOffset.x;
    this.bone.y = this.animationBone.y + this.physicsOffset.y;

    // Копируем остальные параметры
    this.bone.rotation = this.animationBone.rotation;
    this.bone.scaleX = this.animationBone.scaleX;
    this.bone.scaleY = this.animationBone.scaleY;
  }

  private applyConstraints() {
    // Ограничение на максимальное смещение
    const offsetLength = Math.sqrt(
      this.physicsOffset.x * this.physicsOffset.x +
        this.physicsOffset.y * this.physicsOffset.y
    );

    const maxOffset = this.originalBoneLength;

    if (offsetLength > maxOffset && offsetLength > 0.001) {
      const ratio = maxOffset / offsetLength;
      this.physicsOffset.x *= ratio;
      this.physicsOffset.y *= ratio;

      // Корректируем скорость
      const normalX = this.physicsOffset.x / offsetLength;
      const normalY = this.physicsOffset.y / offsetLength;
      const velocityDotNormal =
        this.velocity.x * normalX + this.velocity.y * normalY;

      if (velocityDotNormal > 0) {
        this.velocity.x -= velocityDotNormal * normalX * 0.8;
        this.velocity.y -= velocityDotNormal * normalY * 0.8;
      }
    }
  }

  public resetPhysics() {
    this.frameCount = 0;
    this.isInitialized = false;
    this.velocity.set(0, 0);
    this.physicsOffset.set(0, 0);
    this.lastAnimationWorldPos.set(
      this.animationBone.worldX,
      this.animationBone.worldY
    );
    this.animationVelocity.set(0, 0);
    this.lastUpdateTime = Date.now();
    this.copyFromAnimationBone();
  }

  public forceActivatePhysics() {
    this.frameCount = 10;
  }

  public applyTestImpulse(multiplier: number = 200) {
    const force =
      (this.physicsConfig.FireShakeMinForce +
        Math.random() *
          (this.physicsConfig.FireShakeMaxForce -
            this.physicsConfig.FireShakeMinForce)) *
      this.globalSettings.physicsStrengthMultiplier;

    const minAngle = this.physicsConfig.ForceRandomAngleMin * (Math.PI / 180);
    const maxAngle = this.physicsConfig.ForceRandomAngleMax * (Math.PI / 180);
    const angle = minAngle + Math.random() * (maxAngle - minAngle);

    this.velocity.x += Math.cos(angle) * force * multiplier;
    this.velocity.y += Math.sin(angle) * force * multiplier;
  }

  public get isPhysicsActive(): boolean {
    return this.shouldApplyPhysics();
  }

  public getDebugInfo(): any {
    const currentWorldX = this.animationBone.worldX;
    const currentWorldY = this.animationBone.worldY;
    const deltaX = currentWorldX - this.lastAnimationWorldPos.x;
    const deltaY = currentWorldY - this.lastAnimationWorldPos.y;

    return {
      boneName: this.bone.data?.name || "unknown",
      isPhysicsActive: this.isPhysicsActive,
      physicsOffset: { x: this.physicsOffset.x, y: this.physicsOffset.y },
      velocity: { x: this.velocity.x, y: this.velocity.y },
      animationWorldPos: { x: currentWorldX, y: currentWorldY },
      animationDelta: { x: deltaX, y: deltaY },
    };
  }
}
