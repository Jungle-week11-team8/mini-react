import { describe, expect, it } from 'vitest';
import { diff } from '../src/index.js';

function element(tag, children = [], attrs = {}) {
  return { type: 'element', tag, attrs, children };
}

function text(value) {
  return { type: 'text', text: value };
}

describe('diff', () => {
  it('텍스트가 바뀌면 해당 노드의 SET_DATA 1 건을 반환한다', () => {
    expect(diff(element('p', [text('0')]), element('p', [text('1')]))).toStrictEqual([
      { type: 'SET_DATA', path: [0, 0], value: '1' },
    ]);
  });

  it('부모의 변경을 먼저 반환하고 각 자식의 하위 트리를 순서대로 처리한다', () => {
    const oldVNode = element(
      'div',
      [element('span', [text('0')]), element('button', [], { title: '저장' })],
      { class: 'old' },
    );
    const newVNode = element(
      'div',
      [element('span', [text('1')]), element('button', [], { title: '완료' })],
      { class: 'new' },
    );

    expect(diff(oldVNode, newVNode)).toStrictEqual([
      { type: 'UPDATE_ATTRS', path: [0], set: { class: 'new' }, remove: [] },
      { type: 'SET_DATA', path: [0, 0, 0], value: '1' },
      { type: 'UPDATE_ATTRS', path: [0, 1], set: { title: '완료' }, remove: [] },
    ]);
  });

  it('추가된 서브트리 전체를 INSERT 1 건으로 반환한다', () => {
    const itemA = element('li', [text('A')]);
    const itemB = element('li', [element('strong', [text('B')])]);

    expect(diff(element('ul', [itemA]), element('ul', [itemA, itemB]))).toStrictEqual([
      { type: 'INSERT', parentPath: [0], index: 1, node: itemB },
    ]);
  });

  it('삭제된 서브트리에 대해 REMOVE 1 건을 반환한다', () => {
    const itemA = element('li', [text('A')]);
    const itemB = element('li', [element('strong', [text('B')])]);

    expect(diff(element('ul', [itemA, itemB]), element('ul', [itemA]))).toStrictEqual([
      { type: 'REMOVE', path: [0, 1] },
    ]);
  });

  it('추가·변경된 속성은 set에, 삭제된 속성은 remove에 담는다', () => {
    const oldVNode = element('span', [], { id: 'counter', 'data-count': '0', title: '초기값' });
    const newVNode = element('span', [], { id: 'counter', 'data-count': '1', class: 'active' });

    expect(diff(oldVNode, newVNode)).toStrictEqual([
      {
        type: 'UPDATE_ATTRS',
        path: [0],
        set: { 'data-count': '1', class: 'active' },
        remove: ['title'],
      },
    ]);
  });

  it('객체 프로토타입과 이름이 같은 속성도 추가하고 삭제한다', () => {
    const oldVNode = element('div', [], { constructor: '삭제할 값' });
    const newVNode = element('div', [], { ['__proto__']: '추가할 값' });

    expect(diff(oldVNode, newVNode)).toStrictEqual([
      {
        type: 'UPDATE_ATTRS',
        path: [0],
        set: { ['__proto__']: '추가할 값' },
        remove: ['constructor'],
      },
    ]);
  });

  it('객체 프로토타입과 이름이 같은 속성의 값도 변경한다', () => {
    const oldVNode = element('div', [], { constructor: '이전 값' });
    const newVNode = element('div', [], { constructor: '새 값' });

    expect(diff(oldVNode, newVNode)).toStrictEqual([
      {
        type: 'UPDATE_ATTRS',
        path: [0],
        set: { constructor: '새 값' },
        remove: [],
      },
    ]);
  });

  it('텍스트 노드가 요소 노드로 바뀌면 해당 자식을 교체한다', () => {
    const oldVNode = element('p', [text('0')]);
    const replacement = element('span', [text('1')]);
    const newVNode = element('p', [replacement]);

    expect(diff(oldVNode, newVNode)).toStrictEqual([
      { type: 'REPLACE', path: [0, 0], node: replacement },
    ]);
  });

  it('요소 태그가 바뀌면 하위 변경을 포함해 루트 교체 1 건을 반환한다', () => {
    const oldVNode = element('p', [text('0')]);
    const newVNode = element('div', [text('1')]);

    expect(diff(oldVNode, newVNode)).toStrictEqual([
      { type: 'REPLACE', path: [0], node: newVNode },
    ]);
  });

  it('내용이 같은 두 트리를 비교하면 빈 배열을 반환한다', () => {
    const oldVNode = element('p', [text('같은 값')], { id: 'status' });

    expect(diff(oldVNode, structuredClone(oldVNode))).toStrictEqual([]);
  });

  it('두 입력 트리의 구조·속성·텍스트를 보존한다', () => {
    const oldVNode = element('div', [element('p', [text('0')])], { class: 'old' });
    const newVNode = element('div', [element('p', [text('1')]), element('hr')], {
      class: 'new',
    });
    const oldSnapshot = structuredClone(oldVNode);
    const newSnapshot = structuredClone(newVNode);

    diff(oldVNode, newVNode);

    expect(oldVNode).toStrictEqual(oldSnapshot);
    expect(newVNode).toStrictEqual(newSnapshot);
  });

  it('주석 변경을 반환하고 공백과 주석을 경로 인덱스에 포함한다', () => {
    const oldVNode = element('div', [
      text('\n  '),
      { type: 'comment', text: '이전 주석' },
      element('p', [text('0')]),
    ]);
    const newVNode = element('div', [
      text('\n  '),
      { type: 'comment', text: '새 주석' },
      element('p', [text('1')]),
    ]);

    expect(diff(oldVNode, newVNode)).toStrictEqual([
      { type: 'SET_DATA', path: [0, 1], value: '새 주석' },
      { type: 'SET_DATA', path: [0, 2, 0], value: '1' },
    ]);
  });

  it('키 없는 자식의 순서가 바뀌면 같은 인덱스끼리 비교한다', () => {
    const itemA = element('li', [text('A')]);
    const itemB = element('li', [text('B')]);

    expect(diff(element('ul', [itemA, itemB]), element('ul', [itemB, itemA]))).toStrictEqual([
      { type: 'SET_DATA', path: [0, 0, 0], value: 'B' },
      { type: 'SET_DATA', path: [0, 1, 0], value: 'A' },
    ]);
  });
});
