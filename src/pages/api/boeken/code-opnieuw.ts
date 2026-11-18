// Compatibility for an old open page: paid owners can now read without a code.
import type {APIRoute} from 'astro';
import {isTrustedFormOrigin} from '../../../lib/adminAuth';
import {privateHeaders} from '../../../lib/commerce/purchases';
import {BOOK_LIBRARY_PATH} from '../../../lib/ebooks/book';
export const POST:APIRoute=async({request})=>{
 if(!isTrustedFormOrigin(request))return new Response('Geen toegang.',{status:403,headers:privateHeaders});
 return new Response(null,{status:303,headers:{...privateHeaders,location:BOOK_LIBRARY_PATH}});
};
