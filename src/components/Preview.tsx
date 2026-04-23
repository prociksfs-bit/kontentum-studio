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

/** Тип пресета аспекта */
type AspectRatioPreset = "free" | "16:9" | "4:3" | "1:1";

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
 * Вычисляет соотношение сторон по пресету.
 * Возвращает null для "free".
 */
function getAspectRatio(preset: AspectRatioPreset): number | null {
  switch (preset) {
    case "16:9": return 16 / 9;
    case "4:3": return 4 / 3;
    case "1:1": return 1;
    default: return null;
  }
}

/**
 * Применяет ограничение аспекта при перетаскивании угла.
 * Принимает текущий crop и желаемое изменение, возвращает скорректированный crop.
 */
function constrainAspectRatio(
  crop: CropSettings,
  ratio: number,
  corner: string,
): CropSettings {
  // Доступная область: ширина = 100 - left - right, высота = 100 - top - bottom
  const w = 100 - crop.left - crop.right;
  const h = 100 - crop.top - crop.bottom;
  const currentRatio = w / h;

  const next = { ...crop };

  if (currentRatio > ratio) {
    // Слишком широко — увеличиваем горизонтальную обрезку
    const targetW = h * ratio;
    const extraCrop = (w - targetW) / 2;
    if (corner.includes("l")) {
      next.left = crop.left + (w - targetW);
    } else if (corner.includes("r")) {
      next.right = crop.right + (w - targetW);
    } else {
      next.left = crop.left + extraCrop;
      next.right = crop.right + extraCrop;
    }
  } else if (currentRatio < ratio) {
    // Слишком высоко — увеличиваем вертикальную обрезку
    const targetH = w / ratio;
    const extraCrop = (h - targetH) / 2;
    if (corner.includes("t")) {
      next.top = crop.top + (h - targetH);
    } else if (corner.includes("b")) {
      next.bottom = crop.bottom + (h - targetH);
    } else {
      next.top = crop.top + extraCrop;
      next.bottom = crop.bottom + extraCrop;
    }
  }

  // Клампим все значения
  next.top = Math.max(0, Math.min(50, Math.round(next.top)));
  next.bottom = Math.max(0, Math.min(50, Math.round(next.bottom)));
  next.left = Math.max(0, Math.min(50, Math.round(next.left)));
  next.right = Math.max(0, Math.min(50, Math.round(next.right)));

  return next;
}

/**
 * Оверлей интерактивной обрезки.
 * 8 ручек: 4 угловые (диагональный ресайз) + 4 грани.
 * Затемняет обрезанные зоны, показывает сетку третей при перетаскивании.
 */
function CropOverlay({
  crop,
  onCropChange,
  containerRef,
  active,
  aspectRatio,
  shiftHeld,
}: {
  crop: CropSettings;
  onCropChange: (crop: CropSettings) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
  active: boolean;
  aspectRatio: number | null;
  shiftHeld: boolean;
}) {
  const [dragging, setDragging] = useState<string | null>(null);

  // Запоминаем начальное соотношение при старте перетаскивания с Shift
  const startRatioRef = useRef<number | null>(null);

  const handleMouseDown = useCallback(
    (edge: string) => (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragging(edge);
      // Запоминаем текущий аспект при начале перетаскивания
      const w = 100 - crop.left - crop.right;
      const h = 100 - crop.top - crop.bottom;
      startRatioRef.current = h > 0 ? w / h : 1;
    },
    [crop],
  );

  useEffect(() => {
    if (!dragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const relX = ((e.clientX - rect.left) / rect.width) * 100;
      const relY = ((e.clientY - rect.top) / rect.height) * 100;
      const clamp = (v: number) => Math.max(0, Math.min(50, Math.round(v)));

      let next = { ...crop };

      // Угловые ручки — перетаскивают обе грани одновременно
      if (dragging === "tl") {
        next.top = clamp(relY);
        next.left = clamp(relX);
      } else if (dragging === "tr") {
        next.top = clamp(relY);
        next.right = clamp(100 - relX);
      } else if (dragging === "bl") {
        next.bottom = clamp(100 - relY);
        next.left = clamp(relX);
      } else if (dragging === "br") {
        next.bottom = clamp(100 - relY);
        next.right = clamp(100 - relX);
      }
      // Грани
      else if (dragging === "top") next.top = clamp(relY);
      else if (dragging === "bottom") next.bottom = clamp(100 - relY);
      else if (dragging === "left") next.left = clamp(relX);
      else if (dragging === "right") next.right = clamp(100 - relX);

      // Применяем ограничение аспекта
      const effectiveRatio = aspectRatio ?? (shiftHeld ? startRatioRef.current : null);
      if (effectiveRatio && ["tl", "tr", "bl", "br"].includes(dragging)) {
        next = constrainAspectRatio(next, effectiveRatio, dragging);
      }

      onCropChange(next);
    };

    const handleMouseUp = () => {
      setDragging(null);
      startRatioRef.current = null;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging, crop, onCropChange, containerRef, aspectRatio, shiftHeld]);

  if (!active && !dragging) return null;

  const isDragging = !!dragging;

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

      {/* Сетка третей — видна только при активном перетаскивании */}
      {isDragging && (
        <div
          className="crop-thirds-grid"
          style={{
            top: `${crop.top}%`,
            left: `${crop.left}%`,
            right: `${crop.right}%`,
            bottom: `${crop.bottom}%`,
          }}
        >
          <div className="thirds-line thirds-h" style={{ top: "33.33%" }} />
          <div className="thirds-line thirds-h" style={{ top: "66.66%" }} />
          <div className="thirds-line thirds-v" style={{ left: "33.33%" }} />
          <div className="thirds-line thirds-v" style={{ left: "66.66%" }} />
        </div>
      )}

      {/* 4 грани (edge handles) */}
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

      {/* 4 угловые ручки (corner handles) — интерактивные */}
      <div
        className={`crop-corner crop-corner-tl ${dragging === "tl" ? "active" : ""}`}
        style={{ top: `${crop.top}%`, left: `${crop.left}%` }}
        onMouseDown={handleMouseDown("tl")}
        title="Тяните для обрезки угла"
      />
      <div
        className={`crop-corner crop-corner-tr ${dragging === "tr" ? "active" : ""}`}
        style={{ top: `${crop.top}%`, right: `${crop.right}%` }}
        onMouseDown={handleMouseDown("tr")}
        title="Тяните для обрезки угла"
      />
      <div
        className={`crop-corner crop-corner-bl ${dragging === "bl" ? "active" : ""}`}
        style={{ bottom: `${crop.bottom}%`, left: `${crop.left}%` }}
        onMouseDown={handleMouseDown("bl")}
        title="Тяните для обрезки угла"
      />
      <div
        className={`crop-corner crop-corner-br ${dragging === "br" ? "active" : ""}`}
        style={{ bottom: `${crop.bottom}%`, right: `${crop.right}%` }}
        onMouseDown={handleMouseDown("br")}
        title="Тяните для обрезки угла"
      />

      {/* Бейдж аспекта */}
      {aspectRatio && (
        <div
          className="crop-aspect-badge"
          style={{
            top: `calc(${crop.top}% + 4px)`,
            left: `calc(${crop.left}% + 4px)`,
          }}
        >
          {aspectRatio === 16 / 9 ? "16:9" : aspectRatio === 4 / 3 ? "4:3" : aspectRatio === 1 ? "1:1" : "locked"}
        </div>
      )}
    </div>
  );
}

/**
 * Область предпросмотра видео с интерактивным кроппингом и перетаскиванием.
 *
 * - Alt + перетаскивание: обрезка видео (пунктирные границы)
 * - Перетаскивание PiP камеры: перемещение по превью
 * - Перетаскивание экрана: смещение контента
 * - Двойной клик: сброс позиции
 * - Arrow keys (в режиме обрезки): 1% шаг, Shift+Arrow: 5% шаг
 * - R (в режиме обрезки): сброс обрезки
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

  // Зажат ли Ctrl (режим обрезки, как в большинстве видеоредакторов)
  const [altHeld, setAltHeld] = useState(false);

  // Режим обрезки зафиксирован (тогл по клику на кнопку ✂)
  const [cropModeLocked, setCropModeLocked] = useState(false);

  // Зажат ли Shift (для блокировки аспекта)
  const [shiftHeld, setShiftHeld] = useState(false);

  // Пресет аспекта
  const [aspectPreset, setAspectPreset] = useState<AspectRatioPreset>("free");

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

  // Глобальный слушатель клавиш: Ctrl = режим обрезки, Shift = блокировка аспекта
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // Ctrl активирует режим обрезки (удержание)
      if (e.key === "Control") {
        e.preventDefault();
        setAltHeld(true);
      }
      if (e.key === "Shift") setShiftHeld(true);
      // Escape — выход из зафиксированного режима обрезки
      if (e.key === "Escape") setCropModeLocked(false);
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === "Control") {
        // Если режим зафиксирован — не снимаем при отпускании Ctrl
        if (!cropModeLocked) setAltHeld(false);
      }
      if (e.key === "Shift") setShiftHeld(false);
    };
    const blur = () => {
      setAltHeld(false);
      setShiftHeld(false);
    };

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [cropModeLocked]);

  // Клавиатурное управление обрезкой (Ctrl зажат или режим зафиксирован)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!altHeld && !cropModeLocked) return;
      const hasScreen = !!screenStream;
      const hasCamera = !!cameraStream;
      if (!hasScreen && !hasCamera) return;

      // Определяем активный crop (экран приоритетнее если есть)
      const activeCrop = hasScreen ? screenCrop : cameraCrop;
      const setActiveCrop = hasScreen ? onScreenCropChange : onCameraCropChange;

      const step = e.shiftKey ? 5 : 1;

      // R — сброс обрезки
      if (e.key === "r" || e.key === "R" || e.key === "к" || e.key === "К") {
        e.preventDefault();
        setActiveCrop({ top: 0, bottom: 0, left: 0, right: 0 });
        return;
      }

      const clamp = (v: number) => Math.max(0, Math.min(50, v));

      // Стрелки — регулировка обрезки
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveCrop({ ...activeCrop, top: clamp(activeCrop.top + step) });
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveCrop({ ...activeCrop, bottom: clamp(activeCrop.bottom + step) });
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setActiveCrop({ ...activeCrop, left: clamp(activeCrop.left + step) });
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setActiveCrop({ ...activeCrop, right: clamp(activeCrop.right + step) });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [altHeld, cropModeLocked, screenStream, cameraStream, screenCrop, cameraCrop, onScreenCropChange, onCameraCropChange]);

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
      if (cropActive) return; // В режиме обрезки не перетаскиваем
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
    [cropActive, pipPos, pipShape],
  );

  // Начало перетаскивания экрана
  const handleScreenMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (cropActive) return; // В режиме обрезки не перетаскиваем
      e.preventDefault();
      setDragInfo({
        target: "screen",
        startX: e.clientX,
        startY: e.clientY,
        origX: screenOffset.x,
        origY: screenOffset.y,
      });
    },
    [cropActive, screenOffset],
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

  const effectiveAspectRatio = getAspectRatio(aspectPreset);
  // Режим обрезки активен если Ctrl зажат ИЛИ зафиксирован кнопкой
  const cropActive = altHeld || cropModeLocked;

  return (
    <div className="preview">
      {isLive && (
        <div className="live-pill" style={{ position: "absolute", top: 12, left: 12, zIndex: 10 }}>
          <span className="live-dot" />
          LIVE
        </div>
      )}

      {/* Кнопка тогла режима обрезки */}
      {(hasCamera || hasScreen) && (
        <button
          className={`crop-toggle-btn ${(altHeld || cropModeLocked) ? "active" : ""}`}
          onClick={() => {
            const next = !cropModeLocked;
            setCropModeLocked(next);
            setAltHeld(next);
          }}
          title={cropModeLocked ? "Выйти из режима обрезки (Esc)" : "Режим обрезки (Ctrl или клик)"}
        >
          ✂ {cropModeLocked ? "Выйти из обрезки" : "Обрезать"}
        </button>
      )}

      {/* Подсказка режима обрезки */}
      {(altHeld || cropModeLocked) && (hasCamera || hasScreen) && (
        <div className="crop-mode-hint">
          ✂️ Тяните за линии/углы для обрезки | ←→↑↓: ±1% | Shift+Arrow: ±5% | R: сброс | Esc: выход
        </div>
      )}

      {/* Пресеты аспекта (видны в режиме обрезки) */}
      {(altHeld || cropModeLocked) && (hasCamera || hasScreen) && (
        <div className="crop-aspect-presets">
          {(["free", "16:9", "4:3", "1:1"] as AspectRatioPreset[]).map((preset) => (
            <button
              key={preset}
              className={`crop-aspect-btn ${aspectPreset === preset ? "active" : ""}`}
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAspectPreset(preset); }}
            >
              {preset === "free" ? "Free" : preset}
            </button>
          ))}
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
              cursor: cropActive
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
            {/* Интерактивная обрезка экрана по Alt */}
            <CropOverlay
              crop={screenCrop}
              onCropChange={onScreenCropChange}
              containerRef={screenContainerRef}
              active={cropActive}
              aspectRatio={effectiveAspectRatio}
              shiftHeld={shiftHeld}
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
                    border: `2px solid rgba(0, 245, 255, ${cropActive ? "0.8" : "0.3"})`,
                    borderStyle: cropActive ? "dashed" : "solid",
                    boxShadow: cropActive
                      ? "0 0 30px rgba(0, 245, 255, 0.3)"
                      : "0 0 20px rgba(0, 245, 255, 0.15)",
                    zIndex: 5,
                    cursor: cropActive
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
                    cursor: cropActive ? "crosshair" : "default",
                  }
            }
            onMouseDown={hasScreen && !cropActive ? handlePipMouseDown : undefined}
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
            {/* Интерактивная обрезка камеры по Alt — работает и в PiP и в полноэкранном режиме */}
            <CropOverlay
              crop={cameraCrop}
              onCropChange={onCameraCropChange}
              containerRef={cameraContainerRef}
              active={cropActive}
              aspectRatio={effectiveAspectRatio}
              shiftHeld={shiftHeld}
            />
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
