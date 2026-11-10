import { describe, expect, it } from 'vitest';
import { FunctionComponent } from '../src/component/index.js';
import { useState } from '../src/hooks/index.js';

describe('useState', () => {
  it('상태를 호출 순서별로 유지하고 setter로 DOM을 갱신한다', () => {
    const container = document.createElement('div');
    let setCount;
    let setLabel;
    const component = new FunctionComponent(() => {
      const [count, updateCount] = useState(2);
      const [label, updateLabel] = useState('초기');
      setCount ??= updateCount;
      setLabel ??= updateLabel;
      return { type: 'text', text: `${count} / ${label}` };
    }, container);

    component.mount();
    expect(container.textContent).toBe('2 / 초기');

    setCount(0);
    expect(container.textContent).toBe('0 / 초기');

    setLabel(undefined);
    expect(container.textContent).toBe('0 / undefined');

    setCount(3);
    expect(container.textContent).toBe('3 / undefined');
  });

  it('undefined로 초기화한 상태는 다시 렌더해도 유지한다', () => {
    const container = document.createElement('div');
    let initialValue;
    const component = new FunctionComponent(() => {
      const [value] = useState(initialValue);
      return { type: 'text', text: value === undefined ? '미정' : value };
    }, container);

    component.mount();
    expect(container.textContent).toBe('미정');

    initialValue = '새 초기값';
    component.update();
    expect(container.textContent).toBe('미정');
  });

  it('루트 렌더 밖에서 호출하면 오류를 낸다', () => {
    expect(() => useState(0)).toThrow('Hook은 루트 컴포넌트의 렌더 중에만 호출할 수 있습니다.');
  });

  it('렌더 중 호출된 setter는 상태를 쓰기 전에 오류를 낸다', () => {
    const container = document.createElement('div');
    let setCount;
    const component = new FunctionComponent(() => {
      const [count, updateCount] = useState(2);
      setCount ??= updateCount;
      if (count === 0) {
        updateCount(1);
      }
      return { type: 'text', text: String(count) };
    }, container);

    component.mount();
    expect(() => setCount(0)).toThrow('렌더 중에는 상태를 변경할 수 없습니다.');
    expect(component.hooks[0]).toBe(0);
    expect(container.textContent).toBe('2');
  });
});
