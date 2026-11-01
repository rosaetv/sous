// Botón del período en Inicio y paneles para marcar, terminar o corregir fechas.

import { getPeriods, savePeriods, activePeriod, periodError, startPeriod, endPeriod, todayISO } from "../period.js";
import { esc, icons, openSheet, confirmSheet, toast } from "../ui.js";
import { t, locale } from "../i18n.js";

// Botón junto al saludo: gota vacía, o gota llena con el número de día.
export function periodButton(current) {
  return current
    ? `<button class="period-btn on" data-action="period-end" aria-label="${t("period.dayLabel", { n: current.day })}">${icons.dropFilled}<span>${current.day}</span></button>`
    : `<button class="period-btn" data-action="period-start" aria-label="${t("period.startTitle")}">${icons.drop}</button>`;
}

export function shortPeriodDate(iso) {
  return new Date(`${iso}T00:00`).toLocaleDateString(locale(), { day: "numeric", month: "short" });
}

// Panel con una fecha (hoy por defecto) para confirmar inicio o fin.
function dateSheet({ title, text, min, onConfirm }) {
  const today = todayISO();
  openSheet({
    title,
    body: `
      <form class="form" novalidate>
        <p class="sheet-text">${text}</p>
        <label class="field">
          <span>${t("metric.date")}</span>
          <input class="input" type="date" name="date" value="${today}" max="${today}" ${min ? `min="${min}"` : ""} />
        </label>
        <p class="form-error" role="alert"></p>
        <div class="stack">
          <button class="btn btn-primary" type="submit">${t("period.confirm")}</button>
          <button class="btn btn-secondary" type="button" data-sheet-close>${t("common.cancel")}</button>
        </div>
      </form>`,
    onMount: (sheet, close) => {
      const form = sheet.querySelector("form");
      form.onsubmit = async (event) => {
        event.preventDefault();
        const date = form.elements.date.value;
        const error = !date || date > today ? "period.errorDate" : await onConfirm(date);
        if (error) {
          form.querySelector(".form-error").textContent = t(error);
          return;
        }
        close();
      };
    },
  });
}

export async function periodStartSheet(onDone) {
  dateSheet({
    title: t("period.startTitle"),
    text: t("period.startText"),
    onConfirm: async (date) => {
      const error = periodError(await getPeriods(), { start: date, end: null });
      if (error) return error;
      await startPeriod(date);
      toast(t("period.started"));
      onDone();
    },
  });
}

export async function periodEndSheet(onDone) {
  const current = activePeriod(await getPeriods());
  if (!current) return onDone();
  dateSheet({
    title: t("period.endTitle"),
    text: t("period.endText", { date: shortPeriodDate(current.period.start) }),
    min: current.period.start,
    onConfirm: async (date) => {
      if (date < current.period.start) return "period.errorOrder";
      await endPeriod(current.period, date);
      toast(t("period.ended"));
      onDone();
    },
  });
}

// Corregir o agregar un período desde Perfil. period = null para agregar uno nuevo.
export async function periodEditSheet(period, onDone) {
  const today = todayISO();
  openSheet({
    title: period ? t("period.editTitle") : t("period.addTitle"),
    body: `
      <form class="form" novalidate>
        <label class="field">
          <span>${t("period.startDate")}</span>
          <input class="input" type="date" name="start" value="${period?.start || today}" max="${today}" />
        </label>
        <label class="field">
          <span>${t("period.endDate")} <small>${t("period.endOptional")}</small></span>
          <input class="input" type="date" name="end" value="${period?.end || ""}" max="${today}" />
        </label>
        <p class="form-error" role="alert"></p>
        <div class="stack">
          <button class="btn btn-primary" type="submit">${t("common.save")}</button>
          ${period ? `<button class="btn btn-ghost-danger" type="button" data-delete>${t("period.delete")}</button>` : ""}
        </div>
      </form>`,
    onMount: (sheet, close) => {
      const form = sheet.querySelector("form");
      form.onsubmit = async (event) => {
        event.preventDefault();
        const start = form.elements.start.value;
        const end = form.elements.end.value || null;
        const periods = await getPeriods();
        const stored = period && periods.find((p) => p.start === period.start);
        const error = !start || start > today || (end && end > today) ? "period.errorDate" : periodError(periods, { start, end }, stored);
        if (error) {
          form.querySelector(".form-error").textContent = t(error);
          return;
        }
        if (stored) Object.assign(stored, { start, end });
        else periods.push({ start, end });
        await savePeriods(periods);
        close();
        toast(t("period.saved"));
        onDone();
      };
      sheet.querySelector("[data-delete]")?.addEventListener("click", async () => {
        close();
        const ok = await confirmSheet({
          title: t("period.deleteTitle"),
          text: t("period.deleteText", { date: esc(shortPeriodDate(period.start)) }),
          confirmLabel: t("delete.button"),
          danger: true,
        });
        if (!ok) return;
        await savePeriods((await getPeriods()).filter((p) => p.start !== period.start));
        toast(t("period.deleted"));
        onDone();
      });
    },
  });
}
