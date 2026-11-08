import { describe, it, expect } from 'vitest';
import { domToVNode } from '../src/index.js';

describe('domToVNode', () => {
  describe('text 노드 (nodeType 3)', () => {
    // 글자 조각 체크
    it('글자 조각 그대로 담음', () => {
      const hello = document.createTextNode('안녕');
      const result = domToVNode(hello);
      expect(result).toEqual({ type: 'text', text: '안녕' });
    });

    // children 체크
    it('children 칸 없음', () => {
      const result = domToVNode(document.createTextNode('안녕'));
      expect(result).not.toHaveProperty('children');
    });

    // 공백 체크
    it('공백만 있어도 버리지 않고 담음', () => {
      const result = domToVNode(document.createTextNode('\n  '));
      expect(result).toEqual({ type: 'text', text: '\n  ' });
    });
  });

  describe('comment 노드 (nodeType 8)', () => {
    // 주석 체크
    it('주석 내용 그대로 담음', () => {
      const result = domToVNode(document.createComment(' 메모 '));
      expect(result).toEqual({ type: 'comment', text: ' 메모 ' });
    });

    // children 체크
    it('children 칸 없음', () => {
      const result = domToVNode(document.createComment('메모'));
      expect(result).not.toHaveProperty('children');
    });
  });

  describe('element 노드 (nodeType 1)', () => {
    // 태그 소문자 체크
    it('tag 소문자로 변환', () => {
      const result = domToVNode(parse('<DIV></DIV>'));
      expect(result.tag).toBe('div');
    });

    // 속성 체크
    it("값 없는 속성은 ''", () => {
      expect(domToVNode(parse('<input disabled>')).attrs).toEqual({ disabled: '' });
    });

    it('속성 없으면 attrs {}', () => {
      expect(domToVNode(parse('<p></p>')).attrs).toEqual({});
    });

    it('자식 없으면 children []', () => {
      expect(domToVNode(parse('<p></p>')).children).toEqual([]);
    });

    // key 체크
    it('key 속성 있을 때만 key 칸 담음', () => {
      expect(domToVNode(parse('<li key="a"></li>'))).toHaveProperty('key', 'a');
      expect(domToVNode(parse('<li></li>'))).not.toHaveProperty('key');
    });

    // children 체크
    it('공백 text도 자식으로 담음', () => {
      const { children } = domToVNode(parse('<ul>\n  <li>A</li>\n</ul>'));
      expect(children).toHaveLength(3);
      expect(children[0]).toEqual({ type: 'text', text: '\n  ' });
      expect(children[2]).toEqual({ type: 'text', text: '\n' });
    });

    it('하위 element는 재귀 변환', () => {
      const { children } = domToVNode(parse('<ul><li>A</li></ul>'));
      expect(children).toEqual([
        { type: 'element', tag: 'li', attrs: {}, children: [{ type: 'text', text: 'A' }] },
      ]);
    });
  });
});

// HTML 문자열의 첫 노드를 실제 DOM으로 만든다
function parse(html) {
  const container = document.createElement('div');
  container.innerHTML = html;
  return container.childNodes[0];
}
