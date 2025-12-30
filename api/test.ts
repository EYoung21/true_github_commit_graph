import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const hasToken = !!process.env.GITHUB_TOKEN;
  const tokenPrefix = process.env.GITHUB_TOKEN?.substring(0, 7) || 'none';
  
  return res.status(200).json({ 
    status: 'ok',
    hasToken,
    tokenPrefix,
    nodeVersion: process.version
  });
}

