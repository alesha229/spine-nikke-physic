// index.ts
import * as PIXI from "pixi.js";
import { Spine, SpineDebugRenderer } from "@pixi-spine/all-4.1";
import { PhysicsUI } from "./src/ui";
import {
  AnimationMixController,
  AnimationMixConfig,
} from "./src/animation-mix-controller";
import { BonePhysics } from "./src/bonePhysics";
import { PhysicsConfig, PhysicsSettings } from "./src/physics-config";
import { AdvancedBoneVisualizer } from "./src/advancedBoneVisualizer";

const globalSettings = {
  maxForce: 6000,
  maxSpeed: 3000,
  physicsStrengthMultiplier: 0.6,
};

const basePath =
  window.location.hostname === "localhost" ? "" : "/spine-nikke-physic";

// Добавляем доступные модели
const availableModels = ["c043", "c850", "c310"];
let currentModel = "c850"; // Модель по умолчанию

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
  app.stage.addChild(holder);

  // Объект для хранения текущего состояния
  const state = {
    spineboy: null as Spine | null,
    physicsBones: [] as BonePhysics[],
    animationMixController: null as AnimationMixController | null,
    boneVisualizer: null as AdvancedBoneVisualizer | null,
    isLoading: false, // Флаг для отслеживания процесса загрузки
  };

  // Функция для загрузки ресурсов модели
  async function loadModelResources(modelName: string) {
    console.log(`[MODEL] Loading resources for model: ${modelName}`);

    // Используем уникальный алиас для каждой модели
    const assetAlias = `spineboy-data-${modelName}`;

    // Очищаем кэш для алиаса, если он уже существует
    if (PIXI.Assets.cache.has(assetAlias)) {
      console.log(`[MODEL] Unloading existing ${assetAlias} from cache`);
      PIXI.Assets.unload(assetAlias);
    }

    PIXI.Assets.add({
      alias: assetAlias,
      src: basePath + `/${modelName}_aim_00.skel`,
    });

    PIXI.Assets.setPreferences({
      preferCreateImageBitmap: false,
    });

    let resource: any;
    try {
      console.log(`[MODEL] Loading ${assetAlias}...`);
      resource = await PIXI.Assets.load(assetAlias);
      console.log(`[MODEL] ${assetAlias} loaded successfully`);
    } catch (e) {
      console.error(`[MODEL] Failed to load ${assetAlias}:`, e);
      return null;
    }

    console.log("[MODEL] Loading physics config...");
    const physicsConfig: PhysicsConfig = await fetch(
      basePath + `/aim-physics-${modelName}.json`
    )
      .then((res) => {
        console.log("[MODEL] Physics config loaded successfully");
        return res.json();
      })
      .catch((e) => {
        console.error("[MODEL] Failed to load physics config:", e);
        return null;
      });

    if (!physicsConfig) {
      return null;
    }

    return { spineData: resource.spineData, physicsConfig };
  }

  // Функция для инициализации модели
  async function initializeModel(modelName: string) {
    console.log(`[MODEL] Initializing model: ${modelName}`);

    // Устанавливаем флаг загрузки
    state.isLoading = true;

    // Очищаем предыдущее состояние
    if (state.spineboy) {
      console.log("[MODEL] Removing previous spineboy");
      holder.removeChild(state.spineboy);
      state.spineboy.destroy();
      state.spineboy = null;
    }
    state.physicsBones = [];

    if (state.boneVisualizer) {
      console.log("[MODEL] Destroying previous bone visualizer");
      state.boneVisualizer.destroy();
      state.boneVisualizer = null;
    }

    // Загружаем ресурсы
    const resources = await loadModelResources(modelName);
    if (!resources) {
      console.error(`[MODEL] Failed to load resources for model ${modelName}`);
      state.isLoading = false;
      return false;
    }

    const { spineData, physicsConfig } = resources;
    console.log("[MODEL] Resources loaded, creating spine object");

    // Создаем спайн
    const spineboy = new Spine(spineData);
    spineboy.y = 400;
    spineboy.scale.set(0.5);

    // Добавляем отладочную информацию о модели
    console.log("[MODEL] Spine object created");
    console.log("[MODEL] Spine bounds:", spineboy.getBounds());
    console.log("[MODEL] Spine children count:", spineboy.children.length);

    // Проверяем наличие текстур
    if (spineboy.children.length === 0) {
      console.warn(
        "[MODEL] Spine has no children (textures may not be loaded)"
      );
    }

    holder.addChild(spineboy);

    // Сохраняем в состояние
    state.spineboy = spineboy;
    console.log("[MODEL] New spineboy created and added to holder");
    console.log("[MODEL] Holder children count:", holder.children.length);

    // Настраиваем анимации
    spineboy.state.data.defaultMix = 0.2;

    // Инициализация aim_x
    try {
      const ax = spineboy.state.setAnimation(1, "aim_x", true);
      if (ax) {
        ax.timeScale = 0;
        ax.mixDuration = 0.2;
        ax.alpha = 0.5;
      }
      console.log("[MODEL] aim_x animation set");
    } catch (e) {
      console.error("[MODEL] Error setting aim_x animation:", e);
    }

    // Инициализация aim_y
    try {
      const ay = spineboy.state.setAnimation(2, "aim_y", true);
      if (ay) {
        ay.timeScale = 0;
        ay.mixDuration = 0.2;
        ay.alpha = 0.5;
      }
      console.log("[MODEL] aim_y animation set");
    } catch (e) {
      console.error("[MODEL] Error setting aim_y animation:", e);
    }

    // Создаем физику для костей
    const physicsBoneNames = Object.keys(
      physicsConfig.BoneSpringPhysicsSettingCollection
    );
    console.log(
      `[MODEL] Physics bone names from config: ${physicsBoneNames.join(", ")}`
    );

    // Выводим имена всех костей в модели для отладки
    const allBoneNames = spineboy.skeleton.bones.map((bone) => bone.data.name);
    console.log(`[MODEL] All bone names in model: ${allBoneNames.join(", ")}`);

    // Находим пересечение имен костей
    const matchingBones = allBoneNames.filter((boneName) =>
      physicsBoneNames.includes(boneName)
    );
    console.log(`[MODEL] Matching bones: ${matchingBones.join(", ")}`);

    // Добавляем физику для найденных костей
    for (const bone of spineboy.skeleton.bones) {
      const boneName = bone.data.name;
      if (physicsBoneNames.includes(boneName)) {
        const settings =
          physicsConfig.BoneSpringPhysicsSettingCollection[boneName];
        const bonePhysics = new BonePhysics(
          bone,
          settings,
          physicsConfig,
          globalSettings
        );
        state.physicsBones.push(bonePhysics);
        console.log(`[MODEL] Bone "${boneName}" added to physics.`);
      }
    }

    console.log(`[MODEL] Total physics bones: ${state.physicsBones.length}`);

    // Создаем контроллер анимаций
    const animationMixConfig: AnimationMixConfig = {
      animations: [
        { track: 6, name: "aim_idle", loop: true, delay: 0, weight: 1 },
      ],
      crossFadeDuration: 0,
    };

    state.animationMixController = new AnimationMixController(
      spineboy,
      animationMixConfig
    );
    console.log("[MODEL] Animation mix controller created");

    // Создаем визуализатор костей
    state.boneVisualizer = new AdvancedBoneVisualizer(app, spineboy);
    console.log("[MODEL] Bone visualizer created");

    // Сбрасываем флаг загрузки
    state.isLoading = false;

    // Принудительно обновляем отображение
    app.renderer.render(app.stage);

    console.log(`[MODEL] Model ${modelName} initialized successfully`);
    return true;
  }

  // Первоначальная инициализация
  await initializeModel(currentModel);
  if (!state.spineboy || !state.animationMixController) return;

  // Переменные для хранения позиции курсора
  let cursorX = window.innerWidth / 2;
  let cursorY = window.innerHeight / 2;
  let normalizedX = 0.5;
  let normalizedY = 0.5;

  function updateCursorPosition(clientX: number, clientY: number) {
    cursorX = clientX;
    cursorY = clientY;
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const nx = Math.max(-1, Math.min(1, (clientX - centerX) / (centerX || 1)));
    const ny = Math.max(-1, Math.min(1, -(clientY - centerY) / (centerY || 1)));
    normalizedX = Math.max(0, Math.min(1, 0.5 + nx * 0.5));
    normalizedY = Math.max(0, Math.min(1, 0.5 + ny * 0.5));
  }

  document.addEventListener("mousemove", (event) => {
    updateCursorPosition(event.clientX, event.clientY);
  });

  document.addEventListener("touchmove", (event) => {
    if (event.touches.length > 0) {
      updateCursorPosition(event.touches[0].clientX, event.touches[0].clientY);
    }
  });

  let isDragging = false;
  let dragData: any = null;
  let dragStartPos: any = null;

  holder.on("pointerdown", (e) => {
    isDragging = true;
    dragData = e.data;
    dragStartPos = e.data.getLocalPosition(holder.parent);
    holder.alpha = 0.95;
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

  const holderPosition = new PIXI.Point(holder.x, holder.y);
  let autoShootInterval: any | null = null;
  const shootDelay = 170;

  const physicsUI = new PhysicsUI(
    app,
    state.spineboy,
    state.physicsBones,
    state.animationMixController,
    globalSettings,
    holder,
    availableModels,
    currentModel,
    async (newModel: string) => {
      console.log(
        `[UI] Request to change model from ${currentModel} to ${newModel}`
      );
      currentModel = newModel;
      const success = await initializeModel(currentModel);

      if (success) {
        console.log(`[UI] Model ${currentModel} initialized, updating UI`);
        // Обновляем UI
        physicsUI.updateModel(
          state.spineboy,
          state.physicsBones,
          state.animationMixController
        );
        console.log(`[UI] UI updated with new model ${currentModel}`);
      } else {
        console.error(`[UI] Failed to initialize model ${currentModel}`);
      }
    }
  );

  function performShoot() {
    if (!state.spineboy) return;

    const fireTrack = state.spineboy.state.getCurrent(7);
    if (
      fireTrack &&
      fireTrack.animation &&
      fireTrack.animation.name === "aim_fire"
    ) {
      return;
    }

    const trackEntry = state.spineboy.state.setAnimation(7, "aim_fire", false);
    trackEntry.alpha = 1;
    trackEntry.timeScale = 0.35;
    state.physicsBones.forEach((bone) => bone.applyRandomForce());
    if (physicsUI.soundEnabled) {
      const sound = new Audio(
        basePath + `/slap${Math.floor(Math.random() * 2)}.wav`
      );
      sound.play();
    }
    trackEntry.listener = {
      complete: () => {
        state.spineboy?.state.setEmptyAnimation(7, 0.1);
      },
      start: () => {},
    };
  }

  document.addEventListener("mousedown", () => {
    performShoot();
    autoShootInterval = setInterval(performShoot, shootDelay);
  });

  document.addEventListener("keydown", (e) => {
    if (e.code !== "Space") return;
  });

  document.addEventListener("mouseup", () => {
    if (autoShootInterval) {
      clearInterval(autoShootInterval);
      autoShootInterval = null;
    }
  });

  document.addEventListener("mouseleave", () => {
    if (autoShootInterval) {
      clearInterval(autoShootInterval);
      autoShootInterval = null;
    }
  });

  app.ticker.add((dt: number) => {
    const deltaTime = app.ticker.deltaMS / 1000;
    const currentTime = Date.now();

    // Проверяем, идет ли загрузка новой модели
    if (state.isLoading) {
      return;
    }

    // Проверяем, есть ли спайн на сцене
    if (!state.spineboy || !holder.children.includes(state.spineboy)) {
      console.warn("[TICKER] Spineboy not found in holder or is null");
      return;
    }

    state.spineboy.update(deltaTime);

    if (state.animationMixController) {
      state.animationMixController.update(currentTime);
    }

    const currentAimXEntry = state.spineboy.state.getCurrent(1);
    const currentAimYEntry = state.spineboy.state.getCurrent(2);

    const distanceX = Math.abs(normalizedX - 0.5) * 1;
    const distanceY = Math.abs(normalizedY - 0.5) * 1;
    const baseWeightX = 0.5 + distanceX * 0.5;
    const baseWeightY = 0.5 + distanceY * 0.5;
    const cornerBoostX = distanceX * distanceY;
    const cornerBoostY = distanceX * distanceY;
    const weightX = Math.min(2, baseWeightX + cornerBoostX);
    const weightY = Math.min(2, baseWeightY + cornerBoostY);

    if (currentAimXEntry && currentAimXEntry.animation) {
      const dur = currentAimXEntry.animation.duration || 1;
      currentAimXEntry.trackTime = normalizedX * dur;
      currentAimXEntry.alpha = weightX;
    }

    if (currentAimYEntry && currentAimYEntry.animation) {
      const dur = currentAimYEntry.animation.duration || 1;
      currentAimYEntry.trackTime = normalizedY * dur;
      currentAimYEntry.alpha = weightY;
    }

    for (const bone of state.physicsBones) {
      bone.computePureWorldTransform();
    }

    state.spineboy.skeleton.updateWorldTransform();

    for (const bone of state.physicsBones) {
      bone.update(deltaTime, holderPosition);
    }

    if (state.boneVisualizer) {
      state.boneVisualizer.update();
    }
  });

  app.ticker.speed = 1;

  window.addEventListener("resize", () => {
    holder.x = app.screen.width / 2;
    holder.y = app.screen.height / 2;
  });
}

init();
