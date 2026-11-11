import { describe, it, expect } from 'vitest';
import { h, diff } from '../src/index.js';

// JSX가 h()로 변환될 때 React 관례 이름이 DOM에 그대로 새지 않는지 확인한다 (AGENTS.md JSX 사용 규칙)
describe('h(): JSX 관례 prop 처리', () => {
  describe('key', () => {
    it('key는 attrs가 아니라 VNode의 key 필드에 문자열로 들어간다', () => {
      const vnode = h('li', { key: 3, className: 'todo' }, '할 일');
      expect(vnode.key).toBe('3');
      expect(vnode.attrs.key).toBeUndefined();
      expect(vnode.attrs.class).toBe('todo');
    });

    it('key가 없거나 null이면 key 필드를 만들지 않는다', () => {
      expect('key' in h('li', {})).toBe(false);
      expect('key' in h('li', { key: null })).toBe(false);
    });

    it('key만 다른 두 요소는 diff에서 patch를 만들지 않는다 (diff는 인덱스 기반 유지)', () => {
      expect(diff(h('li', { key: 'a' }, 'x'), h('li', { key: 'b' }, 'x'))).toEqual([]);
    });
  });

  describe('속성 이름 변환', () => {
    it('htmlFor는 for 속성이 된다', () => {
      const vnode = h('label', { htmlFor: 'title' }, '제목');
      expect(vnode.attrs.for).toBe('title');
      expect(vnode.attrs.htmlFor).toBeUndefined();
    });

    it('ref는 attrs에 들어가지 않는다', () => {
      const vnode = h('input', { ref: { current: null } });
      expect(vnode.attrs.ref).toBeUndefined();
    });
  });

  describe('이벤트 이름 변환', () => {
    it('onClick, onInput은 소문자 DOM 이벤트 이름이 된다', () => {
      const onClick = () => {};
      const onInput = () => {};
      const vnode = h('input', { onClick, onInput });
      expect(vnode.events).toEqual({ click: onClick, input: onInput });
    });

    it('onDoubleClick은 dblclick 이벤트가 된다', () => {
      const handler = () => {};
      const vnode = h('span', { onDoubleClick: handler });
      expect(vnode.events.dblclick).toBe(handler);
      expect(vnode.events.doubleclick).toBeUndefined();
    });
  });

  it('변환 후에도 VNode에 함수 없는 부분(attrs, key)은 structuredClone할 수 있다', () => {
    const vnode = h('li', { key: 1, htmlFor: 'x', onDoubleClick: () => {}, ref: {} });
    expect(() => structuredClone({ attrs: vnode.attrs, key: vnode.key })).not.toThrow();
  });
});
