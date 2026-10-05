"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { buttonClasses } from "@/components/button";

const MIN_SCALE = 0.05;
const MAX_SCALE = 8;
const STEP = 1.25;

const clamp = (scale: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));

/**
 * A submitted image read in place, the way a scanned page is read: zoomed, dragged around, turned
 * the right way up -- beside the comments on it rather than in a dialog over them, so a teacher can
 * read and write at once.
 *
 * **Panning is the viewport's own scrolling.** The image is laid out at its zoomed size inside a
 * scrolling box, and dragging moves that box's scroll position; the scrollbars, the wheel and a
 * touch screen keep working as they do anywhere, and nothing here re-implements them. Zooming is
 * Ctrl (or ⌘) with the wheel -- a trackpad pinch arrives as exactly that -- and keeps the point
 * under the pointer where it was; a plain wheel scrolls, because taking the wheel away from a page
 * the teacher is scrolling through would be the worse surprise.
 *
 * Opens fitted to the width, never above its real size: a scan is read top to bottom, and a small
 * image blown up to the column is only blur.
 */
export function ImageViewer({ href, name }: { href: string; name: string }) {
  const t = useTranslations("Sources.preview.viewer");
  const frame = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [dragging, setDragging] = useState(false);
  // The scroll position a zoom should land on, applied once the new size is laid out.
  const pendingScroll = useRef<{ left: number; top: number } | null>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  // The wheel listener is attached once and reads the scale from here.
  const scaleRef = useRef(scale);

  const turned = rotation % 180 !== 0;
  const box = natural ? (turned ? { w: natural.h, h: natural.w } : natural) : null;

  function fit(mode: "width" | "page") {
    const el = viewport.current;
    if (!el || !box) return 1;
    const width = el.clientWidth / box.w;
    return clamp(mode === "width" ? width : Math.min(width, el.clientHeight / box.h));
  }

  const zoomTo = useCallback((next: number, anchor?: { x: number; y: number }) => {
    const el = viewport.current;
    if (!el) return;
    const target = clamp(next);
    const ax = anchor?.x ?? el.clientWidth / 2;
    const ay = anchor?.y ?? el.clientHeight / 2;
    const ratio = target / scaleRef.current;
    pendingScroll.current = {
      left: (el.scrollLeft + ax) * ratio - ax,
      top: (el.scrollTop + ay) * ratio - ay,
    };
    setScale(target);
  }, []);

  useLayoutEffect(() => {
    scaleRef.current = scale;
    const el = viewport.current;
    if (el && pendingScroll.current) {
      el.scrollLeft = pendingScroll.current.left;
      el.scrollTop = pendingScroll.current.top;
      pendingScroll.current = null;
    }
  }, [scale]);

  // Not React's `onWheel`: that listener is passive, and a zoom has to stop the page scrolling.
  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const rect = el.getBoundingClientRect();
      zoomTo(scaleRef.current * Math.exp(-event.deltaY * 0.002), {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomTo]);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === frame.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void frame.current?.requestFullscreen();
  }

  // Fitted once its size is known. An image the browser had finished before hydration fires no
  // `load` React could hear -- a cached one usually has -- so mounting asks as well.
  const image = useRef<HTMLImageElement>(null);
  const measure = useCallback(() => {
    const img = image.current;
    if (!img || img.naturalWidth === 0) return;
    const size = { w: img.naturalWidth, h: img.naturalHeight };
    setNatural(size);
    const width = viewport.current?.clientWidth ?? size.w;
    setScale(clamp(Math.min(1, width / size.w)));
  }, []);
  useEffect(() => {
    if (image.current?.complete) measure();
  }, [measure]);

  const percent = Math.round(scale * 100);

  return (
    <div
      ref={frame}
      className="flex flex-col gap-2 rounded-md border border-border bg-background p-2"
    >
      <div
        role="toolbar"
        aria-label={t("toolbar", { name })}
        className="flex flex-wrap items-center gap-1.5"
      >
        <button
          type="button"
          className={buttonClasses("outline", "xs", "w-7")}
          aria-label={t("zoomOut")}
          title={t("zoomOut")}
          onClick={() => zoomTo(scaleRef.current / STEP)}
        >
          −
        </button>
        <span className="w-12 text-center text-xs tabular-nums" aria-live="polite">
          {percent} %
        </span>
        <button
          type="button"
          className={buttonClasses("outline", "xs", "w-7")}
          aria-label={t("zoomIn")}
          title={t("zoomIn")}
          onClick={() => zoomTo(scaleRef.current * STEP)}
        >
          +
        </button>
        <span aria-hidden="true" className="mx-1 h-5 w-px bg-border" />
        <button
          type="button"
          className={buttonClasses("outline", "xs")}
          onClick={() => zoomTo(fit("width"))}
        >
          {t("fitWidth")}
        </button>
        <button
          type="button"
          className={buttonClasses("outline", "xs")}
          onClick={() => zoomTo(fit("page"))}
        >
          {t("fitPage")}
        </button>
        <button
          type="button"
          className={buttonClasses("outline", "xs")}
          title={t("actualTitle")}
          onClick={() => zoomTo(1)}
        >
          1:1
        </button>
        <span aria-hidden="true" className="mx-1 h-5 w-px bg-border" />
        <button
          type="button"
          className={buttonClasses("outline", "xs")}
          onClick={() => setRotation((value) => (value + 90) % 360)}
        >
          {t("rotate")}
        </button>
        <button type="button" className={buttonClasses("outline", "xs")} onClick={toggleFullscreen}>
          {fullscreen ? t("exitFullscreen") : t("fullscreen")}
        </button>
        <span className="ml-auto hidden text-xs text-muted-foreground sm:inline">{t("hint")}</span>
      </div>

      <div
        ref={viewport}
        className={`overflow-auto rounded-sm bg-muted/40 [scrollbar-gutter:stable] ${
          fullscreen ? "h-[calc(100vh-4rem)]" : "h-[75vh]"
        } ${dragging ? "cursor-grabbing select-none" : "cursor-grab"}`}
        onPointerDown={(event) => {
          // A mouse drags; a finger already scrolls the box natively.
          if (event.pointerType !== "mouse" || event.button !== 0) return;
          const el = viewport.current!;
          // Pressed on the box's own scrollbar, which drags itself.
          const rect = el.getBoundingClientRect();
          if (
            event.clientX - rect.left > el.clientWidth ||
            event.clientY - rect.top > el.clientHeight
          )
            return;
          drag.current = {
            x: event.clientX,
            y: event.clientY,
            left: el.scrollLeft,
            top: el.scrollTop,
          };
          el.setPointerCapture(event.pointerId);
          setDragging(true);
        }}
        onPointerMove={(event) => {
          const start = drag.current;
          if (!start) return;
          const el = viewport.current!;
          el.scrollLeft = start.left - (event.clientX - start.x);
          el.scrollTop = start.top - (event.clientY - start.y);
        }}
        onPointerUp={() => {
          drag.current = null;
          setDragging(false);
        }}
        onPointerCancel={() => {
          drag.current = null;
          setDragging(false);
        }}
      >
        {/* At least the viewport's size, so a small image sits in the middle; at most the image's,
            so a large one scrolls rather than being cut off at the left. */}
        <div className="grid min-h-full w-max min-w-full place-items-center">
          <div
            className="relative"
            style={box ? { width: box.w * scale, height: box.h * scale } : undefined}
          >
            {/* Not `next/image`: the bytes come from a route that authorises per solution, the
                dimensions are unknown until it loads, and optimising a submitted file would mean
                running it through the image pipeline -- which is work, and a surface, for nothing. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={href}
              alt={name}
              draggable={false}
              ref={image}
              onLoad={measure}
              className={natural ? "absolute top-1/2 left-1/2 max-w-none" : "max-w-full"}
              style={
                natural
                  ? {
                      width: natural.w * scale,
                      height: natural.h * scale,
                      transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
                    }
                  : undefined
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
