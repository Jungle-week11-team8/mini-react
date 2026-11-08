import { describe, it, expect } from 'vitest';
import { domToVNode } from '../src/index.js';

describe('domToVNode', () => {
  // ===== text 노드 (nodeType 3) =====

  // 글자 조각 체크
  it('글자 조각을 text VNode로 바꾼다', () => {
    const hello = document.createTextNode('안녕');
    const result = domToVNode(hello);
    expect(result).toEqual({ type: 'text', text: '안녕' });
  });

  // children 체크
  it('text VNode에는 children 칸이 없다', () => {
    const result = domToVNode(document.createTextNode('안녕'));
    expect(result).not.toHaveProperty('children');
  });

  // 공백 체크
  it('공백만 있는 text도 버리지 않고 그대로 담는다', () => {
    const result = domToVNode(document.createTextNode('\n  '));
    expect(result).toEqual({ type: 'text', text: '\n  ' });
  });

  // ===== comment 노드 (nodeType 8) =====

  // 주석 체크
  it('주석을 comment VNode로 바꾼다', () => {
    const result = domToVNode(document.createComment(' 메모 '));
    expect(result).toEqual({ type: 'comment', text: ' 메모 ' });
  });

  // children 체크
  it('comment VNode에는 children 칸이 없다', () => {
    const result = domToVNode(document.createComment('메모'));
    expect(result).not.toHaveProperty('children');
  });

  // ===== element 노드 (nodeType 1) =====

  // 태그 소문자 체크
  it('tag는 소문자로 담는다', () => {
    const result = domToVNode(parse('<DIV></DIV>'));
    expect(result.tag).toBe('div');
  });

  // 속성 체크
  it('값 없는 속성은 빈 문자열, 없는 칸은 {}·[]로 둔다', () => {
    expect(domToVNode(parse('<input disabled>'))).toEqual({
      type: 'element',
      tag: 'input',
      attrs: { disabled: '' },
      children: [],
    });
    expect(domToVNode(parse('<p></p>'))).toEqual({
      type: 'element',
      tag: 'p',
      attrs: {},
      children: [],
    });
  });

  // key 체크
  it('key 속성이 있을 때만 key 필드를 둔다', () => {
    expect(domToVNode(parse('<li key="a"></li>'))).toHaveProperty('key', 'a');
    expect(domToVNode(parse('<li></li>'))).not.toHaveProperty('key');
  });

  // children 체크
  it('공백 text를 포함해 자식을 1:1로, 하위 element는 재귀로 담는다', () => {
    const result = domToVNode(parse('<ul>\n  <li>A</li>\n</ul>'));
    expect(result).toEqual({
      type: 'element',
      tag: 'ul',
      attrs: {},
      children: [
        { type: 'text', text: '\n  ' },
        { type: 'element', tag: 'li', attrs: {}, children: [{ type: 'text', text: 'A' }] },
        { type: 'text', text: '\n' },
      ],
    });
  });
});

// HTML 문자열의 첫 노드를 실제 DOM으로 만든다
function parse(html) {
  const container = document.createElement('div');
  container.innerHTML = html;
  return container.childNodes[0];
}
