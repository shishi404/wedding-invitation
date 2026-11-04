// Pure rules shared by the scene and its verification script. Attributes stay private to the game.
export const keepsakes = {
  strength: {name:'陶瓷八音盒', icon:'♫', description:'转动发条有一种脚踏实地的沉稳感'},
  intelligence: {name:'风铃', icon:'♧', description:'风起时，杂乱的思绪被铃声理顺'},
  will: {name:'小吊坠', icon:'◈', description:'被珍视的不起眼的吊坠，想必是持有者心中坚定的锚点'}
};
export function initialState(choice=null) {
  if (choice!==null&&!keepsakes[choice]) throw new Error('Unknown keepsake');
  const attributes = {strength:55,intelligence:55,will:55};
  if(choice) attributes[choice] += 5;
  return {choice,attributes,noteRead:false,notebook:null,key:false,knife:false,recordBroken:false,drawerOpen:false,drawerLockBroken:false,drawerAttempted:false,envelope:false,seal:null,opened:false};
}
export function checkThreshold(attribute,difficulty='normal') {
  return difficulty==='extreme' ? Math.floor(attribute/5) : attribute;
}
export function evaluateRoll(value,attribute,difficulty='normal') {
  if (!Number.isInteger(value) || value<1 || value>100) throw new RangeError('Invalid d100 roll');
  const threshold = checkThreshold(attribute,difficulty);
  const kind = value===1 ? 'critical' : value >= (attribute<50?96:100) ? 'fumble' : value<=threshold ? 'success' : 'failure';
  return {value,kind,passed:kind==='critical'||kind==='success',threshold};
}
export function recordRoute(state) {
  return state.knife ? 'collected' : state.notebook?.kind==='critical' ? 'clue' : state.notebook ? 'force' : 'unread';
}
export function drawerRoute(state) {
  return state.drawerOpen ? 'open' : state.key ? 'key' : state.drawerAttempted ? 'locked' : 'force';
}
