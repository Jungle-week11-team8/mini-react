import { describe, it, expect, vi } from 'vitest';
import { FunctionComponent, useState, useEffect, useMemo } from '../src/index.js';

const text = (value) => ({ type: 'text', text: String(value) });
const flush = () => new Promise((resolve) => setTimeout(resolve));

// #38의 생명주기 검증을 통합 API에 맞춰 확인한다.
describe('통합 컴포넌트 생명주기', () => {
  it('기존 내용이 있는 컨테이너는 렌더 전에 거부한다', () => {
    const container = document.createElement('div');
    container.innerHTML = '<aside>기존 내용</aside>';
    const render = vi.fn(() => text('새 내용'));
    const component = new FunctionComponent(render);
    expect(() => component.mount(container)).toThrow();
    expect(render).not.toHaveBeenCalled();
    expect(container.innerHTML).toBe('<aside>기존 내용</aside>');
  });

  it('중복 mount를 거부하고 기존 루트를 유지한다', () => {
    const container = document.createElement('div');
    const component = new FunctionComponent(() => text('A'));
    component.mount(container);
    const root = container.firstChild;
    expect(() => component.mount(container)).toThrow();
    expect(() => component.mount(document.createElement('div'))).toThrow();
    expect(container.childNodes.length).toBe(1);
    expect(container.firstChild).toBe(root);
  });

  it('mount 전 update를 거부하고 렌더하지 않는다', () => {
    const render = vi.fn(() => text('A'));
    expect(() => new FunctionComponent(render).update()).toThrow();
    expect(render).not.toHaveBeenCalled();
  });

  it('실패한 최초 렌더는 같은 인스턴스에서 재시도할 수 있다', () => {
    let fail = true;
    const effect = vi.fn();
    const container = document.createElement('div');
    const component = new FunctionComponent(() => {
      useEffect(effect, []);
      if (fail) throw new Error('렌더 실패');
      return text('성공');
    });
    expect(() => component.mount(container)).toThrow('렌더 실패');
    expect(container.childNodes.length).toBe(0);
    expect(effect).not.toHaveBeenCalled();
    fail = false;
    component.mount(container);
    expect(container.textContent).toBe('성공');
    expect(effect).toHaveBeenCalledTimes(1);
  });
});

// #39의 동일 값·참조 비교 사례를 #37의 비동기 갱신 계약으로 검증한다.
describe('통합 상태 갱신', () => {
  it.each([0, NaN, undefined, null, 'A', { count: 1 }])(
    '같은 값 %s와 이를 반환하는 updater는 렌더를 예약하지 않는다',
    async (initial) => {
      let setState;
      const render = vi.fn(() => {
        const [state, setter] = useState(initial);
        setState = setter;
        return text(state);
      });
      new FunctionComponent(render).mount(document.createElement('div'));
      setState(initial);
      setState((prev) => prev);
      await flush();
      expect(render).toHaveBeenCalledTimes(1);
    },
  );

  it('내용이 같은 다른 객체와 0에서 -0으로의 변경은 반영한다', async () => {
    let setState;
    const values = [];
    new FunctionComponent(() => {
      const [state, setter] = useState({ count: 1 });
      setState = setter;
      values.push(state);
      return text(state);
    }).mount(document.createElement('div'));
    const next = { count: 1 };
    setState(next);
    await flush();
    expect(values).toHaveLength(2);
    expect(values[1]).toBe(next);
    setState(0);
    await flush();
    setState(-0);
    await flush();
    expect(values).toHaveLength(4);
    expect(Object.is(values[3], -0)).toBe(true);
  });

  it('같은 값 호출이 앞서 예약한 변경을 취소하지 않는다', async () => {
    let setState;
    const container = document.createElement('div');
    const render = vi.fn(() => {
      const [state, setter] = useState(0);
      setState = setter;
      return text(state);
    });
    new FunctionComponent(render).mount(container);
    setState(1);
    setState(1);
    await flush();
    expect(container.textContent).toBe('1');
    expect(render).toHaveBeenCalledTimes(2);
  });

  it('함수형 updater로 함수를 상태값에 저장할 수 있다', async () => {
    let setState;
    let seen;
    new FunctionComponent(() => {
      [seen, setState] = useState(null);
      return text(typeof seen);
    }).mount(document.createElement('div'));
    const callback = vi.fn();
    setState(() => callback);
    await flush();
    expect(seen).toBe(callback);
    expect(callback).not.toHaveBeenCalled();
  });
});

describe('통합 effect와 memo', () => {
  it('실패한 렌더의 의존성을 저장하지 않아 재시도 시 effect를 실행한다', () => {
    let dep = 0;
    let fail = false;
    const effect = vi.fn();
    const cleanup = vi.fn();
    const container = document.createElement('div');
    const component = new FunctionComponent(() => {
      useEffect(() => {
        effect(dep);
        return cleanup;
      }, [dep]);
      if (fail) throw new Error('렌더 실패');
      return text(dep);
    });
    component.mount(container);
    dep = 1;
    fail = true;
    expect(() => component.update()).toThrow('렌더 실패');
    expect(container.textContent).toBe('0');
    expect(cleanup).not.toHaveBeenCalled();
    fail = false;
    component.update();
    expect(container.textContent).toBe('1');
    expect(effect.mock.calls).toEqual([[0], [1]]);
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it.each(['cleanup', 'effect'])(
    '%s 실패 후 재시도할 때 이전 cleanup을 반복하지 않는다',
    (failure) => {
      let dep = 0;
      let fail = false;
      const cleanup = vi.fn(() => {
        if (fail && failure === 'cleanup') throw new Error('cleanup 실패');
      });
      const effect = vi.fn(() => {
        if (fail && failure === 'effect') throw new Error('effect 실패');
        return cleanup;
      });
      const component = new FunctionComponent(() => {
        useEffect(effect, [dep]);
        return text(dep);
      });
      component.mount(document.createElement('div'));
      dep = 1;
      fail = true;
      expect(() => component.update()).toThrow();
      fail = false;
      component.update();
      expect(cleanup).toHaveBeenCalledTimes(1);
      expect(effect).toHaveBeenCalledTimes(failure === 'cleanup' ? 2 : 3);
    },
  );

  it('effect의 상태 변경은 나머지 effect와 cleanup 저장을 마친 뒤 반영한다', async () => {
    const order = [];
    new FunctionComponent(() => {
      const [count, setCount] = useState(0);
      useEffect(() => {
        order.push(`첫 effect ${count}`);
        setCount(1);
        return () => order.push('첫 cleanup');
      }, []);
      useEffect(() => {
        order.push(`둘째 effect ${count}`);
        return () => order.push(`둘째 cleanup ${count}`);
      }, [count]);
      return text(count);
    }).mount(document.createElement('div'));
    await flush();
    expect(order).toEqual(['첫 effect 0', '둘째 effect 0', '둘째 cleanup 0', '둘째 effect 1']);
  });

  it('effect의 직접 update 호출도 effect 실행을 중첩시키지 않는다', async () => {
    const effect = vi.fn(() => component.update());
    const render = vi.fn(() => {
      useEffect(effect, []);
      return text('A');
    });
    const component = new FunctionComponent(render);
    component.mount(document.createElement('div'));
    await flush();
    expect(effect).toHaveBeenCalledTimes(1);
    expect(render).toHaveBeenCalledTimes(2);
  });

  it('외부에서 같은 의존성 배열을 수정해도 이전 의존성과 비교한다', () => {
    const deps = [0];
    const effect = vi.fn();
    const memo = vi.fn(() => deps[0]);
    const container = document.createElement('div');
    const component = new FunctionComponent(() => {
      useEffect(effect, deps);
      return text(useMemo(memo, deps));
    });
    component.mount(container);
    deps[0] = 1;
    component.update();
    expect(effect).toHaveBeenCalledTimes(2);
    expect(memo).toHaveBeenCalledTimes(2);
    expect(container.textContent).toBe('1');
  });

  it('undefined 계산 결과도 의존성이 같으면 캐시한다', () => {
    const memo = vi.fn(() => undefined);
    const component = new FunctionComponent(() => text(useMemo(memo, [])));
    component.mount(document.createElement('div'));
    component.update();
    expect(memo).toHaveBeenCalledTimes(1);
  });
});
