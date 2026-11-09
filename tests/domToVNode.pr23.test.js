import { describe, expect, it } from 'vitest';
import { domToVNode } from '../src/index.js';

describe('domToVNode', () => {
  it('현재 명세에 없는 Document 노드는 오류로 알린다', () => {
    expect(() => domToVNode(document)).toThrow();
  });

  it('현재 명세에 없는 DocumentType 노드는 오류로 알린다', () => {
    const doctype = document.implementation.createDocumentType('html', 'public-id', 'system-id');
    expect(() => domToVNode(doctype)).toThrow();
  });

  it('값 없는 속성과 빈 key를 보존한다', () => {
    const input = document.createElement('INPUT');
    input.setAttribute('disabled', '');
    input.setAttribute('key', '');

    expect(domToVNode(input)).toStrictEqual({
      type: 'element',
      tag: 'input',
      attrs: { disabled: '', key: '' },
      key: '',
      children: [],
    });
  });

  it('공백과 빈 텍스트, 주석을 개별 자식 노드로 보존한다', () => {
    const element = document.createElement('div');
    element.append(
      document.createTextNode('\n  '),
      document.createComment('구분'),
      document.createTextNode(''),
    );

    expect(domToVNode(element)).toStrictEqual({
      type: 'element',
      tag: 'div',
      attrs: {},
      children: [
        { type: 'text', text: '\n  ' },
        { type: 'comment', text: '구분' },
        { type: 'text', text: '' },
      ],
    });
  });

  it('원본 DOM을 수정하지 않고 직렬화할 수 있는 스냅샷을 반환한다', () => {
    const source = new DOMParser().parseFromString('<p id="original">처음</p>', 'text/html');
    const before = source.documentElement.outerHTML;
    const paragraph = source.querySelector('p');
    const vnode = domToVNode(source.documentElement);

    expect(source.documentElement.outerHTML).toBe(before);
    expect(source.querySelector('p')).toBe(paragraph);
    expect(vnode.children.map((child) => child.type)).toEqual(['element', 'element']);
    expect(structuredClone(vnode)).toStrictEqual(vnode);
    expect(JSON.parse(JSON.stringify(vnode))).toStrictEqual(vnode);

    paragraph.id = 'updated';
    paragraph.textContent = '변경';
    expect(JSON.stringify(vnode)).toContain('original');
    expect(JSON.stringify(vnode)).toContain('처음');
  });

  it('지원 범위 밖의 DOM 노드는 오류로 알린다', () => {
    expect(() => domToVNode(document.createDocumentFragment())).toThrow();
  });
});
