import { clearSchemaCache, hasColumn, isUnknownColumnError } from '../db.js';

export async function queryWithOptionalOwnerScope({ tableName, ownerId, run }) {
  const ownerScoped = await hasColumn(tableName, 'owner_id');

  try {
    return await run({ useOwnerScope: ownerScoped && Boolean(ownerId), ownerId });
  } catch (err) {
    if (!isUnknownColumnError(err)) throw err;
    clearSchemaCache();
    return await run({ useOwnerScope: false, ownerId: null });
  }
}
