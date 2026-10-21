/**
 * ============================================================================
 * app.js — Логика веб-интерфейса симплекс-метода (компактная версия)
 * ============================================================================
 */

(function () {
  'use strict';

  let numVariables = 2;

  // DOM элементы
  const objectiveVarsContainer = document.getElementById('objectiveVarsContainer');
  const constraintsList = document.getElementById('constraintsList');
  const directionSelect = document.getElementById('directionSelect');
  const integerCheck = document.getElementById('integerCheck');
  const nonlinearExpr = document.getElementById('nonlinearExpr');
  const simplexForm = document.getElementById('simplexForm');

  const btnAddVar = document.getElementById('btnAddVar');
  const btnRemoveVar = document.getElementById('btnRemoveVar');
  const btnAddConstraint = document.getElementById('btnAddConstraint');

  const btnPreset39 = document.getElementById('btnPreset39');
  const btnPreset14 = document.getElementById('btnPreset14');
  const btnPreset15 = document.getElementById('btnPreset15');
  const btnClearForm = document.getElementById('btnClearForm');

  const solutionCard = document.getElementById('solutionCard');
  const canonicalInfoBox = document.getElementById('canonicalInfoBox');
  const stepsContainer = document.getElementById('stepsContainer');
  const finalResultBox = document.getElementById('finalResultBox');
  const btnExpandAll = document.getElementById('btnExpandAll');
  const btnCollapseAll = document.getElementById('btnCollapseAll');

  function init() {
    setupEventListeners();
    loadPreset('variant39');
  }

  function setupEventListeners() {
    btnAddVar.addEventListener('click', () => addVariable());
    btnRemoveVar.addEventListener('click', () => removeVariable());
    btnAddConstraint.addEventListener('click', () => addConstraintRow());

    btnPreset39.addEventListener('click', () => { setActivePreset(btnPreset39); loadPreset('variant39'); });
    btnPreset14.addEventListener('click', () => { setActivePreset(btnPreset14); loadPreset('example14'); });
    btnPreset15.addEventListener('click', () => { setActivePreset(btnPreset15); loadPreset('example15'); });
    btnClearForm.addEventListener('click', () => { setActivePreset(null); clearForm(); });

    simplexForm.addEventListener('submit', (e) => {
      e.preventDefault();
      runSolver();
    });

    btnExpandAll.addEventListener('click', () => {
      document.querySelectorAll('.step-card').forEach(card => card.classList.add('open'));
    });

    btnCollapseAll.addEventListener('click', () => {
      document.querySelectorAll('.step-card').forEach(card => card.classList.remove('open'));
    });
  }

  function setActivePreset(button) {
    document.querySelectorAll('.btn-preset').forEach(b => b.classList.remove('active'));
    if (button) button.classList.add('active');
  }

  function renderObjectiveInputs(coeffs = []) {
    objectiveVarsContainer.innerHTML = '';
    for (let j = 0; j < numVariables; j++) {
      const varItem = document.createElement('div');
      varItem.className = 'var-item';

      const val = coeffs[j] !== undefined ? coeffs[j] : (j === 0 ? '1' : '0');
      varItem.innerHTML = `
        <input type="text" class="form-control obj-coeff" data-idx="${j}" value="${val}">
        <span class="var-name">x<sub>${j + 1}</sub></span>
        ${j < numVariables - 1 ? '<span class="plus">+</span>' : ''}
      `;
      objectiveVarsContainer.appendChild(varItem);
    }
  }

  function renderConstraintRow(rowIdx, constraint = null) {
    const row = document.createElement('div');
    row.className = 'constraint-row';
    row.dataset.rowIdx = rowIdx;

    let varsHtml = '';
    for (let j = 0; j < numVariables; j++) {
      const cVal = constraint && constraint.coeffs && constraint.coeffs[j] !== undefined ? constraint.coeffs[j] : '1';
      varsHtml += `
        <div class="var-item">
          <input type="text" class="form-control constr-coeff" data-var="${j}" value="${cVal}">
          <span class="var-name">x<sub>${j + 1}</sub></span>
          ${j < numVariables - 1 ? '<span class="plus">+</span>' : ''}
        </div>
      `;
    }

    const op = constraint ? constraint.op : '<=';
    const rhsVal = constraint ? constraint.rhs : '10';

    row.innerHTML = `
      <span class="constraint-index">${rowIdx + 1}.</span>
      <div class="var-inputs">${varsHtml}</div>
      <select class="form-control constr-op">
        <option value="<=" ${op === '<=' ? 'selected' : ''}>&le;</option>
        <option value=">=" ${op === '>=' ? 'selected' : ''}>&ge;</option>
        <option value="=" ${op === '=' ? 'selected' : ''}>=</option>
      </select>
      <input type="text" class="form-control constraint-rhs" value="${rhsVal}">
      <button type="button" class="btn-remove-row" title="Удалить">&times;</button>
    `;

    row.querySelector('.btn-remove-row').addEventListener('click', () => {
      row.remove();
      updateConstraintIndices();
    });

    constraintsList.appendChild(row);
  }

  function updateConstraintIndices() {
    const rows = constraintsList.querySelectorAll('.constraint-row');
    rows.forEach((r, idx) => {
      r.querySelector('.constraint-index').textContent = `${idx + 1}.`;
    });
  }

  function addVariable() {
    numVariables++;
    const currObj = getObjectiveCoeffs();
    currObj.push('0');
    renderObjectiveInputs(currObj);

    const rows = constraintsList.querySelectorAll('.constraint-row');
    rows.forEach(r => {
      const varsContainer = r.querySelector('.var-inputs');
      const lastPlus = varsContainer.querySelector('.var-item:last-child .plus');
      if (!lastPlus) {
        const span = document.createElement('span');
        span.className = 'plus';
        span.textContent = '+';
        varsContainer.querySelector('.var-item:last-child').appendChild(span);
      }

      const varItem = document.createElement('div');
      varItem.className = 'var-item';
      varItem.innerHTML = `
        <input type="text" class="form-control constr-coeff" data-var="${numVariables - 1}" value="0">
        <span class="var-name">x<sub>${numVariables}</sub></span>
      `;
      varsContainer.appendChild(varItem);
    });
  }

  function removeVariable() {
    if (numVariables <= 2) {
      alert('Минимум 2 переменные.');
      return;
    }
    numVariables--;
    const currObj = getObjectiveCoeffs().slice(0, numVariables);
    renderObjectiveInputs(currObj);

    const rows = constraintsList.querySelectorAll('.constraint-row');
    rows.forEach(r => {
      const lastItem = r.querySelector('.var-inputs .var-item:last-child');
      if (lastItem) lastItem.remove();
      const newLastPlus = r.querySelector('.var-inputs .var-item:last-child .plus');
      if (newLastPlus) newLastPlus.remove();
    });
  }

  function addConstraintRow(constraint = null) {
    const nextIdx = constraintsList.children.length;
    renderConstraintRow(nextIdx, constraint);
  }

  function getObjectiveCoeffs() {
    return Array.from(document.querySelectorAll('.obj-coeff')).map(input => input.value.trim());
  }

  function loadPreset(presetKey) {
    const preset = window.PRESETS[presetKey];
    if (!preset) return;

    numVariables = preset.objective.length;
    directionSelect.value = preset.direction;
    renderObjectiveInputs(preset.objective);

    constraintsList.innerHTML = '';
    preset.constraints.forEach((c, idx) => {
      renderConstraintRow(idx, c);
    });

    integerCheck.checked = preset.integerVars && preset.integerVars.length > 0;
    nonlinearExpr.value = preset.nonlinearCheck
      ? (typeof preset.nonlinearCheck === 'string' ? preset.nonlinearCheck : 'x2 * lg(x1) > 1')
      : '';

    runSolver();
  }

  function clearForm() {
    numVariables = 2;
    directionSelect.value = 'max';
    renderObjectiveInputs(['1', '1']);
    constraintsList.innerHTML = '';
    renderConstraintRow(0, { coeffs: ['1', '1'], op: '<=', rhs: '10' });
    integerCheck.checked = false;
    nonlinearExpr.value = '';
    solutionCard.style.display = 'none';
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getFormData() {
    const objective = getObjectiveCoeffs();
    const direction = directionSelect.value;
    const constraints = [];

    const rows = constraintsList.querySelectorAll('.constraint-row');
    rows.forEach(r => {
      const coeffs = Array.from(r.querySelectorAll('.constr-coeff')).map(inp => inp.value.trim());
      const op = r.querySelector('.constr-op').value;
      const rhs = r.querySelector('.constraint-rhs').value.trim();
      constraints.push({ coeffs, op, rhs });
    });

    const integerVars = [];
    if (integerCheck.checked) {
      for (let j = 1; j <= numVariables; j++) {
        integerVars.push(`x${j}`);
      }
    }

    const nlText = nonlinearExpr.value.trim();

    return {
      objective,
      direction,
      constraints,
      integerVars,
      nonlinearCheck: nlText || null
    };
  }

  function runSolver() {
    try {
      const formData = getFormData();
      const canon = window.canonicalizeProblem(formData);

      const solver = new window.SimplexSolver(canon);
      const result = solver.solve();

      displaySolution(formData, canon, result);
    } catch (err) {
      alert('Ошибка при расчете: ' + err.message);
      console.error(err);
    }
  }

  function displaySolution(formData, canon, result) {
    solutionCard.style.display = 'block';

    // 1. Канонический вид
    let objTerms = [];
    for (let j = 0; j < formData.objective.length; j++) {
      objTerms.push(`${formData.objective[j]}·x<sub>${j + 1}</sub>`);
    }

    let constrHtml = '';
    formData.constraints.forEach((c, idx) => {
      const terms = c.coeffs.map((val, vIdx) => `${val}·x<sub>${vIdx + 1}</sub>`).join(' + ');
      const opSign = c.op === '<=' ? '&le;' : (c.op === '>=' ? '&ge;' : '=');
      constrHtml += `<div>${terms} ${opSign} ${c.rhs}</div>`;
    });

    const isMin = formData.direction === 'min';
    const minNote = isMin 
      ? `<div><em>(Для минимизации выполняется переход к задаче максимизации: q' = &minus;q &rarr; max)</em></div>` 
      : '';

    canonicalInfoBox.innerHTML = `
      <div class="canonical-header">
        <strong>Канонический вид</strong> (базис: ${canon.basicVars.join(', ')}):
      </div>
      <div class="math-block">
        <div><strong>q = ${objTerms.join(' + ')} &rarr; ${formData.direction}</strong></div>
        ${minNote}
        ${constrHtml}
        <div>x<sub>j</sub> &ge; 0${formData.integerVars.length > 0 ? ', переменные целые' : ''}</div>
      </div>
    `;

    // 2. Этапы
    stepsContainer.innerHTML = '';
    result.steps.forEach((step, idx) => {
      renderStepCard(step, idx, result.steps.length);
    });

    // 3. Итог
    if (result.status === 'optimal') {
      let varsGridHtml = '';
      for (let j = 1; j <= formData.objective.length; j++) {
        const vName = `x${j}`;
        const val = result.solution.variables[vName] || new window.Fraction(0);
        varsGridHtml += `
          <div class="result-item">
            <span class="item-label">${vName}</span>
            <span class="item-value">${val.toString()}</span>
          </div>
        `;
      }

      const qLabel = isMin ? 'q<sub>min</sub>' : 'q<sub>max</sub>';

      varsGridHtml += `
        <div class="result-item result-q">
          <span class="item-label">${qLabel}</span>
          <span class="item-value">${result.q.toString()}</span>
        </div>
      `;

      let finalNote = '';
      const lastStep = result.steps[result.steps.length - 1];
      if (lastStep && lastStep.nonlinearResult) {
        const nr = lastStep.nonlinearResult;
        const subStr = nr.subFormula ? ` (подстановка: <code>${escapeHtml(nr.subFormula)}</code>)` : '';
        const statusBadge = nr.satisfied 
          ? '<span style="color: #16a34a; font-weight: 600;">✅ Выполняется</span>' 
          : '<span style="color: #dc2626; font-weight: 600;">❌ Не выполняется</span>';
        finalNote = `
          <div class="result-check ${nr.satisfied ? '' : 'failed'}">
            <div><strong>Проверка нелинейного ограничения (разд. 3.5.7):</strong></div>
            <div style="margin-top: 4px;">
              Условие: <code>${escapeHtml(nr.description)}</code>${subStr}
            </div>
            <div style="margin-top: 4px;">
              Результат: <strong>${escapeHtml(nr.actualStr)}</strong> &rarr; ${statusBadge}
            </div>
          </div>
        `;
      }

      finalResultBox.innerHTML = `
        <div class="result-title">Оптимальное решение найдено (${isMin ? 'минимум' : 'максимум'})</div>
        <div class="result-grid">${varsGridHtml}</div>
        ${finalNote}
      `;
      finalResultBox.style.display = 'block';
    } else {
      let errText = 'область допустимых решений пуста';
      if (result.status === 'unbounded') errText = 'целевая функция не ограничена';
      else if (result.status === 'max_iterations') errText = 'превышен лимит итераций';

      let lastNlNote = '';
      const lastStep = result.steps[result.steps.length - 1];
      if (lastStep && (lastStep.dantzigCut || lastStep.nonlinearResult)) {
        const desc = lastStep.dantzigCut ? lastStep.dantzigCut.description : (lastStep.nonlinearResult ? lastStep.nonlinearResult.description : '');
        lastNlNote = `<div style="margin-top: 8px; font-size: 13px; color: #b91c1c;">Все найденные целочисленные планы не удовлетворяют нелинейному условию <code>${escapeHtml(desc)}</code>.</div>`;
      }

      finalResultBox.innerHTML = `
        <div class="result-title" style="color: #dc2626;">Решение не найдено (${errText})</div>
        ${lastNlNote}
      `;
      finalResultBox.style.display = 'block';
    }

    // Раскрываем первый и последний этапы
    const stepCards = document.querySelectorAll('.step-card');
    if (stepCards.length > 0) {
      stepCards[0].classList.add('open');
      stepCards[stepCards.length - 1].classList.add('open');
    }

    solutionCard.scrollIntoView({ behavior: 'smooth' });
  }

  function renderStepCard(step, idx, totalSteps) {
    const card = document.createElement('div');
    card.className = `step-card ${step.isFinal ? 'active-step' : ''}`;

    const tagFeasible = step.isFeasible 
      ? '<span class="tag tag-ok">Допустим</span>' 
      : '<span class="tag tag-err">Недопустим</span>';

    const tagOptimal = step.isOptimal 
      ? '<span class="tag tag-ok">Оптимум</span>' 
      : '<span class="tag tag-warn">Не оптимум</span>';

    let cutTag = '';
    if (step.dantzigCut) {
      cutTag = '<span class="tag tag-warn">Отсечение Данцига</span>';
    } else if (step.gomoryCut) {
      cutTag = '<span class="tag tag-warn">Отсечение Гомори</span>';
    }

    // Формирование компактного блока перехода
    let transitionHtml = '';
    if (step.pivot) {
      let ratiosStr = '';
      if (step.ratios && step.ratios.length > 0) {
        const items = step.ratios.map(r => {
          return r.isMax 
            ? `<strong>${r.varName}: ${r.str} (макс)</strong>` 
            : `${r.varName}: ${r.str}`;
        });
        ratiosStr = `<div class="ratios-line"><span class="sub-label">Отношения (&alpha;<sub>ij</sub> / &alpha;<sub>i0</sub>):</span> ${items.join(' &nbsp;|&nbsp; ')}</div>`;
      }

      transitionHtml = `
        <div class="pivot-info-box">
          <div class="pivot-main-row">
            <span>Входит: <strong>${step.pivot.enteringVar}</strong></span>
            <span>&bull;</span>
            <span>Выходит: <strong>${step.pivot.leavingVar}</strong></span>
            <span>&bull;</span>
            <span>&lambda; = <strong>${step.pivot.lambda}</strong></span>
          </div>
          ${ratiosStr}
        </div>
      `;
    }

    let gomoryHtml = '';
    if (step.gomoryCut) {
      gomoryHtml = `
        <div class="gomory-badge">
          ✂️ <strong>Отсечение Гомори</strong> по ${step.gomoryCut.chosenVar} = ${step.gomoryCut.valStr} (дробная часть {${step.gomoryCut.valStr}} = ${step.gomoryCut.frac0}). Введена ${step.gomoryCut.newVarName}.
        </div>
      `;
    }

    let dantzigHtml = '';
    if (step.dantzigCut) {
      dantzigHtml = `
        <div class="dantzig-badge">
          ✂️ <strong>Отсечение Данцига (разд. 3.5.7, стр. 69–70)</strong>: ${escapeHtml(step.dantzigCut.explanation)}
        </div>
      `;
    }

    let nonlinearHtml = '';
    if (step.nonlinearResult && !step.dantzigCut) {
      const nr = step.nonlinearResult;
      const subStr = nr.subFormula ? ` (подстановка: <code>${escapeHtml(nr.subFormula)}</code>)` : '';
      nonlinearHtml = `
        <div class="nonlinear-check-step ${nr.satisfied ? 'ok' : 'err'}">
          🔍 <strong>Проверка нелинейного ограничения:</strong> <code>${escapeHtml(nr.description)}</code>${subStr} &rarr; <strong>${escapeHtml(nr.actualStr)}</strong> (${nr.satisfied ? '✅ Выполняется' : '❌ Не выполняется'})
        </div>
      `;
    }

    card.innerHTML = `
      <div class="step-header">
        <div class="step-title-area">
          <span class="step-num">Этап ${step.stepNumber}</span>
          <span class="step-name">Таблица ${step.tableIndex}</span>
          ${tagFeasible}
          ${tagOptimal}
          ${cutTag}
        </div>
        <div class="step-meta">
          <span class="q-val">q = ${(step.realQ || step.solution.q).toString()}</span>
          <span class="toggle-icon">&#9660;</span>
        </div>
      </div>
      <div class="step-body">
        <!-- Формулы разложения и базис -->
        <div class="math-block equations-block">
          ${step.algebraicEquations.map(eq => `<div>${eq.name} = ${eq.expr}</div>`).join('')}
          <div class="solution-line">Базис: ${Object.entries(step.solution.variables).map(([k, v]) => `${k}=${v.toString()}`).join(', ')}</div>
        </div>

        <!-- Симплекс-таблица -->
        ${renderSimplexTableHtml(step)}

        <!-- Инфо о ведущих элементах -->
        ${transitionHtml}

        <!-- Блок проверки нелинейного ограничения -->
        ${nonlinearHtml}

        <!-- Блок Гомори -->
        ${gomoryHtml}

        <!-- Блок Данцига -->
        ${dantzigHtml}
      </div>
    `;

    card.querySelector('.step-header').addEventListener('click', () => {
      card.classList.toggle('open');
    });

    stepsContainer.appendChild(card);
  }

  function renderSimplexTableHtml(step) {
    const colHeaders = ['1', ...step.freeVars.map(v => `&minus;${v}`)];
    const rowHeaders = ['q', ...step.basicVars];

    let theadHtml = '<tr><th>Базис</th>';
    colHeaders.forEach((ch, cIdx) => {
      const isPivotCol = step.pivot && step.pivot.jStar === cIdx;
      theadHtml += `<th class="${isPivotCol ? 'col-pivot' : ''}">${ch}</th>`;
    });
    theadHtml += '</tr>';

    let tbodyHtml = '';
    for (let i = 0; i < step.matrix.length; i++) {
      const isPivotRow = step.pivot && step.pivot.iStar === i;
      tbodyHtml += `<tr class="${isPivotRow ? 'row-pivot' : ''}">`;
      tbodyHtml += `<td class="row-header">${rowHeaders[i]}</td>`;

      for (let j = 0; j < step.matrix[i].length; j++) {
        const isPivotCell = step.pivot && step.pivot.iStar === i && step.pivot.jStar === j;
        const isPivotCol = step.pivot && step.pivot.jStar === j;
        
        let cellClass = '';
        if (isPivotCell) cellClass = 'pivot-cell';
        else if (isPivotCol) cellClass = 'col-pivot';

        const oldVal = step.matrix[i][j].toString();
        let starVal = '';
        if (step.alphaStar && step.alphaStar[i] && step.alphaStar[i][j]) {
          starVal = `[${step.alphaStar[i][j].toString()}]`;
        }

        tbodyHtml += `
          <td class="${cellClass}">
            <span class="cell-val">${oldVal}${isPivotCell ? '*' : ''}</span>
            ${starVal ? `<span class="cell-star">${starVal}</span>` : ''}
          </td>
        `;
      }
      tbodyHtml += '</tr>';
    }

    return `
      <div class="table-wrapper">
        <table class="simplex-table">
          <thead>${theadHtml}</thead>
          <tbody>${tbodyHtml}</tbody>
        </table>
      </div>
    `;
  }

  document.addEventListener('DOMContentLoaded', init);
})();
