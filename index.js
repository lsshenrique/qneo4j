'use strict';

const neo4j = require("neo4j-driver").v1;
const helper = require("@qualitech/qneo4j-helper");

// eslint-disable-next-line
Promise.prototype.first = async function(propertyReturn) {
    const firstResult = await this.then(r => r && r[0]);

    if (firstResult && propertyReturn) {
        if (typeof propertyReturn === 'function') {
            return propertyReturn(firstResult);
        } else if (typeof propertyReturn === 'string') {
            return firstResult[propertyReturn];
        }
    }

    return firstResult;
};

// eslint-disable-next-line
Promise.prototype.thenMap = function(fnMap) {
    return this.then(r => r && r.map(fnMap));
};

const RETURN_TYPES = {
    PARSER: 0,
    PARSER_RAW: 1,
    RAW: 2,
};

function isObject(value) {
    return value && typeof value === 'object';
}


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

    get autoCloseDriver() {
        return this._autoCloseDriver;
    }

    set autoCloseDriver(value) {
        this._autoCloseDriver = typeof value === 'boolean' ? value : true;
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

        if (options.notifyError || reset)
            this.notifyError = options.notifyError;

        if (options.autoCloseDriver || reset)
            this.autoCloseDriver = options.autoCloseDriver;

        if (options.driverConfig || reset)
            this.driverConfig = options.driverConfig;
    }

    async execute(queryOpt, opts) {
        const closeDriver = this.autoCloseDriver;
        const driver = closeDriver ? this.createDriver() : this.globalDriver;
        const session = driver.session();

        try {
            return await this._run(session, queryOpt, opts);
        } catch (error) {
            this.notifyError(error, queryOpt);
            throw error;
        } finally {
            session.close();
            if (closeDriver) driver.close();
        }
    }

    async transaction(blockTransaction) {
        const closeDriver = this.autoCloseDriver;
        const driver = closeDriver ? this.createDriver() : this.globalDriver;
        const session = driver.session();
        const tx = session.beginTransaction();
        let _queryOpt = null;

        try {
            const execute = (queryOpt, opts) => {
                _queryOpt = queryOpt;
                return this._run(tx, queryOpt, opts);
            };

            const result = await blockTransaction(execute, tx);

            if (tx.isOpen()) await tx.commit();

            return result;
        } catch (error) {
            this.notifyError(error, _queryOpt);

            if (tx.isOpen()) await tx.rollback();

            throw error;
        } finally {
            session.close();

            if (closeDriver) driver.close();
        }
    }

    _run(sessionOrTransaction, queryOpt, opts) {
        if (!queryOpt) return;

        const _queryOpt = Array.isArray(queryOpt) ? queryOpt : [queryOpt];
        const _opts = opts || { returnType: RETURN_TYPES.PARSER };

        // RUN ALL QUERIES AND CREATE A PROMISE FOR EACH
        let promises = _queryOpt.map((query) => {
            if (isObject(query)) {
                this.normalizeParams(query.params);
                return sessionOrTransaction.run(query.cypher, query.params);
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
            } else if (isObject(params[key]) && !helper.isDateTypeNeo4j(params[key])) {
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

    _returnTypeIsRaw(options) {
        return options && options.returnType === RETURN_TYPES.RAW;
    }
}

module.exports = QNeo4j;
module.exports.Result = Result;
module.exports.RETURN_TYPES = RETURN_TYPES;
module.exports.helper = helper;