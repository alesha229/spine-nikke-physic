// bone-physics.ts
import * as PIXI from "pixi.js";
import { PhysicsConfig, PhysicsSettings } from "./physics-config";

interface PhysicsState {
  position: PIXI.Point;
  velocity: PIXI.Point;
  rotation: number;
  angleVelocity: number;
}

export class BonePhysics {
  public bone: any;
  private boneAnimate: any;
  public settings: PhysicsSettings;
  public currentPosition: PIXI.Point;
  public velocity: PIXI.Point;
  public initialLocalPosition: PIXI.Point;
  public currentRotation: number;
  public angleVelocity: number;
  private initialWorldPosition: PIXI.Point;
  private previousPosition: PIXI.Point;
  private previousRotation: number;
  private isInitialized: boolean;
  private lastHolderPosition: PIXI.Point;
  private holderVelocity: PIXI.Point;
  private physicsConfig: PhysicsConfig;
  private globalSettings: any;

  // Переменные для дополнительных функций
  private smoothVelocity: PIXI.Point;
  private smoothAngleVelocity: number;
  private lookAtTarget: PIXI.Point | null;
  private originalBoneLength: number;
  private initialParentPosition: PIXI.Point; // Добавляем для корректного расчета

  constructor(
    bonePhysic: any,
    boneAnimate: any,
    settings: PhysicsSettings,
    physicsConfig: PhysicsConfig,
    globalSettings: any
  ) {
    this.bone = bonePhysic;
    this.boneAnimate = boneAnimate;
    this.settings = settings;
    this.physicsConfig = physicsConfig;
    this.globalSettings = globalSettings;

    // Сохраняем изначальные локальные координаты для расчета длины кости
    this.initialLocalPosition = new PIXI.Point(boneAnimate.x, boneAnimate.y);

    // Инициализируем все позиции одинаково
    this.currentPosition = new PIXI.Point(
      boneAnimate.worldX,
      boneAnimate.worldY
    );
    this.initialWorldPosition = new PIXI.Point(
      boneAnimate.worldX,
      boneAnimate.worldY
    );
    this.previousPosition = new PIXI.Point(
      boneAnimate.worldX,
      boneAnimate.worldY
    );

    // Инициализируем все скорости нулями
    this.velocity = new PIXI.Point(0, 0);
    this.currentRotation = boneAnimate.rotation;
    this.previousRotation = boneAnimate.rotation;
    this.angleVelocity = 0;

    this.isInitialized = false;
    this.lastHolderPosition = new PIXI.Point(0, 0);
    this.holderVelocity = new PIXI.Point(0, 0);

    // Инициализация дополнительных переменных
    this.smoothVelocity = new PIXI.Point(0, 0);
    this.smoothAngleVelocity = 0;
    this.lookAtTarget = null;

    // Вычисление длины кости из локальных координат
    if (this.bone.parent) {
      this.originalBoneLength = Math.sqrt(
        this.initialLocalPosition.x * this.initialLocalPosition.x +
          this.initialLocalPosition.y * this.initialLocalPosition.y
      );
      this.initialParentPosition = new PIXI.Point(
        this.boneAnimate.worldX,
        this.boneAnimate.worldY
      );
    } else {
      this.originalBoneLength = Math.sqrt(
        this.initialLocalPosition.x * this.initialLocalPosition.x +
          this.initialLocalPosition.y * this.initialLocalPosition.y
      );
      this.initialParentPosition = new PIXI.Point(0, 0);
    }

    // Минимальная длина для избежания деления на ноль
    if (this.originalBoneLength < 1.0) {
      this.originalBoneLength = 1.0;
    }
  }

  // Инициализация после первого обновления кости
  initialize(holderPosition: PIXI.Point) {
    if (!this.isInitialized) {
      const currentWorldX = this.boneAnimate.worldX;
      const currentWorldY = this.boneAnimate.worldY;
      const currentRot = this.boneAnimate.rotation;

      this.currentPosition.set(currentWorldX, currentWorldY);
      this.initialWorldPosition.set(currentWorldX, currentWorldY);
      this.previousPosition.set(currentWorldX, currentWorldY);

      this.currentRotation = currentRot;
      this.previousRotation = currentRot;

      this.velocity.set(0, 0);
      this.angleVelocity = 0;
      this.smoothVelocity.set(0, 0);
      this.smoothAngleVelocity = 0;

      this.lastHolderPosition.copyFrom(holderPosition);
      this.holderVelocity.set(0, 0);

      // НЕ пересчитываем длину кости - используем только изначальную из локальных координат

      this.isInitialized = true;
    }
  }

  // Проверка, нужно ли применять физику

  // Получение коэффициента силы с плавным нарастанием
  private getForceMultiplier(): number {
    const rampTime = 0.5;

    return this.settings.ForceMultiplier;
  }

  // Обновление скорости холдера для инерции
  updateHolderVelocity(currentHolderPosition: PIXI.Point, deltaTime: number) {
    if (deltaTime > 0) {
      this.holderVelocity.set(
        (currentHolderPosition.x - this.lastHolderPosition.x) / deltaTime,
        (currentHolderPosition.y - this.lastHolderPosition.y) / deltaTime
      );
      this.lastHolderPosition.copyFrom(currentHolderPosition);
    }
  }

  // Применение инерции от движения холдера
  applyHolderInertia(deltaTime: number) {
    if (this.settings.Mass > 0) {
      const inertiaFactor = 0.5 / this.settings.Mass;
      this.velocity.x += this.holderVelocity.x * inertiaFactor;
      this.velocity.y += this.holderVelocity.y * inertiaFactor;
    }
  }

  // Применение случайной силы
  applyRandomForce(multiplayer: number = 100) {
    if (!this.settings.FixPosition && this.settings.Mass > 0) {
      const force =
        (this.physicsConfig.FireShakeMinForce +
          Math.random() *
            (this.physicsConfig.FireShakeMaxForce -
              this.physicsConfig.FireShakeMinForce)) *
        this.globalSettings.physicsStrengthMultiplier;

      const minAngle = this.physicsConfig.ForceRandomAngleMin * (Math.PI / 180);
      const maxAngle = this.physicsConfig.ForceRandomAngleMax * (Math.PI / 180);
      const angle = minAngle + Math.random() * (maxAngle - minAngle);

      this.velocity.x += Math.cos(angle) * force * multiplayer;
      this.velocity.y += Math.sin(angle) * force * multiplayer;

      const rotationImpulse =
        force * 0.02 * this.globalSettings.physicsStrengthMultiplier;
      this.angleVelocity += (Math.random() - 0.5) * 2 * rotationImpulse;
    }
  }

  // Нормализация угла в диапазон [-180, 180]
  private normalizeAngle(angle: number): number {
    while (angle > Math.PI) angle -= 2 * Math.PI;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    return angle;
  }

  // Вычисление целевой позиции кости - ДОЛЖНА СЛЕДОВАТЬ АНИМАЦИИ!
  private getTargetWorldPosition(): PIXI.Point {
    // Кость должна стремиться к текущему положению анимации, а не к статичному изначальному!
    return new PIXI.Point(this.boneAnimate.worldX, this.boneAnimate.worldY);
  }

  // Вычисление целевого поворота кости - ДОЛЖЕН СЛЕДОВАТЬ АНИМАЦИИ!
  private getTargetRotation(): number {
    // Кость должна стремиться к текущему повороту анимации, а не к статичному изначальному!
    return this.boneAnimate.rotation;
  }

  // Применение физики к кости
  private applyToBone() {
    const deltaX = this.currentPosition.x - this.boneAnimate.worldX;
    const deltaY = this.currentPosition.y - this.boneAnimate.worldY;

    this.bone.x = this.initialLocalPosition.x + deltaX;
    this.bone.y = this.initialLocalPosition.y + deltaY;
  }

  // Применение ограничений к кости
  private applyConstraints(deltaTime: number) {
    // ИСПРАВЛЕННОЕ применение StretchLimit

    // Вычисляем текущий вектор от родителя к кости в мировых координатах
    const currentWorldVector = new PIXI.Point(
      this.currentPosition.x - this.boneAnimate.worldX,
      this.currentPosition.y - this.boneAnimate.worldY
    );

    const currentDistance = Math.sqrt(
      currentWorldVector.x * currentWorldVector.x +
        currentWorldVector.y * currentWorldVector.y
    );

    // Максимально допустимое расстояние
    let maxDistance = this.originalBoneLength * this.settings.StretchLimit;

    if (this.bone.data.name.includes("hair")) {
      maxDistance = this.originalBoneLength * 0.2;
    }
    // Применяем ограничение только если превышена максимальная длина
    if (currentDistance > maxDistance && currentDistance > 0.001) {
      const ratio = maxDistance / currentDistance;
      this.currentPosition.set(
        this.boneAnimate.worldX + currentWorldVector.x * ratio,
        this.boneAnimate.worldY + currentWorldVector.y * ratio
      );

      // Корректируем скорость - убираем компонент в направлении от родителя
      const normal = new PIXI.Point(
        currentWorldVector.x / currentDistance,
        currentWorldVector.y / currentDistance
      );

      const velocityDotNormal =
        this.velocity.x * normal.x + this.velocity.y * normal.y;
      if (velocityDotNormal > 0) {
        this.velocity.x -= velocityDotNormal * normal.x * 0.8;
        this.velocity.y -= velocityDotNormal * normal.y * 0.8;
      }
    }

    // Ограничение угла поворота
    if (this.settings.AngleLimit < 180 && this.bone.parent) {
      const relativeRotation = this.normalizeAngle(
        this.currentRotation - this.bone.parent.rotation
      );
      const angleLimit = this.settings.AngleLimit * (Math.PI / 180);

      if (Math.abs(relativeRotation) > angleLimit) {
        const correction = Math.sign(relativeRotation) * angleLimit;
        this.currentRotation = this.bone.parent.rotation + correction;
        // Сильно уменьшаем угловую скорость при ограничении
        this.angleVelocity *= 0.1;
      }
    }

    // Фиксированная длина пружины
    if (this.settings.FixSpringLength && this.bone.parent) {
      const currentWorldVector = new PIXI.Point(
        this.currentPosition.x - this.boneAnimate.worldX,
        this.currentPosition.y - this.boneAnimate.worldY
      );

      const currentLength = Math.sqrt(
        currentWorldVector.x * currentWorldVector.x +
          currentWorldVector.y * currentWorldVector.y
      );

      if (currentLength > 0.001) {
        const ratio = this.originalBoneLength / currentLength;
        this.currentPosition.set(
          this.boneAnimate.worldX + currentWorldVector.x * ratio,
          this.boneAnimate.worldY + currentWorldVector.y * ratio
        );
      }
    }
  }

  // Функция сглаживания для позиции
  private smoothDamp(
    current: number,
    target: number,
    currentVelocity: number,
    smoothTime: number,
    deltaTime: number
  ): number {
    smoothTime = Math.max(0.0001, smoothTime);
    const omega = 2 / smoothTime;
    const x = omega * deltaTime;
    const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
    const change = current - target;
    const maxChange = Number.MAX_VALUE;
    const clampedChange = Math.min(Math.max(change, -maxChange), maxChange);
    const temp = (currentVelocity + omega * clampedChange) * deltaTime;
    currentVelocity = (currentVelocity - omega * temp) * exp;
    const output = current - clampedChange + (clampedChange + temp) * exp;

    if (target - current > 0 === output > target) {
      return target;
    }

    return output;
  }

  // Функция сглаживания для углов
  private smoothDampAngle(
    current: number,
    target: number,
    currentVelocity: number,
    smoothTime: number,
    deltaTime: number
  ): number {
    let targetAdjusted = target;
    let currentAdjusted = current;

    const diff = targetAdjusted - currentAdjusted;
    if (Math.abs(diff) > Math.PI) {
      targetAdjusted -= Math.sign(diff) * Math.PI * 2;
    }

    return this.smoothDamp(
      currentAdjusted,
      targetAdjusted,
      currentVelocity,
      smoothTime,
      deltaTime
    );
  }

  // Обновление направления взгляда на дочернюю кость
  private updateLookAtChild() {
    if (
      this.settings.LookAtChild &&
      this.bone.children &&
      this.bone.children.length > 0
    ) {
      const childBone = this.bone.children[0];
      if (childBone) {
        const dx = childBone.worldX - this.bone.worldX;
        const dy = childBone.worldY - this.bone.worldY;
        this.lookAtTarget = new PIXI.Point(dx, dy);

        const targetAngle = Math.atan2(dy, dx);
        const angleDiff = targetAngle - this.currentRotation;
        const maxAngleChange = 0.1;

        if (Math.abs(angleDiff) > maxAngleChange) {
          this.currentRotation += Math.sign(angleDiff) * maxAngleChange;
        } else {
          this.currentRotation = targetAngle;
        }
      }
    }
  }

  // Метод Рунге-Кутты 4-го порядка
  private updateRK4(deltaTime: number, holderPosition: PIXI.Point) {
    this.initialize(holderPosition);

    this.updateHolderVelocity(holderPosition, deltaTime);

    if (this.settings.FixPosition) {
      this.currentPosition.set(this.bone.worldX, this.bone.worldY);
      this.currentRotation = this.bone.rotation;
      this.velocity.set(0, 0);
      this.angleVelocity = 0;
      return;
    }

    this.applyHolderInertia(deltaTime);
    this.previousPosition.copyFrom(this.currentPosition);
    this.previousRotation = this.currentRotation;

    // ИСПРАВЛЕНО: используем правильные целевые позиции
    const targetPosition = this.getTargetWorldPosition();
    const targetX = targetPosition.x;
    const targetY = targetPosition.y;
    const targetRotation = this.getTargetRotation();

    const currentState: PhysicsState = {
      position: new PIXI.Point(this.currentPosition.x, this.currentPosition.y),
      velocity: new PIXI.Point(this.velocity.x, this.velocity.y),
      rotation: this.currentRotation,
      angleVelocity: this.angleVelocity,
    };

    const k1 = this.calculateDerivatives(
      currentState,
      targetX,
      targetY,
      targetRotation,
      0,
      deltaTime
    );
    const k2 = this.calculateDerivatives(
      this.addStates(currentState, this.multiplyState(k1, 0.5 * deltaTime)),
      targetX,
      targetY,
      targetRotation,
      0.5 * deltaTime,
      deltaTime
    );
    const k3 = this.calculateDerivatives(
      this.addStates(currentState, this.multiplyState(k2, 0.5 * deltaTime)),
      targetX,
      targetY,
      targetRotation,
      0.5 * deltaTime,
      deltaTime
    );
    const k4 = this.calculateDerivatives(
      this.addStates(currentState, this.multiplyState(k3, deltaTime)),
      targetX,
      targetY,
      targetRotation,
      deltaTime,
      deltaTime
    );

    const finalDerivative = this.addStates(
      k1,
      this.multiplyState(this.addStates(k2, k3), 2),
      k4
    );
    const newState = this.addStates(
      currentState,
      this.multiplyState(finalDerivative, deltaTime / 6)
    );

    this.currentPosition.copyFrom(newState.position);
    this.velocity.copyFrom(newState.velocity);
    this.currentRotation = newState.rotation;
    this.angleVelocity = newState.angleVelocity;

    this.currentRotation = this.normalizeAngle(this.currentRotation);

    // Применяем ограничения ПЕРЕД обновлением скоростей
    this.applyConstraints(deltaTime);

    // Пересчитываем скорости на основе финальной позиции
    this.velocity.set(
      (this.currentPosition.x - this.previousPosition.x) / deltaTime,
      (this.currentPosition.y - this.previousPosition.y) / deltaTime
    );
    this.angleVelocity =
      (this.currentRotation - this.previousRotation) / deltaTime;

    const velocityThreshold = 0.1;
    if (Math.abs(this.velocity.x) < velocityThreshold) this.velocity.x = 0;
    if (Math.abs(this.velocity.y) < velocityThreshold) this.velocity.y = 0;
    if (Math.abs(this.angleVelocity) < velocityThreshold)
      this.angleVelocity = 0;

    this.applyToBone();
  }

  private calculateDerivatives(
    state: PhysicsState,
    targetX: number,
    targetY: number,
    targetRotation: number,
    time: number,
    deltaTime: number
  ): PhysicsState {
    const forceMultiplier = this.getForceMultiplier();

    const springForceX =
      (targetX - state.position.x) * this.settings.Shiftiness;
    const springForceY =
      (targetY - state.position.y) * this.settings.Shiftiness;
    const dampingForceX = -state.velocity.x * this.settings.Damping;
    const dampingForceY = -state.velocity.y * this.settings.Damping;

    const angleSpringForce =
      (targetRotation - state.rotation) * this.settings.SupportSpringShiftiness;
    const angleDampingForce =
      -state.angleVelocity * this.settings.SupportSpringDamping;

    let totalForceX =
      (springForceX + dampingForceX) *
      forceMultiplier *
      this.globalSettings.physicsStrengthMultiplier;
    let totalForceY =
      (springForceY + dampingForceY) *
      forceMultiplier *
      this.globalSettings.physicsStrengthMultiplier;
    let totalAngleForce =
      (angleSpringForce + angleDampingForce) *
      forceMultiplier *
      this.globalSettings.physicsStrengthMultiplier;

    const maxForce = this.globalSettings.maxForce;
    totalForceX = Math.max(-maxForce, Math.min(maxForce, totalForceX));
    totalForceY = Math.max(-maxForce, Math.min(maxForce, totalForceY));
    totalAngleForce = Math.max(-maxForce, Math.min(maxForce, totalAngleForce));

    const accelerationX = totalForceX / this.settings.Mass;
    const accelerationY = totalForceY / this.settings.Mass;
    const angularAcceleration = totalAngleForce / this.settings.Mass;

    return {
      position: new PIXI.Point(state.velocity.x, state.velocity.y),
      velocity: new PIXI.Point(accelerationX, accelerationY),
      rotation: state.angleVelocity,
      angleVelocity: angularAcceleration,
    };
  }

  private multiplyState(state: PhysicsState, factor: number): PhysicsState {
    return {
      position: new PIXI.Point(
        state.position.x * factor,
        state.position.y * factor
      ),
      velocity: new PIXI.Point(
        state.velocity.x * factor,
        state.velocity.y * factor
      ),
      rotation: state.rotation * factor,
      angleVelocity: state.angleVelocity * factor,
    };
  }

  private addStates(...states: PhysicsState[]): PhysicsState {
    const result: PhysicsState = {
      position: new PIXI.Point(0, 0),
      velocity: new PIXI.Point(0, 0),
      rotation: 0,
      angleVelocity: 0,
    };

    for (const state of states) {
      result.position.x += state.position.x;
      result.position.y += state.position.y;
      result.velocity.x += state.velocity.x;
      result.velocity.y += state.velocity.y;
      result.rotation += state.rotation;
      result.angleVelocity += state.angleVelocity;
    }

    return result;
  }

  // Стандартный метод Эйлера
  private updateEuler(deltaTime: number, holderPosition: PIXI.Point) {
    this.initialize(holderPosition);
    this.applyConstraints(deltaTime);

    this.updateHolderVelocity(holderPosition, deltaTime);

    if (this.settings.FixPosition) {
      this.currentPosition.set(
        this.boneAnimate.worldX,
        this.boneAnimate.worldY
      );
      this.currentRotation = this.bone.rotation;
      this.velocity.set(0, 0);
      this.angleVelocity = 0;
      return;
    }

    this.applyHolderInertia(deltaTime);
    this.previousPosition.copyFrom(this.currentPosition);
    this.previousRotation = this.currentRotation;

    // ИСПРАВЛЕНО: используем правильные целевые позиции
    const targetPosition = this.getTargetWorldPosition();
    const targetX = targetPosition.x;
    const targetY = targetPosition.y;
    const targetRotation = this.getTargetRotation();

    const forceMultiplier = this.getForceMultiplier();

    const springForceX =
      (targetX - this.currentPosition.x) * this.settings.Shiftiness;
    const springForceY =
      (targetY - this.currentPosition.y) * this.settings.Shiftiness;
    const dampingForceX = -this.velocity.x * this.settings.Damping;
    const dampingForceY = -this.velocity.y * this.settings.Damping;

    const angleSpringForce =
      (targetRotation - this.currentRotation) *
      this.settings.SupportSpringShiftiness;
    const angleDampingForce =
      -this.angleVelocity * this.settings.SupportSpringDamping;

    let totalForceX =
      (springForceX + dampingForceX) *
      forceMultiplier *
      this.globalSettings.physicsStrengthMultiplier;
    let totalForceY =
      (springForceY + dampingForceY) *
      forceMultiplier *
      this.globalSettings.physicsStrengthMultiplier;
    let totalAngleForce =
      (angleSpringForce + angleDampingForce) *
      forceMultiplier *
      this.globalSettings.physicsStrengthMultiplier;

    const maxForce = this.globalSettings.maxForce;
    totalForceX = Math.max(-maxForce, Math.min(maxForce, totalForceX));
    totalForceY = Math.max(-maxForce, Math.min(maxForce, totalForceY));
    totalAngleForce = Math.max(-maxForce, Math.min(maxForce, totalAngleForce));

    this.velocity.x += (totalForceX / this.settings.Mass) * deltaTime;
    this.velocity.y += (totalForceY / this.settings.Mass) * deltaTime;
    this.angleVelocity += (totalAngleForce / this.settings.Mass) * deltaTime;

    const maxSpeed = this.globalSettings.maxSpeed;
    const speed = Math.sqrt(
      this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y
    );
    if (speed > maxSpeed) {
      this.velocity.x = (this.velocity.x / speed) * maxSpeed;
      this.velocity.y = (this.velocity.y / speed) * maxSpeed;
    }

    this.currentPosition.x += this.velocity.x * deltaTime;
    this.currentPosition.y += this.velocity.y * deltaTime;
    this.currentRotation += this.angleVelocity * deltaTime;

    this.currentRotation = this.normalizeAngle(this.currentRotation);

    // Применяем ограничения ПЕРЕД обновлением скоростей

    // Пересчитываем скорости на основе финальной позиции
    this.velocity.set(
      (this.currentPosition.x - this.previousPosition.x) / deltaTime,
      (this.currentPosition.y - this.previousPosition.y) / deltaTime
    );
    this.angleVelocity =
      (this.currentRotation - this.previousRotation) / deltaTime;

    const velocityThreshold = 0.1;
    if (Math.abs(this.velocity.x) < velocityThreshold) this.velocity.x = 0;
    if (Math.abs(this.velocity.y) < velocityThreshold) this.velocity.y = 0;
    if (Math.abs(this.angleVelocity) < velocityThreshold)
      this.angleVelocity = 0;

    this.applyToBone();
  }

  // Основной метод обновления
  public update(deltaTime: number, holderPosition: PIXI.Point) {
    if (deltaTime === 0) return;

    // Инициализация на первом кадре
    if (!this.isInitialized) {
      this.currentPosition.set(this.bone.worldX, this.bone.worldY);
      this.isInitialized = true;
    }
    this.updateEuler(deltaTime, holderPosition);

    this.currentPosition.x += this.velocity.x * deltaTime;
    this.currentPosition.y += this.velocity.y * deltaTime;

    // this.applyConstraints();

    // Преобразование мировых координат в локальные
    // this.applyToBone();
  }

  // Геттер для получения текущей длины кости (для отладки)
  public get currentBoneLength(): number {
    if (this.bone.parent) {
      const deltaX = this.currentPosition.x - this.boneAnimate.worldX;
      const deltaY = this.currentPosition.y - this.boneAnimate.worldY;
      return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    }
    return 0;
  }

  // Геттер для получения изначальной длины кости (для отладки)
  public get initialBoneLength(): number {
    return this.originalBoneLength;
  }

  // Метод для получения информации о текущем состоянии (для отладки)
}
