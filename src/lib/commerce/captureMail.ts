// Imported only by the development branch; never trace the local mailbox into a deployment.
import nodemailer from 'nodemailer';
import {mkdir,appendFile} from 'node:fs/promises';
import {join} from 'node:path';
export async function captureEmail(to:string,subject:string,text:string,replyTo:string,messageId?:string){
 const transport=nodemailer.createTransport({streamTransport:true,buffer:true,newline:'unix'});
 const result=await transport.sendMail({from:'MyGrowise <info@mygrowise.be>',to,replyTo,subject,text,messageId});
 const dir=join(process.cwd(),'output','mail-test');await mkdir(dir,{recursive:true});
 await appendFile(join(dir,'messages.jsonl'),JSON.stringify({to,replyTo,subject,mime:result.message.toString()})+'\n');
}
