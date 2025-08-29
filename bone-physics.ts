import * as PIXI from "pixi.js";

export class BonePhysicsState {
  public currentPosition: PIXI.Point;
  public velocity: PIXI.Point;
  public currentRotation: number;
  public angleVelocity: number;
  public initialLocalPosition: PIXI.Point;

  constructor(bone: any) {
    this.initialLocalPosition = new PIXI.Point(bone.x, bone.y);
    this.currentPosition = new PIXI.Point(bone.worldX, bone.worldY);
    this.velocity = new PIXI.Point(0, 0);
    this.currentRotation = bone.rotation;
    this.angleVelocity = 0;
  }
}

export class PhysicsEngine {
  public bone: any;
  public settings: any;
  public state: BonePhysicsState;

  constructor(bone: any, settings: any) {
    this.bone = bone;
    this.settings = settings;
    this.state = new BonePhysicsState(bone);
  }

  update(deltaTime: number) {
    const targetX = this.bone.worldX;
    const targetY = this.bone.worldY;
    const targetRotation = this.bone.rotation;

    const springForceX =
      (targetX - this.state.currentPosition.x) * this.settings.Shiftiness;
    const springForceY =
      (targetY - this.state.currentPosition.y) * this.settings.Shiftiness;
    const dampingForceX = -this.state.velocity.x * this.settings.Damping;
    const dampingForceY = -this.state.velocity.y * this.settings.Damping;

    let totalForceX =
      (springForceX + dampingForceX) * this.settings.ForceMultiplier;
    let totalForceY =
      (springForceY + dampingForceY) * this.settings.ForceMultiplier;

    let relativeRotation = targetRotation - this.state.currentRotation;
    while (relativeRotation > Math.PI) relativeRotation -= 2 * Math.PI;
    while (relativeRotation < -Math.PI) relativeRotation += 2 * Math.PI;

    const angleSpringForce =
      relativeRotation * this.settings.SupportSpringShiftiness;
    const angleDampingForce =
      -this.state.angleVelocity * this.settings.SupportSpringDamping;
    let totalAngleForce =
      (angleSpringForce + angleDampingForce) * this.settings.ForceMultiplier;

    this.state.velocity.x += (totalForceX / this.settings.Mass) * deltaTime;
    this.state.velocity.y += (totalForceY / this.settings.Mass) * deltaTime;
    this.state.angleVelocity +=
      (totalAngleForce / this.settings.Mass) * deltaTime;

    this.state.currentPosition.x += this.state.velocity.x * deltaTime;
    this.state.currentPosition.y += this.state.velocity.y * deltaTime;
    this.state.currentRotation += this.state.angleVelocity * deltaTime;

    this.applyConstraints();
  }

  applyPhysicsToBone() {
    let parentMatrix;
    if (this.bone.parent) {
      parentMatrix = this.bone.parent.worldTransform;
    } else {
      parentMatrix = this.bone.skeleton.transform;
    }

    // ВОТ ОНО! ОКОНЧАТЕЛЬНОЕ И БЕЗУПРЕЧНОЕ РЕШЕНИЕ
    // Дополнительная проверка на существование матрицы
    if (parentMatrix) {
      const invParentMatrix = new PIXI.Matrix();
      parentMatrix.invert(invParentMatrix);
      const newLocalPos = invParentMatrix.apply(this.state.currentPosition);
      this.bone.x = newLocalPos.x;
      this.bone.y = newLocalPos.y;
    } else {
      this.bone.x = this.state.currentPosition.x;
      this.bone.y = this.state.currentPosition.y;
    }

    this.bone.rotation = this.state.currentRotation;
  }

  private applyConstraints() {
    if (this.settings.StretchLimit > 0) {
      const parentBone = this.bone.parent;
      let parentPos;

      if (parentBone) {
        parentPos = parentBone.worldTransform;
      } else {
        parentPos = this.bone.skeleton.transform;
      }

      if (!parentPos) {
        return;
      }

      const initialLocalLen = Math.sqrt(
        this.state.initialLocalPosition.x ** 2 +
          this.state.initialLocalPosition.y ** 2
      );
      const currentWorldLenSq =
        (this.state.currentPosition.x - parentPos.tx) ** 2 +
        (this.state.currentPosition.y - parentPos.ty) ** 2;

      const maxLenSq = (initialLocalLen * this.settings.StretchLimit) ** 2;
      if (currentWorldLenSq > maxLenSq) {
        const ratio = Math.sqrt(maxLenSq / currentWorldLenSq);
        const newX =
          parentPos.tx + (this.state.currentPosition.x - parentPos.tx) * ratio;
        const newY =
          parentPos.ty + (this.state.currentPosition.y - parentPos.ty) * ratio;
        this.state.currentPosition.set(newX, newY);
        this.state.velocity.set(0, 0);
      }
    }

    if (this.settings.AngleLimit < 180 && this.bone.parent) {
      const angleLimitRad = (this.settings.AngleLimit * Math.PI) / 180;
      let relativeRotation =
        this.state.currentRotation - this.bone.parent.rotation;
      while (relativeRotation > Math.PI) relativeRotation -= 2 * Math.PI;
      while (relativeRotation < -Math.PI) relativeRotation += 2 * Math.PI;

      if (Math.abs(relativeRotation) > angleLimitRad) {
        const clampedRotation = Math.sign(relativeRotation) * angleLimitRad;
        this.state.currentRotation =
          this.bone.parent.rotation + clampedRotation;
        this.state.angleVelocity = 0;
      }
    }
  }
}
