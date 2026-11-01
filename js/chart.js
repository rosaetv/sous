// Gráfica de línea simple (una sola serie) en SVG, con valores al tocar.

import { t } from "./i18n.js";

const W = 320;
const H = 168;
const PAD = { top: 28, right: 14, bottom: 26, left: 14 };

/**
 * points: [{ y: número, label: "10 oct" }]
 * format: función para mostrar el valor (ej. 42.5 kg)
 */
export function lineChart(points, format) {
  if (points.length < 2) {
    return `<p class="chart-empty">${t("chart.empty")}</p>`;
  }
  const ys = points.map((p) => p.y);
  let min = Math.min(...ys);
  let max = Math.max(...ys);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const margin = (max - min) * 0.15;
  min -= margin;
  max += margin;

  const x = (i) => PAD.left + (i / (points.length - 1)) * (W - PAD.left - PAD.right);
  const y = (v) => PAD.top + (1 - (v - min) / (max - min)) * (H - PAD.top - PAD.bottom);
  const coords = points.map((p, i) => [x(i), y(p.y)]);
  const path = coords.map(([cx, cy], i) => `${i ? "L" : "M"}${cx.toFixed(1)},${cy.toFixed(1)}`).join(" ");
  const [lastX, lastY] = coords.at(-1);
  const gridYs = [PAD.top, (PAD.top + H - PAD.bottom) / 2, H - PAD.bottom];

  const data = points.map((p, i) => ({ x: coords[i][0], y: coords[i][1], text: `${format(p.y)} · ${p.label}` }));

  return `
    <div class="chart" data-points='${JSON.stringify(data).replace(/'/g, "&#39;")}'>
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${t("chart.aria", { from: format(points[0].y), to: format(points.at(-1).y) })}">
        ${gridYs.map((gy) => `<line class="chart-grid" x1="0" x2="${W}" y1="${gy}" y2="${gy}" />`).join("")}
        <path class="chart-line" d="${path}" />
        ${coords.map(([cx, cy]) => `<circle class="chart-dot" cx="${cx}" cy="${cy}" r="4" />`).join("")}
        <text class="chart-value" x="${Math.min(lastX, W - 4)}" y="${coords.at(-2)[1] < lastY ? lastY + 20 : lastY - 12}" text-anchor="end">${format(points.at(-1).y)}</text>
        <text class="chart-axis" x="${PAD.left}" y="${H - 6}">${points[0].label}</text>
        <text class="chart-axis" x="${W - PAD.right}" y="${H - 6}" text-anchor="end">${points.at(-1).label}</text>
        <line class="chart-cross" x1="0" x2="0" y1="${PAD.top - 8}" y2="${H - PAD.bottom}" visibility="hidden" />
        <circle class="chart-focus" r="6" visibility="hidden" />
      </svg>
      <div class="chart-tip" hidden></div>
    </div>`;
}

// Activa el valor al tocar o pasar el dedo por la gráfica.
export function bindCharts(root) {
  root.querySelectorAll(".chart").forEach((chart) => {
    const points = JSON.parse(chart.dataset.points);
    const svg = chart.querySelector("svg");
    const cross = chart.querySelector(".chart-cross");
    const focus = chart.querySelector(".chart-focus");
    const tip = chart.querySelector(".chart-tip");

    const show = (event) => {
      const rect = svg.getBoundingClientRect();
      const vx = ((event.clientX - rect.left) / rect.width) * W;
      const nearest = points.reduce((best, p) => (Math.abs(p.x - vx) < Math.abs(best.x - vx) ? p : best));
      cross.setAttribute("x1", nearest.x);
      cross.setAttribute("x2", nearest.x);
      focus.setAttribute("cx", nearest.x);
      focus.setAttribute("cy", nearest.y);
      cross.setAttribute("visibility", "visible");
      focus.setAttribute("visibility", "visible");
      tip.hidden = false;
      tip.textContent = nearest.text;
      const left = (nearest.x / W) * rect.width;
      tip.style.left = `${Math.min(Math.max(left, 60), rect.width - 60)}px`;
    };
    const hide = () => {
      cross.setAttribute("visibility", "hidden");
      focus.setAttribute("visibility", "hidden");
      tip.hidden = true;
    };

    svg.addEventListener("pointerdown", show);
    svg.addEventListener("pointermove", show);
    svg.addEventListener("pointerleave", hide);
  });
}
