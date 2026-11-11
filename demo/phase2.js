import { FunctionComponent, useState, useEffect, useMemo } from '../src/index.js';

const root = document.querySelector('#root');
const events = document.querySelector('#events');
const result = document.querySelector('#result');
let setCount;
let renders = 0;
let calculations = 0;
const text = (value) => ({ type: 'text', text: String(value) });
const paragraph = (value) => ({ type: 'element', tag: 'p', attrs: {}, children: [text(value)] });

// 이벤트 함수는 VNode에 저장하지 않아 Phase 1의 직렬화 규칙을 유지한다.
function record(message) {
  const item = document.createElement('li');
  item.textContent = message;
  events.appendChild(item);
}

new FunctionComponent(() => {
  const [count, setter] = useState(0);
  setCount = setter;
  renders += 1;
  const doubled = useMemo(() => {
    calculations += 1;
    return count * 2;
  }, [count]);
  useEffect(() => {
    record(`effect: 점수 ${count} · DOM 반영 확인 ${root.textContent.includes(`점수: ${count}`)}`);
    return () => record(`cleanup: 이전 점수 ${count}`);
  }, [count]);
  return {
    type: 'element',
    tag: 'div',
    attrs: {},
    children: [
      paragraph(`점수: ${count}`),
      paragraph(`두 배: ${doubled}`),
      paragraph(`렌더 횟수: ${renders}`),
      paragraph(`메모 계산 횟수: ${calculations}`),
    ],
  };
}).mount(root);

function connect(id, action) {
  document.querySelector(id).addEventListener('click', () => {
    const before = renders;
    action();
    queueMicrotask(() => {
      result.textContent = `이번 동작의 추가 렌더: ${renders - before}회`;
    });
  });
}

connect('#increment', () => setCount((count) => count + 1));
connect('#batch', () => {
  setCount((count) => count + 1);
  setCount((count) => count + 1);
  setCount((count) => count + 1);
});
connect('#same', () => setCount((count) => count));
connect('#reset', () => setCount(0));
