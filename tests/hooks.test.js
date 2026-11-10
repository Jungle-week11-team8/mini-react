import { describe, it, expect, vi } from 'vitest';
import { FunctionComponent, h, useState, useEffect, useMemo, areDepsEqual } from '../src/index.js';

describe('Phase 2 — Step 3: Hooks (areDepsEqual, useMemo, useEffect)', () => {
  function createContainer() {
    return document.createElement('div');
  }

  // ──────────────────────────────────────────────
  // 1. areDepsEqual 테스트
  // ──────────────────────────────────────────────
  describe('areDepsEqual', () => {
    it('모든 원소가 Object.is로 같으면 true를 반환한다', () => {
      expect(areDepsEqual([1, 'a', true], [1, 'a', true])).toBe(true);
      expect(areDepsEqual([NaN], [NaN])).toBe(true);
      expect(areDepsEqual([], [])).toBe(true);
    });

    it('하나라도 다른 원소가 있으면 false를 반환한다', () => {
      expect(areDepsEqual([1, 2], [1, 3])).toBe(false);
      expect(areDepsEqual([+0], [-0])).toBe(false);
      expect(areDepsEqual([1], [1, 2])).toBe(false);
    });

    it('prevDeps가 없으면 false를 반환한다', () => {
      expect(areDepsEqual(undefined, [1])).toBe(false);
      expect(areDepsEqual(null, [1])).toBe(false);
    });

    it('nextDeps가 undefined이면 false를 반환한다', () => {
      expect(areDepsEqual([1], undefined)).toBe(false);
    });

    it('동일한 객체 참조라면 true를 반환한다', () => {
      const obj = { value: 1 };

      expect(areDepsEqual([obj], [obj])).toBe(true);
    });

    it('객체의 내용이 같아도 참조가 다르면 false를 반환한다', () => {
      const prev = [{ value: 1 }];
      const next = [{ value: 1 }];

      expect(areDepsEqual(prev, next)).toBe(false);
    });
  });

  // ──────────────────────────────────────────────
  // 2. useMemo 테스트
  // ──────────────────────────────────────────────
  describe('useMemo', () => {
    it('렌더 외부에서 useMemo 호출 시 에러를 던진다', () => {
      expect(() => {
        useMemo(() => 42, []);
      }).toThrow('useMemo: 컴포넌트 렌더링 외부에서 Hook을 호출할 수 없습니다.');
    });

    it('최초 렌더 시 동기적으로 계산하여 값을 반환한다', () => {
      const container = createContainer();
      const computeSpy = vi.fn(() => '계산된 값');

      const App = () => {
        const value = useMemo(computeSpy, []);
        return h('div', {}, value);
      };

      const comp = new FunctionComponent(App, {}, container);
      comp.mount();

      expect(computeSpy).toHaveBeenCalledTimes(1);
      expect(container.textContent).toBe('계산된 값');
    });

    it('deps가 같으면 계산하지 않고 캐시된 값을 반환한다', () => {
      const container = createContainer();
      const computeSpy = vi.fn((count) => count * 10);
      let setUnrelated;
      let setCount;

      const App = () => {
        const [count, _setCount] = useState(1);
        const [unrelated, _setUnrelated] = useState(0);

        setCount = _setCount;
        setUnrelated = _setUnrelated;

        const memoized = useMemo(() => computeSpy(count), [count]);

        return h('div', {}, `${memoized} (unrelated: ${unrelated})`);
      };

      const comp = new FunctionComponent(App, {}, container);
      comp.mount();

      expect(computeSpy).toHaveBeenCalledTimes(1);
      expect(container.textContent).toBe('10 (unrelated: 0)');

      // 의존성과 관계없는 상태 변경
      setUnrelated(1);

      expect(computeSpy).toHaveBeenCalledTimes(1);
      expect(container.textContent).toBe('10 (unrelated: 1)');

      // 의존성 변경
      setCount(2);

      expect(computeSpy).toHaveBeenCalledTimes(2);
      expect(container.textContent).toBe('20 (unrelated: 1)');
    });

    it('deps를 생략하면 매 렌더링마다 계산한다', () => {
      const container = createContainer();
      const computeSpy = vi.fn(() => 42);
      let setCount;

      const App = () => {
        const [count, set] = useState(0);
        setCount = set;

        const value = useMemo(computeSpy);

        return h('div', {}, `${count}: ${value}`);
      };

      const comp = new FunctionComponent(App, {}, container);
      comp.mount();

      expect(computeSpy).toHaveBeenCalledTimes(1);

      setCount(1);

      expect(computeSpy).toHaveBeenCalledTimes(2);
      expect(container.textContent).toBe('1: 42');
    });

    it('계산 결과가 undefined여도 정상적으로 캐싱한다', () => {
      const container = createContainer();
      const computeSpy = vi.fn(() => undefined);
      let setCount;

      const App = () => {
        const [count, set] = useState(0);
        setCount = set;

        const value = useMemo(computeSpy, []);

        return h('div', {}, `${count}: ${String(value)}`);
      };

      const comp = new FunctionComponent(App, {}, container);
      comp.mount();

      expect(computeSpy).toHaveBeenCalledTimes(1);
      expect(container.textContent).toBe('0: undefined');

      setCount(1);

      expect(computeSpy).toHaveBeenCalledTimes(1);
      expect(container.textContent).toBe('1: undefined');
    });
  });

  // ──────────────────────────────────────────────
  // 3. useEffect 테스트
  // ──────────────────────────────────────────────
  describe('useEffect', () => {
    it('렌더 외부에서 useEffect 호출 시 에러를 던진다', () => {
      expect(() => {
        useEffect(() => {}, []);
      }).toThrow('useEffect: 컴포넌트 렌더링 외부에서 Hook을 호출할 수 없습니다.');
    });

    it('DOM Commit 완료 후 effect를 실행한다', () => {
      const container = createContainer();
      let textInEffect = null;

      const App = () => {
        const [text] = useState('렌더된 텍스트');

        useEffect(() => {
          const p = container.querySelector('p');
          textInEffect = p ? p.textContent : null;
        }, []);

        return h('div', {}, h('p', {}, text));
      };

      const comp = new FunctionComponent(App, {}, container);
      comp.mount();

      expect(textInEffect).toBe('렌더된 텍스트');
    });

    it('deps를 생략하면 매 렌더링 후 실행한다', () => {
      const container = createContainer();
      const effectSpy = vi.fn();
      let setCount;

      const App = () => {
        const [count, set] = useState(0);
        setCount = set;

        useEffect(effectSpy);

        return h('span', {}, String(count));
      };

      const comp = new FunctionComponent(App, {}, container);
      comp.mount();

      expect(effectSpy).toHaveBeenCalledTimes(1);

      setCount(1);
      expect(effectSpy).toHaveBeenCalledTimes(2);

      setCount(2);
      expect(effectSpy).toHaveBeenCalledTimes(3);
    });

    it('deps가 []이면 최초 렌더 시에만 실행한다', () => {
      const container = createContainer();
      const effectSpy = vi.fn();
      let setCount;

      const App = () => {
        const [count, set] = useState(0);
        setCount = set;

        useEffect(effectSpy, []);

        return h('span', {}, String(count));
      };

      const comp = new FunctionComponent(App, {}, container);
      comp.mount();

      expect(effectSpy).toHaveBeenCalledTimes(1);

      setCount(1);
      expect(effectSpy).toHaveBeenCalledTimes(1);
    });

    it('의존성 배열의 값이 변경되면 실행하고, 변경되지 않으면 실행하지 않는다', () => {
      const container = createContainer();
      const effectSpy = vi.fn();
      let setA;
      let setB;
      let setC;

      const App = () => {
        const [a, _setA] = useState(0);
        const [b, _setB] = useState('x');
        const [c, _setC] = useState(true);

        setA = _setA;
        setB = _setB;
        setC = _setC;

        useEffect(effectSpy, [a, b]);

        return h('div', {}, `${a}-${b}-${c}`);
      };

      const comp = new FunctionComponent(App, {}, container);
      comp.mount();

      expect(effectSpy).toHaveBeenCalledTimes(1);

      // 의존성에 없는 c 변경
      setC(false);
      expect(effectSpy).toHaveBeenCalledTimes(1);

      // 의존성 a 변경
      setA(1);
      expect(effectSpy).toHaveBeenCalledTimes(2);

      // 의존성 b 변경
      setB('y');
      expect(effectSpy).toHaveBeenCalledTimes(3);
    });

    it('새 effect 실행 전에 이전 cleanup을 먼저 호출한다', () => {
      const container = createContainer();
      const logs = [];
      let setCount;

      const App = () => {
        const [count, set] = useState(1);
        setCount = set;

        useEffect(() => {
          logs.push(`effect-${count}`);

          return () => {
            logs.push(`cleanup-${count}`);
          };
        }, [count]);

        return h('span', {}, String(count));
      };

      const comp = new FunctionComponent(App, {}, container);
      comp.mount();

      expect(logs).toEqual(['effect-1']);

      setCount(2);

      expect(logs).toEqual(['effect-1', 'cleanup-1', 'effect-2']);

      setCount(3);

      expect(logs).toEqual(['effect-1', 'cleanup-1', 'effect-2', 'cleanup-2', 'effect-3']);
    });

    it('deps가 변경되지 않으면 cleanup도 호출하지 않는다', () => {
      const container = createContainer();
      const cleanupSpy = vi.fn();
      let setOther;

      const App = () => {
        const [other, set] = useState(0);
        setOther = set;

        useEffect(() => {
          return cleanupSpy;
        }, []);

        return h('span', {}, String(other));
      };

      const comp = new FunctionComponent(App, {}, container);
      comp.mount();

      expect(cleanupSpy).not.toHaveBeenCalled();

      setOther(1);

      expect(cleanupSpy).not.toHaveBeenCalled();
    });

    it('cleanup을 반환하지 않는 effect도 정상적으로 실행된다', () => {
      const container = createContainer();
      const effectSpy = vi.fn();
      let setCount;

      const App = () => {
        const [count, set] = useState(0);
        setCount = set;

        useEffect(effectSpy, [count]);

        return h('div', {}, String(count));
      };

      const comp = new FunctionComponent(App, {}, container);
      comp.mount();

      expect(effectSpy).toHaveBeenCalledTimes(1);

      setCount(1);

      expect(effectSpy).toHaveBeenCalledTimes(2);
    });

    it.skip('컴포넌트 언마운트 시 마지막 cleanup을 실행한다', () => {
      //추후 구현 후 테스트 진행
      const container = createContainer();
      const cleanupSpy = vi.fn();

      const App = () => {
        useEffect(() => {
          return cleanupSpy;
        }, []);

        return h('div', {}, '화면');
      };

      const comp = new FunctionComponent(App, {}, container);
      comp.mount();

      expect(cleanupSpy).not.toHaveBeenCalled();

      comp.unmount();

      expect(cleanupSpy).toHaveBeenCalledTimes(1);
    });
  });
});
