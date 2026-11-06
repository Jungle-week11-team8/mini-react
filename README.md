# mini-react

외부 프레임워크 없이 React의 핵심 동작을 직접 구현하는 크래프톤 정글 WEEK 11-12 과제입니다.

## Phase 1. Virtual DOM + Diff + Patch

- 실제 DOM을 Virtual DOM으로 변환
- 이전 Virtual DOM과 비교해(Diff) 바뀐 부분만 실제 DOM에 반영(Patch)
- 검증 페이지: 실제 영역 / 테스트 영역, `Patch` · `뒤로가기` · `앞으로가기` 버튼 (State History)

## Phase 2. Component · State · Hooks

- 함수형 컴포넌트를 감싸는 `FunctionComponent` 클래스 (`hooks`, `mount()`, `update()`)
- Hooks: `useState`, `useEffect`, `useMemo`
- State는 루트 컴포넌트에서만 관리하고, 자식은 props만 받는 순수 함수로 구현
- 상태가 바뀌면 Phase 1의 Diff + Patch로 필요한 부분만 업데이트

## 기술 스택

Vanilla HTML / CSS / JavaScript (React, Vue 등 프레임워크 사용 금지)
