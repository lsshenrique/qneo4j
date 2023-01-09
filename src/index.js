'use strict';

// CLEANUP DRIVE ON PROCESS EXIT
const { regiter } = require('./cleanup');

const neo4j = require("neo4j-driver").default;
const helper = require("./helper");
const { isObject } = helper;
const PromiseQNeo4j = require('./promise');

helper.injectDateFunctions();
helper.setGlobalOptions({ dateLocale: 'pt-br' });

const RETURN_TYPES = {
    PARSER: 0,
    PARSER_RAW: 1,
    RAW: 2,
};

const ACCESS_MODE = {
    READ: neo4j.session.READ,
    WRITE: neo4j.session.WRITE,
};
class Result {
    constructor(rawResult, options) {
        this.options = options;
        this.rawResult = rawResult;
        this.value = helper.parseResponse(rawResult.records, options);
    }

    get rawResult() {
        return this._rawResult;
    }
    set rawResult(value) {
        this._rawResult = value;
    }

    get value() {
        return this._value;
    }
    set value(value) {
        this._value = value;
    }
}

class QNeo4j {
    constructor(options = {}) {
        const opts = isObject(options) ? options : {};
        this.updateOptions(opts, true);

        regiter(this);
    }

    get notifyError() {
        return this._erroCallback;
    }

    set notifyError(value) {
        if (typeof value === 'function')
            this._erroCallback = value;
        else
            this._erroCallback = function() {};
    }

    get url() {
        return this._url;
    }

    set url(value) {
        if (typeof value === 'string' && value.length > 0)
            this._url = value;
        else
            this._url = '';
    }

    get username() {
        return this._username;
    }

    set username(value) {
        if (typeof value === 'string')
            this._username = value;
        else
            this._username = 'neo4j';
    }

    get driverConfig() {
        return this._driverConfig;
    }

    set driverConfig(value) {
        this._driverConfig = value;
    }

    get password() {
        return this._password;
    }

    set password(value) {
        if (typeof value === 'string')
            this._password = value;
        else
            this._password = 'admin';
    }

    get database() {
        return this._database;
    }

    set database(value) {
        if (typeof value === 'string' && value.length > 0)
            this._database = value;
        else
            this._database = '';
    }

    get globalDriver() {
        if (!this._globalDriver) this._globalDriver = this.createDriver();
        return this._globalDriver;
    }

    updateOptions(options, reset = false) {
        if (!isObject(options)) return;

        if (options.raw || reset)
            this.raw = options.raw;

        if (options.url || reset)
            this.url = options.url;

        if (options.username || reset)
            this.username = options.username;

        if (options.password || reset)
            this.password = options.password;

        if (options.database || reset)
            this.database = options.database;

        if (options.notifyError || reset)
            this.notifyError = options.notifyError;

        if (options.driverConfig || reset)
            this.driverConfig = options.driverConfig;
    }

    execute(queryOpt, opts) {
        const driver = this.globalDriver;
        const configs = {};

        configs.defaultAccessMode = opts && opts.accessMode ? opts.accessMode : neo4j.session.WRITE;

        if (this.database) {
            configs.database = this.database;
        }

        const session = driver.session(configs);

        const p = this
            ._run(session, queryOpt, opts)
            .catch(error => {
                this.notifyError(error, queryOpt);
                throw error;
            })
            .finally(async() => {
                await session.close();
            });

        return PromiseQNeo4j.convert(p);
    }

    readTransaction(queryOrBlockTransaction, transactionConfig) {
        let _queryOpt = null;
        let work = null;

        const executeGeneric = (sessionOrTransaction, queryOpt, opts) => {
            _queryOpt = queryOpt;
            const p = this._run(sessionOrTransaction, queryOpt, opts);
            return PromiseQNeo4j.convert(p);
        };

        if (typeof queryOrBlockTransaction === 'function') {
            const blockTransaction = queryOrBlockTransaction;

            work = (txc) => {
                const execute = (queryOpt, opts) => executeGeneric(txc, queryOpt, opts);
                return blockTransaction(execute, txc);
            };

        } else {
            const queryOpt = queryOrBlockTransaction;
            const opts = transactionConfig;
            work = (txc) => executeGeneric(txc, queryOpt, opts);
        }

        const driver = this.globalDriver;

        const configs = {};
        
        if (this.database) {
            configs.database = this.database;
        }

        const session = driver.session(configs);

        const p = session
            .readTransaction(work, transactionConfig)
            .catch(error => {
                this.notifyError(error, _queryOpt);
                throw error;
            })
            .finally(async() => {
                await session.close();
            });

        return PromiseQNeo4j.convert(p);
    }

    writeTransaction(queryOrBlockTransaction, transactionConfig) {
        let _queryOpt = null;

        let work = null;
        const executeGeneric = (sessionOrTransaction, queryOpt, opts) => {
            _queryOpt = queryOpt;
            const p = this._run(sessionOrTransaction, queryOpt, opts);
            return PromiseQNeo4j.convert(p);
        };

        if (typeof queryOrBlockTransaction === 'function') {
            const blockTransaction = queryOrBlockTransaction;

            work = (txc) => {
                const execute = (queryOpt, opts) => executeGeneric(txc, queryOpt, opts);
                return blockTransaction(execute, txc);
            };

        } else {
            const queryOpt = queryOrBlockTransaction;
            const opts = transactionConfig;
            work = (txc) => executeGeneric(txc, queryOpt, opts);
        }

        const driver = this.globalDriver;

        const configs = {};
        
        if (this.database) {
            configs.database = this.database;
        }

        const session = driver.session(configs);

        const p = session
            .writeTransaction(work, transactionConfig)
            .catch(error => {
                this.notifyError(error, _queryOpt);
                throw error;
            })
            .finally(async() => {
                await session.close();
            });

        return PromiseQNeo4j.convert(p);
    }

    transaction(queryOrBlockTransaction, transactionConfig) {
        const driver = this.globalDriver;

        const configs = {};
        
        if (this.database) {
            configs.database = this.database;
        }

        const session = driver.session(configs);
        const tx = session.beginTransaction();
        let _queryOpt = null;
        let promiseExecute = null;

        const execute = (queryOpt, opts) => {
            _queryOpt = queryOpt;
            const p = this._run(tx, queryOpt, opts);
            return PromiseQNeo4j.convert(p);
        };

        if (typeof queryOrBlockTransaction === 'function') {
            promiseExecute = queryOrBlockTransaction(execute, tx);
        } else {
            promiseExecute = execute(queryOrBlockTransaction, transactionConfig);
        }

        const p = promiseExecute
            .then(async(result) => {
                if (tx.isOpen()) await tx.commit();

                return result;
            })
            .catch(async error => {
                this.notifyError(error, _queryOpt);

                if (tx.isOpen()) await tx.rollback();

                throw error;
            })
            .finally(async() => {
                await session.close();
            });

        return PromiseQNeo4j.convert(p);
    }

    _run(sessionOrTransaction, queryOpt, opts) {
        if (!queryOpt) return;

        const _queryOpt = Array.isArray(queryOpt) ? queryOpt : [queryOpt];
        const _opts = opts || { returnType: RETURN_TYPES.PARSER };

        // RUN ALL QUERIES AND CREATE A PROMISE FOR EACH
        let promises = _queryOpt.map((query) => {
            if (_opts.debug) {
                // eslint-disable-next-line no-console
                console.log(helper.cypherReplaceParams(queryOpt));
            }

            if (isObject(query)) {
                const params = helper.objClone(query.params);

                this.normalizeParams(params);

                return sessionOrTransaction.run(query.cypher, params);
            }

            return sessionOrTransaction.run(query);
        });

        // BUILD RETURN TYPE
        const resultFull = (p) => p.then(result => new Result(result, _opts));
        const resultParser = (p) => p.then(result => new Result(result, _opts).value);

        if (!this.raw && !this._returnTypeIsRaw(_opts)) {
            if (_opts.returnType === RETURN_TYPES.PARSER_RAW) {
                promises = promises.map(resultFull);
            } else {
                promises = promises.map(resultParser);
            }
        }

        // RETURN AS ARRAY LENGTH
        if (promises.length === 0) return;
        else if (promises.length === 1) return promises[0];

        // AWAITS ALL PROMISES
        return Promise.all(promises);
    }

    normalizeParams(params) {
        if (!params) return;

        for (const key in params) {
            if (params[key] === undefined || params[key] === Number.isNaN) {
                params[key] = null;
            } else if (typeof params[key] === 'number' && Number.isInteger(params[key])) {
                params[key] = neo4j.int(params[key]);
            } else if (Array.isArray(params[key])) {
                params[key] = [...params[key]];
                this.normalizeParams(params[key]);
            } else if (isObject(params[key]) && !helper.isDateTypeNeo4j(params[key]) && !helper.isIntegerNeo4j(params[key])) {
                this.normalizeParams(params[key]);
            }
        }
    }

    createDriver() {
        const auth = neo4j.auth.basic(this.username, this.password);

        return neo4j.driver(this.url, auth, {
            disableLosslessIntegers: true,
            ...this.driverConfig,
        });
    }

    async close() {
        if (this._globalDriver) {
            await this._globalDriver.close();
        }
    }

    _returnTypeIsRaw(options) {
        return options && options.returnType === RETURN_TYPES.RAW;
    }
}

module.exports = QNeo4j;
module.exports.Result = Result;
module.exports.RETURN_TYPES = RETURN_TYPES;
module.exports.ACCESS_MODE = ACCESS_MODE;
module.exports.helper = helper;
