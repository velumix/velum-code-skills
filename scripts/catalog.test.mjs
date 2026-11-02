import{test}from'node:test';import assert from'node:assert/strict';import{repo,sha,submission,catalog,manifest,derive,frontmatter,approvedSubmission}from'./catalog.mjs';
const m=()=>({apiVersion:1,id:'test.skill',name:'Test',version:'1.0.0',description:'A test skill.',author:'Author',entry:'SKILL.md',tags:['test']});
test('submission accepts only GitHub repositories and immutable commits',()=>{
 assert.equal(repo('https://github.com/Owner/Repo.git'),'owner/repo');for(const s of['https://evil.test/a/b','a/../b','a/b?x=1','a/..','a/b\n$(secret)'])assert.throws(()=>repo(s));assert.throws(()=>sha('main'));
 assert.deepEqual(submission(`### Repository\n\na/b\n\n### Commit\n\n${'a'.repeat(40)}\n\n### Notes\n\nHi`),{repository:'a/b',commit:'a'.repeat(40)});assert.throws(()=>submission('### Repository\n\na/b'));
});
test('catalog rejects collisions and unsupported skills',()=>{const s={repository:'a/b',commit:'a'.repeat(40),manifest:m()};assert.equal(catalog([s]).skills.length,1);assert.throws(()=>catalog([s,{...s,repository:'other/repo'}]));assert.throws(()=>manifest({...m(),entry:'index.md'}));assert.throws(()=>manifest({...m(),name:'x'.repeat(81)}));assert.throws(()=>manifest({...m(),tags:['Bad Tag']}));assert.throws(()=>manifest({...m(),tags:['dup','dup']}));});
test('bare SKILL.md repositories derive the same metadata as the app',()=>{
 const commit='a'.repeat(40);
 const derived=derive('someone/neat-skill',commit,'---\nname: Neat Skill\ndescription: Does neat things.\n---\nBody');
 assert.equal(derived.id,'someone.neat-skill');assert.equal(derived.author,'someone');assert.equal(derived.version,'aaaaaaa');
 const unnamed=derive('someone/neat-skill',commit,'Just instructions.');
 assert.equal(unnamed.id,'someone.neat-skill');assert.ok(unnamed.description.includes('someone/neat-skill'));
 assert.equal(frontmatter('---\r\nname: x\r\n---\r\nbody').name,'x');
 assert.deepEqual(frontmatter('# No frontmatter'),{});
});
test('publication requires explicit writer approval of the current issue body',()=>{
 const body=`### Repository\n\na/b\n\n### Commit\n\n${'b'.repeat(40)}`;
 const event={action:'labeled',label:{name:'approved'},issue:{body}};const issue={state:'open',body,labels:[{name:'approved'}]};
 assert.equal(approvedSubmission(event,'issues','write',issue).commit,'b'.repeat(40));
 assert.throws(()=>approvedSubmission(event,'issues','read',issue));assert.throws(()=>approvedSubmission(event,'issues','triage',issue));
 assert.throws(()=>approvedSubmission({...event,action:'edited'},'issues','write',issue));assert.throws(()=>approvedSubmission(event,'issues','write',{...issue,body:body+'changed'}));assert.throws(()=>approvedSubmission(event,'issues','write',{...issue,labels:[]}));assert.throws(()=>approvedSubmission(event,'issues','write',{...issue,state:'closed'}));
});
