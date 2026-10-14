# Map snapshots

Every sync stores the progress fields that move or recolor cells (SRS, accuracy, sources, WaniKani membership, reading counts, and answer counts). Static kanji metadata stays on the live reference row.

If that view matches the latest snapshot, sync only moves that snapshot’s timestamp forward. A different view inserts a new row.

The header arrows step the grid across those rows. They stay visible even when there is only one snapshot; the forward arrow stays disabled on the newest row, and the back arrow stays disabled on the oldest. If the snapshot table is empty, the current map is stored once so the controls and timestamp are present before the next sync. A sync that only renumbers the internal WaniKani sort index, without changing stage, accuracy, or lesson order, updates the latest snapshot’s time instead of adding another row. Older rows overlay their stored progress onto the current kanji list, and the grid’s existing color blend and reorder animation show the change.
