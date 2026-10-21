/**
 * ============================================================================
 * ТПР (Теория принятия решений). Раздел 3.2: Симплекс-метод
 * Раздел 3.3: Решение задач дискретного ЛП (Метод Гомори)
 * Раздел 3.5.7: Задачи с нелинейными ограничениями (Отсечения Данцига)
 * Реализация по методическому пособию TPR.pdf (БГТУ «Военмех», стр. 24–35, 68–71)
 * ============================================================================
 */

const { evaluateNonlinearCondition } = require('./simplex-core');

/**
 * Класс Fraction для точных вычислений с обыкновенными дробями
 */
class Fraction {
  constructor(numerator, denominator = 1) {
    if (numerator instanceof Fraction) {
      this.n = numerator.n;
      this.d = numerator.d;
      return;
    }
    if (typeof numerator === 'string') {
      if (numerator.includes('/')) {
        const parts = numerator.split('/');
        numerator = parseInt(parts[0], 10);
        denominator = parseInt(parts[1], 10);
      } else if (numerator.includes('.')) {
        const dec = numerator.split('.');
        const factor = Math.pow(10, dec[1].length);
        numerator = Math.round(parseFloat(numerator) * factor);
        denominator = factor;
      } else {
        numerator = parseInt(numerator, 10);
      }
    } else if (typeof numerator === 'number' && !Number.isInteger(numerator)) {
      // Преобразование float в дробь
      const s = numerator.toString();
      if (s.includes('.')) {
        const dec = s.split('.')[1].length;
        const factor = Math.pow(10, Math.min(dec, 6));
        numerator = Math.round(numerator * factor);
        denominator = factor;
      }
    }

    if (denominator === 0) {
      throw new Error('Деление на ноль в дроби');
    }
    if (denominator < 0) {
      numerator = -numerator;
      denominator = -denominator;
    }
    const g = Fraction.gcd(Math.abs(numerator), Math.abs(denominator));
    this.n = numerator / g;
    this.d = denominator / g;
  }

  static gcd(a, b) {
    while (b) {
      const t = b;
      b = a % b;
      a = t;
    }
    return a || 1;
  }

  add(other) {
    const o = new Fraction(other);
    return new Fraction(this.n * o.d + o.n * this.d, this.d * o.d);
  }

  sub(other) {
    const o = new Fraction(other);
    return new Fraction(this.n * o.d - o.n * this.d, this.d * o.d);
  }

  mul(other) {
    const o = new Fraction(other);
    return new Fraction(this.n * o.n, this.d * o.d);
  }

  div(other) {
    const o = new Fraction(other);
    if (o.n === 0) throw new Error('Деление на нулевую дробь');
    return new Fraction(this.n * o.d, this.d * o.n);
  }

  neg() {
    return new Fraction(-this.n, this.d);
  }

  inv() {
    if (this.n === 0) throw new Error('Обращение нуля невозможно');
    return new Fraction(this.d, this.n);
  }

  isZero() {
    return this.n === 0;
  }

  isNegative() {
    return this.n < 0;
  }

  isPositive() {
    return this.n > 0;
  }

  isInteger() {
    return this.d === 1;
  }

  toNumber() {
    return this.n / this.d;
  }

  /**
   * Дробная часть числа {alpha} = alpha - [alpha] (методичка, стр. 31, формула 8)
   * Разность числа и наибольшего целого, не превосходящего его.
   */
  fractionalPart() {
    const floorVal = Math.floor(this.n / this.d);
    return this.sub(new Fraction(floorVal, 1));
  }

  toString() {
    if (this.d === 1) return String(this.n);
    return `${this.n}/${this.d}`;
  }
}

const F = (n, d = 1) => new Fraction(n, d);

/**
 * Класс SimplexTable представляет один шаг (план) симплекс-метода.
 * Форма разложения (методичка, стр. 26-27):
 *   q   = alpha_00 - sum(alpha_0j * x''_j)
 *   x'_i = alpha_i0 - sum(alpha_ij * x''_j)
 * 
 * В ячейках таблицы хранятся:
 *   - "старые" коэффициенты alpha_ij
 *   - "новые" (промежуточные) коэффициенты alpha*_ij
 */
class SimplexTable {
  constructor({ tableIndex, basicVars, freeVars, matrix }) {
    this.tableIndex = tableIndex;
    this.basicVars = [...basicVars];
    this.freeVars = [...freeVars];
    this.matrix = matrix.map(row => row.map(v => new Fraction(v)));
    this.m = this.basicVars.length;
    this.k = this.freeVars.length;
    this.alphaStar = null;
    this.pivot = null;
  }

  /**
   * Проверка допустимости (стр. 27): все свободные члены первого столбца >= 0 (кроме alpha_00)
   */
  isFeasible() {
    for (let i = 1; i <= this.m; i++) {
      if (this.matrix[i][0].isNegative()) return false;
    }
    return true;
  }

  /**
   * Проверка оптимальности (стр. 27): все коэффициенты первой строки >= 0 (кроме alpha_00)
   */
  isOptimal() {
    for (let j = 1; j <= this.k; j++) {
      if (this.matrix[0][j].isNegative()) return false;
    }
    return true;
  }

  /**
   * Проверка целочисленности для заданных переменных (стр. 30–31)
   */
  isIntegerSolution(varNames) {
    const sol = this.getSolution(varNames);
    for (const name of varNames) {
      if (!sol.variables[name].isInteger()) return false;
    }
    return true;
  }

  /**
   * Получение текущих значений переменных задачи
   */
  getSolution(allVarNames) {
    const solution = {};
    for (const v of allVarNames) {
      solution[v] = F(0);
    }
    for (let i = 1; i <= this.m; i++) {
      solution[this.basicVars[i - 1]] = this.matrix[i][0];
    }
    return {
      variables: solution,
      q: this.matrix[0][0]
    };
  }

  /**
   * Вывод алгебраического разложения (п. 3.2.1, стр. 24–26)
   */
  printAlgebraicForm() {
    console.log('  Разложение целевой функции и базисных переменных по свободным:');
    const formatExpression = (rowIdx) => {
      let terms = [];
      const freeTerm = this.matrix[rowIdx][0];
      if (!freeTerm.isZero() || this.k === 0) {
        terms.push(freeTerm.toString());
      }
      for (let j = 1; j <= this.k; j++) {
        // Коэффициент при x''_j в уравнении равен (-alpha_ij)
        const coeff = this.matrix[rowIdx][j].neg();
        if (coeff.isZero()) continue;

        const varName = this.freeVars[j - 1];
        let termStr = '';
        if (coeff.toNumber() === 1) {
          termStr = (terms.length > 0 ? '+ ' : '') + varName;
        } else if (coeff.toNumber() === -1) {
          termStr = '- ' + varName;
        } else if (coeff.isPositive()) {
          termStr = (terms.length > 0 ? '+ ' : '') + coeff.toString() + '*' + varName;
        } else {
          termStr = '- ' + coeff.neg().toString() + '*' + varName;
        }
        terms.push(termStr);
      }
      return terms.length > 0 ? terms.join(' ') : '0';
    };

    console.log(`    q  = ${formatExpression(0)}`);
    for (let i = 1; i <= this.m; i++) {
      const varName = this.basicVars[i - 1];
      console.log(`    ${varName.padEnd(2, ' ')} = ${formatExpression(i)}`);
    }
  }

  /**
   * Печать симплекс-таблицы (плана) с промежуточными alpha*
   */
  printTable() {
    const colNames = ['1', ...this.freeVars.map(v => `-${v}`)];
    const rowNames = ['q', ...this.basicVars];

    const formattedCells = [];
    for (let i = 0; i <= this.m; i++) {
      const row = [];
      for (let j = 0; j <= this.k; j++) {
        const valStr = this.matrix[i][j].toString();
        let starStr = '';
        if (this.alphaStar && this.alphaStar[i][j]) {
          starStr = ` [${this.alphaStar[i][j].toString()}]`;
        }
        let marker = '';
        if (this.pivot && this.pivot.iStar === i && this.pivot.jStar === j) {
          marker = '*';
        }
        row.push(valStr + marker + starStr);
      }
      formattedCells.push(row);
    }

    const colWidths = colNames.map((name, colIdx) => {
      let maxLen = name.length;
      for (let i = 0; i <= this.m; i++) {
        maxLen = Math.max(maxLen, formattedCells[i][colIdx].length);
      }
      return Math.max(maxLen + 2, 8);
    });

    const headerLabelWidth = 8;
    const topBorder = '┌' + '─'.repeat(headerLabelWidth) + '┬' + colWidths.map(w => '─'.repeat(w)).join('┬') + '┐';
    const midBorder = '├' + '─'.repeat(headerLabelWidth) + '┼' + colWidths.map(w => '─'.repeat(w)).join('┼') + '┤';
    const botBorder = '└' + '─'.repeat(headerLabelWidth) + '┴' + colWidths.map(w => '─'.repeat(w)).join('┴') + '┘';

    console.log(topBorder);
    const headerRow = '│' + ' '.repeat(headerLabelWidth) + '│' + colNames.map((name, idx) => {
      return name.padStart(Math.floor((colWidths[idx] + name.length) / 2)).padEnd(colWidths[idx]);
    }).join('│') + '│';
    console.log(headerRow);
    console.log(midBorder);

    for (let i = 0; i <= this.m; i++) {
      const rowLabel = rowNames[i].padEnd(headerLabelWidth - 1);
      const rowContent = formattedCells[i].map((cell, idx) => {
        return cell.padStart(colWidths[idx] - 1) + ' ';
      }).join('│');
      console.log(`│ ${rowLabel}│${rowContent}│`);
      if (i === 0) {
        console.log(midBorder);
      }
    }
    console.log(botBorder);
    if (this.alphaStar) {
      console.log('   (В ячейках: старый коэффициент, * — генеральный, в скобках [...] — новый alpha*)');
    }
  }
}

/**
 * Класс SimplexSolver осуществляет пошаговое решение
 */
class SimplexSolver {
  constructor(problem) {
    this.problem = problem;
    this.allVars = problem.allVars;
    this.integerVars = problem.integerVars || [];
    this.nonlinearCheck = problem.nonlinearCheck || null;
    this.stepCount = 0;
  }

  solve() {
    console.log('======================================================================');
    console.log(`      РЕШЕНИЕ ЗАДАЧИ ЛИНЕЙНОГО ПРОГРАММИРОВАНИЯ СИМПЛЕКС-МЕТОДОМ      `);
    console.log(`        (по методическому пособию, разд. 3.2, 3.3, 3.5.7)             `);
    console.log('======================================================================\n');
    
    if (this.problem.description) {
      console.log(this.problem.description);
      console.log('');
    }

    let currentTable = new SimplexTable({
      tableIndex: 1,
      basicVars: this.problem.basicVars,
      freeVars: this.problem.freeVars,
      matrix: this.problem.matrix
    });

    const maxIterations = 30;

    // ФАЗА 1: Решение обычной непрерывной задачи симплекс-методом (разд. 3.2)
    while (this.stepCount < maxIterations) {
      this.stepCount++;
      console.log(`----------------------------------------------------------------------`);
      console.log(`  ЭТАП ${this.stepCount}: Таблица ${currentTable.tableIndex}`);
      console.log(`----------------------------------------------------------------------\n`);

      currentTable.printAlgebraicForm();
      console.log('');

      const sol = currentTable.getSolution(this.allVars);
      const varValuesStr = Object.entries(sol.variables)
        .map(([k, v]) => `${k} = ${v.toString()}`)
        .join(', ');
      console.log(`  Базисное решение: ${varValuesStr}`);
      console.log(`  Значение целевой функции: q = ${sol.q.toString()}\n`);

      const feasible = currentTable.isFeasible();
      const optimal = currentTable.isOptimal();

      console.log(`  Анализ плана:`);
      console.log(`    - Допустимость (все alpha_i0 >= 0 при i >= 1): ${feasible ? 'ДА (допустимо)' : 'НЕТ (недопустимо)'}`);
      console.log(`    - Оптимальность (все alpha_0j >= 0 при j >= 1): ${optimal ? 'ДА (максимум)' : 'НЕТ (не оптимально)'}\n`);

      if (feasible && optimal) {
        console.log(`  План является допустимым и оптимальным для непрерывной задачи.`);
        currentTable.printTable();
        console.log('');

        // ФАЗА 2: Проверка целочисленности (раздел 3.3, метод Гомори)
        if (this.integerVars.length > 0) {
          const isInt = currentTable.isIntegerSolution(this.integerVars);
          console.log(`  Проверка целочисленности для переменных [${this.integerVars.join(', ')}]: ${isInt ? 'ВЫПОЛНЕНА' : 'НЕ ВЫПОЛНЕНА'}`);

          if (!isInt) {
            console.log(`\n======================================================================`);
            console.log(`  ПРИМЕНЕНИЕ МЕТОДА ГОМОРИ (раздел 3.3, стр. 30-31)                   `);
            console.log(`======================================================================\n`);

            // Выбор переменной с дробной частью
            let chosenRow = -1;
            let chosenVar = '';
            for (let i = 1; i <= currentTable.m; i++) {
              const varName = currentTable.basicVars[i - 1];
              if (this.integerVars.includes(varName)) {
                const val = currentTable.matrix[i][0];
                if (!val.isInteger()) {
                  chosenRow = i;
                  chosenVar = varName;
                  break;
                }
              }
            }

            console.log(`  Выбрана нецелочисленная переменная: ${chosenVar} = ${currentTable.matrix[chosenRow][0].toString()}`);
            const frac0 = currentTable.matrix[chosenRow][0].fractionalPart();
            console.log(`  Дробная часть свободного члена: {${currentTable.matrix[chosenRow][0].toString()}} = ${frac0.toString()}`);

            // Построение строки правильного отсечения Гомори (формула 8, стр. 31):
            // x_new = -{alpha_l0} - sum( {alpha_lj} * (-x''_j) )
            const newVarName = `x${this.allVars.length + 1}`;
            this.allVars.push(newVarName);

            const cutRow = [frac0.neg()];
            for (let j = 1; j <= currentTable.k; j++) {
              const frac_j = currentTable.matrix[chosenRow][j].fractionalPart();
              cutRow.push(frac_j.neg());
            }

            console.log(`  Вводится дополнительная базисная переменная ${newVarName} (правильное отсечение):`);
            console.log(`    ${newVarName} = ${cutRow[0].toString()} ` + currentTable.freeVars.map((v, idx) => `- (${cutRow[idx+1].neg().toString()})*(-${v})`).join(' '));
            console.log(`  Новый план становится недопустимым (${newVarName} = ${cutRow[0].toString()} < 0), что запускает процедуру пересчета.\n`);

            const nextMatrix = currentTable.matrix.map(row => [...row]);
            nextMatrix.push(cutRow);

            currentTable = new SimplexTable({
              tableIndex: currentTable.tableIndex + 1,
              basicVars: [...currentTable.basicVars, newVarName],
              freeVars: currentTable.freeVars,
              matrix: nextMatrix
            });

            continue;
          }
        }

        // ФАЗА 3: Проверка нелинейного ограничения (раздел 3.5.7, стр. 69–70)
        if (this.nonlinearCheck) {
          const checkRes = typeof this.nonlinearCheck === 'function'
            ? this.nonlinearCheck(sol.variables)
            : evaluateNonlinearCondition(this.nonlinearCheck, sol.variables);

          if (checkRes) {
            console.log(`  Проверка нелинейного ограничения (разд. 3.5.7, стр. 69–70):`);
            console.log(`    Условие: ${checkRes.description}`);
            if (checkRes.subFormula) {
              console.log(`    Подстановка: ${checkRes.subFormula}`);
            }
            console.log(`    Вычисление: ${checkRes.actualStr}`);
            console.log(`    Результат: ${checkRes.satisfied ? 'ВЫПОЛНЯЕТСЯ (решение допустимо)' : 'НЕ ВЫПОЛНЯЕТСЯ'}\n`);

            if (!checkRes.satisfied) {
              const newVarName = `x${this.allVars.length + 1}`;
              this.allVars.push(newVarName);

              const cutRow = [new Fraction(-1)];
              for (let j = 1; j <= currentTable.k; j++) {
                cutRow.push(new Fraction(-1));
              }

              console.log(`  Вводится правильное отсечение Данцига (разд. 3.5.7, формула 21, стр. 69):`);
              console.log(`    Сумма свободных переменных >= 1 => ${newVarName} = -1 + ` + currentTable.freeVars.join(' + ') + ' >= 0');
              console.log(`    Строка в таблице: [-1, ` + currentTable.freeVars.map(() => '-1').join(', ') + `]`);
              console.log(`  Новый план становится недопустимым (${newVarName} = -1 < 0), что запускает двойственный симплекс-метод.\n`);

              const nextMatrix = currentTable.matrix.map(row => [...row]);
              nextMatrix.push(cutRow);

              currentTable = new SimplexTable({
                tableIndex: currentTable.tableIndex + 1,
                basicVars: [...currentTable.basicVars, newVarName],
                freeVars: currentTable.freeVars,
                matrix: nextMatrix
              });
              continue;
            }
          }
        }

        console.log('======================================================================');
        console.log('                          РЕШЕНИЕ НАЙДЕНО!                            ');
        console.log('======================================================================');
        console.log(`Оптимальное решение:`);
        for (const [k, v] of Object.entries(sol.variables)) {
          if (this.problem.outputVars ? this.problem.outputVars.includes(k) : true) {
            console.log(`  ${k} = ${v.toString()}`);
          }
        }
        const isMin = (this.problem.direction || 'max') === 'min';
        const qTitle = isMin ? 'Минимальное значение' : 'Максимальное значение';
        const qLabel = isMin ? 'q_min' : 'q_max';
        const qVal = isMin ? sol.q.neg() : sol.q;
        console.log(`${qTitle} целевой функции: ${qLabel} = ${qVal.toString()}`);
        console.log('======================================================================\n');
        return sol;
      }

      // Выбор ведущих строки и столбца
      let iStar = -1;
      let jStar = -1;

      if (!feasible) {
        // Правило 2 (стр. 28): если базисное решение недопустимо, выводится базисная переменная с alpha_i0 < 0
        console.log(`  Правило 2 (стр. 28): Базисное решение недопустимо.`);
        for (let i = 1; i <= currentTable.m; i++) {
          if (currentTable.matrix[i][0].isNegative()) {
            iStar = i;
            break;
          }
        }
        const leavingVar = currentTable.basicVars[iStar - 1];
        console.log(`    Выбирается строка ${leavingVar} (alpha_${iStar}0 = ${currentTable.matrix[iStar][0].toString()} < 0).`);

        // Выбор столбца: ищем отрицательный элемент в строке iStar, чтобы новый свободный член стал положительным
        let bestCol = -1;
        let minRatio = null;

        for (let j = 1; j <= currentTable.k; j++) {
          const val = currentTable.matrix[iStar][j];
          if (val.isNegative()) {
            const objVal = currentTable.matrix[0][j];
            // Двойственный симплекс-критерий: min |alpha_0j / alpha_i*j| для сохранения неотрицательности строки q
            if (!objVal.isNegative()) {
              const r = objVal.div(val.neg());
              if (minRatio === null || r.sub(minRatio).isNegative()) {
                minRatio = r;
                bestCol = j;
              }
            } else if (bestCol === -1) {
              bestCol = j;
            }
          }
        }

        if (bestCol === -1) {
          // Если все элементы строки неотрицательны, задача не имеет допустимых решений
          console.error('Ошибка: Область допустимых решений пуста.');
          return null;
        }

        jStar = bestCol;
        const enteringVar = currentTable.freeVars[jStar - 1];
        console.log(`    В базисные переводится переменная ${enteringVar} (столбец j* = ${jStar}, alpha_${iStar}${jStar} = ${currentTable.matrix[iStar][jStar].toString()} < 0).`);
      } else {
        // Правило 1 (стр. 28): В базисные переводится свободная переменная с alpha_0j < 0
        console.log(`  Правила 1 и 3 (стр. 28):`);
        for (let j = 1; j <= currentTable.k; j++) {
          if (currentTable.matrix[0][j].isNegative()) {
            jStar = j;
            break;
          }
        }

        const enteringVar = currentTable.freeVars[jStar - 1];
        console.log(`    1. В базисные переводится свободная переменная ${enteringVar} (столбец j* = ${jStar}, alpha_0${jStar} = ${currentTable.matrix[0][jStar].toString()} < 0).`);

        // Правило 3: Выбор выходящей переменной по максимальному отношению alpha_ij* / alpha_i0
        console.log(`    3. Находим отношения коэффициентов выделенного и первого столбцов (alpha_ij* / alpha_i0):`);
        let maxRatio = null;
        const ratios = [];

        for (let i = 1; i <= currentTable.m; i++) {
          const alpha_i_jstar = currentTable.matrix[i][jStar];
          const alpha_i_0 = currentTable.matrix[i][0];

          if (alpha_i_0.isZero()) {
            ratios.push({ varName: currentTable.basicVars[i - 1], str: 'alpha_i0 = 0' });
            continue;
          }

          const ratio = alpha_i_jstar.div(alpha_i_0);
          ratios.push({ varName: currentTable.basicVars[i - 1], str: ratio.toString() });

          if (alpha_i_jstar.isPositive()) {
            if (maxRatio === null || ratio.sub(maxRatio.ratio).isPositive()) {
              maxRatio = { i, ratio };
            }
          }
        }

        for (const r of ratios) {
          console.log(`       - для переменной ${r.varName}: ${r.str}`);
        }

        if (!maxRatio) {
          console.error('Ошибка: Целевая функция не ограничена сверху.');
          return null;
        }

        iStar = maxRatio.i;
        const leavingVar = currentTable.basicVars[iStar - 1];
        console.log(`       Наибольшее положительное отношение: ${maxRatio.ratio.toString()} (строка ${leavingVar}).`);
        console.log(`       В свободные переводится базисная переменная ${leavingVar} (строка i* = ${iStar}).`);
      }

      const leavingVar = currentTable.basicVars[iStar - 1];
      const enteringVar = currentTable.freeVars[jStar - 1];
      const lambda = currentTable.matrix[iStar][jStar];

      console.log(`\n  Генеральный коэффициент:`);
      console.log(`    lambda = alpha_${iStar}${jStar} = ${lambda.toString()}\n`);

      // Вычисление промежуточных alpha* (стр. 28–29)
      const m = currentTable.m;
      const k = currentTable.k;
      const alphaStar = Array.from({ length: m + 1 }, () => Array(k + 1).fill(null));

      // Правило 1: генеральная ячейка 1 / lambda
      alphaStar[iStar][jStar] = lambda.inv();

      // Правило 2: выделенная строка alpha_i*j / lambda
      for (let j = 0; j <= k; j++) {
        if (j !== jStar) {
          alphaStar[iStar][j] = currentTable.matrix[iStar][j].div(lambda);
        }
      }

      // Правило 3: выделенный столбец -alpha_ij* / lambda
      for (let i = 0; i <= m; i++) {
        if (i !== iStar) {
          alphaStar[i][jStar] = currentTable.matrix[i][jStar].div(lambda).neg();
        }
      }

      // Правило 4: остальные ячейки alpha_i*j * alpha*_ij*
      for (let i = 0; i <= m; i++) {
        for (let j = 0; j <= k; j++) {
          if (i !== iStar && j !== jStar) {
            alphaStar[i][j] = currentTable.matrix[iStar][j].mul(alphaStar[i][jStar]);
          }
        }
      }

      currentTable.alphaStar = alphaStar;
      currentTable.pivot = { iStar, jStar, lambda };

      console.log(`  План Таблицы ${currentTable.tableIndex} с расчетными промежуточными alpha* в [ ... ] :`);
      currentTable.printTable();
      console.log('');

      // Переход к новому плану (Правила 5, 6, 7, стр. 29)
      const nextBasicVars = [...currentTable.basicVars];
      const nextFreeVars = [...currentTable.freeVars];
      nextBasicVars[iStar - 1] = enteringVar;
      nextFreeVars[jStar - 1] = leavingVar;

      const nextMatrix = Array.from({ length: m + 1 }, () => Array(k + 1).fill(null));

      for (let i = 0; i <= m; i++) {
        for (let j = 0; j <= k; j++) {
          if (i === iStar || j === jStar) {
            nextMatrix[i][j] = alphaStar[i][j];
          } else {
            nextMatrix[i][j] = currentTable.matrix[i][j].add(alphaStar[i][j]);
          }
        }
      }

      console.log(`  Переход к следующему плану:`);
      console.log(`    - Переменные ${enteringVar} и ${leavingVar} меняются местами.`);
      console.log(`    - Строка ${iStar} и столбец ${jStar} получают значения alpha*.`);
      console.log(`    - В остальные ячейки заносится сумма: alpha_ij + alpha*_ij.\n`);

      currentTable = new SimplexTable({
        tableIndex: currentTable.tableIndex + 1,
        basicVars: nextBasicVars,
        freeVars: nextFreeVars,
        matrix: nextMatrix
      });
    }

    return null;
  }
}

// ============================================================================
// Описание задач
// ============================================================================

/**
 * Вариант 39 (с предоставленного фото задания):
 * 
 *   q = x1 + 3*x2 --> max
 * 
 * Ограничения:
 *   1) x1 + 3 <= 2*x2     =>  x1 - 2*x2 <= -3   => x3 = -3 -    x1 + 2*x2 >= 0
 *   2) 8 - 0.5*x1 >= x2   =>  0.5*x1 + x2 <= 8  => x4 =  8 - 0.5*x1 -   x2 >= 0
 *   3) x2 <= 1 + x1       => -x1 + x2 <= 1      => x5 =  1 +    x1 -   x2 >= 0
 *   x1 >= 0, x2 >= 0
 * 
 * Дополнительные условия:
 *   x1, x2 — целые (раздел 3.3, метод Гомори)
 *   x2 * lg(x1) > 1 (раздел 3.5.7, нелинейное ограничение)
 */
const variant39 = {
  description: [
    'Вариант 39 (Задание с фото):',
    '  Целевая функция:  q = x1 + 3*x2  --> max',
    '  Ограничения:',
    '    x1 + 3 <= 2*x2',
    '    8 - 0.5*x1 >= x2',
    '    x2 <= 1 + x1',
    '    x1, x2 >= 0',
    '  Дополнительные условия:',
    '    x1, x2 — целые',
    '    x2 * lg(x1) > 1'
  ].join('\n'),
  allVars: ['x1', 'x2', 'x3', 'x4', 'x5'],
  integerVars: ['x1', 'x2'],
  outputVars: ['x1', 'x2', 'x3', 'x4', 'x5'],
  basicVars: ['x3', 'x4', 'x5'],
  freeVars: ['x1', 'x2'],
  // Разложение:
  //   q  =  0 - (-1)*x1 - (-3)*x2
  //   x3 = -3 - ( 1)*x1 - (-2)*x2
  //   x4 =  8 - (1/2)*x1 - ( 1)*x2
  //   x5 =  1 - (-1)*x1 - ( 1)*x2
  matrix: [
    [0, -1, -3],
    [-3, 1, -2],
    [8, '1/2', 1],
    [1, -1, 1]
  ],
  nonlinearCheck: 'x2 * lg(x1) > 1'
};

/**
 * Пример 14 из методички (стр. 22–30)
 */
const example14 = {
  description: [
    'Пример 14 из методички (стр. 22-30):',
    '  Целевая функция:  q = x1 - x2  --> max',
    '  Ограничения:',
    '    -2*x1 +    x2 + x3 = 2',
    '       x1 -  2*x2 + x4 = 2',
    '       x1 +    x2 + x5 = 5',
    '    x_i >= 0 (i = 1..5)'
  ].join('\n'),
  allVars: ['x1', 'x2', 'x3', 'x4', 'x5'],
  integerVars: [],
  outputVars: ['x1', 'x2', 'x3', 'x4', 'x5'],
  basicVars: ['x3', 'x4', 'x5'],
  freeVars: ['x1', 'x2'],
  matrix: [
    [0, -1,  1],
    [2, -2,  1],
    [2,  1, -2],
    [5,  1,  1]
  ]
};

// Запуск решения при выполнении файла
if (require.main === module) {
  const args = process.argv.slice(2);
  let problemToSolve = variant39;

  if (args.includes('--example14') || args.includes('-e14')) {
    problemToSolve = example14;
  }

  const solver = new SimplexSolver(problemToSolve);
  solver.solve();
}

module.exports = {
  Fraction,
  SimplexTable,
  SimplexSolver,
  variant39,
  example14
};
