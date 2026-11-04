# Hack Workflow

정해진 과제 수행일에 Codex에서 사용할 해커톤용 스킬 모음집.
GitHub 저장소에서 내려받아 포함된 스킬을 한꺼번에 설치할 수 있다.

## 구성 원칙

- 각 스킬은 `skills/<skill-name>/SKILL.md`에 둔다.
- `SKILL.md`에는 `name`, `description` YAML frontmatter와 실행 지침을 작성한다.
- 스킬에 필요한 스크립트, 참고 자료, 템플릿은 해당 스킬 폴더에 함께 둔다.
- 개별 스킬 사용과 전체 묶음 설치를 모두 고려한다.
- 설치 시 기존에 설치된 동명 스킬을 임의로 덮어쓰지 않는다.

## 설치

```sh
git clone https://github.com/KyoungWan/hack-workflow.git
mkdir -p ~/.codex/skills
cp -R hack-workflow/skills/* ~/.codex/skills/
```

같은 이름의 스킬이 있으면 먼저 다른 위치에 보관하세요.
설치 후 새 Codex 대화에서 `$assignment-guide` 또는 `$frontend-design`으로 사용합니다.

## 사용

`assignment-guide`는 요청한 과제 작업을 돕고, 합의한 할 일·가정·보류 사항을 바탕으로 다음 작업을 안내한다. 다음 단계 안내만 요청하면 구현을 자동 시작하지 않는다.

```text
$assignment-guide 사용할 수 있는 기능을 알려줘.
$assignment-guide README 해석해줘.
$assignment-guide CSV 탐색 UI 만들어줘.
$assignment-guide 데이터 검증해줘.
$assignment-guide auth 웹 구현해줘.
$assignment-guide 보고서 작성해줘.
$assignment-guide 구현 점검해줘.
$assignment-guide 결과 설명해줘.
$assignment-guide 문제 만들어줘.
$assignment-guide 다음 세션에 넘길 내용 정리해줘.
$assignment-guide 인계 기록에서 재개해줘.
$frontend-design 과제 요구사항에 맞는 화면을 구현해줘.
```

`frontend-design`은 별도 스킬이며 과제 가이드가 자동으로 호출하지 않는다.
“문제 만들어줘”는 15개 문항을 먼저 보여준다. 번호를 선택하면 현재 과제와 구현 상황에 맞는 문제를 생성한다. 정답·해설은 별도로 요청할 때 제공한다.
인증 템플릿의 동봉 테스트는 Node.js 24에서 `node --test skills/assignment-guide/assets/auth/common.test.mjs`로 실행할 수 있다.

## 포함된 스킬

- [assignment-guide](skills/assignment-guide/SKILL.md): 과제 해석·CSV 탐색 UI·데이터 검증·인증·보고서·구현 점검·결과 설명·문제 생성·작업 인계.
- [frontend-design](skills/frontend-design/SKILL.md): 프런트엔드 디자인 스킬. [Apache 2.0 라이선스](skills/frontend-design/LICENSE.txt).

외부 자료의 저작권 고지와 라이선스 전문은 해당 폴더에 보존한다.
실행에 필요한 본문과 참고 자료는 저장소에 포함되어 있어 스킬 실행을 위한 외부 원본 fetch가 필요하지 않다. 과제 수행에 필요한 자료 조회나 패키지 설치는 별개다.
Anthropic의 `docx`, `pdf`, `pptx`, `xlsx`는 현재 공개 라이선스의 복제·수정·배포 제한으로 포함하지 않았다.
