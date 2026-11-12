import { describe, it, expect } from 'vitest';
import { h, applyPatches } from '../src/index.js';

describe('보완 기능 및 엣지 케이스 단위 테스트', () => {
  function createContainer() {
    return document.createElement('div');
  }

  describe('h() 헬퍼 함수 및 불리언 속성 (AGENTS.md 규칙 준수)', () => {
    it('disabled: false나 checked: false는 속성을 아예 넣지 않는다', () => {
      const vnode = h('button', { disabled: false, checked: false, 'data-test': 'ok' });
      expect(vnode.attrs.disabled).toBeUndefined();
      expect(vnode.attrs.checked).toBeUndefined();
      expect(vnode.attrs['data-test']).toBe('ok');
    });

    it('disabled: true나 checked: true는 값 없는 빈 문자열("")로 넣는다', () => {
      const vnode = h('button', { disabled: true, checked: true });
      expect(vnode.attrs.disabled).toBe('');
      expect(vnode.attrs.checked).toBe('');
    });

    it('이벤트 핸들러는 attrs에 넣지 않고 events 필드로 분리한다 (structuredClone 가능)', () => {
      const clickHandler = () => {};
      const vnode = h('button', { onclick: clickHandler, class: 'btn' });

      // attrs는 오직 문자열만 보관
      expect(vnode.attrs.onclick).toBeUndefined();
      expect(vnode.attrs.class).toBe('btn');

      // events에 핸들러 저장
      expect(vnode.events).toBeDefined();
      expect(vnode.events.click).toBe(clickHandler);

      // VNode의 attrs는 함수가 없으므로 structuredClone(vnode.attrs)가 성공한다
      expect(() => structuredClone(vnode.attrs)).not.toThrow();
    });

    it('style 객체를 kebab-case 인라인 스타일 문자열로 변환한다', () => {
      const vnode = h('div', {
        style: {
          color: 'red',
          fontSize: '14px',
          backgroundColor: 'blue',
        },
      });
      expect(vnode.attrs.style).toBe('color:red;font-size:14px;background-color:blue');
    });
  });

  describe('applyPatches Property형 속성 및 SVG 지원', () => {
    it('checked/value 프로퍼티가 DOM 어트리뷰트와 프로퍼티 양쪽에 동기화된다', () => {
      const container = createContainer();
      const inputVNode = h('input', { type: 'checkbox', checked: true, value: 'test' });

      applyPatches(container, [{ type: 'INSERT', parentPath: [], index: 0, node: inputVNode }]);

      const inputEl = container.firstChild;
      expect(inputEl.checked).toBe(true);
      expect(inputEl.value).toBe('test');

      // 속성 제거 패치 적용 시 프로퍼티도 초기화된다
      applyPatches(container, [
        {
          type: 'UPDATE_ATTRS',
          path: [0],
          set: {},
          remove: ['checked', 'value'],
        },
      ]);

      expect(inputEl.checked).toBe(false);
      expect(inputEl.value).toBe('');
    });

    it('SVG 내부의 자식 요소(clipPath, path 등)는 SVG namespaceURI를 상속받는다', () => {
      const container = createContainer();
      const svgVNode = h(
        'svg',
        { width: 100, height: 100 },
        h('clippath', { id: 'clip' }, h('circle', { cx: 50, cy: 50, r: 20 })),
        h('rect', { width: 100, height: 100 }),
      );

      applyPatches(container, [{ type: 'INSERT', parentPath: [], index: 0, node: svgVNode }]);

      const svgEl = container.firstChild;
      expect(svgEl.namespaceURI).toBe('http://www.w3.org/2000/svg');

      const clipPathEl = svgEl.childNodes[0];
      expect(clipPathEl.namespaceURI).toBe('http://www.w3.org/2000/svg');

      const circleEl = clipPathEl.childNodes[0];
      expect(circleEl.namespaceURI).toBe('http://www.w3.org/2000/svg');
    });
  });
});
