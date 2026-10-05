import { LEARNING_OUTCOMES, MODEL_ANSWERS, runSheetRows, teacherIntro } from './teacherContent.js';
import { escapeHtml } from './labFiles.js';

export function renderTeacherNotes(root) {
  if (!root) return;
  const outcomes = LEARNING_OUTCOMES.map(
    (item) => `<li><strong>${escapeHtml(item.theme)}.</strong> ${escapeHtml(item.text)}</li>`
  ).join('');
  const sheet = runSheetRows()
    .map(
      (row) => `<tr>
        <td>${escapeHtml(row.clock)}</td>
        <td>${escapeHtml(row.phase)}<br><small>${escapeHtml(row.range)}</small></td>
        <td>${escapeHtml(row.lecturer)}</td>
        <td>${escapeHtml(row.students)}</td>
      </tr>`
    )
    .join('');
  const answers = MODEL_ANSWERS.map(
    (item) => `<section><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.text)}</p></section>`
  ).join('');

  root.innerHTML = `
    <p class="doc-kicker">Lecturer copy · do not project this page</p>
    <h1>Teacher notes</h1>
    <p>${escapeHtml(teacherIntro())}</p>
    <h2>Learning outcomes</h2>
    <ul>${outcomes}</ul>
    <h2>How the numbers work</h2>
    <p>The resilience bar is the measurement tool. Students should read it before and after the disaster.</p>
    <ul>
      <li><strong>Without power.</strong> People in homes that are not fully powered, including damaged homes. A grid failure cuts power everywhere while the buildings stay up.</li>
      <li><strong>Without water.</strong> A home has water only when it has power and at least one power plant is online. Pumps and treatment stop in a power cut. A flood or typhoon also cuts water for homes on the harbour.</li>
      <li><strong>Without communications.</strong> Communications need power. A typhoon or earthquake also knocks out exchanges and towers for a while.</li>
      <li><strong>Services lost.</strong> Shops that are closed, fire stations with no grid, and power plants that are offline.</li>
      <li><strong>Recovery.</strong> Wall-clock time until power, water, and communications are back to the counts from just before that disaster.</li>
      <li><strong>Cost.</strong> The repair and emergency bill already shown in the game.</li>
      <li><strong>Most affected.</strong> The housing group with the most people cut off. Groups are older low-rise, mid-rise, or high-rise, on the harbour or inland.</li>
    </ul>
    <p>There is no separate water-works building. That is deliberate: the lesson is dependence. If the only plant is on the harbour, a typhoon can take power, water, and communications together.</p>
    <h2>Run sheet (${80} minutes)</h2>
    <p>The clock is a guide. Move the phase when the room is ready. Suggested ranges: introduction 10 min, investigation 40–45 min, test and improve 10–15 min, report 15–20 min.</p>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Clock</th><th>Phase</th><th>Lecturer</th><th>Students</th></tr></thead>
        <tbody>${sheet}</tbody>
      </table>
    </div>
    <h2>What to click</h2>
    <ol>
      <li>Log in as admin and open Admin. The class lab panel is at the top. You can use the same buttons inside Lab sheet on the game if you are logged in as admin. If the panel says the class link is not reachable, student iPads will not follow until this version of the API is deployed. Two tabs on the same browser still stay in step.</li>
      <li>Press Start class during the introduction. Students see the phase and the countdown. They do not log in for the table or the reflection.</li>
      <li>During investigation, ask them to press Record Design A.</li>
      <li>Move to Test and improve, then Send to class. Default is a major typhoon. Grid failure is the clean power-cut example. Random drill disasters stay off while the class timer is running.</li>
      <li>Students record the impact, change the city, then record Design B.</li>
      <li>Move to Report. They export a CSV and a print or copy summary, and answer the reflection on their device.</li>
    </ol>
    <p>While the class timer is running, the 15-minute drill clock will not end the session. Students cannot send their own disaster during the class; you send it so the whole room sees the same kind of shock on their own map.</p>
    <h2>Model answers</h2>
    <p>Use these to mark the reflection. Student wording will be shorter. Look for the chain (what depended on what), a comparison of two designs, and a named group of people.</p>
    ${answers}
    <p><a href="/admin.html">Back to admin</a> · <a href="/">Back to the game</a></p>
  `;
}
