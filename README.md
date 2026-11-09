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

## 실행과 검증

Node 24에서 `npm ci` 후 `npm run dev`를 실행하고 `/phase1/`을 엽니다.
`npm test`, `npm run lint`, `npm run format:check`로 검증합니다.

## Phase 1 통합

- [yeooonee의 #21](https://github.com/Jungle-week11-team8/mini-react/pull/21): 기본 구현, 경로 사전 검증, 데모 및 단위 테스트
- [silverzzo의 #22](https://github.com/Jungle-week11-team8/mini-react/pull/22): 경계 사례·규모·입력 불변성 테스트
- [ljw0320의 #23](https://github.com/Jungle-week11-team8/mini-react/pull/23): 특수 속성 이름 비교와 회귀 테스트

세 PR의 원본 커밋은 merge 커밋으로 보존합니다. `dev`에서 `main`으로 합칠 때도
squash 대신 merge를 사용해야 원본 작성자 이력이 그대로 이어집니다.
GitHub Contributors 표시는 기본 브랜치 반영 및 작성자 이메일의 GitHub 계정 연결이 필요합니다.

VNode는 `docs/vnode-spec.md`의 element·text·comment 계약을 유지합니다.
Document·Doctype 지원은 이번 통합에 포함하지 않으며, 관련 테스트는 지원 범위 밖 입력을 검사합니다.
에러 문구와 클래스는 명세에 없으므로 오류 발생과 DOM 보존을 검증합니다.
`*.pr22.test.js`, `*.pr23.test.js`는 각 PR에서 가져온 교차 검증 테스트입니다.
