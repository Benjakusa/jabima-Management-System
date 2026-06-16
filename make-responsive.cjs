const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = dir + '/' + file;
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      if (file.endsWith('.tsx')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk('./src');

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  // Replace grid-cols-2 that isn't preceded by a responsive prefix or whitespace
  // Regex: lookbehind for space or quote, match grid-cols-2
  content = content.replace(/(?<=[\s"'])grid-cols-2(?=[\s"'])/g, 'grid-cols-1 sm:grid-cols-2');
  content = content.replace(/(?<=[\s"'])grid-cols-3(?=[\s"'])/g, 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3');
  content = content.replace(/(?<=[\s"'])grid-cols-4(?=[\s"'])/g, 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4');
  
  // also check if "sm:grid-cols-2" was already there and we accidentally made it "sm:grid-cols-1 sm:grid-cols-2"
  content = content.replace(/sm:grid-cols-1 sm:/g, 'sm:');
  content = content.replace(/md:grid-cols-1 sm:/g, 'md:');
  content = content.replace(/lg:grid-cols-1 sm:/g, 'lg:');
  
  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated ${file}`);
  }
});

console.log('Done!');
