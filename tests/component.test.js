import { describe, it, expect } from 'vitest';
import { FunctionComponent, h, getCurrentComponent } from '../src/index.js';

describe('Phase 2 — Step 1: FunctionComponent (컴포넌트 렌더링 & 파이프라인)', () => {
  function createContainer() {
    return document.createElement('div');
  }

  it('생성자는 (componentFn, props, container)를 받는다', () => {
    const container = createContainer();
    const fn = (props) => h('div', {}, props.text);
    const comp = new FunctionComponent(fn, { text: 'hello' }, container);

    expect(comp.componentFn).toBe(fn);
    expect(comp.props).toEqual({ text: 'hello' });
    expect(comp.container).toBe(container);
    expect(comp.hooks).toEqual([]);
    expect(comp.hookIndex).toBe(0);
    expect(comp.prevVdom).toBeNull();
  });

  it('mount()는 컴포넌트를 렌더링하여 컨테이너에 실제 DOM을 삽입한다', () => {
    const container = createContainer();
    const App = (props) =>
      h('div', { id: 'root' },
        h('h1', {}, props.title),
        h('p', {}, '내용')
      );

    const comp = new FunctionComponent(App, { title: '타이틀' }, container);
    comp.mount();

    expect(container.innerHTML).toBe('<div id="root"><h1>타이틀</h1><p>내용</p></div>');
    expect(comp.prevVdom).toEqual({
      type: 'element',
      tag: 'div',
      attrs: { id: 'root' },
      children: [
        { type: 'element', tag: 'h1', attrs: {}, children: [{ type: 'text', text: '타이틀' }] },
        { type: 'element', tag: 'p', attrs: {}, children: [{ type: 'text', text: '내용' }] },
      ],
    });
  });

  it('update()는 새 VNode를 diff/patch하여 변경된 부분만 실제 DOM에 반영한다', () => {
    const container = createContainer();
    const App = (props) =>
      h('div', { id: 'app' },
        h('h1', {}, props.title),
        h('p', {}, '고정된 내용')
      );

    const comp = new FunctionComponent(App, { title: '첫 번째 제목' }, container);
    comp.mount();

    const rootEl = container.childNodes[0];
    const pEl = rootEl.childNodes[1]; // 두 번째 자식 <p>

    // props 변경 후 update()
    comp.props = { title: '변경된 제목' };
    comp.update();

    expect(container.innerHTML).toBe('<div id="app"><h1>변경된 제목</h1><p>고정된 내용</p></div>');
    // Diff/Patch 확인: 변경되지 않은 <p> 노드는 그대로 유지되어야 함 (참조 동일성)
    expect(container.childNodes[0]).toBe(rootEl);
    expect(rootEl.childNodes[1]).toBe(pEl);
    // C-6: prevVdom이 새로운 VNode로 갱신됨
    expect(comp.prevVdom.children[0].children[0].text).toBe('변경된 제목');
  });

  it('render() 동안만 currentComponent가 설정되고, 에러가 나도 null로 정리된다', () => {
    const container = createContainer();
    let currentDuringRender = null;

    const App = () => {
      currentDuringRender = getCurrentComponent();
      return h('span', {}, 'ok');
    };

    const comp = new FunctionComponent(App, {}, container);
    expect(getCurrentComponent()).toBeNull();

    comp.mount();
    expect(currentDuringRender).toBe(comp);
    expect(getCurrentComponent()).toBeNull();

    // 렌더 도중 throw 발생 시에도 currentComponent가 안전하게 null로 복구되는지 검증
    const ErrorApp = () => {
      throw new Error('의도적인 렌더 에러');
    };
    const errorComp = new FunctionComponent(ErrorApp, {}, container);

    expect(() => errorComp.render()).toThrow('의도적인 렌더 에러');
    expect(getCurrentComponent()).toBeNull();
  });

  it('자식 컴포넌트는 (props) => vdom 순수 함수로 직접 호출된다', () => {
    const container = createContainer();

    // 자식 컴포넌트: 순수 함수
    const TodoItem = ({ text, done }) =>
      h('li', { class: done ? 'done' : 'pending' }, text);

    // 루트 컴포넌트: 자식을 직접 호출하여 VNode 트리를 구성
    const TodoList = ({ todos }) =>
      h('ul', {},
        todos.map((todo) => TodoItem(todo))
      );

    const comp = new FunctionComponent(
      TodoList,
      {
        todos: [
          { text: '할 일 1', done: false },
          { text: '할 일 2', done: true },
        ],
      },
      container
    );

    comp.mount();

    expect(container.innerHTML).toBe(
      '<ul><li class="pending">할 일 1</li><li class="done">할 일 2</li></ul>'
    );
  });

  it('변경 사항이 없으면 기존 DOM 노드를 유지한다', () => {
    const container = createContainer();

    const App = () =>
      h('div', { id: 'app' },
        h('p', {}, '고정된 내용')
      );

    const comp = new FunctionComponent(App, {}, container);
    comp.mount();

    const rootEl = container.firstChild;
    const pEl = rootEl.firstChild;

    comp.update();

    expect(container.firstChild).toBe(rootEl);
    expect(rootEl.firstChild).toBe(pEl);
    expect(container.innerHTML).toBe(
      '<div id="app"><p>고정된 내용</p></div>'
    );
  });

  it('Attribute를 추가, 변경, 삭제한다', () => {
    const container = createContainer();

    const App = ({ mode }) => {
      if (mode === 'initial') {
        return h('button', {
          id: 'old-btn',
          class: 'inactive',
          title: '비활성화'
        }, '버튼');
      }

      if (mode === 'update') {
        return h('button', {
          id: 'new-btn',
          class: 'active',
          title: '활성화'
        }, '버튼');
      }

      return h('button', {
        id: 'new-btn',
        class: 'active'
      }, '버튼');
    };

    const comp = new FunctionComponent(
      App,
      { mode: 'initial' },
      container
    );

    comp.mount();

    const button = container.firstChild;

    // Attribute 변경
    comp.props = { mode: 'update' };
    comp.update();

    expect(button.getAttribute('id')).toBe('new-btn');
    expect(button.getAttribute('class')).toBe('active');
    expect(button.getAttribute('title')).toBe('활성화');

    // Attribute 삭제
    comp.props = { mode: 'remove' };
    comp.update();

    expect(button.hasAttribute('title')).toBe(false);
    expect(button.getAttribute('id')).toBe('new-btn');
    expect(button.getAttribute('class')).toBe('active');
  });

  it('자식 노드를 추가하고 삭제한다', () => {
    const container = createContainer();

    const App = ({ show }) =>
      h('ul', {},
        h('li', {}, '사과'),
        ...(show ? [h('li', {}, '바나나')] : [])
      );

    const comp = new FunctionComponent(App, { show: false }, container);
    comp.mount();

    const ul = container.firstChild;
    const apple = ul.firstChild;

    comp.props = { show: true };
    comp.update();

    expect(ul.children.length).toBe(2);
    expect(ul.children[0]).toBe(apple);
    expect(ul.children[1].textContent).toBe('바나나');

    const banana = ul.children[1];

    comp.props = { show: false };
    comp.update();

    expect(ul.children.length).toBe(1);
    expect(ul.firstChild).toBe(apple);
    expect(ul.contains(banana)).toBe(false);
  });

  it('Element와 Text 노드를 서로 교체한다', () => {
    const container = createContainer();

    const App = ({ useElement }) =>
      useElement
        ? h('div', {}, h('span', {}, '안녕하세요'))
        : h('div', {}, '안녕하세요');

    const comp = new FunctionComponent(
      App,
      { useElement: true },
      container
    );

    comp.mount();

    const div = container.firstChild;
    const span = div.firstChild;

    expect(span.nodeType).toBe(Node.ELEMENT_NODE);

    comp.props = { useElement: false };
    comp.update();

    expect(div.firstChild.nodeType).toBe(Node.TEXT_NODE);
    expect(div.textContent).toBe('안녕하세요');
    expect(div.firstChild).not.toBe(span);

    comp.props = { useElement: true };
    comp.update();

    expect(div.firstChild.nodeType).toBe(Node.ELEMENT_NODE);
    expect(div.firstChild.tagName).toBe('SPAN');
    expect(div.textContent).toBe('안녕하세요');
  });

  it('중첩된 자식 노드의 변경 사항을 반영한다', () => {
    const container = createContainer();

    const App = ({ price }) =>
      h('div', { class: 'product' },
        h('section', {},
          h('article', {},
            h('span', {}, '상품명: 사과'),
            h('strong', {}, `${price}원`)
          )
        )
      );

    const comp = new FunctionComponent(App, { price: 3000 }, container);
    comp.mount();

    const root = container.firstChild;
    const section = root.firstChild;
    const article = section.firstChild;
    const name = article.childNodes[0];
    const priceEl = article.childNodes[1];

    comp.props = { price: 5000 };
    comp.update();

    expect(container.textContent).toBe('상품명: 사과5000원');

    // 변경되지 않은 상위 노드와 상품명 노드는 유지
    expect(container.firstChild).toBe(root);
    expect(root.firstChild).toBe(section);
    expect(section.firstChild).toBe(article);
    expect(article.childNodes[0]).toBe(name);

    // 가격만 변경되었는지 확인
    expect(article.childNodes[1]).toBe(priceEl);
    expect(priceEl.textContent).toBe('5000원');
  });

  it('update() 중 렌더링 오류가 발생해도 currentComponent를 정리한다', () => {
    const container = createContainer();

    const App = ({ shouldThrow }) => {
      if (shouldThrow) {
        throw new Error('업데이트 렌더링 오류');
      }

      return h('div', {}, '정상 렌더링');
    };

    const comp = new FunctionComponent(
      App,
      { shouldThrow: false },
      container
    );

    comp.mount();

    const oldDom = container.firstChild;
    const oldVdom = comp.prevVdom;

    comp.props = { shouldThrow: true };

    expect(() => comp.update()).toThrow('업데이트 렌더링 오류');

    expect(getCurrentComponent()).toBeNull();

    // 렌더링 실패 시 기존 DOM과 VDOM 보존 여부
    expect(container.firstChild).toBe(oldDom);
    expect(comp.prevVdom).toBe(oldVdom);
  });

  it('이미 마운트된 컴포넌트를 다시 mount하면 에러를 발생시킨다', () => {
    const container = createContainer();

    const App = () => h('div', {}, 'Hello');

    const comp = new FunctionComponent(App, {}, container);

    comp.mount();

    expect(container.children.length).toBe(1);

    expect(() => comp.mount()).toThrow(
      'FunctionComponent: 이미 마운트된 컴포넌트입니다.'
    );

    // 중복 mount로 기존 DOM이 영향을 받지 않았는지도 확인
    expect(container.children.length).toBe(1);
    expect(container.firstChild.textContent).toBe('Hello');
  });

});

