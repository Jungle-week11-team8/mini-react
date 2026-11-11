import { FunctionComponent, useState, useEffect, useMemo, applyPatches } from '../src/index.js';

const root = document.querySelector('#root');
const events = document.querySelector('#events');
const result = document.querySelector('#result');
let setCount;
let setDescriptionOpen;
let renders = 0;
let calculations = 0;

const text = (value) => ({ type: 'text', text: String(value) });
const element = (tag, attrs, children) => ({ type: 'element', tag, attrs, children });
const button = (id, label, className = 'button') =>
  element('button', { id, type: 'button', class: className }, [text(label)]);

// 자식은 props만 받아 VNode를 만들고, 상태와 훅의 소유권은 루트에 둔다.
function ScorePanel({ count }) {
  return element('section', { class: 'panel score-panel', 'aria-label': '점수 상태' }, [
    element('div', { class: 'panel-heading' }, [
      element('h3', {}, [text('나의 점수')]),
      element('span', { class: 'tag' }, [text('useState')]),
    ]),
    element('div', { class: 'score-body' }, [
      element('p', { class: 'score' }, [
        element('span', { class: 'score-label' }, [text('점수:')]),
        element('strong', { id: 'score' }, [text(count)]),
      ]),
      element('p', { class: 'score-hint' }, [text('클릭 한 번에서 시작하는 화면의 변화')]),
      element('div', { class: 'score-actions', role: 'group', 'aria-label': '상태 변경' }, [
        button('increment', '+ 1 증가', 'button primary'),
        button('batch', '연속 3번 증가', 'button secondary'),
        button('same', '같은 값 설정'),
        button('reset', '0으로 초기화'),
      ]),
    ]),
  ]);
}

function MemoPanel({ doubled, renders, calculations, descriptionOpen }) {
  return element('section', { class: 'panel memo-panel', 'aria-label': '메모와 렌더 결과' }, [
    element('div', { class: 'panel-heading' }, [
      element('h3', {}, [text('같은 입력, 기억한 결과')]),
      element('span', { class: 'tag' }, [text('useMemo')]),
    ]),
    element('div', { class: 'memo-body' }, [
      element('div', { class: 'derived-value' }, [
        element('span', {}, [text('점수 × 2')]),
        element('strong', { id: 'doubled' }, [text(doubled)]),
        element('code', {}, [text('[count]')]),
      ]),
      element('div', { class: 'metrics' }, [
        element('div', {}, [
          element('span', {}, [text('렌더 횟수')]),
          element('strong', { id: 'renders' }, [text(renders)]),
        ]),
        element('div', {}, [
          element('span', {}, [text('메모 계산 횟수')]),
          element('strong', { id: 'calculations' }, [text(calculations)]),
        ]),
      ]),
      element(
        'button',
        {
          id: 'toggle-description',
          type: 'button',
          class: 'disclosure-button',
          'aria-expanded': String(descriptionOpen),
          'aria-controls': 'description',
        },
        [text(descriptionOpen ? '설명 접기 −' : '설명 펴기 +')],
      ),
      element(
        'p',
        {
          id: 'description',
          class: 'memo-description',
          ...(descriptionOpen ? {} : { hidden: '' }),
        },
        [
          text(
            '이 설명을 접거나 펼쳐도 점수는 그대로입니다. 렌더 횟수만 늘고 메모 계산과 effect는 다시 실행되지 않는지 확인해 보세요.',
          ),
        ],
      ),
    ]),
  ]);
}

// 이벤트 함수는 VNode에 넣지 않아 직렬화 가능한 데이터 형태를 유지한다.
function record(message, kind) {
  applyPatches(events, [
    {
      type: 'INSERT',
      parentPath: [],
      index: events.childNodes.length,
      node: element('li', { class: kind }, [text(message)]),
    },
  ]);
}

function App() {
  const [count, setter] = useState(0);
  const [descriptionOpen, descriptionSetter] = useState(true);
  setCount = setter;
  setDescriptionOpen = descriptionSetter;
  renders += 1;
  const doubled = useMemo(() => {
    calculations += 1;
    return count * 2;
  }, [count]);
  useEffect(() => {
    const committed = root.querySelector('#score').textContent === String(count);
    record(`effect: 점수 ${count} · DOM 반영 확인 ${committed}`, 'effect');
    return () => record(`cleanup: 이전 점수 ${count}`, 'cleanup');
  }, [count]);
  return element('div', { class: 'state-layout' }, [
    ScorePanel({ count }),
    MemoPanel({ doubled, renders, calculations, descriptionOpen }),
  ]);
}

new FunctionComponent(App).mount(root);

const actions = {
  increment: () => setCount((count) => count + 1),
  batch: () => {
    setCount((count) => count + 1);
    setCount((count) => count + 1);
    setCount((count) => count + 1);
  },
  same: () => setCount((count) => count),
  reset: () => setCount(0),
  'toggle-description': () => setDescriptionOpen((open) => !open),
};

// 위임으로 연결하면 patch 후에도 버튼마다 리스너를 다시 붙일 필요가 없다.
root.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  const action = actions[button?.id];
  if (!action) return;
  const before = renders;
  action();
  queueMicrotask(() => {
    applyPatches(result, [
      { type: 'SET_DATA', path: [0], value: `이번 동작의 추가 렌더: ${renders - before}회` },
    ]);
  });
});
