// 환경변수를 런타임(API 호출 시점)에 안전하게 가져옵니다.
// 빌드 시점에는 환경변수가 없을 수 있으므로 즉시 throw하지 않습니다.
export const env = {
  get SUPABASE_SERVICE_ROLE_KEY(): string {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY!");
    return key;
  },
  get TOSS_SECRET_KEY(): string {
    return process.env.TOSS_PAYMENTS_SECRET_KEY || "";
  },
};
