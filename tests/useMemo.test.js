import { describe, it, expect } from 'vitest';
import { FunctionComponent, useState, useMemo } from '../src/index.js';

// setState는 렌더를 마이크로태스크로 예약하므로, 예약된 작업이 끝날 때까지 기다린다
const flush = () => new Promise((resolve) => setTimeout(resolve));

const text = (value) => ({ type: 'text', text: String(value) });

// deps를 바깥에서 바꾸며, factory가 몇 번 실행됐는지와 돌려받은 값을 기록한다
function mountWithMemo(getDeps) {
  const spy = { calls: 0, values: [], setCount: null };
  const component = new FunctionComponent(() => {
    const [count, setCount] = useState(0);
    spy.setCount = setCount;
    const value = useMemo(() => {
      spy.calls += 1;
      return { doubled: count * 2 };
    }, getDeps(count));
    spy.values.push(value);
    return text(value.doubled);
  });
  const container = document.createElement('div');
  component.mount(container);
  return { spy, container };
}

describe('useMemo', () => {
  it('첫 렌더에 factory를 실행해 그 값을 돌려준다', () => {
    const { spy, container } = mountWithMemo((count) => [count]);
    expect(spy.calls).toBe(1);
    expect(container.textContent).toBe('0');
  });

  // 캐시의 목적은 계산을 건너뛰는 것과, 같은 참조를 유지하는 것이다
  it('의존성이 그대로면 다시 계산하지 않고 같은 값을 돌려준다', async () => {
    const { spy } = mountWithMemo(() => ['fixed']);
    spy.setCount(1);
    await flush();
    expect(spy.calls).toBe(1);
    expect(spy.values[1]).toBe(spy.values[0]);
  });

  it('의존성이 바뀌면 다시 계산한다', async () => {
    const { spy, container } = mountWithMemo((count) => [count]);
    spy.setCount(3);
    await flush();
    expect(spy.calls).toBe(2);
    expect(container.textContent).toBe('6');
  });

  it('의존성 배열이 없으면 매 렌더 다시 계산한다', async () => {
    const { spy } = mountWithMemo(() => undefined);
    spy.setCount(1);
    await flush();
    expect(spy.calls).toBe(2);
  });

  // ===로 비교하면 NaN !== NaN이라 매번 다시 계산되므로 Object.is로 비교한다
  it('의존성에 NaN이 그대로 있으면 다시 계산하지 않는다', async () => {
    const { spy } = mountWithMemo(() => [NaN]);
    spy.setCount(1);
    await flush();
    expect(spy.calls).toBe(1);
  });

  // effect와 달리 반환값을 렌더에 바로 써야 하므로, 렌더 도중에 계산이 끝나 있어야 한다
  it('렌더 중에 바로 계산해서 그 렌더의 결과에 쓴다', async () => {
    const { spy, container } = mountWithMemo((count) => [count]);
    spy.setCount(2);
    await flush();
    expect(container.textContent).toBe('4');
  });

  it('렌더 밖에서 useMemo를 부르면 에러를 던진다', () => {
    expect(() => useMemo(() => 1, [])).toThrow();
  });
});
