import { describe, it, expect, vi } from 'vitest';
import { FunctionComponent, h, useState } from '../src/index.js';

describe('Phase 2 — Step 2: State (useState & 반응형 갱신)', () => {
  function createContainer() {
    return document.createElement('div');
  }

  it('렌더 외부에서 useState를 호출하면 명확한 에러를 던진다', () => {
    expect(() => {
      useState(0);
    }).toThrow('useState: 컴포넌트 렌더링 외부에서 Hook을 호출할 수 없습니다.');
  });

  it('여러 useState를 호출해도 순서대로 독립된 슬롯에 저장되고 재렌더 시 유지된다', () => {
    const container = createContainer();
    let setFirst, setSecond;

    const App = () => {
      const [count, setCount] = useState(10);
      const [text, setText] = useState('초기값');

      setFirst = setCount;
      setSecond = setText;

      return h('div', {}, `${count} - ${text}`);
    };

    const comp = new FunctionComponent(App, {}, container);
    comp.mount();

    expect(container.innerHTML).toBe('<div>10 - 초기값</div>');
    expect(comp.hooks).toEqual([10, '초기값']);

    setFirst(20);

    expect(container.innerHTML).toBe('<div>20 - 초기값</div>');
    expect(comp.hooks).toEqual([20, '초기값']);

    setSecond('바뀐값');

    expect(container.innerHTML).toBe('<div>20 - 바뀐값</div>');
    expect(comp.hooks).toEqual([20, '바뀐값']);
  });

  it('초기값으로 함수를 전달하면 최초 렌더링 시에만 1회 호출된다 (Lazy Init)', () => {
    const container = createContainer();
    const initFn = vi.fn(() => 42);
    let setVal;

    const App = () => {
      const [val, set] = useState(initFn);
      setVal = set;
      return h('p', {}, String(val));
    };

    const comp = new FunctionComponent(App, {}, container);
    comp.mount();

    expect(initFn).toHaveBeenCalledTimes(1);
    expect(container.innerHTML).toBe('<p>42</p>');

    setVal(100);

    expect(initFn).toHaveBeenCalledTimes(1);
    expect(container.innerHTML).toBe('<p>100</p>');
  });

  it('setter는 클로저로 캡처한 슬롯을 갱신하고 화면을 자동으로 다시 그린다', () => {
    const container = createContainer();
    let inc;

    const Counter = () => {
      const [count, setCount] = useState(0);
      inc = () => setCount(count + 1);

      return h('div', { id: 'counter' }, h('span', {}, `현재 카운트: ${count}`));
    };

    const comp = new FunctionComponent(Counter, {}, container);
    comp.mount();

    expect(container.querySelector('span').textContent).toBe('현재 카운트: 0');

    inc();
    expect(container.querySelector('span').textContent).toBe('현재 카운트: 1');

    inc();
    expect(container.querySelector('span').textContent).toBe('현재 카운트: 2');
  });

  it('새 값이 이전 값과 Object.is로 같으면 update(리렌더링)를 생략한다', () => {
    const container = createContainer();
    const renderSpy = vi.fn();
    let setVal;

    const App = () => {
      renderSpy();

      const [val, set] = useState('hello');
      setVal = set;

      return h('div', {}, val);
    };

    const comp = new FunctionComponent(App, {}, container);
    comp.mount();

    expect(renderSpy).toHaveBeenCalledTimes(1);

    setVal('hello');

    expect(renderSpy).toHaveBeenCalledTimes(1);
  });

  it('NaN을 다시 전달하면 Object.is 비교에 의해 리렌더링을 생략한다', () => {
    const container = createContainer();
    let setNaN;

    const App = () => {
      const [val, set] = useState(NaN);
      setNaN = set;

      return h('span', {}, String(val));
    };

    const comp = new FunctionComponent(App, {}, container);
    comp.mount();

    const updateSpy = vi.spyOn(comp, 'update');

    setNaN(NaN);

    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('동일한 객체 참조를 전달하면 리렌더링하지 않는다', () => {
    const container = createContainer();
    const renderSpy = vi.fn();
    let setUser;

    const user = { name: '철수' };

    const App = () => {
      renderSpy();

      const [value, setValue] = useState(user);
      setUser = setValue;

      return h('div', {}, value.name);
    };

    const comp = new FunctionComponent(App, {}, container);
    comp.mount();

    setUser(user);

    expect(renderSpy).toHaveBeenCalledTimes(1);
  });

  it('내용이 같더라도 다른 객체 참조라면 리렌더링한다', () => {
    const container = createContainer();
    const renderSpy = vi.fn();
    let setUser;

    const App = () => {
      renderSpy();

      const [user, set] = useState({ name: '철수' });
      setUser = set;

      return h('div', {}, user.name);
    };

    const comp = new FunctionComponent(App, {}, container);
    comp.mount();

    setUser({ name: '철수' });

    expect(renderSpy).toHaveBeenCalledTimes(2);
    expect(container.textContent).toBe('철수');
  });

  it('setState(prev => next) 함수형 업데이트를 지원한다', () => {
    const container = createContainer();
    let setCountFn;

    const App = () => {
      const [count, setCount] = useState(0);
      setCountFn = setCount;

      return h('div', {}, `Count: ${count}`);
    };

    const comp = new FunctionComponent(App, {}, container);
    comp.mount();

    expect(container.innerHTML).toBe('<div>Count: 0</div>');

    setCountFn((prev) => prev + 5);

    expect(container.innerHTML).toBe('<div>Count: 5</div>');

    setCountFn((prev) => prev * 2);

    expect(container.innerHTML).toBe('<div>Count: 10</div>');
  });

  it('연속된 함수형 업데이트는 직전 상태를 기준으로 계산한다', () => {
    const container = createContainer();
    let setCount;

    const App = () => {
      const [count, set] = useState(0);
      setCount = set;

      return h('div', {}, String(count));
    };

    const comp = new FunctionComponent(App, {}, container);
    comp.mount();

    setCount((prev) => prev + 1);
    setCount((prev) => prev + 1);
    setCount((prev) => prev + 1);

    expect(container.textContent).toBe('3');
  });

  it('상태 변경 시 변경되지 않은 DOM 노드는 재사용한다', () => {
    const container = createContainer();
    let setCount;

    const App = () => {
      const [count, set] = useState(0);
      setCount = set;

      return h('div', {}, h('span', {}, String(count)), h('p', {}, '변경되지 않는 내용'));
    };

    const comp = new FunctionComponent(App, {}, container);
    comp.mount();

    const pEl = container.querySelector('p');

    setCount(1);

    expect(container.querySelector('span').textContent).toBe('1');
    expect(container.querySelector('p')).toBe(pEl);
  });

  it('함수형 업데이트를 통해 함수를 상태값으로 저장할 수 있다', () => {
    const container = createContainer();
    let setValue;

    const App = () => {
      const [value, set] = useState(null);
      setValue = set;

      return h('div', {}, typeof value);
    };

    const comp = new FunctionComponent(App, {}, container);
    comp.mount();

    setValue(() => () => 42);

    expect(container.textContent).toBe('function');
    expect(comp.hooks[0]()).toBe(42);
  });

  it('자식 컴포넌트에 콜백 props를 전달하여 부모 상태를 갱신할 수 있다', () => {
    const container = createContainer();

    const Button = ({ onClick, label }) => {
      return h(
        'button',
        {
          'data-label': label,
          onClick,
        },
        label,
      );
    };

    const Accordion = () => {
      const [isOpen, setIsOpen] = useState(false);
      const toggleOpen = () => setIsOpen((prev) => !prev);

      return h(
        'div',
        {},
        Button({
          onClick: toggleOpen,
          label: isOpen ? '닫기' : '열기',
        }),
        isOpen ? h('p', {}, '상세 내용 표시') : null,
      );
    };

    const comp = new FunctionComponent(Accordion, {}, container);
    comp.mount();

    expect(container.querySelector('button').textContent).toBe('열기');
    expect(container.querySelector('p')).toBeNull();

    container.querySelector('button').click();

    expect(container.querySelector('button').textContent).toBe('닫기');
    expect(container.querySelector('p').textContent).toBe('상세 내용 표시');

    container.querySelector('button').click();

    expect(container.querySelector('button').textContent).toBe('열기');
    expect(container.querySelector('p')).toBeNull();
  });
});
