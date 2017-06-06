'use strict';

const Lab = require('lab');
const PouchDB = require('pouchdb');
const memdown = require('memdown');
const Code = require('code');
const actionTypes = require('./_action_types');
const rootReducer = require('./reducers');
const timers = require('timers');
const async = require('async');

const lab = Lab.script();
exports.lab = lab;
const describe = lab.experiment;
const it = lab.it;
const expect = Code.expect;

const db = new PouchDB('todos', {
  db: memdown,
});

const redux = require('redux');

const PouchMiddleware = require('../lib/');

describe('Pouch Redux Middleware with Objects', () => {
  let pouchMiddleware;
  let store;

  it('todosmaps can be created', done => {
    pouchMiddleware = PouchMiddleware({
      path: '/todosobject',
      db,
      actions: {
        remove: doc => ({ type: actionTypes.DELETE_TODO, id: doc._id }),
        insert: doc => ({ type: actionTypes.INSERT_TODO, todo: doc }),
        batchInsert: docs => ({
          type: actionTypes.BATCH_INSERT_TODOS,
          todos: docs,
        }),
        update: doc => ({ type: actionTypes.UPDATE_TODO, todo: doc }),
      },
      changeFilter: doc => !doc.filter,
    });
    done();
  });

  it('can be used to create a store', done => {
    const createStoreWithMiddleware = redux.applyMiddleware(pouchMiddleware)(
      redux.createStore
    );
    store = createStoreWithMiddleware(rootReducer);
    done();
  });

  it('accepts a few inserts', done => {
    store.dispatch({ type: actionTypes.ADD_TODO, text: 'do laundry', id: 'a' });
    store.dispatch({
      type: actionTypes.ADD_TODO,
      text: 'wash dishes',
      id: 'b',
    });
    timers.setTimeout(done, 100);
  });

  it('saves changes in pouchdb', done => {
    async.map(['a', 'b'], db.get.bind(db), (err, results) => {
      if (err) return done(err);
      expect(results.length).to.equal(2);
      expect(results[0].text).to.equal('do laundry');
      expect(results[1].text).to.equal('wash dishes');
      done();
    });
  });

  it('accepts an removal', done => {
    store.dispatch({ type: actionTypes.DELETE_TODO, id: 'a' });
    timers.setTimeout(done, 100);
  });

  it('saves changes in pouchdb', done => {
    db.get('a', err => {
      expect(err).to.be.an.object();
      expect(err.message).to.equal('missing');
      done();
    });
  });
});
