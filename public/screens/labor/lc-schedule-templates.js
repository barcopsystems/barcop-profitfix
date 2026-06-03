'use strict';

/* ── Labor Control — Schedule Templates (reads lc_schedule_templates) ─────────
   A library of reusable weekly shift patterns. You don't build templates on
   this screen — you build a week in Build Schedule and click "Save Week as
   Template." This screen lists the saved ones so you can Load one into Build
   Schedule (use as-is, or tweak and re-save) or Delete it. */

S.LaborScheduleTemplates = {
  _pendingDelId: null,

  templates() {
    if (!App.laborData) App.laborData = {};
    if (!Array.isArray(App.laborData.lc_schedule_templates)) App.laborData.lc_schedule_templates = [];
    return App.laborData.lc_schedule_templates;
  },
  staff() { return ((App.laborData && App.laborData.lc_staff) || []); },
  bs() { return S.LaborBuildSchedule; },

  // Per-template rollup so each card is distinguishable: shift count, total
  // hours, and a rough weekly cost (hourly at current wage + each distinct
  // salaried person's weekly salary).
  templateStats(t) {
    const bs = this.bs();
    let hours = 0, cost = 0;
    const salIds = new Set();
    const today = new Date().toISOString().slice(0, 10);
    (t.shifts || []).forEach(s => {
      const h = bs.hoursOf(s.start, s.end);
      hours += h;
      const staff = bs.staffById(s.staff_id);
      if (staff && App.isSalaried(staff)) salIds.add(staff.id);
      else { const wage = App.wageForStaffOn ? App.wageForStaffOn(s.staff_id, today) : ((staff && staff.wage) || 0); cost += h * (wage || 0); }
    });
    salIds.forEach(id => { cost += App.staffWeeklySalary ? App.staffWeeklySalary(id) : 0; });
    return { count: (t.shifts || []).length, hours, cost };
  },

  render(container, actions) {
    this.container = container;
    this.actions = actions;
    this.renderList();
  },

  renderList() {
    this.actions.innerHTML = '';

    if (this.staff().length === 0) {
      App.setupCard(this.container, {
        title: 'Saved Templates',
        lead: 'Templates are reusable weekly shift patterns built from your roster. Add your staff first, then build a week and save it as a template.',
        steps: [
          { title: 'Add your staff', desc: 'Templates are built from your roster, so build it first.', btn: 'Go to Staff Roster', screen: 'lc-staff-roster', done: false }
        ]
      });
      return;
    }

    const list = this.templates();
    if (list.length === 0) {
      App.setupCard(this.container, {
        title: 'Saved Templates',
        lead: 'Templates are reusable weekly shift patterns. You build them in Build Schedule and save them here to load any time.',
        steps: [
          { title: 'Build a schedule', desc: 'Build a week in Build Schedule, name it in the Template Name box, and click Save Schedule. Named schedules show up here as templates.', btn: 'Build a Schedule', screen: 'lc-build-schedule', done: false }
        ]
      });
      return;
    }
    let html;
    {
      html = list.map(t => {
        const st = this.templateStats(t);
        return '<div class="card lt-card" data-id="' + t.id + '" style="cursor:pointer;margin-bottom:12px;">'
          + '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">'
          + '<div><div style="font-size:15px;font-weight:700;color:var(--t1);">' + esc(t.name) + '</div>'
          + '<div style="font-size:11px;color:var(--t3);margin-top:3px;">' + st.count + ' shift' + (st.count === 1 ? '' : 's')
          + ' &middot; ' + st.hours.toFixed(1) + ' hrs &middot; ~' + App.fmtCurrency(st.cost) + '/wk</div></div>'
          + '<div class="row-actions" style="flex-shrink:0;">'
          + '<button class="btn btn-ghost btn-sm lt-use" data-id="' + t.id + '">Load Template</button>'
          + '<button class="btn btn-danger btn-sm lt-del" data-id="' + t.id + '">Delete</button>'
          + '</div></div></div>';
      }).join('');
    }

    const modal = '<div id="lt-del-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9000;align-items:center;justify-content:center;">'
      + '<div style="background:var(--surface);border:1px solid var(--b1);border-radius:6px;padding:28px;max-width:340px;width:90%;text-align:center;">'
      + '<div style="font-size:13px;font-weight:700;color:var(--t1);margin-bottom:18px;">Delete this template?</div>'
      + '<div style="display:flex;gap:10px;justify-content:center;">'
      + '<button class="btn btn-ghost" id="lt-del-cancel">Cancel</button>'
      + '<button class="btn btn-danger" id="lt-del-confirm">Delete</button>'
      + '</div></div></div>';

    this.container.innerHTML = '<div class="screen">' + html + '</div>' + modal;
    this.container.onclick = ev => {
      if (ev.target.closest('#lt-build')) { App.navigate('lc-build-schedule'); return; }
      const use = ev.target.closest('.lt-use');
      const del = ev.target.closest('.lt-del');
      const card = ev.target.closest('.lt-card');
      if (del)       { ev.stopPropagation(); this.confirmDel(del.dataset.id); }
      else if (use)  { ev.stopPropagation(); this.load(use.dataset.id); }
      else if (card) this.load(card.dataset.id);
    };
  },

  // Load a template into the Build Schedule grid for the current week. The
  // template name rides along so Save Week as Template can offer to update it.
  load(id) {
    const t = this.templates().find(x => x.id === id);
    if (!t || !this.bs()) return;
    const draft = {
      week_start: this.bs().mondayOf(new Date().toISOString().slice(0, 10)),
      shifts: (t.shifts || []).map(s => ({ staff_id: s.staff_id, day: s.day, start: s.start, end: s.end })),
      notes: '',
      from_template_name: t.name
    };
    try { localStorage.setItem(this.bs().DRAFT_KEY, JSON.stringify(draft)); } catch (e) {}
    this.bs().editId = null;
    App.navigate('lc-build-schedule');
  },

  confirmDel(id) {
    this._pendingDelId = id;
    const modal = document.getElementById('lt-del-modal');
    if (modal) modal.style.display = 'flex';
    document.getElementById('lt-del-cancel').onclick = () => { modal.style.display = 'none'; this._pendingDelId = null; };
    document.getElementById('lt-del-confirm').onclick = async () => {
      modal.style.display = 'none';
      const delId = this._pendingDelId;
      this._pendingDelId = null;
      App.laborData.lc_schedule_templates = this.templates().filter(x => x.id !== delId);
      await App.saveLabor();
      this.renderList();
    };
  }
};
