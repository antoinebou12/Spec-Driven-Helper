import type { FastifyInstance } from 'fastify';
import * as oidc from 'openid-client';
import { z } from 'zod';
import { hash } from 'bcryptjs';
import { runtimeConfig } from './admin';
import { db } from './db';
import { digest,session } from './security';
import { SsoError,ssoAccount,ssoCallback } from './sso-accounts';
import { HttpError } from './projects';
const origin=()=>process.env.APP_ORIGIN??'http://localhost:5173';
export async function registerGoogleAuth(app:FastifyInstance){
 app.post('/api/v1/auth/signup',{config:{rateLimit:{max:5,timeWindow:'1 hour'}}},async(req)=>{if(!(await runtimeConfig()).registration)throw new HttpError(403,'Registration is invitation-only. Ask your administrator for an invitation.');const b=z.object({name:z.string().min(1).max(100),email:z.string().email(),password:z.string().min(12).max(200)}).parse(req.body);if(await db.collection('users').findOne({email:b.email.toLowerCase()}))throw new HttpError(409,'An account already exists for this email');await db.collection('users').insertOne({id:crypto.randomUUID(),name:b.name,email:b.email.toLowerCase(),passwordHash:await hash(b.password,12),role:'Viewer',disabled:true});return {message:'Account requested. An administrator must activate it before sign-in.'};});
 const config=async()=>{const c=await runtimeConfig();if(!c.googleClientId||!c.googleSecret)throw new HttpError(503,'Google sign-in is not configured');return oidc.discovery(new URL('https://accounts.google.com'),c.googleClientId,c.googleSecret);};
 app.get('/api/v1/auth/google',async(_req,reply)=>{const c=await config(),verifier=oidc.randomPKCECodeVerifier(),state=oidc.randomState(),nonce=oidc.randomNonce();await db.collection('sessions').insertOne({googleState:digest(state),verifier,nonce,expiresAt:new Date(Date.now()+600000)});reply.setCookie('sdd_google',state,{httpOnly:true,sameSite:'lax',secure:origin().startsWith('https:'),path:'/',maxAge:600});return reply.redirect(oidc.buildAuthorizationUrl(c,{redirect_uri:`${origin()}/api/v1/auth/google/callback`,scope:'openid email profile',state,nonce,code_challenge:await oidc.calculatePKCECodeChallenge(verifier),code_challenge_method:'S256'}).href);});
 app.get('/api/v1/auth/google/callback',async(req,reply)=>{
  const state=req.cookies.sdd_google;
  reply.clearCookie('sdd_google',{path:'/'});
  return ssoCallback(reply,'google',async()=>{
   if(!state)throw new HttpError(400,'Missing Google sign-in state');
   const stored=await db.collection('sessions').findOneAndDelete({googleState:digest(state),expiresAt:{$gt:new Date()}});
   if(!stored)throw new HttpError(400,'Sign-in expired');
   const tokens=await oidc.authorizationCodeGrant(await config(),new URL(req.url,origin()),{pkceCodeVerifier:stored.verifier,expectedState:state,expectedNonce:stored.nonce});
   const claims=tokens.claims();
   if(!claims)throw new SsoError('unverified');
   return ssoAccount(claims,'https://accounts.google.com');
  },async(u)=>{reply.setCookie('sdd_session',await session(u.id),{httpOnly:true,sameSite:'lax',secure:origin().startsWith('https:'),path:'/',maxAge:604800});});
 });
}
