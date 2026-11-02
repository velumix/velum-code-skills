import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
export const DIRECTORY='velumix/velum-code-skills';
export function repo(input){
  const value=String(input).trim().replace(/^https:\/\/github\.com\//,'').replace(/\/$/,'').replace(/\.git$/,'').toLowerCase();
  if(!/^[a-z0-9-]{1,39}\/[a-z0-9_.-]{1,100}$/.test(value)||['.','..'].includes(value.split('/')[1]))throw Error('Use a public GitHub owner/repository.');return value;
}
export function sha(value){if(!/^[a-f0-9]{40}$/.test(value))throw Error('A full 40-character commit is required. Validate your skill in Velum first.');return value;}
export function manifest(m){
  const fields=['apiVersion','id','name','version','description','author','entry','tags'];
  if(!m||typeof m!=='object'||Object.keys(m).some(k=>!fields.includes(k))||m.apiVersion!==1||m.entry!=='SKILL.md'||!/^[a-z][a-z0-9.-]{2,63}$/.test(m.id)||m.id.includes('..')||m.id.endsWith('.')||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/.test(m.id))throw Error('Invalid skill identity or API version.');
  for(const[k,max]of Object.entries({name:80,version:40,description:500,author:120}))if(typeof m[k]!=='string'||!m[k].trim()||Buffer.byteLength(m[k])>max||/[\u0000-\u001f\u007f]/.test(m[k]))throw Error(`Invalid ${k}.`);
  m.tags??=[];
  if(!Array.isArray(m.tags)||m.tags.length>8||new Set(m.tags).size!==m.tags.length||m.tags.some(t=>typeof t!=='string'||!/^[a-z0-9]([a-z0-9-]{0,22}[a-z0-9])?$/.test(t)))throw Error('Use up to 8 unique lowercase tags.');
  return m;
}
// The same flat frontmatter subset the app reads: `key: value` lines between
// --- markers. velum-skill.json stays the precise metadata path.
export function frontmatter(text){
  const clean=String(text).replace(/^\uFEFF/,'');
  const match=/^---\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)(?:\r?\n|$)/.exec(clean);
  if(!match)return {};
  const fields={};
  for(const line of match[1].split(/\r?\n/)){
    const at=line.indexOf(':');if(at<1)continue;
    let value=line.slice(at+1).trim();
    if((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'")))value=value.slice(1,-1);
    if(value&&!['>','|','>-','|-'].includes(value))fields[line.slice(0,at).trim().toLowerCase()]=value;
  }
  return fields;
}
function slug(text){
  let out='';
  for(const c of String(text).toLowerCase()){if(/[a-z0-9]/.test(c))out+=c;else if(out&&!out.endsWith('-'))out+='-';}
  return out.replace(/^-+|-+$/g,'').slice(0,40);
}
export function derive(repository,commit,skillMd){
  const fields=frontmatter(skillMd);
  const [owner,name]=repository.split('/');
  const title=[...(fields.name||name.replace(/[-_]/g,' '))].slice(0,80).join('');
  const id=`${owner}.${slug(title)}`;
  return manifest({apiVersion:1,id,name:title,version:commit.slice(0,7),description:[...(fields.description||`Skill from ${repository}.`)].slice(0,500).join(''),author:owner,entry:'SKILL.md',tags:[]});
}
export function submission(body){
  function field(title){const parts=String(body).split(`### ${title}\n`);if(parts.length!==2)throw Error(`Missing or repeated ${title}.`);return parts[1].split('\n### ')[0].trim();}
  return {repository:repo(field('Repository')),commit:sha(field('Commit'))};
}
export function approvedSubmission(event,eventName,permission,issue){
  if(!['admin','maintain','write'].includes(permission))throw Error('A directory maintainer must approve publication.');
  if(eventName==='workflow_dispatch')return {repository:repo(event.inputs.repository),commit:sha(event.inputs.commit)};
  if(eventName!=='issues'||event.action!=='labeled'||event.label?.name!=='approved')throw Error('An explicit approved label event is required.');
  if(!issue||issue.state!=='open'||!issue.labels.some(l=>l.name==='approved')||issue.body!==event.issue.body)throw Error('Submission changed after approval. Remove and reapply approved after review.');
  return submission(issue.body.replace(/\r\n/g,'\n'));
}
export function catalog(entries){
  if(entries.length>500)throw Error('Directory is limited to 500 skills.');
  const ids=new Set(),repos=new Set();
  for(const s of entries){s.repository=repo(s.repository);sha(s.commit);manifest(s.manifest);if(ids.has(s.manifest.id)||repos.has(s.repository))throw Error('Duplicate skill ID or repository.');ids.add(s.manifest.id);repos.add(s.repository);}
  const result={schemaVersion:1,skills:entries.sort((a,b)=>a.manifest.name.localeCompare(b.manifest.name,'en'))};
  if(Buffer.byteLength(JSON.stringify(result))>1024*1024)throw Error('Directory exceeds 1 MB.');return result;
}
async function get(path,limit=32768,accept='application/vnd.github+json',optional=false){
  const response=await fetch(`https://api.github.com/repos/${path}`,{headers:{'User-Agent':'VelumCode-SkillDirectory','Accept':accept,'X-GitHub-Api-Version':'2022-11-28',...(process.env.GH_TOKEN?{Authorization:`Bearer ${process.env.GH_TOKEN}`}:{})},redirect:'error',signal:AbortSignal.timeout(15000)});
  if(optional&&response.status===404)return null;
  if(!response.ok)throw Error(`GitHub HTTP ${response.status}. Check repository visibility and permissions.`);
  if(Number(response.headers.get('content-length'))>limit)throw Error('File exceeds size limit.');
  const reader=response.body.getReader();const chunks=[];let size=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit)throw Error('File exceeds size limit.');chunks.push(value);}}finally{await reader.cancel();}
  return new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks));
}
async function entries(){await mkdir('entries',{recursive:true});return Promise.all((await readdir('entries')).filter(n=>n.endsWith('.json')).map(async n=>JSON.parse(await readFile(`entries/${n}`,'utf8'))));}
async function generate(check=false){
  const data=catalog(await entries());const text=JSON.stringify(data,null,2)+'\n';
  if(check){if(await readFile('catalog.json','utf8')!==text)throw Error('Run node scripts/catalog.mjs generate and commit catalog.json.');}
  else await writeFile('catalog.json',text);
  return data;
}
async function publish(repository,commit){
  repository=repo(repository);commit=sha(commit);
  const skillMd=await get(`${repository}/contents/SKILL.md?ref=${commit}`,32*1024,'application/vnd.github.raw+json');
  if(!skillMd.trim())throw Error('SKILL.md is empty.');
  const manifestJson=await get(`${repository}/contents/velum-skill.json?ref=${commit}`,32768,'application/vnd.github.raw+json',true);
  const m=manifestJson?manifest(JSON.parse(manifestJson)):derive(repository,commit,skillMd);
  const current=await entries();if(current.some(e=>e.manifest.id===m.id&&e.repository!==repository))throw Error('Skill ID is already listed by another repository.');
  if(current.some(e=>e.repository===repository&&e.manifest.id!==m.id))throw Error('Repository changed its skill ID. Remove the old entry in a reviewed pull request first.');
  const entry={repository,commit,manifest:m};catalog([...current.filter(e=>e.repository!==repository),entry]);
  await writeFile(`entries/${m.id}.json`,JSON.stringify(entry,null,2)+'\n');await generate();
  console.log(`Listed ${repository} at ${commit}.`);
}
async function main(){
  const [command,a,b]=process.argv.slice(2);
  if(command==='check'||command==='generate')return generate(command==='check');
  if(command==='publish')return publish(a,b);
  if(command==='event'){
    const event=JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH,'utf8'));
    // Only a repository writer can approve; issue bodies never become shell commands.
    const permission=JSON.parse(await get(`${DIRECTORY}/collaborators/${encodeURIComponent(event.sender.login)}/permission`));
    const issue=process.env.GITHUB_EVENT_NAME==='issues'?JSON.parse(await get(`${DIRECTORY}/issues/${event.issue.number}`)):null;
    const s=approvedSubmission(event,process.env.GITHUB_EVENT_NAME,permission.permission,issue);
    return publish(s.repository,s.commit);
  }
  throw Error('Use check, generate, publish owner/repo SHA, or event.');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
