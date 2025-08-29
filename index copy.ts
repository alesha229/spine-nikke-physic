import * as PIXI from "pixi.js";
import { Spine } from "@pixi-spine/all-4.1";

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

  const styles = `
    #editor-panel {
        position: fixed;
        top: 10px;
        right: 10px;
        width: 400px;
        height: 90vh;
        background: rgba(30, 30, 30, 0.9);
        color: #fff;
        font-family: monospace;
        font-size: 12px;
        z-index: 1000;
        overflow: auto;
        padding: 10px;
        border: 1px solid #555;
    }
    .prop-row {
        display: flex;
        align-items: center;
        margin-bottom: 2px;
    }
    .prop-key {
        color: #9cdcfe;
        margin-right: 5px;
        width: 120px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        cursor: pointer;
    }
    .prop-key:hover {
        text-decoration: underline;
    }
    .prop-value {
        flex-grow: 1;
        background: #444;
        border: 1px solid #555;
        color: #ce9178;
        padding: 2px 4px;
        min-width: 0;
    }
    .prop-value:focus {
        background: #555;
        outline: none;
    }
    .object-container {
        padding-left: 15px;
        border-left: 1px solid #444;
        margin-top: 5px;
    }
    .toggle {
        font-size: 10px;
        margin-right: 5px;
        cursor: pointer;
    }
    .execute-btn {
        background: #337ab7;
        color: white;
        border: none;
        padding: 4px 8px;
        cursor: pointer;
        font-size: 10px;
    }
  `;
  const styleSheet = document.createElement("style");
  styleSheet.innerText = styles;
  document.head.appendChild(styleSheet);

  const editorPanel = document.createElement("div");
  editorPanel.id = "editor-panel";
  document.body.appendChild(editorPanel);

  const resource = await PIXI.Assets.load({
    alias: "spineboy-data",
    src: "./c850_aim_00.skel",
  });
  const spineData = resource.spineData;
  const spineboy = new Spine(spineData);
  spineboy.x = 0;
  spineboy.y = 400;
  spineboy.scale.set(0.5);

  let holder = new PIXI.Container();
  holder.x = app.screen.width / 2;
  holder.y = app.screen.height / 2;
  holder.addChild(spineboy);
  app.stage.addChild(holder);
  spineboy.state.setAnimation(0, "aim_idle", true);

  const visitedObjects = new WeakSet();

  function renderObjectTree(rootObj, obj, parentElement) {
    if (visitedObjects.has(obj)) {
      parentElement.innerHTML = '<span style="color:red">[Circular]</span>';
      return;
    }
    visitedObjects.add(obj);

    for (const key in obj) {
      if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
      const value = obj[key];
      const type = typeof value;

      const propRow = document.createElement("div");
      propRow.className = "prop-row";

      if (value === null || value === undefined) {
        propRow.innerHTML = `<span class="prop-key">${key}:</span> <span class="prop-value">${
          value === null ? "null" : "undefined"
        }</span>`;
        parentElement.appendChild(propRow);
      } else if (type === "object") {
        const toggle = document.createElement("span");
        toggle.innerText = "▶";
        toggle.className = "toggle";
        propRow.appendChild(toggle);

        const keySpan = document.createElement("span");
        keySpan.className = "prop-key";
        if (value.constructor && value.constructor.name) {
          keySpan.innerText = `${key}: ${value.constructor.name}`;
        } else {
          keySpan.innerText = `${key}: (Object)`;
        }
        propRow.appendChild(keySpan);
        parentElement.appendChild(propRow);

        const childContainer = document.createElement("div");
        childContainer.className = "object-container";
        childContainer.style.display = "none";
        parentElement.appendChild(childContainer);

        toggle.addEventListener("click", () => {
          if (childContainer.style.display === "none") {
            childContainer.style.display = "block";
            toggle.innerText = "▼";
            childContainer.innerHTML = "";
            renderObjectTree(rootObj, value, childContainer);
          } else {
            childContainer.style.display = "none";
            toggle.innerText = "▶";
          }
        });
      } else if (type === "function") {
        // Добавляем кнопку "Выполнить" для функций
        const keySpan = document.createElement("span");
        keySpan.className = "prop-key";
        keySpan.innerText = `${key}: function`;
        propRow.appendChild(keySpan);

        const executeBtn = document.createElement("button");
        executeBtn.className = "execute-btn";
        executeBtn.innerText = "Выполнить";
        propRow.appendChild(executeBtn);
        parentElement.appendChild(propRow);

        executeBtn.addEventListener("click", () => {
          console.log(`Executing function: ${key}`);
          try {
            const result = value.call(obj);
            console.log("Function result:", result);
            // Если функция изменяет состояние, обновляем Spine
            rootObj.update(0);
          } catch (err) {
            console.error("Function execution failed:", err);
          }
        });
      } else {
        const keySpan = document.createElement("span");
        keySpan.className = "prop-key";
        keySpan.innerText = `${key}:`;
        propRow.appendChild(keySpan);

        const valueInput = document.createElement("input");
        valueInput.type = "text";
        valueInput.className = "prop-value";
        valueInput.value = value.toString();
        propRow.appendChild(valueInput);
        parentElement.appendChild(propRow);

        valueInput.addEventListener("change", (e) => {
          const newValue = (e.target as HTMLInputElement).value;
          try {
            let parsedValue;
            if (
              !isNaN(parseFloat(newValue)) &&
              isFinite(parseFloat(newValue))
            ) {
              parsedValue = parseFloat(newValue);
            } else if (newValue === "true") {
              parsedValue = true;
            } else if (newValue === "false") {
              parsedValue = false;
            } else {
              parsedValue = newValue;
            }

            obj[key] = parsedValue;
            rootObj.update(0);
          } catch (err) {
            console.error("Failed to parse value:", err);
          }
        });
      }
    }
  }

  const spineboyHeader = document.createElement("h3");
  spineboyHeader.innerText = "Spineboy Object";
  editorPanel.appendChild(spineboyHeader);
  console.log(spineboy);
  renderObjectTree(spineboy, spineboy, editorPanel);

  window.addEventListener("resize", () => {
    holder.x = app.screen.width / 2;
    holder.y = app.screen.height / 2;
  });
}

init();
