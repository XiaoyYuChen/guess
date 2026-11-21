import { navigate } from '../router.js';
import { state } from '../state.js';
import { imageUrl } from '../data.js';
import { playSfx } from '../audio.js';

const CC0_NOTICE = 'CC0 1.0 通用公共领域贡献声明（即放弃版权，允许自由使用、复制、修改和表演，无需署名，亦无任何担保）';

const BODY = [
  '本游戏内所有内容（包括但不限于文字、图像、代码、关卡设计等）均由人工智能（AI）工具生成，特此说明所使用的AI平台：豆包、DeepSeek（深度求索）。',
  `本游戏所使用的背景音乐来源于“爱给网”，并遵循 ${CC0_NOTICE}。`,
  `本游戏所使用的音效，来源于“爱给网”或个人制作；其中来源于“爱给网”的音效，遵循 ${CC0_NOTICE}。`,
  '特别献词',
  '献给我的女儿 可心',
  '—— 你是我所有冒险的开始。',
];

export function mount(root) {
  root.innerHTML = `
    <section class="screen declaration-screen is-active">
      <div class="settings-bg"></div>
      <div class="settings-vignette"></div>
      <header class="page-title-wrap">
        <img class="page-title-brush" src="${imageUrl('Decorate.png')}" alt="">
        <h1 class="page-title">游戏声明</h1>
      </header>
      <div class="declaration-card">
        ${BODY.map(p => `<p>${p}</p>`).join('')}
      </div>
      <div class="declaration-actions">
        <button class="settings-btn wide" type="button">
          <span>返回</span>
        </button>
      </div>
    </section>`;

  root.querySelector('.declaration-actions .settings-btn').addEventListener('click', () => {
    playSfx('confirm');
    const kind = state.currentKind || 'poetry';
    navigate(`#/levels?kind=${kind}`);
  });
}
