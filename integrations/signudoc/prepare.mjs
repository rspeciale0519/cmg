#!/usr/bin/env node
import {readFile,lstat,realpath} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const repoRoot=path.resolve(here,'../..');
export async function validateDestination(candidate,repository=repoRoot){
 const destination=path.resolve(candidate),parent=await realpath(path.dirname(destination)),root=await realpath(repository);
 const actual=path.join(parent,path.basename(destination));
 if(actual===root||actual.startsWith(root+path.sep))throw Error('Choose a new service directory outside the CMG checkout.');
 try{await lstat(actual);throw Error('The service destination must not already exist.');}catch(error){if(error.code!=='ENOENT')throw error;}
 return actual;
}
export async function verifyPatchManifest(){
 const pin=JSON.parse(await readFile(path.join(here,'PINNED_UPSTREAM.json'),'utf8'));
 if(pin.repository!=='https://github.com/NYLLON-SOFTWARE/SignuDoc.git'||!/^[a-f0-9]{40}$/.test(pin.commit)||!Array.isArray(pin.patches)||pin.patches.length<1||pin.patches.length>5)throw Error('Invalid pinned source manifest.');
 for(const patch of pin.patches){
  if(!/^patches\/[A-Za-z0-9._-]+\.patch$/.test(patch.file)||!/^[a-f0-9]{64}$/.test(patch.sha256))throw Error('Invalid patch reference.');
  const bytes=await readFile(path.join(here,patch.file));
  if(createHash('sha256').update(bytes).digest('hex')!==patch.sha256)throw Error('Patch checksum mismatch: '+patch.file);
 }
 return pin;
}
function git(args){const result=spawnSync('git',['-c','core.hooksPath=/dev/null',...args],{stdio:'inherit'});if(result.error)throw result.error;if(result.status!==0)throw Error('Git preparation failed. Inspect the new directory before retrying.');}
async function main(){
 const target=process.argv[2];if(!target)throw Error('Usage: node integrations/signudoc/prepare.mjs /new/directory/outside/cmg');
 const pin=await verifyPatchManifest(),destination=await validateDestination(target);
 git(['clone','--no-checkout','--filter=blob:none',pin.repository,destination]);
 git(['-C',destination,'checkout','--detach',pin.commit]);
 for(const patch of pin.patches){const source=path.join(here,patch.file);git(['-C',destination,'apply','--check',source]);git(['-C',destination,'apply',source]);}
 console.log('Prepared pinned SignuDoc source with '+pin.patches.length+' verified patches at '+destination+'.');
 console.log('No dependencies installed, database changed, service started, message sent, or deployment performed.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main().catch(error=>{console.error(error.message);process.exitCode=1;});
