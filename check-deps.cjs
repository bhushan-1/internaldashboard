const pkg = require('./package.json');
console.log('dependencies:', Object.keys(pkg.dependencies || {}).join(', '));
console.log('has mongodb:', 'mongodb' in (pkg.dependencies || {}));
