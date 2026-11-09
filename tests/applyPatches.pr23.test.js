import { describe, expect, it } from 'vitest';
import { applyPatches, domToVNode } from '../src/index.js';
import { renderForTest } from './fixtures/randomTree.js';

function containerOf(html) {
  const container = document.createElement('div');
  container.innerHTML = html;
  return container;
}

function item(text) {
  return { type: 'element', tag: 'li', attrs: {}, children: [{ type: 'text', text }] };
}

describe('applyPatches', () => {
  it('빈 패치 배열에서는 기존 루트를 유지한다', () => {
    const container = containerOf('<p>유지</p>');
    const root = container.firstChild;

    applyPatches(container, []);

    expect(container.firstChild).toBe(root);
    expect(container.innerHTML).toBe('<p>유지</p>');
  });

  it('앞쪽 노드를 삭제하고 뒤쪽에 추가하면서 나머지 노드를 유지한다', () => {
    const container = containerOf('<ul><li>A</li><li>B</li><li>C</li></ul>');
    const [, b, c] = container.firstChild.childNodes;

    applyPatches(container, [
      { type: 'INSERT', parentPath: [0], index: 2, node: item('D') },
      { type: 'REMOVE', path: [0, 0] },
    ]);

    expect(container.innerHTML).toBe('<ul><li>B</li><li>C</li><li>D</li></ul>');
    expect(container.firstChild.childNodes[0]).toBe(b);
    expect(container.firstChild.childNodes[1]).toBe(c);
  });

  it('삭제로 인덱스가 밀려도 변경 전 경로가 가리킨 노드를 수정한다', () => {
    const container = containerOf('<ul><li>A</li><li>B</li><li>C</li><li>D</li></ul>');
    const c = container.firstChild.childNodes[2];

    applyPatches(container, [
      { type: 'REMOVE', path: [0, 0] },
      { type: 'REMOVE', path: [0, 1] },
      { type: 'SET_DATA', path: [0, 2, 0], value: 'C!' },
    ]);

    expect(container.innerHTML).toBe('<ul><li>C!</li><li>D</li></ul>');
    expect(container.firstChild.firstChild).toBe(c);
  });

  it('공백 텍스트와 주석을 childNodes 경로에 포함하고 각각 수정한다', () => {
    const container = containerOf('<p> \n<!--이전--><b>유지</b></p>');
    const [text, comment] = container.firstChild.childNodes;

    applyPatches(container, [
      { type: 'SET_DATA', path: [0, 0], value: '' },
      { type: 'SET_DATA', path: [0, 1], value: '이후' },
    ]);

    expect(container.firstChild.childNodes).toHaveLength(3);
    expect(container.firstChild.childNodes[0]).toBe(text);
    expect(container.firstChild.childNodes[1]).toBe(comment);
    expect(text.data).toBe('');
    expect(comment.data).toBe('이후');
    expect(container.innerHTML).toBe('<p><!--이후--><b>유지</b></p>');
  });

  it('속성을 추가·변경·삭제하고 대상에 없는 속성은 유지한다', () => {
    const container = containerOf('<input class="old" title="삭제" id="유지">');
    const input = container.firstChild;

    applyPatches(container, [
      { type: 'UPDATE_ATTRS', path: [0], set: { class: 'new', disabled: '' }, remove: ['title'] },
    ]);

    expect(container.firstChild).toBe(input);
    expect(domToVNode(input).attrs).toEqual({ class: 'new', disabled: '', id: '유지' });
  });

  it('루트 교체 시 새 하위 트리의 속성, 빈 텍스트와 주석을 보존한다', () => {
    const container = containerOf('<p>이전</p>');
    const node = {
      type: 'element',
      tag: 'section',
      attrs: { id: 'new' },
      children: [
        { type: 'text', text: '' },
        { type: 'text', text: ' ' },
        { type: 'comment', text: '구분' },
        { type: 'element', tag: 'b', attrs: {}, children: [{ type: 'text', text: '이후' }] },
      ],
    };

    applyPatches(container, [{ type: 'REPLACE', path: [0], node }]);

    expect(container.firstChild.isEqualNode(renderForTest(node))).toBe(true);
  });

  it('입력 배열 순서와 무관하게 같은 부모의 INSERT를 인덱스 순서대로 적용한다', () => {
    const container = containerOf('<ul><li>A</li><li>C</li></ul>');
    const patches = [
      { type: 'INSERT', parentPath: [0], index: 2, node: item('X') },
      { type: 'INSERT', parentPath: [0], index: 1, node: item('B') },
    ];
    const snapshot = structuredClone(patches);

    applyPatches(container, patches);

    expect(container.innerHTML).toBe('<ul><li>A</li><li>B</li><li>X</li><li>C</li></ul>');
    expect(patches).toEqual(snapshot);
  });
});
