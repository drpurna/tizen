// xtream/types.js
// Type definitions for Xtream Codes API (JSDoc comments for IDE support)

/**
 * @typedef {Object} XtreamConfig
 * @property {string} serverUrl - Server URL (e.g., http://server:8080)
 * @property {string} username - Xtream username
 * @property {string} password - Xtream password
 * @property {number} [timeout=30000] - Request timeout in ms
 * @property {number} [retryAttempts=3] - Number of retry attempts
 * @property {number} [retryDelay=1000] - Base retry delay in ms
 * @property {number} [cacheTTL=300000] - Cache TTL in ms (5 min)
 */

/**
 * @typedef {Object} UserInfo
 * @property {string} username - Username
 * @property {string} password - Password
 * @property {string} message - Status message
 * @property {0|1} auth - 1 = success, 0 = failure
 * @property {string} status - Account status
 * @property {string} exp_date - Expiration timestamp
 * @property {string} is_trial - "0" or "1"
 * @property {string} active_cons - Active connections
 * @property {string} created_at - Account creation timestamp
 * @property {string} max_connections - Max allowed connections
 * @property {string[]} allowed_output_formats - Allowed formats
 */

/**
 * @typedef {Object} LiveCategory
 * @property {string} category_id - Category ID
 * @property {string} category_name - Category name
 * @property {number} parent_id - Parent category ID
 */

/**
 * @typedef {Object} LiveStream
 * @property {number} num - Channel number
 * @property {string} name - Channel name
 * @property {string} stream_type - "live"
 * @property {number} stream_id - Channel ID
 * @property {string} stream_icon - Logo URL
 * @property {string} epg_channel_id - EPG channel ID
 * @property {string} added - Added date
 * @property {string} category_id - Category ID
 * @property {string} category_name - Category name
 * @property {string} stream_display_name - Display name
 * @property {string} container_extension - File extension
 * @property {string} custom_sid - Custom SID
 * @property {number} tv_archive - Archive support (0/1)
 * @property {string} direct_source - Direct source URL
 */

/**
 * @typedef {Object} EpgProgram
 * @property {string} id - Program ID
 * @property {number} epg_id - EPG ID
 * @property {string} title - Program title
 * @property {string} lang - Language
 * @property {string} start - Start time string
 * @property {string} end - End time string
 * @property {string} description - Program description
 * @property {string} channel_id - Channel ID
 * @property {number} start_timestamp - Start timestamp
 * @property {number} end_timestamp - End timestamp
 */

/**
 * @typedef {Object} VodCategory
 * @property {string} category_id - Category ID
 * @property {string} category_name - Category name
 * @property {number} parent_id - Parent category ID
 */

/**
 * @typedef {Object} VodStream
 * @property {number} num - Stream number
 * @property {string} name - Stream name
 * @property {string} stream_type - "vod"
 * @property {number} stream_id - Stream ID
 * @property {string} stream_icon - Poster URL
 * @property {string} added - Added date
 * @property {string} category_id - Category ID
 * @property {string} container_extension - File extension
 */

/**
 * @typedef {Object} SeriesCategory
 * @property {string} category_id - Category ID
 * @property {string} category_name - Category name
 * @property {number} parent_id - Parent category ID
 */

/**
 * @typedef {Object} Series
 * @property {number} num - Series number
 * @property {string} name - Series name
 * @property {number} series_id - Series ID
 * @property {string} cover - Cover image URL
 * @property {string} plot - Plot description
 * @property {string} cast - Cast members
 * @property {string} director - Director
 * @property {string} genre - Genre
 * @property {string} release_date - Release date
 * @property {string} rating - Rating
 * @property {number} rating_5based - 5-star rating
 * @property {string} category_id - Category ID
 * @property {string} category_name - Category name
 */
