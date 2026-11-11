import { describe, it, expect, vi } from 'vitest';
import { h, FunctionComponent, useState } from '../src/index.js';

// setState는 마이크로태스크로 렌더를 예약하므로, 반영을 기다린 뒤 확인한다
const flush = () => new Promise((resolve) => setTimeout(resolve));

function setup(App) {
  const root = document.createElement('div');
  new FunctionComponent(App).mount(root);
  return root;
}

describe('이벤트 연결 (bindEvents)', () => {
  it('클릭하면 핸들러가 호출된다', () => {
    const onClick = vi.fn();
    const root = setup(() => h('button', { onClick }, '+'));
    root.querySelector('button').click();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('리렌더 후에는 최신 상태 값을 쓴다', async () => {
    const root = setup(() => {
      const [count, setCount] = useState(0);
      return h('button', { onClick: () => setCount(count + 1) }, count);
    });
    const button = root.querySelector('button');
    button.click();
    await flush();
    button.click();
    await flush();
    expect(button.textContent).toBe('2');
  });

  it('여러 번 리렌더해도 클릭 한 번에 한 번만 호출된다', async () => {
    const onClick = vi.fn();
    let rerender;
    const root = setup(() => {
      const [n, setN] = useState(0);
      rerender = () => setN((v) => v + 1);
      return h('button', { onClick }, n);
    });
    rerender();
    await flush();
    rerender();
    await flush();
    root.querySelector('button').click();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('이번 렌더에서 onClick이 빠지면 이전 핸들러를 뗀다', async () => {
    const onClick = vi.fn();
    let lock;
    const root = setup(() => {
      const [locked, setLocked] = useState(false);
      lock = () => setLocked(true);
      return h('button', { onClick: locked ? undefined : onClick }, '저장');
    });
    lock();
    await flush();
    root.querySelector('button').click();
    expect(onClick).not.toHaveBeenCalled();
  });

  it('목록 중간을 지우면 재사용된 DOM에 새 항목의 핸들러가 붙는다', async () => {
    const removed = [];
    const root = setup(() => {
      const [items, setItems] = useState(['A', 'B', 'C']);
      const remove = (id) => {
        removed.push(id);
        setItems((xs) => xs.filter((x) => x !== id));
      };
      return h(
        'ul',
        {},
        items.map((id) => h('li', {}, h('button', { onClick: () => remove(id) }, id))),
      );
    });
    root.querySelectorAll('button')[1].click(); // B 삭제
    await flush();
    root.querySelectorAll('button')[1].click(); // 같은 자리의 DOM이 이제 C
    await flush();
    expect(removed).toEqual(['B', 'C']);
    expect(root.textContent).toBe('A');
  });

  it('onDoubleClick은 dblclick 이벤트에 연결된다', () => {
    const handler = vi.fn();
    const root = setup(() => h('span', { onDoubleClick: handler }, 'x'));
    root.querySelector('span').dispatchEvent(new MouseEvent('dblclick'));
    expect(handler).toHaveBeenCalledOnce();
  });
});
