import { describe, it, expect, vi, afterEach } from 'vitest';
import { FunctionComponent, useState, useEffect } from '../src/index.js';

// setState는 렌더를 마이크로태스크로 예약하므로, 예약된 작업이 끝날 때까지 기다린다
const flush = () => new Promise((resolve) => setTimeout(resolve));

const text = (value) => ({ type: 'text', text: String(value) });

// deps를 바깥에서 바꾸며, effect가 몇 번 실행됐는지 기록한다
function mountWithEffect(getDeps) {
  const spy = { runs: [], cleanups: [], setCount: null };
  const component = new FunctionComponent(() => {
    const [count, setCount] = useState(0);
    spy.setCount = setCount;
    useEffect(() => {
      spy.runs.push(count);
      return () => spy.cleanups.push(count);
    }, getDeps(count));
    return text(count);
  });
  const container = document.createElement('div');
  component.mount(container);
  return { spy, container };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useEffect', () => {
  // effect는 DOM 반영이 끝난 뒤에 실행해야 바뀐 화면을 읽을 수 있다
  it('mount 후 DOM이 반영된 다음에 effect를 실행한다', () => {
    let seen;
    const container = document.createElement('div');
    new FunctionComponent(() => {
      useEffect(() => {
        seen = container.textContent;
      });
      return text('A');
    }).mount(container);
    expect(seen).toBe('A');
  });

  it('update 후에도 DOM이 반영된 다음에 effect를 실행한다', async () => {
    let seen;
    let setCount;
    const container = document.createElement('div');
    new FunctionComponent(() => {
      const [count, setter] = useState(0);
      setCount = setter;
      useEffect(() => {
        seen = container.textContent;
      });
      return text(count);
    }).mount(container);
    setCount(1);
    await flush();
    expect(seen).toBe('1');
  });

  it('의존성 배열이 없으면 매 렌더마다 실행한다', async () => {
    const { spy } = mountWithEffect(() => undefined);
    spy.setCount(1);
    await flush();
    expect(spy.runs).toEqual([0, 1]);
  });

  it('빈 배열이면 첫 렌더에만 실행한다', async () => {
    const { spy } = mountWithEffect(() => []);
    spy.setCount(1);
    await flush();
    expect(spy.runs).toEqual([0]);
  });

  it('의존성 값이 바뀔 때만 다시 실행한다', async () => {
    // count가 2 이상일 때만 의존성 값이 바뀐다
    const { spy } = mountWithEffect((count) => [count >= 2]);
    spy.setCount(1);
    await flush();
    spy.setCount(2);
    await flush();
    expect(spy.runs).toEqual([0, 2]);
  });

  // ===로 비교하면 NaN !== NaN이라 매번 다시 실행되므로 Object.is로 비교한다
  it('의존성에 NaN이 그대로 있으면 다시 실행하지 않는다', async () => {
    const { spy } = mountWithEffect(() => [NaN]);
    spy.setCount(1);
    await flush();
    expect(spy.runs).toEqual([0]);
  });

  it('다음 effect를 실행하기 전에 이전 effect의 cleanup을 부른다', async () => {
    const order = [];
    let setCount;
    new FunctionComponent(() => {
      const [count, setter] = useState(0);
      setCount = setter;
      useEffect(() => {
        order.push(`effect ${count}`);
        return () => order.push(`cleanup ${count}`);
      });
      return text(count);
    }).mount(document.createElement('div'));
    setCount(1);
    await flush();
    expect(order).toEqual(['effect 0', 'cleanup 0', 'effect 1']);
  });

  it('effect를 건너뛰면 cleanup도 부르지 않는다', async () => {
    const { spy } = mountWithEffect(() => []);
    spy.setCount(1);
    await flush();
    expect(spy.cleanups).toEqual([]);
  });

  // effect는 렌더가 끝난 뒤에 돌므로, 그 안의 setState는 다음 렌더를 예약할 수 있다
  it('effect 안에서 setState를 부르면 다시 렌더한다', async () => {
    const container = document.createElement('div');
    new FunctionComponent(() => {
      const [count, setCount] = useState(0);
      useEffect(() => {
        setCount(1);
      }, []);
      return text(count);
    }).mount(container);
    await flush();
    expect(container.textContent).toBe('1');
  });

  it('렌더 밖에서 useEffect를 부르면 에러를 던진다', () => {
    expect(() => useEffect(() => {})).toThrow();
  });

  describe('effect 안 setState 연속 렌더 상한', () => {
    // 예약된 렌더를 직접 꺼내 실행해야 마이크로태스크 안에서 던진 에러를 잡을 수 있다
    function stubMicrotasks() {
      const queue = [];
      vi.stubGlobal('queueMicrotask', (task) => queue.push(task));
      return () => {
        while (queue.length > 0) queue.shift()();
      };
    }

    it('effect 안 setState로 렌더가 50번을 넘게 이어지면 에러를 던진다', () => {
      const drain = stubMicrotasks();
      let renders = 0;
      new FunctionComponent(() => {
        renders += 1;
        const [count, setCount] = useState(0);
        useEffect(() => {
          setCount(count + 1);
        });
        return text(count);
      }).mount(document.createElement('div'));
      expect(drain).toThrow();
      // mount 1번 + effect가 부른 렌더 50번까지는 허용한다
      expect(renders).toBe(51);
    });

    it('50번 안에 멈추면 에러 없이 끝난다', () => {
      const drain = stubMicrotasks();
      const container = document.createElement('div');
      new FunctionComponent(() => {
        const [count, setCount] = useState(0);
        useEffect(() => {
          if (count < 50) setCount(count + 1);
        });
        return text(count);
      }).mount(container);
      expect(drain).not.toThrow();
      expect(container.textContent).toBe('50');
    });

    // 사용자 동작으로 생긴 렌더는 effect 반복이 아니므로 횟수를 다시 센다
    it('effect 밖에서 부른 setState는 횟수를 0부터 다시 센다', () => {
      const drain = stubMicrotasks();
      let setCount;
      new FunctionComponent(() => {
        const [count, setter] = useState(0);
        setCount = setter;
        // 50의 배수가 될 때까지 effect가 계속 렌더를 부른다
        useEffect(() => {
          if (count % 50 !== 0) setter(count + 1);
        });
        return text(count);
      }).mount(document.createElement('div'));
      setCount(1);
      expect(drain).not.toThrow();
      setCount(51);
      expect(drain).not.toThrow();
    });
  });
});
