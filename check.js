const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function getFiles(dir, ext) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFiles(file, ext));
    } else if (file.endsWith(ext)) {
      results.push(file);
    }
  });
  return results;
}

// 1. 语法检查
const jsFiles = getFiles(path.join(__dirname, 'functions'), '.js');
jsFiles.forEach(file => {
  try {
    execSync(`node --check "${file}"`, { stdio: 'ignore' });
  } catch (err) {
    console.error(`语法错误: ${file}`);
    process.exit(1);
  }
});
console.log('所有 JS 文件语法检查通过。');

// 2. 检查 HTML 文件的内联样式
const htmlFiles = getFiles(path.join(__dirname, 'public'), '.html');
htmlFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const inlineStyleRegex = /<\w+\s+[^>]*\bstyle\s*=\s*['"]/gi;
  if (inlineStyleRegex.test(content)) {
    console.error(`发现内联样式: ${file}`);
    process.exit(1);
  }
});
console.log('所有 HTML 文件内联样式检查通过。');

// 3. 检查函数行数 (不可超过30行)
jsFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  
  let functionStartLine = -1;
  let braceCount = 0;
  let inFunction = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (!inFunction) {
      if (line.includes('function') || line.includes('=>')) {
        if (line.includes('{')) {
          functionStartLine = i;
          braceCount = (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
          if (braceCount > 0) {
            inFunction = true;
          }
        }
      }
    } else {
      braceCount += (line.match(/{/g) || []).length;
      braceCount -= (line.match(/}/g) || []).length;
      if (braceCount <= 0) {
        const length = i - functionStartLine + 1;
        if (length > 30) {
          console.error(`函数行数超标 (${length}行): ${file}，从第 ${functionStartLine + 1} 行到第 ${i + 1} 行`);
          process.exit(1);
        }
        inFunction = false;
      }
    }
  }
});
console.log('所有 JS 函数体积检查通过。');
console.log('全部审计项均已通过！');
