// Reuse the existing gameplay IDs and rules; only their 3D targets change.
export const LOFT_INTERACTIONS=Object.freeze({
  'single-sticky-note':'note',
  'alchemical-book':'notebook',
  gramophone:'record',
  'painted-lacquer-jewelry-box':'drawer',
  'square-wood-photo-frame':'photo',
  'octagonal-music-box':'musicbox',
  windchime:'windchime',
  'little-prince-pendant':'pendant',
  'coffee-cup':'teacup',
  'white-3ds-xl':'handheld',
});
export const TAKEN_MODELS=Object.freeze({strength:'octagonal-music-box',intelligence:'windchime',will:'little-prince-pendant'});
export function canUseLoftObject(id,state){return !!LOFT_INTERACTIONS[id]&&TAKEN_MODELS[state.choice]!==id;}
