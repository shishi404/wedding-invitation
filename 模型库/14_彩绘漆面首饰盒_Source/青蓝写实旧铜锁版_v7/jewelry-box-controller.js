import { AnimationMixer, LoopOnce } from 'three';

export function setJewelryLockVisible(root,visible){
  const lock=root.getObjectByName('BrassLock_Root');
  if(!lock)throw new Error('首饰盒缺少锁模型');
  lock.visible=visible;
}

/** Call update(deltaSeconds) from the page's render loop. Inventory stays with the caller. */
export class JewelryBoxController {
  constructor(root, clips, { canUseKey = () => false, keyId = 'medieval-copper-key', onChange = () => {}, onOpened = () => {} } = {}) {
    this.root = root;
    this.mixer = new AnimationMixer(root);
    this.actions = Object.fromEntries(clips.map(clip => [clip.name, this.mixer.clipAction(clip)]));
    for (const name of ['LockedShake', 'Unlock', 'OpenLid']) {
      if (!this.actions[name]) throw new Error(`Missing animation: ${name}`);
    }
    this.canUseKey = canUseKey;
    this.keyId = keyId;
    this.onChange = onChange;
    this.onOpened = onOpened;
    this.contentAnchor = root.getObjectByName('JewelryBox_Contents_Anchor');
    this.state = 'locked';
    this.busy = false;
    this.generation = 0;
    this.pending = null;
    this.disposed = false;
    this.notify();
  }

  notify() { this.onChange({ state: this.state, busy: this.busy }); }
  update(dt) { if (!this.disposed) this.mixer.update(Math.max(0, Math.min(dt, 0.1))); }

  play(name) {
    const action = this.actions[name];
    return new Promise(resolve => {
      const done = event => {
        if (event.action !== action) return;
        this.mixer.removeEventListener('finished', done);
        this.pending = null;
        if (name === 'LockedShake') action.stop();
        resolve(true);
      };
      this.pending = { resolve, listener: done };
      this.mixer.addEventListener('finished', done);
      action.reset();
      action.enabled = true;
      action.clampWhenFinished = true;
      action.setLoop(LoopOnce, 1);
      action.timeScale = 1;
      action.time = 0;
      action.play();
    });
  }

  async run(task) {
    if (this.busy || this.disposed) return false;
    this.busy = true;
    const generation = this.generation;
    this.notify();
    try { return await task(() => generation === this.generation && !this.disposed); }
    finally {
      if (generation === this.generation) { this.busy = false; this.notify(); }
    }
  }

  async attemptOpen() {
    return this.run(async valid => {
      if (this.state === 'locked') {
        await this.play('LockedShake');
        return false;
      }
      if (this.state !== 'unlocked') return false;
      this.state = 'opening'; this.notify();
      const completed = await this.play('OpenLid');
      if (!completed || !valid()) return false;
      this.state = 'open';
      this.onOpened({ root: this.root, contentAnchor: this.contentAnchor });
      return true;
    });
  }

  async unlock(keyId) {
    return this.run(async valid => {
      if (this.state !== 'locked') return false;
      if (keyId !== this.keyId || !this.canUseKey(this.keyId)) {
        await this.play('LockedShake');
        return false;
      }
      this.state = 'unlocking'; this.notify();
      const completed = await this.play('Unlock');
      if (!completed || !valid()) return false;
      this.state = 'unlocked';
      return true;
    });
  }

  cancel() {
    ++this.generation;
    if (this.pending) {
      this.mixer.removeEventListener('finished', this.pending.listener);
      this.pending.resolve(false);
      this.pending = null;
    }
    this.mixer.stopAllAction();
  }
  dispose() {
    this.cancel(); this.disposed = true; this.mixer.uncacheRoot(this.root);
  }
}
