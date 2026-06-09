'use strict';

/* ── Drag Reorder — reusable row drag-and-drop helper ────────────────────────
   Wire pointer-event drag-to-reorder onto any list of rows sharing a parent.
   Works for mouse and touch (Pointer Events API). The drag handle's
   touch-action:none stops the browser from hijacking a touch drag as page
   scroll. While dragging near the top or bottom of the viewport the page
   auto-scrolls so long lists stay reachable.

   API:
     DragReorder.wire({
       container,       Element that holds the draggable rows (a tbody, ul, etc.)
       rowSelector,     CSS selector for each row (e.g. 'tr[data-id]')
       handleSelector,  CSS selector for the drag handle inside each row
       onCommit,        function(newOrderIds) called after drop. newOrderIds is
                        the dataset.id of each row in its new DOM order.
     })
     DragReorder.handleCellHTML()   HTML string for a <td> drag handle column
     DragReorder.handleDivHTML()    HTML string for a flex-row drag handle div

   Rows MUST carry a stable id on data-id ("data-id=..."). The helper reads
   row.dataset.id and passes the list back to onCommit in DOM order. */

const DragReorder = {
  // Grip dots (2 x 3). Replaces the old hamburger glyph everywhere. fill uses
  // currentColor so it inherits the handle cell's color (var(--t3)).
  HANDLE_GLYPH: '<svg width="11" height="16" viewBox="0 0 11 16" fill="currentColor" aria-hidden="true" style="display:inline-block;vertical-align:middle;"><circle cx="3.5" cy="3.5" r="1.4"/><circle cx="7.5" cy="3.5" r="1.4"/><circle cx="3.5" cy="8" r="1.4"/><circle cx="7.5" cy="8" r="1.4"/><circle cx="3.5" cy="12.5" r="1.4"/><circle cx="7.5" cy="12.5" r="1.4"/></svg>',

  handleCellHTML() {
    return '<td class="dr-handle" style="width:32px;text-align:center;cursor:grab;color:var(--t3);font-size:16px;touch-action:none;user-select:none;" title="Drag to reorder">' + this.HANDLE_GLYPH + '</td>';
  },

  handleDivHTML() {
    return '<div class="dr-handle" style="flex-shrink:0;cursor:grab;color:var(--t3);font-size:16px;padding:0 6px;touch-action:none;user-select:none;align-self:center;" title="Drag to reorder">' + this.HANDLE_GLYPH + '</div>';
  },

  wire(opts) {
    // dragClass (optional): a CSS class added to the row while it is being
    // dragged (for a custom highlight). When omitted, the default faint-dim is
    // used. Lets one caller (Inventory) show a gold highlight while another
    // (Shift templates) keeps the plain look.
    const { container, rowSelector, handleSelector, onCommit, dragClass } = opts || {};
    if (!container || !rowSelector || !handleSelector || typeof onCommit !== 'function') return;
    const handles = container.querySelectorAll(handleSelector);
    if (!handles.length) return;

    let dragRow = null;
    let activeHandle = null;
    let parent = null;
    let autoScrollTimer = null;
    let lastY = 0;
    const findRow = el => el && el.closest(rowSelector);

    const stopScroll = () => {
      if (autoScrollTimer) { cancelAnimationFrame(autoScrollTimer); autoScrollTimer = null; }
    };
    const tickScroll = () => {
      if (!dragRow) { stopScroll(); return; }
      const margin = 70;
      const vh = window.innerHeight;
      let delta = 0;
      if (lastY < margin)           delta = -Math.ceil((margin - lastY) / 6);
      else if (lastY > vh - margin) delta =  Math.ceil((lastY - (vh - margin)) / 6);
      if (delta) window.scrollBy(0, delta);
      autoScrollTimer = requestAnimationFrame(tickScroll);
    };

    const commitOrder = () => {
      const ids = Array.from(container.querySelectorAll(rowSelector)).map(r => r.dataset.id);
      try { onCommit(ids); } catch (e) { console.error(e); }
    };

    handles.forEach(handle => {
      handle.addEventListener('pointerdown', ev => {
        if (ev.button != null && ev.button !== 0) return;
        ev.preventDefault();
        const row = findRow(handle);
        if (!row) return;
        dragRow = row;
        parent = row.parentNode;
        activeHandle = handle;
        lastY = ev.clientY;
        try { handle.setPointerCapture(ev.pointerId); } catch (_) {}
        if (dragClass) { row.classList.add(dragClass); }
        else { row.style.opacity = '0.45'; row.style.background = 'var(--surface)'; }
        handle.style.cursor = 'grabbing';
        document.body.style.cursor = 'grabbing';
        autoScrollTimer = requestAnimationFrame(tickScroll);
      });

      handle.addEventListener('pointermove', ev => {
        if (!dragRow) return;
        lastY = ev.clientY;
        // Hide pointer events on the dragged row so elementFromPoint returns
        // the row underneath, not itself.
        dragRow.style.pointerEvents = 'none';
        const el = document.elementFromPoint(ev.clientX, ev.clientY);
        dragRow.style.pointerEvents = '';
        if (!el) return;
        const targetRow = findRow(el);
        if (!targetRow || targetRow === dragRow || targetRow.parentNode !== parent) return;
        const rect = targetRow.getBoundingClientRect();
        const after = (ev.clientY - rect.top) > rect.height / 2;
        if (after) parent.insertBefore(dragRow, targetRow.nextSibling);
        else       parent.insertBefore(dragRow, targetRow);
      });

      const finish = (commit) => {
        if (!dragRow) return;
        if (dragClass) { dragRow.classList.remove(dragClass); }
        else { dragRow.style.opacity = ''; dragRow.style.background = ''; }
        if (activeHandle) activeHandle.style.cursor = 'grab';
        document.body.style.cursor = '';
        stopScroll();
        const shouldCommit = commit;
        dragRow = null;
        activeHandle = null;
        parent = null;
        if (shouldCommit) commitOrder();
      };

      handle.addEventListener('pointerup',     ev => { try { handle.releasePointerCapture(ev.pointerId); } catch (_) {} finish(true); });
      handle.addEventListener('pointercancel', ev => { try { handle.releasePointerCapture(ev.pointerId); } catch (_) {} finish(false); });
    });
  }
};
