// 家人帳號：孩子不用記 email，登入時只打帳號名稱，系統自動補上家庭網域。

export const FAMILY_EMAIL_DOMAIN = "myhome.family";

export function loginEmail(account: string): string {
  const a = account.trim().toLowerCase();
  return a.includes("@") ? a : `${a}@${FAMILY_EMAIL_DOMAIN}`;
}

/** 帳號名稱：英文小寫、數字、- 或 _，3–20 字。 */
export function isValidAccountName(name: string): boolean {
  return /^[a-z0-9_-]{3,20}$/.test(name);
}
