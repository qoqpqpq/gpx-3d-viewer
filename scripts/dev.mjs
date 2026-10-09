import { spawn } from 'node:child_process';
const extraArgs = process.argv.slice(2);
const viteArgs = extraArgs.length ? extraArgs : ['--host','0.0.0.0','--port','5173'];
const children=[spawn(process.execPath,['--env-file-if-exists=.env.server','server/index.mjs'],{stdio:'inherit'}),spawn(process.execPath,['node_modules/vite/bin/vite.js',...viteArgs],{stdio:'inherit'})];
let stopping=false;function stop(code=0){if(stopping)return;stopping=true;for(const child of children)child.kill();process.exitCode=code;}
for(const child of children){child.on('error',()=>stop(1));child.on('exit',code=>stop(code??0));}
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>stop());
