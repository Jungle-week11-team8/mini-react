import { useState, useEffect, useMemo } from '../../src/index.js';
import { createPixels, countColors, restoreSaved } from './logic.js';

export const SIZE = 16;
export const COLOR_NAMES = ['지우개', '주황', '노랑', '초록', '파랑', '보라', '분홍', '검정'];
export const STORAGE_KEY = 'mini-react-paint';
const SAVE_DELAY = 500;

// VNode를 짧게 쓰기 위한 데모 전용 도우미다. 문자열 자식은 text 노드로 바꾼다.
function h(tag, attrs, ...children) {
  return {
    type: 'element',
    tag,
    attrs,
    children: children
      .flat()
      .map((child) => (typeof child === 'string' ? { type: 'text', text: child } : child)),
  };
}

// 자식 컴포넌트는 props만 받아 VNode를 돌려주는 순수 함수다.
// 이벤트 함수는 VNode에 넣지 않고, data-* 속성으로 어떤 동작인지 알린다.

export function Palette({ color }) {
  return h(
    'div',
    { class: 'palette', role: 'group', 'aria-label': '색 고르기' },
    COLOR_NAMES.map((name, index) =>
      h('button', {
        type: 'button',
        class: 'swatch',
        'data-action': 'color',
        'data-color': String(index),
        'aria-label': name,
        'aria-pressed': String(index === color),
      }),
    ),
  );
}

export function Canvas({ pixels }) {
  return h(
    'div',
    { class: 'canvas', 'aria-label': `${SIZE}×${SIZE} 그림판` },
    pixels.map((color, index) =>
      h('div', { class: 'cell', 'data-index': String(index), 'data-color': String(color) }),
    ),
  );
}

export function Timeline({ length, position }) {
  // 끝에 닿은 버튼만 disabled 속성을 붙여, 속성 추가와 제거가 모두 일어나게 한다
  const edge = (isEdge) => (isEdge ? { disabled: '' } : {});
  return h(
    'div',
    { class: 'timeline' },
    h(
      'div',
      { class: 'timeline-actions' },
      h('button', { type: 'button', 'data-action': 'undo', ...edge(position === 0) }, '뒤로'),
      h(
        'button',
        { type: 'button', 'data-action': 'redo', ...edge(position === length - 1) },
        '앞으로',
      ),
      h('button', { type: 'button', 'data-action': 'clear' }, '지우기'),
      h('span', { class: 'timeline-label' }, `기록 ${position} / ${length - 1}`),
    ),
    h(
      'div',
      { class: 'ticks', role: 'group', 'aria-label': '기록으로 이동' },
      Array.from({ length }, (_, index) =>
        h('button', {
          type: 'button',
          class: 'tick',
          'data-action': 'goto',
          'data-position': String(index),
          'aria-label': `기록 ${index}`,
          ...(index === position ? { 'aria-current': 'step' } : {}),
        }),
      ),
    ),
  );
}

export function Stats({ stats }) {
  // 빈 안내문과 목록은 태그가 달라서, 둘 사이를 오가면 노드 교체가 일어난다
  if (stats.length === 0) return h('p', { class: 'stats-empty' }, '아직 칠한 칸이 없습니다.');
  return h(
    'ul',
    { class: 'stats' },
    stats.map(({ color, count }) =>
      h(
        'li',
        {},
        h('span', { class: 'chip', 'data-color': String(color) }),
        `${COLOR_NAMES[color]} ${count}칸`,
      ),
    ),
  );
}

/**
 * 그림판의 루트 컴포넌트다. 상태는 여기 한 곳에만 둔다.
 * @param {{ storage: Storage | null, bind: (setState: Function) => void,
 *   onSaveStatus?: (status: 'waiting' | 'saved' | 'cancelled' | 'failed') => void }} props
 */
export function PaintApp({ storage, bind, onSaveStatus = () => {} }) {
  const [state, setState] = useState(() => {
    const saved = restoreSaved(readStorage(storage), SIZE, COLOR_NAMES.length);
    return { history: [createPixels(SIZE)], position: 0, ...saved, color: 1, stroke: 'idle' };
  });
  // 이벤트 리스너는 VNode 밖에 있으므로 setter를 바깥으로 넘겨 준다
  bind(setState);

  const pixels = state.history[state.position];
  // 칸 256개를 세는 일은 그림이 바뀔 때만 다시 한다. 색만 고르는 렌더에서는 건너뛴다
  const stats = useMemo(() => countColors(pixels), [pixels]);

  useEffect(() => {
    // 드래그 중에는 칸마다 렌더되므로, 잠시 멈췄을 때 한 번만 저장한다
    onSaveStatus('waiting');
    let done = false;
    const timer = setTimeout(() => {
      done = true;
      const ok = writeStorage(storage, { history: state.history, position: state.position });
      onSaveStatus(ok ? 'saved' : 'failed');
    }, SAVE_DELAY);
    return () => {
      clearTimeout(timer);
      if (!done) onSaveStatus('cancelled');
    };
  }, [state.history, state.position]);

  return h(
    'div',
    { class: 'app' },
    Palette({ color: state.color }),
    h(
      'div',
      { class: 'workspace' },
      Canvas({ pixels }),
      h('aside', { class: 'side' }, h('h2', {}, '색 통계'), Stats({ stats })),
    ),
    Timeline({ length: state.history.length, position: state.position }),
  );
}

// 사생활 보호 모드 등에서는 localStorage 접근 자체가 에러를 던질 수 있다
function readStorage(storage) {
  try {
    return storage?.getItem(STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

function writeStorage(storage, data) {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(data));
    return Boolean(storage);
  } catch {
    return false;
  }
}
