import * as welcome from './screens/welcome.js';
import * as levelSelect from './screens/levelSelect.js';
import * as game from './screens/game.js';
import * as settings from './screens/settings.js';
import * as declaration from './screens/declaration.js';
import { register, startRouter } from './router.js';
import { getProfile } from './storage.js';
import { configureAudio, unlockAudio } from './audio.js';

register('welcome', welcome);
register('levels', levelSelect);
register('game', game);
register('settings', settings);
register('declaration', declaration);

configureAudio(getProfile());

// 首次交互即解锁音频，避免直接进入关卡时无声
const primeAudio = () => {
  configureAudio(getProfile());
  unlockAudio();
};
document.addEventListener('pointerdown', primeAudio, { once: true });
document.addEventListener('keydown', primeAudio, { once: true });

startRouter();
