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

### 핵심 코드 출처와 선택 기준

현재 명세를 지키는 간결한 구현을 기본으로 선택하고, 다른 구현의 개선점과 테스트를 합쳤습니다.

| 영역                   | 채택한 코드           | 선택 기준 및 보완 내용                                                                                                                                          |
| ---------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| VDOM · `domToVNode`    | yeooonee #21          | element·text·comment와 공백·주석·key를 보존합니다. #23의 Document·Doctype 확장은 명세에 없고 diff 지원도 불완전해 제외했습니다.                                 |
| Diff · 트리 비교       | yeooonee #21          | 같은 인덱스의 자식을 비교하고 전위 순회로 patch를 생성합니다. 교체하는 노드의 하위 트리에는 추가 patch를 만들지 않습니다.                                       |
| Diff · 속성 비교       | ljw0320 #23 로직 반영 | `Object.hasOwn`과 `Object.fromEntries`로 #21에서 누락되던 `constructor` 속성 삭제와 `__proto__` 속성 추가를 처리합니다.                                         |
| Patch · `applyPatches` | yeooonee #21          | 모든 대상 경로를 변경 전에 확보·검증하고 삭제 → 교체·수정 → 삽입 순서로 적용합니다. 잘못된 path가 섞여 DOM이 일부만 변경되는 문제를 방지합니다.                 |
| 데모 · History         | yeooonee #21          | `/phase1/`로 통일했습니다. 현재 DOM을 다시 읽어 patch하며, 뒤로·앞으로 이동도 diff/patch로 복원합니다. 이전 상태에서 새 변경을 적용하면 이후 기록을 제거합니다. |
| 테스트                 | 세 PR 통합            | #21의 기본 테스트에 silverzzo #22의 경계 사례·규모·불변성 테스트와 ljw0320 #23의 회귀 테스트를 추가했습니다.                                                    |

### 통합 원칙과 검증

- 구현과 테스트의 판단 기준은 [VNode·Patch 명세](docs/vnode-spec.md)입니다.
- 서로의 단위 테스트를 교차 실행해 실제 버그와 명세에 없는 기대값 차이를 구분했습니다.
- 합의에 따라 에러 문구·클래스 기대값을 통일하고, 오류 발생과 DOM 보존 검증은 유지했습니다.
- Document 변환 테스트는 지원 범위 밖 입력 검증으로 변경했습니다. 기존의 상세 HTML 구조 검증을 `document.documentElement` 입력으로 복원하는 것은 보완 과제입니다.
- 통합 시 Node 24.22.2에서 랜덤 600개를 포함한 총 1,000개 실행 케이스와 lint, 깨끗한 작업 사본의 format 검사를 통과했습니다. 이 수에는 PR 간 중복 검증도 포함됩니다.
- 브라우저에서 Patch, 뒤로·앞으로 이동, history 분기, 공백·주석·특수 속성 변경 및 잘못된 최상위 입력 처리를 확인했습니다.

### 후속 커밋 이력 보존

[통합 PR #26](https://github.com/Jungle-week11-team8/mini-react/pull/26)은 #21·#22·#23의 원본 커밋을 포함합니다.
[PR #25](https://github.com/Jungle-week11-team8/mini-react/pull/25)는 #22에 다음 두 커밋을 추가한 후속 PR입니다.

- `fd159b1`: Prettier 포맷 정리
- `e7850ee`: domToVNode 테스트의 중복 import 제거 및 공개 API 경로 사용

두 수정 내용은 #26 통합 과정에서 이미 반영했지만, 해당 커밋 자체는 통합 이력에 포함되지 않았습니다.
따라서 `2760aa6`에서 `git merge -s ours`로 #25의 원본 커밋을 연결했습니다.
이 이력 보존 merge의 파일 트리는 당시 `dev`의 `1983720`과 동일하며, 기존 통합 구현을 덮어쓰지 않습니다.

`fix/pr25-merge-history`는 `dev`에 **Create a merge commit** 방식으로 합칩니다.
Squash나 rebase로 합치면 이 merge가 보존한 부모 관계가 사라질 수 있으므로 사용하지 않습니다.
이 기록은 로컬 이력 연결에 대한 설명이며, 원격 PR의 머지 완료를 의미하지 않습니다.
