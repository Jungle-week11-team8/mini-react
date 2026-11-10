import { describe, it, expect } from 'vitest';
import { FunctionComponent, domToVNode } from '../src/index.js';

const App = () => ({ type: 'text', text: 'A' });

describe('FunctionComponent', () => {
  describe('생성자', () => {
    it('fn과 props를 그대로 보관한다', () => {
      const props = { title: 'A' };
      const component = new FunctionComponent(App, props);
      expect(component.fn).toBe(App);
      expect(component.props).toBe(props);
    });

    it('props를 생략하면 빈 객체가 된다', () => {
      expect(new FunctionComponent(App).props).toEqual({});
    });

    it('hooks는 빈 배열, hookIndex는 0으로 시작한다', () => {
      const component = new FunctionComponent(App);
      expect(component.hooks).toEqual([]);
      expect(component.hookIndex).toBe(0);
    });

    it('인스턴스마다 hooks 배열이 따로 있다', () => {
      expect(new FunctionComponent(App).hooks).not.toBe(new FunctionComponent(App).hooks);
    });

    it('fn이 함수가 아니면 TypeError가 난다', () => {
      expect(() => new FunctionComponent(null)).toThrow(TypeError);
      expect(() => new FunctionComponent({ type: 'text', text: 'A' })).toThrow(TypeError);
    });
  });

  describe('mount', () => {
    const Title = (props) => ({
      type: 'element',
      tag: 'h1',
      attrs: { class: 'title' },
      children: [{ type: 'text', text: props.text }],
    });

    it('fn이 반환한 VNode대로 container에 실제 DOM을 그린다', () => {
      const container = document.createElement('div');
      new FunctionComponent(Title, { text: 'A' }).mount(container);
      expect(domToVNode(container.childNodes[0])).toEqual(Title({ text: 'A' }));
    });

    it('fn은 생성자에서 받은 props를 인자로 받는다', () => {
      const container = document.createElement('div');
      new FunctionComponent(Title, { text: 'B' }).mount(container);
      expect(container.textContent).toBe('B');
    });

    // update에서 container를 다시 찾고, 이전 VNode와 diff해야 하므로 둘 다 기억해야 한다
    it('mount 후 container와 그린 VNode를 보관한다', () => {
      const container = document.createElement('div');
      const component = new FunctionComponent(Title, { text: 'A' });
      component.mount(container);
      expect(component.container).toBe(container);
      expect(component.vnode).toEqual(Title({ text: 'A' }));
    });

    // 훅은 호출 순서로 칸을 찾으므로, 렌더마다 첫 칸부터 다시 읽어야 한다
    it('render를 시작할 때 hookIndex가 0으로 돌아간다', () => {
      let seen;
      const component = new FunctionComponent(() => {
        seen = component.hookIndex;
        return { type: 'text', text: 'A' };
      });
      component.hookIndex = 3;
      component.mount(document.createElement('div'));
      expect(seen).toBe(0);
    });
  });

  describe('update', () => {
    // 훅이 아직 없으므로, 바깥 변수로 "상태가 바뀐 상황"을 흉내 낸다
    function setup() {
      const state = { text: 'A' };
      const Title = () => ({
        type: 'element',
        tag: 'h1',
        attrs: {},
        children: [{ type: 'text', text: state.text }],
      });
      const container = document.createElement('div');
      const component = new FunctionComponent(Title);
      component.mount(container);
      return { state, Title, container, component };
    }

    it('다시 렌더한 VNode대로 실제 DOM을 고친다', () => {
      const { state, Title, container, component } = setup();
      state.text = 'B';
      component.update();
      expect(domToVNode(container.childNodes[0])).toEqual(Title());
    });

    // 다음 update는 방금 그린 화면과 비교해야 하므로 기준 VNode를 갈아 끼운다
    it('update 후 vnode가 새 VNode로 바뀐다', () => {
      const { state, Title, component } = setup();
      state.text = 'B';
      component.update();
      expect(component.vnode).toEqual(Title());
    });

    // 통째로 다시 그리지 않고 diff로 바뀐 곳만 고쳤는지 확인한다
    it('바뀌지 않은 루트 요소는 같은 DOM 노드로 남는다', () => {
      const { state, container, component } = setup();
      const root = container.childNodes[0];
      state.text = 'B';
      component.update();
      expect(container.childNodes[0]).toBe(root);
      expect(container.childNodes.length).toBe(1);
    });

    it('update도 hookIndex를 0으로 되돌린 뒤 렌더한다', () => {
      const { component } = setup();
      component.hookIndex = 2;
      component.update();
      expect(component.hookIndex).toBe(0);
    });
  });
});
