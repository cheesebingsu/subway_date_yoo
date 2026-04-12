import { z } from "zod";

export const nicknameSchema = z
  .string()
  .min(1, "닉네임을 입력해주세요.")
  .max(8, "닉네임은 최대 8자입니다.")
  .regex(/^[가-힣a-zA-Z0-9]+$/, "닉네임은 한글, 영문, 숫자만 사용 가능하며 공백 및 특수문자는 불가합니다.");

export const bioSchema = z
  .string()
  .max(20, "소개글은 최대 20자입니다.")
  .optional();

export const ageSchema = z
  .number({ required_error: "나이를 입력해주세요.", invalid_type_error: "나이는 숫자여야 합니다." })
  .int()
  .min(18, "18세 이상만 이용 가능합니다.")
  .max(45, "45세 이하만 이용 가능합니다.");

const mbtiRegex = /^[EI][SN][TF][JP]$/;
export const mbtiSchema = z
  .string()
  .regex(mbtiRegex, "유효하지 않은 MBTI입니다.");

export const kakaoIdSchema = z
  .string()
  .max(30, "카카오톡 아이디가 너무 깁니다.")
  .regex(/^[a-zA-Z0-9.\-_]+$/, "유효하지 않은 아이디 형식입니다.")
  .optional()
  .or(z.literal(""));

// Complete profile update schema
export const profileUpdateSchema = z.object({
  nickname: nicknameSchema,
  bio: bioSchema,
  age: ageSchema,
  mbti: mbtiSchema,
});
