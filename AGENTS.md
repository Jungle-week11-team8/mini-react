# AGENTS.md

이 파일은 mini-react 팀이 쓰는 모든 AI 도구(Claude Code, Cursor, Copilot, Codex 등)가 공통으로 따르는 지침입니다.
도구별 설정 파일(`CLAUDE.md` 등)은 이 파일을 불러오기만 하고, 규칙은 여기에만 적습니다.

## 프로젝트 개요

외부 프레임워크 없이 React의 핵심 동작을 직접 구현하는 크래프톤 정글 WEEK 11-12 과제입니다.

- Phase 1: 실제 DOM → Virtual DOM 변환, Diff, Patch, State History(뒤로/앞으로)
- Phase 2: `FunctionComponent` 클래스, `useState` · `useEffect` · `useMemo`

## 절대 규칙

1. React, Vue 등 UI 프레임워크와 라이브러리를 사용하지 않는다. `src/`에서는 브라우저 표준 API만 쓴다.
2. 런타임 의존성(`dependencies`)을 추가하지 않는다. 개발 도구(`devDependencies`)를 추가할 때는 PR에 이유를 적는다.
3. React 소스 코드를 그대로 옮겨 오지 않는다. 동작 원리를 이해하고 직접 구현한다.
4. State는 루트 컴포넌트에서만 관리한다. 자식 컴포넌트는 props만 받는 순수 함수로 만든다.
5. 확신이 없는 설계 결정(VNode 형태 변경, 모듈 경계 변경 등)은 임의로 바꾸지 말고 사람에게 먼저 묻는다.

## 환경

- Node 24 LTS (`.nvmrc`), 패키지 매니저는 `npm` (`package-lock.json` 커밋)
- 브라우저 코드는 ES Modules(`import` / `export`)로 작성한다.
- `src/`는 빌드 없이 동작해야 한다. `src/`에는 JSX를 쓰지 않는다.
- 파일 확장자는 `.js`, 들여쓰기 2칸, LF, UTF-8. 단, `demo/` 안에서 JSX를 쓰는 파일만 `.jsx`를 쓴다.

### JSX 사용 규칙 (팀 합의)

JSX는 `demo/`의 앱 코드에서만 쓴다. JSX는 문법 변환일 뿐이고, 변환 결과는 우리 `h()` 호출이다. React 런타임은 쓰지 않는다.

- 변환은 이미 devDependency인 Vite가 맡는다. JSX 때문에 새 패키지를 추가하지 않는다.
- JSX 변환 대상은 `h`로 지정하고, `.jsx` 파일은 `import { h } from '../../src/index.js'`처럼 `h`를 직접 import한다.
- `.jsx`는 `npm run dev`(Vite)로만 실행된다. HTML 파일을 직접 열어서 확인하지 않는다.
- JSX를 위해 설정 파일(Vite, ESLint, Vitest)을 고칠 때는 JSX 지원에 필요한 항목만 추가하고, 기존 규칙은 바꾸지 않는다.
- JSX는 React처럼 보이지만 우리 `h()`의 동작을 따른다. 아래를 지킨다.
  - `<Child />`는 `h`가 그 자리에서 실행하는 순수 함수다. 자식 컴포넌트 안에서 훅을 호출하지 않는다 (절대 규칙 4).
  - Fragment(`<>...</>`)는 지원하지 않는다. 여러 요소는 하나의 요소로 감싼다. 지원하려면 VNode 형태를 바꿔야 하므로 사람에게 먼저 묻는다.
  - `ref` prop은 쓰지 않는다. 우리 `useRef`는 DOM 노드와 연결되지 않는다.
  - `key`는 `attrs`가 아니라 VNode의 `key` 필드에 들어가야 한다 (`docs/vnode-spec.md`). diff가 key를 쓰기 전까지 리스트는 인덱스 기준으로 비교된다는 점을 알고 쓴다.
  - 속성과 이벤트 이름은 `h()`가 변환하는 것만 쓸 수 있다: `className` → `class`, `htmlFor` → `for`, `on<Event>` → 소문자 DOM 이벤트(`onDoubleClick` → `dblclick`). 텍스트 입력에는 `onChange` 대신 `onInput`을 쓴다.
  - 위 변환 중 `h()`에 아직 없는 것을 추가할 때는 `h()` 단위 테스트를 함께 쓴다.

## 폴더 구조와 모듈 경계

```
src/
  vdom/        createVNode, domToVNode (실제 DOM → VNode)
  diff/        diff(oldVNode, newVNode) → patches
  patch/       applyPatches(dom, patches)
  component/   FunctionComponent (mount, update)
  hooks/       useState, useEffect, useMemo
  index.js     외부에 공개하는 API만 re-export
demo/
  phase1/      검증 페이지 (실제 영역 / 테스트 영역, Patch · 뒤로가기 · 앞으로가기)
  phase2/
tests/         *.test.js
docs/
  vnode-spec.md
```

경계 규칙:

- `diff/`는 순수 함수다. `document`, `window`, 실제 DOM 노드에 접근하지 않는다.
- 실제 DOM을 변경하는 코드는 `patch/`에만 둔다.
- `hooks/`는 `patch/`를 직접 호출하지 않는다. 리렌더는 `component/`를 거친다.
- 다른 모듈의 내부 파일을 직접 import하지 않는다. 각 폴더의 `index.js`가 공개한 것만 쓴다.
- 새 폴더나 새 최상위 모듈이 필요하면 만들기 전에 사람에게 묻는다.

## 데이터 형태

VNode와 patch 객체의 형태는 `docs/vnode-spec.md`가 기준이다.
코드와 문서가 다르면 문서를 따르고, 형태를 바꿔야 한다면 문서를 먼저 고친 뒤 코드를 고친다.

### 확정한 형태 요약

VNode와 Patch는 둘 다 **종류별 타입을 `type` 필드로 구분하는 유니온 타입**으로 정의한다.
아래 TypeScript 표기는 형태를 설명하기 위한 것이다. 코드는 `.js`로 작성하고, 타입은 JSDoc `@typedef`로 표현한다.

```ts
type VNode =
  | {
      type: 'element';
      tag: string;
      attrs: Record<string, string>;
      key?: string; // 선택 필드. 리스트 재정렬(MOVE) 확장용
      children: VNode[];
    }
  | { type: 'text'; text: string }
  | { type: 'comment'; text: string };

type Path = number[]; // 컨테이너에서 시작해 childNodes 인덱스를 따라가는 경로. 루트 요소는 [0]

type Patch =
  | { type: 'INSERT'; parentPath: Path; index: number; node: VNode }
  | { type: 'REMOVE'; path: Path }
  | { type: 'REPLACE'; path: Path; node: VNode }
  | { type: 'SET_DATA'; path: Path; value: string } // text, comment 공용
  | { type: 'UPDATE_ATTRS'; path: Path; set: Record<string, string>; remove: string[] };
```

이 형태를 고른 이유:

- `type`으로 분기하면 종류마다 필요한 필드가 정해져 있어서, diff와 patch 코드의 분기가 단순하고 잘못된 객체를 만들기 어렵다.
- 텍스트를 문자열이 아니라 `{ type: 'text' }` 노드로 둔다. 그러면 모든 child가 객체가 되어 `typeof` 분기가 필요 없다. DOM의 `nodeType`(1 Element, 3 Text, 8 Comment)과도 1:1로 대응한다.
- comment 노드도 VNode로 표현한다. 주석을 버리면 VNode 인덱스와 실제 `childNodes` 인덱스가 어긋나서 path가 다른 노드를 가리키게 된다.
- VNode는 DOM 참조가 없는 순수 데이터라서 State History에 스냅샷으로 저장하고 복원할 수 있다.
- 추가는 `parentPath + index`로 표현한다. 새 노드는 아직 DOM에 없어서 path로는 찾을 수 없기 때문이다.
- 속성 변경은 `set`과 `remove`로 나눈다. 그래야 속성 삭제도 표현할 수 있다.

반드시 지킬 규칙:

1. **VNode에는 함수를 넣지 않는다.** 함수는 `structuredClone`에서 에러가 나고 `JSON.stringify`에서는 사라져서 history 저장이 깨진다.
   - 컴포넌트는 diff하기 전에 실행해서 태그 VNode로 펼친다. `tag`에 함수를 허용하지 않는다.
   - Phase 2에서 이벤트 핸들러가 필요하면 `attrs`에 섞지 않고 별도 필드(예: `events?: Record<string, Function>`)로 둔다. 이 필드를 추가하기 전에 사람에게 먼저 묻는다.
2. **공백만 있는 텍스트 노드를 버리는 경우**, `domToVNode`와 `applyPatches`의 path 해석이 같은 규칙을 써야 한다. 그렇지 않으면 인덱스가 어긋난다.
3. **diff는 REMOVE·REPLACE·INSERT를 만든 노드의 하위 트리에 대해서는 patch를 더 만들지 않는다.**
4. **`applyPatches` 적용 순서**: path 기반 patch는 앞쪽 형제를 지우면 뒤 형제의 인덱스가 밀린다. 그래서 아래 순서를 지킨다.
   1. 모든 patch의 대상 노드(`path`, INSERT는 `parentPath`)를 **old DOM 기준으로 먼저 찾아 참조로 보관**한다.
   2. REMOVE를 적용한다.
   3. REPLACE, SET_DATA, UPDATE_ATTRS를 적용한다.
   4. INSERT를 같은 부모 안에서 `index` 오름차순으로 적용한다. `index`는 **new children 기준** 위치이고, `parent.insertBefore(el, parent.childNodes[index] ?? null)`로 넣는다.
5. 새 연산(예: `MOVE`)은 Patch 유니온에 타입을 추가하고, diff 생성 로직, 적용 로직, 테스트를 함께 구현한다.

`patch` 단위 테스트에는 "앞쪽 삭제와 뒤쪽 추가가 동시에 일어나는 경우"(예: `[A, B, C]` → `[B, C, D]`)를 반드시 포함한다.

## 코드 스타일

- Prettier와 ESLint 설정을 따른다. 설정 파일을 임의로 바꾸지 않는다.
- 함수와 변수 이름은 영어 camelCase, 클래스는 PascalCase로 쓴다.
- 주석은 한국어로, "무엇"보다 "왜"를 적는다.
- 하나의 함수는 한 가지 일만 한다. diff 로직처럼 분기가 많은 곳은 작은 함수로 나눈다.

## 명령어

```bash
npm run dev           # 데모 페이지 개발 서버
npm test              # Vitest 테스트
npm run lint          # ESLint
npm run format:check  # Prettier 검사
```

## 테스트 (완료 기준)

작업은 아래를 모두 만족해야 완료로 본다.

1. `npm test`, `npm run lint`, `npm run format:check`가 통과한다.
2. 새 기능이나 버그 수정에는 테스트가 함께 있다.
3. 화면 동작이 바뀌었다면 `demo/` 페이지에서 직접 확인한다.

테스트 작성 방식:

- `diff`: 입력 VNode 두 개 → 기대한 patches 배열과 같은지 비교한다 (DOM 없이).
- `patch`: jsdom에서 patch를 적용한 결과 DOM이 새 VNode로 처음부터 렌더한 DOM과 같은지 비교한다.
- `hooks`: setState 후 리렌더, effect 의존성 배열, useMemo 캐시를 시나리오로 확인한다.

테스트를 통과시키려고 테스트를 지우거나 기대값을 바꾸지 않는다. 기대값이 틀렸다고 판단되면 이유를 설명하고 사람에게 확인받는다.

### 테스트의 역할 구분

인수 테스트와 랜덤 트리 테스트는 모두가 넘어야 하는 **최소 기준**이지, 명세가 아니다. 명세는 `docs/vnode-spec.md`다.

- 단위 테스트는 시나리오 목록(`tests/fixtures/scenarios.js`)이 아니라 **spec 문서의 규칙을 보고** TDD로 직접 쓴다. spec의 규칙 하나마다 그 규칙을 확인하는 단위 테스트가 하나 이상 있어야 한다.
- 인수 테스트와 랜덤 트리 테스트를 통과했다는 것만으로 완료로 보지 않는다.
- 구현 코드에 특정 시나리오나 seed를 겨냥한 분기를 만들지 않는다. 테스트 입력이 아니라 spec에 적힌 규칙을 기준으로 구현한다.
- 랜덤 트리 테스트가 실패하면 seed로 재현(`SEED=<번호> npm test -- random`)한 뒤, 원인이 된 작은 케이스를 단위 테스트나 시나리오로 옮기고 고친다.
- 각자 구현한 경우, 합치기 전에 서로의 단위 테스트를 자기 구현에 돌려 본다. 공개 시그니처가 같으므로 테스트 파일만 바꿔 실행하면 된다.

## Git 규칙

- 브랜치: `feat/<내용>`, `fix/<내용>` (예: `feat/diff-props`)
- 커밋 메시지: `feat:`, `fix:`, `test:`, `refactor:`, `docs:`, `chore:` 접두사 + 한국어 설명
- `main`에 직접 푸시하지 않고 PR로 합친다. PR에는 무엇을 왜 바꿨는지, 어떻게 확인했는지 적는다.
