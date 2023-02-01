function splitOnce(command: string, sep: string[] = [" "], crlf: boolean = true): [string, string] {
  let result: string[] = [];
  let buffer: string[] = [];
  let quote: string | null = null;
  let escape = false;
  for (let i = 0; i < command.length; i++) {
    let char = command[i];
    if (escape) {
      escape = false;
      buffer.push(char);
    } else if (char === "\\") {
      escape = true;
    } else if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        buffer.push(char);
      }
    } else if (char === "'" || char === '"' || char === "`" || char === "“" || char === "”") {
      quote = char;
    } else if (sep.includes(char)) {
      if (buffer.length > 0) {
        result.push(buffer.join(""));
        buffer = [];
      }
      return [result.join(" "), command.substring(i + 1)];
    } else if (crlf && (char === "\r" || char === "\n")) {
      if (buffer.length > 0) {
        result.push(buffer.join(""));
        buffer = [];
      }
      return [result.join(" "), command.substring(i + 1)];
    } else {
      buffer.push(char);
    }
  }
  if (buffer.length > 0) {
    result.push(buffer.join(""));
  }
  return [result.join(" "), ""];
}


function split(command: string, sep: string[] = [" "], crlf: boolean = true): string[] {
  let result: string[] = [];
  let buffer: string[] = [];
  let quote: string | null = null;
  let escape = false;
  for (let i = 0; i < command.length; i++) {
    let char = command[i];
    if (escape) {
      escape = false;
      buffer.push(char);
    } else if (char === "\\") {
      escape = true;
    } else if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        buffer.push(char);
      }
    } else if (char === "'" || char === '"' || char === "`" || char === "“" || char === "”") {
      quote = char;
    } else if (sep.includes(char) || (crlf && (char === "\r" || char === "\n"))) {
      if (buffer.length > 0) {
        result.push(buffer.join(""));
        buffer = [];
      }
    } else {
      buffer.push(char);
    }
  }
  if (buffer.length > 0) {
    result.push(buffer.join(""));
  }
  return result;
}

function levenshtein_norm(source: string, target: string): number {
  let distance = levenshtein(source, target);
  return 1 - distance / Math.max(source.length, target.length);
}

function levenshtein(source: string, target: string): number {
  let matrix: number[][] = [];
  for (let i = 0; i <= source.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= target.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= source.length; i++) {
    for (let j = 1; j <= target.length; j++) {
      if (source[i - 1] === target[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
      }
    }
  }
  return matrix[source.length][target.length];
}
