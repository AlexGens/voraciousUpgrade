export class ElectronSqliteBackend{

  async initialize(db) {
    await db.run('CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT)');
  }

  async getItemMaybe(key, db) {
    console.log(db);
    const row = await db.get('SELECT * FROM kv WHERE k = ?', key);
    return row && row.v;
  }

  async getItem(key, db) {
    const value = this.getItemMaybe(key, db);
    if (value === undefined) {
      throw new Error('item not found');
    }
    return value;
  }

  async getItems(keys, db) {
    const inPlaceholder = '(' + keys.map(() => '?').join(',') + ')';
    const rows = await db.all('SELECT * FROM kv WHERE k IN ' + inPlaceholder, keys);
    if (rows.length !== keys.length) {
      throw new Error('not all items found');
    }

    const result = new Map();
    for (const row of rows) {
      const k = row.k;
      if (result.has(k)) {
        throw new Error('loaded same key more than once?');
      }
      result.set(k, row.v);
    }

    // Extra sanity check
    for (const k of keys) {
      if (!result.has(k)) {
        throw new Error('missed a key');
      }
    }

    return result;
  }

  async setItem(key, value, db) {
    // This is supposedly the right way to upsert in sqlite
    // NOTE: This wouldn't really be safe if we had multiple calls
    //  to setItem for same key back to back. There could be a race
    //  where they both try to INSERT, I think.
    // TODO: Since all calls go through this same backend object,
    //  and they're all async, we could serialize them here.
    const { changes } = await db.run('UPDATE kv SET v = ? WHERE k = ?', value, key);
    if (changes === 0) {
      // If changes is 0 that means the UPDATE failed to match any rows
      await db.run('INSERT INTO kv (k, v) VALUES (?, ?)', key, value);
    }
  }

  async removeItem(key, db) {
    await db.run('DELETE FROM kv WHERE k = ?', key);
  }
}
