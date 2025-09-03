// ui.ts
//@ts-nocheck
import * as PIXI from "pixi.js";

export class PhysicsUI {
  constructor(
    app,
    spineboy,
    physicsBones,
    animationMixController,
    globalSettings,
    holder,
    availableModels,
    currentModel,
    onModelChange
  ) {
    this.app = app;
    this.holder = holder;
    this.focusMarker = null;
    this.spineboy = spineboy;
    this.physicsBones = physicsBones;
    this.animationMixController = animationMixController;
    this.globalSettings = globalSettings;
    this.uiContainer = null;
    this.isUIVisible = true;
    this.availableModels = availableModels;
    this.currentModel = currentModel;
    this.onModelChange = onModelChange;
    this.soundEnabled = true;
    this.initUI();
  }

  initUI() {
    this.uiContainer = document.createElement("div");
    this.uiContainer.style.position = "fixed";
    this.uiContainer.style.top = "10px";
    this.uiContainer.style.left = "10px";
    this.uiContainer.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
    this.uiContainer.style.color = "white";
    this.uiContainer.style.padding = "15px";
    this.uiContainer.style.borderRadius = "5px";
    this.uiContainer.style.fontFamily = "Arial, sans-serif";
    this.uiContainer.style.zIndex = "1000";
    this.uiContainer.style.maxWidth = "300px";
    document.body.appendChild(this.uiContainer);

    const title = document.createElement("h3");
    title.textContent = "Spine Physics Settings";
    title.style.marginTop = "0";
    this.uiContainer.appendChild(title);

    const toggleBtn = document.createElement("button");
    toggleBtn.textContent = "Hide UI";
    toggleBtn.style.marginBottom = "10px";
    toggleBtn.onclick = () => this.toggleUI();
    this.uiContainer.appendChild(toggleBtn);

    // Добавляем селектор модели
    this.createModelSelector();

    this.createGlobalControls();
    this.createAnimationControls();
  }

  createModelSelector() {
    console.log("[UI] Creating model selector");

    const sectionTitle = document.createElement("h4");
    sectionTitle.textContent = "Model Selection";
    this.uiContainer.appendChild(sectionTitle);

    const modelSelect = document.createElement("select");
    modelSelect.style.width = "100%";
    modelSelect.style.marginBottom = "10px";

    this.availableModels.forEach((modelName) => {
      const option = document.createElement("option");
      option.value = modelName;
      option.textContent = modelName;
      if (modelName === this.currentModel) {
        option.selected = true;
      }
      modelSelect.appendChild(option);
    });

    modelSelect.addEventListener("change", () => {
      const selectedModel = modelSelect.value;
      console.log(`[UI] Model selection changed to ${selectedModel}`);
      if (selectedModel !== this.currentModel) {
        this.currentModel = selectedModel;
        console.log(`[UI] Calling onModelChange with ${selectedModel}`);
        this.onModelChange(selectedModel);
      } else {
        console.log(
          `[UI] Model selection didn't change (still ${selectedModel})`
        );
      }
    });

    this.uiContainer.appendChild(modelSelect);
    console.log("[UI] Model selector created");
  }

  createGlobalControls() {
    const sectionTitle = document.createElement("h4");
    sectionTitle.textContent = "Global Settings";
    this.uiContainer.appendChild(sectionTitle);

    this.createSlider("Scale", 0.1, 2, 0.1, this.spineboy.scale.x, (value) => {
      if (this.spineboy) this.spineboy.scale.set(value);
    });
    this.createSlider(
      "Max Force",
      100,
      20000,
      100,
      this.globalSettings.maxForce,
      (value) => {
        this.globalSettings.maxForce = value;
      }
    );

    this.createSlider(
      "Max Speed",
      100,
      20000,
      100,
      this.globalSettings.maxSpeed,
      (value) => {
        this.globalSettings.maxSpeed = value;
      }
    );

    this.createSlider(
      "Physics Strength",
      0.05,
      1.5,
      0.05,
      this.globalSettings.physicsStrengthMultiplier,
      (value) => {
        this.globalSettings.physicsStrengthMultiplier = value;
      }
    );
    this.createCheckbox("No sound", !this.soundEnabled, (checked) => {
      this.soundEnabled = !checked; // checked = true → звук выключен
    });
  }
  createCheckbox(
    label: string,
    initial: boolean,
    onChange: (val: boolean) => void,
    container?: HTMLElement
  ) {
    if (!container) container = this.uiContainer;
    const wrap = document.createElement("div");
    wrap.style.marginBottom = "10px";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = initial;
    cb.id = `cb-${label.replace(/\s+/g, "-")}`;

    const lbl = document.createElement("label");
    lbl.htmlFor = cb.id;
    lbl.textContent = label;
    lbl.style.marginLeft = "6px";

    cb.addEventListener("change", () => onChange(cb.checked));

    wrap.appendChild(cb);
    wrap.appendChild(lbl);
    container.appendChild(wrap);
  }
  createAnimationControls() {
    console.log("[UI] Creating animation controls");
    console.log("[UI] spineboy exists:", this.spineboy ? "yes" : "no");
    console.log(
      "[UI] spineboy.spineData exists:",
      this.spineboy && this.spineboy.spineData ? "yes" : "no"
    );

    const sectionTitle = document.createElement("h4");
    sectionTitle.textContent = "Animation Controls";
    this.uiContainer.appendChild(sectionTitle);

    if (!this.spineboy || !this.spineboy.spineData) {
      console.warn(
        "[UI] Spineboy or spineData is null, skipping animation controls"
      );
      return;
    }

    const animations = this.spineboy.spineData.animations.map(
      (anim) => anim.name
    );
    console.log("[UI] Available animations:", animations);

    const animSelectLabel = document.createElement("label");
    animSelectLabel.textContent = "Select Animation: ";
    animSelectLabel.style.display = "block";
    animSelectLabel.style.marginTop = "10px";
    this.uiContainer.appendChild(animSelectLabel);

    const animSelect = document.createElement("select");
    animSelect.style.width = "100%";
    animSelect.style.marginBottom = "10px";
    animations.forEach((animName) => {
      const option = document.createElement("option");
      option.value = animName;
      option.textContent = animName;
      animSelect.appendChild(option);
    });

    if (
      this.animationMixController &&
      this.animationMixController.config.animations.length > 0
    ) {
      animSelect.value = this.animationMixController.config.animations[0].name;
    }

    animSelect.addEventListener("change", () => {
      if (this.animationMixController) {
        this.animationMixController.updateAnimation(6, {
          name: animSelect.value,
        });
      }
    });

    this.uiContainer.appendChild(animSelect);

    if (
      this.animationMixController &&
      this.animationMixController.config.animations.length > 0
    ) {
      const initialWeight =
        this.animationMixController.config.animations[0].weight || 1;
      this.createSlider(
        "Animation Weight",
        0,
        1,
        0.1,
        initialWeight,
        (value) => {
          if (this.animationMixController) {
            this.animationMixController.updateAnimation(6, { weight: value });
          }
          if (this.spineboy) {
            const trackEntry = this.spineboy.state.getCurrent(1);
            if (trackEntry) {
              trackEntry.alpha = value;
            }
          }
        }
      );
    }

    if (
      this.animationMixController &&
      this.animationMixController.config.animations.length > 0
    ) {
      const initialTimeScale =
        this.animationMixController.config.animations[0].timeScale || 1;
      this.createSlider(
        "Animation Speed",
        0.1,
        2,
        0.1,
        initialTimeScale,
        (value) => {
          if (this.animationMixController) {
            this.animationMixController.updateAnimation(6, {
              timeScale: value,
            });
          }
          if (this.spineboy) {
            const trackEntry = this.spineboy.state.getCurrent(1);
            if (trackEntry) {
              trackEntry.timeScale = value;
            }
          }
        }
      );
    }

    console.log("[UI] Animation controls created");
  }

  createSlider(label, min, max, step, value, onChange, container = null) {
    if (!container) container = this.uiContainer;
    const sliderContainer = document.createElement("div");
    sliderContainer.style.marginBottom = "10px";
    sliderContainer.className = "slider-container";

    const sliderLabel = document.createElement("label");
    sliderLabel.textContent = `${label}: ${value}`;
    sliderLabel.style.display = "block";
    sliderLabel.style.marginBottom = "5px";

    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = min;
    slider.max = max;
    slider.step = step;
    slider.value = value;
    slider.style.width = "100%";

    slider.addEventListener("input", () => {
      const numValue = parseFloat(slider.value);
      sliderLabel.textContent = `${label}: ${numValue.toFixed(2)}`;
      onChange(numValue);
    });

    sliderContainer.appendChild(sliderLabel);
    sliderContainer.appendChild(slider);
    container.appendChild(sliderContainer);
  }

  toggleUI() {
    this.isUIVisible = !this.isUIVisible;
    this.uiContainer.style.display = this.isUIVisible ? "block" : "none";
    const toggleBtn = this.uiContainer.querySelector("button");
    toggleBtn.textContent = this.isUIVisible ? "Hide UI" : "Show UI";
  }

  // Обновленный метод для смены модели
  updateModel(newSpineboy, newPhysicsBones, newAnimationMixController) {
    console.log("[UI] updateModel called");
    console.log("[UI] newSpineboy:", newSpineboy ? "exists" : "null");
    console.log(
      "[UI] newPhysicsBones length:",
      newPhysicsBones ? newPhysicsBones.length : "null"
    );
    console.log(
      "[UI] newAnimationMixController:",
      newAnimationMixController ? "exists" : "null"
    );

    this.spineboy = newSpineboy;
    this.physicsBones = newPhysicsBones;
    this.animationMixController = newAnimationMixController;

    // Обновляем селектор модели
    const modelSelect = this.uiContainer.querySelector("select");
    if (modelSelect) {
      modelSelect.value = this.currentModel;
      console.log(`[UI] Model select updated to ${this.currentModel}`);
    } else {
      console.error("[UI] Model select not found");
    }

    // Пересоздаем контроллеры анимаций
    console.log("[UI] Recreating animation controls");
    this.recreateAnimationControls();

    console.log("[UI] Model references updated");
  }

  // Пересоздание контроллеров анимаций
  recreateAnimationControls() {
    console.log("[UI] recreateAnimationControls called");

    // Находим и удаляем секцию контроллеров анимаций
    const animationSection = Array.from(this.uiContainer.children).find(
      (child) =>
        child.textContent && child.textContent.includes("Animation Controls")
    );

    if (animationSection) {
      console.log(
        "[UI] Found existing animation controls section, removing it"
      );
      // Удаляем все элементы после секции анимаций до следующей секции или конца
      let nextElement = animationSection.nextElementSibling;
      while (
        nextElement &&
        !nextElement.textContent.includes("Model Selection") &&
        !nextElement.textContent.includes("Global Settings")
      ) {
        const toRemove = nextElement;
        nextElement = nextElement.nextElementSibling;
        toRemove.remove();
      }
      animationSection.remove();
      console.log("[UI] Animation controls section removed");
    } else {
      console.log("[UI] Animation controls section not found");
    }

    // Создаем новые контроллеры анимаций
    console.log("[UI] Creating new animation controls");
    this.createAnimationControls();
  }

  destroy() {
    if (this.uiContainer && this.uiContainer.parentNode) {
      this.uiContainer.parentNode.removeChild(this.uiContainer);
    }
    this.removeFocusMarker();
  }
}
