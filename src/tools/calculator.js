import * as math from 'mathjs';

// At module level
let memory = 0;
let previousResult = 0;

/**
 * Calculator tool that evaluates mathematical expressions using mathjs
 * @param {string} expression - The mathematical expression to evaluate
 * @returns {string} The result of the calculation
 */
function calculatorTool(expression) {
  try {
    // Clean the expression
    const cleanExpression = expression.trim();

    // Handle special cases
    let processedExpression = cleanExpression;

    // Handle memory operations
    if (processedExpression === 'MS' || processedExpression === 'memory store') {
      memory = previousResult;
      return `Value ${memory} stored in memory`;
    }

    if (processedExpression === 'MR' || processedExpression === 'memory recall') {
      return memory.toString();
    }

    if (processedExpression === 'MC' || processedExpression === 'memory clear') {
      memory = 0;
      return 'Memory cleared';
    }

    // Replace "sine of X degrees" with sin(X deg)
    if (processedExpression.match(/sine of (\d+) degrees/i)) {
      processedExpression = processedExpression.replace(
        /sine of (\d+) degrees/i,
        'sin($1 deg)'
      );
    }

    // Handle natural language expressions
    if (processedExpression.match(/^(calculate|compute|evaluate|what is|find|solve)\s+/i)) {
      processedExpression = processedExpression.replace(
        /^(calculate|compute|evaluate|what is|find|solve)\s+/i,
        ''
      );
    }

    // Handle more mathematical phrases
    const mathTerms = {
      'square root of': 'sqrt',
      'cube root of': 'cbrt',
      'log base (\\d+) of (\\d+)': 'log($2, $1)',
      'factorial of': 'factorial',
      'percent of': '* 0.01 *',
      'to the power of': '^'
    };

    // Process each pattern
    Object.entries(mathTerms).forEach(([pattern, replacement]) => {
      const regex = new RegExp(pattern, 'i');
      if (regex.test(processedExpression)) {
        // Special handling for functions that need parentheses around the number
        if (replacement === 'sqrt' || replacement === 'cbrt' || replacement === 'factorial') {
          const numberMatch = processedExpression.match(new RegExp(`${pattern}\\s*(\\d+)`, 'i'));
          if (numberMatch && numberMatch[1]) {
            processedExpression = processedExpression.replace(
              new RegExp(`${pattern}\\s*(\\d+)`, 'i'),
              `${replacement}(${numberMatch[1]})`
            );
          }
        } else {
           processedExpression = processedExpression.replace(
            new RegExp(pattern, 'i'),
            replacement
          );
        }
      }
    });

    // Handle unit conversions
    if (processedExpression.match(/convert\s+([\d.]+)\s+(\w+)\s+to\s+(\w+)/i)) {
      const match = processedExpression.match(/convert\s+([\d.]+)\s+(\w+)\s+to\s+(\w+)/i);
      processedExpression = `${match[1]} ${match[2]} to ${match[3]}`;
    }

    // Handle rounding requests
    const roundingMatch = processedExpression.match(/round\s+([\d.]+)\s+to\s+(\d+)\s+decimal places/i);
    if (roundingMatch) {
      const number = parseFloat(roundingMatch[1]);
      const places = parseInt(roundingMatch[2]);
      return (Math.round(number * Math.pow(10, places)) / Math.pow(10, places)).toString();
    }

    // Evaluate the expression using mathjs
    const result = math.evaluate(processedExpression);

    // Store the result for potential memory storage
    previousResult = result;

    // Handle different result types
    if (math.typeOf(result) === 'Complex') {
      return `${result.toString()}`;
    } else if (math.typeOf(result) === 'BigNumber') {
      return result.toString();
    } else if (Array.isArray(result)) {
      return JSON.stringify(result);
    } else if (typeof result === 'object') {
      return JSON.stringify(result);
    }

    // Handle floating-point precision issues for trigonometric functions
    if (processedExpression.includes('sin') ||
        processedExpression.includes('cos') ||
        processedExpression.includes('tan') ||
        cleanExpression.includes('sine of')) {
      // Round to 10 decimal places to avoid floating-point precision issues
      const roundedResult = Math.round(result * 1e10) / 1e10;
      // Special case for common values
      if (Math.abs(roundedResult - 0.5) < 1e-10) return '0.5';
      if (Math.abs(roundedResult - 1) < 1e-10) return '1';
      if (Math.abs(roundedResult - 0) < 1e-10) return '0';
      return roundedResult.toString();
    }

    return result.toString();
  } catch (error) {
    // Provide more helpful error messages with suggestions
    if (error.message.includes('Undefined symbol')) {
      const symbolMatch = error.message.match(/Undefined symbol\s+(\w+)/);
      const symbol = symbolMatch ? symbolMatch[1] : "unknown";
      return `Error: '${symbol}' is not recognized. Did you mean to use a supported function like sin(), cos(), sqrt()?`;
    } else if (error.message.includes('Unexpected token')) {
      return `Error: Your expression has syntax errors. Please check for missing parentheses or operators.`;
    }
    return `Calculator error: ${error.message}`;
  }
}

/**
 * Provides metadata about the calculator tool for LLM agent integration
 * @returns {Object} Tool description in JSON schema format
 */
function describeCalculatorTool() {
  return {
    name: "calculator",
    description: "Evaluates mathematical expressions and performs calculations including basic arithmetic, trigonometric functions, unit conversions, and memory operations.",
    usage: "Use by writing [TOOL: calculator(your expression here)]",
    parameters: {
      type: "object",
      properties: {
        expression: {
          type: "string",
          description: "The mathematical expression to evaluate. Can be a formula (e.g. '2+2', 'sin(30 deg)') or natural language (e.g. 'square root of 16', 'convert 5 km to miles')."
        }
      },
      required: ["expression"]
    },
    examples: [
      {
        description: "Calculate departure times",
        usage: "[TOOL: calculator(activity_time - (travel_minutes + buffer_minutes)/60)]",
        output: "Result will be the departure time in hours"
      },
      {
        description: "Calculate travel durations",
        usage: "[TOOL: calculator(distance_km / average_speed_kmh)]",
        output: "Result will be the travel time in hours"
      },
      {
        description: "Calculate total costs",
        usage: "[TOOL: calculator(nights * price_per_night)]",
        output: "Result will be the total accommodation cost"
      },
      {
        description: "Calculate percentage savings",
        usage: "[TOOL: calculator((original_price - discounted_price) / original_price * 100)]",
        output: "Result will be the percentage saved"
      }
    ],
    capabilities: [
      "Basic arithmetic (addition, subtraction, multiplication, division)",
      "Trigonometric functions (sin, cos, tan, etc.)",
      "Natural language processing for mathematical phrases",
      "Unit conversions (e.g., km to miles, inches to cm)",
      "Memory functions (MS, MR, MC) for storing and recalling values",
      "Rounding to specific decimal places"
    ]
  };
}

// Export both functions
export { calculatorTool, describeCalculatorTool };
