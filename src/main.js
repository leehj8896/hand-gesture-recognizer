import {
  FilesetResolver,
  GestureRecognizer,
  DrawingUtils,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/vision_bundle.mjs";

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task";
const WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";

const video = document.querySelector("#webcam");
const canvas = document.querySelector("#overlay");
const cameraButton = document.querySelector("#toggle-camera");
const stateBadge = document.querySelector("#state-badge");
const modelStatus = document.querySelector("#model-status");
const cameraStatus = document.querySelector("#camera-status");
const fpsStatus = document.querySelector("#fps-status");
const gestureResults = document.querySelector("#gesture-results");
const landmarkCoordinates = document.querySelector("#landmark-coordinates");

const canvasContext = canvas.getContext("2d");
const drawingUtils = new DrawingUtils(canvasContext);

let gestureRecognizer;
let stream;
let animationFrameId = 0;
let lastVideoTime = -1;
let lastFrameTimestamp = performance.now();
let cameraEnabled = false;

const gestureNameMap = {
  None: "Unknown",
  Closed_Fist: "Closed_Fist",
  Open_Palm: "Open_Palm",
  Pointing_Up: "Pointing_Up",
  Thumb_Down: "Thumb_Down",
  Thumb_Up: "Thumb_Up",
  Victory: "Victory",
  ILoveYou: "ILoveYou",
};

const handLandmarkNames = [
  "WRIST",
  "THUMB_CMC",
  "THUMB_MCP",
  "THUMB_IP",
  "THUMB_TIP",
  "INDEX_FINGER_MCP",
  "INDEX_FINGER_PIP",
  "INDEX_FINGER_DIP",
  "INDEX_FINGER_TIP",
  "MIDDLE_FINGER_MCP",
  "MIDDLE_FINGER_PIP",
  "MIDDLE_FINGER_DIP",
  "MIDDLE_FINGER_TIP",
  "RING_FINGER_MCP",
  "RING_FINGER_PIP",
  "RING_FINGER_DIP",
  "RING_FINGER_TIP",
  "PINKY_MCP",
  "PINKY_PIP",
  "PINKY_DIP",
  "PINKY_TIP",
];

initialize();

async function initialize() {
  setModelStatus("MediaPipe 모델 로드 중...");
  setCameraStatus("대기 중");

  try {
    const vision = await FilesetResolver.forVisionTasks(WASM_URL);
    gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: MODEL_URL,
      },
      runningMode: "VIDEO",
      numHands: 2,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    setModelStatus("준비 완료");
    stateBadge.textContent = "모델 준비 완료";
    cameraButton.disabled = false;
  } catch (error) {
    console.error(error);
    setModelStatus("로드 실패");
    stateBadge.textContent = "모델 로드 실패";
    renderError(
      "MediaPipe 모델을 불러오지 못했습니다. 콘솔 로그와 네트워크 연결 상태를 확인해 주세요.",
    );
  }
}

cameraButton.addEventListener("click", async () => {
  if (!cameraEnabled) {
    await startCamera();
    return;
  }

  stopCamera();
});

async function startCamera() {
  if (!gestureRecognizer) {
    renderError("모델 초기화가 끝난 뒤 다시 시도해 주세요.");
    return;
  }

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: "user",
      },
      audio: false,
    });

    video.srcObject = stream;
    await video.play();

    cameraEnabled = true;
    cameraButton.textContent = "카메라 중지";
    setCameraStatus("실행 중");
    stateBadge.textContent = "실시간 인식 중";
    gestureResults.innerHTML =
      '<p class="empty-message">손을 카메라 앞에 보여 주세요.</p>';
    landmarkCoordinates.innerHTML =
      '<p class="empty-message">손을 카메라 앞에 보여 주면 landmark 좌표가 표시됩니다.</p>';

    syncCanvasSize();
    window.addEventListener("resize", syncCanvasSize);
    lastVideoTime = -1;
    lastFrameTimestamp = performance.now();
    renderLoop();
  } catch (error) {
    console.error(error);
    setCameraStatus("권한 또는 장치 오류");
    stateBadge.textContent = "카메라 시작 실패";
    renderError(
      "웹캠을 열지 못했습니다. 브라우저 권한과 카메라 연결 상태를 확인해 주세요.",
    );
  }
}

function stopCamera() {
  cameraEnabled = false;
  cameraButton.textContent = "카메라 시작";
  setCameraStatus("중지됨");
  stateBadge.textContent = "카메라 중지";
  fpsStatus.textContent = "-";

  cancelAnimationFrame(animationFrameId);

  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    stream = undefined;
  }

  video.srcObject = null;
  clearCanvas();
  gestureResults.innerHTML =
    '<p class="empty-message">카메라를 시작하면 인식 결과가 여기에 표시됩니다.</p>';
  landmarkCoordinates.innerHTML =
    '<p class="empty-message">카메라를 시작하면 landmark 좌표가 여기에 표시됩니다.</p>';
  window.removeEventListener("resize", syncCanvasSize);
}

function renderLoop() {
  if (!cameraEnabled) {
    return;
  }

  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    syncCanvasSize();

    if (lastVideoTime !== video.currentTime) {
      lastVideoTime = video.currentTime;
      const nowInMs = performance.now();
      const results = gestureRecognizer.recognizeForVideo(video, nowInMs);
      updateFps(nowInMs);
      drawResults(results);
      renderGestureResults(results);
      renderLandmarkCoordinates(results);
    }
  }

  animationFrameId = requestAnimationFrame(renderLoop);
}

function syncCanvasSize() {
  const { videoWidth, videoHeight } = video;

  if (!videoWidth || !videoHeight) {
    return;
  }

  canvas.width = videoWidth;
  canvas.height = videoHeight;
}

function drawResults(results) {
  clearCanvas();

  for (const landmarks of results.landmarks ?? []) {
    drawingUtils.drawConnectors(
      landmarks,
      GestureRecognizer.HAND_CONNECTIONS,
      {
        color: "#fef3c7",
        lineWidth: 3,
      },
    );
    drawingUtils.drawLandmarks(landmarks, {
      color: "#fb7185",
      fillColor: "#fff7ed",
      lineWidth: 2,
      radius: 4,
    });
  }
}

function renderGestureResults(results) {
  const gestures = results.gestures ?? [];
  const handedness = results.handedness ?? [];

  if (!gestures.length) {
    gestureResults.innerHTML =
      '<p class="empty-message">손이 감지되지 않았습니다.</p>';
    return;
  }

  const cards = gestures.map((gestureSet, index) => {
    const topGesture = gestureSet[0];
    const categoryName = topGesture?.categoryName ?? "None";
    const score = topGesture?.score ?? 0;
    const handed = handedness[index]?.[0]?.categoryName ?? "Unknown";
    const label = gestureNameMap[categoryName] ?? categoryName;

    return `
      <article class="result-card">
        <div class="result-card-top">
          <span class="pill">${handed}</span>
          <span class="score">${(score * 100).toFixed(1)}%</span>
        </div>
        <strong>${label}</strong>
        <p>raw label: ${categoryName}</p>
      </article>
    `;
  });

  gestureResults.innerHTML = cards.join("");
}

function renderLandmarkCoordinates(results) {
  const landmarksList = results.landmarks ?? [];
  const handedness = results.handedness ?? [];

  if (!landmarksList.length) {
    landmarkCoordinates.innerHTML =
      '<p class="empty-message">손이 감지되면 landmark 좌표가 여기에 표시됩니다.</p>';
    return;
  }

  const sections = landmarksList.map((landmarks, handIndex) => {
    const handed = handedness[handIndex]?.[0]?.categoryName ?? `Hand ${handIndex + 1}`;
    const rows = landmarks
      .map((landmark, landmarkIndex) => {
        const landmarkName =
          handLandmarkNames[landmarkIndex] ?? `LANDMARK_${landmarkIndex}`;

        return `
          <div class="landmark-row">
            <span class="landmark-name">${landmarkName}</span>
            <span class="landmark-value">x=${formatCoordinate(landmark.x)} y=${formatCoordinate(landmark.y)} z=${formatCoordinate(landmark.z)}</span>
          </div>
        `;
      })
      .join("");

    return `
      <section class="landmark-group">
        <div class="landmark-group-header">
          <span class="pill">${handed}</span>
          <span class="landmark-count">${landmarks.length} landmarks</span>
        </div>
        <div class="landmark-grid">${rows}</div>
      </section>
    `;
  });

  landmarkCoordinates.innerHTML = sections.join("");
}

function renderError(message) {
  gestureResults.innerHTML = `<p class="error-message">${message}</p>`;
}

function clearCanvas() {
  canvasContext.save();
  canvasContext.clearRect(0, 0, canvas.width, canvas.height);
  canvasContext.restore();
}

function updateFps(nowInMs) {
  const delta = nowInMs - lastFrameTimestamp;
  lastFrameTimestamp = nowInMs;

  if (delta <= 0) {
    return;
  }

  fpsStatus.textContent = `${Math.round(1000 / delta)}`;
}

function formatCoordinate(value) {
  return Number(value ?? 0).toFixed(3);
}

function setModelStatus(message) {
  modelStatus.textContent = message;
}

function setCameraStatus(message) {
  cameraStatus.textContent = message;
}
