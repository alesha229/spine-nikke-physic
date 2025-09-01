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
    holder
  ) {
    this.app = app;
    this.holder = holder; // Добавляем ссылку на holder
    this.focusMarker = null;
    this.spineboy = spineboy;
    this.physicsBones = physicsBones;
    this.animationMixController = animationMixController;
    this.globalSettings = globalSettings;

    this.uiContainer = null;
    this.isUIVisible = true;

    this.initUI();
  }

  initUI() {
    // Создаем контейнер для UI
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

    // Добавляем заголовок
    const title = document.createElement("h3");
    title.textContent = "Spine Physics Settings";
    title.style.marginTop = "0";
    this.uiContainer.appendChild(title);

    // Кнопка показа/скрытия UI
    const toggleBtn = document.createElement("button");
    toggleBtn.textContent = "Hide UI";
    toggleBtn.style.marginBottom = "10px";
    toggleBtn.onclick = () => this.toggleUI();
    this.uiContainer.appendChild(toggleBtn);

    // Создаем элементы управления
    this.createGlobalControls();
    this.createAnimationControls();
    // this.createBoneSpecificControls();
  }

  createGlobalControls() {
    const sectionTitle = document.createElement("h4");
    sectionTitle.textContent = "Global Settings";
    this.uiContainer.appendChild(sectionTitle);

    // Масштаб персонажа
    this.createSlider("Scale", 0.1, 2, 0.1, this.spineboy.scale.x, (value) => {
      this.spineboy.scale.set(value);
    });

    // Max Force
    this.createSlider(
      "Max Force",
      100,
      10000,
      100,
      this.globalSettings.maxForce,
      (value) => {
        this.globalSettings.maxForce = value;
      }
    );

    // Max Speed
    this.createSlider(
      "Max Speed",
      100,
      10000,
      100,
      this.globalSettings.maxSpeed,
      (value) => {
        this.globalSettings.maxSpeed = value;
      }
    );

    // Physics Strength Multiplier
    this.createSlider(
      "Physics Strength",
      0.1,
      10,
      0.1,
      this.globalSettings.physicsStrengthMultiplier,
      (value) => {
        this.globalSettings.physicsStrengthMultiplier = value;
      }
    );
  }

  createAnimationControls() {
    const sectionTitle = document.createElement("h4");
    sectionTitle.textContent = "Animation Controls";
    this.uiContainer.appendChild(sectionTitle);

    // Получаем список всех анимаций
    const animations = this.spineboy.spineData.animations.map(
      (anim) => anim.name
    );

    // Выбор анимации
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

    // Устанавливаем текущую анимацию по умолчанию
    if (this.animationMixController.config.animations.length > 0) {
      animSelect.value = this.animationMixController.config.animations[0].name;
    }

    animSelect.addEventListener("change", () => {
      this.animationMixController.updateAnimation(1, {
        name: animSelect.value,
      });
    });

    this.uiContainer.appendChild(animSelect);

    // Задержка анимации

    // Вес анимации
    if (this.animationMixController.config.animations.length > 0) {
      const initialWeight =
        this.animationMixController.config.animations[0].weight || 1;
      this.createSlider(
        "Animation Weight",
        0,
        1,
        0.1,
        initialWeight,
        (value) => {
          this.animationMixController.updateAnimation(1, { weight: value });

          // Немедленно применяем изменение веса
          const trackEntry = this.spineboy.state.getCurrent(1);
          if (trackEntry) {
            trackEntry.alpha = value;
          }
        }
      );
    }

    // Скорость анимации
    if (this.animationMixController.config.animations.length > 0) {
      const initialTimeScale =
        this.animationMixController.config.animations[0].timeScale || 1;
      this.createSlider(
        "Animation Speed",
        0.1,
        2,
        0.1,
        initialTimeScale,
        (value) => {
          this.animationMixController.updateAnimation(1, { timeScale: value });

          // Немедленно применяем изменение скорости
          const trackEntry = this.spineboy.state.getCurrent(1);
          if (trackEntry) {
            trackEntry.timeScale = value;
          }
        }
      );
    }
  }

  createBoneSpecificControls() {
    const sectionTitle = document.createElement("h4");
    sectionTitle.textContent = "Bone Specific Settings";
    this.uiContainer.appendChild(sectionTitle);

    // Выбор кости
    const boneSelectLabel = document.createElement("label");
    boneSelectLabel.textContent = "Select Bone: ";
    boneSelectLabel.style.display = "block";
    boneSelectLabel.style.marginTop = "10px";
    this.uiContainer.appendChild(boneSelectLabel);

    const boneSelect = document.createElement("select");
    boneSelect.style.width = "100%";
    boneSelect.style.marginBottom = "10px";

    this.physicsBones.forEach((bone) => {
      const option = document.createElement("option");
      option.value = bone.bone.data.name;
      option.textContent = bone.bone.data.name;
      boneSelect.appendChild(option);
    });

    this.uiContainer.appendChild(boneSelect);

    // Кнопка для фокусировки на кости
    const focusButton = document.createElement("button");
    focusButton.textContent = "Focus on Bone";
    focusButton.style.marginBottom = "10px";
    focusButton.style.width = "100%";
    this.uiContainer.appendChild(focusButton);

    // Контейнер для настроек выбранной кости
    const boneSettingsContainer = document.createElement("div");
    boneSettingsContainer.id = "bone-settings";
    this.uiContainer.appendChild(boneSettingsContainer);

    // Функция для фокусировки на кости
    const focusOnBone = (boneName) => {
      const bone = this.physicsBones.find((b) => b.bone.data.name === boneName);
      if (bone) {
        // Создаем временный маркер для визуального выделения кости
        this.removeFocusMarker();

        const marker = new PIXI.Graphics();
        marker.beginFill(0xff0000, 0.5);
        marker.drawCircle(0, 0, 15);
        marker.endFill();
        marker.x = bone.bone.worldX;
        marker.y = bone.bone.worldY;

        // Добавляем маркер на сцену
        this.app.stage.addChild(marker);
        this.focusMarker = marker;

        // Анимируем маркер
        this.animateMarker(marker);

        // Центрируем viewport на кости (если нужно)
        this.holder.x = this.app.screen.width / 2 - bone.bone.worldX;
        this.holder.y = this.app.screen.height / 2 - bone.bone.worldY;
      }
    };

    // Анимация маркера
    this.animateMarker = (marker) => {
      let scale = 1;
      let growing = false;

      const animate = () => {
        if (growing) {
          scale += 0.02;
          if (scale >= 1.2) growing = false;
        } else {
          scale -= 0.02;
          if (scale <= 0.8) growing = true;
        }

        marker.scale.set(scale);

        if (this.focusMarker === marker) {
          requestAnimationFrame(animate);
        }
      };

      animate();
    };

    // Удаление маркера
    this.removeFocusMarker = () => {
      if (this.focusMarker) {
        this.app.stage.removeChild(this.focusMarker);
        this.focusMarker.destroy();
        this.focusMarker = null;
      }
    };

    // Обработчики событий
    focusButton.addEventListener("click", () => {
      focusOnBone(boneSelect.value);
    });

    boneSelect.addEventListener("change", () => {
      this.updateBoneSettingsUI(boneSelect.value, boneSettingsContainer);
      focusOnBone(boneSelect.value);
    });

    // Инициализируем UI для первой кости
    if (this.physicsBones.length > 0) {
      this.updateBoneSettingsUI(boneSelect.value, boneSettingsContainer);
      focusOnBone(boneSelect.value);
    }
  }
  updateBoneSettingsUI(boneName, container) {
    // Очищаем контейнер
    container.innerHTML = "";

    // Находим выбранную кость
    const bone = this.physicsBones.find((b) => b.bone.data.name === boneName);
    if (!bone) return;

    // Создаем элементы управления для каждой настройки
    Object.keys(bone.settings).forEach((key) => {
      if (typeof bone.settings[key] === "number" && !key.includes("Color")) {
        // Определяем диапазон значений в зависимости от параметра
        let min = 0;
        let max = 10;
        let step = 0.1;

        if (key.includes("Damping")) {
          max = 5;
        } else if (key.includes("Shiftiness")) {
          max = 20;
        } else if (key.includes("Mass")) {
          max = 100;
        } else if (key.includes("Limit")) {
          max = 360;
          step = 1;
        }

        this.createSlider(
          key,
          min,
          max,
          step,
          bone.settings[key],
          (value) => {
            bone.settings[key] = value;
          },
          container
        );
      } else if (typeof bone.settings[key] === "boolean") {
        this.createCheckbox(
          key,
          bone.settings[key],
          (value) => {
            bone.settings[key] = value;
          },
          container
        );
      }
    });
  }

  createSlider(label, min, max, step, value, onChange, container = null) {
    if (!container) container = this.uiContainer;

    const sliderContainer = document.createElement("div");
    sliderContainer.style.marginBottom = "10px";

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

  createCheckbox(label, checked, onChange, container = null) {
    if (!container) container = this.uiContainer;

    const checkboxContainer = document.createElement("div");
    checkboxContainer.style.marginBottom = "10px";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = checked;
    checkbox.id = `checkbox-${label}`;

    const checkboxLabel = document.createElement("label");
    checkboxLabel.textContent = label;
    checkboxLabel.htmlFor = `checkbox-${label}`;
    checkboxLabel.style.marginLeft = "5px";

    checkbox.addEventListener("change", () => {
      onChange(checkbox.checked);
    });

    checkboxContainer.appendChild(checkbox);
    checkboxContainer.appendChild(checkboxLabel);
    container.appendChild(checkboxContainer);
  }

  toggleUI() {
    this.isUIVisible = !this.isUIVisible;
    this.uiContainer.style.display = this.isUIVisible ? "block" : "none";

    const toggleBtn = this.uiContainer.querySelector("button");
    toggleBtn.textContent = this.isUIVisible ? "Hide UI" : "Show UI";
  }

  destroy() {
    if (this.uiContainer && this.uiContainer.parentNode) {
      this.uiContainer.parentNode.removeChild(this.uiContainer);
    }
    this.removeFocusMarker();
  }
}
