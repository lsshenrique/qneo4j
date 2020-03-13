'use strict';

class PromiseQNeo4j extends Promise {
    constructor(executor = (res, rej) => {}) {
        let res, rej;

        super((resolve, reject) => {
            executor(resolve, reject);

            res = resolve;
            rej = reject;
        });

        this.resolve = res;
        this.reject = rej;
    }

    async first(propertyReturn) {
        const firstResult = await this.then(r => r && r[0]);

        if (firstResult && propertyReturn) {
            if (typeof propertyReturn === 'function') {
                return propertyReturn(firstResult);
            } else if (typeof propertyReturn === 'string') {
                return firstResult[propertyReturn];
            }
        }

        return firstResult;
    }

    async thenMap(fnMap) {
        return this.then(r => r && r.map(fnMap));
    }

    static convert(promise, props) {
        Reflect.setPrototypeOf(promise, PromiseQNeo4j.prototype);

        return props ? Object.assign(promise, props) : promise;
    }
}

module.exports = PromiseQNeo4j;