const fs = require('fs');

// We need to provide a mock DOM for the compiler if it needs it.
// Usually RScompiler doesn't need DOM to compile strings.
const vm = require('vm');

let compilerCode = fs.readFileSync('RScompiler.3.2.min.js', 'utf8');
let context = vm.createContext({ window: {}, console: console });
vm.runInContext(compilerCode, context);

let vpythonCode = fs.readFileSync('vpython_src.py', 'utf8');
let jsCode = context.RS_compiler.compile(vpythonCode, 'vpython');
fs.writeFileSync('compiled_out.js', jsCode);
