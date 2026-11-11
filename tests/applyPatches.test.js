import { describe, it, expect } from 'vitest';
import { domToVNode, diff, applyPatches } from '../src/index.js';

// before를 렌더한 container에 diff 결과를 적용하고 innerHTML을 돌려준다
function patchHTML(before, after) {
  const container = containerOf(before);
  const oldVNode = domToVNode(container.childNodes[0]);
  const newVNode = domToVNode(containerOf(after).childNodes[0]);
  applyPatches(container, diff(oldVNode, newVNode));
  return container.innerHTML;
}

function containerOf(html) {
  const container = document.createElement('div');
  container.innerHTML = html;
  return container;
}

describe('applyPatches', () => {
  describe('교체 (REPLACE)', () => {
    it.each([
      ['text → comment', '<p>A</p>', '<p><!--A--></p>'],
      ['comment → element', '<p><!--A--></p>', '<p><b>A</b></p>'],
      ['tag가 다른 element', '<p><b>A</b></p>', '<p><i>A</i></p>'],
    ])('%s', (_name, before, after) => {
      expect(patchHTML(before, after)).toBe(after);
    });

    // 하위 트리 체크
    it('자식이 있는 노드를 교체하면 자식까지 new 모양', () => {
      const before = '<div><p id="x">A<b>B</b></p></div>';
      const after = '<div><ul class="y"><li>C</li><li><!--D--></li></ul></div>';
      expect(patchHTML(before, after)).toBe(after);
    });
  });

  describe('앞쪽 삭제와 뒤쪽 추가', () => {
    // diff는 인덱스끼리 비교해서 이 조합을 만들지 않으므로 patch를 직접 쓴다
    it('[A, B, C] → [B, C, D]', () => {
      const container = containerOf('<ul><li>A</li><li>B</li><li>C</li></ul>');
      const d = { type: 'element', tag: 'li', attrs: {}, children: [{ type: 'text', text: 'D' }] };
      applyPatches(container, [
        { type: 'REMOVE', path: [0, 0] },
        { type: 'INSERT', parentPath: [0], index: 2, node: d },
      ]);
      expect(container.innerHTML).toBe('<ul><li>B</li><li>C</li><li>D</li></ul>');
    });
  });

  describe('속성·내용 반영', () => {
    it.each([
      ['속성 추가', '<p></p>', '<p id="a"></p>'],
      ['속성 수정', '<p id="a"></p>', '<p id="b"></p>'],
      ['속성 삭제', '<p id="a"></p>', '<p></p>'],
      ['프로토타입 이름 속성', '<div constructor="old"></div>', '<div __proto__="new"></div>'],
      ['추가·수정·삭제 동시', '<p id="a" class="x"></p>', '<p id="b" title="t"></p>'],
      ['text 내용', '<p>A</p>', '<p>B</p>'],
      ['comment 내용', '<p><!--A--></p>', '<p><!--B--></p>'],
    ])('%s', (_name, before, after) => {
      expect(patchHTML(before, after)).toBe(after);
    });
  });

  describe('잘못된 path', () => {
    it.each([
      ['없는 인덱스', { type: 'REMOVE', path: [0, 5] }],
      ['없는 노드를 거쳐 감', { type: 'SET_DATA', path: [0, 5, 0], value: 'X' }],
      [
        '없는 부모에 INSERT',
        { type: 'INSERT', parentPath: [3], index: 0, node: { type: 'text', text: 'X' } },
      ],
    ])('%s → 에러, DOM은 그대로', (_name, patch) => {
      const container = containerOf('<p>A</p>');
      expect(() => applyPatches(container, [patch])).toThrow();
      expect(container.innerHTML).toBe('<p>A</p>');
    });
  });

  describe('INSERT · REMOVE', () => {
    it.each([
      ['끝에 자식 추가', '<ul><li>A</li></ul>', '<ul><li>A</li><li>B</li></ul>'],
      ['자식 삭제', '<ul><li>A</li><li>B</li></ul>', '<ul><li>A</li></ul>'],
    ])('%s', (_name, before, after) => {
      expect(patchHTML(before, after)).toBe(after);
    });
  });
});
