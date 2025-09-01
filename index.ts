//index.ts

import * as PIXI from "pixi.js";
import { Spine } from "@pixi-spine/all-4.1";
import { PhysicsUI } from "./src/ui"; // Импортируем UI модуль
import {
  AnimationMixController,
  AnimationMixConfig,
} from "./src/animation-mix-controller";
import { BonePhysics } from "./src/bonePhysics";
import { PhysicsConfig, PhysicsSettings } from "./src/physics-config";
import { AdvancedBoneVisualizer } from "./src/advancedBoneVisualizer";
const globalSettings = {
  maxForce: 500,
  maxSpeed: 1000,
  physicsStrengthMultiplier: 1.5,
};

const basePath =
  window.location.hostname === "localhost" ? "" : "/spine-nikke-physic";

function getBoneDepth(bone: any): number {
  let depth = 0;
  let current = bone;
  while (current.parent) {
    depth++;
    current = current.parent;
  }
  return depth;
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
    src: basePath + "/c850_aim_00.skel",
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
  const spineboyAnimate = new Spine(spineData);
  const spineboyWithPhysic = new Spine(spineData);
  spineboyAnimate.x = 0;
  spineboyAnimate.y = 400;
  spineboyAnimate.scale.set(0.5);

  holder.addChild(spineboyAnimate);
  spineboyWithPhysic.x = 0;
  spineboyWithPhysic.y = 400;
  spineboyWithPhysic.scale.set(0.5);

  holder.addChild(spineboyWithPhysic);
  app.stage.addChild(holder);
  spineboyAnimate.visible = false;
  holder.eventMode = "static";
  holder.cursor = "pointer";

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

  const physicsConfig: PhysicsConfig = await fetch(
    basePath + "/aim-physics.json"
  ).then((res) => res.json());

  const physicsBones: BonePhysics[] = [];
  const physicsBoneNames = Object.keys(
    physicsConfig.BoneSpringPhysicsSettingCollection
  );

  const boneVisualizer = new AdvancedBoneVisualizer(app, spineboyWithPhysic); // или создаем копию другим способом

  // В функции, где вы создаете кости физики, добавьте:
  // Создаем физику с ссылками на оба скелета
  for (const bone of spineboyWithPhysic.skeleton.bones) {
    const physicsBone = spineboyWithPhysic.skeleton.findBone(bone.data.name);
    const animationBone = spineboyAnimate.skeleton.findBone(bone.data.name);

    if (physicsBoneNames.includes(bone.data.name)) {
      const settings =
        physicsConfig.BoneSpringPhysicsSettingCollection[bone.data.name];
      const physics = new BonePhysics(
        physicsBone, // Кость для физики (будет изменяться)
        animationBone, // Кость для анимации (всегда чистая)
        settings,
        physicsConfig,
        globalSettings
      );
      // if (bone.data.name.includes("hair")) {
      //   boneVisualizer.addBone(bone.data.name, bone, physics);
      // }
      // boneVisualizer.addBone(bone.data.name, bone, physics);
      physicsBones.push(physics);
      // boneVisualizer.addBone(animationBone.data.name, animationBone);
    }
  }
  const animationMixConfig: AnimationMixConfig = {
    animations: [{ track: 0, name: "aim_idle", delay: 0, loop: true }],
    crossFadeDuration: 0,
  };

  const animationMixController = new AnimationMixController(
    spineboyAnimate,
    animationMixConfig
  );
  const animationMixController2 = new AnimationMixController(
    spineboyWithPhysic,
    animationMixConfig
  );

  const holderPosition = new PIXI.Point(holder.x, holder.y);

  // Добавляем обработчик клика для выстрела
  let autoShootInterval: any | null = null;
  const shootDelay = 200; // Интервал между выстрелами в миллисекундах

  // Создаем UI
  const physicsUI = new PhysicsUI(
    app,
    spineboyWithPhysic,
    physicsBones,
    animationMixController,
    globalSettings,
    holder
  );

  // Функция для выполнения выстрела
  function performShoot() {
    // Применяем случайную силу ко всем костям
    physicsBones.forEach((bone) => {
      // bone.applyTestImpulse(300);
      bone.applyRandomForce();
    });

    // Запускаем анимацию выстрела
    const trackEntry = spineboyAnimate.state.setAnimation(2, "aim_fire", false);
    trackEntry.alpha = 1;
    trackEntry.timeScale = 0.4;

    // Устанавливаем слушатель для завершения анимации
    trackEntry.listener = {
      complete: () => {
        // После завершения анимации устанавливаем пустую анимацию на трек 2
        spineboyAnimate.state.setEmptyAnimation(2, 0.1);
      },
    };
    const trackEntry1 = spineboyWithPhysic.state.setAnimation(
      2,
      "aim_fire",
      false
    );
    trackEntry1.alpha = 1;
    trackEntry1.timeScale = 0.4;

    // Устанавливаем слушатель для завершения анимации
    trackEntry1.listener = {
      complete: () => {
        // После завершения анимации устанавливаем пустую анимацию на трек 2
        spineboyWithPhysic.state.setEmptyAnimation(2, 0.1);
      },
    };
  }

  // Обработчик нажатия мыши
  document.addEventListener("mousedown", () => {
    // Запускаем первый выстрел сразу
    performShoot();

    // Устанавливаем интервал для повторяющихся выстрелов
    autoShootInterval = setInterval(performShoot, shootDelay);
  });

  // Обработчик отпускания мыши
  document.addEventListener("mouseup", () => {
    // Очищаем интервал при отпускании мыши
    if (autoShootInterval) {
      clearInterval(autoShootInterval);
      autoShootInterval = null;
    }
  });

  // Также добавим обработчик для случая, когда курсор выходит за пределы окна
  document.addEventListener("mouseleave", () => {
    if (autoShootInterval) {
      clearInterval(autoShootInterval);
      autoShootInterval = null;
    }
  });

  // Сортируем кости по глубине
  physicsBones.sort((a, b) => {
    const depthA = getBoneDepth(a);
    const depthB = getBoneDepth(b);
    return depthA - depthB;
  });

  // Создаем параллельный скелет только для отслеживания анимации
  let debugCounter = 0;
  // В тикере:
  app.ticker.add((dt: number) => {
    const deltaTime = app.ticker.deltaMS / 1000;

    // 1. Обновляем ПАРАЛЛЕЛЬНЫЙ скелет для чистой анимации
    spineboyAnimate.update(deltaTime); // или копируем состояние
    animationMixController.update(Date.now()); // применяем анимацию
    spineboyAnimate.skeleton.updateWorldTransform();

    // 2. Обновляем основной скелет с анимацией
    spineboyWithPhysic.update(deltaTime);
    animationMixController2.update(Date.now());
    spineboyWithPhysic.skeleton.updateWorldTransform();

    // 3. Физика использует animationBone для получения чистых целей
    // 3. Физика использует animationBone для получения чистых целей
    for (const bone of physicsBones) {
      bone.update(deltaTime, holderPosition);
    }

    // ОТЛАДКА: Каждые 2 секунды выводим информацию о костях

    boneVisualizer.update();
  });

  app.ticker.speed = 1;
  window.addEventListener("resize", () => {
    holder.x = app.screen.width / 2;
    holder.y = app.screen.height / 2;
  });
}

init();
