import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { Auth } from './auth-types';
import { runtimeConfig } from './admin';
import { projectFor, HttpError } from './projects';
import { audit } from './security';
import { registerDiagramEvidence } from './diagram-evidence';

export async function registerDiagrams(app:FastifyInstance,auth:Auth){
  app.post('/api/v1/projects/:id/diagrams/kroki',{preHandler:auth},async(req:any)=>{
    const p=await projectFor(req.user,req.params.id,'edit');
    const b=z.object({type:z.enum(['mermaid','plantuml','graphviz','d2']),source:z.string().min(1).max(20000),confirm:z.literal(true)}).parse(req.body);
    const config=await runtimeConfig();if(!config.krokiUrl)throw new HttpError(503,'Configure a Kroki endpoint in administration');
    if(p.spec.localOnly)throw new HttpError(403,'External diagram rendering is disabled for local-only projects');
    // Includes and remote resources could make the renderer fetch arbitrary network content.
    if(/!include|!import|https?:|file:|ftp:|<img|image\s*=|\burl\s*\(/i.test(b.source))throw new HttpError(400,'Diagram includes and external resources are not allowed');
    const response=await fetch(config.krokiUrl,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json'},body:JSON.stringify({diagram_type:b.type,diagram_source:b.source,output_format:'png'}),signal:AbortSignal.timeout(20000)});
    if(!response.ok||!response.body)throw new HttpError(502,'Kroki rendering failed');
    const chunks:Uint8Array[]=[];let size=0;for await(const chunk of response.body as unknown as AsyncIterable<Uint8Array>){size+=chunk.length;if(size>2_000_000)throw new HttpError(413,'Diagram is too large');chunks.push(chunk);}
    const png=Buffer.concat(chunks);if(png.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw new HttpError(502,'Renderer did not return a PNG image');
    await audit(req.user.id,'diagram.rendered',p.id,{type:b.type});return {mime:'image/png',data:png.toString('base64')};
  });
  const withMcp=async<T>(run:(client:Client,allowed:string[])=>Promise<T>)=>{
    const c=await runtimeConfig();if(!c.umlMcpUrl)throw new HttpError(503,'Configure the UML MCP endpoint in administration');
    const client=new Client({name:'sdd-studio',version:'0.1.0'});
    const transport=new StreamableHTTPClientTransport(new URL(c.umlMcpUrl),{requestInit:{headers:c.umlMcpSecret?{Authorization:`Bearer ${c.umlMcpSecret}`}:{},redirect:'error'},fetch:async(url,options)=>fetch(url,{...options,redirect:'error',signal:AbortSignal.timeout(20000)})});
    try{await client.connect(transport);return await run(client,c.umlAllowedTools);}finally{await client.close();}
  };
  registerDiagramEvidence(app, auth, withMcp);
  app.get('/api/v1/projects/:id/diagrams/uml/tools',{preHandler:auth},async(req:any)=>{
    const p=await projectFor(req.user,req.params.id,'edit');if(p.spec.localOnly)throw new HttpError(403,'External UML tools are disabled for local-only projects');
    return withMcp(async(client,allowed)=>({tools:(await client.listTools()).tools.filter(t=>allowed.includes(t.name))}));
  });
  app.post('/api/v1/projects/:id/diagrams/uml/call',{preHandler:auth},async(req:any)=>{
    const p=await projectFor(req.user,req.params.id,'edit');if(p.spec.localOnly)throw new HttpError(403,'External UML tools are disabled for local-only projects');
    const b=z.object({tool:z.string().max(200),arguments:z.record(z.string(),z.unknown()),confirm:z.literal(true)}).parse(req.body);
    return withMcp(async(client,allowed)=>{
      if(!allowed.includes(b.tool))throw new HttpError(403,'Tool is not enabled by the administrator');
      const metadata=(await client.listTools()).tools.find(t=>t.name===b.tool);
      // First integration only permits server-declared read-only drawing tools.
      if(!metadata?.annotations?.readOnlyHint)throw new HttpError(403,'Only read-only UML tools are supported');
      await audit(req.user.id,'uml.tool-requested',p.id,{tool:b.tool});
      const result=await client.callTool({name:b.tool,arguments:b.arguments},undefined,{timeout:20000});
      const output=JSON.stringify(result);if(output.length>200000)throw new HttpError(413,'Tool response is too large');
      return {result,notice:'Untrusted tool output. Copy desired diagram source into the editor and review before saving.'};
    });
  });
}
