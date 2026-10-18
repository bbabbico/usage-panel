# usage-panel

Claude Code 모드: 컨텍스트 사용량, 요금제 한도(5시간/주간), 세션 비용을 프롬프트 위 한 줄로 보여줍니다.

```
컨텍스트 ███░░░░░ 42%   5시간 ██░░░░░░ 23% (2h13m)   주간 █░░░░░░░ 12% (3d4h)   $1.23
```

Claude Code v2.1.302에서 테스트했습니다.

줄 끝의 `끄기` 버튼으로 끄고, `/usage-panel` 로 다시 켭니다 (켜기/끄기 상태는 다음 세션에도 유지).

## 설치

```
claude plugin marketplace add bbabbico/usage-panel
claude plugin install usage-panel@usage-panel
```

## 업데이트

```
claude plugin update usage-panel@usage-panel
```
