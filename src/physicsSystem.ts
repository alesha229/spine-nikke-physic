// physics-system.ts - Альтернативный подход
import * as PIXI from "pixi.js";
import { PhysicsConfig, PhysicsSettings } from "./physics-config";

export class PhysicsSystem {
  private physicsBones: PhysicsBone[] = [];
  private physicsContainer: PIXI.Container;
  private boneGraphics: Map<any, PIXI.Graphics> = new Map();

  constructor(private spine: any, private app: PIXI.Application) {
    this.physicsContainer = new PIXI.Container();
    this.app.stage.addChild(this.physicsContainer);
  }

  initializePhysics(physicsConfig: PhysicsConfig, globalSettings: any) {
    this.physicsBones = [];
    const boneSettingsCollection =
      physicsConfig.BoneSpringPhysicsSettingCollection;

    for (const boneName in boneSettingsCollection) {
      if (boneSettingsCollection.hasOwnProperty(boneName)) {
        const boneSettings = boneSettingsCollection[boneName];
        const bone = this.spine.skeleton.findBone(boneName);

        if (bone) {
          console.log(`Добавлена физика для кости: ${boneName}`);

          // Создаем графический объект для визуализации кости
          const graphic = new PIXI.Graphics();
          this.physicsContainer.addChild(graphic);
          this.boneGraphics.set(bone, graphic);

          this.physicsBones.push(
            new PhysicsBone(bone, boneSettings, physicsConfig, globalSettings)
          );
        }
      }
    }
  }

  update(deltaTime: number, holderPosition: PIXI.Point) {
    // Обновляем физику для каждой кости
    for (const physicsBone of this.physicsBones) {
      physicsBone.update(deltaTime, holderPosition);

      // Визуализируем кость
      const graphic = this.boneGraphics.get(physicsBone.bone);
      if (graphic) {
        this.drawBone(graphic, physicsBone);
      }
    }
  }

  private drawBone(graphic: PIXI.Graphics, physicsBone: PhysicsBone) {
    graphic.clear();

    // Рисуем линию, представляющую кость
    graphic.lineStyle(2, 0xff0000, 1);

    if (
      physicsBone.bone.parent &&
      this.boneGraphics.has(physicsBone.bone.parent)
    ) {
      const parentGraphic = this.boneGraphics.get(physicsBone.bone.parent);
      // Здесь нужно преобразовать координаты, но для простоты пока не рисуем связи
    }

    // Рисуем точку в позиции кости
    graphic.beginFill(0xff0000);
    graphic.drawCircle(
      physicsBone.currentPosition.x,
      physicsBone.currentPosition.y,
      5
    );
    graphic.endFill();
  }

  reset() {
    for (const physicsBone of this.physicsBones) {
      physicsBone.reset();
    }

    // Очищаем графику
    this.boneGraphics.forEach((graphic) => graphic.clear());
    this.boneGraphics.clear();
  }
}

export class PhysicsBone {
  public bone: any;
  public settings: PhysicsSettings;

  public currentPosition: PIXI.Point; // Сделали публичным для визуализации
  private velocity: PIXI.Point;
  private currentRotation: number;
  private angleVelocity: number;
  private isInitialized: boolean = false;
  private frameCount: number = 0;

  constructor(
    bone: any,
    settings: PhysicsSettings,
    private physicsConfig: PhysicsConfig,
    private globalSettings: any
  ) {
    this.bone = bone;
    this.settings = settings;

    this.currentPosition = new PIXI.Point(0, 0);
    this.velocity = new PIXI.Point(0, 0);
    this.currentRotation = 0;
    this.angleVelocity = 0;
  }

  update(deltaTime: number, holderPosition: PIXI.Point) {
    this.frameCount++;

    // Если физика отключена, ничего не делаем
    if (this.settings.FixPosition) {
      return;
    }

    // Инициализация при первом обновлении
    if (!this.isInitialized) {
      this.currentPosition.set(this.bone.worldX, this.bone.worldY);
      this.currentRotation = this.bone.rotation;
      this.isInitialized = true;
      return;
    }

    // Стабилизация в первые несколько кадров
    if (this.frameCount <= 10) {
      this.currentPosition.set(this.bone.worldX, this.bone.worldY);
      this.currentRotation = this.bone.rotation;
      return;
    }

    // Целевые позиции из анимации
    const targetX = this.bone.worldX;
    const targetY = this.bone.worldY;
    const targetRotation = this.bone.rotation;

    // Пружинная физика
    const stiffness = this.settings.Shiftiness || 5.0;
    const damping = this.settings.Damping || 1.0;
    const mass = Math.max(0.1, this.settings.Mass || 1.0);

    // Силы пружины
    const springForceX = (targetX - this.currentPosition.x) * stiffness;
    const springForceY = (targetY - this.currentPosition.y) * stiffness;

    // Демпфирование
    const dampingForceX = -this.velocity.x * damping;
    const dampingForceY = -this.velocity.y * damping;

    // Угловые силы
    const angleSpringForce =
      (targetRotation - this.currentRotation) * stiffness;
    const angleDampingForce = -this.angleVelocity * damping;

    // Интегрирование скорости
    this.velocity.x += ((springForceX + dampingForceX) / mass) * deltaTime;
    this.velocity.y += ((springForceY + dampingForceY) / mass) * deltaTime;
    this.angleVelocity +=
      ((angleSpringForce + angleDampingForce) / mass) * deltaTime;

    // Интегрирование позиции
    this.currentPosition.x += this.velocity.x * deltaTime;
    this.currentPosition.y += this.velocity.y * deltaTime;
    this.currentRotation += this.angleVelocity * deltaTime;
  }

  reset() {
    this.isInitialized = false;
    this.frameCount = 0;
    this.currentPosition.set(0, 0);
    this.currentRotation = 0;
    this.velocity.set(0, 0);
    this.angleVelocity = 0;
  }
}
