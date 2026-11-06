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
- 브라우저 코드는 ES Modules(`import` / `export`)로 작성하고, 빌드 없이 동작해야 한다.
- 파일 확장자는 `.js`, 들여쓰기 2칸, LF, UTF-8

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

## Git 규칙

- 브랜치: `feat/<내용>`, `fix/<내용>` (예: `feat/diff-props`)
- 커밋 메시지: `feat:`, `fix:`, `test:`, `refactor:`, `docs:`, `chore:` 접두사 + 한국어 설명
- `main`에 직접 푸시하지 않고 PR로 합친다. PR에는 무엇을 왜 바꿨는지, 어떻게 확인했는지 적는다.
