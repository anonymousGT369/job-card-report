import './style.css';
import {
  SB,
  KEY,
  auth as supabaseAuth,
  fresh as supabaseFresh,
  api as supabaseApi,
  getSession,
  setSession,
  clearSession
} from './api.js';

(() => {
  const $ = (selector) => document.querySelector(selector);
  const esc = (value) => String(value == null ? '' : value).replace(/[&<>\"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
  const num = (value) => (String(value).replace(/\s/g, '').match(/[+-]?\d*\.?\d+/g) || []).reduce((acc, item) => acc + +item, 0);
  const inr = (value) => (+value || 0).toLocaleString('en-IN');
  const iso = (date) => new Date(date - date.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
  const dmy = (value) => value.slice(8) + '/' + value.slice(5, 7) + '/' + value.slice(2, 4);
  const tm = (value) => {
    const parts = value.split(':');
    return parts[0] * 60 + +parts[1];
  };
  const mins = (job) => (job.tin && job.tout) ? tm(job.tout) - tm(job.tin) : null;
  const dur = (minutes) => minutes == null || minutes < 0 ? '-' : Math.floor(minutes / 60) + 'h ' + String(minutes % 60).padStart(2, '0') + 'm';

  const OIL = [440, 494, 530, 596, 737];
  const FIELDS = [
    ['name', 'Customer name', 't'],
    ['phone', 'Contact no', 'tel'],
    ['frame', 'Vehicle frame no', 't'],
    ['reg', 'Register no', 't'],
    ['kms', 'KMS', 'n'],
    ['jc', 'Jobcard no', 't'],
    ['type', 'Type of service', 's', ['FREE', 'QUICK', 'PAID']],
    ['sno', 'Service number', 'n'],
    ['tin', 'Vehicle in', 'time'],
    ['tout', 'Vehicle out', 'time'],
    ['same', 'Same-day delivery', 's', ['YES', 'NO']],
    ['fb', 'Feedback', 's', ['EXCELLENT', 'VERY GOOD']],
    ['rem', 'Delivery remark', 't']
  ];
  const AMT = [
    ['labour', 'Labour'],
    ['inj', 'Injector clean'],
    ['chain', 'Chain clean & lube'],
    ['fi', 'F.I collection'],
    ['pol', 'Polish'],
    ['parts', 'Parts'],
    ['lube', 'Yamaha lube'],
    ['amc', 'AMC']
  ];
  const T = [
    ['Service report', 'svc'],
    ['Delivered', 'del'],
    ['Free service', 'free'],
    ['Paid service', 'paid'],
    ['AMC service', 'amcSvc'],
    ['AMC', 'amc'],
    ['Quick repair', 'quick'],
    ['Accidental in', 'accIn'],
    ['Accidental out', 'accOut'],
    ['Parts sale through WS', 'wsParts', 1],
    ['Accidental parts', 'accParts', 1],
    ['Parts sale through counter', 'counter', 1],
    ['Labour charge', 'labour', 1],
    ['Engine oil sold through WS', 'oil'],
    ['Accidental labour', 'accLab', 1],
    ['FI collection', 'fi', 1],
    ['Injector collection', 'inj', 1],
    ['Polish', 'pol', 1],
    ['Chain lube', 'chain', 1]
  ];
  const M = [
    ['Service report', 'svc'],
    ['Free service', 'free'],
    ['Paid service', 'paid'],
    ['Quick repair', 'quick'],
    ['A.M.C', 'amc'],
    ['Accidental service', 'accIn'],
    ['Workshop parts', 'wsParts', 1],
    ['W/S counter sell', 'counter', 1],
    ['Labour charge', 'labour', 1],
    ['FI collection', 'fi', 1],
    ['Injector collection', 'inj', 1],
    ['Polish', 'pol', 1],
    ['Chain lube', 'chain', 1],
    ['Y-lube sale WS', 'oil']
  ];
  const MAN = ['amcSvc', 'amc', 'accIn', 'accOut', 'accParts', 'counter', 'accLab'];

  let db = false;
  let ses = getSession();
  let date = iso(new Date());
  let days = {};
  let open = {};
  let edit = -1;
  let mon = '';
  let q = Promise.resolve();
  let ft;

  const auth = async (grantType, body) => {
    const nextSession = await supabaseAuth(grantType, body);
    ses = nextSession;
    return nextSession;
  };

  const fresh = async (forceFlag) => {
    const nextSession = await supabaseFresh(forceFlag);
    ses = nextSession;
    return nextSession;
  };

  const api = async (method, path, body, extraHeaders) => supabaseApi(method, path, body, extraHeaders);

  const tot = (job) => AMT.reduce((sum, [key]) => sum + (+job[key] || 0), 0);
  const day = () => days[date] || { jobs: [], man: {} };

  const rep = (jobs, manual) => {
    const sum = (key) => jobs.reduce((total, item) => total + (+item[key] || 0), 0);
    const countType = (type) => jobs.filter((job) => job.type === type).length;
    const totalManual = (key) => +manual[key] || 0;

    return {
      svc: jobs.length,
      del: jobs.filter((job) => job.tout).length,
      free: countType('FREE'),
      paid: countType('PAID'),
      quick: countType('QUICK'),
      amcSvc: totalManual('amcSvc'),
      amc: totalManual('amc'),
      accIn: totalManual('accIn'),
      accOut: totalManual('accOut'),
      accParts: totalManual('accParts'),
      counter: totalManual('counter'),
      accLab: totalManual('accLab'),
      wsParts: sum('parts') + sum('lube'),
      labour: sum('labour'),
      oil: jobs.filter((job) => OIL.includes(+job.lube)).length,
      fi: sum('fi'),
      inj: sum('inj'),
      pol: sum('pol'),
      chain: sum('chain')
    };
  };

  const mtd = () => {
    const aggregate = {};
    Object.keys(days)
      .filter((dayKey) => dayKey <= date)
      .forEach((dayKey) => {
        const current = rep(days[dayKey].jobs || [], days[dayKey].man || {});
        for (const key in current) {
          aggregate[key] = (aggregate[key] || 0) + current[key];
        }
      });
    return aggregate;
  };

  const flash = (message, bad) => {
    const status = $('#st');
    status.textContent = message;
    status.className = 'chip' + (bad ? ' bad' : '');
    clearTimeout(ft);
    ft = setTimeout(() => {
      status.textContent = db ? 'Connected' : 'Not connected';
      status.className = 'chip' + (db ? '' : ' bad');
    }, 2500);
  };

  const sv = (action) => {
    if (!db) {
      flash('Not saved: database not connected', 1);
      return;
    }

    q = q
      .then(action)
      .then(() => flash('Saved'))
      .catch((error) => flash(error && (error.code === 401 || error.code === 403) ? 'Not allowed: sign in again' : 'Save failed (' + ((error && error.code) || 'error') + ')', 1));
  };

  const put = (payload) => {
    const current = day();
    const nextState = {
      month: date.slice(0, 7),
      date,
      jobs: current.jobs || [],
      man: current.man || {},
      ...payload
    };

    days = { ...days, [date]: nextState };
    draw();

    sv(() => api('POST', '/rest/v1/service_days?on_conflict=day', {
      day: date,
      jobs: nextState.jobs,
      man: nextState.man
    }, { Prefer: 'resolution=merge-duplicates,return=minimal' }));
  };

  const draw = () => {
    const jobs = day().jobs || [];
    const summary = rep(jobs, day().man || {});
    const monthTotal = mtd();
    const formatMoney = (value, money) => money ? '₹' + inr(value) : inr(value);
    const from = dmy(date.slice(0, 8) + '01');

    $('#lst').innerHTML = jobs.length
      ? `<table class="w-full border-separate border-spacing-0 text-left text-[14px]"><thead><tr><th class="border-b border-[var(--line)] px-2 py-2 text-[12px] font-medium text-[var(--mut)]">SL</th><th class="border-b border-[var(--line)] px-2 py-2 text-[12px] font-medium text-[var(--mut)]">Customer</th><th class="border-b border-[var(--line)] px-2 py-2 text-[12px] font-medium text-[var(--mut)]">Reg no</th><th class="border-b border-[var(--line)] px-2 py-2 text-[12px] font-medium text-[var(--mut)]">Jobcard</th><th class="border-b border-[var(--line)] px-2 py-2 text-[12px] font-medium text-[var(--mut)]">Type</th><th class="border-b border-[var(--line)] px-2 py-2 text-[12px] font-medium text-[var(--mut)]">In - Out</th><th class="border-b border-[var(--line)] px-2 py-2 text-[12px] font-medium text-[var(--mut)]">Duration</th><th class="border-b border-[var(--line)] px-2 py-2 text-right text-[12px] font-medium text-[var(--mut)]">Total ₹</th><th class="border-b border-[var(--line)] px-2 py-2"></th></tr></thead><tbody>${jobs.map((job, index) => `
        <tr class="transition-colors duration-200">
          <td class="border-b border-[var(--line)] px-2 py-2">${index + 1}</td>
          <td class="border-b border-[var(--line)] px-2 py-2">${esc(job.name)}</td>
          <td class="border-b border-[var(--line)] px-2 py-2">${esc(job.reg)}</td>
          <td class="border-b border-[var(--line)] px-2 py-2" title="${esc(job.jc)}">${esc(String(job.jc || '').split('/').pop())}</td>
          <td class="border-b border-[var(--line)] px-2 py-2">${esc(job.type)}</td>
          <td class="border-b border-[var(--line)] px-2 py-2">${esc(job.tin)} - ${esc(job.tout)}</td>
          <td class="border-b border-[var(--line)] px-2 py-2">${dur(mins(job))}</td>
          <td class="border-b border-[var(--line)] px-2 py-2 text-right">${inr(tot(job))}</td>
          <td class="border-b border-[var(--line)] px-2 py-2 text-right"><button class="lk text-[var(--acc)] transition-colors duration-200 hover:bg-[color:var(--acc)]/10" data-e="${index}">Edit</button><button class="lk d text-[var(--warn)] transition-colors duration-200 hover:bg-[color:var(--warn)]/10" data-x="${index}">Delete</button></td>
        </tr>
      `).join('')}</tbody><tfoot><tr><th colspan="7" class="border-b border-[var(--line)] px-2 py-2 text-left font-medium text-[var(--mut)]">Total</th><th class="border-b border-[var(--line)] px-2 py-2 text-right">${inr(jobs.reduce((sum, job) => sum + tot(job), 0))}</th><th class="border-b border-[var(--line)] px-2 py-2"></th></tr></tfoot></table>`
      : '<p class="text-[13px] text-[var(--mut)]">No jobcards for this date yet. Add the first one above.</p>';

    $('#rep').innerHTML = `
      <div class="mb-3 flex items-center gap-2">
        <button class="pri" id="cp">Copy WhatsApp report</button>
      </div>
      <div class="grid gap-3 md:grid-cols-2">
        <div class="card rounded-[10px] border border-[var(--line)] bg-[var(--card)] p-[14px] shadow-[var(--shadow-sm)]">
          <h2 class="mb-2.5 text-[15px] font-semibold">Today's report - ${dmy(date)}</h2>
          ${T.map(([label, key, money]) => `
            <div class="r flex items-center justify-between gap-2.5 border-b border-[var(--line)] py-[7px] transition-colors duration-200 hover:bg-[color:var(--acc)]/[0.05]">
              <span>${label}</span>
              ${MAN.includes(key) ? `<input class="ml-2 w-[110px] border border-[var(--line)] bg-[var(--bg)] p-2 text-right text-[var(--ink)] outline-none transition duration-200 hover:border-[color:var(--acc)] focus:border-[var(--acc)] focus:ring-2 focus:ring-[color:var(--acc)]/20" data-man="${key}" value="${summary[key]}" inputmode="decimal" aria-label="${label}">` : `<b>${formatMoney(summary[key], money)}</b>`}
            </div>
          `).join('')}
        </div>
        <div class="card overflow-x-auto rounded-[10px] border border-[var(--line)] bg-[var(--card)] p-[14px] shadow-[var(--shadow-sm)]">
          <h2 class="mb-2.5 text-[15px] font-semibold">Month to date - ${from} to ${dmy(date)}</h2>
          <table class="w-full border-separate border-spacing-0 text-left text-[14px]">
            <thead>
              <tr>
                <th class="border-b border-[var(--line)] px-2 py-2 text-[12px] font-medium text-[var(--mut)]">Item</th>
                <th class="border-b border-[var(--line)] px-2 py-2 text-right text-[12px] font-medium text-[var(--mut)]">Opening</th>
                <th class="border-b border-[var(--line)] px-2 py-2 text-right text-[12px] font-medium text-[var(--mut)]">In app</th>
                <th class="border-b border-[var(--line)] px-2 py-2 text-right text-[12px] font-medium text-[var(--mut)]">Total</th>
              </tr>
            </thead>
            <tbody>${M.map(([label, key, money]) => `
              <tr>
                <td class="border-b border-[var(--line)] px-2 py-2">${label}</td>
                <td class="border-b border-[var(--line)] px-2 py-2 text-right"><input class="w-[110px] border border-[var(--line)] bg-[var(--bg)] p-2 text-right text-[var(--ink)] outline-none transition duration-200 hover:border-[color:var(--acc)] focus:border-[var(--acc)] focus:ring-2 focus:ring-[color:var(--acc)]/20" data-open="${key}" value="${open[key] || 0}" inputmode="decimal" aria-label="Opening ${label}"></td>
                <td class="border-b border-[var(--line)] px-2 py-2 text-right">${formatMoney(monthTotal[key] || 0, money)}</td>
                <td class="border-b border-[var(--line)] px-2 py-2 text-right"><b>${formatMoney((+open[key] || 0) + (monthTotal[key] || 0), money)}</b></td>
              </tr>
            `).join('')}</tbody>
          </table>
          <p class="mt-3 text-[13px] text-[var(--mut)]">Opening = totals before the first day entered in this app. Engine oil counts Yamaha lube amounts of 440, 494, 530, 596 or 737.</p>
        </div>
      </div>
    `;
  };

  const txt = () => {
    const currentReport = rep(day().jobs || [], day().man || {});
    const monthAggregate = mtd();
    let text = `*GANGARAMPUR SERVICE*\nDate - ${dmy(date)}\n`;

    text += T.map(([label, key, money]) => `${label} - ${money ? 'Rs ' : ''}${inr(currentReport[key])}`).join('\n');
    text += `\n\n*Service Report*\nDate - ${dmy(date.slice(0, 8) + '01')} To ${dmy(date)}\n`;
    text += M.map(([label, key, money]) => `${label} - ${money ? 'Rs ' : ''}${inr((+open[key] || 0) + (monthAggregate[key] || 0))}`).join('\n');

    return text;
  };

  const copy = async (value) => {
    try {
      await navigator.clipboard.writeText(value);
      flash('Report copied');
    } catch (error) {
      const textarea = document.createElement('textarea');
      textarea.value = value;
      document.body.append(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        flash('Report copied');
      } catch (copyError) {
        flash('Copy failed', 1);
      }
      textarea.remove();
    }
  };

  const fld = (key, label, type, options = []) => `
    <label class="block text-[12px] font-medium text-[var(--mut)]">
      ${label}
      ${type === 's'
        ? `<select class="mt-1.5 w-full rounded-[6px] border border-[var(--line)] bg-[var(--bg)] px-2.5 py-2.5 text-[var(--ink)] transition duration-200 hover:border-[color:var(--acc)] focus:border-[var(--acc)] focus:outline-none focus:ring-2 focus:ring-[color:var(--acc)]/20" data-k="${key}">${options.map((option) => `<option>${option}</option>`).join('')}</select>`
        : `<input class="mt-1.5 w-full rounded-[6px] border border-[var(--line)] bg-[var(--bg)] px-2.5 py-2.5 text-[var(--ink)] transition duration-200 hover:border-[color:var(--acc)] focus:border-[var(--acc)] focus:outline-none focus:ring-2 focus:ring-[color:var(--acc)]/20" data-k="${key}" ${type === 'n' ? 'inputmode="decimal" data-n="1"' : type === 'time' ? 'type="time"' : type === 'tel' ? 'type="tel"' : ''} ${key === 'name' || key === 'jc' ? 'required' : ''} autocomplete="off">`}
    </label>
  `;

  const setForm = (job) => {
    document.querySelectorAll('#f [data-k]').forEach((element) => {
      const value = job ? job[element.dataset.k] : null;
      if (element.tagName === 'SELECT') {
        element.value = value || element.options[0].value;
      } else {
        element.value = value == null ? (element.dataset.k === 'rem' ? 'DONE' : '') : (value === 0 ? '' : value);
      }
    });
    upTot();
  };

  const rf = () => {
    const result = {};
    document.querySelectorAll('#f [data-k]').forEach((element) => {
      result[element.dataset.k] = element.dataset.n ? num(element.value) : element.value.trim();
    });
    return result;
  };

  const upTot = () => {
    $('#tt').textContent = inr(AMT.reduce((sum, [key]) => sum + num($('#f [data-k="' + key + '"]').value), 0));
  };

  const reset = () => {
    edit = -1;
    setForm(null);
    $('#ft').textContent = 'New jobcard';
    $('#sv').textContent = 'Add jobcard';
    $('#cx').hidden = true;
  };

  const tab = (target) => {
    ['jobs', 'rep'].forEach((name) => {
      const panel = $('#tab-' + name);
      const active = name === target;
      panel.hidden = !active;
      if (active) {
        panel.classList.remove('anim-in');
        void panel.offsetWidth;
        panel.classList.add('anim-in');
      }
      document.querySelector('nav [data-tab="' + name + '"]').classList.toggle('on', active);
    });
  };

  const watch = async (force = false) => {
    const month = date.slice(0, 7);
    const nextMonth = iso(new Date(+month.slice(0, 4), +month.slice(5), 1));

    if (!force) {
      mon = month;
      days = {};
      open = {};
      draw();
    }

    try {
      const [serviceDays, serviceOpening] = await Promise.all([
        api('GET', '/rest/v1/service_days?select=day,jobs,man&order=day&day=gte.' + month + '-01&day=lt.' + nextMonth),
        api('GET', '/rest/v1/service_opening?select=vals&month=eq.' + month)
      ]);

      if (month !== date.slice(0, 7)) {
        return;
      }

      mon = month;
      days = {};
      serviceDays.forEach((record) => {
        days[record.day] = { month, date: record.day, jobs: record.jobs || [], man: record.man || {} };
      });
      open = serviceOpening[0] ? serviceOpening[0].vals || {} : {};
      draw();
      flash('Loaded');
    } catch (error) {
      flash('Load failed (' + (error.code || error.message) + ')', 1);
    }
  };

  $('#f').addEventListener('input', upTot);
  $('#f').addEventListener('submit', (event) => {
    event.preventDefault();
    const job = rf();
    const jobs = [...(day().jobs || [])];

    if (edit >= 0) {
      jobs[edit] = job;
    } else {
      jobs.push(job);
    }

    reset();
    put({ jobs });
    $('#f [data-k="name"]').focus();
  });

  $('#dt').addEventListener('change', (event) => {
    if (!event.target.value) {
      return;
    }

    date = event.target.value;
    reset();

    if (db && date.slice(0, 7) !== mon) {
      watch();
    } else {
      draw();
    }
  });

  $('#rep').addEventListener('change', (event) => {
    const target = event.target;
    const value = num(target.value);

    if (target.dataset.man) {
      put({ man: { ...(day().man || {}), [target.dataset.man]: value } });
    } else if (target.dataset.open) {
      open = { ...open, [target.dataset.open]: value };
      draw();
      const opening = open;
      const month = mon;
      sv(() => api('POST', '/rest/v1/service_opening?on_conflict=month', { month, vals: opening }, { Prefer: 'resolution=merge-duplicates,return=minimal' }));
    }
  });

  document.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) {
      return;
    }

    if (button.dataset.tab) {
      tab(button.dataset.tab);
      return;
    }

    if (button.id === 'cp') {
      copy(txt());
      return;
    }

    if (button.id === 'cx') {
      reset();
      return;
    }

    if (button.dataset.e != null) {
      edit = +button.dataset.e;
      setForm(day().jobs[edit]);
      $('#ft').textContent = 'Edit jobcard ' + (edit + 1);
      $('#sv').textContent = 'Update jobcard';
      $('#cx').hidden = false;
      $('#f').scrollIntoView();
      return;
    }

    if (button.dataset.x != null) {
      if (button.dataset.arm) {
        const index = +button.dataset.x;
        if (edit >= 0) {
          reset();
        }
        put({ jobs: day().jobs.filter((_, itemIndex) => itemIndex !== index) });
      } else {
        button.dataset.arm = '1';
        button.textContent = 'Confirm?';
        setTimeout(() => {
          button.dataset.arm = '';
          button.textContent = 'Delete';
        }, 3000);
      }
    }
  });

  $('#fg').innerHTML = FIELDS.map((field) => fld(...field)).join('') + AMT.map(([key, label]) => fld(key, label + ' (₹)', 'n')).join('');
  $('#dt').value = date;
  setForm(null);
  draw();

  const show = (connected) => {
    db = connected;
    $('#lg').hidden = connected;
    $('#app').hidden = !connected;
    $('#so').hidden = !connected;
    $('#st').textContent = connected ? 'Connected' : 'Signed out';
    $('#st').className = 'chip' + (connected ? '' : ' bad');
  };

  $('#lg').addEventListener('submit', async (event) => {
    event.preventDefault();
    $('#le').textContent = '';

    try {
      await auth('password', {
        email: $('#em').value.trim(),
        password: $('#pw').value
      });
      $('#pw').value = '';
      show(true);
      watch();
    } catch (error) {
      $('#le').textContent = error.message;
    }
  });

  $('#so').addEventListener('click', () => {
    ses = null;
    setSession(null);
    clearSession();
    show(false);
  });

  document.addEventListener('visibilitychange', () => {
    if (db && !document.hidden) {
      watch(true);
    }
  });

  (async () => {
    try {
      ses = JSON.parse(localStorage.getItem('gs_ses'));
      setSession(ses);
    } catch (error) {
      ses = null;
    }

    if (ses) {
      try {
        await fresh(true);
        show(true);
        watch();
        return;
      } catch (error) {
        ses = null;
        clearSession();
      }
    }

    show(false);
  })();
})();
