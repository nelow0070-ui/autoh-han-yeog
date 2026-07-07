# Autoh Han Yeog

코딩하다가 한영키를 바꾸지 않고 입력한 글자를 자동으로 고쳐주는 VS Code 확장입니다.

예를 들어 문자열이나 주석 안에서 이렇게 입력하면:

```ts
const message = "dkssudgktpdy"; // qksrkqtmqslek
```

아래처럼 바꿔줍니다.

```ts
const message = "안녕하세요"; // 반갑습니다
```

코드의 변수명, 함수명, import 경로 같은 영역은 기본적으로 건드리지 않습니다.

## 주요 기능

- 문자열 안 한영 오타 자동 교정
- 주석 안 한영 오타 자동 교정
- Markdown/plain text 전체 텍스트 교정
- TypeScript, JavaScript, Python, JSON, HTML, CSS, Markdown 언어별 처리
- 스페이스, 엔터, 문장부호 입력 시 직전 토큰 자동 교정
- 우클릭 메뉴 지원
- 상태바에서 자동 교정 켜기/끄기
- 특정 토큰 무시하기
- 특정 토큰 항상 원하는 글자로 바꾸기
- 방금 자동 교정한 내용 되돌리기
- 토큰 판정 이유 확인하기

## 자동 교정 사용법

설치하면 자동 교정은 기본으로 켜져 있습니다.

문자열 안에서:

```ts
const text = "dkssudgktpdy "
```

스페이스를 입력하면:

```ts
const text = "안녕하세요 "
```

로 바뀝니다.

주석 안에서도 동작합니다.

```ts
// qksrkqtmqslek 
```

자동으로:

```ts
// 반갑습니다 
```

처럼 바뀝니다.

코드 식별자는 바꾸지 않습니다.

```ts
const dkssudgktpdy = "hello";
```

위 코드의 변수명 `dkssudgktpdy`는 그대로 둡니다.

## 우클릭 메뉴

에디터에서 우클릭하면 AutohHanYeog 명령을 바로 사용할 수 있습니다.

- `AutohHanYeog: Correct Selection`
- `AutohHanYeog: Correct Current Document`
- `AutohHanYeog: Toggle Auto Correction`
- `AutohHanYeog: Revert Last Automatic Correction`
- `AutohHanYeog: Ignore Token`
- `AutohHanYeog: Always Correct Token`
- `AutohHanYeog: Show Token Debug Info`

`Correct Selection`은 선택 영역이 있을 때만 표시됩니다.

## 명령어 사용법

명령 팔레트는 `Ctrl + Shift + P`로 열 수 있습니다.

### Correct Selection

선택한 영역만 교정합니다.

1. 교정할 텍스트를 드래그합니다.
2. 우클릭 또는 명령 팔레트에서 `AutohHanYeog: Correct Selection`을 실행합니다.

### Correct Current Document

현재 파일 전체를 한 번에 교정합니다.

코드 파일에서는 문자열과 주석 위주로 교정하고, Markdown/plain text에서는 전체 텍스트를 교정합니다.

### Toggle Auto Correction

자동 교정을 켜거나 끕니다.

VS Code 하단 상태바의 `HanYeog Auto` 항목을 클릭해도 됩니다.

### Revert Last Automatic Correction

방금 자동으로 바뀐 내용을 되돌립니다.

되돌린 원문 토큰은 개인 무시 목록에 저장되어 다음부터 자동으로 바뀌지 않습니다.

### Ignore Token

선택한 영문 토큰을 앞으로 자동 교정하지 않습니다.

예를 들어 `qwerty`를 선택하고 이 명령을 실행하면, 이후 `qwerty`는 그대로 둡니다.

### Always Correct Token

선택한 토큰을 항상 지정한 글자로 바꿉니다.

예:

```txt
gksrmf -> 한글
```

### Show Token Debug Info

현재 토큰이 왜 바뀌는지 확인합니다.

표시되는 정보:

- 원문 토큰
- 두벌식 변환 후보
- 최종 결과
- 교정 여부
- confidence 점수
- 판단 이유
- 현재 언어 설정

### Clear Personal Rules

무시 목록과 항상 교정 목록을 모두 초기화합니다.

## 언어별 동작

| 파일 종류 | 교정 영역 |
| --- | --- |
| TypeScript / JavaScript | 문자열, 템플릿 문자열의 일반 텍스트, `//` 주석, `/* */` 주석 |
| Python | 문자열, triple-quoted 문자열, `#` 주석 |
| JSON | 문자열 |
| HTML | 텍스트 노드, quoted attribute, `<!-- -->` 주석 |
| CSS | quoted string, `/* */` 주석 |
| Markdown / plain text | 전체 텍스트 |

## 설정

VS Code `settings.json`에서 설정할 수 있습니다.

자동 교정 끄기:

```json
{
  "autohHanYeog.autoCorrect": false
}
```

문자열만 교정하고 주석은 교정하지 않기:

```json
{
  "autohHanYeog.correctStrings": true,
  "autohHanYeog.correctComments": false
}
```

더 확실한 경우에만 교정하기:

```json
{
  "autohHanYeog.minConfidence": 2.5
}
```

자동 교정 후 알림 표시하기:

```json
{
  "autohHanYeog.showCorrectionMessage": true
}
```

언어별로 다르게 설정하기:

```json
{
  "autohHanYeog.languageOverrides": {
    "json": { "autoCorrect": false },
    "typescript": { "correctComments": false, "minConfidence": 2.5 },
    "markdown": { "minConfidence": 1.2 }
  }
}
```

## 추천 설정

처음에는 아래 설정을 추천합니다.

```json
{
  "autohHanYeog.autoCorrect": true,
  "autohHanYeog.correctStrings": true,
  "autohHanYeog.correctComments": true,
  "autohHanYeog.showCorrectionMessage": false,
  "autohHanYeog.languageOverrides": {
    "json": { "autoCorrect": false }
  }
}
```

## 개발자용

로컬 개발:

```bash
npm install
npm run build
npm test
```

VSIX 패키징:

```bash
npm run package:vscode
```

전체 검증:

```bash
npm run verify
```

사전 기반 모델 재학습:

```bash
npm run data:download
npm run train
```

원본 사전 파일은 `data/raw/`에 저장되며 Git에는 포함하지 않습니다. 런타임에는 `data/model.json`만 사용합니다.
