// 서버 구동 시 강제로 환경변수 누락 여부를 런타임에 체크합니다.
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY in .env.local!");
}

export const env = {
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  TOSS_SECRET_KEY: process.env.TOSS_PAYMENTS_SECRET_KEY || "", // From env file
  // CRON_SECRET is optional if you don't use vercel cron 
  // CRON_SECRET: process.env.CRON_SECRET || "",
};
