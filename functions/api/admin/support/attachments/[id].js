import { adminContext } from "../../../../_lib/admin.js";
export async function onRequestGet({request,env,params}){
 const c=await adminContext(request,env);if(c.response)return c.response;
 const id=String(params?.id||"");if(!/^[a-f0-9]{32}$/i.test(id))return new Response("Bad request",{status:400});
 const row=await c.db.prepare("SELECT file_name,mime_type,data_base64 FROM support_attachments WHERE id=?").bind(id).first();
 if(!row)return new Response("Not found",{status:404});
 const binary=atob(row.data_base64),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
 const name=String(row.file_name||"attachment").replace(/["\\r\\n]/g,"_");
 return new Response(bytes,{headers:{"Content-Type":row.mime_type,"Content-Length":String(bytes.length),"Content-Disposition":(row.mime_type.startsWith("image/")||row.mime_type==="application/pdf"?"inline":"attachment")+'; filename="'+name+'"',"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'none'; sandbox"}});
}
