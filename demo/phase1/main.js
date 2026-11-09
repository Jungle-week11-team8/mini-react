import { domToVNode, diff, applyPatches } from '../../src/index.js';

const real = document.getElementById('real');
const editor = document.getElementById('editor');
const patchButton = document.getElementById('patch');
const backButton = document.getElementById('back');
const forwardButton = document.getElementById('forward');
const status = document.getElementById('status');
const error = document.getElementById('error');
const patchLog = document.getElementById('patches');

// 루트는 childNodes[0]이므로, HTML 들여쓰기로 생긴 앞뒤 공백 text를 걷어 낸다
real.innerHTML = real.innerHTML.trim();

// VNode는 순수 데이터라서 스냅샷으로 그대로 쌓아 둘 수 있다
const history = [domToVNode(real.childNodes[0])];
let current = 0;

editor.value = real.innerHTML;
render();

patchButton.addEventListener('click', () => {
  const next = readEditor();
  if (!next) return;
  moveTo(next);
  // 뒤로 간 상태에서 새로 patch하면 앞쪽 기록은 의미가 없어지므로 버린다
  history.splice(current + 1, Infinity, next);
  current = history.length - 1;
  render();
});

backButton.addEventListener('click', () => {
  current -= 1;
  moveTo(history[current]);
  render();
});

forwardButton.addEventListener('click', () => {
  current += 1;
  moveTo(history[current]);
  render();
});

/**
 * 실제 영역을 target VNode와 같아지도록 patch한다.
 * old는 history가 아니라 실제 DOM을 다시 읽는다. 누가 DOM을 바꿨어도 path가 어긋나지 않는다.
 * @param {import('../../src/vdom/types.js').VNode} target
 */
function moveTo(target) {
  const patches = diff(domToVNode(real.childNodes[0]), target);
  applyPatches(real, patches);
  editor.value = real.innerHTML;
  patchLog.textContent = JSON.stringify(patches, null, 2);
}

/** textarea의 HTML을 VNode로 만든다. 최상위 노드가 1개가 아니면 null. */
function readEditor() {
  const holder = document.createElement('div');
  holder.innerHTML = editor.value.trim();
  if (holder.childNodes.length !== 1) {
    error.textContent = `최상위 노드는 1개여야 합니다. (지금 ${holder.childNodes.length}개)`;
    return null;
  }
  error.textContent = '';
  return domToVNode(holder.childNodes[0]);
}

function render() {
  backButton.disabled = current === 0;
  forwardButton.disabled = current === history.length - 1;
  status.textContent = `history ${current + 1} / ${history.length}`;
}
