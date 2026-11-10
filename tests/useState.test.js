import { describe, it, expect } from 'vitest';
import { FunctionComponent, useState } from '../src/index.js';

// setState는 렌더를 마이크로태스크로 예약하므로, 예약된 작업이 끝날 때까지 기다린다
const flush = () => new Promise((resolve) => setTimeout(resolve));

const text = (value) => ({ type: 'text', text: String(value) });

// 렌더 횟수와 마지막 setState를 바깥에서 볼 수 있게 컴포넌트를 감싼다
function mountCounter(initial = 0) {
  const spy = { renders: 0, setCount: null };
  const component = new FunctionComponent(() => {
    spy.renders += 1;
    const [count, setCount] = useState(initial);
    spy.setCount = setCount;
    return text(count);
  });
  const container = document.createElement('div');
  component.mount(container);
  return { spy, container };
}

describe('useState', () => {
  it('첫 렌더에는 초깃값을 돌려준다', () => {
    const { container } = mountCounter(5);
    expect(container.textContent).toBe('5');
  });

  it('setState 후 다시 렌더해서 바뀐 값이 DOM에 반영된다', async () => {
    const { spy, container } = mountCounter();
    spy.setCount(1);
    await flush();
    expect(container.textContent).toBe('1');
  });

  // 렌더는 예약만 하므로, 지금 실행 중인 코드가 끝나기 전에는 화면이 그대로다
  it('setState 직후에는 아직 다시 렌더하지 않는다', () => {
    const { spy, container } = mountCounter();
    spy.setCount(1);
    expect(spy.renders).toBe(1);
    expect(container.textContent).toBe('0');
  });

  it('setState를 연달아 불러도 렌더는 한 번만 한다', async () => {
    const { spy, container } = mountCounter();
    spy.setCount(1);
    spy.setCount(2);
    spy.setCount(3);
    await flush();
    expect(spy.renders).toBe(2);
    expect(container.textContent).toBe('3');
  });

  // 함수를 넘기면 직전 값을 받으므로, 렌더 전에 여러 번 불러도 값이 누적된다
  it('setState에 함수를 넘기면 직전 값으로 다음 값을 계산한다', async () => {
    const { spy, container } = mountCounter();
    spy.setCount((c) => c + 1);
    spy.setCount((c) => c + 1);
    await flush();
    expect(container.textContent).toBe('2');
  });

  it('리렌더 후에도 이전 상태를 이어서 쓴다', async () => {
    const { spy, container } = mountCounter();
    spy.setCount((c) => c + 1);
    await flush();
    spy.setCount((c) => c + 1);
    await flush();
    expect(container.textContent).toBe('2');
  });

  it('초깃값으로 함수를 넘기면 첫 렌더에만 실행한다', async () => {
    let calls = 0;
    const init = () => {
      calls += 1;
      return 7;
    };
    const { spy, container } = mountCounter(init);
    spy.setCount((c) => c + 1);
    await flush();
    expect(calls).toBe(1);
    expect(container.textContent).toBe('8');
  });

  // 훅은 호출 순서로 칸을 찾으므로, 두 상태가 서로의 값을 덮어쓰면 안 된다
  it('useState를 여러 번 부르면 각자 다른 칸을 쓴다', async () => {
    let setB;
    const component = new FunctionComponent(() => {
      const [a] = useState('a');
      const [b, setter] = useState('b');
      setB = setter;
      return text(a + b);
    });
    const container = document.createElement('div');
    component.mount(container);
    setB('B');
    await flush();
    expect(container.textContent).toBe('aB');
  });

  it('렌더 밖에서 useState를 부르면 에러를 던진다', () => {
    expect(() => useState(0)).toThrow();
  });

  // 렌더 중 setState는 렌더를 끝없이 다시 예약할 수 있어서 막는다
  it('렌더 중에 setState를 부르면 에러를 던진다', () => {
    const component = new FunctionComponent(() => {
      const [count, setCount] = useState(0);
      setCount(1);
      return text(count);
    });
    expect(() => component.mount(document.createElement('div'))).toThrow();
  });
});
