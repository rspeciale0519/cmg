import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateDestination} from './prepare.mjs';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
test('preparation refuses existing destinations, the CMG checkout, and symlinks into it',async()=>{
 const temp=await mkdtemp(path.join(tmpdir(),'cmg-signudoc-prepare-'));
 try{
  await assert.rejects(validateDestination(temp,repo));
  await assert.rejects(validateDestination(path.join(repo,'must-not-write-service'),repo));
  await symlink(repo,path.join(temp,'alias'));
  await assert.rejects(validateDestination(path.join(temp,'alias','must-not-write-service'),repo));
  assert.equal(await validateDestination(path.join(temp,'new-service'),repo),path.join(temp,'new-service'));
 }finally{await rm(temp,{recursive:true,force:true});}
});
