// Asset paths follow the model library catalog.
import {ENVELOPE_V3} from './loft-envelope-assets.js';
export const ENVELOPE_ASSET=ENVELOPE_V3.desktop;
export const HEARTH_ASH_ASSET={
  "url": "./output/loft-viewer/hearth-ash-web.glb",
  "bytes": 9265860,
  "textureBytes": 5592405
};
export const ROOM_FINISH_WOOD_ASSET={
  "url": "./output/loft-viewer/stair-light-oak-grain.jpg",
  "bytes": 125220,
  "textureBytes": 2097152
};
export const ROOM_IMAGE_ASSETS=[
  {id:"window-board-art",url:"./assets/window-board-art.jpg",bytes:67013,textureBytes:4752288},
  {
    "id": "wedding-photo",
    "url": "./output/loft-viewer/framed-wedding-photo.jpg",
    "bytes": 216894,
    "textureBytes": 5592405
  }
];
// Retained for model-authoring tools; excluded from the active scene.
export const ARCHIVED_ROOM_IMAGE_ASSETS=[{id:"dance-artwork",url:"./output/loft-viewer/dance-portrait-canvas.jpg",bytes:212717,textureBytes:3437733}];
export const TABLE_PROP_ASSETS=[
  {
    "id": "coffee-cup",
    "name": "咖啡杯碟 · 原瓷釉版",
    "url": "./模型库/01_咖啡杯碟_Source/原瓷釉版/coffee-cup-and-saucer.glb?v=b67fb729df57",
    "bytes": 7654972,
    "textureBytes": 39143189,
    "span": 0.19,
    "defaults": {
      "x": -0.65,
      "z": 0.19,
      "rotation": 0,
      "size": 1,
      "visible": true
    }
  },
  {
    "id": "windchime",
    "name": "风铃 · 写实精致版",
    "url": "./模型库/02_风铃_可活动版/写实精致版_v3/windchime-realistic-static.glb",
    "bytes": 16543176,
    "textureBytes": 100663299,
    "span": 0.19,
    "defaults": {
      "x": -0.67,
      "z": -0.24,
      "rotation": 0,
      "size": 1,
      "visible": true
    },
    "animationUrl": "./模型库/02_风铃_可活动版/写实精致版_v3/windchime-realistic-sway.glb"
  },
  {
    "id": "alchemical-book",
    "name": "炼金古书 · 写实精致版",
    "url": "./output/loft-viewer/book-realistic-web.glb?v=5439aa10f5ea",
    "bytes": 6944652,
    "textureBytes": 86682281,
    "span": 0.32,
    "defaults": {
      "x": -0.04,
      "z": -0.02,
      "rotation": 0,
      "size": 1,
      "visible": true
    },
    "sourceUrl": "./模型库/05_炼金古书_开合动画/写实精致版_v4/alchemical-book-realistic-closed.glb",
    "animationUrl": "./模型库/05_炼金古书_开合动画/写实精致版_v4/alchemical-book-realistic-opening.glb?v=49028451e6a3"
  },
  {
    "id": "gramophone",
    "name": "留声机 · 写实精致版",
    "url": "./output/loft-viewer/gramophone-realistic-web.glb",
    "bytes": 11174980,
    "textureBytes": 123032914,
    "span": 0.4,
    "defaults": {
      "x": 0.4,
      "z": -0.22,
      "rotation": 0,
      "size": 1,
      "visible": true
    },
    "sourceUrl": "./模型库/06_留声机_Source_唱片旋转/写实精致版_v2/gramophone-realistic-spin.glb"
  },
  {
    "id": "octagonal-music-box",
    "name": "八角八音盒 · 写实精致版",
    "url": "./output/loft-viewer/musicbox-realistic-web.glb",
    "bytes": 4722576,
    "textureBytes": 31457278,
    "span": 0.19,
    "defaults": {
      "x": 0.18,
      "z": 0.25,
      "rotation": 0,
      "size": 1,
      "visible": true
    },
    "sourceUrl": "./模型库/07_八角八音盒_Source/写实精致版_v2/octagonal-music-box-realistic.glb"
  },
  {
    "id": "little-prince-pendant",
    "name": "小王子吊坠 · 写实精致版",
    "url": "./output/loft-viewer/pendant-realistic-web.glb",
    "bytes": 8197612,
    "textureBytes": 67108862,
    "span": 0.18,
    "defaults": {
      "x": -0.28,
      "z": 0.26,
      "rotation": 0,
      "size": 1,
      "visible": true
    },
    "sourceUrl": "./模型库/08_小王子吊坠_Realistic/little-prince-realistic-tabletop.glb"
  },
  {
    "id": "painted-lacquer-jewelry-box",
    "name": "首饰盒 · 青蓝写实旧铜锁版",
    "url": "./模型库/14_彩绘漆面首饰盒_Source/青蓝写实旧铜锁版_v7/jewelry-box-teal-game.glb",
    "bytes": 6012612,
    "textureBytes": 60118356,
    "span": 0.26,
    "defaults": {
      "x": 0.62,
      "z": 0.24,
      "rotation": 0,
      "size": 1,
      "visible": true
    }
  },
  {
    "id": "white-3ds-xl",
    "name": "白色 3DS XL · 写实版",
    "url": "./模型库/15_白色3DS_XL_写实/white-3ds-xl-realistic.glb",
    "bytes": 1087792,
    "textureBytes": 606,
    "span": 0.2,
    "defaults": {
      "x": 0.28,
      "z": 0.04,
      "rotation": -12,
      "size": 1,
      "visible": true
    }
  },
  {
    "id": "square-wood-photo-frame",
    "name": "方形深木相框 · 写实版",
    "url": "./模型库/16_方形深木相框_写实/square-wood-frame-realistic.glb",
    "bytes": 154500,
    "textureBytes": 572757,
    "span": 0.24,
    "defaults": {
      "x": -0.12,
      "z": -0.22,
      "rotation": 8,
      "size": 1,
      "visible": true
    }
  },
  {
    "id": "single-sticky-note",
    "name": "单张便利贴",
    "url": "./output/loft-viewer/sticky-note-web.glb",
    "bytes": 309948,
    "textureBytes": 12582911,
    "span": 0.11,
    "defaults": {
      "x": -0.12,
      "z": -0.08,
      "rotation": 12,
      "size": 1,
      "visible": true
    },
    "sourceUrl": "./模型库/18_单张便利贴_Source/single-sticky-note.glb"
  }
];
