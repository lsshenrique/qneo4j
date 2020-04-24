"use strict";

const _ = require("lodash");
const moment = require("moment");
const { types } = require('neo4j-driver').v1;

const dateFunctions = {
    Date: {
        _isDateTypeNeo4j: true,
        toStandardDate: (value) => new Date(value.year, value.month - 1, value.day),
        toMoment: (value) => moment(dateFunctions.Date.toStandardDate(value)),
    },
    DateTime: {
        _isDateTypeNeo4j: true,
        toStandardDate: (value) => new Date(value.year, value.month - 1, value.day, value.hour, value.minute, value.second, value.nanosecond / 1e+6),
        toMoment: (value) => moment(dateFunctions.DateTime.toStandardDate(value)),
    },
    LocalDateTime: {
        _isDateTypeNeo4j: true,
        toStandardDate: (value) => new Date(value.year, value.month - 1, value.day, value.hour, value.minute, value.second, value.nanosecond / 1e+6),
        toMoment: (value) => moment(dateFunctions.LocalDateTime.toStandardDate(value)),
    },
    Time: {
        _isDateTypeNeo4j: true,
        toStandardDate: (value) => new Date(0, 0, 0, value.hour, value.minute, value.second, value.nanosecond / 1e+6),
        toMoment: (value) => moment(dateFunctions.Time.toStandardDate(value)),
    },
    LocalTime: {
        _isDateTypeNeo4j: true,
        toStandardDate: (value) => new Date(0, 0, 0, value.hour, value.minute, value.second, value.nanosecond / 1e+6),
        toMoment: (value) => moment(dateFunctions.LocalTime.toStandardDate(value)),
    },
};

const DATE_TYPE = {
    LOCAL_TIME: types.LocalTime,
    TIME: types.Time,
    DATE: types.Date,
    LOCAL_DATE_TIME: types.LocalDateTime,
    DATE_TIME: types.DateTime,
};

function injectDateFunctions() {
    for (const typeName in dateFunctions) {
        if (dateFunctions.hasOwnProperty(typeName)) {
            const prototypes = dateFunctions[typeName];

            types[typeName].prototype._isDateTypeNeo4j = prototypes._isDateTypeNeo4j;

            types[typeName].prototype.toStandardDate = function() {
                return prototypes.toStandardDate(this);
            };

            types[typeName].prototype.toMoment = function() {
                return prototypes.toMoment(this);
            };
        }
    }
}

module.exports = class QNeo4jHelper {
    static objToString(...args) {
        if (_.isEmpty(args) || _.every(args, _.isEmpty)) return "";

        const obj = Object.assign({}, ...args);
        return JSON.stringify(obj).replace(/\"([^(\")"]+)\":/g, "$1:");
    }

    static objToParams(prefix, ...args) {
        if (!prefix || typeof prefix !== "string")
            return this.objToString(...args);

        const obj = Object.assign({}, ...args);
        const params = {};

        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                params[`${prefix}.${key}`] = obj[key];
            }
        }

        return JSON.stringify(params).replace(/\"([^(\")"]+)\":/g, "$1:");
    }

    static objClone(value) {
        return _.clone(value);
    }

    static isDateTypeNeo4j(value) {
        const typeName = value.constructor.name;
        return value && value[`__is${typeName}__`] && dateFunctions[typeName];
    }
    static isIntegerNeo4j(value) {
        return value instanceof types.Integer;
    }

    static isDateObject(value) {
        return typeof value === "object" &&
            Object.keys(value).some(e => ["year", "month", "day", "hour", "minute", "second"].indexOf(e) > -1);
    }

    static toStandardDate(value) {
        if (this.isDateTypeNeo4j(value)) {
            return dateFunctions[value.constructor.name].toStandardDate(value);
        } else if (this.isDateObject(value)) {
            return new Date(
                value.year || 0,
                value.month - 1 || 0,
                value.day || 0,
                value.hour || 0,
                value.minute || 0,
                value.second || 0
            );
        }

        return null;
    }

    static toMoment(dateNeo4j) {
        if (this.isDateTypeNeo4j(dateNeo4j)) {
            return dateFunctions[dateNeo4j.constructor.name].toMoment(dateNeo4j);
        }

        return null;
    }

    static parseDate(date, dateTypeNeo4j = DATE_TYPE.LOCAL_DATE_TIME, inputFormat) {
        let dateParsed = null;

        if (date && dateTypeNeo4j.fromStandardDate) {
            if (this.isDateTypeNeo4j(date)) {
                const dateAux = this.toStandardDate(date);
                dateParsed = dateTypeNeo4j.fromStandardDate(dateAux);
            } else if (date instanceof Date) {
                dateParsed = dateTypeNeo4j.fromStandardDate(date);
            } else if (date instanceof moment) {
                if (date.isValid()) {
                    dateParsed = dateTypeNeo4j.fromStandardDate(date.toDate());
                }
            } else if (this.isDateObject(date)) {
                const dateAux = this.toStandardDate(date);
                dateParsed = dateTypeNeo4j.fromStandardDate(dateAux);
            } else {
                const format = !inputFormat && !Number.isInteger(date) ? 'DD/MM/YYYY' : inputFormat;
                const dtMoment = moment(date, format);

                if (dtMoment.isValid()) {
                    dateParsed = dateTypeNeo4j.fromStandardDate(dtMoment.toDate());
                }
            }
        }

        return dateParsed;
    }

    static parseDateCypher(date, dateTypeNeo4j = DATE_TYPE.LOCAL_DATE_TIME, inputFormat) {
        const dateNeo4j = this.parseDate(date, dateTypeNeo4j, inputFormat);

        if (dateNeo4j) {
            return `${dateTypeNeo4j.name}("${dateNeo4j.toString()}")`;
        }
        return null;
    }

    static parseResponse(records, options) {
        if (!this._hasFields(records)) return [];

        const opt = Object.assign({}, { dateType: "moment" }, options);

        return records.map(record => {
            const obj = {};

            record.keys.forEach((key, index) => {
                const value = record._fields[index];
                this._addValueToObj(obj, key, value, opt);
            });

            return obj;
        });
    }

    static _addValueToObj(obj, key, value, options) {
        let valueAux = value;

        if (value && typeof value === 'object') {
            if (this.isDateTypeNeo4j(value)) {
                if (options.dateType === 'moment') {
                    valueAux = dateFunctions[value.constructor.name].toMoment(value);
                } else if (options.dateType === 'native') {
                    valueAux = dateFunctions[value.constructor.name].toStandardDate(value);
                } else if (options.dateType === 'timestamp') {
                    valueAux = dateFunctions[value.constructor.name].toStandardDate(value).valueOf();
                } else {
                    valueAux = value;
                }
            } else {
                valueAux = Array.isArray(value) ? [] : {};
                const props = value.properties || value;

                for (const keyProp in props)
                    this._addValueToObj(valueAux, keyProp, props[keyProp], options);
            }
        }

        const fieldName = this._generateFieldName(key);
        obj[fieldName] = valueAux;
    }

    static _generateFieldName(name) {
        return name.indexOf('.') >= 0 ? name.split('.').pop() : name;
    }

    static _hasFields(records) {
        return records && records.length > 0 && records[0]._fields && records[0]._fields.length > 0;
    }

    static toIntOrNull(value) {
        return Number.parseInt(value, 10) || null;
    }

    static toFloatOrNull(value) {
        return Number.parseFloat(value) || null;
    }

    static clearStringForRegex(value) {
        if (!value) return null;

        return _.dropWhile(value, (o) => o === '*')
            .join('')
            .replace(/\|/g, '\\\|')
            .replace(/\\/g, '\\\\')
            .replace(/\(/g, '\\\(')
            .replace(/\)/g, '\\\)')
            .replace(/\[/g, '\\\[')
            .replace(/\]/g, '\\\]')
            .replace(/\{/g, '\\\{')
            .replace(/\}/g, '\\\}');
    }
};

module.exports.injectDateFunctions = injectDateFunctions;
module.exports.setGlobalOptions = function(options) {
    const opts = Object.assign({}, { dateLocale: 'pt-br' }, options);
    if (opts.dateLocale) moment.locale(opts.dateLocale);
};
module.exports.DATE_TYPE = DATE_TYPE;
module.exports.dateFunctions = dateFunctions;