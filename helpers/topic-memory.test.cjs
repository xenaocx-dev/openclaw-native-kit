const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

async function main() {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'topic-memory-roundtrip-'));
  const client = new Client({name:'review-test',version:'1.0.0'});
  const transport = new StdioClientTransport({command:process.execPath,
    args:[path.join(__dirname,'topic-memory-mcp.cjs')],
    env:{...process.env, TOPIC_MEMORY_WORKSPACE:workspace, TOPIC_MEMORY_SOURCE:'synthetic:review', OPENCLAW_TOPIC_MEMORY_ENABLED:'1'}});
  try {
    await client.connect(transport);
    const listed = await client.listTools();
    assert.deepEqual(listed.tools.map(x=>x.name).sort(), ['memory_get','memory_propose','memory_search']);
    async function call(name,args) {
      const result = await client.callTool({name,arguments:args});
      assert.ok(!result.isError, `${name} failed`);
      return JSON.parse(result.content[0].text);
    }
    const args = {content:'Synthetic review marker ROUNDTRIP-4821',kind:'project_fact',confidence:0.8};
    const saved = await call('memory_propose',args);
    assert.equal(saved.saved,true);
    assert.equal((await call('memory_propose',args)).duplicate,true);
    const found = await call('memory_search',{query:'ROUNDTRIP-4821'});
    assert.ok(found.results.some(x=>x.path===saved.path));
    const fetched = await call('memory_get',{path:saved.path});
    assert.match(fetched.lines,/ROUNDTRIP-4821/);
    const escaped = await client.callTool({name:'memory_get',arguments:{path:'../outside.md'}});
    assert.equal(escaped.isError,true);
    console.log('PASS temporary MCP stdio: discover, write, deduplicate, search, get, reject traversal');
  } finally {
    await client.close();
    await transport.close();
    fs.rmSync(workspace,{recursive:true,force:true});
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
