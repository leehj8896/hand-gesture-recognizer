# MediaPipe Gesture Recognizer Web Demo

MediaPipe Gesture Recognizer 기본 제스처 8종을 웹캠으로 확인하는 정적 웹 데모입니다.

## 포함 기능

- 웹캠 연결
- 손 랜드마크 오버레이
- 실시간 제스처 라벨 표시
- handedness(Left/Right) 표시
- FPS 표시

## 제스처 범위

- Unknown
- Closed_Fist
- Open_Palm
- Pointing_Up
- Thumb_Down
- Thumb_Up
- Victory
- ILoveYou

## 실행 방법

브라우저 보안 정책 때문에 `file://` 로 직접 열지 말고, 간단한 로컬 서버로 실행하세요.

### Python이 있을 때

```bash
python3 -m http.server 4173
```

그 다음 브라우저에서 `http://localhost:4173` 을 엽니다.

### VS Code Live Server가 있을 때

프로젝트 루트를 열고 Live Server로 실행합니다.

## 참고

- MediaPipe WASM과 모델은 CDN/Google Storage에서 로드합니다.
- 처음 로드할 때 네트워크 상태에 따라 약간의 준비 시간이 있을 수 있습니다.
