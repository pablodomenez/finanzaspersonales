// tour.js — Recorrida guiada para nuevos usuarios (solo dashboard)
// Se muestra una vez. Reiniciar: localStorage.removeItem('_tour_done') + ir a dashboard.

(function () {
  if (localStorage.getItem('_tour_done') === '1') return;

  const STEPS = [
    {
      title: '¡Bienvenido/a a FinanzasApp! 👋',
      body: 'En unos segundos te mostramos las funciones principales para que puedas empezar a controlar tus finanzas de inmediato.',
      target: null,
    },
    {
      title: 'Tus métricas del mes',
      body: 'Estos 4 indicadores te dan un pantallazo de tu situación: saldo total, ingresos, gastos y cuánto ahorraste este mes.',
      target: '#tour-kpis',
      placement: 'bottom',
    },
    {
      title: 'Gráficos y tendencias',
      body: 'Seguí la evolución mes a mes, la distribución de gastos por categoría e insights automáticos sobre tu situación financiera.',
      target: '#tour-charts',
      placement: 'bottom',
    },
    {
      title: 'Navegación principal',
      body: 'Desde el menú lateral accedés a todas las secciones: Presupuestos, Tarjetas, Deudas, Objetivos, Inversiones y más.',
      target: '#sidebar',
      placement: 'right',
    },
    {
      title: 'Búsqueda rápida',
      body: 'Encontrá cualquier sección o movimiento al instante. También podés usar el atajo Ctrl+K desde cualquier pantalla.',
      target: '#_search-btn',
      placement: 'bottom',
    },
    {
      title: 'Panel de ayuda',
      body: 'Si tenés dudas, aquí encontrás respuestas rápidas sobre cada sección de la app.',
      target: '#_help-btn',
      placement: 'bottom',
    },
    {
      title: '¡Ya estás listo/a! 🎉',
      body: 'Podés reiniciar este tour en cualquier momento desde tu perfil. ¡Ahora empezá registrando tu primer movimiento!',
      target: null,
      isLast: true,
    },
  ];

  let currentStep = 0;
  let overlay, tooltip, spotlightEl = null;

  const isDark = () => document.documentElement.classList.contains('dark');

  function buildUI() {
    overlay = document.createElement('div');
    overlay.id = '_tour-overlay';
    overlay.style.cssText = [
      'position:fixed', 'inset:0', 'background:rgba(0,0,0,0.55)',
      'z-index:9990', 'pointer-events:all',
    ].join(';');
    document.body.appendChild(overlay);

    tooltip = document.createElement('div');
    tooltip.id = '_tour-tooltip';
    tooltip.style.cssText = [
      'position:fixed', 'z-index:9992', 'width:320px',
      'max-width:calc(100vw - 32px)', 'transition:top 0.2s ease,left 0.2s ease',
    ].join(';');
    document.body.appendChild(tooltip);
  }

  function renderStep() {
    const step = STEPS[currentStep];
    const total = STEPS.length;
    const dark = isDark();

    clearHighlight();

    const dots = Array.from({ length: total }, (_, i) =>
      `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;margin:0 3px;` +
      `background:${i === currentStep ? '#2563eb' : (dark ? '#475569' : '#d1d5db')};"></span>`
    ).join('');

    const prevBtn = currentStep > 0
      ? `<button id="_t-prev" style="padding:8px 16px;border-radius:10px;font-size:13px;font-weight:600;` +
        `color:${dark ? '#94a3b8' : '#6b7280'};background:${dark ? '#1e293b' : '#f3f4f6'};border:none;cursor:pointer;">Anterior</button>`
      : '';
    const skipBtn = currentStep < total - 1
      ? `<button id="_t-skip" style="padding:8px 14px;border-radius:10px;font-size:13px;font-weight:500;` +
        `color:${dark ? '#64748b' : '#9ca3af'};background:transparent;border:none;cursor:pointer;">Saltar</button>`
      : '';
    const nextLabel = step.isLast ? '¡Empezar!' : 'Siguiente →';
    const nextBtn = `<button id="_t-next" style="padding:8px 20px;border-radius:10px;font-size:13px;font-weight:600;` +
      `color:#fff;background:#2563eb;border:none;cursor:pointer;">${nextLabel}</button>`;

    tooltip.innerHTML = `
      <div style="background:${dark ? '#1e293b' : '#fff'};border:1px solid ${dark ? '#334155' : '#e5e7eb'};
           border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,0.3);padding:20px;font-family:inherit;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
          <span style="font-size:11px;font-weight:600;color:#2563eb;text-transform:uppercase;letter-spacing:0.05em;">
            Paso ${currentStep + 1} de ${total}
          </span>
          <button id="_t-close" style="background:none;border:none;cursor:pointer;
            color:${dark ? '#64748b' : '#9ca3af'};font-size:20px;line-height:1;padding:0 2px;">×</button>
        </div>
        <h3 style="font-size:15px;font-weight:700;color:${dark ? '#f1f5f9' : '#111827'};margin:0 0 8px;">
          ${step.title}
        </h3>
        <p style="font-size:13px;color:${dark ? '#94a3b8' : '#6b7280'};margin:0 0 16px;line-height:1.6;">
          ${step.body}
        </p>
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
          <div style="display:flex;align-items:center;">${dots}</div>
          <div style="display:flex;align-items:center;gap:8px;">${skipBtn}${prevBtn}${nextBtn}</div>
        </div>
      </div>`;

    tooltip.querySelector('#_t-close')?.addEventListener('click', endTour);
    tooltip.querySelector('#_t-next')?.addEventListener('click', () => step.isLast ? endTour() : goNext());
    tooltip.querySelector('#_t-prev')?.addEventListener('click', goPrev);
    tooltip.querySelector('#_t-skip')?.addEventListener('click', endTour);

    positionTooltip(step);
  }

  function positionTooltip(step) {
    if (!step.target) {
      tooltip.style.top = '50%';
      tooltip.style.left = '50%';
      tooltip.style.transform = 'translate(-50%, -50%)';
      return;
    }

    tooltip.style.transform = '';

    const el = document.querySelector(step.target);
    if (!el) {
      tooltip.style.top = '50%';
      tooltip.style.left = '50%';
      tooltip.style.transform = 'translate(-50%, -50%)';
      return;
    }

    // Highlight
    spotlightEl = el;
    const origPos = getComputedStyle(el).position;
    if (origPos === 'static') el.style.position = 'relative';
    el.style.zIndex = '9991';
    el.style.boxShadow = '0 0 0 4px #2563eb, 0 0 0 10px rgba(124,58,237,0.2)';
    el.style.transition = 'box-shadow 0.3s ease';

    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect();
      const vh   = window.innerHeight;
      const vw   = window.innerWidth;
      const TW   = 320;
      const TH   = tooltip.offsetHeight || 200;
      const GAP  = 14;
      const placement = step.placement || 'auto';

      let top, left;

      if (placement === 'right') {
        left = rect.right + GAP;
        top  = rect.top + rect.height / 2 - TH / 2;
        // fallback: if off-screen right, go below
        if (left + TW > vw - 16) {
          left = rect.left + rect.width / 2 - TW / 2;
          top  = rect.bottom + GAP;
        }
      } else if (placement === 'bottom') {
        top  = rect.bottom + GAP;
        left = rect.left + rect.width / 2 - TW / 2;
        // fallback: if off-screen bottom, go above
        if (top + TH > vh - 16) top = rect.top - TH - GAP;
      } else {
        top  = rect.bottom + TH + GAP < vh ? rect.bottom + GAP : rect.top - TH - GAP;
        left = rect.left + rect.width / 2 - TW / 2;
      }

      // Clamp to viewport
      left = Math.max(16, Math.min(left, vw - TW - 16));
      top  = Math.max(16, Math.min(top, vh - TH - 16));

      tooltip.style.top  = top  + 'px';
      tooltip.style.left = left + 'px';
    });
  }

  function clearHighlight() {
    if (!spotlightEl) return;
    spotlightEl.style.removeProperty('position');
    spotlightEl.style.removeProperty('z-index');
    spotlightEl.style.removeProperty('box-shadow');
    spotlightEl.style.removeProperty('transition');
    spotlightEl = null;
  }

  function goNext() { if (currentStep < STEPS.length - 1) { currentStep++; renderStep(); } }
  function goPrev() { if (currentStep > 0) { currentStep--; renderStep(); } }

  function endTour() {
    localStorage.setItem('_tour_done', '1');
    clearHighlight();
    overlay?.remove();
    tooltip?.remove();
  }

  document.addEventListener('DOMContentLoaded', () => {
    // Wait for dashboard data + common.js buttons to render
    setTimeout(() => {
      buildUI();
      renderStep();
    }, 950);
  });
})();
