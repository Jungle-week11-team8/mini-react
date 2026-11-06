# VNode · Patch 명세

이 문서는 팀이 합의한 **계약**이다. 코드와 이 문서가 다르면 이 문서를 따른다.
형태를 바꿔야 하면 이 문서를 먼저 고치고(PR로 합의), 그다음 코드와 테스트를 고친다.

## 1. 공개 함수 시그니처

모든 팀원의 구현은 아래 시그니처를 지킨다. 그래야 누구의 테스트든 누구의 구현에 돌려 볼 수 있다.

| 함수                                      | 위치         | 설명                                                             |
| ----------------------------------------- | ------------ | ---------------------------------------------------------------- |
| `domToVNode(node) → VNode`                | `src/vdom/`  | 실제 DOM 노드(Element · Text · Comment) 하나를 VNode로 변환한다. |
| `diff(oldVNode, newVNode) → Patch[]`      | `src/diff/`  | 두 VNode 트리를 비교해 patch 배열을 만든다. 순수 함수다.         |
| `applyPatches(container, patches) → void` | `src/patch/` | `container` 안의 DOM에 patch를 적용한다.                         |

- `container`는 루트 노드를 감싸는 부모 요소다. 루트 노드는 `container.childNodes[0]`이다.
- 모든 함수는 `src/index.js`에서 re-export한다.
- 입력을 변경하지 않는다. `diff`는 인자로 받은 VNode를 수정하지 않는다.

## 2. VNode

```js
/**
 * @typedef {{ type: 'element', tag: string, attrs: Record<string, string>, key?: string, children: VNode[] }} ElementVNode
 * @typedef {{ type: 'text', text: string }} TextVNode
 * @typedef {{ type: 'comment', text: string }} CommentVNode
 * @typedef {ElementVNode | TextVNode | CommentVNode} VNode
 */
```

규칙:

- `tag`는 **소문자**다. (`element.tagName`이 아니라 `element.localName`을 쓴다)
- `attrs`의 값은 항상 문자열이다. 값 없는 속성(`<input disabled>`)은 `{ disabled: '' }`이다.
- `attrs`가 없어도 `{}`, `children`이 없어도 `[]`로 둔다. `undefined`를 쓰지 않는다.
- `key`는 element의 `key` 속성이 있을 때만 넣는다. (MOVE 확장용, Phase 1에서는 선택)
- VNode에는 함수나 DOM 참조를 넣지 않는다. `structuredClone`과 `JSON.stringify`가 모두 가능해야 한다.

### 공백 텍스트 노드: 그대로 유지한다

공백만 있는 텍스트 노드(들여쓰기, 줄바꿈)도 **버리지 않고** `{ type: 'text' }` VNode로 만든다.
VNode `children`은 실제 `childNodes`와 항상 1:1로 대응한다.

이유: 공백을 버리면 `domToVNode`, `applyPatches`의 path 해석, INSERT 위치 계산이 모두 같은 규칙으로
공백을 건너뛰어야 한다. 한 곳이라도 어긋나면 path가 다른 노드를 가리킨다. 유지하면 이런 위험이 없다.

```html
<ul>
  <li>A</li>
</ul>
```

```js
{
  type: 'element', tag: 'ul', attrs: {}, children: [
    { type: 'text', text: '\n  ' },
    { type: 'element', tag: 'li', attrs: {}, children: [{ type: 'text', text: 'A' }] },
    { type: 'text', text: '\n' },
  ],
}
```

## 3. Path

```js
/** @typedef {number[]} Path */
```

- `container`에서 시작해 `childNodes` 인덱스를 차례로 따라가는 경로다.
- 루트 노드는 `[0]`, 루트의 두 번째 자식은 `[0, 1]`이다.
- 인덱스는 텍스트 · 주석 노드를 **포함한** `childNodes` 기준이다. (`children`이 아니다)

```js
function resolvePath(container, path) {
  return path.reduce((node, index) => node.childNodes[index], container);
}
```

## 4. Patch

```js
/**
 * @typedef {{ type: 'INSERT', parentPath: Path, index: number, node: VNode }} InsertPatch
 * @typedef {{ type: 'REMOVE', path: Path }} RemovePatch
 * @typedef {{ type: 'REPLACE', path: Path, node: VNode }} ReplacePatch
 * @typedef {{ type: 'SET_DATA', path: Path, value: string }} SetDataPatch
 * @typedef {{ type: 'UPDATE_ATTRS', path: Path, set: Record<string, string>, remove: string[] }} UpdateAttrsPatch
 * @typedef {InsertPatch | RemovePatch | ReplacePatch | SetDataPatch | UpdateAttrsPatch} Patch
 */
```

| 상황                                          | 만드는 patch                                                        |
| --------------------------------------------- | ------------------------------------------------------------------- |
| 노드 `type`이 다름, 또는 element `tag`가 다름 | `REPLACE`                                                           |
| text/comment의 `text`가 다름                  | `SET_DATA`                                                          |
| attrs가 다름                                  | `UPDATE_ATTRS` (`set`, `remove` 중 하나 이상이 비어 있지 않을 때만) |
| new에만 있는 자식                             | `INSERT` (`index`는 new children 기준)                              |
| old에만 있는 자식                             | `REMOVE`                                                            |

diff 규칙:

1. 같은 트리면 `[]`를 반환한다.
2. `REMOVE` · `REPLACE` · `INSERT`를 만든 노드의 하위 트리에는 patch를 더 만들지 않는다.
3. key가 없으면 자식은 **같은 인덱스끼리** 비교한다.
4. patch 배열 순서: 전위 순회(부모 → 자식 인덱스 오름차순). diff 단위 테스트는 이 순서로 기대값을 쓴다.

## 5. applyPatches 적용 순서

path 기반 patch는 앞쪽 형제를 지우면 뒤 형제 인덱스가 밀린다. 그래서 아래 순서를 지킨다.

1. 모든 patch의 대상 노드(`path`, INSERT는 `parentPath`)를 **old DOM 기준으로 먼저 찾아 참조로 보관**한다.
2. `REMOVE`를 적용한다.
3. `REPLACE`, `SET_DATA`, `UPDATE_ATTRS`를 적용한다.
4. `INSERT`를 같은 부모 안에서 `index` 오름차순으로 적용한다.
   `parent.insertBefore(el, parent.childNodes[index] ?? null)`로 넣는다.

## 6. 완료 기준 (인수 테스트)

Phase 1은 `tests/acceptance.test.js`가 모든 시나리오에서 통과하면 완료다.
시나리오 목록은 `tests/fixtures/scenarios.js`에 있고, 각 시나리오는 아래를 만족해야 한다.

```
container.innerHTML = before
applyPatches(container, diff(domToVNode(before 루트), domToVNode(after 루트)))
→ container.innerHTML === after
```

시나리오를 추가할 수는 있지만, 기존 시나리오를 지우거나 기대값을 바꾸려면 팀 합의가 필요하다.

목록에 없는 조합은 `tests/random.test.js`(랜덤 트리 테스트)가 확인한다. seed로 만든 old/new VNode 트리를 직접 렌더하고,
`diff` → `applyPatches` 결과를 `domToVNode`로 다시 읽어 new 트리와 `toEqual`로 비교한다.
innerHTML이 아니라 VNode로 비교하므로, 인접한 텍스트 노드나 빈 텍스트 노드의 개수 차이도 잡아낸다.

두 테스트는 **최소 기준**이다. 통과했다고 spec의 모든 규칙을 지킨 것은 아니므로, 규칙마다 단위 테스트를 따로 둔다.
