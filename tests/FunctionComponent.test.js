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
});
