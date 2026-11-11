import { FunctionComponent } from '../../src/index.js';
import { PaintApp } from './app.js';
import { paintStroke, clearCanvas, moveTo } from './logic.js';

const root = document.querySelector('#root');
const changeCount = document.querySelector('#change-count');
const saveStatus = document.querySelector('#save-status');
const cancelCount = document.querySelector('#cancel-count');

let setState;
let cancelled = 0;

const SAVE_LABELS = {
  waiting: '저장 대기 중',
  saved: '저장됨',
  cancelled: '대기 중 (이전 예약 취소)',
  failed: '저장할 수 없음',
};

function showSaveStatus(status) {
  saveStatus.textContent = SAVE_LABELS[status];
  if (status === 'cancelled') cancelCount.textContent = String(++cancelled);
}

function getStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

new FunctionComponent(PaintApp, {
  storage: getStorage(),
  bind: (setter) => (setState = setter),
  onSaveStatus: showSaveStatus,
}).mount(root);

// mini-react가 실제 DOM을 몇 군데 바꿨는지 세고, 바뀐 칸을 깜빡인다.
// 브라우저 표준 MutationObserver라서 src 모듈 경계를 건드리지 않는다.
new MutationObserver((records) => {
  changeCount.textContent = String(records.length);
  for (const { target } of records) {
    if (target instanceof HTMLElement && target.dataset.index !== undefined) {
      target.animate([{ boxShadow: 'inset 0 0 0 2px #ef9f27' }, { boxShadow: 'none' }], {
        duration: 700,
      });
    }
  }
}).observe(root, { subtree: true, childList: true, attributes: true, characterData: true });

const cellAt = (event) =>
  document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-index]');

const ACTIONS = {
  color: (state, el) => ({ ...state, color: Number(el.dataset.color) }),
  undo: (state) => ({ ...state, position: moveTo(state.history, state.position - 1) }),
  redo: (state) => ({ ...state, position: moveTo(state.history, state.position + 1) }),
  goto: (state, el) => ({ ...state, position: moveTo(state.history, Number(el.dataset.position)) }),
  clear: (state) => clearCanvas(state),
};

// 버튼과 칸마다 리스너를 달지 않고, #root 하나에서 data-* 속성으로 동작을 고른다
root.addEventListener('click', (event) => {
  const el = event.target.closest('[data-action]');
  if (!el) return;
  setState((state) => {
    const next = ACTIONS[el.dataset.action](state, el);
    // 위치나 색이 그대로면 같은 state를 돌려줘 렌더를 건너뛴다
    return next.position === state.position &&
      next.color === state.color &&
      next.history === state.history
      ? state
      : next;
  });
});

root.addEventListener('pointerdown', (event) => {
  const cell = event.target.closest('[data-index]');
  if (!cell) return;
  event.preventDefault();
  setState((state) => paintStroke({ ...state, stroke: 'fresh' }, Number(cell.dataset.index)));
});

// 터치 드래그는 pointerover가 다른 칸에서 발생하지 않아, 좌표로 칸을 찾는다
root.addEventListener('pointermove', (event) => {
  const cell = cellAt(event);
  if (!cell) return;
  setState((state) => paintStroke(state, Number(cell.dataset.index)));
});

// 캔버스 밖에서 버튼을 떼도 획이 끝나도록 window에서 받는다
function endStroke() {
  setState((state) => (state.stroke === 'idle' ? state : { ...state, stroke: 'idle' }));
}
window.addEventListener('pointerup', endStroke);
window.addEventListener('pointercancel', endStroke);
