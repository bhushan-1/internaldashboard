const p = require('./package.json');
console.log('dependencies:', JSON.stringify(p.dependencies, null, 2));
console.log('devDependencies:', JSON.stringify(p.devDependencies, null, 2));
