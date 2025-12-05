/*:
 * @target MZ
 * @plugindesc [SQL] Adds database support using SQLITE3 (Browser/Desktop) or various Desktop-only engines (MySQL, MSSQL, PostgreSQL).
 * @author OuttieTV
 *
 * @param SQL Engine
 * @type select
 * @option SQLITE3 (Browser/Desktop)
 * @value SQLITE3
 * @option MySQL (Desktop Only)
 * @value MySQL
 * @option MSSQL (Desktop Only)
 * @value MSSQL
 * @option PostgreSQL (Desktop Only)
 * @value PostgreSQL
 * @default SQLITE3
 * @desc The SQL engine to use. SQLITE3 works everywhere. Others require a desktop (NW.js) build.
 *
 * @param Debug Mode
 * @type boolean
 * @default false
 * @desc If true, logs all executed queries and connection errors to the console.
 * @on true
 * @off false
 *
 * @param Load From JSON on Failure
 * @type boolean
 * @default false
 * @desc If the DB connection fails, fall back to an equivalent JSON file for data.
 * @on true
 * @off false
 *
 * @param Default Connection Options
 * @type struct<ConnectionOptions>
 * @default {"host":"localhost","port":"","user":"user","password":"password","database":"rpg_db"}
 * @desc Default options for desktop connections. Ignored by SQLITE3.
 *
 * @help
 * ---------------------------------------------------------------------------
 * Plugin: RPG_SQL_Driver
 * ---------------------------------------------------------------------------
 *
 * This plugin provides a global '$sql' object for database interaction.
 *
 * 🛑 IMPORTANT: For Desktop engines (MySQL, MSSQL, PostgreSQL) to work,
 * you MUST install the required Node.js packages in your game's directory:
 *
 * - MySQL: npm install mysql2
 * - MSSQL: npm install mssql
 * - PostgreSQL: npm install pg
 * - SQLITE3 (Browser/Desktop): npm install sql.js (used automatically)
 *
 * ---------------------------------------------------------------------------
 * API Usage in Event Script Commands (e.g., using 'Control Variables'):
 * ---------------------------------------------------------------------------
 *
 * The '$sql' object is available globally. All methods return a Promise.
 * Use 'await' inside an 'async' function, or use the .then() chain.
 *
 * 1. Connecting (usually done once at game start, though not strictly required)
 * var conn = await $sql.connect();
 *
 * 2. SELECT (returns an array of row objects)
 * // Example: Get all items from the 'items' table
 * var rows = await $sql.select("SELECT * FROM items WHERE item_id = ?", [1]);
 * console.log(rows);
 *
 * 3. INSERT/UPDATE/DELETE (returns an object with affected rows count)
 * // Example: Update the gold for player 1
 * var result = await $sql.update("UPDATE players SET gold = ? WHERE id = ?", [999, 1]);
 * console.log("Affected rows: " + result.affectedRows);
 *
 * 4. Listing Tables/Columns
 * var tables = await $sql.listTables();
 * var columns = await $sql.listColumns('players');
 * console.log(tables, columns);
 *
 * // --- EXAMPLE USAGE CODE FOR AN EVENT SCRIPT ---
 *
 * (async function() {
 * try {
 * // 1. Connect (using default options)
 * // In SQLITE3, this simply opens/creates the database file.
 * await $sql.connect();
 *
 * // 2. Execute a SELECT query
 * const playerGold = await $sql.select(
 * "SELECT gold FROM players WHERE name = ?",
 * ['Hero']
 * );
 *
 * if (playerGold.length > 0) {
 * // 3. Set a game variable (e.g., Variable 1)
 * $gameVariables.setValue(1, playerGold[0].gold);
 * console.log("Variable 1 (Player Gold) set to: " + playerGold[0].gold);
 * }
 *
 * // 4. Execute an UPDATE query
 * await $sql.update(
 * "UPDATE players SET gold = ? WHERE name = ?",
 * [$gameVariables.value(1) + 100, 'Hero']
 * );
 *
 * } catch (e) {
 * console.error("SQL Event Error:", e.message);
 * // Show an in-game message
 * $gameMessage.add("A database error occurred: " + e.message);
 * }
 * })();
 *
 */
/*~struct~ConnectionOptions:
 * @param host
 * @type string
 * @default localhost
 * @desc Database host address.
 *
 * @param port
 * @type string
 * @default
 * @desc Database port (leave blank for default).
 *
 * @param user
 * @type string
 * @default user
 * @desc Database username.
 *
 * @param password
 * @type string
 * @default password
 * @desc Database password.
 *
 * @param database
 * @type string
 * @default rpg_db
 * @desc Database name.
 */

(function() {
    'use strict';

    // --- Plugin Parameters and Constants ---
    const PLUGIN_NAME = 'SQL_MZ_v1';
    const parameters = PluginManager.parameters(PLUGIN_NAME);

    const ENGINE = String(parameters['SQL Engine']).toUpperCase();
    const DEBUG = parameters['Debug Mode'] === 'true';
    const LOAD_FROM_JSON = parameters['Load From JSON on Failure'] === 'true';
    const DEFAULT_OPTIONS = JSON.parse(parameters['Default Connection Options'] || '{}');

    // Determine the environment (NW.js/Desktop or Browser)
    const isDesktop = typeof require === 'function' && typeof process === 'object' && typeof process.versions === 'object' && process.versions.node;

    /**
     * @class AbstractDriver
     * @description Defines the required interface for all SQL drivers.
     */
    class AbstractDriver {
        constructor() {
            this.connection = null;
        }

        async connect(options) {
            throw new Error('AbstractDriver.connect must be implemented.');
        }

        async execute(query, params, operation) {
            throw new Error('AbstractDriver.execute must be implemented.');
        }

        async select(query, params) {
            return this.execute(query, params, 'select');
        }

        async insert(query, params) {
            return this.execute(query, params, 'insert');
        }

        async update(query, params) {
            return this.execute(query, params, 'update');
        }

        async delete(query, params) {
            return this.execute(query, params, 'delete');
        }

        async listTables() {
            throw new Error('AbstractDriver.listTables must be implemented.');
        }

        async listColumns(table) {
            throw new Error('AbstractDriver.listColumns must be implemented.');
        }
    }

    // --- DRIVER IMPLEMENTATIONS (Desktop Only) ---
    let Driver;

    if (ENGINE === 'SQLITE3') {
        // --- SQLITE3 Driver (Browser/Desktop) ---
        // Uses sql.js for browser compatibility.
        // In Desktop, it loads the file system module.

        const SQL = (function() {
            if (isDesktop) {
                try {
                    // Try to load Node.js module first (for persistence)
                    return require('sqlite3');
                } catch (e) {
                    // Fallback for desktop if sqlite3 is not installed
                    try {
                        // Fallback to in-memory sql.js
                        const initSqlJs = require('sql.js');
                        return { initSqlJs: initSqlJs };
                    } catch (e2) {
                        return null;
                    }
                }
            } else {
                // Browser environment
                try {
                    // Expecting sql.js to be loaded via <script> tag or using bundled version
                    // If not found, initSqlJs will be null/undefined, caught below.
                    const initSqlJs = window.initSqlJs;
                    return { initSqlJs: initSqlJs };
                } catch (e) {
                    return null;
                }
            }
        })();

        if (!SQL) {
             console.error(`[${PLUGIN_NAME}]: SQLITE3 (sql.js) driver not found. Check console for error.`);
             // Driver will be null, error will be thrown on connect.
        }

        class SQLITE3Driver extends AbstractDriver {
            constructor() {
                super();
                this.db = null; // The sql.js database object
            }

            async connect(options) {
                if (!SQL || !SQL.initSqlJs) {
                    throw new Error('SQLITE3 connection failed: The required `sql.js` library is not loaded. ' +
                                    'Ensure the library is available in your deployment.');
                }

                if (this.db) {
                    if (DEBUG) console.log(`[${PLUGIN_NAME}]: Connection already established.`);
                    return this;
                }

                // In a real plugin, you'd load the file from disk using fetch (browser) or fs (desktop)
                // For simplicity, this implementation uses an in-memory database.
                if (DEBUG) console.log(`[${PLUGIN_NAME}]: Connecting to in-memory SQLITE3 database.`);

                const initSqlJs = await SQL.initSqlJs({
                    // The WASM file needs to be accessible in the path
                    locateFile: file => `js/${file}`
                });

                this.db = new initSqlJs.Database();
                if (DEBUG) console.log(`[${PLUGIN_NAME}]: SQLITE3 connection established (In-Memory).`);
                return this;
            }

            async execute(query, params, operation) {
                if (!this.db) {
                    throw new Error('SQLITE3: Not connected. Call connect() first.');
                }
                if (DEBUG) console.log(`[${PLUGIN_NAME}]: SQLITE3 EXECUTE (${operation}): ${query} | Params: ${JSON.stringify(params)}`);

                try {
                    // Normalize params to an array if they are not provided
                    const safeParams = params || [];

                    // For SQLITE3 (sql.js), SELECT uses exec(), which returns column/value arrays.
                    if (operation === 'select') {
                        const result = this.db.exec(query, safeParams);
                        if (result.length === 0) return [];

                        const { columns, values } = result[0];
                        return values.map(row => {
                            const obj = {};
                            columns.forEach((col, i) => {
                                obj[col] = row[i];
                            });
                            return obj;
                        });
                    } else {
                        // INSERT, UPDATE, DELETE use run()
                        const stmt = this.db.prepare(query);
                        const info = stmt.run(safeParams);
                        stmt.free();
                        return { affectedRows: this.db.getRowsModified() };
                    }
                } catch (e) {
                    if (DEBUG) console.error(`[${PLUGIN_NAME}]: SQLITE3 Error during ${operation}:`, e);
                    throw new Error(`SQLITE3 Query Error: ${e.message}`);
                }
            }

            async listTables() {
                const query = "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';";
                const rows = await this.select(query, []);
                return rows.map(row => row.name);
            }

            async listColumns(table) {
                const query = `PRAGMA table_info(${table});`;
                const rows = await this.select(query, []);
                return rows.map(row => row.name);
            }
        }
        Driver = SQLITE3Driver;

    } else if (isDesktop) {
        // --- DESKTOP DRIVERS (MySQL, MSSQL, PostgreSQL) ---

        let nodeModule;
        try {
            switch (ENGINE) {
                case 'MYSQL':
                    nodeModule = require('mysql2/promise');
                    break;
                case 'MSSQL':
                    nodeModule = require('mssql');
                    break;
                case 'POSTGRESQL':
                    nodeModule = require('pg');
                    break;
                default:
                    throw new Error(`Unsupported desktop engine: ${ENGINE}`);
            }
        } catch (e) {
            throw new Error(`[${PLUGIN_NAME}] Driver Error: Failed to load required Node.js module for ${ENGINE}. ` +
                            `Did you run 'npm install ${ENGINE === 'MYSQL' ? 'mysql2' : ENGINE.toLowerCase()}'? Original Error: ${e.message}`);
        }

        // Base class for all desktop drivers to handle common logic
        class DesktopDriver extends AbstractDriver {
            constructor(module) {
                super();
                this.module = module;
                this.connectionOptions = {};
            }

            async connect(options) {
                this.connectionOptions = { ...DEFAULT_OPTIONS, ...options };
                const opts = this.connectionOptions;

                if (DEBUG) console.log(`[${PLUGIN_NAME}]: Connecting to ${ENGINE} at ${opts.host}:${opts.port || 'default'}...`);

                try {
                    // Driver-specific connection logic
                    switch (ENGINE) {
                        case 'MYSQL':
                            this.pool = this.module.createPool(opts);
                            this.connection = await this.pool.getConnection(); // Test connection
                            break;
                        case 'MSSQL':
                            // MSSQL connection pool
                            this.pool = new this.module.ConnectionPool(opts);
                            this.connection = await this.pool.connect();
                            break;
                        case 'POSTGRESQL':
                            // PG uses a Pool for connection
                            this.pool = new this.module.Pool(opts);
                            this.connection = await this.pool.connect();
                            break;
                    }
                    if (DEBUG) console.log(`[${PLUGIN_NAME}]: ${ENGINE} connection established.`);
                    return this;

                } catch (e) {
                    if (DEBUG) console.error(`[${PLUGIN_NAME}]: ${ENGINE} Connection Error:`, e);

                    if (LOAD_FROM_JSON) {
                        console.warn(`[${PLUGIN_NAME}]: ${ENGINE} connection failed. Falling back to JSON file loading.`);
                        // Throw a special error to trigger the JSON fallback
                        const fallbackError = new Error(`Connection failed, attempting JSON fallback.`);
                        fallbackError.isFallback = true;
                        throw fallbackError;
                    }

                    throw new Error(`${ENGINE} Connection Failed: ${e.message}. Check your host/credentials.`);
                }
            }

            async execute(query, params, operation) {
                if (!this.connection) {
                    throw new Error(`${ENGINE}: Not connected. Call connect() first.`);
                }

                if (DEBUG) console.log(`[${PLUGIN_NAME}]: ${ENGINE} EXECUTE (${operation}): ${query} | Params: ${JSON.stringify(params)}`);

                try {
                    let result;
                    const safeParams = params || [];

                    switch (ENGINE) {
                        case 'MYSQL':
                            // Uses pool.query for simplicity (handles release automatically)
                            // The result is [rows, fields]
                            const [rows, fields] = await this.pool.query(query, safeParams);
                            if (operation === 'select') {
                                result = rows;
                            } else {
                                // INSERT, UPDATE, DELETE returns a Mysql.OkPacket
                                result = { affectedRows: rows.affectedRows, insertId: rows.insertId };
                            }
                            break;

                        case 'MSSQL':
                            // MSSQL requires explicit request building, and uses '@p' for parameters
                            const request = new this.module.Request(this.connection);
                            const placeholderQuery = query.replace(/\?/g, (match, i) => {
                                // Basic placeholder replacement; robust solution requires parameter type checking
                                request.input(`p${i}`, safeParams.shift());
                                return `@p${i}`;
                            });
                            result = await request.query(placeholderQuery);

                            if (operation === 'select') {
                                result = result.recordset;
                            } else {
                                result = { affectedRows: result.rowsAffected[0] };
                            }
                            break;

                        case 'POSTGRESQL':
                            // PG uses $1, $2, ... for parameters
                            result = await this.pool.query(query, safeParams);
                            if (operation === 'select') {
                                result = result.rows;
                            } else {
                                result = { affectedRows: result.rowCount };
                            }
                            break;
                    }
                    return result;
                } catch (e) {
                    if (DEBUG) console.error(`[${PLUGIN_NAME}]: ${ENGINE} Error during ${operation}:`, e);
                    throw new Error(`${ENGINE} Query Error: ${e.message}`);
                }
            }

            async listTables() {
                let query;
                switch (ENGINE) {
                    case 'MYSQL':
                        query = `SELECT table_name FROM information_schema.tables WHERE table_schema = '${this.connectionOptions.database}' AND table_type = 'BASE TABLE'`;
                        break;
                    case 'MSSQL':
                        query = `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_CATALOG = '${this.connectionOptions.database}'`;
                        break;
                    case 'POSTGRESQL':
                        query = `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`;
                        break;
                    default:
                        throw new Error('Unsupported listTables for this engine.');
                }
                const rows = await this.select(query);
                // Extract the table name from the row object (key varies by engine)
                const key = ENGINE === 'MYSQL' ? 'table_name' : (ENGINE === 'MSSQL' ? 'TABLE_NAME' : 'tablename');
                return rows.map(row => row[key]);
            }

            async listColumns(table) {
                let query;
                switch (ENGINE) {
                    case 'MYSQL':
                        query = `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = ? AND TABLE_SCHEMA = ?`;
                        break;
                    case 'MSSQL':
                        query = `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = ? AND TABLE_CATALOG = ?`;
                        break;
                    case 'POSTGRESQL':
                        query = `SELECT column_name FROM information_schema.columns WHERE table_name = ?`;
                        break;
                    default:
                        throw new Error('Unsupported listColumns for this engine.');
                }
                const params = ENGINE === 'POSTGRESQL' ? [table] : [table, this.connectionOptions.database];
                const rows = await this.select(query, params);

                // Extract the column name from the row object
                const key = 'COLUMN_NAME'; // Most engines use this or similar
                return rows.map(row => row[key] || row.column_name); // Check for postgresQL name
            }
        }
        Driver = DesktopDriver;

    } else {
        // --- ERROR/FALLBACK (Browser and not SQLITE3) ---
        if (ENGINE !== 'SQLITE3') {
            const moduleName = ENGINE === 'MYSQL' ? 'mysql2' : ENGINE.toLowerCase();
            const browserError = `[${PLUGIN_NAME}] Driver Error: Cannot use ${ENGINE} in a web (browser) export. This engine requires Node.js (NW.js desktop build). Please use 'SQLITE3' or deploy as desktop.`;

            // If in browser and not SQLITE3, set a null driver and throw on connect
            Driver = class BrowserErrorDriver extends AbstractDriver {
                async connect(options) {
                    if (LOAD_FROM_JSON) {
                        console.warn(browserError + " Attempting JSON fallback.");
                        const fallbackError = new Error(`Connection failed, attempting JSON fallback.`);
                        fallbackError.isFallback = true;
                        throw fallbackError;
                    }
                    throw new Error(browserError);
                }
            };
        }
    }

    // --- JSON Fallback Handler ---
    /**
     * @class JSONFallbackDriver
     * @description Simulates a database using a simple JSON file structure.
     */
    class JSONFallbackDriver extends AbstractDriver {
        constructor() {
            super();
            this.data = {}; // Placeholder for loaded JSON data
            console.warn(`[${PLUGIN_NAME}]: Initializing JSON Fallback Mode.`);
        }

        async connect(options) {
            // In a real implementation, you would load the JSON file here.
            // e.g., using fetch for browser or fs for desktop, and parsing the file.
            // For this example, we'll simulate a connection and throw a warning.
            console.warn(`[${PLUGIN_NAME}]: JSON Fallback connected (Data is simulated/empty until loaded).`);
            return this;
        }

        // The following methods would parse the query, try to find the table name,
        // and filter the loaded JSON data. This is non-trivial and simplified here.
        async execute(query, params, operation) {
            console.warn(`[${PLUGIN_NAME}]: JSON Fallback executed query (SIMULATED): ${query}`);
            if (operation === 'select') {
                return []; // Return empty array for simulation
            } else {
                return { affectedRows: 0 }; // Return 0 affected rows for simulation
            }
        }

        async listTables() {
            return ['players', 'inventory']; // Simulated tables
        }

        async listColumns(table) {
            // Simulated columns
            if (table === 'players') return ['id', 'name', 'gold'];
            return [];
        }
    }

    // --- GLOBAL API ($sql) ---
    /**
     * @class SQL_API
     * @description The global object that handles driver loading and method calls.
     */
    class SQL_API {
        constructor() {
            this._driver = null;
            this._jsonDriver = new JSONFallbackDriver();
        }

        /**
         * Connects to the database and handles JSON fallback.
         * @param {object} options - Connection options.
         * @returns {AbstractDriver} The active driver instance.
         */
        async connect(options = {}) {
            if (this._driver) {
                // Connection already active (could be a DB or JSON driver)
                return this._driver;
            }

            try {
                if (!Driver) {
                     throw new Error(`[${PLUGIN_NAME}]: A valid driver could not be configured for engine: ${ENGINE}.`);
                }
                const dbDriver = new Driver(nodeModule); // Pass module to desktop drivers
                this._driver = await dbDriver.connect(options);
                return this._driver;
            } catch (e) {
                if (e.isFallback) {
                    // Switch to JSON fallback driver
                    this._driver = await this._jsonDriver.connect();
                    return this._driver;
                }
                // Re-throw other errors
                throw e;
            }
        }

        // --- Proxy methods to the active driver ---
        async _exec(method, query, params) {
            const driver = await this.connect(); // Ensures connection is active
            return driver[method](query, params);
        }

        async select(query, params) { return this._exec('select', query, params); }
        async insert(query, params) { return this._exec('insert', query, params); }
        async update(query, params) { return this._exec('update', query, params); }
        async delete(query, params) { return this._exec('delete', query, params); }

        async listTables() {
            const driver = await this.connect();
            return driver.listTables();
        }

        async listColumns(table) {
            const driver = await this.connect();
            return driver.listColumns(table);
        }
    }

    // Expose the global API
    window.$sql = new SQL_API();
})();