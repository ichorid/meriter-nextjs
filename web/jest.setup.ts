const useInMemory = process.env.JEST_INMEMORY === 'true';

jest.mock('next/config', () => () => ({
    publicRuntimeConfig: {},
}));

// Allow switching between real Mongo and in-memory mocks
if (useInMemory) {
    jest.doMock('mongoose', () => {
        const actual = jest.requireActual('mongoose');
        const fakeModels = {};
        return {
            ...actual,
            connect: jest.fn().mockResolvedValue({}),
            createConnection: jest.fn().mockReturnValue({
                models: fakeModels,
                model: function (name, schema) {
                    if (!fakeModels[name]) {
                        fakeModels[name] = { name: name, schema: schema };
                    }
                    return fakeModels[name];
                },
            }),
            Types: actual.Types || { ObjectId: function () { return String(Math.random()); } },
            Schema: function () { return function () {}; },
        };
    });
}


// Increase default test timeout for async-heavy flows
jest.setTimeout(30000);

// In-memory mock for schema models to avoid real Mongoose operations during tests
if (useInMemory) jest.doMock('projects/meriter/schema/index.schema', () => {
    function matches(row, filter) {
        return Object.keys(filter || {}).every((k) => {
            var fv = filter[k];
            var rv = row[k];
            if (fv && typeof fv === 'object' && !Array.isArray(fv)) {
                // minimal operator support
                if ('$gte' in fv) { return (rv || 0) >= fv['$gte']; }
                return JSON.stringify(rv) === JSON.stringify(fv);
            }
            if (Array.isArray(rv)) { return rv.indexOf(fv) !== -1; }
            return rv === fv;
        });
    }
    function makeCollection(name) {
        var rows = [];
        return {
            async create(doc) {
                var d = Object.assign({ _id: String(rows.length + 1) }, doc);
                d.toObject = function () { return Object.assign({}, d); };
                rows.push(d);
                return d;
            },
            async deleteMany(filter) {
                if (!filter || Object.keys(filter).length === 0) {
                    rows = [];
                    return { deletedCount: 0 };
                }
                var keep = rows.filter(function (r) { return !matches(r, filter); });
                var deleted = rows.length - keep.length;
                rows = keep;
                return { deletedCount: deleted };
            },
            find(filter) {
                var data = rows.filter(function (r) { return matches(r, filter || {}); });
                var q = {
                    _data: data,
                    sort: function (arg) {
                        if (arg && typeof arg === 'object') {
                            var key = Object.keys(arg)[0];
                            var dir = arg[key];
                            this._data = this._data.slice().sort(function (a, b) {
                                var av = a[key] || 0; var bv = b[key] || 0; return dir < 0 ? bv - av : av - bv;
                            });
                        }
                        return this;
                    },
                    skip: function (n) { this._data = this._data.slice(n || 0); return this; },
                    limit: function (n) { return Promise.resolve(this._data.slice(0, n || this._data.length)); },
                    then: function (resolve, reject) { return Promise.resolve(this._data).then(resolve, reject); },
                };
                return q;
            },
            findOne(filter) {
                var doc = rows.find(function (r) { return matches(r, filter || {}); }) || null;
                if (doc && typeof doc.toObject !== 'function') { doc.toObject = function () { return Object.assign({}, doc); }; }
                // Attach a .sort method for chaining without breaking direct access
                if (doc && typeof doc.sort !== 'function') {
                    doc.sort = function () { return Promise.resolve(doc); };
                }
                if (!doc) { return { sort: function () { return Promise.resolve(null); } }; }
                return doc;
            },
            async updateOne(filter, update, opts) {
                var idx = rows.findIndex(function (r) { return matches(r, filter || {}); });
                if (idx === -1) {
                    if (opts && opts.upsert) {
                        var base = Object.assign({}, filter);
                        if (update && update.$inc) {
                            Object.keys(update.$inc).forEach(function (k) { base[k] = (base[k] || 0) + update.$inc[k]; });
                        } else {
                            base = Object.assign(base, update);
                        }
                        var toInsert = base;
                        await this.create(toInsert);
                        return { upsertedCount: 1, matchedCount: 0, modifiedCount: 0 };
                    }
                    return { upsertedCount: 0, matchedCount: 0, modifiedCount: 0 };
                }
                if (update && update.$inc) {
                    var current = Object.assign({}, rows[idx]);
                    Object.keys(update.$inc).forEach(function (k) { current[k] = (current[k] || 0) + update.$inc[k]; });
                    rows[idx] = current;
                } else {
                    rows[idx] = Object.assign({}, rows[idx], update);
                }
                return { upsertedCount: 0, matchedCount: 1, modifiedCount: 1 };
            },
            async bulkWrite(ops) {
                if (!Array.isArray(ops)) return { ok: 1 };
                for (var i = 0; i < ops.length; i++) {
                    var op = ops[i] && ops[i].updateOne;
                    if (op) {
                        await this.updateOne(op.filter || {}, op.update || {}, { upsert: !!op.upsert });
                    }
                }
                return { ok: 1 };
            },
            async count(filter) {
                return (await this.find(filter || {})).length;
            },
            sort() { return this; },
            update: function (filter, update, opts) { return this.updateOne(filter, update, opts); },
            aggregate: async function (pipeline) {
                // Very small subset: [$match, {$group: {_id:null, <field>: {$sum: "$amountTotal"}}}]
                var match = (pipeline && pipeline[0] && pipeline[0].$match) || {};
                var group = (pipeline && pipeline[1] && pipeline[1].$group) || {};
                var data = rows.filter(function (r) { return matches(r, match || {}); });
                var sumField = group && group.plus ? 'plus' : (group && group.minus ? 'minus' : (group && group.amount ? 'amount' : null));
                var sourceField = 'amountTotal';
                if (name === 'Wallet') sourceField = 'amount';
                if (name === 'Publication') sourceField = 'sum';
                var total = 0;
                for (var i = 0; i < data.length; i++) total += data[i][sourceField] || 0;
                if (group.plus) return [{ plus: total }];
                if (group.minus) return [{ minus: total }];
                if (group.amount) return [{ amount: total }];
                return [];
            },
        };
    }
    return {
        SentTGMessageLog: makeCollection('SentTGMessageLog'),
        TgChat: makeCollection('TgChat'),
        User: makeCollection('User'),
        Entity: makeCollection('Entity'),
        Publication: makeCollection('Publication'),
        Transaction: makeCollection('Transaction'),
        Wallet: makeCollection('Wallet'),
        Space: makeCollection('Space'),
        Capitalization: makeCollection('Capitalization'),
        // expose Document-like helpers to align with runtime code
        Schema: function () {},
        Types: {},
        default: {},
    };
});

// Mock Userdata model used in hooks
if (useInMemory) jest.doMock('users/userdata/userdata.model', () => {
    function makeCollection() {
        var rows = [];
        return {
            async updateOne(filter, update, opts) { return { ok: 1 }; },
            async findOne(filter) { return null; },
        };
    }
    return { Userdata: makeCollection() };
});


