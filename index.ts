import * as PIXI from "pixi.js";
import { Spine } from "@pixi-spine/all-4.1";

interface PhysicsSettings {
  Shiftiness: number;
  Damping: number;
  SupportSpringShiftiness: number;
  SupportSpringDamping: number;
  ForceMultiplier: number;
  AngleLimit: number;
  StretchLimit: number;
  Mass: number;
  FixPosition: boolean;
  LookAtChild: boolean;
  BoneColor: { r: number; g: number; b: number; a: number };
  SmoothTime: number;
  AngleSmoothDampingEnabled: boolean;
  SmoothDampingEnabled: boolean;
  FixSpringLength: boolean;
  BlendMode: string;
}

interface PhysicsConfig {
  BoneSpringPhysicsSettingCollection: { [boneName: string]: PhysicsSettings };
}
interface AnimationConfig {
  track: number;
  name: string;
  loop: boolean;
  delay: number;
  weight?: number;
  timeScale?: number;
}

interface AnimationMixConfig {
  animations: AnimationConfig[];
  crossFadeDuration: number;
}
class AnimationMixController {
  private spine: Spine;
  private config: AnimationMixConfig;
  private nextPlayTimes: Map<number, number>;
  private currentTimes: Map<number, number>;
  private playedTracks: Set<number>;
  private trackStates: Map<
    number,
    { isPlaying: boolean; lastAnimation: string }
  >;

  constructor(spine: Spine, config: AnimationMixConfig) {
    this.spine = spine;
    this.config = config;
    this.nextPlayTimes = new Map();
    this.currentTimes = new Map();
    this.playedTracks = new Set();
    this.trackStates = new Map();

    this.spine.state.data.defaultMix = this.config.crossFadeDuration;

    config.animations.forEach((anim) => {
      this.nextPlayTimes.set(anim.track, Date.now() + anim.delay);
      this.currentTimes.set(anim.track, 0);
      this.trackStates.set(anim.track, { isPlaying: false, lastAnimation: "" });
    });

    this.spine.state.addListener({
      complete: (entry) => {
        const track = entry.trackIndex;
        const state = this.trackStates.get(track);
        if (state) {
          state.isPlaying = false;
        }
      },
      start: () => {},
      interrupt: () => {},
      end: () => {},
      dispose: () => {},
      event: () => {},
    });
  }

  update(currentTime: number) {
    this.config.animations.forEach((anim) => {
      const track = anim.track;
      const trackState = this.trackStates.get(track);

      if (anim.loop) {
        if (!this.playedTracks.has(track)) {
          const trackEntry = this.spine.state.setAnimation(
            track,
            anim.name,
            anim.loop
          );

          if (anim.weight !== undefined) {
            trackEntry.alpha = anim.weight;
          }

          if (anim.timeScale !== undefined) {
            trackEntry.timeScale = anim.timeScale;
          }

          this.playedTracks.add(track);
          if (trackState) {
            trackState.isPlaying = true;
            trackState.lastAnimation = anim.name;
          }
        }
      } else {
        const shouldPlay = currentTime >= this.nextPlayTimes.get(track)!;
        const isTrackFree = !trackState?.isPlaying;

        if (shouldPlay && isTrackFree) {
          const trackEntry = this.spine.state.setAnimation(
            track,
            anim.name,
            anim.loop
          );

          if (anim.weight !== undefined) {
            trackEntry.alpha = anim.weight;
          }

          if (anim.timeScale !== undefined) {
            trackEntry.timeScale = anim.timeScale;
          }

          this.nextPlayTimes.set(track, currentTime + anim.delay);
          if (trackState) {
            trackState.isPlaying = true;
            trackState.lastAnimation = anim.name;
          }
        }
      }
    });
  }

  updateConfig(newConfig: Partial<AnimationMixConfig>) {
    this.config = { ...this.config, ...newConfig };
    this.spine.state.data.defaultMix = this.config.crossFadeDuration;
  }

  updateAnimation(
    track: number,
    newSettings: Partial<AnimationMixConfig["animations"][0]>
  ) {
    const animationIndex = this.config.animations.findIndex(
      (a) => a.track === track
    );
    if (animationIndex !== -1) {
      this.config.animations[animationIndex] = {
        ...this.config.animations[animationIndex],
        ...newSettings,
      };
    }
  }
}
class BonePhysics {
  public bone: any;
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

  constructor(bone: any, settings: PhysicsSettings) {
    this.bone = bone;
    this.settings = settings;
    this.initialLocalPosition = new PIXI.Point(bone.x, bone.y);
    this.currentPosition = new PIXI.Point(bone.worldX, bone.worldY);
    this.initialWorldPosition = new PIXI.Point(bone.worldX, bone.worldY);
    this.previousPosition = new PIXI.Point(bone.worldX, bone.worldY);
    this.velocity = new PIXI.Point(0, 0);
    this.currentRotation = bone.rotation;
    this.previousRotation = bone.rotation;
    this.angleVelocity = 0;
    this.isInitialized = false;
    this.lastHolderPosition = new PIXI.Point(0, 0);
    this.holderVelocity = new PIXI.Point(0, 0);
  }

  // Инициализация после первого обновления кости
  initialize(holderPosition: PIXI.Point) {
    if (!this.isInitialized) {
      this.currentPosition.set(this.bone.worldX, this.bone.worldY);
      this.initialWorldPosition.set(this.bone.worldX, this.bone.worldY);
      this.previousPosition.set(this.bone.worldX, this.bone.worldY);
      this.currentRotation = this.bone.rotation;
      this.previousRotation = this.bone.rotation;
      this.lastHolderPosition.copyFrom(holderPosition);
      this.isInitialized = true;
    }
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
      // Добавляем скорость холдера к скорости кости с учетом массы
      const inertiaFactor = 0.5 / this.settings.Mass;
      this.velocity.x += this.holderVelocity.x * inertiaFactor;
      this.velocity.y += this.holderVelocity.y * inertiaFactor;
    }
  }

  private normalizeAngle(angle: number): number {
    angle = angle % 360;
    if (angle > 180) angle -= 360;
    if (angle < -180) angle += 360;
    return angle;
  }

  private applyConstraints(deltaTime: number) {
    if (this.settings.StretchLimit > 0 && this.bone.parent) {
      const initialDistance = Math.sqrt(
        this.initialLocalPosition.x ** 2 + this.initialLocalPosition.y ** 2
      );

      const currentVector = new PIXI.Point(
        this.currentPosition.x - this.bone.parent.worldX,
        this.currentPosition.y - this.bone.parent.worldY
      );

      const currentDistance = Math.sqrt(
        currentVector.x ** 2 + currentVector.y ** 2
      );
      const maxDistance = initialDistance * this.settings.StretchLimit;

      if (currentDistance > maxDistance) {
        const ratio = maxDistance / currentDistance;
        this.currentPosition.set(
          this.bone.parent.worldX + currentVector.x * ratio,
          this.bone.parent.worldY + currentVector.y * ratio
        );

        const normal = new PIXI.Point(
          currentVector.x / currentDistance,
          currentVector.y / currentDistance
        );

        const velocityDotNormal =
          this.velocity.x * normal.x + this.velocity.y * normal.y;
        if (velocityDotNormal > 0) {
          this.velocity.x -= velocityDotNormal * normal.x * 1.5;
          this.velocity.y -= velocityDotNormal * normal.y * 1.5;
        }
      }
    }

    if (this.settings.AngleLimit < 180 && this.bone.parent) {
      const relativeRotation = this.normalizeAngle(
        this.currentRotation - this.bone.parent.rotation
      );
      const angleLimit = this.settings.AngleLimit;

      if (Math.abs(relativeRotation) > angleLimit) {
        const correction = Math.sign(relativeRotation) * angleLimit;
        this.currentRotation = this.bone.parent.rotation + correction;
        this.angleVelocity *= 0.2;
      }
    }
  }

  private applyToBone() {
    // Упрощенное преобразование координат - используем локальные смещения
    const deltaX = this.currentPosition.x - this.initialWorldPosition.x;
    const deltaY = this.currentPosition.y - this.initialWorldPosition.y;

    // Применяем смещение к локальным координатам кости
    this.bone.x = this.initialLocalPosition.x + deltaX;
    this.bone.y = this.initialLocalPosition.y + deltaY;
    this.bone.rotation = this.currentRotation;
  }

  update(deltaTime: number, holderPosition: PIXI.Point) {
    this.initialize(holderPosition);
    this.updateHolderVelocity(holderPosition, deltaTime);

    if (this.settings.FixPosition) {
      this.currentPosition.set(this.bone.worldX, this.bone.worldY);
      this.currentRotation = this.bone.rotation;
      this.velocity.set(0, 0);
      this.angleVelocity = 0;
      return;
    }

    // Применяем инерцию от движения холдера
    this.applyHolderInertia(deltaTime);

    this.previousPosition.copyFrom(this.currentPosition);
    this.previousRotation = this.currentRotation;

    const targetX = this.bone.worldX;
    const targetY = this.bone.worldY;
    const targetRotation = this.bone.rotation;

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
      (springForceX + dampingForceX) * this.settings.ForceMultiplier;
    let totalForceY =
      (springForceY + dampingForceY) * this.settings.ForceMultiplier;
    let totalAngleForce =
      (angleSpringForce + angleDampingForce) * this.settings.ForceMultiplier;

    // Ограничение максимальной силы для предотвращения резких движений
    const maxForce = 1000;
    totalForceX = Math.max(-maxForce, Math.min(maxForce, totalForceX));
    totalForceY = Math.max(-maxForce, Math.min(maxForce, totalForceY));
    totalAngleForce = Math.max(-maxForce, Math.min(maxForce, totalAngleForce));

    this.velocity.x += (totalForceX / this.settings.Mass) * deltaTime;
    this.velocity.y += (totalForceY / this.settings.Mass) * deltaTime;
    this.angleVelocity += (totalAngleForce / this.settings.Mass) * deltaTime;

    // Ограничение максимальной скорости
    const maxSpeed = 500;
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

    this.applyConstraints(deltaTime);

    // Более точное вычисление скорости на основе реального перемещения
    this.velocity.set(
      (this.currentPosition.x - this.previousPosition.x) / deltaTime,
      (this.currentPosition.y - this.previousPosition.y) / deltaTime
    );
    this.angleVelocity =
      (this.currentRotation - this.previousRotation) / deltaTime;

    // Затухание скорости до нуля, если она становится незначительной
    const velocityThreshold = 0.1;
    if (Math.abs(this.velocity.x) < velocityThreshold) this.velocity.x = 0;
    if (Math.abs(this.velocity.y) < velocityThreshold) this.velocity.y = 0;
    if (Math.abs(this.angleVelocity) < velocityThreshold)
      this.angleVelocity = 0;

    this.applyToBone();
  }
}

async function init() {
  const app = new PIXI.Application({
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: 0x000000,
    backgroundAlpha: 0,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
    resizeTo: window,
  });
  document.body.appendChild(app.view as HTMLCanvasElement);

  let holder = new PIXI.Container();
  holder.x = app.screen.width / 2;
  holder.y = app.screen.height / 2;

  PIXI.Assets.add({
    alias: "spineboy-data",
    src: "./c850_aim_00.skel",
  });

  PIXI.Assets.setPreferences({
    preferCreateImageBitmap: false,
  });

  let resource: any;
  try {
    resource = await PIXI.Assets.load("spineboy-data");
  } catch (e) {
    console.error("Failed to load Spine data:", e);
    return;
  }

  const spineData = resource.spineData;
  const spineboy = new Spine(spineData);
  spineboy.x = 0;
  spineboy.y = 400;
  spineboy.scale.set(0.5);

  holder.addChild(spineboy);
  app.stage.addChild(holder);

  holder.eventMode = "static";
  holder.cursor = "pointer";

  let isDragging = false;
  let dragData: any = null;
  let dragStartPos: any = null;

  holder.on("pointerdown", (e) => {
    isDragging = true;
    dragData = e.data;
    dragStartPos = e.data.getLocalPosition(holder.parent);
    holder.alpha = 0.8;
  });

  holder.on("pointerup", () => {
    isDragging = false;
    dragData = null;
    holder.alpha = 1;
  });

  holder.on("pointermove", (e) => {
    if (isDragging) {
      const newPosition = dragData.getLocalPosition(holder.parent);
      holder.x += newPosition.x - dragStartPos.x;
      holder.y += newPosition.y - dragStartPos.y;
      dragStartPos = newPosition;
    }
  });

  const physicsConfig: PhysicsConfig = await fetch("./aim-physics.json").then(
    (res) => res.json()
  );

  const physicsBones: BonePhysics[] = [];

  const physicsBoneNames = Object.keys(
    physicsConfig.BoneSpringPhysicsSettingCollection
  );

  for (const bone of spineboy.skeleton.bones) {
    if (physicsBoneNames.includes(bone.data.name)) {
      const settings =
        physicsConfig.BoneSpringPhysicsSettingCollection[bone.data.name];
      physicsBones.push(new BonePhysics(bone, settings));
      console.log(`Bone "${bone.data.name}" added to physics.`);
    }
  }

  // Создаем объект для хранения позиции холдера
  const animationMixConfig: AnimationMixConfig = {
    animations: [
      {
        name: "aim_idle",
        track: 1,
        delay: 200,
        loop: true,
        weight: 1,
      },
    ],
    crossFadeDuration: 0,
  };

  const animationMixController = new AnimationMixController(
    spineboy,
    animationMixConfig
  );

  const holderPosition = new PIXI.Point(holder.x, holder.y);

  // Добавляем обработчик клика для выстрела
  document.addEventListener("click", () => {
    // Применяем случайную силу ко всем костям
    physicsBones.forEach((bone) => {
      // bone.applyRandomForce();
    });

    // Запускаем анимацию выстрела
    const trackEntry = spineboy.state.setAnimation(2, "aim_fire", false);
    trackEntry.alpha = 1;
    trackEntry.timeScale = 0.4;

    // Устанавливаем слушатель для завершения анимации
    trackEntry.listener = {
      complete: () => {
        // После завершения анимации устанавливаем пустую анимацию на трек 2
        spineboy.state.setEmptyAnimation(2, 0.1);
      },
    };
  });
  app.ticker.add((dt: number) => {
    const deltaTime = app.ticker.deltaMS / 1000;
    const currentTime = Date.now();
    // Обновляем позицию холдера
    holderPosition.set(holder.x, holder.y);

    spineboy.update(deltaTime);
    animationMixController.update(currentTime);
    for (const bone of physicsBones) {
      bone.update(deltaTime, holderPosition);
    }

    spineboy.updateTransform();
  });

  window.addEventListener("resize", () => {
    holder.x = app.screen.width / 2;
    holder.y = app.screen.height / 2;
  });
}

init();
