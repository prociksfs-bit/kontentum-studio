import { useEffect, useRef, useState, useCallback } from "react";
import type { MediaSource } from "../App";

interface CropSettings {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

interface Position {
  x: number;
  y: number;
}

interface Props {
  sources: MediaSource[];
  cameraStream: MediaStream | null;
  screenStream: MediaStream | null;
  isLive: boolean;
  cameraCrop: CropSettings;
  screenCrop: CropSettings;
  onCameraCropChange: (crop: CropSettings) => void;
  onScreenCropChange: (crop: CropSettings) => void;
  pipShape: "rect" | "round";
}

/**
 * Оверлей интерактивной обрезки.
 * Затемняет обрезанные зоны, показывает пунктирные линии-ручки для перетаскивания.
 */
function CropOverlay({
  crop,
  onCropChange,
  containerRef,
  active,
}: {
  crop: CropSettings;
  onCropChange: (crop: CropSettings) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
  active: boolean;
}) {
  const [dragging, setDragging] = useState<string | null>(null);

  const handleMouseDown = useCallback(
    (edge: string) => (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragging(edge);
    },
    [],
  );

  useEffect(() => {
    if (!dragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const relX = ((e.clientX - rect.left) / rect.width) * 100;
      const relY = ((e.clientY - rect.top) / rect.height) * 100;
      const clamp = (v: number) => Math.max(0, Math.min(40, Math.round(v)));

      const next = { ...crop };
      if (dragging === "top") next.top = clamp(relY);
      else if (dragging === "bottom") next.bottom = clamp(100 - relY);
      else if (dragging === "left") next.left = clamp(relX);
      else if (dragging === "right") next.right = clamp(100 - relX);
      onCropChange(next);
    };

    const handleMouseUp = () => setDragging(null);

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging, crop, onCropChange, containerRef]);

  if (!active && !dragging) return null;

  return (
    <div className="crop-overlay">
      {/* Затемнённые обрезанные области */}
      {crop.top > 0 && (
        <div
          className="crop-dim"
          style={{ top: 0, left: 0, right: 0, height: `${crop.top}%` }}
        />
      )}
      {crop.bottom > 0 && (
        <div
          className="crop-dim"
          style={{ bottom: 0, left: 0, right: 0, height: `${crop.bottom}%` }}
        />
      )}
      {crop.left > 0 && (
        <div
          className="crop-dim"
          style={{
            left: 0,
            top: `${crop.top}%`,
            bottom: `${crop.bottom}%`,
            width: `${crop.left}%`,
          }}
        />
      )}
      {crop.right > 0 && (
        <div
          className="crop-dim"
          style={{
            right: 0,
            top: `${crop.top}%`,
            bottom: `${crop.bottom}%`,
            width: `${crop.right}%`,
          }}
        />
      )}

      {/* Пунктирные линии-ручки для перетаскивания */}
      <div
        className={`crop-handle crop-handle-h ${dragging === "top" ? "active" : ""}`}
        style={{ top: `${crop.top}%`, left: `${crop.left}%`, right: `${crop.right}%` }}
        onMouseDown={handleMouseDown("top")}
        title="Тяните для обрезки сверху"
      />
      <div
        className={`crop-handle crop-handle-h ${dragging === "bottom" ? "active" : ""}`}
        style={{ bottom: `${crop.bottom}%`, left: `${crop.left}%`, right: `${crop.right}%` }}
        onMouseDown={handleMouseDown("bottom")}
        title="Тяните для обрезки снизу"
      />
      <div
        className={`crop-handle crop-handle-v ${dragging === "left" ? "active" : ""}`}
        style={{ left: `${crop.left}%`, top: `${crop.top}%`, bottom: `${crop.bottom}%` }}
        onMouseDown={handleMouseDown("left")}
        title="Тяните для обрезки слева"
      />
      <div
        className={`crop-handle crop-handle-v ${dragging === "right" ? "active" : ""}`}
        style={{ right: `${crop.right}%`, top: `${crop.top}%`, bottom: `${crop.bottom}%` }}
        onMouseDown={handleMouseDown("right")}
        title="Тяните для обрезки справа"
      />

      {/* Угловые маркеры */}
      <div className="crop-corner crop-corner-tl" style={{ top: `${crop.top}%`, left: `${crop.left}%` }} />
      <div className="crop-corner crop-corner-tr" style={{ top: `${crop.top}%`, right: `${crop.right}%` }} />
      <div className="crop-corner crop-corner-bl" style={{ bottom: `${crop.bottom}%`, left: `${crop.left}%` }} />
      <div className="crop-corner crop-corner-br" style={{ bottom: `${crop.bottom}%`, right: `${crop.right}%` }} />
    </div>
  );
}

/**
 * Область предпросмотра видео с интерактивным кроппингом и перетаскиванием.
 *
 * - Ctrl + перетаскивание: обрезка видео (пунктирные границы)
 * - Перетаскивание PiP камеры: перемещение по превью
 * - Перетаскивание экрана: смещение контента
 * - Двойной клик: сброс позиции
 */
export default function Preview({
  sources,
  cameraStream,
  screenStream,
  isLive,
  cameraCrop,
  screenCrop,
  onCameraCropChange,
  onScreenCropChange,
  pipShape,
}: Props) {
  const cameraRef = useRef<HTMLVideoElement>(null);
  const screenRef = useRef<HTMLVideoElement>(null);
  const cameraContainerRef = useRef<HTMLDivElement>(null);
  const screenContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Зажат ли Ctrl
  const [ctrlHeld, setCtrlHeld] = useState(false);

  // Позиция PiP камеры в пикселях (null = позиция по умолчанию bottom-right)
  const [pipPos, setPipPos] = useState<Position | null>(null);

  // Смещение экрана от центра в пикселях
  const [screenOffset, setScreenOffset] = useState<Position>({ x: 0, y: 0 });

  // Информация о текущем перетаскивании
  const [dragInfo, setDragInfo] = useState<{
    target: "pip" | "screen";
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  // Привязка видеопотоков к элементам
  useEffect(() => {
    if (cameraRef.current && cameraStream) {
      cameraRef.current.srcObject = cameraStream;
    }
  }, [cameraStream]);

  useEffect(() => {
    if (screenRef.current && screenStream) {
      screenRef.current.srcObject = screenStream;
    }
  }, [screenStream]);

  // Сброс позиций при смене режима
  useEffect(() => {
    setPipPos(null);
  }, [screenStream]);

  useEffect(() => {
    setScreenOffset({ x: 0, y: 0 });
  }, [screenStream]);

  // Глобальный слушатель клавиши Ctrl
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "Control" || e.key === "Meta") setCtrlHeld(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === "Control" || e.key === "Meta") setCtrlHeld(false);
    };
    const blur = () => setCtrlHeld(false);

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);

  // Обработка перетаскивания PiP / экрана
  useEffect(() => {
    if (!dragInfo) return;

    const handleMouseMove = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();

      if (dragInfo.target === "pip") {
        const x = dragInfo.origX + (e.clientX - dragInfo.startX);
        const y = dragInfo.origY + (e.clientY - dragInfo.startY);
        const pipW = pipShape === "round" ? 130 : 200;
        const pipH = pipShape === "round" ? 130 : 125;
        setPipPos({
          x: Math.max(0, Math.min(rect.width - pipW, x)),
          y: Math.max(0, Math.min(rect.height - pipH, y)),
        });
      } else {
        setScreenOffset({
          x: dragInfo.origX + (e.clientX - dragInfo.startX),
          y: dragInfo.origY + (e.clientY - dragInfo.startY),
        });
      }
    };

    const handleMouseUp = () => setDragInfo(null);

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragInfo, pipShape]);

  const hasScreen = !!screenStream;
  const hasCamera = !!cameraStream;

  // CSS clip-path для обрезки
  const getCropStyle = (crop: CropSettings): React.CSSProperties => {
    const hasCrop = crop.top > 0 || crop.bottom > 0 || crop.left > 0 || crop.right > 0;
    if (!hasCrop) return {};
    return {
      clipPath: `inset(${crop.top}% ${crop.right}% ${crop.bottom}% ${crop.left}%)`,
    };
  };

  // Начало перетаскивания PiP камеры
  const handlePipMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (ctrlHeld) return; // В режиме обрезки не перетаскиваем
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();

      let origX: number;
      let origY: number;

      if (pipPos) {
        origX = pipPos.x;
        origY = pipPos.y;
      } else {
        // Дефолтная позиция (bottom-right)
        const pipW = pipShape === "round" ? 130 : 200;
        const pipH = pipShape === "round" ? 130 : 125;
        origX = rect.width - pipW - 12;
        origY = rect.height - pipH - 12;
      }

      setDragInfo({ target: "pip", startX: e.clientX, startY: e.clientY, origX, origY });
    },
    [ctrlHeld, pipPos, pipShape],
  );

  // Начало перетаскивания экрана
  const handleScreenMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (ctrlHeld) return; // В режиме обрезки не перетаскиваем
      e.preventDefault();
      setDragInfo({
        target: "screen",
        startX: e.clientX,
        startY: e.clientY,
        origX: screenOffset.x,
        origY: screenOffset.y,
      });
    },
    [ctrlHeld, screenOffset],
  );

  // Двойной клик — сброс позиции
  const handlePipDoubleClick = useCallback(() => {
    setPipPos(null);
  }, []);

  const handleScreenDoubleClick = useCallback(() => {
    setScreenOffset({ x: 0, y: 0 });
  }, []);

  // Стиль позиции PiP
  const getPipPositionStyle = (): React.CSSProperties => {
    if (!pipPos) {
      return { position: "absolute", bottom: 12, right: 12 };
    }
    return { position: "absolute", left: pipPos.x, top: pipPos.y };
  };

  return (
    <div className="preview">
      {isLive && (
        <div className="live-pill" style={{ position: "absolute", top: 12, left: 12, zIndex: 10 }}>
          <span className="live-dot" />
          LIVE
        </div>
      )}

      {/* Подсказка режима обрезки */}
      {ctrlHeld && (hasCamera || hasScreen) && (
        <div className="crop-mode-hint">
          ✂️ Режим обрезки — тяните за пунктирные линии
        </div>
      )}

      <div className="preview-canvas" ref={canvasRef}>
        {/* === Экран / окно === */}
        {hasScreen && (
          <div
            ref={screenContainerRef}
            className="screen-container"
            style={{
              width: "100%",
              height: "100%",
              overflow: "hidden",
              position: "relative",
              cursor: ctrlHeld
                ? "crosshair"
                : dragInfo?.target === "screen"
                  ? "grabbing"
                  : "grab",
            }}
            onMouseDown={handleScreenMouseDown}
            onDoubleClick={handleScreenDoubleClick}
          >
            <video
              ref={screenRef}
              className="preview-screen"
              autoPlay
              playsInline
              muted
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                transform: `translate(${screenOffset.x}px, ${screenOffset.y}px)`,
                ...getCropStyle(screenCrop),
                pointerEvents: "none",
              }}
            />
            {/* Интерактивная обрезка экрана по Ctrl */}
            <CropOverlay
              crop={screenCrop}
              onCropChange={onScreenCropChange}
              containerRef={screenContainerRef}
              active={ctrlHeld}
            />
          </div>
        )}

        {/* === Камера === */}
        {hasCamera && (
          <div
            ref={cameraContainerRef}
            className={hasScreen ? "pip-wrapper" : "camera-full-container"}
            style={
              hasScreen
                ? {
                    ...getPipPositionStyle(),
                    width: pipShape === "round" ? 130 : 200,
                    height: pipShape === "round" ? 130 : 125,
                    borderRadius: pipShape === "round" ? "50%" : 14,
                    overflow: "hidden",
                    border: `2px solid rgba(0, 245, 255, ${ctrlHeld ? "0.8" : "0.3"})`,
                    borderStyle: ctrlHeld ? "dashed" : "solid",
                    boxShadow: ctrlHeld
                      ? "0 0 30px rgba(0, 245, 255, 0.3)"
                      : "0 0 20px rgba(0, 245, 255, 0.15)",
                    zIndex: 5,
                    cursor: ctrlHeld
                      ? "crosshair"
                      : dragInfo?.target === "pip"
                        ? "grabbing"
                        : "grab",
                    transition: "border 0.2s, box-shadow 0.2s",
                  }
                : {
                    width: "100%",
                    height: "100%",
                    overflow: "hidden",
                    position: "relative" as const,
                    cursor: ctrlHeld ? "crosshair" : "default",
                  }
            }
            onMouseDown={hasScreen ? handlePipMouseDown : undefined}
            onDoubleClick={hasScreen ? handlePipDoubleClick : undefined}
          >
            <video
              ref={cameraRef}
              className={`preview-camera ${hasScreen ? "pip" : "full"}`}
              autoPlay
              playsInline
              muted
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                ...getCropStyle(cameraCrop),
                ...(hasScreen
                  ? {
                      position: "static",
                      border: "none",
                      borderRadius: 0,
                      boxShadow: "none",
                    }
                  : {}),
                pointerEvents: "none",
              }}
            />
            {/* Интерактивная обрезка камеры по Ctrl (только в полноэкранном режиме) */}
            {!hasScreen && (
              <CropOverlay
                crop={cameraCrop}
                onCropChange={onCameraCropChange}
                containerRef={cameraContainerRef}
                active={ctrlHeld}
              />
            )}
          </div>
        )}

        {/* Заглушка */}
        {!hasCamera && !hasScreen && (
          <div className="preview-placeholder">
            <div className="placeholder-icon">📡</div>
            <div className="placeholder-text">
              Подключите камеру или захватите экран
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
