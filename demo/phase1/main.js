import { domToVNode, diff, applyPatches } from '../../src/index.js';

const real = document.getElementById('real');
const preview = document.getElementById('preview');
const editor = document.getElementById('editor');
const patchButton = document.getElementById('patch');
const backButton = document.getElementById('back');
const forwardButton = document.getElementById('forward');
const status = document.getElementById('status');
const error = document.getElementById('error');
const patchLog = document.getElementById('patches');
const draftStatus = document.getElementById('draft-status');
const feedback = document.getElementById('feedback');

// 최초 VNode로 복원해 초기 표시도 patch의 렌더링 경로를 검증한다.
const history = [domToVNode(real.firstChild)];
let current = 0;
syncPreview(history[0]);
editor.value = preview.innerHTML;
renderControls();

editor.addEventListener('input', () => {
  const next = readEditor();
  if (!next) {
    showText(draftStatus, '입력을 확인해 주세요');
    return;
  }
  syncPreview(next);
  showText(draftStatus, '편집 내용 미적용');
});

patchButton.addEventListener('click', () => {
  const next = readEditor();
  if (!next) return;
  const patches = moveTo(next);
  // 과거 상태에서 분기하면 예전의 이후 기록으로 진행하지 않는다.
  history.splice(current + 1, Infinity, next);
  current = history.length - 1;
  renderControls();
  showText(
    feedback,
    patches.length
      ? '변경을 적용하고 새 상태를 기록했습니다.'
      : 'DOM 변경이 없습니다. 같은 상태를 이력에 기록했습니다.',
  );
});

backButton.addEventListener('click', () => navigate(-1));
forwardButton.addEventListener('click', () => navigate(1));

function navigate(direction) {
  const target = current + direction;
  if (target < 0 || target >= history.length) return;
  moveTo(history[target]);
  current = target;
  renderControls();
  showText(feedback, '선택한 상태를 실제 영역과 테스트 영역에 복원했습니다.');
}

function syncPreview(target) {
  const patches = preview.firstChild
    ? diff(domToVNode(preview.firstChild), target)
    : [{ type: 'INSERT', parentPath: [], index: 0, node: target }];
  applyPatches(preview, patches);
}

function moveTo(target) {
  // 실제 DOM을 다시 읽어 사용자가 직접 변경했어도 경로가 어긋나지 않게 한다.
  const patches = diff(domToVNode(real.firstChild), target);
  applyPatches(real, patches);
  syncPreview(target);
  editor.value = real.innerHTML;
  showText(patchLog, JSON.stringify(patches, null, 2));
  showText(error, '');
  showText(draftStatus, '적용된 상태');
  return patches;
}

function readEditor() {
  // 파싱은 화면 밖 template에서 하고, 실제 화면 반영은 applyPatches만 담당한다.
  const template = document.createElement('template');
  template.innerHTML = editor.value.trim();
  if (template.content.childNodes.length !== 1) {
    showText(
      error,
      `최상위 노드는 1개여야 합니다. (지금 ${template.content.childNodes.length}개) 내용을 하나의 요소로 감싸 주세요.`,
    );
    return null;
  }
  showText(error, '');
  return domToVNode(template.content.firstChild);
}

function showText(container, value) {
  const node = { type: 'text', text: value };
  applyPatches(
    container,
    container.firstChild
      ? diff(domToVNode(container.firstChild), node)
      : [{ type: 'INSERT', parentPath: [], index: 0, node }],
  );
}

function setDisabled(button, disabled) {
  const index = [...button.parentNode.childNodes].indexOf(button);
  applyPatches(button.parentNode, [
    {
      type: 'UPDATE_ATTRS',
      path: [index],
      set: disabled ? { disabled: '' } : {},
      remove: disabled ? [] : ['disabled'],
    },
  ]);
}

function renderControls() {
  setDisabled(backButton, current === 0);
  setDisabled(forwardButton, current === history.length - 1);
  showText(status, `history ${current + 1} / ${history.length}`);
}
