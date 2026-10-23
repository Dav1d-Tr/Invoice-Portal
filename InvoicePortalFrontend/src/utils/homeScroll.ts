/** Memoria de DOM, solamente en la sesión de React. No almacena facturas ni credenciales. */
export interface HomeScrollSnapshot {
  windowX: number;
  windowY: number;
  elements: Array<{ element: HTMLElement; x: number; y: number }>;
  anchor: HTMLElement | null;
  anchorTop: number | null;
  focus: HTMLElement | null;
  selectedInvoiceId?: number | null;
}

function isScrollable(node: HTMLElement): boolean {
  const style = getComputedStyle(node);
  return /(auto|scroll|overlay)/.test(`${style.overflowX} ${style.overflowY}`);
}

export function captureHomeScroll(root: HTMLElement, target: Element | null = null): HomeScrollSnapshot {
  const elements = new Set<HTMLElement>();
  for (let parent = root.parentElement; parent; parent = parent.parentElement) {
    if (parent !== document.scrollingElement && isScrollable(parent)) elements.add(parent);
  }
  for (const element of [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))]) {
    if (isScrollable(element) && (element.scrollHeight > element.clientHeight || element.scrollWidth > element.clientWidth)) {
      elements.add(element);
    }
  }
  const candidate = target?.closest<HTMLElement>("tr, [data-invoice-row], [data-invoice-id]") ?? null;
  const anchor = candidate && root.contains(candidate) ? candidate : null;
  const focusCandidate = target?.closest<HTMLElement>("button, a[href], [tabindex]") ?? null;
  return {
    windowX: window.scrollX,
    windowY: window.scrollY,
    elements: [...elements].map(element => ({ element, x: element.scrollLeft, y: element.scrollTop })),
    anchor,
    anchorTop: anchor?.getBoundingClientRect().top ?? null,
    focus: focusCandidate && root.contains(focusCandidate) ? focusCandidate : null,
  };
}

function setPosition(element: HTMLElement, x: number, y: number): void {
  const previous = element.style.scrollBehavior;
  element.style.scrollBehavior = "auto";
  element.scrollLeft = x;
  element.scrollTop = y;
  element.style.scrollBehavior = previous;
}

function setWindowPosition(x: number, y: number): void {
  const documentRoot = document.documentElement;
  const previous = documentRoot.style.scrollBehavior;
  documentRoot.style.scrollBehavior = "auto";
  window.scrollTo({ left: x, top: y, behavior: "auto" });
  documentRoot.style.scrollBehavior = previous;
}

export function restoreHomeScroll(snapshot: HomeScrollSnapshot): void {
  for (const { element, x, y } of snapshot.elements) {
    if (element.isConnected) setPosition(element, x, y);
  }
  setWindowPosition(snapshot.windowX, snapshot.windowY);

  const row = snapshot.anchor;
  // Si el registro ya no está en el DOM, no forzar otra página ni inventar la fila.
  if (row?.isConnected && row.getClientRects().length && snapshot.anchorTop !== null) {
    const delta = row.getBoundingClientRect().top - snapshot.anchorTop;
    let scroller: HTMLElement | null = row.parentElement;
    while (scroller && scroller !== document.scrollingElement) {
      const style = getComputedStyle(scroller);
      if (scroller.scrollHeight > scroller.clientHeight && /(auto|scroll|overlay)/.test(style.overflowY)) break;
      scroller = scroller.parentElement;
    }
    if (scroller && scroller !== document.scrollingElement) {
      setPosition(scroller, scroller.scrollLeft, scroller.scrollTop + delta);
    } else {
      setWindowPosition(window.scrollX, window.scrollY + delta);
    }
  }
  if (snapshot.focus?.isConnected && snapshot.focus.getClientRects().length) {
    snapshot.focus.focus({ preventScroll: true });
  }
}


/** Locates the selected row without modifying InvoiceBoard. */
export function findHomeInvoiceRow(
  root: HTMLElement,
  snapshot: HomeScrollSnapshot,
): HTMLElement | null {
  const id = snapshot.selectedInvoiceId;
  const invoicePath = id && id > 0 ? `/facturas/${id}` : null;
  if (invoicePath) {
    // Preferred: explicit dataset or a React Router Link within the row.
    for (const candidate of Array.from(root.querySelectorAll<HTMLElement>("[data-invoice-id]"))) {
      if (candidate.dataset.invoiceId === String(id)) {
        return candidate.closest<HTMLElement>("tr, [role='row'], [data-invoice-row]") ?? candidate;
      }
    }
    for (const link of Array.from(root.querySelectorAll<HTMLAnchorElement>("a[href]"))) {
      const href = link.getAttribute("href");
      if (!href) continue;
      let pathname = "";
      try { pathname = new URL(href, window.location.href).pathname.replace(/\/+$/, ""); }
      catch { continue; }
      if (pathname === invoicePath) {
        const row = link.closest<HTMLElement>("tr, [role='row'], [data-invoice-row]");
        if (row && root.contains(row)) return row;
      }
    }
  }

  const anchor = snapshot.anchor;
  if (!anchor?.isConnected || !root.contains(anchor)) return null;
  if (invoicePath) {
    // Guard against an existing DOM node being reused for another invoice.
    const anchorDataId = anchor.getAttribute("data-invoice-id");
    if (anchorDataId && anchorDataId !== String(id)) return null;
    const invoiceLinks: string[] = [];
    for (const link of Array.from(anchor.querySelectorAll<HTMLAnchorElement>("a[href]"))) {
      const href = link.getAttribute("href");
      if (!href) continue;
      try {
        const pathname = new URL(href, window.location.href).pathname.replace(/\/+$/, "");
        if (/^\/facturas\/\d+$/.test(pathname)) invoiceLinks.push(pathname);
      } catch { /* Ignore invalid hrefs. */ }
    }
    if (invoiceLinks.length > 0 && !invoiceLinks.includes(invoicePath)) return null;
  }
  return anchor;
}
