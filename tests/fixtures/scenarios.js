// Phase 1 완료 기준 시나리오 목록이다. (docs/vnode-spec.md 6절)
// 추가는 자유롭게, 삭제나 기대값 변경은 팀 합의 후에 한다.
// before/after는 루트 노드 하나만 있는 HTML이다. 앞뒤 공백을 두지 않는다.

/** @type {{ name: string, before: string, after: string }[]} */
export const scenarios = [
  // 변경 없음
  { name: '같은 트리', before: '<p>hi</p>', after: '<p>hi</p>' },

  // SET_DATA
  { name: '텍스트 변경', before: '<p>hi</p>', after: '<p>bye</p>' },
  { name: '주석 변경', before: '<div><!--a--></div>', after: '<div><!--b--></div>' },

  // UPDATE_ATTRS
  { name: '속성 추가', before: '<div></div>', after: '<div id="a"></div>' },
  { name: '속성 값 변경', before: '<div class="a"></div>', after: '<div class="b"></div>' },
  { name: '속성 삭제', before: '<div id="a" class="b"></div>', after: '<div class="b"></div>' },
  { name: '값 없는 속성', before: '<input>', after: '<input disabled="">' },

  // REPLACE
  { name: '태그 변경', before: '<div><p>a</p></div>', after: '<div><span>a</span></div>' },
  { name: '루트 태그 변경', before: '<p>a</p>', after: '<section>a</section>' },
  { name: '텍스트 → 요소', before: '<div>a</div>', after: '<div><b>a</b></div>' },

  // INSERT / REMOVE
  { name: '빈 요소에 자식 추가', before: '<ul></ul>', after: '<ul><li>A</li></ul>' },
  { name: '끝에 자식 추가', before: '<ul><li>A</li></ul>', after: '<ul><li>A</li><li>B</li></ul>' },
  { name: '끝 자식 삭제', before: '<ul><li>A</li><li>B</li></ul>', after: '<ul><li>A</li></ul>' },
  {
    name: '중간 자식 삭제',
    before: '<ul><li>A</li><li>B</li><li>C</li></ul>',
    after: '<ul><li>A</li><li>C</li></ul>',
  },
  { name: '모든 자식 삭제', before: '<ul><li>A</li><li>B</li></ul>', after: '<ul></ul>' },
  {
    name: '앞쪽 삭제 + 뒤쪽 추가 [A,B,C] → [B,C,D]',
    before: '<ul><li>A</li><li>B</li><li>C</li></ul>',
    after: '<ul><li>B</li><li>C</li><li>D</li></ul>',
  },
  {
    name: '여러 개 추가',
    before: '<ul><li>A</li></ul>',
    after: '<ul><li>A</li><li>B</li><li>C</li><li>D</li></ul>',
  },

  // 공백 텍스트 노드 유지 규칙
  {
    name: '들여쓰기가 있는 리스트에 추가',
    before: '<ul>\n  <li>A</li>\n</ul>',
    after: '<ul>\n  <li>A</li>\n  <li>B</li>\n</ul>',
  },

  // 깊은 트리 · 복합 변경
  {
    name: '깊은 곳의 텍스트 변경',
    before: '<div><section><article><p>a</p></article></section></div>',
    after: '<div><section><article><p>b</p></article></section></div>',
  },
  {
    name: '여러 종류 변경이 동시에',
    before: '<div id="app"><h1>Title</h1><p class="x">a</p><ul><li>1</li><li>2</li></ul></div>',
    after:
      '<div id="app" class="on"><h2>Title</h2><p>b</p><ul><li>2</li><li>3</li><li>4</li></ul></div>',
  },
];
