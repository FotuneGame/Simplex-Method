/**
 * ============================================================================
 * ТПР (Теория принятия решений)
 * Ядро симплекс-метода (simplex-core.js)
 * 
 * Поддерживает:
 *  - Разд. 3.2: Симплекс-метод (алгебраический и табличный варианты, стр. 24–30)
 *  - Разд. 3.3: Метод Гомори для целочисленных задач (стр. 30–35)
 *  - Разд. 3.5.7: Проверка нелинейных ограничений (стр. 68–71)
 *  - Приведение произвольной задачи ЛП к канонической форме
 *  - Точные вычисления в обыкновенных дробях (класс Fraction)
 *  - Формирование структурированного пошагового отчета для веб-интерфейса
 * ============================================================================
 */

/**
 * Класс Fraction — точная арифметика рациональных чисел
 */
class Fraction {
  constructor(numerator, denominator = 1) {
    if (numerator instanceof Fraction) {
      this.n = numerator.n;
      this.d = numerator.d;
      return;
    }
    if (typeof numerator === 'string') {
      numerator = numerator.trim();
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
      const s = numerator.toString();
      if (s.includes('.')) {
        const dec = s.split('.')[1].length;
        const factor = Math.pow(10, Math.min(dec, 6));
        numerator = Math.round(numerator * factor);
        denominator = factor;
      }
    }

    if (isNaN(numerator) || isNaN(denominator)) {
      throw new Error('Некорректное число в дроби: ' + numerator + '/' + denominator);
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
   * Дробная часть числа {alpha} = alpha - [alpha] (формула 8, стр. 31)
   */
  fractionalPart() {
    const floorVal = Math.floor(this.n / this.d);
    return this.sub(new Fraction(floorVal, 1));
  }

  toString() {
    if (this.d === 1) return String(this.n);
    return `${this.n}/${this.d}`;
  }

  toHtml() {
    if (this.d === 1) return String(this.n);
    if (this.n < 0) {
      return `&minus;<sup>${Math.abs(this.n)}</sup>&frasl;<sub>${this.d}</sub>`;
    }
    return `<sup>${this.n}</sup>&frasl;<sub>${this.d}</sub>`;
  }
}

const F = (n, d = 1) => new Fraction(n, d);

/**
 * Функция вычисления и проверки нелинейного условия (разд. 3.5.7)
 * Поддерживает:
 *  - Одиночные и двойные неравенства (<=, >=, <, >, ==, !=, =)
 *  - Переменные x1, x2, ... (включая русскую букву 'х')
 *  - Неявное умножение: 2x1, x2 sin x1, x2 lg x1, x1 x2, x2(x1)
 *  - Тригонометрические функции: sin, cos, tg, tan, ctg, cot
 *  - Обратные тригонометрические: arcsin, arccos, arctg, arcctg, asin, acos, atan, acot
 *  - Гиперболические функции: sh, ch, th, cth, sinh, cosh, tanh, coth
 *  - Константы: pi, π, пи, e, градусы (например: sin(30°))
 *  - Алгебраические функции: lg (по основанию 10), log10, log, ln, sqrt, abs, ^ (степень)
 */
function evaluateNonlinearCondition(cond, vars) {
  if (!cond) return null;

  if (typeof cond === 'function') {
    try {
      const res = cond(vars);
      return {
        description: res.description || 'Нелинейное условие',
        subFormula: res.subFormula || res.description || '',
        actualStr: res.actualStr || '',
        satisfied: Boolean(res.satisfied),
        error: null
      };
    } catch (e) {
      return {
        description: 'Пользовательская функция',
        subFormula: '',
        actualStr: e.message,
        satisfied: false,
        error: e.message
      };
    }
  }

  const rawStr = String(cond).trim();
  if (!rawStr) return null;

  // 1. Нормализация символов (включая русскую раскладку 'х'/'Х')
  let s = rawStr
    .replace(/\u0445/g, 'x')
    .replace(/\u0425/g, 'x')
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .replace(/≠/g, '!=')
    .replace(/·/g, '*')
    .replace(/×/g, '*');

  const opsRegex = /(<=|>=|!=|==|<|>|=)/g;
  const matches = [...s.matchAll(opsRegex)];

  let checks = [];
  if (matches.length === 2) {
    const op1 = matches[0][0];
    const op2 = matches[1][0];
    const idx1 = matches[0].index;
    const idx2 = matches[1].index;
    const partA = s.substring(0, idx1).trim();
    const partB = s.substring(idx1 + op1.length, idx2).trim();
    const partC = s.substring(idx2 + op2.length).trim();
    checks.push({ lhs: partA, op: op1, rhs: partB });
    checks.push({ lhs: partB, op: op2, rhs: partC });
  } else if (matches.length === 1) {
    const op = matches[0][0];
    const idx = matches[0].index;
    const partA = s.substring(0, idx).trim();
    const partB = s.substring(idx + op.length).trim();
    checks.push({ lhs: partA, op: op, rhs: partB });
  } else {
    checks.push({ lhs: s, op: '>', rhs: '0' });
  }

  // Список всех поддерживаемых функций
  const fnList = [
    'arcsin', 'arccos', 'arctg', 'arctan', 'arcctg', 'arccot', 'asin', 'acos', 'atan', 'acot',
    'sinh', 'cosh', 'tanh', 'coth', 'sh', 'ch', 'th', 'cth',
    'sin', 'cos', 'tg', 'tan', 'ctg', 'cot',
    'lg', 'log10', 'log', 'ln', 'sqrt', 'abs'
  ];
  const fnPattern = fnList.join('|');

  function transformMath(expr) {
    let t = expr.replace(/\^/g, '**');

    // Градусы: 30° -> (30 * Math.PI / 180)
    t = t.replace(/(\d+(?:\.\d+)?)\s*°/g, '($1 * Math.PI / 180)');

    // Константа пи
    t = t.replace(/π/g, ' Math.PI ');
    t = t.replace(/(?<![а-яА-ЯёЁa-zA-Z0-9_])пи(?![а-яА-ЯёЁa-zA-Z0-9_])/gi, ' Math.PI ');

    // Вызовы функций без скобок: sin x1 -> sin(x1), tg x2 -> tg(x2), lg x1 -> lg(x1)
    const noParenRegex = new RegExp('\\b(' + fnPattern + ')\\s+([a-zA-Z0-9_.]+)', 'gi');
    t = t.replace(noParenRegex, '$1($2)');

    // Число перед переменной или функцией: 2x1 -> 2 * x1, 2sin(...) -> 2 * sin(...)
    t = t.replace(/(\d+)\s*([a-zA-Z_])/g, '$1 * $2');

    // Неявное умножение: x2 sin(...) -> x2 * sin(...)
    const fnFollowRegex = new RegExp('([a-zA-Z0-9_]+)\\s+(' + fnPattern + ')\\b', 'gi');
    t = t.replace(fnFollowRegex, '$1 * $2');

    // Неявное умножение скобок: (x1)(x2) -> (x1) * (x2), x2(x1) -> x2 * (x1)
    t = t.replace(/(\))\s*(\()/g, '$1 * $2');
    t = t.replace(/([a-zA-Z0-9_]+)\s*\(/g, (m, p1) => {
      if (new RegExp('^(' + fnPattern + '|Math)$', 'i').test(p1)) return m;
      return p1 + ' * (';
    });

    // Неявное умножение переменных: x1 x2 -> x1 * x2
    t = t.replace(/([a-zA-Z0-9_]+)\s+([a-zA-Z_][a-zA-Z0-9_]*)/g, (m, p1, p2) => {
      if (new RegExp('^(' + fnPattern + '|Math|PI|E|pi|e)$', 'i').test(p2)) return m;
      return p1 + ' * ' + p2;
    });

    return t;
  }

  function evalSide(expr) {
    const jsCode = transformMath(expr);

    // Математическая среда с тригонометрическими и логарифмическими функциями
    const mathScope = {
      sin: (x) => Math.sin(x),
      cos: (x) => Math.cos(x),
      tan: (x) => Math.tan(x),
      tg: (x) => Math.tan(x),
      cot: (x) => 1 / Math.tan(x),
      ctg: (x) => 1 / Math.tan(x),
      asin: (x) => Math.asin(x),
      arcsin: (x) => Math.asin(x),
      acos: (x) => Math.acos(x),
      arccos: (x) => Math.acos(x),
      atan: (x) => Math.atan(x),
      arctg: (x) => Math.atan(x),
      arctan: (x) => Math.atan(x),
      acot: (x) => Math.PI / 2 - Math.atan(x),
      arcctg: (x) => Math.PI / 2 - Math.atan(x),
      arccot: (x) => Math.PI / 2 - Math.atan(x),
      sinh: (x) => Math.sinh(x),
      sh: (x) => Math.sinh(x),
      cosh: (x) => Math.cosh(x),
      ch: (x) => Math.cosh(x),
      tanh: (x) => Math.tanh(x),
      th: (x) => Math.tanh(x),
      coth: (x) => 1 / Math.tanh(x),
      cth: (x) => 1 / Math.tanh(x),
      lg: (x) => Math.log10(x),
      log10: (x) => Math.log10(x),
      log: (x) => Math.log10(x),
      ln: (x) => Math.log(x),
      sqrt: (x) => Math.sqrt(x),
      abs: (x) => Math.abs(x),
      pi: Math.PI,
      PI: Math.PI,
      e: Math.E,
      E: Math.E
    };

    const scopeNames = Object.keys(mathScope);
    const scopeVals = Object.values(mathScope);

    const varNames = Object.keys(vars);
    const varVals = varNames.map(k => {
      const v = vars[k];
      return (v && typeof v.toNumber === 'function') ? v.toNumber() : Number(v);
    });

    try {
      const fn = new Function(...scopeNames, ...varNames, 'return (' + jsCode + ');');
      const res = fn(...scopeVals, ...varVals);
      if (isNaN(res)) throw new Error('Результат не является числом (NaN)');
      return res;
    } catch (err) {
      throw new Error(`Ошибка вычисления "${expr}": ${err.message}`);
    }
  }

  function formatSubstitution(expr) {
    let t = expr
      .replace(/\u0445/g, 'x')
      .replace(/\u0425/g, 'x')
      .replace(/\*/g, '·')
      .replace(/×/g, '·');

    t = t.replace(/(\d+)\s*([a-zA-Z_])/g, '$1·$2');

    const sortedVars = Object.keys(vars).sort((a, b) => b.length - a.length);
    for (const v of sortedVars) {
      const val = vars[v];
      const num = (val && typeof val.toNumber === 'function') ? val.toString() : String(val);
      const re = new RegExp('\\b' + v + '\\b', 'g');
      t = t.replace(re, num);
    }
    return t;
  }

  try {
    let allSatisfied = true;
    let compParts = [];

    for (const c of checks) {
      const leftVal = evalSide(c.lhs);
      const rightVal = evalSide(c.rhs);

      let opNorm = c.op === '=' ? '==' : c.op;
      let sat = false;
      switch (opNorm) {
        case '>': sat = leftVal > rightVal + 1e-9; break;
        case '<': sat = leftVal < rightVal - 1e-9; break;
        case '>=': sat = leftVal >= rightVal - 1e-9; break;
        case '<=': sat = leftVal <= rightVal + 1e-9; break;
        case '==': sat = Math.abs(leftVal - rightVal) < 1e-9; break;
        case '!=': sat = Math.abs(leftVal - rightVal) >= 1e-9; break;
      }

      if (!sat) allSatisfied = false;

      const leftNumStr = Number.isInteger(leftVal) ? leftVal.toString() : leftVal.toFixed(4);
      const rightNumStr = Number.isInteger(rightVal) ? rightVal.toString() : rightVal.toFixed(4);
      compParts.push(`${leftNumStr} ${c.op} ${rightNumStr}`);
    }

    const subFormula = formatSubstitution(rawStr);
    const actualStr = compParts.join(' и ');

    return {
      description: rawStr,
      subFormula,
      actualStr,
      satisfied: allSatisfied,
      error: null
    };
  } catch (err) {
    return {
      description: rawStr,
      subFormula: formatSubstitution(rawStr),
      actualStr: err.message,
      satisfied: false,
      error: err.message
    };
  }
}

/**
 * Класс SimplexTable
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

  isFeasible() {
    for (let i = 1; i <= this.m; i++) {
      if (this.matrix[i][0].isNegative()) return false;
    }
    return true;
  }

  isOptimal() {
    for (let j = 1; j <= this.k; j++) {
      if (this.matrix[0][j].isNegative()) return false;
    }
    return true;
  }

  isIntegerSolution(varNames) {
    const sol = this.getSolution(varNames);
    for (const name of varNames) {
      if (!sol.variables[name].isInteger()) return false;
    }
    return true;
  }

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

  getAlgebraicEquations() {
    const eqList = [];
    const formatExpression = (rowIdx) => {
      let terms = [];
      const freeTerm = this.matrix[rowIdx][0];
      if (!freeTerm.isZero() || this.k === 0) {
        terms.push(freeTerm.toString());
      }
      for (let j = 1; j <= this.k; j++) {
        const coeff = this.matrix[rowIdx][j].neg();
        if (coeff.isZero()) continue;

        const varName = this.freeVars[j - 1];
        let termStr = '';
        if (coeff.toNumber() === 1) {
          termStr = (terms.length > 0 ? '+ ' : '') + varName;
        } else if (coeff.toNumber() === -1) {
          termStr = '- ' + varName;
        } else if (coeff.isPositive()) {
          termStr = (terms.length > 0 ? '+ ' : '') + coeff.toString() + '·' + varName;
        } else {
          termStr = '- ' + coeff.neg().toString() + '·' + varName;
        }
        terms.push(termStr);
      }
      return terms.length > 0 ? terms.join(' ') : '0';
    };

    eqList.push({ name: 'q', expr: formatExpression(0) });
    for (let i = 1; i <= this.m; i++) {
      eqList.push({ name: this.basicVars[i - 1], expr: formatExpression(i) });
    }
    return eqList;
  }
}

/**
 * Класс SimplexSolver
 */
class SimplexSolver {
  constructor(problem) {
    this.problem = problem;
    this.allVars = [...problem.allVars];
    this.integerVars = problem.integerVars ? [...problem.integerVars] : [];
    this.nonlinearCheck = problem.nonlinearCheck || null;
    this.direction = problem.direction || 'max';
    this.origObjective = problem.origObjective || null;
    this.stepCount = 0;
    this.stepsHistory = [];
  }

  computeRealQ(solution) {
    if (this.origObjective) {
      let sum = new Fraction(0);
      for (let j = 0; j < this.origObjective.length; j++) {
        const c = new Fraction(this.origObjective[j]);
        const x = solution.variables[`x${j + 1}`] || new Fraction(0);
        sum = sum.add(c.mul(x));
      }
      return sum;
    }
    return this.direction === 'min' ? solution.q.neg() : solution.q;
  }

  solve() {
    let currentTable = new SimplexTable({
      tableIndex: 1,
      basicVars: this.problem.basicVars,
      freeVars: this.problem.freeVars,
      matrix: this.problem.matrix
    });

    const maxIterations = 35;

    while (this.stepCount < maxIterations) {
      this.stepCount++;
      const rawSolution = currentTable.getSolution(this.allVars);
      const realQ = this.computeRealQ(rawSolution);

      const currentStepRecord = {
        stepNumber: this.stepCount,
        tableIndex: currentTable.tableIndex,
        basicVars: [...currentTable.basicVars],
        freeVars: [...currentTable.freeVars],
        matrix: currentTable.matrix.map(r => r.map(c => new Fraction(c))),
        algebraicEquations: currentTable.getAlgebraicEquations(),
        solution: rawSolution,
        realQ,
        direction: this.direction,
        isFeasible: currentTable.isFeasible(),
        isOptimal: currentTable.isOptimal(),
        isFinal: false
      };

      // Проверка допустимости и оптимальности
      if (currentStepRecord.isFeasible && currentStepRecord.isOptimal) {
        // Проверка целочисленности (раздел 3.3, метод Гомори)
        if (this.integerVars.length > 0 && !currentTable.isIntegerSolution(this.integerVars)) {
          // Ищем переменную с дробной частью
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

          const frac0 = currentTable.matrix[chosenRow][0].fractionalPart();
          const newVarName = `x${this.allVars.length + 1}`;
          this.allVars.push(newVarName);

          const cutRow = [frac0.neg()];
          const fracRowDetails = [{ varName: 'Свободный член', frac: frac0, str: `{${currentTable.matrix[chosenRow][0]}} = ${frac0}` }];

          for (let j = 1; j <= currentTable.k; j++) {
            const fj = currentTable.matrix[chosenRow][j].fractionalPart();
            cutRow.push(fj.neg());
            fracRowDetails.push({ varName: `Коэфф. при (-${currentTable.freeVars[j-1]})`, frac: fj, str: `{${currentTable.matrix[chosenRow][j]}} = ${fj}` });
          }

          currentStepRecord.gomoryCut = {
            chosenVar,
            valStr: currentTable.matrix[chosenRow][0].toString(),
            frac0: frac0.toString(),
            newVarName,
            fracRowDetails,
            cutRowStr: `${newVarName} = ${cutRow[0].toString()} ` + currentTable.freeVars.map((v, idx) => `- (${cutRow[idx+1].neg().toString()})·(-${v})`).join(' ')
          };

          this.stepsHistory.push(currentStepRecord);

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

        // Проверка нелинейного условия (разд. 3.5.7, стр. 69–70)
        if (this.nonlinearCheck) {
          const checkRes = evaluateNonlinearCondition(this.nonlinearCheck, currentStepRecord.solution.variables);
          if (checkRes) {
            currentStepRecord.nonlinearResult = checkRes;

            if (!checkRes.satisfied) {
              // Условие не выполняется -> отсечение Данцига (формула 21, стр. 69)
              const newVarName = `x${this.allVars.length + 1}`;
              this.allVars.push(newVarName);

              // Строка Данцига: все элементы равны -1 (свободный член -1 и коэффициенты при -x''_j равны -1)
              const cutRow = [new Fraction(-1)];
              for (let j = 1; j <= currentTable.k; j++) {
                cutRow.push(new Fraction(-1));
              }

              currentStepRecord.dantzigCut = {
                newVarName,
                description: checkRes.description,
                subFormula: checkRes.subFormula,
                actualStr: checkRes.actualStr,
                freeVars: [...currentTable.freeVars],
                cutRowStr: `${newVarName} = -1 + ` + currentTable.freeVars.join(' + ') + ' >= 0',
                explanation: `Нелинейное ограничение "${checkRes.description}" не выполняется (${checkRes.subFormula || checkRes.description} ➔ ${checkRes.actualStr}). По разд. 3.5.7 (стр. 69–70) вводится правильное отсечение Данцига: ${newVarName} = -1 + ` + currentTable.freeVars.join(' + ') + ` &ge; 0 (в таблице строка [-1, -1, ..., -1]).`
              };

              this.stepsHistory.push(currentStepRecord);

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

        currentStepRecord.isFinal = true;
        this.stepsHistory.push(currentStepRecord);

        return {
          status: 'optimal',
          direction: this.direction,
          steps: this.stepsHistory,
          solution: currentStepRecord.solution,
          q: currentStepRecord.realQ,
          qCanon: currentStepRecord.solution.q,
          nonlinearResult: currentStepRecord.nonlinearResult || null
        };
      }

      // Выбор ведущих строки и столбца
      let iStar = -1;
      let jStar = -1;
      let ruleExplanation = '';
      const ratios = [];

      if (!currentStepRecord.isFeasible) {
        // Правило 2 (стр. 28)
        for (let i = 1; i <= currentTable.m; i++) {
          if (currentTable.matrix[i][0].isNegative()) {
            iStar = i;
            break;
          }
        }
        const leavingVar = currentTable.basicVars[iStar - 1];

        // Поиск отрицательного элемента в строке iStar
        let bestCol = -1;
        let minRatio = null;

        for (let j = 1; j <= currentTable.k; j++) {
          const val = currentTable.matrix[iStar][j];
          if (val.isNegative()) {
            const objVal = currentTable.matrix[0][j];
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
          currentStepRecord.error = 'Область допустимых решений пуста.';
          this.stepsHistory.push(currentStepRecord);
          return { status: 'infeasible', steps: this.stepsHistory };
        }

        jStar = bestCol;
        const enteringVar = currentTable.freeVars[jStar - 1];
        ruleExplanation = `План недопустим (свободный член строки ${leavingVar} равен ${currentTable.matrix[iStar][0]} < 0). По Правилу 2 (стр. 28) в свободные переводится переменная ${leavingVar}. В базис переводится переменная ${enteringVar} (коэффициент ${currentTable.matrix[iStar][jStar]} < 0).`;
      } else {
        // Правило 1 (стр. 28)
        for (let j = 1; j <= currentTable.k; j++) {
          if (currentTable.matrix[0][j].isNegative()) {
            jStar = j;
            break;
          }
        }
        const enteringVar = currentTable.freeVars[jStar - 1];

        // Правило 3 (стр. 28): максимум отношения alpha_ij* / alpha_i0
        let maxRatio = null;
        for (let i = 1; i <= currentTable.m; i++) {
          const alpha_i_jstar = currentTable.matrix[i][jStar];
          const alpha_i_0 = currentTable.matrix[i][0];

          if (alpha_i_0.isZero()) {
            ratios.push({ i, varName: currentTable.basicVars[i - 1], ratio: null, str: 'alpha_i0 = 0', isMax: false });
            continue;
          }

          const ratio = alpha_i_jstar.div(alpha_i_0);
          const item = { i, varName: currentTable.basicVars[i - 1], ratio, str: ratio.toString(), isMax: false };

          if (alpha_i_jstar.isPositive()) {
            if (maxRatio === null || ratio.sub(maxRatio.ratio).isPositive()) {
              maxRatio = { i, ratio };
            }
          }
          ratios.push(item);
        }

        if (!maxRatio) {
          currentStepRecord.error = 'Целевая функция не ограничена сверху.';
          this.stepsHistory.push(currentStepRecord);
          return { status: 'unbounded', steps: this.stepsHistory };
        }

        iStar = maxRatio.i;
        for (const r of ratios) {
          if (r.i === iStar) r.isMax = true;
        }

        const leavingVar = currentTable.basicVars[iStar - 1];
        ruleExplanation = `В базис переводится переменная ${enteringVar} (столбец j* = ${jStar}, alpha_0${jStar} = ${currentTable.matrix[0][jStar]} < 0). По Правилу 3 (стр. 28) в свободные переводится переменная ${leavingVar} с наибольшим отношением alpha_ij* / alpha_i0 = ${maxRatio.ratio}.`;
      }

      const leavingVar = currentTable.basicVars[iStar - 1];
      const enteringVar = currentTable.freeVars[jStar - 1];
      const lambda = currentTable.matrix[iStar][jStar];

      // Вычисление промежуточных alpha* (стр. 28–29)
      const m = currentTable.m;
      const k = currentTable.k;
      const alphaStar = Array.from({ length: m + 1 }, () => Array(k + 1).fill(null));

      alphaStar[iStar][jStar] = lambda.inv();
      for (let j = 0; j <= k; j++) {
        if (j !== jStar) {
          alphaStar[iStar][j] = currentTable.matrix[iStar][j].div(lambda);
        }
      }
      for (let i = 0; i <= m; i++) {
        if (i !== iStar) {
          alphaStar[i][jStar] = currentTable.matrix[i][jStar].div(lambda).neg();
        }
      }
      for (let i = 0; i <= m; i++) {
        for (let j = 0; j <= k; j++) {
          if (i !== iStar && j !== jStar) {
            alphaStar[i][j] = currentTable.matrix[iStar][j].mul(alphaStar[i][jStar]);
          }
        }
      }

      currentTable.alphaStar = alphaStar;
      currentTable.pivot = { iStar, jStar, lambda };

      currentStepRecord.pivot = { iStar, jStar, lambda: lambda.toString(), leavingVar, enteringVar };
      currentStepRecord.alphaStar = alphaStar.map(r => r.map(c => new Fraction(c)));
      currentStepRecord.ruleExplanation = ruleExplanation;
      currentStepRecord.ratios = ratios;

      this.stepsHistory.push(currentStepRecord);

      // Формирование новой таблицы
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

      currentTable = new SimplexTable({
        tableIndex: currentTable.tableIndex + 1,
        basicVars: nextBasicVars,
        freeVars: nextFreeVars,
        matrix: nextMatrix
      });
    }

    return { status: 'max_iterations', steps: this.stepsHistory };
  }
}

/**
 * Функция канонизации любой пользовательской задачи ЛП
 */
function canonicalizeProblem({ objective, direction = 'max', constraints, integerVars = [], nonlinearCheck = null }) {
  // objective: [c1, c2, ...]
  // direction: 'max' | 'min'
  // constraints: [{ coeffs: [a1, a2, ...], op: '<=' | '>=' | '=', rhs: b }]
  const numVars = objective.length;
  const origVarNames = Array.from({ length: numVars }, (_, i) => `x${i + 1}`);

  const sign = direction === 'min' ? -1 : 1;
  const qRow = [new Fraction(0)];
  for (let j = 0; j < numVars; j++) {
    // q = alpha_00 - sum(alpha_0j * x''_j) => alpha_0j = -sign * c_j
    qRow.push(new Fraction(objective[j]).mul(sign).neg());
  }

  const matrix = [qRow];
  const basicVars = [];
  let slackCount = numVars;

  for (const c of constraints) {
    if (c.op === '<=') {
      slackCount++;
      const sName = `x${slackCount}`;
      basicVars.push(sName);
      // sum a_i x_i <= b => x_slack = b - sum a_i x_i => alpha_0 = b, alpha_j = a_j
      const row = [new Fraction(c.rhs)];
      for (let j = 0; j < numVars; j++) {
        row.push(new Fraction(c.coeffs[j]));
      }
      matrix.push(row);
    } else if (c.op === '>=') {
      slackCount++;
      const sName = `x${slackCount}`;
      basicVars.push(sName);
      // sum a_i x_i >= b => x_slack = -b + sum a_i x_i => alpha_0 = -b, alpha_j = -a_j
      const row = [new Fraction(c.rhs).neg()];
      for (let j = 0; j < numVars; j++) {
        row.push(new Fraction(c.coeffs[j]).neg());
      }
      matrix.push(row);
    } else if (c.op === '=') {
      // Равенство разбиваем на <= и >=
      slackCount++;
      const s1 = `x${slackCount}`;
      basicVars.push(s1);
      const row1 = [new Fraction(c.rhs)];
      for (let j = 0; j < numVars; j++) row1.push(new Fraction(c.coeffs[j]));
      matrix.push(row1);

      slackCount++;
      const s2 = `x${slackCount}`;
      basicVars.push(s2);
      const row2 = [new Fraction(c.rhs).neg()];
      for (let j = 0; j < numVars; j++) row2.push(new Fraction(c.coeffs[j]).neg());
      matrix.push(row2);
    }
  }

  return {
    allVars: [...origVarNames, ...basicVars],
    basicVars,
    freeVars: origVarNames,
    matrix,
    integerVars: integerVars || [],
    direction,
    origObjective: [...objective],
    nonlinearCheck
  };
}

// Предустановленные примеры для мгновенной загрузки
const PRESETS = {
  variant39: {
    name: 'Вариант 39 (Задание с фото)',
    direction: 'max',
    objective: [1, 3],
    constraints: [
      { coeffs: [1, -2], op: '<=', rhs: -3 }, // x1 - 2x2 <= -3
      { coeffs: [0.5, 1], op: '<=', rhs: 8 }, // 0.5x1 + x2 <= 8
      { coeffs: [-1, 1], op: '<=', rhs: 1 }   // -x1 + x2 <= 1
    ],
    integerVars: ['x1', 'x2'],
    nonlinearCheck: 'x2 * lg(x1) > 1'
  },
  example14: {
    name: 'Пример 14 (из методички, стр. 22-30)',
    direction: 'max',
    objective: [1, -1],
    constraints: [
      { coeffs: [-2, 1], op: '<=', rhs: 2 },  // -2x1 + x2 <= 2
      { coeffs: [1, -2], op: '<=', rhs: 2 },  // x1 - 2x2 <= 2
      { coeffs: [1, 1], op: '<=', rhs: 5 }    // x1 + x2 <= 5
    ],
    integerVars: []
  },
  example15: {
    name: 'Пример 15 (Метод Гомори, стр. 31-34)',
    direction: 'max',
    objective: [-1, -1],
    constraints: [
      { coeffs: [1, 5], op: '>=', rhs: 12 },  // x1 + 5x2 >= 12
      { coeffs: [1, 3], op: '>=', rhs: 15 }   // x1 + 3x2 >= 15
    ],
    integerVars: ['x1', 'x2']
  },
  example19: {
    name: 'Пример 19 (Данциг, стр. 70)',
    direction: 'max',
    objective: [-1, -1],
    constraints: [
      { coeffs: [1, 5], op: '>=', rhs: 12 },  // x1 + 5x2 >= 12
      { coeffs: [1, 3], op: '>=', rhs: 15 }   // x1 + 3x2 >= 15
    ],
    integerVars: ['x1', 'x2'],
    nonlinearCheck: '0.5 <= x2 / x1 <= 2'
  }
};

// Экспорт для Node.js и браузера
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    Fraction,
    evaluateNonlinearCondition,
    SimplexTable,
    SimplexSolver,
    canonicalizeProblem,
    PRESETS
  };
} else if (typeof window !== 'undefined') {
  window.Fraction = Fraction;
  window.evaluateNonlinearCondition = evaluateNonlinearCondition;
  window.SimplexTable = SimplexTable;
  window.SimplexSolver = SimplexSolver;
  window.canonicalizeProblem = canonicalizeProblem;
  window.PRESETS = PRESETS;
}
