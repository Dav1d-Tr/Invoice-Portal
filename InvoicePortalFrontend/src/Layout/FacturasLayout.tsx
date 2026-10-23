import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Home from "../Pages/Home";
import { getStoredArea } from "../services/authService";
import { captureHomeScroll, findHomeInvoiceRow, restoreHomeScroll } from "../utils/homeScroll";
import type { HomeScrollSnapshot } from "../utils/homeScroll";

/** Mantiene el Home ORIGINAL montado al pasar de /facturas a /facturas/:id.
 * No define tabla, estilos, paginación ni orden propios.
 */
function FacturasForArea() {
  const location = useLocation();
  const isHome = location.pathname.replace(/\/+$/, "") === "/facturas";
  const [visited, setVisited] = useState(isHome);
  const root = useRef<HTMLDivElement>(null);
  const snapshot = useRef<HomeScrollSnapshot | null>(null);
  const pendingRestore = useRef<HomeScrollSnapshot | null>(null);
  const target = useRef<Element | null>(null);
  const wasHome = useRef(isHome);
  const restoring = useRef(false);
  const finalize = useRef(false);
  const frame = useRef(0);
  const secondFrame = useRef(0);
  const highlightedRow = useRef<HTMLElement | null>(null);
  const highlightTimer = useRef<number | null>(null);

  const visible = useCallback(() => !!root.current && root.current.style.display !== "none", []);
  const clearHighlight = useCallback(() => {
    if (highlightTimer.current !== null) window.clearTimeout(highlightTimer.current);
    highlightTimer.current = null;
    highlightedRow.current?.classList.remove("sgaf-return-row-highlight");
    highlightedRow.current = null;
  }, []);
  const highlightSelectedRow = useCallback((saved: HomeScrollSnapshot) => {
    clearHighlight();
    const row = root.current ? findHomeInvoiceRow(root.current, saved) : null;
    if (!row || !row.getClientRects().length) return;
    // Reflow is required if the user opens the same invoice twice.
    row.classList.remove("sgaf-return-row-highlight");
    void row.offsetWidth;
    row.classList.add("sgaf-return-row-highlight");
    highlightedRow.current = row;
    highlightTimer.current = window.setTimeout(clearHighlight, 2800);
  }, [clearHighlight]);
  const stopFrames = useCallback(() => {
    cancelAnimationFrame(frame.current);
    cancelAnimationFrame(secondFrame.current);
    restoring.current = false;
  }, []);

  const capture = useCallback((element?: Element | null) => {
    if (!visible() || restoring.current || !root.current) return;
    if (element && root.current.contains(element)) target.current = element;
    snapshot.current = captureHomeScroll(root.current, target.current);
  }, [visible]);

  const scheduleRestore = useCallback((finish = false) => {
    const saved = pendingRestore.current;
    if (!saved || !visible()) return;
    stopFrames();
    finalize.current = finalize.current || finish;
    restoring.current = true;
    restoreHomeScroll(saved);
    frame.current = requestAnimationFrame(() => {
      if (!visible()) { restoring.current = false; return; }
      restoreHomeScroll(saved);
      secondFrame.current = requestAnimationFrame(() => {
        if (visible()) restoreHomeScroll(saved);
        restoring.current = false;
        if (finalize.current) {
          highlightSelectedRow(saved);
          pendingRestore.current = null;
          finalize.current = false;
        }
      });
    });
  }, [highlightSelectedRow, stopFrames, visible]);

  const contentReady = useCallback(() => scheduleRestore(true), [scheduleRestore]);

  useLayoutEffect(() => {
    if (!isHome && wasHome.current) {
      // La captura ya se hizo ANTES del clic / navegación y de ocultar Home.
      stopFrames();
      clearHighlight();
      const selected = /^\/facturas\/(\d+)\/?$/.exec(location.pathname);
      pendingRestore.current = snapshot.current
        ? { ...snapshot.current, selectedInvoiceId: selected ? Number(selected[1]) : null }
        : null;
      finalize.current = false;
    } else if (isHome && !wasHome.current) {
      scheduleRestore();
    }
    wasHome.current = isHome;
  }, [isHome, location.pathname, scheduleRestore, stopFrames, clearHighlight]);

  useEffect(() => { if (isHome) setVisited(true); }, [isHome]);

  useEffect(() => {
    const previousRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    let captureFrame = 0;
    const onScroll = (event: Event) => {
      if (!visible() || restoring.current || pendingRestore.current) return;
      const node = event.target;
      if (node instanceof Element && root.current &&
          !root.current.contains(node) && !node.contains(root.current)) return;
      cancelAnimationFrame(captureFrame);
      captureFrame = requestAnimationFrame(() => capture());
    };
    const onInteraction = (event: Event) => {
      if (!visible()) return;
      // No reubicar la vista después de que el usuario comienza a desplazarse.
      stopFrames();
      pendingRestore.current = null;
      finalize.current = false;
      if (event.target instanceof Element) capture(event.target);
    };
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    for (const name of ["wheel", "touchstart", "pointerdown", "keydown"]) {
      document.addEventListener(name, onInteraction, { capture: true, passive: true });
    }
    return () => {
      cancelAnimationFrame(captureFrame);
      stopFrames();
      clearHighlight();
      document.removeEventListener("scroll", onScroll, true);
      for (const name of ["wheel", "touchstart", "pointerdown", "keydown"]) {
        document.removeEventListener(name, onInteraction, true);
      }
      window.history.scrollRestoration = previousRestoration;
    };
  }, [capture, clearHighlight, stopFrames, visible]);

  return (
    <>
      <style>{`
        /* A subtle 2.8-second highlight only on the row that opened Detail. */
        .sgaf-return-row-highlight {
          outline: 1px solid rgba(19, 184, 212, .32);
          outline-offset: -1px;
        }
        .sgaf-return-row-highlight,
        .sgaf-return-row-highlight > td,
        .sgaf-return-row-highlight > th {
          animation: sgaf-return-row-fade 2.8s ease-out both;
        }
        @keyframes sgaf-return-row-fade {
          0% { box-shadow: inset 0 0 0 9999px rgba(19, 184, 212, .17); }
          75% { box-shadow: inset 0 0 0 9999px rgba(19, 184, 212, .07); }
          100% { box-shadow: inset 0 0 0 9999px rgba(19, 184, 212, 0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .sgaf-return-row-highlight,
          .sgaf-return-row-highlight > td,
          .sgaf-return-row-highlight > th {
            animation: none;
            box-shadow: inset 0 0 0 9999px rgba(19, 184, 212, .1);
          }
        }
      `}</style>
      {(visited || isHome) && (
        <div ref={root} style={{ display: isHome ? "contents" : "none" }}
          aria-hidden={isHome ? undefined : true}
          onClickCapture={event => capture(event.target instanceof Element ? event.target : null)}>
          <Home active={isHome} onContentReady={contentReady} />
        </div>
      )}
      <Outlet />
    </>
  );
}

export default function FacturasLayout() {
  const areaId = Number(getStoredArea()?.id ?? 0);
  return <FacturasForArea key={areaId} />;
}
