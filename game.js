(() => {
  // src/engine.ts
  var listeners = {};
  function on(event, callback) {
    (listeners[event] = listeners[event] || []).push(callback);
  }
  function off(event, callback) {
    listeners[event] = (listeners[event] || []).filter((cb) => cb !== callback);
  }
  function emit(event, ...args) {
    [...listeners[event] || []].forEach((cb) => cb(...args));
  }
  function collides(a, b) {
    return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  }
  function startLoop({
    update,
    render
  }) {
    const step = 1e3 / 60;
    let last = performance.now();
    let accumulator = 0;
    const frame = (now) => {
      accumulator += Math.min(now - last, 250);
      last = now;
      while (accumulator >= step) {
        update();
        accumulator -= step;
      }
      render();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
  var pressedKeys = /* @__PURE__ */ new Set();
  window.addEventListener("keydown", (event) => pressedKeys.add(event.code));
  window.addEventListener("keyup", (event) => pressedKeys.delete(event.code));
  window.addEventListener("blur", () => pressedKeys.clear());
  function keyPressed(...codes) {
    return codes.some((code) => pressedKeys.has(code));
  }

  // src/stage.ts
  var HEIGHT = 720;
  var MIN_ASPECT = 0.45;
  var MAX_ASPECT = 0.7;
  var Stage = class {
    constructor() {
      this.height = HEIGHT;
      this.width = HEIGHT * 0.5625;
      /** CSS pixels per logical unit. */
      this.scale = 1;
      /** Device pixels per logical unit. */
      this.pixelRatio = 1;
      /** Horizontal center of the playfield, in client (CSS) pixels. */
      this.centerX = 0;
    }
    mount(element) {
      this.element = element;
      this.canvas = document.createElement("canvas");
      this.canvas.setAttribute("aria-label", "Ghost River playfield");
      element.prepend(this.canvas);
      this.ctx = this.canvas.getContext("2d");
      const resize = () => this.resize();
      window.addEventListener("resize", resize);
      window.addEventListener("orientationchange", resize);
      if (window.visualViewport) {
        window.visualViewport.addEventListener("resize", resize);
      }
      this.resize();
    }
    resize() {
      const viewWidth = document.documentElement.clientWidth || window.innerWidth;
      const viewHeight = document.documentElement.clientHeight || window.innerHeight;
      const aspect = Math.min(
        MAX_ASPECT,
        Math.max(MIN_ASPECT, viewWidth / viewHeight)
      );
      this.width = Math.round(HEIGHT * aspect);
      this.scale = Math.min(viewHeight / HEIGHT, viewWidth / this.width);
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      this.pixelRatio = this.scale * dpr;
      const cssWidth = this.width * this.scale;
      const cssHeight = HEIGHT * this.scale;
      const left = (viewWidth - cssWidth) / 2;
      const top = (viewHeight - cssHeight) / 2;
      Object.assign(this.element.style, {
        width: `${cssWidth}px`,
        height: `${cssHeight}px`,
        left: `${left}px`,
        top: `${top}px`
      });
      this.element.style.setProperty("--s", String(this.scale));
      this.centerX = left + cssWidth / 2;
      this.canvas.width = Math.round(this.width * this.pixelRatio);
      this.canvas.height = Math.round(HEIGHT * this.pixelRatio);
      this.canvas.style.width = `${cssWidth}px`;
      this.canvas.style.height = `${cssHeight}px`;
      emit("resize");
    }
    /** Prepares the context for a new frame in logical units. */
    beginFrame() {
      const ctx = this.ctx;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
      return ctx;
    }
    /** Canvas filters are expressed in device pixels: scale them to logical units. */
    px(value) {
      return `${(value * this.pixelRatio).toFixed(2)}px`;
    }
  };
  var stage = new Stage();
  var stage_default = stage;

  // src/types.ts
  var LANGUAGE_NAMES = {
    [0 /* Python */]: "Python",
    [1 /* Javascript */]: "JavaScript",
    [2 /* Ruby */]: "Ruby",
    [3 /* PHP */]: "PHP",
    [4 /* Pascal */]: "Pascal",
    [5 /* Julia */]: "Julia",
    [6 /* Java */]: "Java",
    [7 /* Go */]: "Go",
    [8 /* Typescript */]: "TypeScript",
    [9 /* Dart */]: "Dart",
    [10 /* Kotlin */]: "Kotlin",
    [11 /* Swift */]: "Swift",
    [12 /* C */]: "C",
    [13 /* Malbolge */]: "Malbolge",
    [14 /* HolyC */]: "HolyC",
    [15 /* Assembly */]: "Assembly",
    [16 /* COBOL */]: "COBOL"
  };

  // src/screen.ts
  var Screen = class {
    constructor() {
      this.infoLayer = document.getElementById("info");
    }
    render(newGameStatus, result) {
      if (this.currentGameStatus === newGameStatus) {
        return;
      }
      this.currentGameStatus = newGameStatus;
      const isStandBy = newGameStatus !== 0 /* Play */ && newGameStatus !== 1 /* Pause */;
      this.infoLayer.hidden = !isStandBy;
      document.body.classList.toggle("standby", isStandBy);
      if (newGameStatus === 2 /* Stop */) {
        this.infoLayer.innerHTML = renderNotStarted();
      } else if (newGameStatus === 4 /* GameOver */) {
        this.infoLayer.innerHTML = renderGameOver(result);
      } else if (newGameStatus === 3 /* Complete */) {
        this.infoLayer.innerHTML = renderComplete();
      }
    }
  };
  var title = "<h1>Ghost River</h1>";
  function isTouch() {
    return window.matchMedia("(pointer: coarse)").matches;
  }
  function panel(body, buttonLabel) {
    const hint = isTouch() ? "Tap anywhere to play" : "Click anywhere or press any key to play";
    return `
    <div class="panel">
      ${title}
      ${body}
      <button type="button" class="play" data-action="play">${buttonLabel}</button>
      <p class="hint">${hint}</p>
    </div>
  `;
  }
  function renderNotStarted() {
    const controls = isTouch() ? "Touch and hold the <u>left</u> or <u>right</u> side of the screen to row." : "Hold <u>&larr;</u> / <u>&rarr;</u> (or press the mouse on either side) to row. <u>Space</u> pauses, <u>Esc</u> quits.";
    return panel(
      `
    <p>You are Dante, a developer who died and ended up in <b>Developer's Hell</b>.</p>
    <p>Who knew those <u>silly jokes</u> about JavaScript would bring you here?</p>
    <p>With the help of your mentor Virgilius Torvalds, <i>seek your redemption</i> by sailing the Acheron river through the depths of Programming Hell. Dodge the ghosts across nine levels!</p>
    <p class="controls">${controls}</p>
  `,
      "Start"
    );
  }
  function renderGameOver(result) {
    const stats = result ? `<p class="stats">You fell in level <b>${result.levelNumber}</b> of ${result.levelCount}: <i>${result.levelName} Hell</i>.${result.bestLevel > 0 ? ` Best so far: level ${result.bestLevel}.` : ""}</p>` : "";
    return panel(
      `
    <p>No good! Your soul was consumed by hatred for languages you don't even know.</p>
    <p>You shall stay in Hell refactoring the code you wrote 10 years ago... <b>FOREVER</b>!</p>
    ${stats}
  `,
      "Try again"
    );
  }
  function renderComplete() {
    return panel(
      `
    <p>Congratulations! You crossed the <b>depths of Programming Hell</b> with resilience and perseverance.</p>
    <p>You earned <i>your redemption</i> and may now live your life with kindness and respect for all languages.</p>
    <p class="stats">All <b>9</b> levels cleared!</p>
  `,
      "Play again"
    );
  }

  // src/utils.ts
  function range(count) {
    return Array(count).fill(null).map((_, index) => index);
  }
  function shuffle(inputArray) {
    return [...inputArray].sort(() => Math.random() > 0.5 ? 1 : -1);
  }

  // src/levels/generateLevelParams.ts
  var languagesByTier = [
    [
      0 /* Python */,
      1 /* Javascript */,
      2 /* Ruby */,
      3 /* PHP */,
      4 /* Pascal */,
      5 /* Julia */
    ],
    [
      6 /* Java */,
      7 /* Go */,
      8 /* Typescript */,
      9 /* Dart */,
      10 /* Kotlin */,
      11 /* Swift */
    ],
    [
      12 /* C */,
      13 /* Malbolge */,
      14 /* HolyC */,
      15 /* Assembly */,
      16 /* COBOL */
    ]
  ];
  function* generateLevelsParams(shuffleFunction = shuffle) {
    const baseSpeed = 2;
    const speedIncrement = 0.5;
    const baseFrequency = 1;
    const frequencyDecrement = 0.25;
    const baseMonstersCount = 4;
    const monsterCountIncrement = 3;
    const baseMonsterEasyPct = 80;
    const monsterLevelWeightDecrement = 20;
    for (const tierIndex of range(3)) {
      const languages = shuffleFunction(languagesByTier[tierIndex]);
      for (const levelIndex of range(3)) {
        const monsterEasyPct = baseMonsterEasyPct - monsterLevelWeightDecrement * levelIndex - monsterLevelWeightDecrement * tierIndex;
        yield {
          language: languages[levelIndex],
          speed: baseSpeed + speedIncrement * tierIndex,
          frequency: baseFrequency - frequencyDecrement * levelIndex,
          monsterCount: baseMonstersCount + monsterCountIncrement * tierIndex,
          monsterLevelDistribution: [monsterEasyPct, 100 - monsterEasyPct]
        };
      }
    }
  }

  // src/background.ts
  var COLORS = {
    [0 /* Python */]: "#4B8BBE",
    [1 /* Javascript */]: "#323330",
    [2 /* Ruby */]: "#820C02",
    [3 /* PHP */]: "#6c7eb7",
    [4 /* Pascal */]: "#f7931e",
    [5 /* Julia */]: "#4d64ae",
    [6 /* Java */]: "#ec2024",
    [7 /* Go */]: "#00acd7",
    [8 /* Typescript */]: "#3178c6",
    [9 /* Dart */]: "#00d2b8",
    [10 /* Kotlin */]: "#c757bc",
    [11 /* Swift */]: "#f05138",
    [12 /* C */]: "#6a7582",
    [13 /* Malbolge */]: "#b50500",
    [14 /* HolyC */]: "#c37c2e",
    [15 /* Assembly */]: "#721481",
    [16 /* COBOL */]: "#01325a"
  };
  var shorePath = new Path2D(
    "m 0,2.3e-4 v 300 h 22.456648 c 54.700501,-159.09789 -53.017428,-147.98695 0,-300 z"
  );
  var Background = class {
    constructor(language) {
      this.color = COLORS[language];
      this.shadowY = -1 * stage_default.height;
    }
    render(ctx) {
      ctx.fillStyle = this.color;
      ctx.fillRect(0, 0, stage_default.width, stage_default.height);
      ctx.save();
      ctx.translate(0, this.shadowY);
      renderShadow(ctx);
      ctx.restore();
    }
    update() {
      this.shadowY += 1;
      if (this.shadowY >= 0) {
        this.shadowY = -1 * stage_default.height;
      }
    }
  };
  function renderShadow(ctx) {
    const width = 80;
    const height = 300;
    ctx.scale(stage_default.width / width, stage_default.height / height);
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.fill(shorePath);
    ctx.beginPath();
    ctx.ellipse(100, 100, 50, 75, Math.PI / 4, 0, 2 * Math.PI);
    ctx.fill();
    ctx.translate(0, 300);
    ctx.fill(shorePath);
    ctx.beginPath();
    ctx.ellipse(100, 100, 50, 75, Math.PI / 4, 0, 2 * Math.PI);
    ctx.fill();
  }

  // src/monsters/base.ts
  var pathCache = {};
  function cachedPath(d) {
    return pathCache[d] = pathCache[d] || new Path2D(d);
  }
  var BaseMonster = class {
    constructor({ speed, frequency }) {
      this.width = 49;
      this.height = 70;
      this.nextMonsterCalled = false;
      this.monsterLeftScreen = false;
      // Eyes parameters for subclasses
      this.defaultEyeRotation = 1 /* Direct */;
      this.eyesLeft = 15;
      this.eyesTop = 15;
      this.eyesGap = 13;
      this.verticalSpeed = speed;
      this.limitToCallNextMonster = stage_default.height * frequency;
      this.sprite = {
        ...this.getInitialPosition(),
        width: this.width,
        height: this.height
      };
    }
    getInitialPosition() {
      const maxWidth = stage_default.width - this.width;
      return { x: Math.trunc(Math.random() * maxWidth), y: -1 * this.height };
    }
    /** Keeps the ghost inside the river when the screen is resized. */
    fitInStage() {
      this.sprite.x = Math.min(
        Math.max(0, this.sprite.x),
        stage_default.width - this.sprite.width
      );
    }
    render(ctx) {
      ctx.save();
      ctx.translate(this.sprite.x, this.sprite.y);
      this.renderImage(ctx);
      ctx.restore();
    }
    renderImage(ctx) {
      this.setScale(ctx);
      this.placeImage(ctx);
      this.placeEyes(ctx);
      this.placeShadow(ctx);
    }
    setScale(ctx) {
      ctx.scale(1.4, 1.4);
    }
    placeImage(ctx) {
      const path = cachedPath(this.getImagePath());
      ctx.filter = `drop-shadow(${stage_default.px(3)} ${stage_default.px(3)} ${stage_default.px(
        3
      )} rgba(0,0,0,0.3))`;
      ctx.fillStyle = "#000";
      ctx.fill(path);
      ctx.filter = "none";
      ctx.fillStyle = "#fff";
      ctx.fill(path);
      ctx.strokeStyle = "#333";
      ctx.stroke(path);
    }
    placeEyes(ctx) {
      this.placeEye(
        ctx,
        this.eyesLeft,
        this.eyesTop,
        -1 /* Inverse */ * this.defaultEyeRotation
      );
      this.placeEye(
        ctx,
        this.eyesLeft + this.eyesGap,
        this.eyesTop,
        1 /* Direct */ * this.defaultEyeRotation
      );
    }
    placeEye(ctx, x, y, rotation) {
      [
        [`blur(${stage_default.px(2)})`, "#000"],
        ["none", "#333"]
      ].forEach(([filterEffect, color]) => {
        ctx.beginPath();
        ctx.fillStyle = color;
        ctx.filter = filterEffect;
        const angle = rotation * Math.PI / 4;
        ctx.ellipse(x, y, 3.5, 2.5, angle, 0, 2 * Math.PI);
        ctx.fill();
      });
      ctx.filter = "none";
    }
    placeShadow(ctx) {
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.fill(cachedPath(this.getShadowPath()));
    }
    getImagePath() {
      throw new Error("Not Implemented");
    }
    getShadowPath() {
      throw new Error("Not Implemented");
    }
    fall(hero) {
      this.sprite.y += 2 * this.verticalSpeed;
      this.restartWhenOutCanvas();
    }
    restartWhenOutCanvas() {
      if (!this.nextMonsterCalled && this.sprite.y > this.limitToCallNextMonster) {
        this.nextMonsterCalled = true;
        emit("callNextMonster");
      }
      if (!this.monsterLeftScreen && this.sprite.y > stage_default.height) {
        this.monsterLeftScreen = true;
        emit("destroyMonster");
      }
    }
  };

  // src/monsters/fallingMonster.ts
  var FallingMonster = class extends BaseMonster {
    getImagePath() {
      return "m 35,20 c 0,7 -1,23 -3.3,30 L 28,41 22,50 18,40 10,49 7,40 0,48 C 0,39 2,36 3,23 4,12 6,0 16,0 25,0 34,3 35,21 Z";
    }
    getShadowPath() {
      return "M 4,42 0,48 C 0,39 2,35 3,23 3.5,12 6,0 15,0 20,0 23,0 26,2 3.3,3 10,20 5,42 Z";
    }
  };

  // src/monsters/slidingMonster.ts
  var SlidingMonster = class extends BaseMonster {
    constructor(...args) {
      super(...args);
      this.defaultEyeRotation = -1 /* Inverse */;
      this.eyesLeft = 13;
      this.eyesGap = 9;
      this.reverseDirection = false;
    }
    fall(hero) {
      this.slideHorizontally();
      super.fall(hero);
    }
    getImagePath() {
      return "m 0.6,18.88 c -3.2,6.7 7.3,11 8,28 2.2,5.5 3.5,-3.9 6.1,-2.9 2.3,0.84 2.3,2 4.6,3.3 3.1,1.8 5.3,-1.1 7.3,-1.4 2.4,-0.42 5.6,6.9 5.4,-1.1 -0.45,-19 6.9,-25 -0.079,-28 -3.3,-1.4 -1.9,6.4 -3,4.1 -4.5,-9.3 -1.3,-21 -8.2,-21 -8.7,-0.43 -13,2.9 -15,19 -0.7,5.5 -2,-5.6 -5.12,0 z";
    }
    getShadowPath() {
      return "m 0.6,18.88 c -3.2,6.7 7.3,11 8,28 2.2,5.5 3.5,-3.9 6.1,-2.9 C 9.3054086,37.60645 8.9555519,29.035045 6.2200132,25.194241 16.046146,27.812577 4.1743762,1.7533605 25.292022,4.0615333 23.66163,1.5392037 22.055474,-0.03250161 20.721,-0.12 c -8.7,-0.43 -13,2.9 -15,19 -0.7,5.5 -2,-5.6 -5.12,0 z";
    }
    slideHorizontally() {
      const newPosition = this.sprite.x + this.verticalSpeed * (this.reverseDirection ? -1 : 1);
      if (newPosition < 0 || newPosition + this.sprite.width > stage_default.width) {
        this.reverseDirection = !this.reverseDirection;
      } else {
        this.sprite.x = newPosition;
      }
    }
  };

  // src/monsters/magneticMonster.ts
  var MagneticMonster = class extends BaseMonster {
    constructor(...args) {
      super(...args);
      this.defaultEyeRotation = -1 /* Inverse */;
      this.eyesLeft = 11;
      this.eyesGap = 12;
      this.slideSpeed = Math.sqrt(this.verticalSpeed);
    }
    fall(hero) {
      this.moveTowardHero(hero);
      super.fall(hero);
    }
    getImagePath() {
      return "m35 46c-2.8 0.085-9.8 1.2-12-4.1-1.5 2.4-1.4 4.2-1 6.6-5.7-0.97-8.6-2.7-11-7-0.91 2.4-1.4 4.5-0.87 7.7-10-7.6-9.2-13-8.6-27 0.23-5.5 2-11 4.9-15l-3.9-3.5 4.6 1.1-0.31-5.1 3 4.3c1.4-0.94 3-1.5 4.7-1.5 7.6-3e-5 17 2.2 15 18-0.78 7.3 3.4 21 5.5 26z";
    }
    getShadowPath() {
      return "m 11,41.5 c -0.91,2.4 -1.4,4.5 -0.87,7.7 -10,-7.6 -9.2,-13 -8.6,-27 0.23,-5.5 2,-11 4.9,-15 l -3.9,-3.5 4.6,1.1 -0.31,-5.1 3,4.3 c 1.4,-0.94 3,-1.5 4.7,-1.5 5.082539,-2.01e-5 10.970099,0.9839003 13.714695,6.3613568 C 17.092777,5.8487082 12.78185,7.0442861 9.401666,11.909225 3.6797857,20.144459 5.0268758,37.560233 11,41.5 Z";
    }
    moveTowardHero(hero) {
      const heroCenter = hero.sprite.x + hero.sprite.width / 2;
      const monsterCenter = this.sprite.x + this.sprite.width / 2;
      let movement = 0;
      if (monsterCenter < heroCenter) {
        movement = this.slideSpeed;
      } else if (monsterCenter > heroCenter) {
        movement = -1 * this.slideSpeed;
      }
      this.sprite.x += movement;
    }
  };

  // src/monsters/teleportingMonster.ts
  var TeleportingMonster = class extends BaseMonster {
    constructor(...args) {
      super(...args);
      this.teleported = false;
      this.eyesTop = 21;
      this.eyesLeft = 11;
      this.eyesGap = 10;
      this.smokeLeft = 0;
      this.smokeTransition = [];
      this.smokeTransitionSteps = 30;
      const baseDistance = Math.min(300, stage_default.height / 2);
      const baseSpeed = 2;
      const incrementRate = 0.2;
      this.threshold = baseDistance * (1 + incrementRate * (this.verticalSpeed - baseSpeed));
    }
    render(ctx) {
      if (this.teleported && this.smokeTransition.length > 0) {
        this.renderSmoke(ctx);
      }
      super.render(ctx);
    }
    fall(hero) {
      if (stage_default.height - this.sprite.y < this.threshold && !this.teleported) {
        this.teleport(hero);
      }
      super.fall(hero);
    }
    getImagePath() {
      return "m 5.1,22 c -3.2,4.86 -5.7,11 -4.2,13 1.6,1.6 3.1,-4.2 4.4,-3.4 1.5,0.94 -0.97,12 3.4,16 6.2,5.3 4.5,-5.4 7,-1.4 5.5,8.9 4.2,-0.54 6.3,-0.81 2.5,-0.33 2.8,8.3 5.5,-1.9 1.9,-6.9 -3.4,-16 2.4,-11 1.1,0.93 5.4,2.7 4.5,-0.038 -1.5,-4.3 -7,-5.7 -8.3,-9.1 -1.7,-4.5 -1.4,-8.2 -4.4,-10 -3.7,-2.8 -11,-1.3 -7.8,-7.1 0.92,-1.6 2.9,-2.7 4.8,-1.8 2,0.93 1.7,3.8 -2.8,2.8 1.1,3.3 4.8,3.2 6.8,0.25 3.3,-4.7 -3.5,-8.5 -9.4,-5.4 -4.7,2.5 -6,5.6 -6.7,8.7 C 6.2,14 6.3,20 5.1,22 Z";
    }
    getShadowPath() {
      return "m 5.1,22 c -3.2,4.86 -5.7,11 -4.2,13 1.6,1.6 3.1,-4.2 4.4,-3.4 1.5,0.94 -0.97,12 3.4,16 2,1.7 3,1.7 4,1.2 C 7,5 9,34 8.5,28 8,17 10,9 13.3,2.1 c -4.7,2.5 -6,5.6 -6.7,8.7 C 6.2,14 6.3,20 5.1,22 Z";
    }
    teleport(hero) {
      const heroCenter = hero.sprite.x + hero.sprite.width / 2;
      const newLeftPosition = heroCenter - this.sprite.width / 2;
      const maxPosition = stage_default.width - this.sprite.width;
      this.createSmokeTransition();
      this.sprite.x = Math.min(Math.max(0, newLeftPosition), maxPosition);
      this.teleported = true;
    }
    createSmokeTransition() {
      this.smokeLeft = this.sprite.x;
      this.smokeTransition = range(this.smokeTransitionSteps);
    }
    // The ghost leaves a fading, blurred silhouette where it was before teleporting
    renderSmoke(ctx) {
      const smokeStep = this.smokeTransition.splice(0, 1)[0];
      const smokePct = (this.smokeTransitionSteps - smokeStep) / this.smokeTransitionSteps;
      const smokeOpacity = smokePct / 2;
      const smokeBlurLevel = 6 / smokePct;
      ctx.save();
      ctx.translate(this.smokeLeft, this.sprite.y);
      this.setScale(ctx);
      ctx.filter = `blur(${stage_default.px(smokeBlurLevel)})`;
      ctx.fillStyle = `rgba(0, 0, 0, ${smokeOpacity})`;
      ctx.fill(cachedPath(this.getImagePath()));
      ctx.restore();
    }
  };

  // src/monsters/generateMonster.ts
  var defaultMonstersByLevel = [
    [FallingMonster, SlidingMonster],
    [MagneticMonster, TeleportingMonster]
  ];
  function* generateMonster({
    count,
    levelDistribution,
    monstersByLevel = defaultMonstersByLevel,
    getRandomNumber = Math.random
  }) {
    const perMonsterDistribution = getPerMonsterDistribution(
      levelDistribution,
      monstersByLevel
    );
    for (let index = 0; index < count; index++) {
      yield getRandomMonsterConstructor(
        perMonsterDistribution,
        getRandomNumber
      );
    }
  }
  function getPerMonsterDistribution(levelDistribution, monstersByLevel) {
    const monstersDistribution = [];
    let aggregateValue = 0;
    for (let groupIndex = 0; groupIndex < monstersByLevel.length; groupIndex++) {
      for (const monster of monstersByLevel[groupIndex]) {
        const monsterPct = levelDistribution[groupIndex] / monstersByLevel[groupIndex].length;
        aggregateValue = monsterPct + aggregateValue;
        monstersDistribution.push([monster, aggregateValue]);
      }
    }
    return monstersDistribution;
  }
  function getRandomMonsterConstructor(perMonsterDistribution, getRandomNumber) {
    const randomPct = getRandomNumber() * 100;
    for (const item of perMonsterDistribution) {
      const [MonsterConstructor, pctLimit] = item;
      if (randomPct <= pctLimit) {
        return MonsterConstructor;
      }
    }
    throw new Error("Unexpected distribution");
  }

  // src/monsters/index.ts
  var monsters_default = generateMonster;

  // src/flash.ts
  var FlashLib = class {
    constructor() {
      this.timeoutIds = [];
      this.container = document.getElementById("flash");
    }
    write({
      text,
      timeInSeconds,
      onDone
    }) {
      this.clear();
      this.container.style.transition = `opacity ${timeInSeconds / 2}s`;
      this.container.textContent = text;
      this.container.style.opacity = "1";
      this.timeoutIds.push(
        setTimeout(() => {
          this.container.style.opacity = "0";
        }, timeInSeconds / 2 * 1e3)
      );
      this.timeoutIds.push(
        setTimeout(() => {
          onDone();
        }, timeInSeconds * 1e3)
      );
    }
    clear() {
      this.timeoutIds.forEach((timeoutId) => clearTimeout(timeoutId));
      this.timeoutIds = [];
      this.container.style.transition = "none";
      this.container.style.opacity = "0";
    }
  };

  // src/instructions.ts
  var SHOWN_KEY = "ghost-river:instructions-shown";
  var InstructionsLib = class {
    constructor() {
      this.timeoutInSeconds = 650;
      this.staleTimeInSeconds = 2e3;
      this.timeoutIds = [];
      this.hasBeenShown = false;
      this.container = document.getElementById("instructions");
      this.container.style.transition = `opacity ${this.timeoutInSeconds}ms`;
      this.hasBeenShown = this.getHasBeenShownFromStorage();
    }
    getHasBeenShownFromStorage() {
      try {
        return Boolean(window.localStorage.getItem(SHOWN_KEY));
      } catch (e) {
        return false;
      }
    }
    toggle({ onDone }) {
      if (this.hasBeenShown) {
        onDone();
      } else {
        this.toggleAnimation(onDone);
      }
    }
    reset() {
      this.timeoutIds.forEach((timeoutId) => clearTimeout(timeoutId));
      this.timeoutIds = [];
      this.removeInstructions();
    }
    toggleAnimation(onDone) {
      this.addInstructions("left");
      this.timeoutIds.push(
        setTimeout(() => {
          this.addInstructions("right");
        }, this.timeoutInSeconds + this.staleTimeInSeconds)
      );
      this.timeoutIds.push(
        setTimeout(() => {
          this.hasBeenShown = true;
          this.storeHasBeenShown();
          onDone();
        }, this.timeoutInSeconds * 2 + this.staleTimeInSeconds * 2)
      );
    }
    storeHasBeenShown() {
      try {
        window.localStorage.setItem(SHOWN_KEY, "true");
      } catch (e) {
      }
    }
    addInstructions(direction) {
      this.container.innerHTML = "";
      this.container.appendChild(this.getContent(direction));
      this.container.style.opacity = "1";
      this.timeoutIds.push(
        setTimeout(() => {
          this.container.style.opacity = "0";
        }, this.staleTimeInSeconds)
      );
      this.timeoutIds.push(
        setTimeout(() => {
          this.container.innerHTML = "";
        }, this.staleTimeInSeconds + this.timeoutInSeconds)
      );
    }
    removeInstructions() {
      this.container.style.opacity = "0";
      this.container.innerHTML = "";
    }
    getContent(direction) {
      const div = document.createElement("div");
      const touch = window.matchMedia("(pointer: coarse)").matches;
      const arrow = direction === "left" ? "←" : "→";
      div.innerHTML = touch ? `<span class="arrow">${arrow}</span>Touch and hold the ${direction} side of the screen to row ${direction}` : `<span class="arrow">${arrow}</span>Hold the ${direction} arrow key, or press the mouse on the ${direction} side, to row ${direction}`;
      div.style.gridArea = direction;
      return div;
    }
  };

  // src/overlays.ts
  var flashLib = new FlashLib();
  var instructionsLib = new InstructionsLib();

  // src/levels/level.ts
  var Level = class {
    constructor({
      language,
      speed,
      frequency,
      monsterCount,
      monsterLevelDistribution
    }) {
      this.destroyed = false;
      this.bindedSpawnMonster = this.spawnMonster.bind(this);
      this.bindedDestroyMonster = this.destroyMonster.bind(this);
      this.bindedFitMonsters = this.fitMonsters.bind(this);
      this.language = language;
      this.speed = speed;
      this.frequency = frequency;
      this.monsterCount = monsterCount;
      this.monsterLevelDistribution = monsterLevelDistribution;
      this.isAccomplished = false;
      this.background = new Background(this.language);
      this.monsters = [];
      instructionsLib.toggle({
        onDone: () => {
          if (this.destroyed) return;
          flashLib.write({
            text: `${LANGUAGE_NAMES[this.language]} Hell`,
            timeInSeconds: 2,
            onDone: () => {
              if (!this.destroyed) this.initializeMonsterGenerator();
            }
          });
        }
      });
      this.attachEventListeners();
    }
    render(ctx) {
      this.background.render(ctx);
      this.monsters.forEach((monster) => monster.render(ctx));
    }
    update(hero) {
      this.background.update();
      [...this.monsters].forEach((monster) => {
        monster.fall(hero);
        hero.killOnCollide(monster);
      });
    }
    destroy() {
      this.destroyed = true;
      this.removeEventListeners();
    }
    attachEventListeners() {
      on("callNextMonster", this.bindedSpawnMonster);
      on("destroyMonster", this.bindedDestroyMonster);
      on("resize", this.bindedFitMonsters);
    }
    removeEventListeners() {
      off("callNextMonster", this.bindedSpawnMonster);
      off("destroyMonster", this.bindedDestroyMonster);
      off("resize", this.bindedFitMonsters);
    }
    fitMonsters() {
      this.monsters.forEach((monster) => monster.fitInStage());
    }
    initializeMonsterGenerator() {
      this.monsterTypeGenerator = monsters_default({
        count: this.monsterCount,
        levelDistribution: this.monsterLevelDistribution
      });
      this.monsters = [];
      this.spawnMonster();
    }
    spawnMonster() {
      const { value: MonsterType, done } = this.monsterTypeGenerator.next();
      if (done === false) {
        this.monsters.unshift(
          new MonsterType({
            speed: this.speed,
            frequency: this.frequency
          })
        );
      } else {
        this.isAccomplished = true;
      }
    }
    destroyMonster() {
      this.monsters.pop();
      if (this.isAccomplished) {
        emit("levelAccomplished");
      }
    }
  };

  // src/levels/index.ts
  var LEVEL_COUNT = 9;
  var Levels = class {
    constructor() {
      /** 1-based number of the current level. */
      this.levelNumber = 0;
      this.bindedFinishLevel = this.finishLevel.bind(this);
      this.levelParamsGenerator = generateLevelsParams();
      this.addEventListeners();
      this.advanceLevel();
    }
    render(ctx) {
      this.level.render(ctx);
    }
    update(hero) {
      this.level.update(hero);
    }
    destroy() {
      this.level.destroy();
      this.removeEventListeners();
    }
    addEventListeners() {
      on("levelAccomplished", this.bindedFinishLevel);
    }
    removeEventListeners() {
      off("levelAccomplished", this.bindedFinishLevel);
    }
    finishLevel() {
      this.level.destroy();
      this.advanceLevel();
    }
    advanceLevel() {
      const { value: params, done } = this.levelParamsGenerator.next();
      if (done === false) {
        this.levelNumber++;
        this.level = new Level(params);
        emit("levelStarted", this.levelNumber, this.level);
      } else {
        emit("gameComplete");
      }
    }
  };

  // src/movementDetector.ts
  var activePointers = /* @__PURE__ */ new Map();
  function isUiTarget(target) {
    return target instanceof Element && target.closest("button") !== null;
  }
  window.addEventListener("pointerdown", (event) => {
    if (isUiTarget(event.target)) return;
    activePointers.delete(event.pointerId);
    activePointers.set(event.pointerId, event.clientX);
  });
  window.addEventListener("pointermove", (event) => {
    if (activePointers.has(event.pointerId)) {
      activePointers.set(event.pointerId, event.clientX);
    }
  });
  ["pointerup", "pointercancel", "lostpointercapture"].forEach(
    (type) => window.addEventListener(
      type,
      (event) => activePointers.delete(event.pointerId)
    )
  );
  window.addEventListener("blur", () => activePointers.clear());
  function releaseAllPointers() {
    activePointers.clear();
  }
  function pointerDirection() {
    let lastX;
    activePointers.forEach((x) => lastX = x);
    if (lastX === void 0) return 0;
    return lastX < stage_default.centerX ? -1 : 1;
  }
  var MovementDetector = class {
    update() {
      const left = keyPressed("ArrowLeft", "KeyA");
      const right = keyPressed("ArrowRight", "KeyD");
      const pointer = pointerDirection();
      if (pointer !== 0) {
        emit("heroMoved", pointer);
      }
      if (left && !right) {
        emit("heroMoved", -1);
      }
      if (right && !left) {
        emit("heroMoved", 1);
      }
    }
  };

  // src/songs.ts
  var MUTED_KEY = "ghost-river:muted";
  var audioCtx = null;
  var master = null;
  var isPlaying = false;
  var muted = readMuted();
  function readMuted() {
    try {
      return window.localStorage.getItem(MUTED_KEY) === "1";
    } catch (e) {
      return false;
    }
  }
  function unlock() {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;
    if (!audioCtx) {
      audioCtx = new AudioCtor();
      master = audioCtx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(audioCtx.destination);
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => void 0);
    }
  }
  function isMuted() {
    return muted;
  }
  function toggleMute() {
    muted = !muted;
    if (master) master.gain.value = muted ? 0 : 0.5;
    try {
      window.localStorage.setItem(MUTED_KEY, muted ? "1" : "0");
    } catch (e) {
    }
    return muted;
  }
  function hit() {
    if (!isPlaying) {
      isPlaying = true;
      playHit();
      setTimeout(() => {
        isPlaying = false;
      }, 500);
    }
  }
  function playHit() {
    if (!audioCtx || !master || muted || audioCtx.state !== "running") return;
    const start = audioCtx.currentTime;
    const gainNode = audioCtx.createGain();
    gainNode.connect(master);
    gainNode.gain.value = 0;
    [22, 25, 22].forEach((value, index) => {
      const oscillator = audioCtx.createOscillator();
      const at = start + index * 0.1;
      oscillator.type = "sawtooth";
      oscillator.frequency.setValueAtTime(440 * 1.06 ** (13 - value), at);
      gainNode.gain.setValueAtTime(1, at);
      gainNode.gain.setTargetAtTime(1e-4, at + 0.08, 5e-3);
      oscillator.connect(gainNode);
      oscillator.start(at);
      oscillator.stop(at + 0.09);
    });
  }

  // src/assets/boat.svg
  var boat_default = "./assets/boat.svg";

  // src/hero.ts
  var boatImage = new Image();
  boatImage.src = boat_default;
  var boatSheet = null;
  var boatSheetRatio = 0;
  function getBoatSheet() {
    if (!boatImage.complete || boatImage.naturalWidth === 0) return null;
    const ratio = Math.ceil(stage_default.pixelRatio * 2) / 2;
    if (!boatSheet || boatSheetRatio !== ratio) {
      boatSheet = document.createElement("canvas");
      boatSheet.width = Math.round(100 * ratio);
      boatSheet.height = Math.round(100 * ratio);
      const ctx = boatSheet.getContext("2d");
      ctx.drawImage(boatImage, 0, 0, boatSheet.width, boatSheet.height);
      boatSheetRatio = ratio;
    }
    return boatSheet;
  }
  var Hero = class {
    constructor() {
      this.width = 50;
      this.height = 100;
      this.margin = 30;
      this.speed = 3;
      this.frame = 0;
      this.flashing = false;
      this.flashTicks = 0;
      this.isColliding = false;
      this.collisionAnimationTimeout = null;
      this.bindedHandleHeroMoved = this.handleHeroMoved.bind(this);
      this.bindedFitInStage = this.fitInStage.bind(this);
      this.sprite = {
        x: (stage_default.width - this.width) / 2,
        y: stage_default.height - this.height - this.margin,
        width: this.width,
        height: this.height
      };
      this.addEventListeners();
    }
    destroy() {
      this.removeEventListeners();
    }
    addEventListeners() {
      on("heroMoved", this.bindedHandleHeroMoved);
      on("resize", this.bindedFitInStage);
    }
    removeEventListeners() {
      off("heroMoved", this.bindedHandleHeroMoved);
      off("resize", this.bindedFitInStage);
    }
    fitInStage() {
      this.sprite.x = Math.min(
        Math.max(0, this.sprite.x),
        stage_default.width - this.sprite.width
      );
    }
    render(ctx) {
      const sheet = getBoatSheet();
      if (!sheet) return;
      const frameWidth = sheet.width / 2;
      ctx.drawImage(
        sheet,
        this.frame * frameWidth,
        0,
        frameWidth,
        sheet.height,
        this.sprite.x,
        this.sprite.y,
        this.width,
        this.height
      );
    }
    update() {
      if (this.flashing) {
        this.flashTicks++;
        this.frame = Math.floor(this.flashTicks / 6) % 2;
      }
      if (this.collisionAnimationTimeout != null && this.collisionAnimationTimeout !== 0) {
        this.collisionAnimationTimeout--;
      } else if (this.collisionAnimationTimeout === 0) {
        this.collisionAnimationTimeout = null;
        this.flashing = false;
        this.frame = 0;
        emit("killed", this);
      }
    }
    killOnCollide(monster) {
      if (collides(this.sprite, monster.sprite)) {
        if (!this.isColliding) {
          this.isColliding = true;
          this.collisionAnimationTimeout = 30;
          this.flashing = true;
          this.flashTicks = 0;
          hit();
        }
      } else {
        this.isColliding = false;
      }
    }
    handleHeroMoved(direction) {
      if (direction === 1) {
        this.moveRight();
      } else {
        this.moveLeft();
      }
    }
    moveLeft() {
      this.sprite.x = Math.max(0, this.sprite.x - this.speed);
    }
    moveRight() {
      this.sprite.x = Math.min(
        stage_default.width - this.sprite.width,
        this.sprite.x + this.speed
      );
    }
  };

  // src/lifes.ts
  var heartPath = new Path2D(`
  M 2.57,0.10 C -0.12,0.65 -0.16,3.80 0.118,5.86 0.66,10.10 4.04,13.51
  8.00,16 11.97,13.501 15.34,10.10 15.89,5.86 16.16,3.79 16.12,0.65
  13.43,0.10 11.06,-0.38 9.37,0.96 8.00,3.32 6.38,0.89 5.00,-0.38 2.57,0.10 Z
`);
  var Lifes = class {
    constructor() {
      this.size = 22;
      this.margin = 8;
      this.lifesCount = 3;
      this.bindedDiscountLife = this.discountLife.bind(this);
      this.attachEventListeners();
    }
    render(ctx) {
      for (let index = 0; index < 3; index++) {
        ctx.save();
        ctx.translate(
          this.margin * (index + 1) + this.size * index,
          stage_default.height - this.size - this.margin
        );
        ctx.scale(this.size / 16, this.size / 16);
        ctx.fillStyle = index < this.lifesCount ? "rgba(255, 0, 0, 1)" : "rgba(255, 0, 0, 0.3)";
        ctx.filter = `drop-shadow(${stage_default.px(2)} ${stage_default.px(2)} ${stage_default.px(
          3
        )} rgba(0, 0, 0, 1))`;
        ctx.fill(heartPath);
        ctx.restore();
      }
    }
    destroy() {
      this.removeEventListeners();
    }
    attachEventListeners() {
      on("killed", this.bindedDiscountLife);
    }
    removeEventListeners() {
      off("killed", this.bindedDiscountLife);
    }
    discountLife() {
      this.lifesCount--;
      if (this.lifesCount === 0) {
        emit("gameOver");
      }
    }
  };

  // src/app.ts
  var BEST_KEY = "ghost-river:best-level";
  var App = class {
    constructor() {
      this.gameStatus = 2 /* Stop */;
      this.result = null;
      /** Ignore input for a moment after a run ends, so a held finger doesn't restart it. */
      this.inputLockedUntil = 0;
    }
    init() {
      this.screen = new Screen();
      this.pauseButton = document.getElementById("pause");
      this.muteButton = document.getElementById("mute");
      this.leftHint = document.getElementById("hint-left");
      this.rightHint = document.getElementById("hint-right");
      this.updateMuteButton();
      this.syncStatus();
      startLoop({
        update: this.update.bind(this),
        render: this.render.bind(this)
      });
      this.attachEventListeners();
    }
    render() {
      const ctx = stage_default.beginFrame();
      if (this.gameStatus === 0 /* Play */ || this.gameStatus === 1 /* Pause */) {
        this.renderGameObjects(ctx);
      }
      const direction = this.gameStatus === 0 /* Play */ ? pointerDirection() : 0;
      this.leftHint.classList.toggle("active", direction === -1);
      this.rightHint.classList.toggle("active", direction === 1);
    }
    renderGameObjects(ctx) {
      this.levels.render(ctx);
      this.hero.render(ctx);
      this.lifes.render(ctx);
      this.renderLevelLabel(ctx);
    }
    renderLevelLabel(ctx) {
      ctx.save();
      ctx.font = "bold 16px monospace";
      ctx.textBaseline = "top";
      ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
      ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
      ctx.shadowOffsetX = stage_default.pixelRatio;
      ctx.shadowOffsetY = stage_default.pixelRatio;
      ctx.fillText(`LEVEL ${this.levels.levelNumber}/${LEVEL_COUNT}`, 12, 16);
      ctx.restore();
    }
    update() {
      if (this.gameStatus === 0 /* Play */) {
        this.movementDetector.update();
        this.hero.update();
        this.levels.update(this.hero);
      }
    }
    attachEventListeners() {
      window.addEventListener("pointerdown", (event) => {
        unlock();
        const target = event.target;
        const button = target.closest ? target.closest("button") : null;
        if (button) {
          event.preventDefault();
          this.handleButton(button.id || button.dataset.action || "");
          return;
        }
        if (this.gameStatus === 1 /* Pause */) {
          this.playPauseGame();
        } else {
          this.begin();
        }
      });
      window.addEventListener("keydown", (event) => {
        unlock();
        if (event.repeat) return;
        if (event.code === "Space" || event.code === "KeyP") {
          event.preventDefault();
          if (this.isRunning()) {
            this.playPauseGame();
          } else {
            this.begin();
          }
        } else if (event.code === "Escape") {
          this.stopGame();
        } else if (event.code === "KeyM") {
          this.toggleMute();
        } else if (!event.ctrlKey && !event.metaKey && !event.altKey) {
          if (event.code.startsWith("Arrow")) event.preventDefault();
          this.begin();
        }
      });
      window.addEventListener("click", (event) => event.preventDefault());
      window.addEventListener("contextmenu", (event) => event.preventDefault());
      document.addEventListener("visibilitychange", () => {
        if (document.hidden && this.gameStatus === 0 /* Play */) {
          this.playPauseGame();
        }
      });
      window.addEventListener("blur", () => {
        if (this.gameStatus === 0 /* Play */) {
          this.playPauseGame();
        }
      });
      on("gameOver", this.gameOver.bind(this));
      on("gameComplete", this.completeGame.bind(this));
      on("levelStarted", (levelNumber, level) => {
        document.body.style.setProperty("--level", level.background.color);
      });
    }
    handleButton(action) {
      if (action === "pause") {
        if (this.isRunning()) this.playPauseGame();
      } else if (action === "mute") {
        this.toggleMute();
      } else if (action === "play") {
        this.begin();
      } else if (action === "resume") {
        if (this.gameStatus === 1 /* Pause */) this.playPauseGame();
      } else if (action === "quit") {
        this.stopGame();
      }
    }
    toggleMute() {
      toggleMute();
      this.updateMuteButton();
    }
    updateMuteButton() {
      const muted2 = isMuted();
      this.muteButton.classList.toggle("off", muted2);
      this.muteButton.setAttribute("aria-label", muted2 ? "Unmute" : "Mute");
      this.muteButton.setAttribute("aria-pressed", String(muted2));
    }
    isRunning() {
      return this.gameStatus === 0 /* Play */ || this.gameStatus === 1 /* Pause */;
    }
    begin() {
      if (!this.isRunning() && performance.now() >= this.inputLockedUntil) {
        this.playPauseGame();
      }
    }
    playPauseGame() {
      if (this.gameStatus === 0 /* Play */) {
        this.setStatus(1 /* Pause */);
      } else {
        if (this.gameStatus !== 1 /* Pause */) {
          this.reinitializeObjects();
        }
        this.setStatus(0 /* Play */);
      }
    }
    reinitializeObjects() {
      if (this.levels) {
        this.levels.destroy();
      }
      if (this.hero) {
        this.hero.destroy();
      }
      if (this.lifes) {
        this.lifes.destroy();
      }
      instructionsLib.reset();
      flashLib.clear();
      this.movementDetector = new MovementDetector();
      this.hero = new Hero();
      this.lifes = new Lifes();
      this.levels = new Levels();
    }
    stopGame() {
      if (this.gameStatus === 2 /* Stop */) return;
      this.endRun();
      this.setStatus(2 /* Stop */);
    }
    gameOver() {
      this.endRun();
      const levelNumber = this.levels.levelNumber;
      const bestLevel = Math.max(levelNumber, this.readBest());
      this.writeBest(bestLevel);
      this.result = {
        levelNumber,
        levelCount: LEVEL_COUNT,
        levelName: LANGUAGE_NAMES[this.levels.level.language],
        bestLevel
      };
      this.setStatus(4 /* GameOver */);
    }
    completeGame() {
      this.endRun();
      this.writeBest(LEVEL_COUNT);
      this.setStatus(3 /* Complete */);
    }
    endRun() {
      instructionsLib.reset();
      flashLib.clear();
      releaseAllPointers();
      this.inputLockedUntil = performance.now() + 700;
    }
    readBest() {
      try {
        return Number(window.localStorage.getItem(BEST_KEY)) || 0;
      } catch (e) {
        return 0;
      }
    }
    writeBest(value) {
      try {
        if (value > this.readBest()) {
          window.localStorage.setItem(BEST_KEY, String(value));
        }
      } catch (e) {
      }
    }
    setStatus(status) {
      this.gameStatus = status;
      this.syncStatus();
    }
    syncStatus() {
      const status = this.gameStatus;
      this.screen.render(status, this.result);
      document.body.classList.toggle(
        "playing",
        status === 0 /* Play */
      );
      document.body.classList.toggle(
        "paused",
        status === 1 /* Pause */
      );
      this.pauseButton.setAttribute(
        "aria-label",
        status === 1 /* Pause */ ? "Resume" : "Pause"
      );
    }
  };

  // src/index.ts
  stage_default.mount(document.getElementById("stage"));
  var app = new App();
  app.init();
})();
