import { DB_NAMES, getConnection, getRefreshTokenModel } from "@syt/shared";

export async function revokeRefreshTokensForUser(userId: string): Promise<number> {
  const authConn = await getConnection(DB_NAMES.auth);
  const RefreshToken = getRefreshTokenModel(authConn);
  const result = await RefreshToken.deleteMany({ userId });
  return result.deletedCount ?? 0;
}
