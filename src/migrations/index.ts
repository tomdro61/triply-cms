import * as migration_20260312_remove_suggestedTitle from './20260312_remove_suggestedTitle';
import * as migration_20260605_add_content_updated_at from './20260605_add_content_updated_at';
import * as migration_20261005_add_lots from './20261005_add_lots';

export const migrations = [
  {
    up: migration_20260312_remove_suggestedTitle.up,
    down: migration_20260312_remove_suggestedTitle.down,
    name: '20260312_remove_suggestedTitle',
  },
  {
    up: migration_20260605_add_content_updated_at.up,
    down: migration_20260605_add_content_updated_at.down,
    name: '20260605_add_content_updated_at',
  },
  {
    up: migration_20261005_add_lots.up,
    down: migration_20261005_add_lots.down,
    name: '20261005_add_lots'
  },
];
