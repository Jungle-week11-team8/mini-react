import { describe, expect, it, vi } from 'vitest';
import { FunctionComponent, getCurrentComponent } from '../src/component/index.js';

describe('FunctionComponent', () => {
  it('클릭으로 시작한 렌더 중 setter 호출을 차단하고 마지막 DOM을 유지한다', () => {
    const container = document.createElement('div');
    const component = new FunctionComponent(() => {
      const count = component.hooks[0];
      if (count === 0) {
        setCount(1);
      }
      return { type: 'text', text: String(count) };
    }, container);
    const setCount = (value) => component.setState(0, value);
    component.hooks[0] = 2;
    component.mount();
    expect(container.textContent).toBe('2');

    const update = vi.spyOn(component, 'update');
    const button = document.createElement('button');
    button.addEventListener('click', () => setCount(0));
    const handleError = vi.fn((event) => event.preventDefault());
    window.addEventListener('error', handleError);
    try {
      button.click();
    } finally {
      window.removeEventListener('error', handleError);
    }

    expect(handleError).toHaveBeenCalledTimes(1);
    expect(handleError.mock.calls[0][0].error.message).toBe(
      '렌더 중에는 상태를 변경할 수 없습니다.',
    );
    expect(component.hooks[0]).toBe(0);
    expect(container.textContent).toBe('2');
    expect(update).toHaveBeenCalledTimes(1);
    expect(getCurrentComponent).toThrow('Hook은 루트 컴포넌트의 렌더 중에만 호출할 수 있습니다.');

    setCount(3);
    expect(component.hooks[0]).toBe(3);
    expect(container.textContent).toBe('3');
  });

  it('첫 렌더 중에도 상태 변경과 DOM 삽입을 막는다', () => {
    const container = document.createElement('div');
    const component = new FunctionComponent(() => {
      getCurrentComponent().setState(0, 1);
      return { type: 'text', text: '1' };
    }, container);

    expect(() => component.mount()).toThrow('렌더 중에는 상태를 변경할 수 없습니다.');
    expect(component.hooks).toEqual([]);
    expect(container.childNodes).toHaveLength(0);
  });

  it('mount()가 빈 컨테이너에 첫 렌더 결과를 삽입한다', () => {
    const container = document.createElement('div');
    const component = new FunctionComponent(
      ({ message }) => ({
        type: 'element',
        tag: 'p',
        attrs: {},
        children: [{ type: 'text', text: message }],
      }),
      container,
      { message: '첫 화면' },
    );

    expect(container.childNodes).toHaveLength(0);
    component.mount();
    expect(container.innerHTML).toBe('<p>첫 화면</p>');
  });

  it('update() 한 번으로 새 렌더 결과를 DOM에 반영한다', () => {
    const container = document.createElement('div');
    let message = '변경 전';
    const component = new FunctionComponent(() => ({ type: 'text', text: message }), container);

    component.mount();
    expect(container.textContent).toBe('변경 전');

    message = '변경 후';
    component.update();
    expect(container.textContent).toBe('변경 후');
  });

  it('update()를 10회 연속 호출하면 매번 새 렌더 결과를 반영한다', () => {
    const container = document.createElement('div');
    let message = 'A';
    const component = new FunctionComponent(() => ({ type: 'text', text: message }), container);

    component.mount();
    expect(container.textContent).toBe('A');

    // 최초 VNode와 비교하는 오류를 잡으려면 초기값으로 돌아가는 갱신이 필요하다.
    const nextMessages = ['B', 'A', 'C', 'A', 'D', 'A', 'E', 'A', 'F', 'A'];
    for (const nextMessage of nextMessages) {
      message = nextMessage;
      component.update();
      expect(container.textContent).toBe(nextMessage);
    }
  });

  it('mount() 전 update() 호출은 오류를 내고 컨테이너를 비워 둔다', () => {
    const container = document.createElement('div');
    const component = new FunctionComponent(() => ({ type: 'text', text: '첫 화면' }), container);

    expect(() => component.update()).toThrow('update() 전에 mount()를 호출해야 합니다.');
    expect(container.childNodes).toHaveLength(0);
  });

  it('mount()를 두 번 호출하면 처음 삽입한 루트 노드만 유지한다', () => {
    const container = document.createElement('div');
    const component = new FunctionComponent(() => ({ type: 'text', text: '첫 화면' }), container);

    component.mount();
    const root = container.firstChild;

    expect(() => component.mount()).toThrow(
      'mount()는 빈 컨테이너에서 처음 한 번만 호출할 수 있습니다.',
    );
    expect(container.childNodes).toHaveLength(1);
    expect(container.firstChild).toBe(root);
  });

  it('update()로 루트 태그를 교체하면 새 루트만 남는다', () => {
    const container = document.createElement('div');
    let view = { tag: 'p', message: '첫 화면' };
    const component = new FunctionComponent(
      () => ({
        type: 'element',
        tag: view.tag,
        attrs: {},
        children: [{ type: 'text', text: view.message }],
      }),
      container,
    );

    component.mount();
    expect(container.innerHTML).toBe('<p>첫 화면</p>');

    view = { tag: 'section', message: '새 화면' };
    component.update();
    expect(container.innerHTML).toBe('<section>새 화면</section>');
  });
});
