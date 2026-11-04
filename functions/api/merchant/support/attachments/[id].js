import { currentUser } from "../../../../_lib/auth.js";
export async function onRequestGet({request,env,params}){
 if(!env.AUTH_DB)return new Response("Unavailable",{status:503});
 const user=await currentUser(request,env.AUTH_DB);if(!user)return new Response("Unauthorized",{status:401});
 const id=String(params?.id||"");if(!/^[a-f0-9]{32}$/i.test(id))return new Response("Bad request",{status:400});
 const row=await env.AUTH_DB.prepare("SELECT a.file_name,a.mime_type,a.data_base64 FROM support_attachments a JOIN support_tickets t ON t.id=a.ticket_id WHERE a.id=? AND t.user_id=?").bind(id,user.id).first();
 if(!row)return new Response("Not found",{status:404});
 const binary=atob(row.data_base64),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
 const name=String(row.file_name||"attachment").replace(/["\\r\\n]/g,"_");
 return new Response(bytes,{headers:{"Content-Type":row.mime_type,"Content-Length":String(bytes.length),"Content-Disposition":(row.mime_type.startsWith("image/")||row.mime_type==="application/pdf"?"inline":"attachment")+'; filename="'+name+'"',"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'none'; sandbox"}});
}
