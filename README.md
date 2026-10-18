# usage-panel

Claude Code 모드: 현재 모델과 effort, 컨텍스트 사용량, 요금제 한도(5시간/주간), 세션 비용을 프롬프트 위 한 줄로 보여줍니다.

```
Opus 5.5 · high   컨텍스트 ███░░░░░ 42%   5시간 ██░░░░░░ 23% (2h13m)   주간 █░░░░░░░ 12% (3d4h)   $1.23   끄기
```

Claude Code v2.1.302에서 테스트했습니다.

줄 끝의 `끄기` 버튼으로 접고, 남는 `사용량 보기` 버튼으로 다시 켭니다. `/usage-panel` 로도 전환됩니다 (상태는 다음 세션에도 유지). effort는 시작할 때 저장된 기본값을, `/effort`·`/model` 직후엔 바뀐 값을, 응답이 오면 실제 적용된 값을 보여줍니다.

## 설치

```
claude plugin marketplace add bbabbico/usage-panel
claude plugin install usage-panel@usage-panel
```

## 업데이트

```
claude plugin update usage-panel@usage-panel
```
